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
   * Generates chat answer based on context
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
            content: `You are a reliable academic assistant for an LMS. 
            Answer strictly ONLY from the provided document context. 
            Keep your answer academic, clear, and structured. 
            If the answer is definitely not in the context, respond with "Not found in provided material".`
          },
          {
            role: "user",
            content: `Context:\n${contextText}\n\nStudent Question: ${question}`
          }
        ],
        temperature: 0.1, 
        chat_template_kwargs: {"enable_thinking": false}
      })
    });

    if (!response.ok) {
       throw new Error(`Chat API Error: ${await response.text()}`);
    }

    const data = await response.json();
    return data.choices[0].message.content;
  }
}

export const aiService = new AiService();
