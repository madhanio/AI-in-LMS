import dotenv from "dotenv";
dotenv.config();

const NVIDIA_API_KEY = process.env.NVIDIA_API_KEY;
const NVIDIA_VISION_KEY = process.env.NVIDIA_VISION_KEY || NVIDIA_API_KEY;
const BASE_URL = "https://integrate.api.nvidia.com/v1";

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
          truncate: "NONE"
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

  async getIntent(question) {
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
              content: `Classify user intent into: 'CASUAL', 'STUDY_QUICK', or 'STUDY_DEEP'.`
            },
            { role: "user", content: question }
          ],
          temperature: 0.1,
          max_tokens: 10
        })
      });
      const data = await response.json();
      const intent = (data.choices[0]?.message?.content || 'CASUAL').toUpperCase();
      if (intent.includes('DEEP')) return 'STUDY_DEEP';
      if (intent.includes('QUICK')) return 'STUDY_QUICK';
      return 'CASUAL';
    } catch {
      return 'STUDY_QUICK';
    }
  }

  async getChatAnswer(question, contextText, history = [], subject = "General Academics", intent = "STUDY_QUICK", rollNumber = "") {
    const isDeep = intent === "STUDY_DEEP";
    const isCasual = intent === "CASUAL";
    const modelToUse = isDeep ? "nvidia/nemotron-3-super-120b-a12b" : "meta/llama-3.1-8b-instruct";

    const now = new Date();
    const dateString = now.toLocaleDateString('en-IN', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
    const isSecondYear = rollNumber?.startsWith('24');
    const studentYear = isSecondYear ? "2nd Year" : "University Student";

    // 🎨 RESTORED PREMIUM PERSONA + FACT-FIRST HYBRID
    let systemPrompt = `You are the HITAM Academic Mentor, a specialized AI for students at Hyderabad Institute of Technology and Management.
    
    YOUR SOUL: 70% Zen Sensei, 20% Intellectual Professor, 10% Precise Analyst.
    STRICT RULE: Only support students in their academics. Avoid casual 'vibing'.
    OFF-TOPIC RULE: If a student goes off-topic, acknowledge briefly and use senior-level wisdom to lead them back to their subjects.
    
    STRICT FORMATTING RULE: 
    - START your message directly with your advice. 
    - NEVER use quotes ("" or '') to wrap your entire message.
    - ELOCUTION: Always convert raw numeric dates into natural sentences.
    
    FACT-FIRST MANDATE: 
    - You are a Document-First assistant. Use [OFFICIAL CONTEXT] with 100% authority. 
    - STRIKE RULE: If a date is not in the context, simply say: "I can see the semester timeframe, but the exact date for [Event] isn't clearly in this section."
    - NEVER calculate weeks or guess dates based on 'typical' schedules. Helpful but 100% grounded.
    
    HONESTY RULE (APPROXIMATE DATES):
    - If the provided calendar context indicates 'date_is_approximate: true' or says a date is 'approximate', YOU MUST inform the student: "This is scheduled for [Original Date] — exact dates aren't confirmed yet."
    
    DETECTIVE MODE (PRECISION):
    - Use "Instruction Spells" to give students a 'window' of when events happen. 
    - If the OCR text is fragmented, look at the row headers to bridge the data.
    
    CONTEXT INFO:
    - Today is: ${dateString}.
    - Student: ${studentYear} (Roll: ${rollNumber || 'unknown'}).`;

    const chatMessages = [
      { role: "system", content: systemPrompt },
      ...history,
      { 
        role: "user", 
        content: isCasual ? question : `[OFFICIAL CONTEXT]\n${contextText}\n\n[USER QUESTION]\n${question}` 
      }
    ];

    const requestBody = {
      model: modelToUse,
      messages: chatMessages,
      temperature: isDeep ? 0.7 : 0.8,
      top_p: 0.9,
      max_tokens: isDeep ? 16384 : 1024,
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
   * Classifies if the extracted text is primarily tabular (Calendar/Timetable)
   */
  async classifyContent(text) {
    if (!text) return "TEXT";
    try {
      const response = await fetch(`${BASE_URL}/chat/completions`, {
        method: "POST",
        headers: { "Authorization": `Bearer ${NVIDIA_API_KEY}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "meta/llama-3.1-8b-instruct",
          messages: [
            {
              role: "system",
              content: "Classify if the text is an ACADEMIC CALENDAR, TIMETABLE, or SCHEDULE. Output only 'TABULAR' or 'TEXT'."
            },
            { role: "user", content: text.slice(0, 3000) } // Sample the text
          ],
          temperature: 0.1,
          max_tokens: 10
        })
      });
      const data = await response.json();
      const result = (data.choices[0]?.message?.content || "TEXT").toUpperCase();
      return result.includes("TABULAR") ? "TABULAR" : "TEXT";
    } catch (e) {
      console.error("Classification Error:", e);
      return "TEXT";
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
   * Robust Regex-based extraction (looks for first { and last })
   */
  cleanJsonResponse(content) {
     if (!content) return "{}";
     let cleaned = content.replace(/```json\n?|```\n?/g, "").trim();
     const match = cleaned.match(/\{[\s\S]*\}|\[[\s\S]*\]/);
     return match ? match[0] : cleaned;
  }
}

export const aiService = new AiService();
