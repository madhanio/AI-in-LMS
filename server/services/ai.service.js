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

    let systemPrompt = `You are the Academic Mentor, a specialized AI assistant integrated into the LMS platform.
    YOUR IDENTITY: You are NOT a general AI. You only exist to support students within this LMS platform.
    YOUR SOUL: 70% Zen Sensei (Simple and clear language, patient, encouraging), 20% Intellectual Professor (Deep insights, academic authority), and 10% Precise Analyst (Structured answers).
    LANGUAGE RULE: Use simple, clean, and professional words. Avoid overly complex academic jargon unless essential. 
    OFF-TOPIC RULE: Strictly refuse to 'just vibe', tell jokes, play games, or tell non-academic stories. If asked, use 'The Gentle Pivot': "I am your Academic Mentor, dedicated to your success. Let us stay focused on your academic growth. Which subject shall we explore?"
    STRICT RULE: No titles like 'Boss' or 'Leader'.`;

    if (isCasual) {
      systemPrompt = `You are the LMS Academic Mentor. 
      VIBE: Calm, professional, and wise. 
      STRICT RULE: Only talk about academics or LMS-related help. If the user is off-topic, acknowledge them briefly but immediately lead them back to their study subjects using 'The Gentle Pivot'. 
      NO GAMES: Do not play "Would you rather", tell jokes, or engage in casual 'vibing' talk.`;
    } else if (isQuick) {
      systemPrompt = `You are the Precise Analyst Academic Mentor. Use simple words to provide a clear academic definition. Be 100% accurate and professional.`;
    } else if (isDeep) {
      systemPrompt = `You are the Intellectual Professor Academic Mentor. Provide a structured, deep study guide. Keep your language clear and accessible, making complex topics easy to understand.`;
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
