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
          model: "google/gemma-4-31b-it",
          messages: [
            {
              role: "system",
              content: "You are an academic query expander. Rewrite the following query into a detailed, explicit question that includes related keywords or spelled-out acronyms to improve semantic search relevance. Do not answer the question, only output the expanded query string."
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
  async getChatAnswer(question, contextText, history = []) {
    // Format history for Gemma
    const chatMessages = [
      {
        role: "system",
        content: `You are a helpful and intelligent Academic Mentor for a Learning Management System (LMS). 
        STRICT RULES:
        1. You MUST answer ONLY using the provided document context.
        2. If the answer is not contained in the context, you MUST say exactly: "Information not available in materials." and absolutely nothing else.
        3. If you do find the answer, you MUST cite the source using the provided Metadata tags (e.g., [Page X] or [Section: Y]).
        
        Be encouraging, academic, and format code or math nicely.`
      }
    ];

    // Add conversation memory
    chatMessages.push(...history);

    chatMessages.push({
      role: "user",
      content: `Document Context:\n${contextText}\n\nStudent Question: ${question}`
    });

    const response = await fetch(`${BASE_URL}/chat/completions`, {
      method: "POST",
      headers: {
         "Authorization": `Bearer ${NVIDIA_API_KEY}`,
         "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: "google/gemma-4-31b-it",
        messages: chatMessages,
        temperature: 0.1, 
        stream: true // Enable streaming!
      })
    });


    if (!response.ok) {
       throw new Error(`Chat API Error: ${await response.text()}`);
    }

    return response.body; // Returns the readable stream
  }
}

export const aiService = new AiService();
