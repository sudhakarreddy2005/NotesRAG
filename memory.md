# 🧠 NotesRAG — Project Memory & Context

> This document is the living context layer for NotesRAG. It captures architectural decisions, important gotchas, environment specifics, and the current working state that any developer (or AI agent) must know before touching this codebase.
> Last Updated: 2026-10-16

---

## 1. Project Identity

| Field | Value |
|---|---|
| **Project Name** | NotesRAG |
| **Author** | sudhakarreddy2005 (`sudhakarreddy30102005@gmail.com`) |
| **Python Version** | 3.13 (pinned in `.python-version`) |
| **Node Version** | 20+ |
| **Package Manager (BE)** | `uv` (recommended) — 10× faster than pip |
| **Package Manager (FE)** | `npm` |
| **Git Remote** | `github.com/sudhakarreddy2005/notesrag` |
| **Prod Deployment** | Vercel (frontend only, `rootDirectory: frontend`) |
| **Local Backend Port** | `8000` (FastAPI/Uvicorn) |
| **Local Frontend Port** | `3000` (Next.js dev server) |

---

## 2. What This Project Does

NotesRAG is a **Retrieval-Augmented Generation system** with two parallel runtime paths:

**Path A — Local Full-Stack (Python + Next.js)**
1. User uploads documents → FastAPI saves to `data/pdf/` or `data/text_files/`.
2. LangChain loaders parse files → `EmbeddingPipeline` chunks text (500 chars, 150 overlap).
3. `SentenceTransformer('all-MiniLM-L6-v2')` generates 384-dim dense vectors.
4. `FaissVectorStore` writes `faiss.index` + `metadata.pkl` to `faiss_store/`.
5. On query: encode query → FAISS `search()` → retrieve top-K chunks → Groq LPU synthesizes grounded answer.
6. Next.js frontend detects backend at `localhost:8000` and proxies all traffic through it.

**Path B — Serverless (Next.js on Vercel)**
1. User uploads → Next.js `/api/upload` route parses with `pdf-parse` (PDFs) or `file.text()` (text).
2. `chunkDocument()` in `knowledgeBase.ts` chunks with boundary-aware splitting.
3. `retrieveChunks()` uses TF-IDF keyword scoring (no external embedding model needed).
4. Next.js `/api/rag` calls Groq REST API directly with built context.
5. Works 100% on Vercel without the Python backend.

---

## 3. Current Working State (as of 2026-10-16)

### ✅ What Works
- Full Python CLI: `uv run notesrag`, `uv run notesrag --rebuild`, `uv run notesrag -i`
- FastAPI backend: all 5 endpoints functional and tested
- Next.js frontend: dual-mode routing (backend detection), upload, chat, citations
- Dark/light theme toggle
- Real Groq SSE streaming (`POST /api/query/stream`) with real-time token rendering
- Citation Proof panel with chunk text, score bars, L2 distance in responsive grid
- Multi-file upload with strict session isolation (`POST /api/clear`, `clear_previous=true`, `active_files` query filtering)
- Dedicated Loading UI skeleton component during retrieval and LLM synthesis
- Dynamic "Upload More" button in chat navigation & empty session grid to append files anytime
- Clean "New Session" flow to wipe session state and reset screen
- Responsive Grid layouts across upload features, active documents, inquiries, and citation cards
- Rich markdown formatting with `react-markdown` + `remark-gfm`
- Purged all dummy mock documents and sample notes
- 4MB upload payload guard on client and server
- `pdf-parse@2.x` `Uint8Array` integration
- Automated stale Next.js dev lock cleanup via `predev` in `package.json`
- Vercel production build validated (7.6s build time, 0 errors)

### 🔄 In Progress / Next Actions (Phase 5)
- Task 5.3: User-supplied Groq API key input modal (`localStorage` persistence).
- Task 5.4: Temperature / top-K sliders in UI settings panel.
- Task 5.5: Restrict FastAPI CORS to explicit origins before cloud deployment.
- Task 5.8: Chat history export (Markdown / JSON).
- Task 5.6 & 5.7: Markdown rendering library (`react-markdown` + `rehype-highlight`) for formatted code blocks.

---

## 4. Key Architectural Decisions & Rationale

