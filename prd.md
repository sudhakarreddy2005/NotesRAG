# 📋 NotesRAG — Product Requirements Document (PRD)

---

## 1. Executive Summary

**NotesRAG** is an enterprise-ready, modular Retrieval-Augmented Generation (RAG) system engineered for high-accuracy question answering and semantic search across technical notes, textbooks, research PDFs, resumes, and enterprise documentation.

The system addresses the critical problem of knowledge retrieval fragmentation: users accumulate PDFs, lecture notes, Word documents, and text files that are tedious to search manually and impossible for standard LLMs to answer without hallucination or context overflow. 

NotesRAG delivers:
- **Sub-second semantic search** powered by Facebook AI Similarity Search (**FAISS**) and dense embeddings (**SentenceTransformers `all-MiniLM-L6-v2`**).
- **Ultra-low latency LLM synthesis** via **Groq LPUs** generating responses at up to 750–1250 tokens/sec.
- **Dual Runtime Architecture**: Operates as a full-featured local Python FastAPI backend with local vector index, and as a standalone serverless Next.js web application deployed on Vercel.
- **Transparent Verification**: Embedded source citations and an interactive "Citation Proof" panel displaying raw source text chunks, cosine similarity, token metrics, and document origins.

---

## 2. Product Vision & Goals

### 2.1 Vision Statement
To provide students, researchers, software engineers, and knowledge workers with the fastest, most reliable, and verifiable document AI assistant that functions seamlessly on local machines and modern cloud edge runtimes.

### 2.2 Core Product Objectives
1. **Zero-Friction Ingestion**: Support drag-and-drop ingestion of multiple file formats (`.pdf`, `.txt`, `.docx`, `.json`, `.csv`, `.xlsx`) with instant chunking.
2. **Deterministic Grounding**: Ensure every factual claim made by the assistant is grounded in ingested document chunks with source and chunk index citations.
3. **Speed & Responsiveness**: Achieve sub-200ms vector retrieval and under 1.5s total time-to-first-token inference via Groq LPUs.
4. **Adaptive Deployment**: Provide a smooth user experience both in fully disconnected local Python environments and in serverless web deployments.

---

## 3. Target Audience & User Personas

| Persona | Description | Primary Needs | Pain Points Solved |
|---|---|---|---|
| **Alex — CS Student / Researcher** | Reads dense academic papers, course notes, and textbooks. | Fast conceptual search, exam question generation, mathematical explanations with proof snippets. | Reading 100-page slide decks; manually hunting for exam-relevant definitions. |
| **Priya — Software Engineer** | Manages architecture docs, API guides, and code design RFCs. | Querying complex internal docs, finding exact code citations, offline privacy-friendly indexing. | Outdated documentation; slow standard search engines that lack semantic understanding. |
| **David — Technical Recruiter** | Reviews dozens of technical resumes and candidate portfolios. | Comparing candidate skill sets, verifying specific project experiences across PDF resumes. | Keyword-only searching missing semantic matches (e.g., matching "PyTorch" with "Deep Learning"). |

---

## 4. Key Features & Functional Requirements

### 4.1 Document Ingestion & Parsing (FR-1)
- **FR-1.1 Multi-format Parsing**: Ingest `.pdf`, `.txt`, `.docx`, `.json`, `.csv`, and `.xlsx`.
- **FR-1.2 Batch Multi-File Upload**: Allow users to upload single or multiple documents concurrently via drag-and-drop or file picker.
- **FR-1.3 Content Extraction**:
  - Python backend: `PyPDFLoader` / `pymupdf` with metadata tracking (page number, filename, source path).
  - Web Serverless: `pdf-parse` running in Next.js API routes with buffer extraction.
- **FR-1.4 Incremental Indexing**: Newly uploaded files append to the active vector database without requiring complete re-indexing of the entire corpus.

### 4.2 Semantic Chunking & Vectorization (FR-2)
- **FR-2.1 Recursive Character Chunking**: Split text dynamically with a default chunk size of 500 characters and 150-character overlapping sliding window.
- **FR-2.2 Boundary Preservation**: Prefer natural sentence breaks (`. `) and paragraph breaks (`\n\n`) over arbitrary word cuts.
- **FR-2.3 Metadata Attribution**: Each chunk retains metadata: `documentId`, `documentName`, `chunkIndex`, estimated token count, and timestamps.
- **FR-2.4 Dense Embedding Generation**:
  - Python: `SentenceTransformer('all-MiniLM-L6-v2')` generating 384-dimensional dense vectors.
  - Next.js Client/Edge: In-memory TF-IDF semantic scoring with title weighting for instant zero-dependency execution.

