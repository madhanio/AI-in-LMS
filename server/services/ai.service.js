import dotenv from "dotenv";
dotenv.config();

const NVIDIA_API_KEY = process.env.NVIDIA_API_KEY;
const BASE_URL = "https://integrate.api.nvidia.com/v1";

export class AiService {
  /**
   * Generates embeddings for an array of texts in batches
   */
  async getEmbeddings(texts, inputType = "passage") {
    // NVIDIA recommended max batch size is 50 for embeddings
    const BATCH_SIZE = 50;
    let allEmbeddings = [];

    // Ensure it's an array
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

      if (!response.ok) {
        throw new Error(`Embedding Error: ${await response.text()}`);
      }

      const data = await response.json();
      // Keep order of embeddings
      allEmbeddings.push(...data.data.map(d => d.embedding));
    }

    return Array.isArray(texts) ? allEmbeddings : allEmbeddings[0];
  }

  /**
   * Generates embedding for single text (Backwards compatibility)
   */
  async getEmbedding(text, inputType = "passage") {
    return this.getEmbeddings(text, inputType);
  }

  /**
   * Expands the user query for better retrieval matching
   */
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
              content: "You are a specialized RAG query expansion engine. REWRITE the user question into a detailed search query for a vector database. Include synonyms and keywords. OUTPUT ONLY THE SEARCH STRING. DO NOT EXPLAIN. DO NOT ASK QUESTIONS. If the user says 'hi' or something casual, just output the same word back."
            },
            {
              role: "user",
              content: question
            }
          ],
          temperature: 0.1
        })
      });

      if (!response.ok) return question;
      const data = await response.json();
      const expanded = data.choices[0].message.content.trim();
      return expanded;
    } catch (e) {
      console.error("Query Expansion Error:", e.message);
      return question;
    }
  }

  /**
   * Triple-Path Intent Governor
   */
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
              content: `Classify user intent into exactly one category:
              - 'CASUAL': Greetings, jokes, identity, or meta-talk.
              - 'STUDY_QUICK': Simple definitions, facts, or short academic questions (e.g., 'What is X?').
              - 'STUDY_DEEP': Complex explanations, 'how it works', comparisons, or deep reasoning.`
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

  /**
   * Generates chat answer based on context as a stream
   */
  /**
   * Generates chat answer based on context as a stream
   */
  async getChatAnswer(question, contextText, history = [], subject = "General Academics", intent = "STUDY_QUICK", rollNumber = "") {
    const isDeep = intent === "STUDY_DEEP";
    const isQuick = intent === "STUDY_QUICK";
    const isCasual = intent === "CASUAL";
    const modelToUse = isDeep ? "nvidia/nemotron-3-super-120b-a12b" : "meta/llama-3.1-8b-instruct";

    const now = new Date();
    const dateString = now.toLocaleDateString('en-IN', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
    const currentMonth = now.getMonth() + 1; // 1-12
    const currentSemester = (currentMonth >= 7 || currentMonth <= 1) ? "I Semester" : "II Semester";
    const isSecondYear = rollNumber?.startsWith('24');
    const studentYear = isSecondYear ? "2nd Year" : "University Student";

    let systemPrompt = `You are the HITAM Academic Mentor, a specialized AI for students at Hyderabad Institute of Technology and Management. (Spelled HITAM, never Hyitam).
    
    CRITICAL CONTEXT:
    - Today is: ${dateString}.
    - Student Info: ${studentYear} (Based on roll number series ${rollNumber || 'unknown'}).
    - Current Active Semester: ${currentSemester} (Academic Year 2025-26).
    
    YOUR CORE KNOWLEDGE (WEEKLY ROUTINE):
    - Periods: P1(9:00-10:15), P2(10:15-11:15), P3(11:15-12:15), P4(1:00-2:00), P5(2:00-3:00), P6(3:00-4:30).
    - Mon: CN(P1), OOPJ(P2), CDC(P3), UMF(P4), OOPJ(P5,P6).
    - Tue: SMF(P1,P2), OOPJ(P3), CN(P4), PBL(P5,P6).
    - Wed: OOPS(R)(P1), SE(P2), OS(P3), CN Lab(P4,P5), Yoga(P6).
    - Thu: IDS(P1), COI(P2), SMF(P3), SE(P4), OOPJ(P5), PBL(P6).
    - Fri: CN(P1), LIB(P2), SMF(P3), Mentor(P4), AF/S/OH(P5,P6).
    - Sat: OOJS(R)(P1), CN(R)(P2), SMF(R)(P3), BC(P4,P5,P6).
    - FACULTY: SMF(S Shiva Kumar), OOPJ(Kaligotla Ravi Kumar), IDS(Richa Tiwari), CN(Chindala Tarun Kumar), SE(Nishani Shivakumar), COI(Dr. D. Ashalatha), OS/CDC/PBL/Mentor/LIB(Richa Tiwari).

    YOUR SOUL: 70% Zen Sensei, 20% Intellectual Professor, 10% Precise Analyst.
    STRICT RULE: Only support students in their academics. Avoid casual 'vibing'.
    OFF-TOPIC RULE: If a student goes off-topic, do NOT use the word "pivot". Instead, as a wise mentor, acknowledge them briefly and use encouraging, senior-level wisdom to lead them back to their subjects.
    FORMATTING RULE: NEVER wrap your entire response in quotes. Be direct and clean.
    SCHEDULING RULE: You have access to the GLOBAL ACADEMIC CALENDAR (from context). If asked about exams (Mid-terms, End-sems), Spells, or holidays, ALWAYS cross-check the context for AY 2025-26. Precision with dates is mandatory. If the context is missing, advise the student that you are awaiting the latest schedule upload.`;

    if (isCasual) {
      systemPrompt += `\nVIBE: Wise and patient. Encourage the student to find focus in their studies.`;
    } else if (isQuick) {
      systemPrompt += `\nFOCUS: Short, extremely accurate schedule details or academic definitions.`;
    } else if (isDeep) {
      systemPrompt += `\nFOCUS: Structural deep dives. Explain "Why" and "How" clearly.`;
    }

    const chatMessages = [
      { role: "system", content: systemPrompt },
      ...history,
      {
        role: "user",
        content: isCasual ? question : `Context:\n${contextText}\n\nStudent Question: ${question}`
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
      requestBody.extra_body = {
        chat_template_kwargs: { enable_thinking: false },
        reasoning_budget: 1024
      };
    }

    const response = await fetch(`${BASE_URL}/chat/completions`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${NVIDIA_API_KEY}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify(requestBody)
    });


    if (!response.ok) {
      throw new Error(`Chat API Error: ${await response.text()}`);
    }

    return response.body; // Returns the readable stream
  }

  /**
   * AI Vision Engine: Extracts text and tables from images using Multimodal LLMs
   */
  async performVisionOcr(base64Image, mimeType = "image/png") {
    try {
      console.log(`👁️ Calling AI Vision Engine (${mimeType}) for transcription...`);
      const response = await fetch(`${BASE_URL}/chat/completions`, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${NVIDIA_API_KEY}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          model: "nvidia/llama-3.2-11b-vision-instruct",
          messages: [
            {
              role: "user",
              content: [
                { 
                  type: "text", 
                  text: "You are an OCR expert. Precisely transcribe every detail from this academic document. If you see a timetable, schedule, or list, format it as a clean Markdown table to preserve the original structure. Ignore background noise. Be 100% accurate with dates, times, and subject names." 
                },
                {
                  type: "image_url",
                  image_url: {
                    url: `data:${mimeType};base64,${base64Image}`
                  }
                }
              ]
            }
          ],
          max_tokens: 4096,
          temperature: 0.1
        })
      });

      if (!response.ok) {
        throw new Error(`Vision API Error: ${await response.text()}`);
      }

      const data = await response.json();
      const transcription = data.choices[0]?.message?.content || "";
      console.log("✅ AI Vision transcription complete.");
      return transcription;
    } catch (e) {
      console.error("Vision OCR Error:", e.message);
      return "[Error during AI Vision transcription]";
    }
  }
}

export const aiService = new AiService();
