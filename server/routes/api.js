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

    // 🔥 NEW: Upload the raw PDF to Supabase Storage for Source UI
    const fileUrl = await storageService.uploadRawFile(fileName, req.file.buffer, subject);
    if (!fileUrl) {
       console.log("⚠️ Supabase Storage upload failed. Chunks will be generated without viewable source links.");
    } else {
       console.log(`✅ Raw PDF uploaded. Public URL: ${fileUrl}`);
    }

    const { text, source } = await pdfService.extractText(req.file.buffer, fileName);
    
    if (!text || text.trim().length === 0) {
      console.log("❌ CRITICAL: No text could be extracted from PDF. Aborting.");
      return res.status(422).json({ error: "No readable content found in PDF." });
    }

    // 🔥 NEW: Deep Metadata Classification
    const metadata = await aiService.classifyContent(text, fileName);
    console.log(`Metadata for ${fileName}:`, metadata);

    // 🔥 NEW: Format Guard - Only PDFs can use the Direct-to-VLM Vision Lane
    const isPDF = fileName.toLowerCase().endsWith('.pdf');

    // If it's a calendar or the AI says TABULAR, route to vision lane (PDF ONLY)
    if (isPDF && (metadata.contentType === 'TABULAR' || subject === '__CALENDAR__')) {
       console.log("➡️ Routing to Direct-to-VLM Structured Lane...");
       
       try {
         const imageBase64s = await pdfService.convertToImages(req.file.buffer);
         const events = await aiService.extractCalendarEventsFromImages(imageBase64s, fileName, text);

         if (events.length > 0) {
           await storageService.saveCalendarEvents(events);
           
           // 🔥 UI SYNC: Register file in 'documents' so it appears in the list
           const summaryChunk = [{
             text: `[STRUCTURED CALENDAR] Extracted ${events.length} academic events.`,
             page_number: 1,
             section_title: "Calendar Summary",
             chunk_type: "text",
             embedding: await aiService.getEmbedding(`Calendar file: ${fileName}`, "passage")
           }];
           await storageService.addFile(subject, fileName, summaryChunk, metadata);

           // Also upload raw file for viewing
           await storageService.uploadRawFile(fileName, req.file.buffer, subject, metadata);

           return res.json({ 
             message: "PDF processed via Direct-to-VLM Lane", 
             type: "tabular",
             eventsExtracted: events.length,
             method: "gemma_3_vision"
           });
         }
       } catch (vlmError) {
         console.error("❌ Direct-to-VLM Lane Failed:", vlmError);
       }
    }

    const chunks = pdfService.chunkText(text);
    const texts = chunks.map(c => c.text);
    const embeddings = await aiService.getEmbeddings(texts, "passage");
    
    const chunksWithEmbeds = chunks.map((chunk, i) => ({
      ...chunk,
      embedding: embeddings[i]
    }));

    // Attach metadata to storage calls
    await storageService.uploadRawFile(fileName, req.file.buffer, subject, metadata);
    await storageService.addFile(subject, fileName, chunksWithEmbeds, metadata);

    res.json({ 
      message: chunks.length > 0 ? "PDF processed successfully" : "⚠️ Success, but no readable text found.", 
      chunks: chunks.length,
      metadata: metadata
    });
  } catch (error) {
    console.error("Upload Error:", error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * CALENDAR EVENT MANAGEMENT
 */
router.get('/calendar/events', async (req, res) => {
  try {
    const events = await storageService.getCalendarEvents();
    res.json({ events });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.patch('/calendar/events/:id', async (req, res) => {
  try {
    const updates = req.body;
    await storageService.updateCalendarEvent(req.params.id, updates);
    await aiService.clearCache(); // 🔥 Learn the fix immediately
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.delete('/calendar/events/:id', async (req, res) => {
  try {
    await storageService.deleteCalendarEvent(req.params.id);
    await aiService.clearCache(); // 🔥 Forget the old data
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/calendar/events', async (req, res) => {
  try {
    const newEvent = {
        event_name: "New Manual Event",
        date_raw: "TBD",
        semester: "N/A",
        date_is_approximate: true
    };
    await storageService.saveCalendarEvents([newEvent]);
    await aiService.clearCache();
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.delete('/calendar/purge', async (req, res) => {
  try {
    await storageService.purgeLegacyCalendarData();
    await aiService.clearCache();
    res.json({ success: true, message: "Legacy noisy data purged." });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * LIVE MODEL TOGGLE
 */
router.get('/settings/model', (req, res) => {
  res.json({ model: aiService.getModel() });
});

router.post('/settings/model', authenticateAdmin, (req, res) => {
  const { model } = req.body;
  const success = aiService.setModel(model);
  if (success) {
    res.json({ success: true, model });
  } else {
    res.status(400).json({ error: "Invalid model. Use 'meta/llama-3.1-8b-instruct' or 'meta/llama-3.1-70b-instruct'." });
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

    // 🔥 TIER 2: THE TRAFFIC COP (LLM Gatekeeper)
    const isCalendar = await aiService.isCalendarRelevance(question);
    console.log(`Traffic Cop Result (is_calendar): ${isCalendar}`);

    if (isCalendar) {
        // 🧠 TIER 1: SEMANTIC CACHE (Local Memory - Calendar ONLY)
        const cachedAnswer = await aiService.checkCache(question);
        if (cachedAnswer) {
           console.log("⚡ Serving Calendar from Cache...");
           res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
           res.setHeader('Cache-Control', 'no-cache');
           res.flushHeaders();
           res.write(cachedAnswer);
           return res.end();
        }

        console.log("📅 Routing to Structured Calendar Lane (SQL)...");
        const events = await storageService.searchCalendarEvents(question);
        
        if (events.length > 0) {
          const formatDate = (d) => {
            if (!d) return null;
            const date = new Date(d + 'T00:00:00');
            return date.toLocaleDateString('en-IN', { day: '2-digit', month: 'long', year: 'numeric' });
          };
          finalContext = "Academic Calendar Events:\n" + events.map(e => {
            const from = formatDate(e.date_from);
            const to = formatDate(e.date_to);
            const dateStr = (from && to) ? `${from} to ${to}` : (e.date_raw || "Date TBD");
            return `- ${e.event_name} (Semester: ${e.semester}): ${dateStr} ${e.date_is_approximate ? '[APPROXIMATE]' : ''}`;
          }).join('\n');
          console.log(`✅ SQL Path success. Found ${events.length} events (Prioritizing Edited Dates).`);
        } else {
          console.log("⚠️ SQL empty for calendar query. Falling back to vector search.");
        }
    }

    // TIER 3: Standard Academic Search (Only if context is still empty or not purely a calendar query)
    if (finalContext.includes("No specific lecture notes")) {
        // 🔥 NEW: Extract user intent filters (e.g., "Module 3" or "Question Bank")
        const queryMeta = await aiService.extractQueryMetadata(question);
        console.log("Query Filters Detected:", queryMeta);

        const queryEmbedding = await aiService.getEmbedding(question, "query");
        
        let searchSubjects = subject ? [subject, '__CALENDAR__'] : ['__CALENDAR__'];
        
        // 🔥 IMPROVED: If no subject is selected, search the global calendar AND a sample of all subjects
        // to handle general queries like "Summarize my syllabus" or "What subjects do I have?"
        if (!subject) {
          const allSubjectNames = await storageService.getSubjects();
          if (allSubjectNames && allSubjectNames.length > 0) {
            searchSubjects = [...allSubjectNames, '__CALENDAR__'];
          }
        }

        const allChunks = await storageService.getAllChunks(searchSubjects);
        
        if (allChunks.length > 0) {
          const keywords = question.toLowerCase().split(/\s+/).filter(w => w.length > 3);
          
          const scoredChunks = allChunks.map(c => {
            const semanticScore = cosineSimilarity(queryEmbedding, c.embedding);
            const isCalendarChunk = c.subject === '__CALENDAR__';
            
            // 🔥 METADATA BOOSTING
            let metaBoost = 0;
            if (queryMeta.targetModule && c.module_number === queryMeta.targetModule) {
                metaBoost += 0.25; // Massive boost for requested module
            }
            if (queryMeta.targetDocType && c.doc_type === queryMeta.targetDocType) {
                metaBoost += 0.20; // Massive boost for requested doc type (QB/Model Paper)
            }

            let keywordMatches = 0;
            const textLower = c.text.toLowerCase();
            keywords.forEach(kw => { if (textLower.includes(kw)) keywordMatches += 0.05; });

            const finalScore = semanticScore + Math.min(keywordMatches, 0.15) + (isCalendarChunk ? 0.12 : 0) + metaBoost;
            return { ...c, score: finalScore };
          });

          // Sort by score
          scoredChunks.sort((a, b) => b.score - a.score);

          // 🔥 LOOSE FILTERING / TOP-UP LOGIC
          // 1. First, take only the strong matches that hit the metadata target
          let primaryChunks = scoredChunks.filter(c => {
              const matchesModule = queryMeta.targetModule ? c.module_number === queryMeta.targetModule : true;
              const matchesType = queryMeta.targetDocType ? c.doc_type === queryMeta.targetDocType : true;
              return matchesModule && matchesType && c.score > 0.35;
          });

          // 2. If we found fewer than 5 high-quality matches, "Top-up" with general subject chunks
          let finalSelection = [...primaryChunks];
          if (finalSelection.length < 5) {
              const secondaryChunks = scoredChunks.filter(c => 
                  !primaryChunks.some(pc => pc.content === c.content) && c.score > 0.35
              ).slice(0, 5 - finalSelection.length);
              finalSelection.push(...secondaryChunks);
          }

          // Limit to max 15 chunks for context window safety
          let topChunks = finalSelection.slice(0, 15);

          // 🔥 Step 5: Context Window Quality Filter
          // Remove any tiny cleaning survivors (< 100 chars)
          const filteredChunks = topChunks.filter(c => c.text.length > 100);
          
          // Safety Switch: If filtering kills too much context, keep the originals
          if (filteredChunks.length >= 5) {
              topChunks = filteredChunks;
          }

          if (topChunks.length > 0) {
            console.log(`✅ Injecting ${topChunks.length} chunks (Primary: ${primaryChunks.length}). Filters: M=${queryMeta.targetModule}, T=${queryMeta.targetDocType}`);
            finalContext = topChunks.map(c => `[${c.file_name}${c.page_number ? ' p.' + c.page_number : ''}] ${c.text}`).join('\n---\n');
            
            // 🔥 SOURCE CARD FILTERING
            // We only show source cards if we actually found something relevant.
            // Since our search (scoredChunks) is already restricted to the selected subject 
            // and the global calendar, we can trust these sources are contextually appropriate.
            if (topChunks.length > 0) {
              const uniqueNames = [...new Set(
                topChunks
                  .filter(c => c.doc_type !== 'QUESTION_BANK')
                  .map(c => c.file_name)
                  .filter(n => n)
              )];
              req.sourceUrls = await storageService.getFileUrls(uniqueNames);
            } else {
              req.sourceUrls = {}; 
            }
          }
        }
    }

    // Fast local intent detection (no LLM call needed)
    const wordCount = question.trim().split(/\s+/).length;
    const intent = wordCount >= 8 ? 'STUDY_DEEP' : 'STUDY_QUICK';
    const stream = await aiService.getChatAnswer(question, finalContext, history, subject || 'General', intent, rollNumber);
    
    // Set headers for streaming (Critical for Render/Proxy stability)
    res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('X-Accel-Buffering', 'no'); 
    res.flushHeaders(); 

    // 🔥 INSTANT PULSE: Trigger the UI typing state immediately to mask 'thinking' time
    res.write(' ');

    const reader = stream.getReader();
    let fullResponse = "";
    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const text = new TextDecoder().decode(value);
        fullResponse += text;

        if (text.includes('data: [DONE]') && Object.keys(req.sourceUrls || {}).length > 0) {
           const payloadText = JSON.stringify({
              choices: [{ delta: { sources: Object.entries(req.sourceUrls).map(([n, u]) => ({name: n, url: u})) } }]
           });
           res.write(new TextEncoder().encode(`data: ${payloadText}\n\n`));
           res.write(value);
        } else {
           res.write(value);
        }
      }
      // Save to Tier 1 Cache for future hits (Calendar ONLY)
      if (fullResponse.length > 0 && isCalendar) {
        aiService.saveToCache(question, fullResponse);
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
 * PATCH /subjects/:oldName - Rename a subject
 */
router.patch('/subjects/:oldName', authenticateAdmin, async (req, res) => {
  try {
    const { oldName } = req.params;
    const { newName } = req.body;
    
    if (!newName) return res.status(400).json({ error: "New subject name is required" });
    
    await storageService.renameSubject(oldName, newName);
    res.json({ message: `Subject renamed to ${newName} successfully.` });
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
