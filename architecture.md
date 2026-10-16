# 🏛️ NotesRAG — System Architecture

---

## 1. System Overview

NotesRAG is a **dual-runtime architecture** that operates as two distinct modes simultaneously:

| Mode | Runtime | Vector Search | LLM | Deployment |
|---|---|---|---|---|
| **Local Python Mode** | FastAPI + Uvicorn | FAISS (local binary) | Groq via `langchain-groq` | `localhost:8000` |
| **Cloud Serverless Mode** | Next.js 16 API Routes | In-memory TF-IDF | Groq REST API | Vercel Edge Network |

The two modes are **automatically detected** by the frontend: if the browser reaches `localhost:8000/api/health` successfully, it uses the Python backend. Otherwise it falls back to the Next.js serverless pipeline seamlessly.

---

## 2. High-Level Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────────┐
│                         USER BROWSER (Next.js 16 SPA)               │
│                                                                       │
│  ┌─────────────┐    ┌─────────────────────────────────────────────┐  │
│  │  UploadView │    │               MinimalChatView                │  │
│  │  (drag+drop)│    │  (messages, typewriter, citation drawer)     │  │
│  └──────┬──────┘    └──────────────┬──────────────────────────────┘  │
│         │                          │                                  │
│         └──────────┬───────────────┘                                  │
│                    │ React State (page.tsx)                           │
│                    ▼                                                  │
│         ┌──────────────────────┐                                      │
│         │  Backend Mode Check  │ (polls /api/health every 15s)        │
│         └──────┬───────────────┘                                      │
│                │                                                      │
│         ┌──────▼──────┐     ┌─────────────────────────────────────┐  │
│         │ Backend=ON  │     │         Backend=OFF (Vercel)         │  │
│         │  Proxy to   │     │  Next.js Route Handlers             │  │
│         │  :8000/api  │     │  POST /api/upload  POST /api/rag    │  │
│         └──────┬──────┘     └──────────────┬────────────────────┘   │
└─────────────────│───────────────────────────│───────────────────────┘
                  │                           │
    ┌─────────────▼────────────┐   ┌──────────▼─────────────────────┐
    │  Python FastAPI Backend  │   │  Vercel Serverless Pipeline     │
    │  (server.py)             │   │  (knowledgeBase.ts + groq.ts)  │
    │                          │   │                                 │
    │  POST /api/query         │   │  1. pdf-parse extraction        │
    │  POST /api/upload        │   │  2. chunkDocument() (TS)        │
    │  POST /api/rebuild       │   │  3. retrieveChunks() TF-IDF     │
    │  GET  /api/documents     │   │  4. Groq REST API call          │
    │  GET  /api/health        │   │                                 │
    │                          │   └────────────────────────────────┘
    │  ┌────────────────────┐  │
    │  │  RAGSearch         │  │
    │  │  (orchestrator)    │  │
    │  └────────┬───────────┘  │
    │           │               │
    │  ┌────────▼───────────┐  │
    │  │  FaissVectorStore  │  │
    │  │  (FAISS IndexFlatL2│  │
    │  │  + metadata.pkl)   │  │
    │  └────────┬───────────┘  │
    │           │               │
    │  ┌────────▼───────────┐  │
    │  │  EmbeddingPipeline │  │
    │  │  (SentenceTransf.) │  │
    │  └────────────────────┘  │
    │                          │
    │  ┌────────────────────┐  │
    │  │  ChatGroq LLM      │  │
    │  │  (Groq LPU Cloud)  │  │
    │  └────────────────────┘  │
    └──────────────────────────┘
```

---

## 3. Python Backend Architecture (`/` root)

### 3.1 Module Map

```
notesrag/
├── app.py              # CLI entry point — argparse runner
├── server.py           # FastAPI REST API — 5 endpoints
└── src/
    ├── __init__.py     # Package exports: RAGSearch, FaissVectorStore, etc.
    ├── data_loader.py  # Multi-format LangChain document loaders
    ├── embedding.py    # EmbeddingPipeline: chunking + SentenceTransformer
    ├── vectorstore.py  # FaissVectorStore: FAISS index CRUD + query
    └── search.py       # RAGSearch: retrieval + Groq synthesis orchestrator
