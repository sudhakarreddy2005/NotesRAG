import os
import pickle
from typing import Any, Dict, List, Optional
import faiss
import numpy as np
from sentence_transformers import SentenceTransformer
from src.embedding import EmbeddingPipeline


class FaissVectorStore:
    """FAISS-based persistent vector index for dense semantic retrieval."""

    def __init__(
        self,
        persist_dir: str = "faiss_store",
        embedding_model: str = "all-MiniLM-L6-v2",
        chunk_size: int = 1000,
        chunk_overlap: int = 200,
    ):
        self.persist_dir = persist_dir
        os.makedirs(self.persist_dir, exist_ok=True)
        self.index: Optional[faiss.Index] = None
        self.metadata: List[Dict[str, Any]] = []
        self.embedding_model = embedding_model
        self.model = SentenceTransformer(embedding_model)
        self.chunk_size = chunk_size
        self.chunk_overlap = chunk_overlap
        print(f"[INFO] Loaded embedding model: {embedding_model}")

    def build_from_documents(self, documents: List[Any]) -> None:
        """Process documents, compute embeddings, and build the persistent FAISS index."""
        if not documents:
            print("[WARNING] No documents provided to build vector store.")
            return

        print(f"[INFO] Building vector store from {len(documents)} raw document(s)...")
        emb_pipe = EmbeddingPipeline(
            model_name=self.embedding_model,
            chunk_size=self.chunk_size,
            chunk_overlap=self.chunk_overlap,
        )
        chunks = emb_pipe.chunk_documents(documents)
        if not chunks:
            print("[WARNING] No chunks generated from documents.")
            return

        embeddings = emb_pipe.embed_chunks(chunks)
        # Preserve document metadata (source file, page, etc.) along with chunk text
        metadatas = [
            {"text": chunk.page_content, **getattr(chunk, "metadata", {})}
            for chunk in chunks
        ]
        self.add_embeddings(np.array(embeddings).astype("float32"), metadatas)
        self.save()
        print(f"[INFO] Vector store built and saved to '{self.persist_dir}'.")

    def add_embeddings(
        self,
        embeddings: np.ndarray,
        metadatas: Optional[List[Dict[str, Any]]] = None,
    ) -> None:
        """Add dense vectors and corresponding metadata to the FAISS index."""
        dim = embeddings.shape[1]
        if self.index is None:
            self.index = faiss.IndexFlatL2(dim)
        self.index.add(embeddings)
        if metadatas:
            self.metadata.extend(metadatas)
        print(f"[INFO] Added {embeddings.shape[0]} vectors to FAISS index (Total: {self.index.ntotal}).")

    def save(self) -> None:
        """Persist FAISS index and metadata pickle to disk."""
        if self.index is None:
            print("[WARNING] No index to save.")
            return
        faiss_path = os.path.join(self.persist_dir, "faiss.index")
        meta_path = os.path.join(self.persist_dir, "metadata.pkl")
        faiss.write_index(self.index, faiss_path)
        with open(meta_path, "wb") as f:
            pickle.dump(self.metadata, f)
        print(f"[INFO] Saved FAISS index and metadata to '{self.persist_dir}'.")

    def load(self) -> bool:
        """Load FAISS index and metadata from disk."""
        faiss_path = os.path.join(self.persist_dir, "faiss.index")
        meta_path = os.path.join(self.persist_dir, "metadata.pkl")
        if not (os.path.exists(faiss_path) and os.path.exists(meta_path)):
            print(f"[INFO] No existing index found at '{self.persist_dir}'.")
            return False
        self.index = faiss.read_index(faiss_path)
        with open(meta_path, "rb") as f:
            self.metadata = pickle.load(f)
        print(f"[INFO] Loaded FAISS index ({self.index.ntotal} vectors) and metadata from '{self.persist_dir}'.")
        return True

    def search(self, query_embedding: np.ndarray, top_k: int = 5) -> List[Dict[str, Any]]:
        """Perform nearest neighbor search using query embedding."""
        if self.index is None:
            raise ValueError("Vector index is not initialized or loaded. Call load() or build_from_documents() first.")
        top_k = min(top_k, max(1, self.index.ntotal))
        distances, indices = self.index.search(query_embedding, top_k)
        results = []
        for idx, dist in zip(indices[0], distances[0]):
            if idx == -1:
                continue
            meta = self.metadata[idx] if idx < len(self.metadata) else None
            results.append({"index": int(idx), "distance": float(dist), "metadata": meta})
        return results

    def query(self, query_text: str, top_k: int = 5) -> List[Dict[str, Any]]:
        """Encode query string and retrieve top_k nearest documents."""
        print(f"[INFO] Querying vector store for: '{query_text}'")
        query_emb = self.model.encode([query_text]).astype("float32")
        return self.search(query_emb, top_k=top_k)


if __name__ == "__main__":
    try:
        from src.data_loader import load_all_documents
    except ImportError:
        from data_loader import load_all_documents

    docs = load_all_documents("data")
    store = FaissVectorStore("faiss_store")
    store.build_from_documents(docs)
    store.load()
    print(store.query("What is machine learning?", top_k=3))