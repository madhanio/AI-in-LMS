import pdfParse from "pdf-parse";

export class PdfService {
  /**
   * Extracts text from PDF buffer
   */
  async extractText(buffer) {
    const data = await pdfParse(buffer);
    return data.text;
  }

  /**
   * Splits text into overlapping chunks
   */
  chunkText(text, size = 500, overlap = 50) {
    const cleanText = text.replace(/\s+/g, " ").trim();
    const chunks = [];
    let currentIndex = 0;

    while (currentIndex < cleanText.length) {
      let nextIndex = currentIndex + size;
      
      if (nextIndex < cleanText.length) {
        // Find a space or period to break cleanly
        let breakIndex = nextIndex;
        while (breakIndex > currentIndex && cleanText[breakIndex] !== ' ' && cleanText[breakIndex] !== '.') {
          breakIndex--;
        }
        if (breakIndex > currentIndex) {
          nextIndex = breakIndex;
        }
      }
      
      chunks.push(cleanText.slice(currentIndex, nextIndex).trim());
      // Move forward by size - overlap to create continuity
      currentIndex = nextIndex - overlap;
      if (currentIndex < 0) currentIndex = nextIndex; // Safety
    }
    
    return chunks.filter(c => c.length > 20); // Filter out tiny fragments
  }
}

export const pdfService = new PdfService();
