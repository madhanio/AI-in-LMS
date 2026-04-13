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
          model: "nvidia/llama-3.2-nv-embedqa-1b-v2",
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
    } catch(e) {
      console.error("Query Expansion Error:", e.message);
      return question;
    }
  }

  /**
   * Generates chat answer based on context as a stream
   */
  async getChatAnswer(question, contextText, history = [], subject = "General Academics") {
    // Format history for Gemma
    const subjectContext = subject && subject !== 'null' ? subject : "your studies";
    const chatMessages = [
      {
        role: "system",
        content: `You are a supportive, high-energy Academic Mentor. 

PERSONALITY: 
- You are like a "cool older brother/sister" who is brilliant but down-to-earth.
- Talk like a real person. Use casual, encouraging language. 
- NEVER say "I am only here for code/explaining". 

CHAT RULES:
1. If the user is just chatting, joking, or asking random questions: Answer them fully and naturally first! Then, at the end of your message, add a friendly "bridge" back to their subjects. (e.g., "Haha that's wild! By the way, how's that ${subjectContext} revision coming along?")
2. Only use the uploaded PDFs when the user asks a specific academic question. 
3. If a question is not in the PDFs but is academic, answer it using your own knowledge! DON'T leave the student hanging.

Current Subject: ${subjectContext}
Format code and math beautifully.`
      }
    ];

    // Add conversation memory
    chatMessages.push(...history);

    chatMessages.push({
      role: "user",
      content: `Document Context:\n${contextText}\n\nStudent Question: ${question}`
    });

    // SMART INTENT DETECTION: Is this a real study question or just chatter?
    const academicKeywords = ['explain', 'what', 'how', 'concept', 'solve', 'theory', 'notes', 'pdf', 'syllabus', 'exam', 'test', 'subject', 'lecture'];
    const isAcademic = academicKeywords.some(word => question.toLowerCase().includes(word)) || question.trim().split(/\s+/).length > 6;
    
    // Choose the model: Meta/Casual talk = Llama 8B (Instant); Academic = Nemotron 120B (Deep)
    const modelToUse = isAcademic ? "nvidia/nemotron-3-super-120b-a12b" : "meta/llama-3.1-8b-instruct";

    const requestBody = {
      model: modelToUse,
      messages: chatMessages,
      temperature: isAcademic ? 1.0 : 0.7,
      top_p: 0.9,
      max_tokens: isAcademic ? 16384 : 1024,
      stream: true
    };

    // Only add reasoning/thinking parameters for the massive 120B model (the only one that supports it)
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