### 4.1 FAISS over ChromaDB / Qdrant
**Decision**: Use `faiss-cpu` with binary index files for the Python backend.
**Rationale**: Zero network dependency, sub-millisecond retrieval, fully offline-capable. ChromaDB adds a running server process that is overkill for a single-user research tool. Can be migrated to Qdrant cloud in Phase 5 if multi-user or cross-session persistence is needed.

### 4.2 Dual Serverless + Local Architecture
**Decision**: Maintain two parallel RAG paths (Python FAISS + Next.js TF-IDF).
**Rationale**: The Next.js-only path enables a zero-dependency Vercel deployment anyone can try without cloning the repo or installing Python. The Python path provides accurate dense vector search for power users. The frontend auto-detects which path to use via health check.

### 4.3 TF-IDF in Next.js (Not a Real Vector Search)
**Decision**: The serverless retrieval uses keyword-based TF-IDF scoring, not real dense embeddings.
**Rationale**: Running `SentenceTransformer` in a Vercel serverless function is not feasible (model size, cold start time, memory limits). TF-IDF with title weighting is sufficient for short document sets and demo use cases. Real embedding-based search requires the Python backend.

### 4.4 SentenceTransformers `all-MiniLM-L6-v2` as Embedding Model
**Decision**: Use `all-MiniLM-L6-v2` (384 dimensions) as the sole embedding model.
**Rationale**: Best speed/quality tradeoff for semantic similarity. Runs locally without internet after first download. 384 dimensions keeps FAISS index compact (4 bytes × 384 × N vectors).

### 4.5 Real SSE Streaming with Graceful Abort
**Decision**: Stream assistant messages via true Server-Sent Events (`/api/query/stream`) with `ReadableStream` reader in the frontend.
**Rationale**: Delivers true token-by-token streaming from Groq directly to the UI with <150ms time-to-first-token. AbortController disconnects the stream cleanly when the user clicks Stop Generation.

### 4.6 Dynamic Model Selection
**Decision**: Users can switch Groq models dynamically via the nav selector. Default is `llama-3.3-70b-versatile`.
**Rationale**: Gives users flexibility to balance speed (e.g. `llama-3.1-8b-instant` at ~850 tokens/sec) and reasoning depth (`llama-3.3-70b-versatile` or `openai/gpt-oss-120b`).

### 4.7 `vercel.json` at Root with `rootDirectory: frontend`
**Decision**: Keep the monorepo structure (Python at root, Next.js in `frontend/`) and point Vercel at `frontend/`.
**Rationale**: Allows the Python CLI and backend to coexist in the same Git repo without affecting the Vercel build. The root `package.json` proxies `npm run dev` to `frontend/`.

---

## 5. Environment Variables Reference

### Python Backend (`.env` at repo root)
```env
GROQ_API_KEY=gsk_...          # Required for all LLM inference
GROQ_MODEL=openai/gpt-oss-120b  # Optional — falls back to this default
PORT=8000                     # Optional — Uvicorn listen port
```

### Next.js Frontend (`frontend/.env.local`)
```env
GROQ_API_KEY=gsk_...                          # Server-side only (not exposed to browser)
NEXT_PUBLIC_BACKEND_URL=http://127.0.0.1:8000  # Set locally; blank or omit on Vercel
```

---

## 6. File Routing & Extension Handling

| File Type | Python Backend Path | Next.js Serverless Path |
|---|---|---|
| `.pdf` | `data/pdf/<filename>` → `PyPDFLoader` | `pdf-parse` buffer extraction |
| `.txt` | `data/text_files/<filename>` → `TextLoader` | `file.text()` |
| `.docx` | `data/text_files/<filename>` → `Docx2txtLoader` | ❌ Not supported (text only) |
| `.json` | `data/text_files/<filename>` → `JSONLoader` | `file.text()` (raw JSON string) |
| `.csv` | `data/text_files/<filename>` → `CSVLoader` | `file.text()` |
| `.xlsx` | `data/text_files/<filename>` → `UnstructuredExcelLoader` | `file.text()` |

---

## 7. Local Development Quick Reference

```bash
# Start Python backend
source .venv/bin/activate
uvicorn server:app --host 127.0.0.1 --port 8000 --reload

# Start Next.js frontend
npm run dev          # (from repo root — proxies to frontend/)
# OR
cd frontend && npm run dev

# Rebuild FAISS index from data/
uv run python app.py --rebuild

# Interactive CLI session
uv run python app.py -i

# Single CLI query
uv run python app.py -q "What is machine learning?"

# Install Python deps (first time)
uv sync

# Install Node deps (first time)
cd frontend && npm install
```

