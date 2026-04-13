import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import fetch from 'node-fetch'; // Use node-fetch if native fetch isn't available, but we'll try native first or skip

dotenv.config();

const nvidiaKey = process.env.NVIDIA_API_KEY;
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_ANON_KEY;

async function testConnection() {
  console.log("--- Diagnostic Test ---");
  
  // 1. Test Supabase
  console.log("\nTesting Supabase Connection...");
  try {
    const supabase = createClient(supabaseUrl, supabaseKey);
    const { data, error } = await supabase.from('subjects').select('name').limit(1);
    if (error) {
      console.error("❌ Supabase Error:", error.message);
    } else {
      console.log("✅ Supabase Connection Successful!");
      console.log("Subjects found:", data);
    }
  } catch (e) {
    console.error("❌ Supabase Exception:", e.message);
  }

  // 2. Test NVIDIA API
  console.log("\nTesting NVIDIA API Connection...");
  try {
    const response = await fetch("https://integrate.api.nvidia.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${nvidiaKey}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: "google/gemma-4-31b-it",
        messages: [{ role: "user", content: "hi" }],
        max_tokens: 10
      })
    });

    if (response.ok) {
      const data = await response.json();
      console.log("✅ NVIDIA API Connection Successful!");
      console.log("Response:", data.choices[0].message.content);
    } else {
      const errorText = await response.text();
      console.error("❌ NVIDIA API Error:", response.status, errorText);
    }
  } catch (e) {
    console.error("❌ NVIDIA API Exception:", e.message);
  }
}

testConnection();
