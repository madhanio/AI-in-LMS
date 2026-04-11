import dotenv from "dotenv";
dotenv.config();

const NVIDIA_API_KEY = process.env.NVIDIA_API_KEY;
const BASE_URL = "https://integrate.api.nvidia.com/v1";

export class AiService {
  /**
   * Generates embedding for text
   */
  async getEmbedding(text, inputType = "passage") {
    const response = await fetch(`${BASE_URL}/embeddings`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${NVIDIA_API_KEY}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: "nvidia/nv-embedqa-e5-v5",
        input: [text],
        input_type: inputType,
        encoding_format: "float",
        truncate: "NONE"
      })
    });
    
    if (!response.ok) {
       throw new Error(`Embedding Error: ${await response.text()}`);
    }
    
    const data = await response.json();
    return data.data[0].embedding;
  }

  /**
   * Generates chat answer based on context as a stream
   */
  async getChatAnswer(question, contextText) {
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
            content: `You are a helpful and intelligent Academic Mentor for a Learning Management System (LMS). 
            If document context is provided below, prioritize using it to answer clearly and accurately. 
            However, if the context is missing or doesn't have the answer, use your general knowledge to help the student. 
            Be encouraging, academic, and adapt your detail level to the question.`
          },
          {
            role: "user",
            content: `Document Context:\n${contextText}\n\nStudent Question: ${question}`
          }
        ],
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
