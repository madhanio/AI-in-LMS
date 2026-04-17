import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.join(process.cwd(), 'server', '.env') });

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error("❌ Missing Supabase credentials in server/.env");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function listFiles() {
  console.log("🔍 Fetching uploaded files from Supabase documents table...");
  
  // Get unique subject and filename combinations
  const { data, error } = await supabase
    .from('documents')
    .select('subject, file_name')
    .order('subject', { ascending: true });

  if (error) {
    console.error("❌ Error fetching documents:", error.message);
    return;
  }

  if (!data || data.length === 0) {
    console.log("ℹ️ No files found in the database.");
    return;
  }

  // Deduplicate files (since multiple chunks exist for one file)
  const uniqueFiles = {};
  data.forEach(row => {
    if (!uniqueFiles[row.subject]) {
      uniqueFiles[row.subject] = new Set();
    }
    uniqueFiles[row.subject].add(row.file_name);
  });

  console.log("\n📦 RESULTS:");
  Object.keys(uniqueFiles).forEach(subject => {
    console.log(`\n📂 Subject: ${subject}`);
    uniqueFiles[subject].forEach(file => {
      console.log(`   - ${file}`);
    });
  });
}

listFiles();
