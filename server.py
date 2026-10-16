import os
import sys
import time
from typing import Optional, List, Dict, Any
from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException, UploadFile, File
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

os.environ["HF_HUB_DISABLE_PROGRESS_BARS"] = "1"
os.environ["TOKENIZERS_PARALLELISM"] = "false"
load_dotenv()

from src.search import RAGSearch
from src.vectorstore import FaissVectorStore
from src.data_loader import load_all_documents

app = FastAPI(
    title="NotesRAG API",
    description="Backend API powering NotesRAG Web Interface",
    version="1.0.0",
)

# Enable CORS for Next.js frontend (localhost:3000, Vercel deployments, etc.)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Global RAG Instance
rag_instance: Optional[RAGSearch] = None


def get_rag() -> RAGSearch:
    global rag_instance
    if rag_instance is None:
        try:
            rag_instance = RAGSearch()
        except Exception as e:
            raise HTTPException(
                status_code=500,
                detail=f"Failed to initialize RAG pipeline: {str(e)}. Check your GROQ_API_KEY in .env",
            )
    return rag_instance



class QueryRequest(BaseModel):
    query: str
    top_k: Optional[int] = 4
    model: Optional[str] = None
    active_files: Optional[List[str]] = None


@app.get("/api/health")
def health_check():
    """Health check endpoint to verify backend status."""
    has_groq = bool(os.getenv("GROQ_API_KEY"))
    model = os.getenv("GROQ_MODEL", "openai/gpt-oss-120b")
    index_exists = os.path.exists("faiss_store/faiss.index")
    return {
        "status": "online",
        "engine": "NotesRAG Python FAISS + Groq LPU",
        "groq_configured": has_groq,
        "default_model": model,
        "faiss_index_ready": index_exists,
    }


@app.post("/api/query")
def query_rag(req: QueryRequest):
    """Execute RAG search and generation using the existing backend pipeline."""
    if not req.query.strip():
        raise HTTPException(status_code=400, detail="Query cannot be empty")

    start_total = time.time()
    rag = get_rag()

    top_k = req.top_k or 4

    # 1. Retrieve context (filtered by active session files if provided)
    start_ret = time.time()
    raw_results = rag.retrieve_context(req.query, top_k=top_k, active_files=req.active_files)
    retrieval_ms = round((time.time() - start_ret) * 1000, 2)

    # Format chunks for frontend
    formatted_chunks = []
    for idx, r in enumerate(raw_results):
        meta = r.get("metadata", {})
        text = meta.get("text", "")
        distance = float(r.get("distance", 0.0))
        # Convert L2 distance to normalized similarity score [0..1]
        similarity_score = max(0.0, min(1.0, 1.0 / (1.0 + distance)))

        formatted_chunks.append({
            "id": f"chunk-{idx}",
            "documentName": os.path.basename(meta.get("source", "document")),
            "source": meta.get("source", "unknown"),
            "text": text,
            "chunkIndex": meta.get("chunk_id", idx),
            "tokens": round(len(text.split()) * 1.3),
            "score": round(similarity_score, 4),
            "distance": round(distance, 4),
        })

    # 2. Run LLM generation
    start_inf = time.time()
    context_blocks = []
    for c in formatted_chunks:
        if c["text"].strip():
            context_blocks.append(f"[Source: {c['documentName']}, Chunk #{c['chunkIndex']}]\n{c['text']}")
    context = "\n\n---\n\n".join(context_blocks)

    if not context.strip():
        answer = "I searched through the indexed documents, but couldn't find any relevant context to answer this query. Feel free to upload additional notes or rephrase your question!"
    else:
        prompt = f"""You are a warm, highly articulate, human-like technical expert. Answer the user query in a natural, engaging, and humanized conversational tone while strictly grounding all facts in the context provided below.

Guidelines:
1. Explain concepts intuitively and conversationally with clear markdown formatting. Avoid robotic, stiff, or generic boilerplate.
2. Embed citation markers directly in your explanation where appropriate (e.g., [Source: <doc_name>, Chunk #<id>]).
3. At the very end of your response, provide a brief "Citation Proof" summary section highlighting the exact key evidence extracted from the documents.
4. If the context does not contain enough information, warmly acknowledge what is known and clarify what is missing.

Context:
{context}

User Query:
{req.query}

Answer:"""
        try:
            response = rag.llm.invoke([prompt])
            answer = response.content
        except Exception as e:
            answer = f"Error during Groq synthesis: {str(e)}"

    inference_ms = round((time.time() - start_inf) * 1000, 2)
    total_ms = round((time.time() - start_total) * 1000, 2)

    return {
        "answer": answer,
        "retrievedChunks": formatted_chunks,
        "model": getattr(rag.llm, "model_name", "openai/gpt-oss-120b"),
        "sourceMode": "python-faiss",
        "latencyMs": {
            "retrieval": retrieval_ms,
            "inference": inference_ms,
            "total": total_ms,
        },
    }


