import WordExtractor from 'word-extractor';
import fs from 'fs';
import path from 'path';

async function debugDoc() {
  try {
    const filePath = 'c:\\Users\\Admin\\Desktop\\madhan\\moodle-AI-main\\MID-1.doc';
    const extractor = new WordExtractor();
    const doc = await extractor.extract(fs.readFileSync(filePath));
    const text = doc.getBody();
    
    console.log('--- RAW TEXT START ---');
    console.log(text);
    console.log('--- RAW TEXT END ---');
    
    // Check for specific markers like tabs
    const hasTabs = text.includes('\t');
    console.log('Contains Tabs:', hasTabs);
    
    // Look at some lines around potential tables
    const lines = text.split('\n');
    console.log('Sample Lines (JSON representation):');
    lines.filter(l => l.trim().length > 0).slice(0, 50).forEach((line, i) => {
      console.log(`${i}: ${JSON.stringify(line)}`);
    });

  } catch (error) {
    console.error('Error debugging doc:', error);
  }
}

debugDoc();
