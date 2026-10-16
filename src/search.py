import os
from typing import Dict, List, Optional
from dotenv import load_dotenv
from langchain_groq import ChatGroq
from src.vectorstore import FaissVectorStore

load_dotenv()


class RAGSearch:
    """Orchestrator for Retrieval-Augmented Generation using FAISS and Groq LLM."""

    def __init__(
        self,
        persist_dir: str = "faiss_store",
        embedding_model: str = "all-MiniLM-L6-v2",
        llm_model: Optional[str] = None,
    ):
        self.vectorstore = FaissVectorStore(persist_dir, embedding_model)

        # Load or automatically build vector store
        faiss_path = os.path.join(persist_dir, "faiss.index")
        meta_path = os.path.join(persist_dir, "metadata.pkl")

        if not (os.path.exists(faiss_path) and os.path.exists(meta_path)):
            from src.data_loader import load_all_documents
            print("[INFO] Index not found. Auto-building index from 'data' directory...")
            docs = load_all_documents("data")
            self.vectorstore.build_from_documents(docs)
        else:
            self.vectorstore.load()

        # Validate Groq API key
        groq_api_key = os.getenv("GROQ_API_KEY")
        if not groq_api_key:
            raise ValueError(
                "Missing GROQ_API_KEY. Please set GROQ_API_KEY in your .env file or environment variables. "
                "You can get a free key from https://console.groq.com/keys"
            )

        model_name = llm_model or os.getenv("GROQ_MODEL", "openai/gpt-oss-120b")
        self.llm = ChatGroq(groq_api_key=groq_api_key, model_name=model_name)
        print(f"[INFO] Groq LLM initialized with model: {model_name}")

    def retrieve_context(self, query: str, top_k: int = 5, active_files: Optional[List[str]] = None) -> List[Dict]:
        """Retrieve relevant document chunks for the query, optionally strictly filtered to active_files."""
        if not self.vectorstore or self.vectorstore.index is None or self.vectorstore.index.ntotal == 0:
            return []
        
        # If filtering by active files, search with a higher candidate pool to find matching chunks
        fetch_k = top_k * 4 if active_files else top_k
        raw_results = self.vectorstore.query(query, top_k=fetch_k)
        
        if not active_files:
            return raw_results[:top_k]
            
        normalized = {os.path.basename(f).lower() for f in active_files}
        filtered: List[Dict] = []
        for r in raw_results:
            source = r.get("metadata", {}).get("source", "")
            base = os.path.basename(source).lower()
            if base in normalized:
                filtered.append(r)
                if len(filtered) >= top_k:
                    break
        return filtered

    def search_and_summarize(self, query: str, top_k: int = 5) -> str:
        """Retrieve context and generate an augmented answer with Groq."""
        results = self.retrieve_context(query, top_k=top_k)
        texts = [r["metadata"].get("text", "") for r in results if r.get("metadata")]
        context = "\n\n---\n\n".join(texts)

        if not context.strip():
            return "No relevant context found in the indexed documents to answer this query."

        prompt = f"""You are a precise, production-grade technical assistant. Answer the user query using strictly the context provided below. If the context does not contain enough information to formulate a reliable answer, state what is known from the context and what is missing.

Context:
{context}

User Query:
{query}

Answer:"""

        response = self.llm.invoke([prompt])
        return response.content


if __name__ == "__main__":
    rag = RAGSearch()
    sample_query = "What is machine learning?"
    print("\n--- Testing RAG Search ---")
    print("Query:", sample_query)
    answer = rag.search_and_summarize(sample_query, top_k=3)
    print("\nAnswer:\n", answer)
