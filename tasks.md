# ✅ NotesRAG — Tasks & Progress

> Last Updated: 2026-10-16

---

## Legend

| Symbol | Meaning |
|---|---|
| ✅ | Completed |
| 🔄 | In Progress |
| 📌 | Planned (Next) |
| 🔮 | Future / Backlog |
| ❌ | Blocked |

---

## Phase 1 — Core Python Pipeline

| # | Task | Status | Notes |
|---|---|---|---|
| 1.1 | Project scaffold with `pyproject.toml`, `uv`, `.env.example` | ✅ | Python 3.13+, UV package manager |
| 1.2 | `data_loader.py` — Multi-format LangChain loaders | ✅ | PDF, TXT, DOCX, JSON, CSV, XLSX |
| 1.3 | `embedding.py` — `EmbeddingPipeline` with RecursiveCharacterTextSplitter | ✅ | `all-MiniLM-L6-v2`, chunk=500, overlap=150 |
| 1.4 | `vectorstore.py` — `FaissVectorStore` with IndexFlatL2, save/load/query | ✅ | Persistent binary + metadata pickle |
| 1.5 | `search.py` — `RAGSearch` orchestrator with Groq synthesis | ✅ | `ChatGroq`, anti-hallucination prompt |
| 1.6 | `app.py` — CLI: `--query`, `--rebuild`, `--interactive` modes | ✅ | `argparse`, `notesrag` script entry |
| 1.7 | `.gitignore` — Production-grade exclusions | ✅ | Secrets, vectors, caches excluded |
| 1.8 | `vectorstore.append_documents()` — Incremental indexing | ✅ | Appends chunks without full rebuild |
| 1.9 | Sample data files: `machinelearning.txt`, `python_intro.txt` | ✅ | Located in `data/text_files/` |
| 1.10 | `.python-version` pinned to 3.13 | ✅ | |

---

## Phase 2 — FastAPI REST Backend

| # | Task | Status | Notes |
|---|---|---|---|
| 2.1 | `server.py` — FastAPI app with CORS middleware | ✅ | `allow_origins=["*"]` for local dev |
| 2.2 | `GET /api/health` — Status endpoint | ✅ | Reports Groq config, FAISS readiness |
| 2.3 | `POST /api/query` — RAG retrieval + synthesis endpoint | ✅ | Returns `{ answer, retrievedChunks, latencyMs }` |
| 2.4 | `POST /api/upload` — Multi-file upload + incremental FAISS index | ✅ | Saves to `data/` then appends vectors |
| 2.5 | `POST /api/rebuild` — Full index rebuild from disk | ✅ | Re-initializes `RAGSearch` after rebuild |
| 2.6 | `GET /api/documents` — List all indexed documents | ✅ | Walks `data/` with size + modified date |
| 2.7 | L2 → Similarity normalization in response: `s = 1 / (1 + d)` | ✅ | `[0, 1]` score for UI display |

---

## Phase 3 — Next.js Web Frontend

| # | Task | Status | Notes |
|---|---|---|---|
| 3.1 | Next.js 16 app scaffold with TailwindCSS v4 | ✅ | `frontend/`, `rootDirectory` in vercel.json |
| 3.2 | TypeScript types in `src/types/rag.ts` | ✅ | `Chunk`, `DocumentItem`, `ChatMessage` |
| 3.3 | `knowledgeBase.ts` — Default docs, `chunkDocument()`, `retrieveChunks()` | ✅ | TF-IDF scoring, boundary-aware chunking |
| 3.4 | `groq.ts` — Groq REST client, model registry, fallback synthesis | ✅ | 6 model options, keyless fallback |
| 3.5 | `POST /api/upload` — Next.js serverless upload route | ✅ | pdf-parse for PDFs, text() for others |
| 3.6 | `POST /api/rag` — Next.js serverless RAG route | ✅ | Retrieval + Groq API call |
| 3.7 | `UploadView` — Drag-and-drop UI with animated progress bar | ✅ | Exponential progress tick, stage labels |
| 3.8 | `MinimalChatView` — Chat thread with typewriter streaming | ✅ | 20ms token interval, streaming cursor |
| 3.9 | Backend health check polling (15s interval) | ✅ | `AbortController`, 1.5s timeout |
| 3.10 | Dual-mode routing (Python backend vs Vercel serverless) | ✅ | Auto-detected via health check |
| 3.11 | Citation Proof Panel — collapsible per-message chunk cards | ✅ | Score bar, verbatim text, L2 distance |
| 3.12 | Sample preset buttons (ML, Python, RAG Architecture) | ✅ | Pre-embedded in `knowledgeBase.ts` |
| 3.13 | Stop Generation button (floating pill + input bar) | ✅ | Clears `setInterval` and signals abort |
| 3.14 | Clear Chat button | ✅ | Resets messages state |
| 3.15 | Upload More Files button in nav | ✅ | Resets `activeFileNames` to return to Upload View |
| 3.16 | Dynamic query suggestions per document type | ✅ | Switches based on `activeFileNames` |
| 3.17 | Dark / Light theme toggle | ✅ | `data-theme` on `<html>`, CSS custom variant |
| 3.18 | Backend status indicator chip (FAISS Active / Edge RAG) | ✅ | Green / cyan dot + label |
| 3.19 | Geist Sans + Geist Mono fonts | ✅ | `next/font/google` |
| 3.20 | SEO metadata in `layout.tsx` | ✅ | Title + meta description |
| 3.21 | `Icons.tsx` — Pure SVG component library | ✅ | No icon dependency, custom SVGs |

