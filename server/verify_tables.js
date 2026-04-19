import { PdfService } from './services/pdf.service.js';
import fs from 'fs';
import path from 'path';

async function testTableExtraction() {
  const service = new PdfService();
  const testFile = 'node_modules/mammoth/test/test-data/tables.docx';
  
  if (!fs.existsSync(testFile)) {
    console.error('Test file not found:', testFile);
    return;
  }

  const buffer = fs.readFileSync(testFile);
  const text = await service.docxToText(buffer);
  
  console.log('--- EXTRACTED MARKDOWN TABLES ---');
  console.log(text);
  console.log('--------------------------------');
  
  const hasPipes = text.includes('|');
  const hasSeparator = text.includes('| ---');
  
  console.log('Pipes Detected:', hasPipes);
  console.log('Separator Detected:', hasSeparator);
}

testTableExtraction();
