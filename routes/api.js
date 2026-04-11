import express from 'express';
import multer from 'multer';
import { storageService } from '../services/storage.service.js';
import { pdfService } from '../services/pdf.service.js';
import { aiService } from '../services/ai.service.js';
import { cosineSimilarity } from '../utils/vector.util.js';

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage() });

// Admin Key for deletion simulation
const ADMIN_KEY = "admin123";

/**
 * GET /files - List all subjects and their files
 */
router.get('/files', (req, res) => {
  res.json({ subjects: storageService.getFiles() });
});

/**
 * DELETE /files/:subject/:id - Delete a file (Admin only)
 */
router.delete('/files/:subject/:id', (req, res) => {
  const { subject, id } = req.params;
  const key = req.headers['admin-key'];

  if (key !== ADMIN_KEY) {
    return res.status(401).json({ error: "Unauthorized. Admin/Faculty key required." });
  }

  const success = storageService.deleteFile(subject, id);
  if (success) {
    res.json({ message: "File deleted successfully" });
  } else {
    res.status(404).json({ error: "File not found" });
  }
});

/**
 * POST /upload - Process and store PDF
 */
router.post('/upload', upload.single('pdfFile'), async (req, res) => {
  try {
    const { subject } = req.body;
    if (!req.file || !subject) {
      return res.status(400).json({ error: "PDF file and subject are required." });
    }

    const fileName = req.file.originalname;
    
    // Check if filename already exists in this subject
    const currentFiles = storageService.getFiles()[subject] || [];
    if (currentFiles.some(f => f.fileName === fileName)) {
       return res.json({ message: "File already processed.", skip: true });
    }

    console.log(`Processing ${fileName} for ${subject}...`);
    const text = await pdfService.extractText(req.file.buffer);
    const chunks = pdfService.chunkText(text);
    
    const chunksWithEmbeds = [];
    for (const chunk of chunks) {
      const embedding = await aiService.getEmbedding(chunk, "passage");
      chunksWithEmbeds.push({ text: chunk, embedding });
    }

    storageService.addFile(subject, fileName, chunksWithEmbeds);
    res.json({ message: "PDF processed successfully", chunks: chunks.length });
  } catch (error) {
    console.error("Upload Error:", error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /query - Semantic search and AI answer
 */
router.post('/query', async (req, res) => {
  try {
    const { question, subject } = req.body;
    if (!question) {
      return res.status(400).json({ error: "Question is required" });
    }

    console.log(`Querying ${subject || 'global'} for: ${question}`);
    const queryEmbedding = await aiService.getEmbedding(question, "query");

    // Get chunks (filtered by subject if provided)
    const allChunks = storageService.getAllChunks(subject);
    
    if (allChunks.length === 0) {
      return res.json({ answer: "Please upload some material for this subject first." });
    }

    // Similarity check
    const scoredChunks = allChunks.map(c => ({
      text: c.text,
      score: cosineSimilarity(queryEmbedding, c.embedding)
    }));

    scoredChunks.sort((a, b) => b.score - a.score);
    
    // Threshold and top 3
    const topChunks = scoredChunks.filter(c => c.score > 0.4).slice(0, 3);
    
    // Fallback: if none above 0.4, take best 1 IF it's above 0.2
    let finalContext = "";
    if (topChunks.length > 0) {
      finalContext = topChunks.map(c => c.text).join("\n\n");
    } else if (scoredChunks[0].score > 0.2) {
      finalContext = scoredChunks[0].text;
    }

    // Always proceed to AI for hybrid answering (Knowledge + Context)
    const stream = await aiService.getChatAnswer(question, finalContext || "");
    
    // Set headers for streaming
    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    res.setHeader('Transfer-Encoding', 'chunked');

    // Iterate over the stream and send to client
    const reader = stream.getReader();
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      res.write(value);
    }
    res.end();
  } catch (error) {
    console.error("Query Error:", error);
    if (!res.headersSent) {
      res.status(500).json({ error: error.message });
    } else {
      res.end();
    }
  }
});

export default router;
