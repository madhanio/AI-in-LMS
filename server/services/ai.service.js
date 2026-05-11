import dotenv from "dotenv";
dotenv.config();

const NVIDIA_API_KEY = process.env.NVIDIA_API_KEY;
const NVIDIA_VISION_KEY = process.env.NVIDIA_VISION_KEY || NVIDIA_API_KEY;
const BASE_URL = "https://integrate.api.nvidia.com/v1";

// 🧠 TIER 1: SEMANTIC CACHE (Local In-Memory)
const semanticCache = new Map();

// 🔧 LIVE MODEL TOGGLE (Admin-controllable, no redeploy needed)
let currentModel = "meta/llama-3.1-8b-instruct";

export class AiService {
  async getEmbeddings(texts, inputType = "passage") {
    const BATCH_SIZE = 50;
    let allEmbeddings = [];
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
          truncate: "END"
        })
      });
      if (!response.ok) throw new Error(`Embedding Error: ${await response.text()}`);
      const data = await response.json();
      allEmbeddings.push(...data.data.map(d => d.embedding));
    }
    return Array.isArray(texts) ? allEmbeddings : allEmbeddings[0];
  }

  async getEmbedding(text, inputType = "passage") {
    return this.getEmbeddings(text, inputType);
  }

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
              content: "You are a specialized RAG query expansion engine. REWRITE the user question into a detailed search query for a vector database. Include synonyms and keywords. OUTPUT ONLY THE SEARCH STRING."
            },
            { role: "user", content: question }
          ],
          temperature: 0.1
        })
      });
      if (!response.ok) return question;
      const data = await response.json();
      return data.choices[0].message.content.trim();
    } catch (e) {
      console.error("Query Expansion Error:", e.message);
      return question;
    }
  }

  /**
   * TIER 1: SEMANTIC CACHE CHECK
   * Prevents LLM calls for identical frequent questions.
   */
  async checkCache(question) {
    const q = question.toLowerCase().trim();
    return semanticCache.get(q) || null;
  }

  async saveToCache(question, answer) {
    const q = question.toLowerCase().trim();
    if (semanticCache.size > 500) semanticCache.clear(); // Basic rotation
    semanticCache.set(q, answer);
  }

  /**
   * FLUSH ALL MEMORY
   * Forces the AI to learn new data immediately after an edit.
   */
  async clearCache() {
    console.log("🧠 Flushing Semantic Cache...");
    semanticCache.clear();
  }

  getModel() {
    return currentModel;
  }

  setModel(model) {
    const allowed = ["meta/llama-3.1-8b-instruct", "meta/llama-3.1-70b-instruct"];
    if (!allowed.includes(model)) return false;
    currentModel = model;
    console.log(`🔧 Model switched to: ${model}`);
    return true;
  }

  /**
   * UPGRADE 1 — PREPROCESS QUERY
   * Fix typos and expand academic shorthand before anything else.
   * 'cn mod3 imp qns' → 'Computer Networks module 3 important questions'
   */
  async preprocessQuery(rawInput) {
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
              content: `You are an academic query normalizer for Indian engineering students.
Your ONLY job: fix typos, expand abbreviations, and resolve shorthand. Do NOT change the meaning.

SHORTHAND DICTIONARY (memorize these):
- 2m, 2marks, 2 mark = 2 mark (NOT module 2, NOT multiple choice)
- 10m, 10marks = 10 mark
- u1, m1, mod1 = module 1
- u2, m2, mod2 = module 2
- u3, m3, mod3 = module 3
- u4, m4, mod4 = module 4
- u5, m5, mod5 = module 5
- imp = important
- qns, ques, qn = questions
- qb = question bank
- cn = Computer Networks
- ds = Data Structures
- os = Operating Systems
- dbms = Database Management Systems
- se = Software Engineering
- mp = Microprocessors
- coa = Computer Organization and Architecture
- daa = Design and Analysis of Algorithms
- flat = Formal Languages and Automata Theory
- cd = Compiler Design
- wt = Web Technologies
- mid, mid1, mid2 = MID 1, MID 2 (midterm exam)
- prev yr, prev year = previous year
- pls, plz = (remove, don't expand)
- gimme, giv = give me

EXAMPLES:
- "cn mod3 imp qns" → "Computer Networks module 3 important questions"
- "gimme all modules 2m ques" → "give me all modules 2 mark questions"
- "ds linked list mid1" → "Data Structures linked list MID 1 questions"
- "os mod 2 10m qns" → "Operating Systems module 2 10 mark questions"
- "cn qb mod5" → "Computer Networks question bank module 5"
- "imp 2m ques from all modules" → "important 2 mark questions from all modules"

RULES:
1. "2m" ALWAYS means "2 mark". NEVER interpret it as "module 2" or "multiple choice".
2. "all modules" means ALL modules. Do not collapse it into a single module number.
3. Preserve the student's intent exactly. Do not add words or topics they didn't mention.
4. OUTPUT ONLY the cleaned query string. No explanation, no quotes.`
            },
            { role: "user", content: rawInput }
          ],
          temperature: 0.1,
          max_tokens: 150
        })
      });
      if (!response.ok) return rawInput;
      const data = await response.json();
      const cleaned = data.choices[0]?.message?.content?.trim() || rawInput;
      return cleaned;
    } catch (e) {
      console.error("Preprocess Error:", e.message);
      return rawInput;
    }
  }

  /**
   * UPGRADE 1 — INTENT CLASSIFICATION
   * Must receive CLEANED input (post-preprocessQuery), not raw.
   * Returns structured object: { intent, currentSubject, activeModule }
   */
  async getIntent(cleanedQuery) {
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
              content: `You are an academic intent classifier for engineering students. Given a cleaned student query, extract:
1. intent: ONE of: syllabus_query | concept_explanation | exam_preparation | troubleshooting | student_data_query
2. currentSubject: The subject being asked about (e.g. 'Computer Networks', 'Data Structures'). null if unclear.
3. activeModule: The module or unit number mentioned (e.g. 3 for 'module 3'). null if not mentioned.

Rules:
- syllabus_query: subject overview, what to study, list of topics, modules covered
- concept_explanation: explain X, what is Y, how does Z work, definition of
- exam_preparation: quiz, important questions, past papers, MID, model paper, question bank
- troubleshooting: error, fix, why isn't X working, problem with
- student_data_query: my attendance, my timetable, my deadlines, my schedule
- calendar_query: events, academic calendar, holidays, exam dates, college schedule

CRITICAL: Respond ONLY with a valid JSON object. No explanation.
JSON SCHEMA: { "intent": "...", "currentSubject": "..." | null, "activeModule": number | null }`
            },
            { role: "user", content: cleanedQuery }
          ],
          temperature: 0.1,
          max_tokens: 80,
          response_format: { type: "json_object" }
        })
      });
      const data = await response.json();
      const raw = data.choices[0]?.message?.content || '{}';
      const parsed = JSON.parse(this.cleanJsonResponse(raw));

      const validIntents = ['syllabus_query', 'concept_explanation', 'exam_preparation', 'troubleshooting', 'student_data_query', 'calendar_query'];
      const intent = validIntents.includes(parsed.intent) ? parsed.intent : 'concept_explanation';

      return {
        intent,
        currentSubject: parsed.currentSubject || null,
        activeModule: typeof parsed.activeModule === 'number' ? parsed.activeModule : null
      };
    } catch (e) {
      console.error("Intent Error:", e.message);
      return { intent: 'concept_explanation', currentSubject: null, activeModule: null };
    }
  }

  async getChatAnswer(question, contextText, history = [], subject = "General Academics", intent = "concept_explanation", rollNumber = "", studentProfile = {}, activeModule = null) {
    const isCasual = intent === 'concept_explanation' && question.trim().split(/\s+/).length <= 3;

    // UPGRADE 5 — MODEL ROUTING (Cost/Complexity optimization)
    const simpleIntents = ['calendar_query', 'student_data_query', 'troubleshooting'];
    const modelToUse = simpleIntents.includes(intent) ? "meta/llama-3.1-8b-instruct" : currentModel;

    console.log(`🧠 Using model: ${modelToUse} | Intent: ${intent}`);

    // 🏙️ UPGRADE 5 — INTENT-TO-STRATEGY MAP
    const intentStrategyMap = {
      exam_preparation: { temperature: 0.3, max_tokens: 1024, style: 'Respond with concise, numbered bullet points. Be keyword-dense. Prioritize exam-relevant facts and definitions.' },
      concept_explanation: { temperature: 0.6, max_tokens: 2048, style: 'Explain using clear analogies. Progress from beginner-level intuition to technical depth. Use examples.' },
      troubleshooting: { temperature: 0.4, max_tokens: 1024, style: 'Respond step-by-step. Number each step. Diagnose before prescribing. Be precise and actionable.' },
      syllabus_query: { temperature: 0.4, max_tokens: 1536, style: 'Structure response module-wise. Use bold headers per module. Be comprehensive but organized.' },
      student_data_query: { temperature: 0.2, max_tokens: 512, style: 'Respond directly with the requested data first. Minimal prose. No filler.' },
      calendar_query: { temperature: 0.2, max_tokens: 512, style: 'Extract and state exactly what the academic calendar says about the queried dates. Do not invent events.' }
    };

    const strategy = intentStrategyMap[intent] || intentStrategyMap['concept_explanation'];

    const now = new Date();
    const dateString = now.toLocaleDateString('en-IN', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
    const isSecondYear = rollNumber?.startsWith('24') || studentProfile?.rollNumber?.startsWith('24');
    const studentYear = studentProfile?.year || (isSecondYear ? "2nd Year" : "University Student");
    const studentName = studentProfile?.name || 'Student';
    const studentBranch = studentProfile?.branch || '';
    const studentSection = studentProfile?.section || '';
    const effectiveRoll = studentProfile?.rollNumber || rollNumber || 'No Roll';

    // 🎨 PRODUCTION PERSONA — STICK TO ACADEMICS
    let systemPrompt = `You are the AcademicCore Mentor, a specialized AI for HITAM students.

    YOUR SOUL: 70% Zen Sensei, 20% Intellectual Professor, 10% Precise Analyst.

    EXAM MODE / QUIZ RULES:
    1. If a student asks for a quiz or for you to ask questions, present exactly ONE question at a time.
    2. NEVER provide the answer alongside the question.
    3. Wait for the student to attempt a response before giving feedback or moving to the next question.
    4. Maintain a supportive, encouraging tone but stay rigorous in accuracy.

    CONTEXT DIFFERENTIATION:
    - If context is provided from a QUESTION_BANK, clarify it as "Based on previous paper trends".
    - Always prioritize MODULE_RESOURCE for defining core concepts.

    STRICT GUIDELINES:
    1. Answers MUST be grounded in the provided [CONTEXT].
    2. Start directly with the answer.
    3. Use Markdown (Bold, Lists) for clarity.
    4. GENERAL MODE: If no specific PDF results are found in the [CONTEXT], but the student is asking about their syllabus overview or subjects, use the context to list their subjects and provide general academic guidance. DO NOT just say "Topic not covered" for general meta-questions.
    5. GROUNDING RULE: If the answer is not in the retrieved [CONTEXT], explicitly say "I don't have that information in the uploaded materials." Do not answer from general knowledge.

    FORMATTING RULES:
    - NEVER output raw quote marks like "" in your response.
    - NEVER use markdown artifacts (e.g., <artifact> tags, <antArtifact> tags) or side-panel instructions.
    - NEVER USE XML. No <thought>, <reasoning>, <antArtifact>, or <artifact> tags. If you use XML tags, the system will crash.
    - Provide ONLY the direct conversational response.
    - Use clean, natural language. Do not echo template syntax or context delimiters.

    STUDENT PROFILE:
    Name: ${studentName}.
    Roll Number: ${effectiveRoll}.
    Year: ${studentYear}.
    Branch: ${studentBranch || 'Not specified'}.
    Section: ${studentSection || 'Not specified'}.

    DYNAMIC CONTEXT:
    Today: ${dateString}.
    Focus: ${subject}.${activeModule ? `\n    Active Module: Module ${activeModule}.` : ''}

    RESPONSE STYLE (for this query): ${strategy.style}`;

    const chatMessages = [
      { role: "system", content: systemPrompt },
      ...history,
      {
        role: "user",
        content: isCasual ? question + '\n\nCRITICAL: Respond directly. DO NOT use <antArtifact>, <artifact>, or any XML tags.' : `--- CONTEXT START ---\n${contextText}\n--- CONTEXT END ---\n\nStudent's Question: ${question}\n\nCRITICAL RULE: DO NOT use <antArtifact>, <artifact>, or any XML tags in your response. Respond in plain conversational text only.`
      }
    ];

    const requestBody = {
      model: modelToUse,
      messages: chatMessages,
      temperature: strategy.temperature,
      top_p: 0.9,
      max_tokens: strategy.max_tokens,
      stream: true
    };

    if (modelToUse === "nvidia/nemotron-3-super-120b-a12b") {
      requestBody.extra_body = { chat_template_kwargs: { enable_thinking: false }, reasoning_budget: 1024 };
    }

    const response = await fetch(`${BASE_URL}/chat/completions`, {
      method: "POST",
      headers: { "Authorization": `Bearer ${NVIDIA_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify(requestBody)
    });

    if (!response.ok) throw new Error(`Chat API Error: ${await response.text()}`);
    return response.body;
  }

  /**
   * UPGRADE 7 — RESPONSE VALIDATION & SAFETY
   * Defined failure actions per case:
   *   empty          → fallback message with suggested next action
   *   contradiction  → regenerate once, then fallback if still invalid
   *   wrong_module   → flag, filter, return fallback
   *   exam_mode      → block, return lockdown notice
   *
   * Returns: { valid, failureType, action, fallbackMessage }
   */
  async validateResponse(responseText, contextText, intent, subject, isExamMode = false) {
    const trimmed = (responseText || '').trim();

    // ── Guard: Exam mode + Q&A attempted ─────────────────────────────────
    if (isExamMode) {
      return {
        valid: false,
        failureType: 'exam_mode',
        action: 'block',
        fallbackMessage: '🔒 Exam Mode Active. Q&A is disabled during examination hours. Good luck!'
      };
    }

    // ── Guard: Empty or refusal response ─────────────────────────────────
    const refusalPhrases = ["i don't know", "i cannot", "i do not know", "i'm not sure", "i am not sure", "no information"];
    const isEmptyOrRefusal = trimmed.length < 30 || refusalPhrases.some(p => trimmed.toLowerCase().includes(p));

    if (isEmptyOrRefusal) {
      return {
        valid: false,
        failureType: 'empty',
        action: 'fallback',
        fallbackMessage: `I couldn't find a clear answer in the uploaded materials for **${subject || 'this topic'}**. Try rephrasing, or check if the relevant PDF has been uploaded by your admin.`
      };
    }

    // ── Guard: Wrong module reference ─────────────────────────────────────
    // Detect if response mentions a module number not present in context
    const moduleInResponse = trimmed.match(/module\s*(\d)/i);
    const moduleInContext = contextText?.match(/module\s*(\d)/i);
    if (moduleInResponse && moduleInContext && moduleInResponse[1] !== moduleInContext[1]) {
      return {
        valid: false,
        failureType: 'wrong_module',
        action: 'fallback',
        fallbackMessage: `⚠️ The response referenced Module ${moduleInResponse[1]} but your question context is for Module ${moduleInContext[1]}. Please check the uploaded PDF for Module ${moduleInContext[1]}.`
      };
    }

    // ── Guard: Contradiction check (lightweight LLM call) ─────────────────
    // Only run if we have real context (not the "no materials" placeholder)
    if (contextText && !contextText.includes('No specific materials')) {
      try {
        const checkResponse = await fetch(`${BASE_URL}/chat/completions`, {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${NVIDIA_API_KEY}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({
            model: 'meta/llama-3.1-8b-instruct',
            messages: [
              {
                role: 'system',
                content: 'You are a fact-checker. Given a CONTEXT and a RESPONSE, does the response directly contradict specific facts stated in the context? Answer ONLY with JSON: {"contradicts": true} or {"contradicts": false}. If unsure, answer false.'
              },
              {
                role: 'user',
                content: `CONTEXT:\n${contextText.slice(0, 1500)}\n\nRESPONSE:\n${trimmed.slice(0, 800)}`
              }
            ],
            temperature: 0.1,
            max_tokens: 20
          })
        });

        if (checkResponse.ok) {
          const checkData = await checkResponse.json();
          const checkRaw = checkData.choices[0]?.message?.content || '{}';
          const checkParsed = JSON.parse(this.cleanJsonResponse(checkRaw));

          if (checkParsed.contradicts === true) {
            return {
              valid: false,
              failureType: 'contradiction',
              action: 'regenerate',  // api.js will retry once, then fallback if still invalid
              fallbackMessage: `I found conflicting information. Please review the uploaded materials directly, or ask a more specific question about **${subject || 'this topic'}**.`
            };
          }
        }
      } catch (e) {
        console.warn('Validation contradiction check failed (non-critical):', e.message);
        // Don't block on validator failure — pass through
      }
    }

    return { valid: true, failureType: null, action: 'pass', fallbackMessage: null };
  }

  async performVisionOcr(base64Image, mimeType = "image/png") {
    try {
      const response = await fetch(`${BASE_URL}/chat/completions`, {
        method: "POST",
        headers: { "Authorization": `Bearer ${NVIDIA_API_KEY}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "nvidia/llama-3.2-11b-vision-instruct",
          messages: [
            {
              role: "user",
              content: [
                { type: "text", text: "You are an OCR expert. Precisely transcribe this academic document as a clean Markdown table." },
                { type: "image_url", image_url: { url: `data:${mimeType};base64,${base64Image}` } }
              ]
            }
          ],
          max_tokens: 4096,
          temperature: 0.1
        })
      });
      if (!response.ok) return null;
      const data = await response.json();
      return data.choices[0]?.message?.content || "";
    } catch {
      return null;
    }
  }

  /**
   * Performs a deep scan of the text AND filename to extract doc_type, module_number, and part_number.
   */
  async classifyContent(text, fileName = "") {
    if (!text && !fileName) return { contentType: "TEXT", docType: "MODULE_RESOURCE", moduleNumber: null, partNumber: null };
    try {
      const response = await fetch(`${BASE_URL}/chat/completions`, {
        method: "POST",
        headers: { "Authorization": `Bearer ${NVIDIA_API_KEY}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "meta/llama-3.1-8b-instruct",
          messages: [
            {
              role: "system",
              content: `Analyze the provided academic text and filename to extract metadata in JSON format.
              
              RULES:
              - moduleNumber: Extract any mentioned Unit number or Module number (e.g., 'Unit 2' or 'Module 2' -> 2).
                - *Institutional Rule*: If filename is 'MID-1' or 'MID-I' and no module is mentioned, pick '1'. If 'MID-2' or 'MID-II', pick '4'.
              - partNumber: Extract any mentioned part number (e.g., 'Part 1' -> 1).
              - docType:
                - 'QUESTION_BANK': lists of exam questions or marks distributions (e.g., 'MID-1 QB', 'Assignment').
                - 'MODEL_PAPER': sample or previous year papers.
                - 'MODULE_RESOURCE': Default for notes/study material.
              - contentType: 'TABULAR' for calendars/schedules, else 'TEXT'.
              
              CRITICAL: YOU MUST USE DOUBLE QUOTES FOR ALL KEYS AND STRINGS. DO NOT USE SINGLE QUOTES. DO NOT LEAVE TRAILING COMMAS.
              
              JSON SCHEMA:
              {
                "contentType": "TABULAR" | "TEXT",
                "docType": "MODULE_RESOURCE" | "QUESTION_BANK" | "MODEL_PAPER",
                "moduleNumber": number | null,
                "partNumber": number | null
              }`
            },
            { role: "user", content: `FILENAME: ${fileName}\n\nCONTENT SAMPLE:\n${text.slice(0, 4000)}` }
          ],
          temperature: 0.1,
          response_format: { type: "json_object" }
        })
      });
      if (!response.ok) {
        const errText = await response.text();
        console.warn(`⚠️ Classification API returned ${response.status}: ${errText}`);
        return { contentType: "TEXT", docType: "MODULE_RESOURCE", moduleNumber: null, partNumber: null };
      }

      const data = await response.json();
      const raw = data.choices?.[0]?.message?.content || "{}";
      const meta = JSON.parse(this.cleanJsonResponse(raw));

      return {
        contentType: meta.contentType || "TEXT",
        docType: meta.docType || "MODULE_RESOURCE",
        moduleNumber: meta.moduleNumber || null,
        partNumber: meta.partNumber || null
      };
    } catch (e) {
      console.error("Deep Classification Error:", e.message);
      return { contentType: "TEXT", docType: "MODULE_RESOURCE", moduleNumber: null, partNumber: null };
    }
  }

  /**
   * TIER 2.5: INTENT FILTER EXTRACTION
   * Detects if the student is specifically asking for a QB, Model Paper, or a specific Module.
   */
  async extractQueryMetadata(question) {
    try {
      const response = await fetch(`${BASE_URL}/chat/completions`, {
        method: "POST",
        headers: { "Authorization": `Bearer ${NVIDIA_API_KEY}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "meta/llama-3.1-8b-instruct",
          messages: [
            {
              role: "system",
              content: `Extract search filters from the student's question in JSON format.
              
              FILTER RULES:
              - docType: If they mention 'questions', 'bank', 'quiz' -> 'QUESTION_BANK'. If they mention 'paper', 'model' -> 'MODEL_PAPER'.
              - moduleNumber: If they mention 'module 1', 'unit 1', etc. -> extract the number.
                - *MID Rule*: 'MID-1' -> [1,2,3], 'MID-2' -> [3,4,5]. If 'MID-1' is asked, targetModule can be 1 (primary).

              JSON SCHEMA:
              {
                "targetDocType": "MODULE_RESOURCE" | "QUESTION_BANK" | "MODEL_PAPER" | null,
                "targetModule": number | null
              }`
            },
            { role: "user", content: question }
          ],
          temperature: 0.1,
          response_format: { type: "json_object" }
        })
      });
      if (!response.ok) {
        const errText = await response.text();
        console.warn(`⚠️ Intent Filter API returned ${response.status}: ${errText}`);
        return { targetDocType: null, targetModule: null };
      }

      const data = await response.json();
      const raw = data.choices?.[0]?.message?.content || "{}";
      return JSON.parse(this.cleanJsonResponse(raw));
    } catch (e) {
      console.error("Intent Filter Error:", e.message);
      return { targetDocType: null, targetModule: null };
    }
  }

  /**
   * Multimodal structured extraction using Gemma 3 Vision via NVIDIA NIM
   * Uses a 4-step Chain-of-Thought approach for high accuracy.
   */
  async extractCalendarEventsFromImages(base64Images, fileName, rawText = null) {
    // 🛡️ TIERED FALLBACK LADDER
    const tiers = [
      { name: "Tier 1: Gemma 3 Vision (27B)", method: () => this.extractViaGemma3Vision(base64Images, fileName) },
      { name: "Tier 2: Llama 3.2 Vision (11B)", method: () => this.extractViaLlamaVision(base64Images, fileName) },
      { name: "Tier 3: Text Lane (Gemma 3 Text)", method: () => this.extractCalendarEventsFromText(rawText, fileName) }
    ];

    for (const tier of tiers) {
      try {
        if (tier.name.includes("Text Lane") && !rawText) continue;

        console.log(`🚀 Attempting extraction via ${tier.name}...`);
        const events = await tier.method();

        // Success condition: Found representative number of events (HITAM usually has 20+)
        if (events && events.length >= 10) {
          console.log(`✅ ${tier.name} succeeded with ${events.length} events.`);
          return this.validateAndNormalizeEvents(events);
        }
        console.warn(`⚠️ ${tier.name} returned too few events (${events?.length || 0}). Trying next tier...`);
      } catch (error) {
        console.error(`❌ ${tier.name} failed:`, error.message);
      }
    }

    return [];
  }

  async extractViaGemma3Vision(base64Images, fileName) {
    const prompt = this.getCalendarCotPrompt();
    return this.callVisionModel("google/gemma-3-27b-it", base64Images, prompt, fileName);
  }

  async extractViaLlamaVision(base64Images, fileName) {
    const prompt = this.getCalendarCotPrompt();
    return this.callVisionModel("nvidia/llama-3.2-11b-vision-instruct", base64Images, prompt, fileName);
  }

  async extractCalendarEventsFromText(text, fileName) {
    if (!text) return [];
    const response = await fetch(`${BASE_URL}/chat/completions`, {
      method: "POST",
      headers: { "Authorization": `Bearer ${NVIDIA_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "google/gemma-3-27b-it",
        messages: [
          { role: "user", content: `[messy_text]\n${text}\n\n[INSTRUCTION]\nExtract all academic calendar events from the text above. Follow this format: ${this.getCalendarCotPrompt()}` }
        ],
        temperature: 0.1
      })
    });
    if (!response.ok) return [];
    const data = await response.json();
    const parsed = JSON.parse(this.cleanJsonResponse(data.choices[0]?.message?.content));
    return (parsed.events || []).map(e => ({ ...e, source_file: fileName }));
  }

  getCalendarCotPrompt() {
    return `You are an OCR and Academic Data Expert.
CONTEXT:
- University: Hyderabad Institute of Technology and Management (HITAM)
- Academic Year: 2025-26
- PDF Structure: Table with columns: S.No | Description | Duration (From | To)
- Headers: Look for "B.TECH. I SEMESTER" or "B.TECH. II SEMESTER".

FOLLOW THESE STEPS IN YOUR REASONING:
STEP 1 - TABLE STRUCTURE ANALYSIS: Identify headers and columns.
STEP 2 - ROW-BY-ROW EXTRACTION: For every row, extract Description, From, To, Semester.
STEP 3 - DATE NORMALIZATION: Convert to YYYY-MM-DD.
STEP 4 - JSON OUTPUT: reasoning summary and events array.

CRITICAL RULES:
- If you cannot read a date clearly, set it to null (don't guess).
- Extract ALL rows, don't skip any.
- Preserve semester information (I or II).
- Include "row_number" (integer).

JSON SCHEMA:
{ "reasoning": "summary", "events": [{ "event_name": "string", "date_from": "YYYY-MM-DD", "date_to": "YYYY-MM-DD", "date_raw": "...", "date_is_approximate": boolean, "semester": "I or II", "row_number": integer }] }`;
  }

  async callVisionModel(model, base64Images, prompt, fileName) {
    const content = [{ type: "text", text: prompt }];
    base64Images.forEach(b64 => content.push({ type: "image_url", image_url: { url: `data:image/png;base64,${b64}` } }));

    const response = await fetch(`${BASE_URL}/chat/completions`, {
      method: "POST",
      headers: { "Authorization": `Bearer ${NVIDIA_VISION_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model,
        messages: [{ role: "user", content }],
        max_tokens: 4096,
        temperature: 0.1
      })
    });

    if (!response.ok) throw new Error(`API returned ${response.status}`);
    const data = await response.json();
    const parsed = JSON.parse(this.cleanJsonResponse(data.choices[0]?.message?.content || ""));
    return (parsed.events || []).map(e => ({ ...e, source_file: fileName }));
  }

  validateAndNormalizeEvents(events) {
    return events
      .filter(e => e.event_name && e.event_name.trim().length > 0)
      .map(e => {
        let semester = e.semester || "I";
        if (semester.toString().includes("II") || semester.toString().includes("2nd")) semester = "II";
        else semester = "I";

        let dateFrom = e.date_from;
        let dateTo = e.date_to || dateFrom;

        const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
        if (dateFrom && !dateRegex.test(dateFrom)) dateFrom = null;
        if (dateTo && !dateRegex.test(dateTo)) dateTo = null;

        return { ...e, semester, date_from: dateFrom, date_to: dateTo };
      })
      .filter(e => e.date_from || e.date_to);
  }

  /**
   * Helper to strip conversational text and markdown from JSON responses
   * Robust Regex-based extraction (looks for the first valid JSON block)
   */
  cleanJsonResponse(content) {
    if (!content) return "{}";

    // 1. Remove markdown code blocks if present
    let cleaned = content.replace(/```json\n?|```\n?/g, "").trim();

    // 2. Repair common LLM syntax errors (Single quotes instead of Double quotes)
    // Fix keys: 'key': -> "key":
    cleaned = cleaned.replace(/(['])?([a-zA-Z0-9_]+)(['])?\s*:/g, '"$2":');
    // Fix string values: : 'value' -> : "value"
    cleaned = cleaned.replace(/:\s*'([^']*)'/g, ': "$1"');
    // Remove trailing commas: , } -> }
    cleaned = cleaned.replace(/,\s*([\}\]])/g, '$1');

    // 3. Find the first { and the last }
    const firstBrace = cleaned.indexOf('{');
    const lastBrace = cleaned.lastIndexOf('}');

    if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
      // Extract ONLY what is between the first and last brace
      return cleaned.substring(firstBrace, lastBrace + 1);
    }

    // Fallback to original match logic if braces are missing/mangled
    const match = cleaned.match(/\{[\s\S]*\}|\[[\s\S]*\]/);
    return match ? match[0] : "{}";
  }
}

export const aiService = new AiService();
