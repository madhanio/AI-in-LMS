import express from "express";
import cors from "cors";
import multer from "multer";
import pdfParse from "pdf-parse";
import OpenAI from "openai";
import dotenv from "dotenv";

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

// Set up multer for handling file uploads (in memory)
const upload = multer({ storage: multer.memoryStorage() });

// Initialize NVIDIA API Key
const NVIDIA_API_KEY = process.env.NVIDIA_API_KEY;

// In-memory storage for our document chunks and their embeddings
// Format: [{ text: "...", embedding: [...] }]
let documentData = [];

/**
 * 1. CORE FUNCTION: chunkText
 * Splits the extracted text into chunks of roughly `size` characters.
 * It's simple and slices by words/spaces to avoid breaking words in halfway.
 */
function chunkText(text, size) {
  // Remove multiple spaces/newlines to clean up Text
  const cleanText = text.replace(/\s+/g, " ").trim();
  const chunks = [];
  let currentIndex = 0;

  while (currentIndex < cleanText.length) {
    let nextIndex = currentIndex + size;
    // Don't cut a word in half, look for a space near the target size
    if (nextIndex < cleanText.length) {
      while (nextIndex > currentIndex && cleanText[nextIndex] !== ' ' && cleanText[nextIndex] !== '.') {
        nextIndex--;
      }
      // If no space was found, just force the cut at the size limit
      if (nextIndex === currentIndex) {
        nextIndex = currentIndex + size;
      }
    }
    chunks.push(cleanText.slice(currentIndex, nextIndex).trim());
    currentIndex = nextIndex;
  }
  return chunks;
}

/**
 * 2. CORE FUNCTION: getEmbedding
 * Uses OpenAI's embedding model to convert a text string into a vector.
 */
async function getEmbedding(text, inputType = "passage") {
  const response = await fetch("https://integrate.api.nvidia.com/v1/embeddings", {
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
     throw new Error(await response.text());
  }
  
  const data = await response.json();
  return data.data[0].embedding;
}

/**
 * 3. CORE FUNCTION: cosineSimilarity
 * Calculates how similar two vectors are.
 */
function cosineSimilarity(vecA, vecB) {
  let dotProduct = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < vecA.length; i++) {
    dotProduct += vecA[i] * vecB[i];
    normA += vecA[i] * vecA[i];
    normB += vecB[i] * vecB[i];
  }
  if (normA === 0 || normB === 0) return 0;
  return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
}

// POST /upload
// Accepts a PDF file, extracts its text, chunks it, embeds it, and stores it in memory.
app.post("/upload", upload.single("pdfFile"), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: "No PDF file uploaded" });
    }

    // 1. Extract text using pdf-parse
    const data = await pdfParse(req.file.buffer);
    const text = data.text;
    
    if (!text || text.trim() === '') {
       return res.status(400).json({ error: "Could not extract text from PDF" });
    }

    // 2. Split into chunks (approx 500 chars each)
    const chunks = chunkText(text, 500);
    console.log(`Extracted text and created ${chunks.length} chunks.`);

    // 3. Generate embeddings using OpenAI and store in memory
    // Clear previous document data first (optional - depends if you want multi-document)
    documentData = []; 

    for (const chunk of chunks) {
      if (chunk.trim() !== '') {
         const embedding = await getEmbedding(chunk, "passage");
         documentData.push({ text: chunk, embedding });
      }
    }

    res.json({ message: "PDF processed successfully", chunksCount: chunks.length });
  } catch (error) {
    console.error("Error processing upload:", error);
    res.status(500).json({ error: "Failed to process PDF file." });
  }
});

// POST /query
// Accepts user question, converts to embedding, searches in-memory store, fetches AI answer
app.post("/query", async (req, res) => {
  try {
    const { question } = req.body;
    if (!question) {
      return res.status(400).json({ error: "Question is required" });
    }

    if (documentData.length === 0) {
      return res.status(400).json({ error: "Please upload a PDF first." });
    }

    // 1. Convert question into embedding
    console.log(`Asking question: "${question}"`);
    const queryEmbedding = await getEmbedding(question, "query");
    console.log("Question embedding generated.");

    // 2. Compare with stored embeddings using cosine similarity
    const similarities = documentData.map((doc) => ({
      text: doc.text,
      score: cosineSimilarity(queryEmbedding, doc.embedding),
    }));

    // 3. Select top 3 relevant chunks
    similarities.sort((a, b) => b.score - a.score);
    const topChunks = similarities.slice(0, 3).map((s) => s.text);
    
    // Threshold check (optional but good practice)
    if (similarities[0].score < 0.2) {
       return res.json({ answer: "Not found in provided material" });
    }

    const contextText = topChunks.join("\n\n");

    // 4. Send to OpenAI chat model
    // 4. Send to NVIDIA API using native fetch
    console.log("Sending prompt to NVIDIA API...");
    const response = await fetch("https://integrate.api.nvidia.com/v1/chat/completions", {
      method: "POST",
      headers: {
         "Authorization": `Bearer ${NVIDIA_API_KEY}`,
         "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: "google/gemma-4-31b-it", // The NVIDIA API model you requested!
        messages: [
          {
            role: "system",
            content: `You are an AI assistant for a Learning Management System (LMS). Answer strictly ONLY from the given context. If the answer is not found in the context, respond exactly with "Not found in provided material".`
          },
          {
            role: "user",
            content: `Context:\n${contextText}\n\nQuestion: ${question}`
          }
        ],
        temperature: 0.1, 
        chat_template_kwargs: {"enable_thinking": false} // Set to false to avoid speed issues on free tier
      })
    });

    if (!response.ok) {
       const errorMsg = await response.text();
       console.error("NVIDIA API Error:", errorMsg);
       throw new Error(`NVIDIA API Error: ${errorMsg}`);
    }

    const data = await response.json();
    const answer = data.choices[0].message.content;
    console.log("AI reply received.");

    res.json({ answer });
  } catch (error) {
    console.error("Error processing query:", error);
    res.status(500).json({ error: "Failed to answer question." });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
