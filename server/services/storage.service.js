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
  /**
   * Fetch all subjects from the database
   */
  async getSubjects() {
    const { data, error } = await supabase
      .from('subjects')
      .select('name')
      .order('name', { ascending: true });

    if (error) {
      console.error("Error fetching subjects:", error);
      return [];
    }
    // Filter out internal system subjects like __CALENDAR__
    return data.map(s => s.name).filter(name => !name.startsWith('__'));
  }

  /**
   * Add a new subject
   */
  async addSubject(name) {
    const { error } = await supabase
      .from('subjects')
      .insert([{ name }]);
    
    if (error && error.code !== '23505') { // Ignore duplicate errors
      throw error;
    }
    return true;
  }

  /**
   * Delete a subject and all its related documents
   */
  async deleteSubject(name) {
    // 1. Delete all documents related to this subject
    await supabase
      .from('documents')
      .delete()
      .eq('subject', name);

    // 2. Delete the subject itself
    const { error } = await supabase
      .from('subjects')
      .delete()
      .eq('name', name);

    if (error) throw error;
    return true;
  }

  async getFiles() {
    // 1. Get all subject names
    const subjectList = await this.getSubjects();
    
    // 2. Get all document metadata
    const { data, error } = await supabase
      .from('documents')
      .select('subject, file_name, id')
      .order('id', { ascending: false });

    if (error) {
       console.error("Supabase fetch error:", error);
       return {};
    }

    // Initialize with all subjects (even empty ones)
    const subjects = {};
    subjectList.forEach(s => subjects[s] = []);

    // Group files by subject
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
      embedding: chunk.embedding,
      page_number: chunk.page_number || null,
      section_title: chunk.section_title || null,
      chunk_type: chunk.chunk_type || 'text'
    }));

    // Insert in batches of 50 to avoid Supabase limits on large PDFs
    const BATCH_SIZE = 50;
    for (let i = 0; i < rows.length; i += BATCH_SIZE) {
        const batch = rows.slice(i, i + BATCH_SIZE);
        const { error } = await supabase
          .from('documents')
          .insert(batch);
        if (error) throw error;
    }

    return true;
  }

  async deleteFile(subject, fileId) {
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

  async getAllChunks(filterSubjects = null) {
    let query = supabase.from('documents').select('content, embedding, page_number, section_title, file_name, chunk_type');
    
    if (filterSubjects) {
      if (Array.isArray(filterSubjects)) {
        query = query.in('subject', filterSubjects);
      } else {
        query = query.eq('subject', filterSubjects);
      }
    }
    
    // Support large subjects by increasing limit or paginating eventually, but 10k is fine for now
    const { data, error } = await query.limit(10000);
    if (error) {
      console.error("Supabase fetch all chunks error:", error);
      return [];
    }
    
    return data.map(d => ({ 
      text: d.content, 
      embedding: typeof d.embedding === 'string' ? JSON.parse(d.embedding) : d.embedding,
      page_number: d.page_number,
      section_title: d.section_title,
      file_name: d.file_name,
      chunk_type: d.chunk_type
    }));
  }

  async logQuery(question, retrievedChunksCount, avgSimilarity, responseTimeMs, subject) {
    try {
      await supabase.from('analytics').insert([{
        question,
        retrieved_chunks: retrievedChunksCount,
        avg_similarity: avgSimilarity,
        response_time_ms: responseTimeMs,
        subject: subject || 'global'
      }]);
    } catch (error) {
      console.error("Failed to log query analytics:", error);
    }
  }
}

export const storageService = new StorageService();
