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
    return data.map(s => s.name);
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
      embedding: chunk.embedding
    }));

    const { error } = await supabase
      .from('documents')
      .insert(rows);

    if (error) throw error;
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

  async getAllChunks(filterSubject = null) {
    let query = supabase.from('documents').select('content, embedding');
    if (filterSubject) {
      query = query.eq('subject', filterSubject);
    }
    
    const { data, error } = await query.limit(10000);
    if (error) {
      console.error("Supabase fetch all chunks error:", error);
      return [];
    }
    
    return data.map(d => ({ 
      text: d.content, 
      embedding: typeof d.embedding === 'string' ? JSON.parse(d.embedding) : d.embedding 
    }));
  }
}

export const storageService = new StorageService();