### 4.3 Vector Indexing & Similarity Search (FR-3)
- **FR-3.1 FAISS Indexing**: Use `faiss.IndexFlatL2` for exact L2 nearest neighbor retrieval.
- **FR-3.2 Persistent Storage**: Persist the index binary to `faiss_store/faiss.index` and metadata to `faiss_store/metadata.pkl`.
- **FR-3.3 Dynamic Rebuilding**: Provide explicit rebuild commands (`--rebuild` via CLI, `/api/rebuild` via REST API) to regenerate vectors from disk.
- **FR-3.4 Metric Normalization**: Convert Euclidean L2 distance $d$ to similarity score $s \in [0, 1]$ using $s = \frac{1}{1 + d}$ for consistent UX display.

### 4.4 Generation & Inference Engine (FR-4)
- **FR-4.1 Groq LPU Orchestration**: Connect to Groq Cloud API using `ChatGroq` (Python) and direct REST API (Next.js).
- **FR-4.2 Multi-Model Selection**:
  - `openai/gpt-oss-120b` (Default flagship reasoning, ~750 tokens/sec)
  - `llama-3.3-70b-versatile` (~390 tokens/sec)
  - `llama-3.1-8b-instant` (~1,250 tokens/sec)
  - `mixtral-8x7b-32768` (32k context)
  - `deepseek-r1-distill-llama-70b` (Advanced reasoning)
- **FR-4.3 Anti-Hallucination Prompting**: Strictly bound LLM response generation to retrieved context chunks with instructions to acknowledge information gaps rather than fabricating answers.
- **FR-4.4 Offline / Keyless Fallback**: When no API key is supplied, generate structured grounded fallback summaries highlighting direct document excerpts.

### 4.5 User Interface & Experience (FR-5)
- **FR-5.1 Dual-View Interface**:
  - **Upload View**: Dropzone with real-time vectorization progress animation and sample preset buttons.
  - **Chat View**: Conversational chat thread with typewriter streaming simulation, query suggestions, and message stop/clear controls.
- **FR-5.2 Citation Proof Drawer**: Collapsible card attached to every assistant response showing:
  - Source document name and chunk badge.
  - Relevance score percentage and L2 distance.
  - Full verbatim text chunk excerpt.
- **FR-5.3 Theme Engine**: Seamless dark and light modes with custom CSS tokens, backdrop filters, and accessible contrast.
- **FR-5.4 Backend Connection Indicator**: Real-time status badge showing whether the browser is connected to the local Python FAISS backend (`online`) or running on standalone cloud serverless (`standalone`).

---

## 5. Non-Functional Requirements (NFR)

### 5.1 Performance & Latency
- **Vector Retrieval**: Retrieval of top-4 chunks must complete in $< 50\text{ms}$ on local FAISS and $< 20\text{ms}$ on serverless memory.
- **LLM Synthesis**: Time-to-first-token must be $< 1.5\text{s}$ using Groq LPU inference.
- **Upload Processing**: PDFs under 10MB must be parsed, chunked, and indexed in $< 3\text{s}$.

### 5.2 Reliability & Fault Tolerance
- **Graceful Degradation**: If the Python FastAPI backend is offline, the Next.js frontend automatically falls back to in-memory serverless indexing without breaking user sessions.
- **Invalid API Key Handling**: Clear user warnings and error state indicators when API keys are expired or invalid.
- **Empty Query Prevention**: Guard against empty or whitespace-only queries.

### 5.3 Security & Privacy
- **Local Isolation**: In local mode, documents and vector stores remain strictly on the user's filesystem (`data/` and `faiss_store/`).
- **No Vector DB Telemetry**: Vector embeddings and documents are never forwarded to third parties (only query + retrieved context chunks are sent to Groq for synthesis).
- **Secret Protection**: `.env` and `.env.local` are excluded via `.gitignore` to prevent secret leaks.

---

## 6. Success Metrics & KPIs

1. **Retrieval Precision**: $> 90\%$ of retrieved chunks are relevant to the user query.
2. **Answer Grounding Rate**: $0\%$ hallucinations for queries whose answers exist within the indexed files.
3. **End-to-End Latency**: Median response latency $\le 2.0\text{s}$.
4. **Ingestion Success Rate**: $> 98\%$ successful parsing rate across standard PDF, TXT, DOCX, and Markdown files.

---

## 7. Release Roadmap

- **Phase 1 (Completed)**: Core Python CLI, LangChain ingestion, FAISS indexer, Groq LPU integration.
- **Phase 2 (Completed)**: FastAPI REST backend (`server.py`), Next.js 16 Web Dashboard, multi-file upload, interactive Citation Proof viewer.
- **Phase 3 (Current)**: Enterprise documentation suite, hybrid dense+sparse retrieval optimization, streaming SSE endpoint.
- **Phase 4 (Planned)**: Persistent vector storage via ChromaDB / Qdrant cloud option, multi-document cross-comparison, chat history export to PDF/Markdown.
