import pdfParse from "pdf-parse";
import { PDFDocument } from "pdf-lib";
import { createWorker } from "tesseract.js";

export class PdfService {
  /**
   * Extracts text from PDF buffer and injects page markers.
   * Now includes AI OCR fallback for scanned documents!
   */
  async extractText(buffer) {
    // 1. Try standard extraction first
    const render_page = (pageData) => {
      let render_options = { normalizeWhitespace: false, disableCombineTextItems: false };
      return pageData.getTextContent(render_options).then(function(textContent) {
        let text = '';
        let lastY = null;
        for (let item of textContent.items) {
          if (lastY == item.transform[5] || !lastY) {
            text += item.str;
          } else {
            text += '\n' + item.str;
          }
          lastY = item.transform[5];
        }
        return `\n\n[PAGE_MARKER_${pageData.pageIndex + 1}]\n\n` + text;
      });
    };

    const data = await pdfParse(buffer, { pagerender: render_page });
    let text = data.text || "";

    // 2. OCR Fallback: If text is suspiciously small (likely a scanned image)
    if (text.trim().length < 100) {
      console.log("🧩 Empty/Scanned PDF detected. Triggering AI OCR fallback...");
      try {
        text = await this.performOcr(buffer);
      } catch (ocrError) {
        console.error("❌ OCR Fallback Failed:", ocrError);
      }
    }

    return text;
  }

  /**
   * Pure JS OCR implementation using Tesseract
   */
  async performOcr(buffer) {
    const pdfDoc = await PDFDocument.load(buffer);
    const pageCount = pdfDoc.getPageCount();
    let fullText = "";

    // Initialize Tesseract Worker
    const worker = await createWorker('eng');

    try {
      for (let i = 0; i < pageCount; i++) {
        console.log(`👁️ Scanning Page ${i + 1} of ${pageCount}...`);
        const page = pdfDoc.getPage(i);
        
        // Deep Dive: Scanned PDFs usually have one large Image object per page
        // We'll extract all images from this page and OCR them.
        const pageResources = page.node.Resources();
        const xObjects = pageResources ? pageResources.get(PDFDocument.name('XObject')) : null;
        
        if (xObjects) {
          const keys = xObjects.keys();
          for (const key of keys) {
            const xObject = xObjects.get(key);
            // Check if it's an Image
            if (xObject.get(PDFDocument.name('Subtype')).value === 'Image') {
              const imageBytes = xObject.contents;
              const { data: { text } } = await worker.recognize(Buffer.from(imageBytes));
              fullText += `\n\n[PAGE_MARKER_${i + 1}]\n\n` + text;
            }
          }
        }
      }
    } finally {
      await worker.terminate();
    }

    return fullText;
  }

  /**
   * Splits text into overlapping chunks and extracts metadata
   */
  chunkText(text, size = 1000, overlap = 200) {
    // We clean spaces but keep track of pages
    const chunks = [];
    let currentIndex = 0;
    
    // We can run a state machine to track the current page.
    let currentPage = 1;
    let currentSection = "General";

    // Split text into tokens/words to better handle the page markers
    // But since we want raw character overlap, let's track the nearest page marker.
    
    // Remove multiple spaces but allow newlines/markers to stand
    const cleanText = text.replace(/ {2,}/g, " ").trim();

    while (currentIndex < cleanText.length) {
      let nextIndex = currentIndex + size;
      
      if (nextIndex < cleanText.length) {
        let breakIndex = nextIndex;
        while (breakIndex > currentIndex && cleanText[breakIndex] !== ' ' && cleanText[breakIndex] !== '.' && cleanText[breakIndex] !== '\n') {
          breakIndex--;
        }
        if (breakIndex > currentIndex) {
          nextIndex = breakIndex;
        }
      }
      
      let rawChunk = cleanText.slice(currentIndex, nextIndex).trim();

      // HEURISTIC: Find the latest page marker in the chunk or before it
      // Let's find all markers up to nextIndex
      let textUpToChunk = cleanText.slice(0, nextIndex);
      let pageMatches = [...textUpToChunk.matchAll(/\[PAGE_MARKER_(\d+)\]/g)];
      if (pageMatches.length > 0) {
        currentPage = parseInt(pageMatches[pageMatches.length - 1][1]);
      }

      // Remove page markers from the final chunk text so the LLM doesn't see them as noise
      let chunkStr = rawChunk.replace(/\[PAGE_MARKER_\d+\]/g, "").trim();

      // Special Content Detection
      let chunkType = "text";
      if (chunkStr.match(/\$\$?.*?\$\$?/)) {
        chunkType = "math";
        chunkStr = `[LATEX EQUATION] ${chunkStr}`;
      } else if (chunkStr.match(/\b(def|class|function|import|export|if|for|while|return)\b.*?\{/)) {
        chunkType = "code";
        chunkStr = `[CODE SNIPPET]\n${chunkStr}`;
      }

      // Heuristic Section extraction: look for short, capitalized lines before this chunk in recent history
      let sectionMatches = textUpToChunk.slice(Math.max(0, currentIndex - 200), currentIndex).match(/\n([A-Z][A-Za-z\s]{2,40})\n/g);
      if (sectionMatches && sectionMatches.length > 0) {
        currentSection = sectionMatches[sectionMatches.length - 1].trim();
      }

      if (chunkStr.length > 20) {
        chunks.push({
          text: chunkStr,
          page_number: currentPage,
          section_title: currentSection,
          chunk_type: chunkType
        });
      }
      
      currentIndex = nextIndex - overlap;
      if (currentIndex < 0) currentIndex = nextIndex; 
    }
    
    return chunks;
  }
}

export const pdfService = new PdfService();
