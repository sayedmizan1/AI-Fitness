# FitMentor AI — README

A full-stack AI-powered virtual fitness trainer.

## 🚀 Quick Start

### 1. Backend Setup

```bash
cd backend
python -m venv venv
venv\Scripts\activate          # Windows
pip install -r requirements.txt

# Copy and configure environment
copy .env.example .env
# Edit .env → add GOOGLE_API_KEY and GROQ_API_KEY

# Start the API server
uvicorn main:app --reload --port 8000
```

### 2. Seed RAG Knowledge Base (one-time)

```bash
cd backend
python -m ai.rag.document_loader
```

### 3. Frontend Setup

```bash
cd frontend
npm install
npm run dev
# Opens at http://localhost:5173
```

---

## 🔑 API Keys Required

| Key | Where to get |
|---|---|
| `GOOGLE_API_KEY` | [Google AI Studio](https://aistudio.google.com/app/apikey) |
| `GROQ_API_KEY` | [Groq Console](https://console.groq.com/keys) |

Add both to `backend/.env`.

---

## 🏗️ Project Structure

```
fitmentor-ai/
├── backend/               # FastAPI Python backend
│   ├── main.py            # App entry point
│   ├── database.py        # SQLite + SQLAlchemy
│   ├── models/            # Database models
│   ├── schemas/           # Pydantic schemas
│   ├── routers/           # API routes
│   ├── middleware/        # JWT auth
│   └── websocket/         # Pose WebSocket handler
├── ai/                    # AI layer
│   ├── pose/              # MediaPipe engine + joint angles
│   ├── exercises/         # Exercise recognition + rep counter
│   ├── form/              # Form analyzer
│   ├── rag/               # ChromaDB + Gemini embeddings
│   └── agents/            # LangGraph multi-agent system
└── frontend/              # React + TypeScript + Tailwind
    └── src/
        ├── pages/         # 6 pages (Landing, Login, Register, Dashboard, Workout, Coach, Analytics, Profile)
        ├── components/    # PoseCanvas, RepCounter, FormScoreGauge, Sidebar
        ├── store/         # Redux slices (auth, workout, chat)
        └── api/           # Axios API services
```

---

## 🤖 AI Architecture

| Component | Technology | Purpose |
|---|---|---|
| Primary LLM | Gemini 2.0 Flash | Coaching, exercise Q&A, workout plans |
| Fast LLM | Groq LLaMA3-70B | Real-time workout feedback |
| Nutrition LLM | Groq Mixtral-8x7B | Nutrition guidance |
| Embeddings | Gemini text-embedding-004 | RAG retrieval |
| Vector DB | ChromaDB | Fitness knowledge base |
| Agents | LangGraph | Multi-agent routing |
| Pose | MediaPipe | 33-landmark detection |

---

## 📡 API Endpoints

| Method | Path | Description |
|---|---|---|
| POST | `/api/auth/register` | Register new user |
| POST | `/api/auth/login` | Login |
| POST | `/api/auth/profile` | Create fitness profile |
| POST | `/api/workout/sessions/start` | Start workout session |
| POST | `/api/workout/sessions/{id}/end` | End session |
| POST | `/api/workout/exercise-logs` | Log exercise |
| GET | `/api/analytics/summary` | Analytics summary |
| POST | `/api/coach/chat` | AI coach message |
| GET | `/api/coach/history` | Chat history |
| WS | `/ws/pose` | Real-time pose detection |

---

## 🎯 Supported Exercises

- Squat
- Push-Up
- Deadlift
- Lunge
- Bicep Curl
- Plank (timed)
- Pull-Up

---

## 🔧 Tech Stack

**Frontend**: React 18 · TypeScript · Tailwind CSS · Redux Toolkit · Framer Motion · Recharts  
**Backend**: FastAPI · SQLAlchemy · SQLite · python-jose · WebSockets  
**AI**: Google Gemini 2.0 Flash · Groq LLaMA3-70B · LangGraph · ChromaDB · MediaPipe
