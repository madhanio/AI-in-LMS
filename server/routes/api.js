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
    
    // 🔥 CALENDAR SYNC LOGIC: If it's a calendar, clear old one first to avoid "already processed" skips
    if (subject === '__CALENDAR__') {
       for (const oldFile of currentFiles) {
         await storageService.deleteFile(subject, oldFile.id);
       }
    } else if (currentFiles.some(f => f.fileName === fileName)) {
       return res.json({ message: "File already processed.", skip: true });
    }

    console.log(`Processing ${fileName} for ${subject}...`);
    const text = await pdfService.extractText(req.file.buffer);
    
    // 🔥 NEW: Structured Data Lane Classification
    const contentType = await aiService.classifyContent(text);
    console.log(`Content classification for ${fileName}: ${contentType}`);

    if (contentType === 'TABULAR' || subject === '__CALENDAR__') {
       console.log("➡️ Routing to Structured Data Lane (Calendar/Table detected)...");
       const tables = await pdfService.extractTables(req.file.buffer);
       
+      let events = [];
       if (tables.length > 0) {
-         const events = await aiService.parseTableToEvents(tables, fileName);
-         await storageService.saveCalendarEvents(events);
-         return res.json({ 
-           message: "PDF processed via Structured Data Lane", 
-           type: "tabular",
-           eventsExtracted: events.length 
-         });
+         console.log("📊 Vector tables found. Parsing via Table Lane...");
+         events = await aiService.parseTableToEvents(tables, fileName);
       } else {
-         console.log("⚠️ Tabular classification but no tables found. Falling back to RAG.");
+         console.log("⚠️ No vector tables found (likely a scanned PDF). Falling back to LLM Text Extraction...");
+         events = await aiService.parseTextToEvents(text, fileName);
       }
+
+      if (events.length > 0) {
+        await storageService.saveCalendarEvents(events);
+        return res.json({ 
+          message: "PDF processed via Structured Data Lane", 
+          type: "tabular",
+          eventsExtracted: events.length,
+          method: tables.length > 0 ? "vector_table" : "llm_text_extraction"
+        });
+      }
+      
+      console.log("❌ Both structured extraction methods failed. Falling back to RAG.");
    }

    const chunks = pdfService.chunkText(text);
    
    if (chunks.length === 0) {
       console.log("⚠️ No content extracted from PDF (even with OCR).");
    } else {
       console.log(`✅ Extracted ${chunks.length} chunks from ${fileName}.`);
    }
    
    const texts = chunks.map(c => c.text);
    const embeddings = await aiService.getEmbeddings(texts, "passage");
    
    const chunksWithEmbeds = chunks.map((chunk, i) => ({
      ...chunk,
      embedding: embeddings[i]
    }));

    await storageService.addFile(subject, fileName, chunksWithEmbeds);
    res.json({ 
      message: chunks.length > 0 ? "PDF processed successfully" : "⚠️ Success, but no readable text found.", 
      chunks: chunks.length,
      warning: chunks.length === 0 ? "Empty content" : null
    });
  } catch (error) {
    console.error("Upload Error:", error);
    res.status(500).json({ error: error.message });
  }
});

