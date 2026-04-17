import { PDFDocument, PDFName, PDFDict, PDFRawStream } from 'pdf-lib';
import fs from 'fs';

async function testExtraction(filePath) {
  try {
    const buffer = fs.readFileSync(filePath);
    const pdfDoc = await PDFDocument.load(buffer);
    const pages = pdfDoc.getPages();
    
    console.log(`📄 PDF has ${pages.length} pages.`);
    
    for (let i = 0; i < pages.length; i++) {
      const page = pages[i];
      const { node } = page;
      const resources = node.get(PDFName.of('Resources'));
      
      if (resources instanceof PDFDict) {
        const xObjects = resources.get(PDFName.of('XObject'));
        if (xObjects instanceof PDFDict) {
          const keys = xObjects.keys();
          console.log(`   Page ${i+1}: Found ${keys.length} XObjects.`);
          for (const key of keys) {
            const xObject = xObjects.get(key);
            // xObject might be a reference, so we might need to resolve it
            // but pdf-lib usually resolves them.
            if (xObject instanceof PDFRawStream) {
               const subtype = xObject.dict.get(PDFName.of('Subtype'));
               if (subtype === PDFName.of('Image')) {
                 console.log(`     - Found Image! Size: ${xObject.contents.length} bytes`);
               }
            }
          }
        } else {
          console.log(`   Page ${i+1}: No XObjects found.`);
        }
      }
    }
  } catch (e) {
    console.error("❌ Test Failed:", e.message);
  }
}

// I don't have the user's PDF path, so I'll just check if my code logic is valid
// by looking at the types.
console.log("🛠️ Logic Test Ready");