---

## Phase 4 — Documentation Suite (Current Phase)

| # | Task | Status | Notes |
|---|---|---|---|
| 4.1 | `prd.md` — Product Requirements Document | ✅ | Vision, FRs, NFRs, personas, roadmap |
| 4.2 | `architecture.md` — System & data flow architecture | ✅ | Diagrams, module maps, deployment |
| 4.3 | `rules.md` — Coding rules & engineering standards | ✅ | Python, TS, CSS, Git, security |
| 4.4 | `design.md` — UI/UX direction & component specs | ✅ | Color system, layout, animations |
| 4.5 | `tasks.md` — This task tracker | ✅ | Phased progress tracking |
| 4.6 | `memory.md` — Project context & living knowledge | ✅ | Decisions, gotchas, next actions |
| 4.7 | Update `README.md` to reference new doc files | ✅ | Added Documentation Suite table with links to all 6 docs |

---

## Phase 5 — Planned Features

| # | Task | Status | Priority | Notes |
|---|---|---|---|---|
| 5.1 | Streaming SSE endpoint (`POST /api/query/stream`) | ✅ | Real Groq SSE token streaming |
| 5.2 | Streamlined model execution | ✅ | High-speed default Groq engine; dummy dropdown removed from UI |
| 5.3 | API key input in UI (user-supplied) | 📌 | High | `localStorage` secured, passed in request body |
| 5.4 | Temperature / top-K controls | 📌 | Medium | Sliders in settings panel |
| 5.5 | Restrict FastAPI CORS to Vercel domains | 📌 | Medium | Replace `"*"` with explicit origins for production |
| 5.6 | Markdown rendering library (`react-markdown` + `remark-gfm`) | ✅ | High | Rich markdown, tables, blockquotes, and code block formatting |
| 5.7 | Syntax highlighting in code blocks (`rehype-highlight`) | 📌 | Medium | Color-coded code in LLM responses |
| 5.8 | Chat history export (Markdown / JSON) | 📌 | Medium | Download full conversation with citations |
| 5.9 | Document management panel | 📌 | Medium | View, delete individual indexed files |
| 5.10 | Session isolation & purge (`POST /api/clear`) | ✅ | High | Old PDFs wiped on upload/session reset, strict active_files query filtering |
| 5.11 | Responsive Grid Layout & UI Polish | ✅ | High | Responsive grid for citations, document cards, suggestions & features |
| 5.12 | Dummy content removal | ✅ | High | Purged sample files, dummy knowledge base, and dummy prompt suggestions |
| 5.13 | Cross-document comparison mode | 🔮 | Low | Side-by-side diff of two document answers |
| 5.14 | PDF page-level source linking | 🔮 | Low | Click chunk → open PDF at page number |
| 5.15 | DOCX upload support in Next.js serverless route | 🔮 | Low | Currently only PDF + text in serverless |

---

## Known Issues & Bugs

| # | Issue | Severity | Status |
|---|---|---|---|
| B-3 | `pdf-parse@2.x` API fixed — now uses `Uint8Array` via `LoadParameters.data` + correct `TextResult.text` | — | ✅ Fixed |
| B-4 | 4MB client-side file size guard added in `UploadView.tsx` + server-side check in upload route | — | ✅ Fixed |
| B-1 | `CORS allow_origins=["*"]` in `server.py` is too permissive for production | Medium | 📌 Planned fix in Phase 5 |
| B-2 | (Resolved) Typewriter `setInterval` cleaned up — replaced by real SSE streaming | — | ✅ Fixed |
| B-5 | `generateIntelligentFallback` in `groq.ts` uses hardcoded keyword matching — brittle for novel queries | Low | 🔮 Replace with proper offline embedding fallback |
