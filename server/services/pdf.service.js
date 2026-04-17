import pdfParse from "pdf-parse";
import { PDFDocument, PDFName, PDFDict, PDFRawStream } from "pdf-lib";
import { aiService } from "./ai.service.js";

export class PdfService {
  /**
   * Extracts text from PDF buffer and injects page markers.
   * Now includes HIGH-ACCURACY AI Vision fallback for scanned documents!
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

    // 2. AI Vision Fallback: If text is suspiciously small (scanned image)
    if (text.trim().length < 100) {
      console.log("🧩 Scanned PDF detected. Triggering High-Accuracy AI Vision Engine...");
      try {
        const ocrText = await this.performOcr(buffer);
        if (ocrText.trim().length > 0) {
           text = ocrText;
        }
      } catch (ocrError) {
        console.error("❌ Vision Fallback Failed:", ocrError);
      }
    }

    return text;
  }

  /**
   * AI Vision OCR: Extracts images and sends to Vision LLM
   */
  async performOcr(buffer) {
    const pdfDoc = await PDFDocument.load(buffer);
    const pages = pdfDoc.getPages();
    let fullText = "";

    for (let i = 0; i < pages.length; i++) {
        console.log(`👁️ Analyzing Page ${i + 1} of ${pages.length}...`);
        const page = pages[i];
        const resources = page.node.get(PDFName.of('Resources'));
        
        if (resources instanceof PDFDict) {
          const xObjects = resources.get(PDFName.of('XObject'));
          if (xObjects instanceof PDFDict) {
            const keys = xObjects.keys();
            for (const key of keys) {
              const xObject = xObjects.get(key);
              
              // Handle potential direct or indirect references
              const stream = xObject instanceof PDFRawStream ? xObject : 
                             (xObject instanceof PDFDict ? xObject : null);
              
              if (stream) {
                const subtype = stream instanceof PDFRawStream ? stream.dict.get(PDFName.of('Subtype')) : stream.get(PDFName.of('Subtype'));
                
                if (subtype === PDFName.of('Image')) {
                  const filter = stream instanceof PDFRawStream ? stream.dict.get(PDFName.of('Filter')) : stream.get(PDFName.of('Filter'));
                  let mimeType = 'image/png';
                  if (filter === PDFName.of('DCTDecode')) mimeType = 'image/jpeg';
                  
                  const imageBytes = stream instanceof PDFRawStream ? stream.contents : null;
                  if (imageBytes) {
                    const base64Image = Buffer.from(imageBytes).toString('base64');
                    const transcription = await aiService.performVisionOcr(base64Image, mimeType);
                    fullText += `\n\n[PAGE_MARKER_${i + 1}]\n\n` + transcription;
                  }
                }
              }
            }
          }
        }
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