router.post('/query', async (req, res) => {
  const startTime = Date.now();
  let finalContext = "No specific lecture notes found for this query.";
  const { question, subject, history = [], rollNumber = "" } = req.body;

  try {
    if (!question) {
      return res.status(400).json({ error: "Question is required" });
    }

    console.log(`Querying ${subject || 'global'} for: ${question}`);

    // 🔥 TRIPLE-PATH INTENT GOVERNOR
    const intent = await aiService.getIntent(question);
    const isAcademic = intent.startsWith('STUDY'); 
    console.log(`Intent detected: ${intent}`);

    if (isAcademic) {
      // 📅 NEW: Structured Lane Router
      const calendarKeywords = {
        events: ['exam', 'mid term', 'holiday', 'semester', 'timetable', 'schedule', 'break', 'commencement', 'odd semester', 'even semester'],
        dates:  ['when is', 'what date', 'how many days', 'remaining', 'upcoming', 'next', 'left', 'how long', 'already over', 'passed'],
        deadlines: ['submission', 'submit', 'deadline', 'last date', 'on or before', 'marks entry'],
        exams: ['practical', 'supply', 'supplementary', 'SEE', 'end semester']
      };

      const isCalendarQuery = Object.values(calendarKeywords)
        .flat()
        .some(k => question.toLowerCase().includes(k));

      if (isCalendarQuery) {
        console.log("📅 Calendar keyword detected. Routing to Structured Lane...");
        const events = await storageService.searchCalendarEvents(question);
        
        if (events.length > 0) {
          finalContext = "[OFFICIAL CALENDAR DATA]\n" + events.map(e => (
            `- ${e.event_name} (Semester: ${e.semester}): ${e.date_raw} ${e.date_is_approximate ? '[APPROXIMATE]' : ''}`
          )).join('\n');
          
          console.log(`✅ Successfully routed to SQL path. Found ${events.length} events.`);
        } else {
          console.log("⚠️ No specific calendar events found in SQL. Falling back to vector search.");
          // Fall through to existing academic search
        }
      }

      if (finalContext === "No specific lecture notes found for this query.") {
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
          const isCalendar = c.subject === '__CALENDAR__';
          
          let keywordMatches = 0;
          const textLower = c.text.toLowerCase();
          keywords.forEach(kw => { if (textLower.includes(kw)) keywordMatches += 0.05; });

          const finalScore = semanticScore + Math.min(keywordMatches, 0.15) + (isCalendar ? 0.12 : 0);
          return { ...c, score: finalScore };
        });

        scoredChunks.sort((a, b) => b.score - a.score);
        
        // 🔥 GUARANTEED VISIBILITY: Always include the top 2 calendar chunks if they exist
        const calendarChunks = scoredChunks.filter(c => c.subject === '__CALENDAR__').slice(0, 2);
        const subjectChunks = scoredChunks.filter(c => c.subject !== '__CALENDAR__' && c.score > 0.42).slice(0, 4);
        
        const topChunks = [...calendarChunks, ...subjectChunks];

        if (topChunks.length > 0) {
          console.log(`✅ Injecting ${topChunks.length} chunks (Calendar: ${calendarChunks.length}, Subject: ${subjectChunks.length})`);
          
          const contextHeader = "[OFFICIAL CONTEXT: The following information is retrieved from official study materials and the Academic Calendar. Use this data with high confidence even if the formatting is compact.]\n\n";
          
          finalContext = contextHeader + topChunks.map(c => {
             const meta = [
               c.file_name, 
               c.subject === '__CALENDAR__' ? '(Global Calendar)' : '',
               c.page_number ? `P${c.page_number}` : ''
             ].filter(Boolean);
             return `${meta.length ? '[' + meta.join(' ') + '] ' : ''}${c.text}`;
          }).join('\n---\n');
          
          const avgSim = topChunks.reduce((acc, c) => acc + c.score, 0) / topChunks.length;
          storageService.logQuery(question, topChunks.length, avgSim, Date.now() - startTime, subject);
        }
      }
    }
  } else {
    console.log("Casual/Meta query detected. Skipping PDF search.");
  }

    const stream = await aiService.getChatAnswer(question, finalContext, history, subject || 'General', intent, rollNumber);
    
    // Set headers for streaming (Critical for Render/Proxy stability)
    res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('X-Accel-Buffering', 'no'); 
    res.flushHeaders(); 

    // 🔥 INSTANT PULSE: Trigger the UI typing state immediately to mask 'thinking' time
    res.write(' ');

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

/**
 * GET /prompts - Fetch dynamic study suggestions
 */
router.get('/prompts', (req, res) => {
  const suggestions = [
    "Summarize my last lecture like I'm 5 👶",
    "Quiz me on the hardest part of this subject 🧠",
    "Give me 3 'must-know' exam tips ✍️",
    "How does this relate to real-life jobs? 💼",
    "Turn my notes into a funny story 📖",
    "Compare the main concepts for me ⚖️"
  ];
  // Shuffle or return a subset
  res.json({ suggestions: suggestions.sort(() => 0.5 - Math.random()).slice(0, 4) });
});

export default router;
