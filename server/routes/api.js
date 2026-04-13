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

router.post('/query', async (req, res) => {
  const startTime = Date.now();
  let finalContext = "No specific lecture notes found for this query.";
  const { question, subject, history = [] } = req.body;

  try {
    if (!question) {
      return res.status(400).json({ error: "Question is required" });
    }

    console.log(`Querying ${subject || 'global'} for: ${question}`);

    // 🔥 AI-POWERED INTENT GOVERNOR
    const intent = await aiService.getIntent(question);
    const isAcademic = intent === 'ACADEMIC';
    console.log(`Intent detected: ${intent}`);

    if (isAcademic) {
      let queryVal = question;
      if (question.trim().split(/\s+/).length >= 3) {
        console.log(`Expanding academic query...`);
        queryVal = await aiService.expandQuery(question);
      }
      
      const queryEmbedding = await aiService.getEmbedding(queryVal, "query");
      const searchSubjects = subject ? [subject, '__CALENDAR__'] : ['__CALENDAR__'];
      const allChunks = await storageService.getAllChunks(searchSubjects);
      
      if (allChunks.length > 0) {
        const keywords = queryVal.toLowerCase().split(/\s+/).filter(w => w.length > 3);
        const scoredChunks = allChunks.map(c => {
          const semanticScore = cosineSimilarity(queryEmbedding, c.embedding);
          const textLower = c.text.toLowerCase();
          let keywordMatches = 0;
          keywords.forEach(kw => { if (textLower.includes(kw)) keywordMatches += 0.05; });
          return { ...c, score: semanticScore + Math.min(keywordMatches, 0.15) };
        });

        scoredChunks.sort((a, b) => b.score - a.score);
        const thresholdChunks = scoredChunks.filter(c => c.score > 0.4);

        if (thresholdChunks.length > 0) {
          const topK = question.split(' ').length > 25 ? 8 : 4;
          const topChunks = thresholdChunks.slice(0, topK);
          finalContext = topChunks.map(c => {
             const meta = [c.file_name, c.page_number ? `P${c.page_number}` : ''].filter(Boolean);
             return `${meta.length ? '[' + meta.join(' ') + '] ' : ''}${c.text}`;
          }).join('\n---\n');
          
          const avgSim = topChunks.reduce((acc, c) => acc + c.score, 0) / topChunks.length;
          storageService.logQuery(question, topChunks.length, avgSim, Date.now() - startTime, subject);
        }
      }
    } else {
      console.log("Casual/Meta query detected. Skipping PDF search.");
    }

    const stream = await aiService.getChatAnswer(question, finalContext, history, subject, intent);
    
    res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('X-Accel-Buffering', 'no'); 
    res.flushHeaders(); 

    const reader = stream.getReader();
    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        res.write(value);
      }
    } catch (err) {
      console.error("Stream interrupted", err);
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
