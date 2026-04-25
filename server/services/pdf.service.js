import pdfParse from "pdf-parse";
import { PDFDocument, PDFName, PDFDict, PDFRawStream } from "pdf-lib";
import { createWorker } from "tesseract.js";
import { aiService } from "./ai.service.js";
import { spawnSync } from "child_process";
import fs from "fs";
import path from "path";
import os from "os";
import pdfConverter from "pdf-img-convert";
import mammoth from "mammoth";
import WordExtractor from "word-extractor";

export class PdfService {
  /**
   * Extracts text from PDF, DOCX, or DOC buffer.
   */
  async extractText(buffer, fileName = "") {
    const ext = path.extname(fileName).toLowerCase();
    let text = "";
    let source = "vector";

    try {
      if (ext === '.docx') {
        text = await this.docxToText(buffer);
        source = "docx";
      } else if (ext === '.doc') {
        text = await this.docToText(buffer);
        source = "doc";
      } else {
        // Default to PDF
        const render_page = (pageData) => {
          let render_options = { normalizeWhitespace: false, disableCombineTextItems: false };
          return pageData.getTextContent(render_options).then(function(textContent) {
            let pageText = '';
            let lastY = null;
            for (let item of textContent.items) {
              if (lastY == item.transform[5] || !lastY) {
                pageText += item.str;
              } else {
                pageText += '\n' + item.str;
              }
              lastY = item.transform[5];
            }
            return `\n\n[PAGE_MARKER_${pageData.pageIndex + 1}]\n\n` + pageText;
          });
        };

        const data = await pdfParse(buffer, { pagerender: render_page });
        text = data?.text || "";

        // OCR Fallback for scanned PDFs
        if (text.trim().length < 100) {
          console.log("🧩 Scanned PDF detected. Triggering Resilient OCR Pipeline...");
          const ocrText = await this.performOcr(buffer);
          if (ocrText && ocrText.trim().length > 0) {
              text = ocrText;
              source = "ocr";
          }
        }
      }
    } catch (error) {
      console.error(`❌ Extraction error for ${fileName}:`, error);
    }

    return { text: text || "", source };
  }

  /**
   * Extracts text from .docx using mammoth with HTML-to-Markdown table preservation
   */
  async docxToText(buffer) {
    const result = await mammoth.convertToHtml({ buffer });
    let html = result.value || "";
    return this.htmlToMarkdown(html);
  }

  /**
   * Extracts text from .doc using word-extractor with Tab-to-Markdown reconstruction
   */
  async docToText(buffer) {
    const extractor = new WordExtractor();
    const doc = await extractor.extract(buffer);
    const rawText = doc.getBody() || "";
    return this.reconstructTablesFromTabs(rawText);
  }

  /**
   * Converts basic HTML tables to Markdown pipes
   */
  htmlToMarkdown(html) {
    if (!html) return "";
    
    let processed = html
      // Convert Bold
      .replace(/<strong>(.*?)<\/strong>|<b>(.*?)<\/b>/g, "**$1$2**")
      // Convert Italics
      .replace(/<em>(.*?)<\/em>|<i>(.*?)<\/i>/g, "*$1$2*")
      // Handle Tables
      .replace(/<table.*?>([\s\S]*?)<\/table>/g, (match, tableContent) => {
        const rows = tableContent.match(/<tr.*?>([\s\S]*?)<\/tr>/g) || [];
        let mdTable = "\n";
        
        rows.forEach((row, index) => {
          const cells = row.match(/<td.*?>([\s\S]*?)<\/td>|<th.*?>([\s\S]*?)<\/th>/g) || [];
          const mdRow = "| " + cells.map(cell => cell.replace(/<.*?>/g, "").trim()).join(" | ") + " |\n";
          mdTable += mdRow;
          
          // Add separator after the first row
          if (index === 0) {
            mdTable += "| " + cells.map(() => "---").join(" | ") + " |\n";
          }
        });
        
        return mdTable + "\n";
      })
      // Strip remaining tags but keep structure
      .replace(/<p.*?>/g, "\n")
      .replace(/<\/p>/g, "\n")
      .replace(/<br\s*\/?>/g, "\n")
      .replace(/<.*?>/g, "");

    return processed;
  }

  /**
   * Heals tab-separated .doc tables into Markdown pipes
   */
  reconstructTablesFromTabs(text) {
    if (!text) return "";
    
    const lines = text.split("\n");
    let inTable = false;
    const processedLines = lines.map((line, i) => {
      const trimmed = line.trim();
      const tabCount = (line.match(/\t/g) || []).length;
      
      // If a line has 2+ tabs, it's likely a table row
      if (tabCount >= 2) {
        let mdRow = "| " + line.split("\t").map(cell => cell.trim()).filter(c => c.length > 0 || tabCount > 2).join(" | ") + " |";
        
        // If this is the start of a table block, inject a separator after this first row
        if (!inTable) {
          inTable = true;
          // Look ahead: if next lines also have tabs, this is a multi-row table
          return "\n" + mdRow + "\n" + "| " + line.split("\t").map(() => "---").filter(c => c === "---").join(" | ") + " |";
        }
        return mdRow;
      } else {
        inTable = false;
        return line;
      }
    });

    return processedLines.join("\n");
  }

