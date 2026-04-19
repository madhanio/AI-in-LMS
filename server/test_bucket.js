import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY);

async function checkBucket() {
    console.log("Checking bucket...");
    const { data, error } = await supabase.storage.getBucket('materials');
    if (error) {
        console.log("Bucket not found, attempting to create...");
        const { data: newBucket, error: createError } = await supabase.storage.createBucket('materials', { public: true });
        if (createError) {
            console.error("Failed to create bucket:", createError.message);
        } else {
            console.log("Bucket created successfully!");
        }
    } else {
        console.log("Bucket already exists!");
    }
}

checkBucket();
