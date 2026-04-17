import dotenv from "dotenv";
dotenv.config();

const NVIDIA_API_KEY = process.env.NVIDIA_API_KEY;
const BASE_URL = "https://integrate.api.nvidia.com/v1";

export class AiService {
  /**
   * Generates embeddings for an array of texts in batches
   */
  async getEmbeddings(texts, inputType = "passage") {
    // NVIDIA recommended max batch size is 50 for embeddings
    const BATCH_SIZE = 50;
    let allEmbeddings = [];

    // Ensure it's an array
    const textArray = Array.isArray(texts) ? texts : [texts];

    for (let i = 0; i < textArray.length; i += BATCH_SIZE) {
      const batch = textArray.slice(i, i + BATCH_SIZE);

      const response = await fetch(`${BASE_URL}/embeddings`, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${NVIDIA_API_KEY}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          model: "nvidia/nv-embedqa-e5-v5",
          input: batch,
          input_type: inputType,
          encoding_format: "float",
          truncate: "NONE"
        })
      });

      if (!response.ok) {
        throw new Error(`Embedding Error: ${await response.text()}`);
      }

      const data = await response.json();
      // Keep order of embeddings
      allEmbeddings.push(...data.data.map(d => d.embedding));
    }

    return Array.isArray(texts) ? allEmbeddings : allEmbeddings[0];
  }

  /**
   * Generates embedding for single text (Backwards compatibility)
   */
  async getEmbedding(text, inputType = "passage") {
    return this.getEmbeddings(text, inputType);
  }

  /**
   * Expands the user query for better retrieval matching
   */
  async expandQuery(question) {
    try {
      const response = await fetch(`${BASE_URL}/chat/completions`, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${NVIDIA_API_KEY}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          model: "meta/llama-3.1-8b-instruct",
          messages: [
            {
              role: "system",
              content: "You are a specialized RAG query expansion engine. REWRITE the user question into a detailed search query for a vector database. Include synonyms and keywords. OUTPUT ONLY THE SEARCH STRING. DO NOT EXPLAIN. DO NOT ASK QUESTIONS. If the user says 'hi' or something casual, just output the same word back."
            },
            {
              role: "user",
              content: question
            }
          ],
          temperature: 0.1
        })
      });

      if (!response.ok) return question;
      const data = await response.json();
      const expanded = data.choices[0].message.content.trim();
      return expanded;
    } catch (e) {
      console.error("Query Expansion Error:", e.message);
      return question;
    }
  }

  /**
   * Triple-Path Intent Governor
   */
  async getIntent(question) {
    try {
      const response = await fetch(`${BASE_URL}/chat/completions`, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${NVIDIA_API_KEY}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          model: "meta/llama-3.1-8b-instruct",
          messages: [
            {
              role: "system",
              content: `Classify user intent into exactly one category:
              - 'CASUAL': Greetings, jokes, identity, or meta-talk.
              - 'STUDY_QUICK': Simple definitions, facts, or short academic questions (e.g., 'What is X?').
              - 'STUDY_DEEP': Complex explanations, 'how it works', comparisons, or deep reasoning.`
            },
            { role: "user", content: question }
          ],
          temperature: 0.1,
          max_tokens: 10
        })
      });
      const data = await response.json();
      const intent = (data.choices[0]?.message?.content || 'CASUAL').toUpperCase();
      if (intent.includes('DEEP')) return 'STUDY_DEEP';
      if (intent.includes('QUICK')) return 'STUDY_QUICK';
      return 'CASUAL';
    } catch {
      return 'STUDY_QUICK';
    }
  }

  /**
   * Generates chat answer based on context as a stream
   */
  async getChatAnswer(question, contextText, history = [], subject = "General Academics", intent = "STUDY_QUICK") {
    const isDeep = intent === "STUDY_DEEP";
    const isQuick = intent === "STUDY_QUICK";
    const isCasual = intent === "CASUAL";
    const modelToUse = isDeep ? "nvidia/nemotron-3-super-120b-a12b" : "meta/llama-3.1-8b-instruct";

    let systemPrompt = `You are the HITAM Academic Mentor, a specialized AI for students at Hyderabad Institute of Technology and Management.
    
    YOUR CORE KNOWLEDGE (WEEKLY ROUTINE):
    - Periods: 1 (9:00-10:15 AM), 2 (10:15-11:15 AM), 3 (11:15-12:15 PM), 4 (1:00-2:00 PM), 5 (2:00-3:00 PM), 6 (3:00-4:30 PM). 
    - LUNCH: 12:15 PM - 1:00 PM.
    - WEEKLY TABLE:
      * Mon: CN(P1), OOPJ(P2), CDC(P3), UMF(P4), OOPJ(P5, P6)
      * Tue: SMF(P1, P2), OOPJ(P3), CN(P4), PBL(P5, P6)
      * Wed: OOPS(R)(P1), SE(P2), OS(P3), CN Lab(P4, P5), Yoga(P6)
      * Thu: IDS(P1), COI(P2), SMF(P3), SE(P4), OOPJ(P5), PBL(P6)
      * Fri: CN(P1), LIB(P2), SMF(P3), Mentor(P4), AF/S/OH(P5, P6)
      * Sat: OOJS(R)(P1), CN(R)(P2), SMF(R)(P3), BC(P4, P5, P6)
    - SUBJECTS: SMF (Math), OOPJ (Java), IDS (Data Science), CN (Networks), SE (Software Eng), COI (Constit.), OS (Operating Systems), CDC (Placements), PBL (Project), LIB (Library), AF/S/OH (Office Hours/Sports).

    YOUR SOUL: 70% Zen Sensei, 20% Intellectual Professor, 10% Precise Analyst.
    STRICT RULE: Only support students in their academics. Avoid casual 'vibing'. Use 'The Gentle Pivot' if off-topic.
    SCHEDULING RULE: You have access to the GLOBAL ACADEMIC CALENDAR (from context). If asked about exams (Mid-terms, End-sems), Spells of Instructions, or holidays, ALWAYS check the context first. Precision with dates is mandatory.`;

    if (isCasual) {
      systemPrompt += `\nVIBE: Calm and wise. Lead the student back to their studies if they drift. Focus on the weekly routine if they seem lost.`;
    } else if (isQuick) {
      systemPrompt += `\nFOCUS: Give short, accurate definitions or schedule details.`;
    } else if (isDeep) {
      systemPrompt += `\nFOCUS: Provide deep study guides. For scheduling, provide a clear structured breakdown of the upcoming weeks.`;
    }

    const chatMessages = [
      { role: "system", content: systemPrompt },
      ...history,
      {
        role: "user",
        content: isCasual ? question : `Context:\n${contextText}\n\nStudent Question: ${question}`
      }
    ];

    const requestBody = {
      model: modelToUse,
      messages: chatMessages,
      temperature: isDeep ? 0.7 : 0.8,
      top_p: 0.9,
      max_tokens: isDeep ? 16384 : 1024,
      stream: true
    };

    if (modelToUse === "nvidia/nemotron-3-super-120b-a12b") {
      requestBody.extra_body = {
        chat_template_kwargs: { enable_thinking: false },
        reasoning_budget: 1024
      };
    }

    const response = await fetch(`${BASE_URL}/chat/completions`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${NVIDIA_API_KEY}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify(requestBody)
    });


    if (!response.ok) {
      throw new Error(`Chat API Error: ${await response.text()}`);
    }

    return response.body; // Returns the readable stream
  }
}

export const aiService = new AiService();
