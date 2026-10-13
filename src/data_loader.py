from pathlib import Path
from typing import Any, List
from langchain_community.document_loaders import (
    CSVLoader,
    Docx2txtLoader,
    JSONLoader,
    PyPDFLoader,
    TextLoader,
)
from langchain_community.document_loaders.excel import UnstructuredExcelLoader


def load_all_documents(data_dir: str = "data") -> List[Any]:
    """Load all supported documents from the data directory into LangChain Document format.

    Supported formats: .pdf, .txt, .docx, .json, .csv, .xlsx
    """
    data_path = Path(data_dir).resolve()
    print(f"[INFO] Scanning data path: {data_path}")

    if not data_path.exists():
        print(f"[WARNING] Data directory not found: {data_path}")
        return []

    documents: List[Any] = []

    # PDF documents
    pdf_files = list(data_path.glob("**/*.pdf"))
    if pdf_files:
        print(f"[INFO] Found {len(pdf_files)} PDF file(s).")
    for pdf_file in pdf_files:
        try:
            loader = PyPDFLoader(str(pdf_file))
            loaded = loader.load()
            for doc in loaded:
                doc.metadata["source_name"] = pdf_file.name
                doc.metadata["file_type"] = "pdf"
            documents.extend(loaded)
            print(f"[DEBUG] Loaded {len(loaded)} page(s) from {pdf_file.name}")
        except Exception as e:
            print(f"[ERROR] Failed to load PDF file {pdf_file.name}: {e}")

    # Plain text documents
    text_files = list(data_path.glob("**/*.txt"))
    if text_files:
        print(f"[INFO] Found {len(text_files)} TXT file(s).")
    for text_file in text_files:
        try:
            loader = TextLoader(str(text_file), encoding="utf-8")
            loaded = loader.load()
            for doc in loaded:
                doc.metadata["source_name"] = text_file.name
                doc.metadata["file_type"] = "txt"
            documents.extend(loaded)
            print(f"[DEBUG] Loaded document from {text_file.name}")
        except Exception as e:
            print(f"[ERROR] Failed to load TXT file {text_file.name}: {e}")

    # Microsoft Word documents (.docx)
    docx_files = list(data_path.glob("**/*.docx"))
    if docx_files:
        print(f"[INFO] Found {len(docx_files)} DOCX file(s).")
    for docx_file in docx_files:
        try:
            loader = Docx2txtLoader(str(docx_file))
            loaded = loader.load()
            for doc in loaded:
                doc.metadata["source_name"] = docx_file.name
                doc.metadata["file_type"] = "docx"
            documents.extend(loaded)
            print(f"[DEBUG] Loaded document from {docx_file.name}")
        except Exception as e:
            print(f"[ERROR] Failed to load DOCX file {docx_file.name}: {e}")

    # JSON documents
    json_files = list(data_path.glob("**/*.json"))
    if json_files:
        print(f"[INFO] Found {len(json_files)} JSON file(s).")
    for json_file in json_files:
        try:
            loader = JSONLoader(str(json_file), jq_schema=".", text_content=False)
            loaded = loader.load()
            for doc in loaded:
                doc.metadata["source_name"] = json_file.name
                doc.metadata["file_type"] = "json"
            documents.extend(loaded)
            print(f"[DEBUG] Loaded JSON document from {json_file.name}")
        except Exception as e:
            print(f"[ERROR] Failed to load JSON file {json_file.name}: {e}")

    # CSV documents
    csv_files = list(data_path.glob("**/*.csv"))
    if csv_files:
        print(f"[INFO] Found {len(csv_files)} CSV file(s).")
    for csv_file in csv_files:
        try:
            loader = CSVLoader(str(csv_file))
            loaded = loader.load()
            for doc in loaded:
                doc.metadata["source_name"] = csv_file.name
                doc.metadata["file_type"] = "csv"
            documents.extend(loaded)
            print(f"[DEBUG] Loaded CSV document from {csv_file.name}")
        except Exception as e:
            print(f"[ERROR] Failed to load CSV file {csv_file.name}: {e}")

    # Excel documents (.xlsx)
    xlsx_files = list(data_path.glob("**/*.xlsx"))
    if xlsx_files:
        print(f"[INFO] Found {len(xlsx_files)} XLSX file(s).")
    for xlsx_file in xlsx_files:
        try:
            loader = UnstructuredExcelLoader(str(xlsx_file))
            loaded = loader.load()
            for doc in loaded:
                doc.metadata["source_name"] = xlsx_file.name
                doc.metadata["file_type"] = "xlsx"
            documents.extend(loaded)
            print(f"[DEBUG] Loaded Excel document from {xlsx_file.name}")
        except Exception as e:
            print(f"[ERROR] Failed to load XLSX file {xlsx_file.name}: {e}")

    print(f"[INFO] Ingestion complete. Total document chunks loaded: {len(documents)}")
    return documents


def load_single_document(file_path: str) -> List[Any]:
    """Load any document kind from file_path into LangChain Document format."""
    from langchain_core.documents import Document

    path = Path(file_path).resolve()
    ext = path.suffix.lower()
    documents: List[Any] = []

    try:
        if ext == ".pdf":
            loader = PyPDFLoader(str(path))
            documents = loader.load()
        elif ext in [".txt", ".md", ".text", ".py", ".js", ".ts", ".html", ".css", ".yaml", ".yml", ".toml", ".sh"]:
            loader = TextLoader(str(path), encoding="utf-8")
            documents = loader.load()
        elif ext == ".docx":
            loader = Docx2txtLoader(str(path))
            documents = loader.load()
        elif ext == ".json":
            loader = JSONLoader(str(path), jq_schema=".", text_content=False)
            documents = loader.load()
        elif ext == ".csv":
            loader = CSVLoader(str(path))
            documents = loader.load()
        else:
            # Universal fallback: read text with errors ignored
            with open(path, "r", encoding="utf-8", errors="ignore") as f:
                content = f.read()
            if content.strip():
                documents = [Document(page_content=content, metadata={"source": str(path)})]
    except Exception as e:
        print(f"[WARN] Specific loader failed for {path.name}: {e}. Falling back to universal text reader.")
        try:
            with open(path, "r", encoding="utf-8", errors="ignore") as f:
                content = f.read()
            if content.strip():
                documents = [Document(page_content=content, metadata={"source": str(path)})]
        except Exception as fallback_err:
            print(f"[ERROR] Failed to read {path.name}: {fallback_err}")
            return []

    for doc in documents:
        doc.metadata["source_name"] = path.name
        doc.metadata["file_type"] = ext.lstrip(".") or "unknown"

    print(f"[INFO] Loaded {len(documents)} document chunk(s) from '{path.name}'.")
    return documents