```

### 3.2 Python Ingestion & Indexing Pipeline

```
[Documents on Disk: data/pdf/*.pdf, data/text_files/*.txt]
         │
         ▼
┌─────────────────────┐
│   data_loader.py    │  load_all_documents() / load_single_document()
│   LangChain Loaders │  PyPDFLoader, TextLoader, Docx2txtLoader,
│                     │  CSVLoader, JSONLoader, UnstructuredExcelLoader
└─────────┬───────────┘
          │ List[LangChain Document] with metadata:
          │ {source, source_name, file_type, page}
          ▼
┌─────────────────────┐
│   embedding.py      │  EmbeddingPipeline.chunk_documents()
│   RecursiveCharacter│  chunk_size=500, chunk_overlap=150
│   TextSplitter      │  Preserves cross-boundary context
└─────────┬───────────┘
          │ List[Document Chunks]
          ▼
┌─────────────────────┐
│   embedding.py      │  EmbeddingPipeline.embed_chunks()
│   SentenceTransformer│ model: all-MiniLM-L6-v2
│   (384-dim vectors) │  Dense, normalized cosine embeddings
└─────────┬───────────┘
          │ np.ndarray [N × 384] float32
          ▼
┌─────────────────────┐
│   vectorstore.py    │  FaissVectorStore.add_embeddings()
│   faiss.IndexFlatL2 │  Exact L2 distance search, no approximation
│                     │  → faiss_store/faiss.index  (binary)
│                     │  → faiss_store/metadata.pkl (pickle)
└─────────────────────┘
```

### 3.3 Python Query Pipeline

```
[User Query String]
         │
         ▼
┌─────────────────────┐
│  RAGSearch          │  vectorstore.query(query, top_k)
│  retrieve_context() │
└─────────┬───────────┘
          │
          ▼
┌─────────────────────┐
│  FaissVectorStore   │  query_vector = model.encode(query)
│  .query()           │  faiss.search(query_vector, top_k)
│                     │  → distances[], indices[]
│                     │  → [{metadata, distance}...] top-K results
└─────────┬───────────┘
          │ L2 distance → similarity: s = 1 / (1 + d)
          ▼
┌─────────────────────┐
│  server.py          │  Build context string from chunk texts
│  Context Builder    │  [Source: <doc>, Chunk #<id>]\n<text>
└─────────┬───────────┘
          │
          ▼
┌─────────────────────┐
│  ChatGroq LLM       │  llm.invoke([prompt])
│  (langchain-groq)   │  Anti-hallucination system prompt
│                     │  Citations embedded in response
└─────────┬───────────┘
          │
          ▼
  JSON Response:
  { answer, retrievedChunks[], model, latencyMs: {retrieval, inference, total} }
```

### 3.4 FastAPI REST Endpoints

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/health` | System status: Groq config, FAISS index readiness |
| `POST` | `/api/query` | Main RAG pipeline: retrieve + synthesize |
| `POST` | `/api/upload` | Multi-file upload → FAISS incremental append |
| `POST` | `/api/rebuild` | Full FAISS re-indexing from `data/` directory |
| `GET` | `/api/documents` | List all indexed documents with metadata |

---

## 4. Next.js Frontend Architecture (`frontend/`)

### 4.1 Module Map

```
frontend/
├── vercel.json                 # Vercel deployment config: rootDirectory=frontend
├── next.config.ts              # Next.js config
├── package.json                # Dependencies: next@16, pdf-parse, tailwindcss
└── src/
    ├── app/
    │   ├── layout.tsx          # Root layout: font, meta, theme class
    │   ├── page.tsx            # Root page: state orchestrator, backend health check
    │   ├── globals.css         # CSS variables, base styles, theme tokens
    │   └── api/
    │       ├── upload/route.ts # Serverless upload handler: pdf-parse + chunkDocument()
    │       └── rag/route.ts    # Serverless RAG handler: retrieveChunks() + Groq REST
    ├── components/
    │   ├── UploadView.tsx      # Drag-and-drop upload UI with progress simulation
    │   ├── MinimalChatView.tsx # Chat thread, typewriter, citations panel
    │   └── Icons.tsx           # SVG icon components (pure JSX, no dep)
    ├── lib/
    │   ├── knowledgeBase.ts    # Default docs, chunkDocument(), retrieveChunks()
    │   └── groq.ts             # Groq REST client, model registry, fallback synthesis
    └── types/
        └── rag.ts              # TypeScript type definitions: Chunk, DocumentItem, ChatMessage
```

### 4.2 Frontend State Machine (page.tsx)

```
App State:
  activeFileNames: string[]     — filenames visible in chat header
  messages: ChatMessage[]       — full conversation thread
  uploadedChunks: Chunk[]       — in-memory vector pool for serverless mode
  isLoading: boolean            — request in flight
  isBackendConnected: boolean   — live health-check result
  theme: "dark" | "light"       — CSS theme mode

View Router:
  activeFileNames.length === 0  → <UploadView />
  activeFileNames.length > 0    → <MinimalChatView />
```

### 4.3 Serverless RAG Pipeline (Vercel)

```
POST /api/upload
  ← FormData (files[])
  → pdf-parse buffer extraction (PDFs) | file.text() (plain text)
  → chunkDocument(docItem, size=450, overlap=80)
  → returns { chunks: Chunk[], filenames[] }

POST /api/rag
  ← { query, chunks, topK, model, apiKey, temperature }
  → chunks from body OR getInitialChunks() (defaults)
  → retrieveChunks(query, pool, topK): TF-IDF weighted scoring
  → executeGroqCompletion(): Groq REST API /chat/completions
  → returns { answer, retrievedChunks, model, latencyMs }
```

### 4.4 Groq Client (`groq.ts`)

```typescript
GROQ_MODELS = [
  "openai/gpt-oss-120b"          // Default: 750 T/s, 128k ctx
  "llama-3.3-70b-versatile"      // 390 T/s, 128k ctx
  "llama-3.1-8b-instant"         // 1,250 T/s, 128k ctx (speed)
  "mixtral-8x7b-32768"           // 600 T/s, 32k ctx
  "gemma2-9b-it"                 // 800 T/s, 8k ctx
  "deepseek-r1-distill-llama-70b"// 300 T/s, 128k ctx (reasoning)
]

API Key Resolution Priority:
  1. body.apiKey (user-supplied in session)
  2. process.env.GROQ_API_KEY (server-side env on Vercel)
  3. → fallback to generateIntelligentFallback() (local synthesis)
```

---

## 5. Data & Storage Architecture

### 5.1 Local Filesystem Layout

```
data/
├── pdf/                 # PDF uploads: resumes, IoT lecture units, research papers
│   ├── *.pdf
│   └── .gitkeep
└── text_files/          # Plain text: ML intro, Python intro
    ├── machinelearning.txt
    ├── python_intro.txt
    └── .gitkeep

faiss_store/
├── faiss.index          # Binary FAISS IndexFlatL2 (N × 384 float32 vectors)
└── metadata.pkl         # Pickle: List[Dict] with {text, source, chunk_id, file_type...}
```

### 5.2 Chunk Metadata Schema

```python
# Per-chunk metadata stored in metadata.pkl and returned by /api/query
{
  "text": str,          # Raw chunk content
  "source": str,        # Absolute file path
  "source_name": str,   # Filename only
  "file_type": str,     # "pdf" | "txt" | "docx" | "json" | "csv" | "xlsx"
  "page": int,          # Page number (PDFs only)
  "chunk_id": int,      # Sequential chunk index within source document
}
```

### 5.3 TypeScript Chunk Schema

```typescript
interface Chunk {
  id: string;           // "doc-<docId>-chunk-<idx>"
  documentId: string;
  documentName: string;
  text: string;
  chunkIndex: number;
  tokens: number;       // Approx: words * 1.3
  score?: number;       // Similarity [0..1]
  distance?: number;    // L2 distance (raw FAISS output)
}
```

---

## 6. Deployment Architecture

### 6.1 Local Development (Full-Stack)

```
Terminal 1: Python Backend
  uvicorn server:app --host 127.0.0.1 --port 8000 --reload
  → Serves REST API at http://localhost:8000

Terminal 2: Next.js Frontend
  cd frontend && npm run dev
  → Serves web UI at http://localhost:3000
  → Detects backend at :8000 and uses FAISS pipeline
```

### 6.2 Vercel Production Deployment

```
vercel.json (root):
  { "framework": "nextjs", "rootDirectory": "frontend" }

frontend/vercel.json:
  { "framework": "nextjs" }

Environment Variables (Vercel Dashboard):
  GROQ_API_KEY=gsk_...          # Required for serverless inference
  NEXT_PUBLIC_BACKEND_URL=""     # Leave blank (Python backend not on Vercel)

Build:
  next build → .next/ static export
  API routes → Vercel Serverless Functions (Node.js runtime)
```

### 6.3 Environment Configuration

```bash
# Root .env (Python backend only)
GROQ_API_KEY=gsk_...
GROQ_MODEL=openai/gpt-oss-120b

# frontend/.env.local (Next.js only)
GROQ_API_KEY=gsk_...
NEXT_PUBLIC_BACKEND_URL=http://127.0.0.1:8000   # Blank in Vercel prod
```

---

## 7. Technology Stack Summary

| Layer | Technology | Version | Purpose |
|---|---|---|---|
| Language (BE) | Python | 3.13+ | Backend logic |
| Language (FE) | TypeScript | 5.x | Frontend + API routes |
| Web Framework | Next.js | 16.4.0 | App router, API routes, SSR |
| UI Library | React | 19.3.0 | Component model |
| CSS | TailwindCSS | 4.x | Utility-first styling |
| REST API | FastAPI | latest | Python HTTP server |
| ASGI Server | Uvicorn | 0.30+ | FastAPI runner |
| Vector DB | FAISS (faiss-cpu) | 1.15+ | Dense nearest neighbor search |
| Embeddings | SentenceTransformers | 6.1+ | `all-MiniLM-L6-v2` 384-dim |
| LLM Orchestration | LangChain | 1.4+ | Document loaders, text splitters |
| LLM Provider | Groq LPU Cloud | — | Ultra-fast token generation |
| PDF (Python) | PyPDF / PyMuPDF | 6.19+ / 1.28+ | PDF parsing |
| PDF (Node.js) | pdf-parse | 2.4+ | Serverless PDF extraction |
| Package Manager (FE) | npm / Node | 20+ | Frontend deps |
| Package Manager (BE) | uv | latest | Python deps (fast) |
| Deployment | Vercel | — | Frontend production hosting |
