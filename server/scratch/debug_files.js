import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.join(process.cwd(), 'server', '.env') });

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function debugFiles() {
  const { data, error } = await supabase
    .from('documents')
    .select('subject, file_name')
    .limit(50);

  if (error) {
    console.error("❌ Supabase Error:", error.message);
    return;
  }

  console.log("📄 Document Table Sample:");
  console.table(data);

  const subjects = [...new Set(data.map(d => d.subject))];
  console.log("\n🧪 Unique Subjects Found:", subjects);
}

debugFiles();
