import argparse
import sys
from dotenv import load_dotenv
from src.data_loader import load_all_documents
from src.search import RAGSearch
from src.vectorstore import FaissVectorStore

load_dotenv()


def main():
    parser = argparse.ArgumentParser(
        description="NotesRAG: Production-Grade Retrieval-Augmented Generation CLI",
        formatter_class=argparse.RawDescriptionHelpFormatter,
    )
    parser.add_argument(
        "-q",
        "--query",
        type=str,
        default=None,
        help="Query to ask the RAG system.",
    )
    parser.add_argument(
        "-k",
        "--top-k",
        type=int,
        default=3,
        help="Number of relevant chunks to retrieve (default: 3).",
    )
    parser.add_argument(
        "--rebuild",
        action="store_true",
        help="Force re-indexing of documents from the 'data/' directory into FAISS.",
    )
    parser.add_argument(
        "-i",
        "--interactive",
        action="store_true",
        help="Start an interactive Q&A session.",
    )

    args = parser.parse_args()

    # Rebuild index if requested
    if args.rebuild:
        print("[INFO] Rebuilding FAISS vector store from 'data/' directory...")
        docs = load_all_documents("data")
        if not docs:
            print("[WARNING] No documents found in 'data/' to index.")
        else:
            store = FaissVectorStore("faiss_store")
            store.build_from_documents(docs)
            print("[INFO] FAISS vector store rebuild completed successfully.\n")

    # Initialize RAG Pipeline
    try:
        rag = RAGSearch()
    except ValueError as e:
        print(f"\n[ERROR] Configuration error: {e}")
        print("Tip: Copy .env.example to .env and insert your GROQ_API_KEY.\n")
        sys.exit(1)
    except Exception as e:
        print(f"\n[ERROR] Failed to initialize RAG system: {e}\n")
        sys.exit(1)

    # Interactive Q&A Mode
    if args.interactive:
        print("\n" + "=" * 60)
        print("  NotesRAG Interactive Q&A (Type 'exit' or 'q' to quit)")
        print("=" * 60 + "\n")
        while True:
            try:
                user_query = input("Ask a question: ").strip()
                if not user_query:
                    continue
                if user_query.lower() in ("exit", "quit", "q"):
                    print("Exiting NotesRAG. Goodbye!")
                    break
                print("\n[Thinking...]")
                answer = rag.search_and_summarize(user_query, top_k=args.top_k)
                print("\n--- Answer ---")
                print(answer)
                print("\n" + "-" * 60 + "\n")
            except (KeyboardInterrupt, EOFError):
                print("\nSession terminated.")
                break
        return

    # Single Query Mode
    query = args.query or "What is machine learning and what are its core paradigms?"
    print("\n" + "=" * 60)
    print(f"  NotesRAG Query: {query}")
    print("=" * 60)
    print(f"[INFO] Retrieving top {args.top_k} context chunk(s) and generating answer...\n")
    answer = rag.search_and_summarize(query, top_k=args.top_k)
    print("--- Answer ---")
    print(answer)
    print("=" * 60 + "\n")


if __name__ == "__main__":
    main()