import dotenv from "dotenv";
dotenv.config();

const NVIDIA_API_KEY = process.env.NVIDIA_API_KEY;
const BASE_URL = "https://integrate.api.nvidia.com/v1";

export class AiService {
  /**
   * Generates embeddings for an array of texts in batches
   */
  async getEmbeddings(texts, inputType = "passage") {
    const BATCH_SIZE = 50;
    let allEmbeddings = [];
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
      allEmbeddings.push(...data.data.map(d => d.embedding));
    }

    return Array.isArray(texts) ? allEmbeddings : allEmbeddings[0];
  }

  async getEmbedding(text, inputType = "passage") {
    return this.getEmbeddings(text, inputType);
  }

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
              content: "You are a specialized RAG query expansion engine. REWRITE the user question into a detailed search query for a vector database. Include synonyms and keywords. OUTPUT ONLY THE SEARCH STRING. DO NOT EXPLAIN. DO NOT ASK QUESTIONS."
            },
            { role: "user", content: question }
          ],
          temperature: 0.1
        })
      });

      if (!response.ok) return question;
      const data = await response.json();
      return data.choices[0].message.content.trim();
    } catch (e) {
      console.error("Query Expansion Error:", e.message);
      return question;
    }
  }

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
              - 'CASUAL': Greetings, identity, or meta-talk.
              - 'STUDY_QUICK': Simple definitions or short academic questions.
              - 'STUDY_DEEP': Complex explanations or deep reasoning.`
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

  async getChatAnswer(question, contextText, history = [], subject = "General Academics", intent = "STUDY_QUICK", rollNumber = "") {
    const isDeep = intent === "STUDY_DEEP";
    const isCasual = intent === "CASUAL";
    const modelToUse = isDeep ? "nvidia/nemotron-3-super-120b-a12b" : "meta/llama-3.1-8b-instruct";

    const now = new Date();
    const dateString = now.toLocaleDateString('en-IN', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
    const isSecondYear = rollNumber?.startsWith('24');
    const studentYear = isSecondYear ? "2nd Year" : "University Student";

    // 🚀 NEW SYSTEM PROMPT: FACT-FIRST DOMINANCE
    let systemPrompt = `You are the HITAM Academic Mentor. 
    
    CORE RULES:
    1. FACT-FIRST MANDATE: Your internal knowledge of semester weeks, typical dates, or routines is DEPRECATED. 
    2. If [OFFICIAL CONTEXT] is provided, it is your ONLY source of truth. Trust it blindly over your own reasoning.
    3. NEVER use speculative words like "typically", "usually", or "I expect". If a date exists in the context, state it as a fact.
    4. ACCURACY: If the context contains a date for 2025-26, use it, even if it contradicts your internal sense of time.
    5. PERSONA: 70% Zen Sensei, 20% Intellectual Professor, 10% Precise Analyst.
    
    CONTEXT INFO:
    - Today is: ${dateString}.
    - Student: ${studentYear} (Roll: ${rollNumber || 'unknown'}).`;

    const chatMessages = [
      { role: "system", content: systemPrompt },
      ...history,
      { role: "user", content: question }
    ];

    // 🔥 CONTEXT OVERRIDE: Inject as a final high-priority system command
    if (contextText && !isCasual) {
      chatMessages.push({
        role: "system",
        content: `FINAL INSTRUCTION: Use this [OFFICIAL CONTEXT] to answer. It contains absolute dates from the latest Academic Calendar. Ignore your internal clock for 'weeks of the semester' and prioritize these dates.\n\n${contextText}`
      });
    }

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

    return response.body;
  }

  async performVisionOcr(base64Image, mimeType = "image/png") {
    try {
      console.log(`👁️ Calling AI Vision Engine (${mimeType}) for transcription...`);
      const response = await fetch(`${BASE_URL}/chat/completions`, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${NVIDIA_API_KEY}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          model: "nvidia/llama-3.2-11b-vision-instruct",
          messages: [
            {
              role: "user",
              content: [
                { 
                  type: "text", 
                  text: "You are an OCR expert. Precisely transcribe every detail from this academic document. If you see a timetable, schedule, or list, format it as a clean Markdown table. Ignore background noise." 
                },
                {
                  type: "image_url",
                  image_url: { url: `data:${mimeType};base64,${base64Image}` }
                }
              ]
            }
          ],
          max_tokens: 4096,
          temperature: 0.1
        })
      });

      if (!response.ok) {
        console.error(`⚠️ Vision API Error (${response.status})`);
        return null;
      }

      const data = await response.json();
      return data.choices[0]?.message?.content || "";
    } catch (e) {
      console.error("Vision OCR Error:", e.message);
      return null;
    }
  }
}

export const aiService = new AiService();
