import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.warn("Missing Supabase credentials! Please set SUPABASE_URL and SUPABASE_ANON_KEY in .env");
}

const supabase = createClient(supabaseUrl || "", supabaseKey || "");

export class StorageService {
  async getFiles() {
    // Group files by subject based on documents in Supabase
    const { data, error } = await supabase
      .from('documents')
      .select('subject, file_name, id')
      .order('id', { ascending: false });

    if (error) {
      console.error("Supabase fetch error:", error);
      return {};
    }

    const subjects = {
      "Computer networks(CN)": [],
      "Constituion of India(CoI)": [],
      "Introduction to data science(IDS)": [],
      "object oriented programming using Java(OOPJ)": [],
      "Software engineering(SE)": [],
      "Statistical and mathematical foundations(SMF)": []
    };

    // To remove duplicate fileNames conceptually per subject, we group them
    const fileMap = new Map();
    data.forEach(row => {
      const key = `${row.subject}-${row.file_name}`;
      if (!fileMap.has(key)) {
        if (!subjects[row.subject]) {
          subjects[row.subject] = [];
        }
        subjects[row.subject].push({
          id: row.id.toString(),
          fileName: row.file_name,
        });
        fileMap.set(key, true);
      }
    });

    return subjects;
  }

  async addFile(subject, fileName, chunksWithEmbeds) {
    const rows = chunksWithEmbeds.map(chunk => ({
      subject,
      file_name: fileName,
      content: chunk.text,
      embedding: chunk.embedding
    }));

    // Batch insert into Supabase
    const { data, error } = await supabase
      .from('documents')
      .insert(rows)
      .select('id, file_name, subject');

    if (error) {
      console.error("Supabase insert error:", error);
      throw error;
    }

    return true;
  }

  async deleteFile(subject, fileId) {
    // the fileId passed here is actually the ID from the query, 
    // but originally we deleted by matching the exact file_name.
    // Let's first get the file_name for this id
    const { data: doc } = await supabase
      .from('documents')
      .select('file_name')
      .eq('id', fileId)
      .single();
      
    if (doc) {
      const { error } = await supabase
        .from('documents')
        .delete()
        .eq('file_name', doc.file_name)
        .eq('subject', subject);
        
      if (!error) return true;
    }
    return false;
  }

  // Fallback to fetch all subject chunks if RPC is not used
  async getAllChunks(filterSubject = null) {
    let query = supabase.from('documents').select('content, embedding');
    if (filterSubject) {
      query = query.eq('subject', filterSubject);
    }
    
    // Supabase sets limit default to 1000 items, let's bump it up for larger PDFs
    const { data, error } = await query.limit(10000);
    
    if (error) {
      console.error("Supabase fetch all chunks error:", error);
      return [];
    }
    
    return data.map(d => ({ text: d.content, embedding: JSON.parse(d.embedding) }));
  }
}

export const storageService = new StorageService();