  /**
   * Advanced Text Cleaning: Strips headers, footers, watermarks, and academic noise
   */
  cleanRawText(text, isStructured = false) {
    if (!text) return "";
    
    // 1. Basic unicode & non-printable normalization
    let cleaned = text.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F-\u009F]/g, "");

    // Split into lines to apply row-level filters
    const lines = cleaned.split("\n");
    const filteredLines = lines.filter(line => {
      const trimmed = line.trim();
      if (!trimmed) return false;

      // Skip common divider lines
      if (/^[_\-.\s]{3,}$/.test(trimmed)) return false;

      // Skip lines that are just numbers (Likely page numbers)
      if (/^\s*\d+\s*$/.test(trimmed) || /^\s*Page\s+\d+\s+/i.test(trimmed)) return false;

      // Skip academic noise if NOT a structured table
      if (!isStructured) {
          // Rule: Remove lines shorter than 40 chars unless it looks like a header we want to KEEP
          // (We keep unit headers for the chunker to find, but we'll strip them in the cleaning below)
          if (trimmed.length < 40 && !/^(UNIT|MODULE|CHAPTER)\s+[0-9IVX]+/i.test(trimmed)) {
            return false;
          }
      }

      // Boilerplate & Academic Noise Regex Strip
      const noisePatterns = [
        /HITAM/i,
        /Regulation\s+R(19|20|22)/i,
        /\bR(19|20|22)\b/i,
        /B\.Tech/i,
        /Prepared\s+by/i,
        /Department\s+of/i,
        /\bCO[1-6]\b/i, // CO1, CO2...
        /Bloom's\s+Level/i,
        /\bBL:\s*[1-6]\b/i,
        /References:/i,
        /www\./i,
        /Fig(ure)?\s+\d+(\.\d+)?/i,
        /Copyright\s+.*All\s+rights\s+reserved/i
      ];

      if (noisePatterns.some(pattern => pattern.test(trimmed))) return false;

      return true;
    });

    return filteredLines.join("\n");
  }

  /**
   * Pre-chunk Normalization: Fixes PDF parsing artifacts
   */
  normalizeText(text) {
    if (!text) return "";
    return text
      .replace(/(\w+)-\n(\w+)/g, "$1$2") // Fix hyphenation: "transmis-\nsion" -> "transmission"
      .replace(/(\.)([A-Z])/g, "$1 $2") // Ensure space after period before a new sentence
      .replace(/[ \t]{2,}/g, " ") // Normalize multiple spaces/tabs to single space
      .replace(/\n{3,}/g, "\n\n") // Collapse excessive newlines to double newlines
      .trim();
  }

  /**
   * Triple-Pass OCR: AI Vision (for tables) with Tesseract Safety Net (for size/reliability)
   */
  async performOcr(buffer) {
    const pdfDoc = await PDFDocument.load(buffer);
    const pageCount = pdfDoc.getPageCount();
    let fullText = "";

    console.log("🚀 Starting Global Object Scan...");
    const indirectObjects = pdfDoc.context.enumerateIndirectObjects();
    const images = [];
    
    for (const [ref, obj] of indirectObjects) {
       if (obj instanceof PDFRawStream) {
          const subtype = obj.dict.get(PDFName.of('Subtype'));
          if (subtype === PDFName.of('Image')) {
             const filter = obj.dict.get(PDFName.of('Filter'));
             let mimeType = 'image/png';
             if (filter === PDFName.of('DCTDecode')) mimeType = 'image/jpeg';
             
             images.push({ bytes: obj.contents, mimeType: mimeType });
          }
       }
    }

    console.log(`📸 Found ${images.length} candidate images.`);

    if (images.length === 0) return "";

    const worker = await createWorker('eng');

    try {
      for (let i = 0; i < images.length; i++) {
          const image = images[i];
          console.log(`👁️ Processing Image ${i + 1} of ${images.length}...`);
          
          let transcription = null;
          const base64Image = Buffer.from(image.bytes).toString('base64');
          
          if (base64Image.length < 5000000) {
            transcription = await aiService.performVisionOcr(base64Image, image.mimeType);
          }

          if (!transcription || transcription.includes("[Error")) {
            console.log("🛡️ Cloud extraction failed/skipped. Running local Tesseract...");
            const result = await worker.recognize(Buffer.from(image.bytes));
            transcription = result.data.text;
          }

          // 🧼 New Preprocessing Layer
          const cleanedText = this.cleanOcrNoise(transcription);

          const pageRef = i < pageCount ? i + 1 : 'Global';
          fullText += `\n\n[PAGE_MARKER_${pageRef}]\n\n` + cleanedText;
      }
    } finally {
      await worker.terminate();
    }

    return fullText;
  }

  /**
   * Splits text into overlapping chunks and extracts metadata
   */
  chunkText(text, size = 2500, overlap = 500) {
    if (!text) {
      console.log("⚠️ chunkText received empty/undefined text. Skipping.");
      return [];
    }

    // 1. Detect if the overall text seems structured (Tabular/QB/Lists)
    // Heuristic: Many tabs, pipe characters, or repetitive numeric patterns
    const isStructured = (text.match(/[|\t]/g) || []).length > 10 || 
                         (text.match(/\n\d+[\t. ]/g) || []).length > 5;

    // 2. Run Cleaning & Normalization Pipeline
    let processedText = this.cleanRawText(text, isStructured);
    processedText = this.normalizeText(processedText);

    if (processedText.length < 50) {
       console.log("⚠️ Text reduced too significantly during cleaning. Falling back to raw.");
       processedText = text;
    }

    const chunks = [];
    let currentIndex = 0;
    let currentPage = 1;
    let currentSection = "General";
    let currentPageModule = null;

    while (currentIndex < processedText.length) {
      let nextIndex = currentIndex + size;
      
      if (nextIndex < processedText.length) {
        let breakIndex = nextIndex;
        while (breakIndex > currentIndex && processedText[breakIndex] !== ' ' && processedText[breakIndex] !== '.' && processedText[breakIndex] !== '\n') {
          breakIndex--;
        }
        if (breakIndex > currentIndex) {
          nextIndex = breakIndex;
        }
      }
      
      let rawChunk = processedText.slice(currentIndex, nextIndex).trim();

      // HEURISTIC: Find the latest page marker in the chunk or before it
      let textUpToChunk = processedText.slice(0, nextIndex);
      let pageMatches = [...textUpToChunk.matchAll(/\[PAGE_MARKER_(\d+)\]/g)];
      if (pageMatches.length > 0) {
        currentPage = parseInt(pageMatches[pageMatches.length - 1][1]);
      }

      // Remove page markers from the final chunk text
      let chunkStr = rawChunk.replace(/\[PAGE_MARKER_\d+\]/g, "").trim();

      // Special Content Detection
      let chunkType = isStructured ? "tabular" : "text";
      if (chunkStr.match(/\$\$?.*?\Bonding\$\$?/)) {
        chunkType = "math";
        chunkStr = `[LATEX EQUATION] ${chunkStr}`;
      } else if (chunkStr.match(/\b(def|class|function|import|export|if|for|while|return)\b.*?\{/)) {
        chunkType = "code";
        chunkStr = `[CODE SNIPPET]\n${chunkStr}`;
      }

      // Heuristic Section extraction: look for short, capitalized lines before this chunk
      let sectionMatches = textUpToChunk.slice(Math.max(0, currentIndex - 200), currentIndex).match(/\n([A-Z][A-Za-z\s]{2,40})\n/g);
      if (sectionMatches && sectionMatches.length > 0) {
        currentSection = sectionMatches[sectionMatches.length - 1].trim();
        
        // ✨ Intelligence: Extract Module Number from section title if present
        // Matches: "Module - II", "UNIT 3", "CHAPTER 1", "Module 4"
        const moduleMatch = currentSection.match(/(?:Module|Unit|Chapter)\s+([0-9]+|[IVX]+)/i);
        if (moduleMatch) {
          const val = moduleMatch[1].toUpperCase();
          if (val === "I") currentPageModule = 1;
          else if (val === "II") currentPageModule = 2;
          else if (val === "III") currentPageModule = 3;
          else if (val === "IV") currentPageModule = 4;
          else if (val === "V") currentPageModule = 5;
          else if (!isNaN(parseInt(val))) currentPageModule = parseInt(val);
        }
      }

      if (chunkStr.length > 50) {
        chunks.push({
          text: chunkStr,
          page_number: currentPage,
          section_title: currentSection,
          chunk_type: chunkType,
          is_structured: isStructured,
          module_number: currentPageModule // Now dynamically updated
        });
      }
      
      currentIndex = nextIndex - overlap;
      if (currentIndex < 0) currentIndex = nextIndex; 
    }
    
    return chunks;
  }

  /**
   * Converts all pages of a PDF buffer into an array of image buffers (Base64 ready)
   * High-res 300 DPI / 2480px width ensures table lines and small fonts are clear for VLM.
   */
  async convertToImages(buffer) {
    try {
      const density = 300;
      const width = 2480;
      
      console.log(`📸 Converting PDF to high-quality images (Width: ${width}px, Density: ${density}DPI)...`);
      
      // pdf-img-convert returns an array of Uint8Arrays
      const images = await pdfConverter.convert(buffer, {
        width: width,
        density: density,
      });
      
      console.log(`✅ Converted ${images.length} pages at 300 DPI.`);
      return images.map(img => Buffer.from(img).toString("base64"));
    } catch (error) {
      console.error("❌ PDF-to-Image Conversion Failed:", error);
      throw error;
    }
  }
}

export const pdfService = new PdfService();
