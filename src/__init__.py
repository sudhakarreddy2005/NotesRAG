"""NotesRAG: Production-Grade Modular Retrieval-Augmented Generation (RAG) System."""

from src.data_loader import load_all_documents
from src.embedding import EmbeddingPipeline
from src.vectorstore import FaissVectorStore
from src.search import RAGSearch

__all__ = [
    "load_all_documents",
    "EmbeddingPipeline",
    "FaissVectorStore",
    "RAGSearch",
]

__version__ = "0.1.0"
