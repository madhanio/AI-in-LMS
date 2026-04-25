import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import crypto from 'crypto';
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

  /**
   * Rename a subject and update all related document references
   */
  async renameSubject(oldName, newName) {
    if (!oldName || !newName || oldName === newName) return true;

    // 1. Update the subject name in the 'subjects' table
    const { error: subError } = await supabase
      .from('subjects')
      .update({ name: newName })
      .eq('name', oldName);

    if (subError) throw subError;

    // 2. Cascade rename to 'documents' table
    const { error: docError } = await supabase
      .from('documents')
      .update({ subject: newName })
      .eq('subject', oldName);

    if (docError) console.warn("Failed to update some document references:", docError);

    // 3. Cascade rename to 'syllabus_files' table
    const { error: sylError } = await supabase
      .from('syllabus_files')
      .update({ subject: newName })
      .eq('subject', oldName);

    if (sylError) console.warn("Failed to update some syllabus file references:", sylError);

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

    // Initialize with all subjects (and ensure __CALENDAR__ exists even if not in subject table)
    const subjects = { '__CALENDAR__': [] };
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

  async addFile(subject, fileName, chunksWithEmbeds, metadata = {}) {
    if (subject === '__CALENDAR__' && chunksWithEmbeds.length === 0) {
       console.log("⚠️ Ignoring empty calendar sync to avoid data loss.");
       return false;
    }

    // 1. Generate hashes and prepare rows
    const rows = chunksWithEmbeds.map(chunk => {
      const hash = crypto.createHash('md5').update(chunk.text).digest('hex');
      return {
        subject,
        file_name: fileName,
        content: chunk.text,
        embedding: chunk.embedding,
        page_number: chunk.page_number || null,
        section_title: chunk.section_title || null,
        chunk_type: chunk.chunk_type || 'text',
        doc_type: metadata.docType || 'MODULE_RESOURCE',
        module_number: metadata.moduleNumber || null,
        part_number: metadata.partNumber || null,
        chunk_hash: hash,
        is_structured: chunk.is_structured || false
      };
    });

    // 2. Fetch existing hashes for this subject to prevent duplicates
    const { data: existingHashes } = await supabase
      .from('documents')
      .select('chunk_hash')
      .eq('subject', subject);
    
    const existingSet = new Set((existingHashes || []).map(h => h.chunk_hash));

    // 3. Filter out duplicates
    const uniqueRows = rows.filter(row => !existingSet.has(row.chunk_hash));
    
    if (uniqueRows.length === 0) {
      console.log(`♻️ All ${rows.length} chunks from ${fileName} are duplicates. Skipping insertion.`);
      return true;
    }

    if (uniqueRows.length < rows.length) {
      console.log(`✂️ Deduplicated: ${rows.length - uniqueRows.length} redundant chunks removed.`);
    }

    // 4. Insert in batches of 50 to avoid Supabase limits on large PDFs
    const BATCH_SIZE = 50;
    for (let i = 0; i < uniqueRows.length; i += BATCH_SIZE) {
        const batch = uniqueRows.slice(i, i + BATCH_SIZE);
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

  /**
   * Upload raw PDF to Supabase Storage Bucket
   */
  async uploadRawFile(fileName, buffer, subject, metadata = {}) {
    const bucketName = 'academic_materials';
    // Clean filename for URL safety
    const safeName = fileName.replace(/[^a-zA-Z0-9.\-_]/g, '_');
    const path = `${subject ? subject.replace(/[^a-zA-Z0-9]/g, '') : 'global'}/${Date.now()}_${safeName}`;

    let contentType = 'application/pdf';
    if (fileName.endsWith('.docx')) {
      contentType = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
    } else if (fileName.endsWith('.doc')) {
      contentType = 'application/msword';
    }

    const { data: uploadData, error: uploadError } = await supabase.storage
      .from(bucketName)
      .upload(path, buffer, {
        contentType: contentType,
        upsert: true
      });

    if (uploadError) {
      console.error("Supabase Storage Upload Error:", uploadError);
      return null;
    }

    const { data: publicUrlData } = supabase.storage.from(bucketName).getPublicUrl(path);
    const publicUrl = publicUrlData.publicUrl;

    // Attempt to insert metadata into syllabus_files
    try {
      await supabase.from('syllabus_files').insert([{
        filename: fileName,
        bucket_path: path,
        public_url: publicUrl,
        subject: subject,
        doc_type: metadata.docType || 'MODULE_RESOURCE',
        module_number: metadata.moduleNumber || null,
        part_number: metadata.partNumber || null
      }]);
    } catch (e) {
      console.warn("Could not insert into syllabus_files. Ensure table exists.", e);
    }

    return publicUrl;
  }

  async getAllChunks(filterSubjects = null) {
    let query = supabase.from('documents').select('content, embedding, page_number, section_title, file_name, chunk_type, doc_type, module_number, part_number, is_structured');
    
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
      chunk_type: d.chunk_type,
      doc_type: d.doc_type,
      module_number: d.module_number,
      part_number: d.part_number,
      is_structured: d.is_structured
    }));
  }

  /**
   * Fast lookup to get public URLs for injected chunks
   */
  async getFileUrls(fileNames) {
    if (!fileNames || fileNames.length === 0) return {};
    
    // Fetch distinct filenames and their urls from syllabus_files
    const { data, error } = await supabase
      .from('syllabus_files')
      .select('filename, public_url')
      .in('filename', fileNames);

    if (error) {
      console.warn("Failed to fetch file URLs:", error);
      return {};
    }

    const urlMap = {};
    data.forEach(row => {
      urlMap[row.filename] = row.public_url;
    });
    return urlMap;
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

  /**
   * Save structured calendar events
   */
  async saveCalendarEvents(events) {
    if (!events || events.length === 0) return true;
    
    const { error } = await supabase
      .from('calendar_events')
      .insert(events);
      
    if (error) {
      console.error("Supabase Calendar Insert Error:", error);
      throw error;
    }
    return true;
  }

  /**
   * Query calendar events using keywords
   */
  async searchCalendarEvents(question) {
    // 💡 TIER 3: ROBUST SQL LOOKUP (Fix: Including 3-letter academic keywords)
    const academicKeys = ['mid', 'sem', 'lab', 'see', 'cie', '1st', '2nd', '3rd', '4th'];
    const words = question.toLowerCase()
      .split(/[\s,.-]+/)
      .filter(w => w.length > 3 || academicKeys.includes(w));
    
    let query = supabase.from('calendar_events').select('*');
    
    if (words.length > 0) {
      // Build a multi-keyword OR filter for the top relevant terms
      const filterConditions = words.slice(0, 5).map(w => 
        `event_name.ilike.%${w}%,semester.ilike.%${w}%`
      ).join(',');

      const { data, error } = await query
        .or(filterConditions)
        .order('date_from', { ascending: true })
        .limit(15);
        
      if (error) {
        console.error("Supabase Calendar Search Error:", error);
        return [];
      }
      return data;
    }

    // Default: Return upcoming events
    const { data: upcoming, error: upcomingError } = await query
      .gte('date_from', new Date().toISOString().split('T')[0])
      .order('date_from', { ascending: true })
      .limit(10);
      
    return upcoming || [];
  }

  async getCalendarEvents() {
    const { data, error } = await supabase
      .from('calendar_events')
      .select('*')
      .order('date_from', { ascending: true });
    if (error) throw error;
    return data;
  }

  async updateCalendarEvent(id, updates) {
    const { error } = await supabase
      .from('calendar_events')
      .update(updates)
      .eq('id', id);
    if (error) throw error;
    return true;
  }

  async deleteCalendarEvent(id) {
    const { error } = await supabase
      .from('calendar_events')
      .delete()
      .eq('id', id);
    if (error) throw error;
    return true;
  }

  /**
   * PURGE LEGACY DATA
   * Wipes out messy OCR chunks from previous attempts to stop AI confusion.
   */
  async purgeLegacyCalendarData() {
    console.log("🔥 Purging Legacy Calendar Chunks...");
    const { error } = await supabase
      .from('documents')
      .delete()
      .eq('subject', '__CALENDAR__');
    
    if (error) throw error;
    return true;
  }
}

export const storageService = new StorageService();
