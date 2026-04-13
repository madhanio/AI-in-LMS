import express from 'express';
import multer from 'multer';
import jwt from 'jsonwebtoken';
import dotenv from 'dotenv';
import { storageService } from '../services/storage.service.js';
import { pdfService } from '../services/pdf.service.js';
import { aiService } from '../services/ai.service.js';
import { cosineSimilarity } from '../utils/vector.util.js';
import { authenticateAdmin } from '../middleware/auth.js';

dotenv.config();

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage() });

const JWT_SECRET = process.env.JWT_SECRET || 'fallback_secret';

/**
 * ADMIN AUTH ROUTES
 */
router.post('/login', (req, res) => {
  const { username, password } = req.body;
  const expectedUser = (process.env.ADMIN_USER || '').trim();
  const expectedPass = (process.env.ADMIN_PASSWORD || '').trim();

  if (username?.trim() === expectedUser && password?.trim() === expectedPass) {
    const token = jwt.sign({ username }, JWT_SECRET, { expiresIn: '1h' });
    res.cookie('admin_token', token, { httpOnly: true, secure: process.env.NODE_ENV === 'production' });
    return res.json({ message: 'Login successful' });
  }
  res.status(401).json({ error: 'Invalid credentials' });
});

router.post('/logout', (req, res) => {
  res.clearCookie('admin_token');
  res.json({ message: 'Logout successful' });
});

router.get('/check-auth', authenticateAdmin, (req, res) => {
  res.json({ authenticated: true, user: req.admin.username });
});

/**
 * GET /files - List all subjects and their files
 */
router.get('/files', async (req, res) => {
  res.json({ subjects: await storageService.getFiles() });
});

/**
 * DELETE /files/:subject/:id - Delete a file (Admin only)
 */
router.delete('/files/:subject/:id', authenticateAdmin, async (req, res) => {
  const { subject, id } = req.params;

  const success = await storageService.deleteFile(subject, id);
  if (success) {
    res.json({ message: "File deleted successfully" });
  } else {
    res.status(404).json({ error: "File not found" });
  }
});

/**
 * POST /upload - Process and store PDF
 */
