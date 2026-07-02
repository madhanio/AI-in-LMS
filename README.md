# 🎓 Moodle AI — RAG-based Academic Mentoring Assistant for Moodle LMS

A RAG (Retrieval-Augmented Generation) pipeline embedded in a Moodle-integrated LMS that answers student queries using uploaded course materials, streams responses token-by-token via SSE, and delivers them through a Flutter mobile app.

---

## 🛠 Tech Stack

- **Backend:** Node.js v20+ ∙ Express ∙ OpenAI SDK ∙ Supabase (pgvector) ∙ pdf-parse ∙ Tesseract.js ∙ mammoth ∙ multer ∙ JWT ∙ PM2
- **Models:** `nvidia/nv-embedqa-e5-v5` (embeddings) ∙ `meta/llama-3.1-8b-instruct` / `llama-3.1-70b-instruct` (NVIDIA NIM LLM)
- **Frontend:** Flutter SDK ^3.10.0 ∙ Provider ∙ Hive (local cache) ∙ http (SSE client) ∙ flutter_markdown ∙ url_launcher

---

## 📁 Folder Structure

- `assets/` - Deployment and pipeline status screenshots for documentation
- `server/` - Node.js ESM Express backend, routes, database services, and table extraction scripts
- `server/public/` - Static assets and administrative single-page dashboard HTML
- `server/services/` - Sub-services managing AI models, Supabase storage, PDF parsing, and logging
- `app/` - Flutter cross-platform mobile application codebase
- `app/lib/` - App state providers, local Hive database models, view screens, and custom widgets

---

## ✅ Features

- **RAG Pipeline:** Extracts text/tables from PDF/DOCX/DOC with Tesseract OCR fallback and vectorizes via NVIDIA NIM.
- **VLM Vision Lane:** Routes tabular PDFs and calendars to NVIDIA Vision LLM for structured event extraction.
- **Intent Classifier:** Routes queries dynamically between vector search, SQL calendar lookup, and LMS service details.
- **Exam Mode Gate:** Restricts student Q&A interactions during scheduled examination windows.
- **Semantic Cache:** Caches recurring calendar questions in-memory to prevent duplicate LLM invocations.
- **Post-Stream Validator:** Detects potential hallucinations post-generation and triggers automatic prompt retries.
- **SSE Streaming:** Delivers token-by-token streaming with typing triggers and active source references.
- **Admin Dashboard:** Supports document uploads, subject management, calendar CRUD, and model configuration.
- **Mobile Chat Interface:** Streamed chat interface with Markdown layout, history persistence, and source document linking.

---

## 🏗 Architecture Flow

1. **Student Query:** Student asks a question via the Flutter application chat screen.
2. **Intent Classification:** Backend classifies query intent (`concept_explanation`, `calendar_query`, or `student_data_query`).
3. **Retrieval Search:** System executes pgvector similarity search, SQL calendar lookup, or LMS API retrieval.
4. **LLM Generation:** NVIDIA NIM LLM synthesizes an answer using the retrieved context.
5. **Client SSE Stream:** Flutter receives token-by-token server-sent events (SSE) and displays them in real-time.

---

## ⚙️ Local Setup

### Backend Environment Variables (`server/.env`)
```env
PORT=3000
NVIDIA_API_KEY=your_nvidia_api_key
NVIDIA_VISION_KEY=your_nvidia_vision_key
SUPABASE_URL=your_supabase_project_url
SUPABASE_ANON_KEY=your_supabase_anon_key
ADMIN_USER=admin
ADMIN_PASSWORD=your_admin_password
JWT_SECRET=your_jwt_signing_secret
EXAM_MODE_START=ISO8601_start_datetime
EXAM_MODE_END=ISO8601_end_datetime
LMS_API_URL=optional_real_lms_endpoint
```

### Setup Commands
```bash
# Start Backend
cd server && npm install && npm run dev

# Start Flutter App
cd app && flutter pub get && flutter pub run build_runner build --delete-conflicting-outputs && flutter run
```

---

## 🔌 API Routes

- **Auth:** `POST /api/login` ∙ `POST /api/logout` ∙ `GET /api/check-auth`
- **Subjects & Files:** `GET /api/files` ∙ `POST /api/upload` ∙ `DELETE /api/files/:subject/:id` ∙ `GET /api/subjects` ∙ `POST /api/subjects` ∙ `PATCH /api/subjects/:oldName` ∙ `DELETE /api/subjects/:name`
- **Query:** `POST /api/query` (SSE)
- **Calendar:** `GET /api/calendar/events` ∙ `POST /api/calendar/events` ∙ `PATCH /api/calendar/events/:id` ∙ `DELETE /api/calendar/events/:id` ∙ `DELETE /api/calendar/purge`
- **LMS Integration:** `GET /api/lms/attendance` ∙ `GET /api/lms/timetable` ∙ `GET /api/lms/deadlines` ∙ `GET /api/lms/exams` ∙ `GET /api/lms/exam-mode`
- **Settings & Prompts:** `GET /api/settings/model` ∙ `POST /api/settings/model` ∙ `GET /api/prompts`
- **Non-API:** `GET /admin` (Dashboard SPA) ∙ `GET /health` (Health check)

---

## 🚀 Deployment

Deployed live on **AWS EC2** with a full CI/CD pipeline (GitHub Webhook → Jenkins → pm2).

### CI/CD Pipeline

GitHub push on `main` triggers a webhook to Jenkins, which runs: Checkout → npm install → pm2 reload → Health Check. Full pipeline completes in ~14 seconds.

### Screenshots

**Webhook — Last delivery successful**
![Webhook Status](assets/webhook-connection-status.png)

**Jenkins Pipeline — Stage View (avg ~14s full run)**
![Deploy Status](assets/deploy-status.png)

**pm2 Cluster — 2 instances online on EC2 + health check confirmed**
![PM2 Status](assets/pm2-status.png)

### PM2 Configuration

The backend runs in **cluster mode** via `ecosystem.config.cjs`:

```js
module.exports = {
  apps: [{
    name: "moodle-ai-backend",
    script: "./index.js",
    instances: "max",
    exec_mode: "cluster",
    autorestart: true,
    max_memory_restart: "450M",
    env: {
      NODE_ENV: "production",
      PORT: 3000
    }
  }]
};
```

---

