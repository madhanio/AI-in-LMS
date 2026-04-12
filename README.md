# AI-in-LMS: Academic Mentor Monorepo

Welcome to the **AI-in-LMS** monorepo! This project is a state-of-the-art Academic Mentor that utilizes Retrieval-Augmented Generation (RAG) to provide intelligent, strictly context-bound answers from study materials (PDFs).

## Project Structure

This monorepo unifies the frontend (mobile/web) and the backend (API/AI execution) into a single, cohesive repository:

```
moodle-AI-main/
├── app/            # Flutter Frontend 
│                   # (Dart/Flutter application for students)
├── server/         # Node.js Express Backend
│                   # (NVIDIA API integration, Supabase, PDF processing)
└── README.md       # This file
```

## System Architecture

The frontend (`app/`) connects to the backend (`server/`) via standard REST and Server-Sent Event (SSE) streams. 

When a student queries the chatbot in the Flutter frontend, the signal is sent to the backend. The backend expands the query using Google Gemma, calculates nearest-neighbor semantic similarity matching across pre-embedded knowledge fragments in Supabase, extracts the context, and creates a live token-stream back to the student's device. 

The backend also acts as an Admin Dashboard (`http://localhost:3000/admin`) where faculty can drop PDFs and instantly generate knowledge embeddings.

---

## 🚀 Setup Steps

### 1. Setting up the Backend (`server/`)

This acts as the bridge to NVIDIA Inference and Supabase.

1. **Navigate to the server directory**:
   ```bash
   cd server
   ```
2. **Install dependencies**:
   ```bash
   npm install
   ```
3. **Configure Environment Variables**:
   Ensure you have a `.env` file in the `server/` directory containing your keys:
   ```env
   PORT=3000
   NVIDIA_API_KEY=your_nvidia_key
   SUPABASE_URL=your_supabase_url
   SUPABASE_ANON_KEY=your_supabase_anon_key
   ```
4. **Boot the Node server**:
   ```bash
   node index.js
   # Or npm run dev if nodemon is configured
   ```

### 2. Setting up the Frontend (`app/`)

This is the student-facing user interface for Web/Mobile.

1. **Navigate to the flutter directory**:
   ```bash
   cd app
   ```
2. **Fetch all Pub dependencies**:
   ```bash
   flutter pub get
   ```
3. **Run your preferred platform**:
   - For web: `flutter run -d chrome`
   - For emulator: `flutter run`

**Note on Connection:**
By default, the `app/lib/ai_chat_screen.dart` may point to a production-hosted API (e.g., Render). If you are running the backend locally to test modifications, update the `_baseUrl` string in that Dart file to `http://localhost:3000/api`.