---

## 8. Data Currently Indexed

| File | Type | Location | Content Summary |
|---|---|---|---|
| `machinelearning.txt` | Text | `data/text_files/` | ML paradigms: supervised, unsupervised, RL, deep learning, ML pipeline |
| `python_intro.txt` | Text | `data/text_files/` | Python features, execution model (bytecode, PVM), ecosystem |
| `3_1resume.pdf` | PDF | `data/pdf/` | Student resume (CS) |
| `3_2Mlresume.pdf` | PDF | `data/pdf/` | Student ML resume |
| `9922103075 RasendraKaushik.pdf` | PDF | `data/pdf/` | Student resume |
| `Unit-1_IoT.pdf` | PDF | `data/pdf/` | IoT lecture slides — Unit 1 (6.8MB) |
| `Unit-2iot.pdf` | PDF | `data/pdf/` | IoT lecture slides — Unit 2 (3.8MB) |
| `a9_lnProfile.pdf` | PDF | `data/pdf/` | LinkedIn profile export |
| `aiengineerresume.pdf` | PDF | `data/pdf/` | AI engineer resume |
| `e2e_review_mam_abstract.pdf` | PDF | `data/pdf/` | Research paper abstract |

> ⚠️ `Unit-1_IoT.pdf` (6.8MB) and `Unit-2iot.pdf` (3.8MB) are large files that will generate many chunks. Expect longer initial index build time for these.

---

## 9. Known Gotchas

1. **`HF_HUB_DISABLE_PROGRESS_BARS=1` and `TOKENIZERS_PARALLELISM=false`** are set at the top of `server.py` before any imports. This is intentional to suppress verbose Hugging Face output and avoid multiprocessing tokenizer warnings.

2. **`RAGSearch` is a global singleton in `server.py`** (`rag_instance: Optional[RAGSearch] = None`). This means the FAISS index is loaded once at first request and cached for the server lifetime. After a `/api/rebuild`, the global is explicitly reset and re-initialized.

3. **FAISS index must exist before `RAGSearch()` is called** (or `data/` must have documents for auto-build). Starting `server.py` on a fresh clone with an empty `data/` will cause `[INFO] Index not found. Auto-building index...` and produce an empty index. The server won't crash, but queries will return empty results.

4. **`pdf-parse` version 2.x API** differs from the 1.x API most documentation covers. The current `route.ts` uses `new PDFParse({ data: buffer })` — verify this is still the correct constructor for `pdf-parse@2.4.5`.

5. **Vercel max payload** for serverless functions is 4.5MB compressed. Large PDFs uploaded directly to the Next.js serverless route may fail. The Python backend has no such limit (disk I/O).

6. **TailwindCSS v4** (used in this project) has breaking changes from v3. The `globals.css` uses `@import "tailwindcss"` (v4 syntax) and `@custom-variant` — **do not use v3 syntax** (`@tailwind base`, `@tailwind components`).

7. **Next.js 16** has breaking changes. Always read `node_modules/next/dist/docs/` before writing API routes or middleware (per the `AGENTS.md` instruction in `frontend/`).

8. **The `chunkDocument()` function in `knowledgeBase.ts`** prefers `\n\n` paragraph breaks over arbitrary character cuts. The default is `chunkSize=450, overlap=80`. This is distinct from the Python backend's `chunk_size=500, overlap=150` — the two pipelines are intentionally tuned separately.

---

## 10. Next Immediate Actions

1. **[Bug B-3]** Verify `pdf-parse@2.x` API in `frontend/src/app/api/upload/route.ts` — test with an actual PDF upload on the serverless route.
2. **[Bug B-4]** Add client-side file size guard in `UploadView.tsx` — reject files > 4MB before sending to Next.js serverless.
3. **[Task 4.7]** Update `README.md` to link to `prd.md`, `architecture.md`, `rules.md`, `design.md`, `tasks.md`, and `memory.md`.
4. **[Task 5.1]** Implement streaming SSE endpoint (`/api/query/stream`) to replace the typewriter simulation with real server-sent token streaming.
5. **[Task 5.2]** Add model selector dropdown in `MinimalChatView` header — store preference in React state and pass to API route body.
6. **[Task 5.5]** Lock CORS `allow_origins` in `server.py` to specific Vercel preview URLs before any public backend deployment.