@app.get("/api/documents")
def list_documents():
    """List all indexed documents and files in data/."""
    docs_info = []
    data_dir = "data"

    if os.path.exists(data_dir):
        for root, _, files in os.walk(data_dir):
            for f in files:
                if f.startswith("."):
                    continue
                full_path = os.path.join(root, f)
                rel_path = os.path.relpath(full_path, data_dir)
                try:
                    stat = os.stat(full_path)
                    docs_info.append({
                        "id": rel_path,
                        "name": f,
                        "path": full_path,
                        "sizeBytes": stat.st_size,
                        "modified": time.strftime("%Y-%m-%d %H:%M:%S", time.localtime(stat.st_mtime)),
                    })
                except Exception:
                    pass

    return {
        "documents": docs_info,
        "count": len(docs_info),
        "data_directory": os.path.abspath(data_dir),
    }


@app.post("/api/rebuild")
def rebuild_index():
    """Trigger rebuild of FAISS store from data/."""
    global rag_instance
    try:
        docs = load_all_documents("data")
        if not docs:
            return {"status": "warning", "message": "No documents found in data/ to index."}
        store = FaissVectorStore("faiss_store")
        store.build_from_documents(docs)
        # Re-initialize RAGSearch
        rag_instance = RAGSearch()
        return {"status": "success", "message": f"Successfully re-indexed {len(docs)} documents."}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to rebuild index: {str(e)}")


@app.post("/api/clear")
def clear_session():
    """Clear all uploaded documents, purge the FAISS index, and reset the active session."""
    global rag_instance
    try:
        pdf_dir = os.path.join("data", "pdf")
        if os.path.exists(pdf_dir):
            for f in os.listdir(pdf_dir):
                if f != ".gitkeep":
                    file_path = os.path.join(pdf_dir, f)
                    if os.path.isfile(file_path):
                        try:
                            os.remove(file_path)
                        except Exception:
                            pass

        txt_dir = os.path.join("data", "text_files")
        if os.path.exists(txt_dir):
            for f in os.listdir(txt_dir):
                if f != ".gitkeep":
                    file_path = os.path.join(txt_dir, f)
                    if os.path.isfile(file_path):
                        try:
                            os.remove(file_path)
                        except Exception:
                            pass

        if rag_instance and hasattr(rag_instance, "vectorstore"):
            rag_instance.vectorstore.clear()
        else:
            faiss_dir = "faiss_store"
            for fname in ["faiss.index", "metadata.pkl"]:
                p = os.path.join(faiss_dir, fname)
                if os.path.exists(p):
                    try:
                        os.remove(p)
                    except Exception:
                        pass

        rag_instance = None
        return {
            "status": "success",
            "message": "Session cleared. All uploaded files and FAISS indices removed.",
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to clear session: {str(e)}")


@app.post("/api/upload")
def upload_documents(
    files: Optional[List[UploadFile]] = File(default=None),
    file: Optional[UploadFile] = File(default=None),
    clear_previous: bool = True,
):
    """Upload one or multiple documents of any kind, save to data/, and index into FAISS for this session."""
    all_incoming: List[UploadFile] = []
    if files:
        all_incoming.extend(files)
    if file:
        all_incoming.append(file)

    if not all_incoming:
        raise HTTPException(status_code=400, detail="No files provided for upload")

    global rag_instance

    # If starting a fresh session upload, wipe previous files and index
    if clear_previous:
        clear_session()

    processed_names: List[str] = []
    all_loaded_docs: List[Any] = []
    total_bytes = 0

    from src.data_loader import load_single_document

    for up_file in all_incoming:
        if not up_file.filename:
            continue

        filename = os.path.basename(up_file.filename)
        ext = os.path.splitext(filename)[1].lower()

        if ext == ".pdf":
            target_dir = os.path.join("data", "pdf")
        else:
            target_dir = os.path.join("data", "text_files")

        os.makedirs(target_dir, exist_ok=True)
        target_path = os.path.join(target_dir, filename)

        contents = up_file.file.read()
        total_bytes += len(contents)
        with open(target_path, "wb") as f:
            f.write(contents)

        try:
            docs = load_single_document(target_path)
            all_loaded_docs.extend(docs)
            processed_names.append(filename)
        except Exception as e:
            print(f"[WARN] Failed to load {filename}: {e}")

    # Build or append all loaded chunks to FAISS vector store
    try:
        rag = get_rag()
        if all_loaded_docs:
            rag.vectorstore.build_from_documents(all_loaded_docs)

        return {
            "status": "success",
            "filenames": processed_names,
            "totalFiles": len(processed_names),
            "totalChunks": len(all_loaded_docs),
            "sizeBytes": total_bytes,
            "message": f"Successfully ingested and indexed {len(processed_names)} file(s) into FAISS for this session.",
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to index documents: {str(e)}")





if __name__ == "__main__":
    import uvicorn
    port = int(os.getenv("PORT", "8000"))
    uvicorn.run("server:app", host="127.0.0.1", port=port, reload=True)

