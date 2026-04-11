import fs from 'fs';
import path from 'path';

const DB_PATH = path.resolve('db.json');

const INITIAL_STATE = {
  subjects: {
    "Computer networks(CN)": [],
    "Constituion of India(CoI)": [],
    "Introduction to data science(IDS)": [],
    "object oriented programming using Java(OOPJ)": [],
    "Software engineering(SE)": [],
    "Statistical and mathematical foundations(SMF)": []
  }
};

export class StorageService {
  constructor() {
    this.data = this._load();
  }

  _load() {
    if (fs.existsSync(DB_PATH)) {
      try {
        const content = fs.readFileSync(DB_PATH, 'utf-8');
        return JSON.parse(content);
      } catch (err) {
        console.error("Error reading db.json, resetting to initial state", err);
        return INITIAL_STATE;
      }
    }
    return INITIAL_STATE;
  }

  _save() {
    fs.writeFileSync(DB_PATH, JSON.stringify(this.data, null, 2), 'utf-8');
  }

  getFiles() {
    return this.data.subjects;
  }

  addFile(subject, fileName, chunks) {
    if (!this.data.subjects[subject]) {
      this.data.subjects[subject] = [];
    }

    // Check for deduplication
    const existingIndex = this.data.subjects[subject].findIndex(f => f.fileName === fileName);
    const fileData = {
      id: Date.now().toString(),
      fileName,
      uploadedAt: new Date().toISOString(),
      chunks
    };

    if (existingIndex > -1) {
      this.data.subjects[subject][existingIndex] = fileData;
    } else {
      this.data.subjects[subject].push(fileData);
    }

    this._save();
    return fileData;
  }

  deleteFile(subject, fileId) {
    if (!this.data.subjects[subject]) return false;
    
    const initialLength = this.data.subjects[subject].length;
    this.data.subjects[subject] = this.data.subjects[subject].filter(f => f.id !== fileId);
    
    if (this.data.subjects[subject].length !== initialLength) {
      this._save();
      return true;
    }
    return false;
  }

  getAllChunks(filterSubject = null) {
    let allChunks = [];
    
    const subjectsToSearch = filterSubject 
      ? [filterSubject] 
      : Object.keys(this.data.subjects);

    for (const sub of subjectsToSearch) {
      if (this.data.subjects[sub]) {
        for (const file of this.data.subjects[sub]) {
          allChunks = allChunks.concat(file.chunks);
        }
      }
    }
    return allChunks;
  }
}

export const storageService = new StorageService();