router.post('/upload', authenticateAdmin, upload.single('pdfFile'), async (req, res) => {
  try {
    const { subject } = req.body;
    if (!req.file || !subject) {
      return res.status(400).json({ error: "PDF file and subject are required." });
    }

    const fileName = req.file.originalname;
    
    // Check if filename already exists in this subject
    const subjectFiles = await storageService.getFiles();
    const currentFiles = subjectFiles[subject] || [];
    if (currentFiles.some(f => f.fileName === fileName)) {
       return res.json({ message: "File already processed.", skip: true });
    }

    console.log(`Processing ${fileName} for ${subject}...`);
    const text = await pdfService.extractText(req.file.buffer);
    const chunks = pdfService.chunkText(text);
    
    const texts = chunks.map(c => c.text);
    const embeddings = await aiService.getEmbeddings(texts, "passage");
    
    const chunksWithEmbeds = chunks.map((chunk, i) => ({
      ...chunk,
      embedding: embeddings[i]
    }));

    await storageService.addFile(subject, fileName, chunksWithEmbeds);
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
  const startTime = Date.now();
  try {
    const { question, subject, history = [] } = req.body;
    if (!question) {
      return res.status(400).json({ error: "Question is required" });
    }

    console.log(`Querying ${subject || 'global'} for: ${question}`);
    
    // Skip expansion/embedding for short greetings or single words
    let expandedQuery = question;
    let queryEmbedding;

    if (question.trim().split(/\s+/).length >= 3) {
      console.log(`Expanding query...`);
      expandedQuery = await aiService.expandQuery(question);
      console.log(`Expanded query: ${expandedQuery}`);
      queryEmbedding = await aiService.getEmbedding(expandedQuery, "query");
    } else {
      console.log(`Short query detected, skipping expansion.`);
      queryEmbedding = await aiService.getEmbedding(question, "query");
    }

    // Get chunks (include global calendar context)
    const searchSubjects = subject ? [subject, '__CALENDAR__'] : ['__CALENDAR__'];
    const allChunks = await storageService.getAllChunks(searchSubjects);
    
    let finalContext = "No specific lecture notes found for this query.";
    let retrievedCount = 0;

    if (allChunks.length > 0) {
      // 4. Hybrid Ranking (Semantic + Keyword)
      const keywords = expandedQuery.toLowerCase().split(/\s+/).filter(w => w.length > 3);
      const scoredChunks = allChunks.map(c => {
        const semanticScore = cosineSimilarity(queryEmbedding, c.embedding);
      
      // Basic keyword frequency boost
      const textLower = c.text.toLowerCase();
      let keywordMatches = 0;
      keywords.forEach(kw => {
        if (textLower.includes(kw)) keywordMatches += 0.05; // 5% boost per keyword match
      });

      return {
        ...c,
        score: semanticScore + Math.min(keywordMatches, 0.15) // max 15% boost from keywords
      };
    });

    scoredChunks.sort((a, b) => b.score - a.score);
    
    // 2. Dynamic Top-K Retrieval
    const wordCount = question.split(' ').length;
    let topK = 3;
    if (wordCount > 10 && wordCount <= 25) topK = 5;
    else if (wordCount > 25) topK = 8;

    const thresholdChunks = scoredChunks.filter(c => c.score > 0.4);

    // Setup context for AI
    if (thresholdChunks.length > 0) {
      const topChunks = thresholdChunks.slice(0, topK);
      finalContext = topChunks.map(c => {
         const meta = [];
         if (c.file_name) meta.push(`[File: ${c.file_name}]`);
         if (c.page_number) meta.push(`[Page: ${c.page_number}]`);
         if (c.section_title) meta.push(`[Section: ${c.section_title}]`);
         if (c.chunk_type && c.chunk_type !== 'text') meta.push(`[Type: ${c.chunk_type}]`);
         return `${meta.length > 0 ? meta.join(" ") + "\\n" : ""}${c.text}`;
      }).join("\n\n---\n\n");
      
      // Analytics for success
      const avgSim = topChunks.reduce((acc, c) => acc + c.score, 0) / topChunks.length;
      storageService.logQuery(question, topChunks.length, avgSim, Date.now() - startTime, subject);
    } else {
      // Analytics for "No Context" case
      storageService.logQuery(question, 0, scoredChunks[0]?.score || 0, Date.now() - startTime, subject);
      finalContext = "No relevant text found in the uploaded PDFs for this specific query.";
    }

    // 8. Conversation memory & Proceed to AI (Proceed regardless of context)
    const stream = await aiService.getChatAnswer(question, finalContext, history, subject);
    
    // Set headers for streaming (No-buffering is critical for speed)
    res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no'); 
    res.flushHeaders(); 

    // Iterate over the stream and send to client
    const reader = stream.getReader();
    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        res.write(value);
      }
    } catch (streamError) {
      console.error("Streaming interrupted:", streamError);
      // Log streaming error to analytics
      storageService.logQuery(`[STREAM_ERROR] ${question}`, topChunks.length, avgSim, Date.now() - startTime, subject);
    } finally {
      res.end();
    }
  } catch (error) {
    console.error("Query Error:", error);
    if (!res.headersSent) {
      res.status(500).json({ error: error.message });
    } else {
      res.end();
    }
  }
});

/**
 * GET /subjects - Fetch all subjects
 */
router.get('/subjects', async (req, res) => {
  try {
    const subjects = await storageService.getSubjects();
    res.json({ subjects });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /subjects - Add a new subject
 */
router.post('/subjects', authenticateAdmin, async (req, res) => {
  try {
    const { name } = req.body;
    if (!name) return res.status(400).json({ error: "Subject name is required" });
    await storageService.addSubject(name);
    res.json({ message: "Subject added successfully" });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * DELETE /subjects/:name - Remove a subject and its files
 */
router.delete('/subjects/:name', authenticateAdmin, async (req, res) => {
  try {
    const { name } = req.params;
    await storageService.deleteSubject(name);
    res.json({ message: `Subject ${name} and all its files deleted.` });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
