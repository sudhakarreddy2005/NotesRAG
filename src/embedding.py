from typing import List, Any
import numpy as np
from langchain_text_splitters import RecursiveCharacterTextSplitter
from sentence_transformers import SentenceTransformer


class EmbeddingPipeline:
    """Pipeline for document chunking and dense vector embedding generation."""

    def __init__(
        self,
        model_name: str = "all-MiniLM-L6-v2",
        chunk_size: int = 500,
        chunk_overlap: int = 150,
    ):
        self.chunk_size = chunk_size
        self.chunk_overlap = chunk_overlap
        self.model_name = model_name
        self.model = SentenceTransformer(model_name)
        print(f"[INFO] Loaded embedding model: {model_name}")

    def chunk_documents(self, documents: List[Any]) -> List[Any]:
        """Split raw LangChain documents into overlapping text chunks."""
        splitter = RecursiveCharacterTextSplitter(
            chunk_size=self.chunk_size,
            chunk_overlap=self.chunk_overlap,
        )
        chunks = splitter.split_documents(documents)
        print(f"[INFO] Chunked {len(documents)} document(s) into {len(chunks)} chunk(s).")
        return chunks

    def embed_chunks(self, chunks: List[Any]) -> np.ndarray:
        """Generate dense vector embeddings for document chunks."""
        texts = [chunk.page_content for chunk in chunks]
        embeddings = self.model.encode(texts, show_progress_bar=False, convert_to_numpy=True)
        print(f"[INFO] Generated embeddings shape: {embeddings.shape} for {len(chunks)} chunk(s).")
        return embeddings
