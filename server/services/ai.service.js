import dotenv from "dotenv";
dotenv.config();

const NVIDIA_API_KEY = process.env.NVIDIA_API_KEY;
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
   * Converts raw tables into structured JSON events
   */
  async parseTableToEvents(extractedTables, fileName) {
    try {
      const tableData = JSON.stringify(extractedTables);
      const response = await fetch(`${BASE_URL}/chat/completions`, {
        method: "POST",
        headers: { "Authorization": `Bearer ${NVIDIA_API_KEY}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "meta/llama-3.1-8b-instruct",
          messages: [
            {
              role: "system",
              content: `Convert the following extracted table data into a structured JSON array of academic events.
              
              JSON SCHEMA:
              {
                "events": [
                  {
                    "semester": "string (e.g., I-I, II-II, or Sem 1)",
                    "event_name": "string (e.g., Mid Exams, Registration)",
                    "date_from": "string (ISO format YYYY-MM-DD or null)",
                    "date_to": "string (ISO format YYYY-MM-DD or null)",
                    "date_raw": "string (original text from table)",
                    "date_is_approximate": boolean
                  }
                ]
              }
              
              RULES:
              1. If a date is specific (e.g., 22.09.2025), parse to ISO.
              2. If a date is vague (e.g., 3rd Week of April), set date_from/to to null and date_is_approximate to true.
              3. Always keep the original text in date_raw.
              4. Output ONLY the JSON object.`
            },
            { role: "user", content: `SOURCE FILE: ${fileName}\n\nDATA: ${tableData}` }
          ],
          temperature: 0.1,
          response_format: { type: "json_object" }
        })
      });
      
      const data = await response.json();
      const content = data.choices[0]?.message?.content;
      const parsed = JSON.parse(content);
      
      return (parsed.events || []).map(event => ({
        ...event,
        source_file: fileName
      }));
    } catch (e) {
      console.error("Structured Parsing Error:", e);
      return [];
    }
  }
}

export const aiService = new AiService();
