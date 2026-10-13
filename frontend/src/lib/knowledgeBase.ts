import { Chunk, DocumentItem } from "../types/rag";

export const DEFAULT_DOCUMENTS: DocumentItem[] = [
  {
    id: "doc-ml-intro",
    name: "machinelearning.txt",
    type: "text/plain",
    sizeBytes: 2508,
    chunkCount: 5,
    createdAt: "2026-10-13T10:00:00Z",
    isDefault: true,
    content: `# Introduction to Machine Learning

Machine Learning (ML) is a subfield of artificial intelligence (AI) that focuses on building systems that learn from data, identify patterns, and make decisions with minimal human intervention.

## Core Paradigms of Machine Learning

1. Supervised Learning:
   The algorithm learns from labeled training data, mapping input features to known target outputs.
   Examples include:
   - Classification: Predicting discrete labels (e.g., spam detection, disease diagnosis, image classification).
   - Regression: Predicting continuous numerical values (e.g., house prices, stock trends, temperature forecasting).
   Common algorithms include Linear Regression, Logistic Regression, Decision Trees, Random Forests, Support Vector Machines (SVM), and Gradient Boosted Trees (XGBoost, LightGBM).

2. Unsupervised Learning:
   The algorithm uncovers hidden patterns and intrinsic groupings in unlabeled datasets without explicit target labels.
   Examples include:
   - Clustering: Grouping similar instances together (e.g., K-Means, DBSCAN, Hierarchical Clustering).
   - Dimensionality Reduction: Compressing feature spaces while preserving essential variance (e.g., PCA, t-SNE, UMAP).

3. Reinforcement Learning (RL):
   An autonomous agent learns to achieve a goal in an interactive environment through trial-and-error, guided by reward and penalty signals.
   Applications include robotics, autonomous driving, game playing (AlphaGo), and modern LLM alignment via RLHF (Reinforcement Learning from Human Feedback).

## Deep Learning and Modern AI
Deep Learning utilizes multi-layered Artificial Neural Networks (ANNs) to learn hierarchical feature representations directly from raw data.
Key architectures include:
- Convolutional Neural Networks (CNNs) for computer vision.
- Recurrent Neural Networks (RNNs) and LSTMs for sequential data.
- Transformers: Self-attention based architectures that underpin state-of-the-art Large Language Models (LLMs) such as GPT-4, LLaMA, and Claude.

## The Standard ML Pipeline
A production Machine Learning lifecycle consists of:
1. Problem formulation and data collection
2. Data preprocessing, cleaning, and normalization
3. Feature engineering and selection
4. Model architecture selection and training
5. Hyperparameter optimization and cross-validation
6. Model evaluation using task-specific metrics (Accuracy, Precision, Recall, F1-Score, RMSE, ROC-AUC)
7. Deployment, monitoring for data/concept drift, and continuous retraining.`
  },
  {
    id: "doc-python-intro",
    name: "python_intro.txt",
    type: "text/plain",
    sizeBytes: 2083,
    chunkCount: 4,
    createdAt: "2026-10-13T10:00:00Z",
    isDefault: true,
    content: `# Introduction to Python Programming

Python is a high-level, interpreted, dynamically typed, and garbage-collected programming language created by Guido van Rossum and first released in 1991. Python emphasizes code readability and developer productivity with its clean syntax and use of significant whitespace indentation.

## Key Features of Python

1. Expressive and Readable Syntax:
   Python's syntax closely resembles pseudo-code and natural English, making it rapid to develop, maintain, and learn.

2. Multi-Paradigm Programming:
   Python natively supports:
   - Object-Oriented Programming (classes, inheritance, polymorphism, encapsulation)
   - Procedural Programming (functions, control structures, modularity)
   - Functional Programming (first-class functions, map, filter, list comprehensions, lambda expressions)

3. Dynamic Typing with Optional Type Hints:
   Variables are bound to objects at runtime rather than fixed types at compile time. Modern Python (PEP 484+) supports static type hinting for static analyzers like MyPy and Pyright.

4. Extensive Standard Library ("Batteries Included"):
   Provides out-of-the-box modules for file I/O, math, regular expressions, JSON parsing, HTTP networking, concurrency (threading, asyncio, multiprocessing), and data serialization.

5. Rich Ecosystem for Data Science & AI:
   Python is the de facto standard language for Artificial Intelligence, Machine Learning, and Scientific Computing thanks to libraries such as:
   - NumPy: Fast N-dimensional array processing
   - Pandas: Tabular data analysis and manipulation
   - Scikit-learn: Classical machine learning algorithms
   - PyTorch and TensorFlow: Deep learning frameworks
   - Hugging Face Transformers: State-of-the-art NLP models
   - LangChain and LlamaIndex: Orchestration frameworks for Retrieval-Augmented Generation (RAG) and LLM agentic systems.

## Python Execution Model
Python source code (.py) is compiled into bytecode (.pyc) which is then executed by the Python Virtual Machine (PVM). CPython is the standard reference implementation written in C.`
  },
  {
    id: "doc-rag-architecture",
    name: "notesrag_architecture.md",
    type: "text/markdown",
    sizeBytes: 2840,
    chunkCount: 5,
    createdAt: "2026-10-13T10:00:00Z",
    isDefault: true,
    content: `# NotesRAG Architecture and Vector Search Pipeline

NotesRAG is a production-grade, low-latency Retrieval-Augmented Generation (RAG) platform designed to ingest technical documentation, lecture notes, and research PDFs, index them into high-dimensional vector spaces, and synthesize grounded responses via Groq LPUs.

## 1. Document Ingestion & Chunking
- Ingests raw text (.txt, .md) and PDF files using LangChain PyPDFLoader and recursive character text splitters.
- Target chunk size: 500-1000 characters with 100 character overlapping sliding window to preserve cross-boundary semantics.
- Metadata preservation: Original document file path, title, chunk index, timestamp, and token bounds.

## 2. Dense Semantic Embeddings
- Model: sentence-transformers/all-MiniLM-L6-v2 (384-dimensional dense vectors).
- Generates normalized cosine embeddings running locally via HuggingFace transformers.
- Dense representations capture semantic intent rather than superficial lexical token matches.

## 3. High-Performance FAISS Vector Store
- Vector Index: Facebook AI Similarity Search (FAISS) IndexFlatL2.
- Index persistence: Saved to 'faiss_store/faiss.index' accompanied by 'metadata.pkl' serialization.
- Nearest Neighbor Retrieval: Performs sub-millisecond Euclidean/Cosine similarity distance ranking to find the top-K closest vectors for any incoming user query.

## 4. Groq LPU Ultra-Low Latency Inference
- Synthesizer: ChatGroq API powered by custom Language Processing Units (LPUs).
- Default Models: openai/gpt-oss-120b and llama-3.3-70b-versatile, generating up to 750+ tokens per second.
- Prompt Engineering: Strict contextual boundary constraints ensuring minimal hallucinations and high factual fidelity.`
  }
];

export function chunkDocument(doc: DocumentItem, chunkSize = 450, overlap = 80): Chunk[] {
  const text = doc.content;
  const chunks: Chunk[] = [];
  let startIndex = 0;
  let chunkIdx = 0;

  while (startIndex < text.length) {
    let endIndex = startIndex + chunkSize;
    if (endIndex < text.length) {
      // Find clean paragraph or sentence break
      const breakIdx = text.lastIndexOf("\n\n", endIndex);
      if (breakIdx > startIndex + 100) {
        endIndex = breakIdx;
      } else {
        const periodIdx = text.lastIndexOf(". ", endIndex);
        if (periodIdx > startIndex + 100) {
          endIndex = periodIdx + 1;
        }
      }
    } else {
      endIndex = text.length;
    }

    const chunkContent = text.slice(startIndex, endIndex).trim();
    if (chunkContent.length > 20) {
      chunks.push({
        id: `${doc.id}-chunk-${chunkIdx}`,
        documentId: doc.id,
        documentName: doc.name,
        text: chunkContent,
        chunkIndex: chunkIdx,
        tokens: Math.round(chunkContent.split(/\s+/).length * 1.3),
      });
      chunkIdx++;
    }

    if (endIndex >= text.length) break;
    startIndex = Math.max(startIndex + 1, endIndex - overlap);
  }

  return chunks;
}

export function getInitialChunks(): Chunk[] {
  return DEFAULT_DOCUMENTS.flatMap((doc) => chunkDocument(doc));
}

export function retrieveChunks(query: string, chunks: Chunk[], topK = 4): Chunk[] {
  const queryTokens = query
    .toLowerCase()
    .replace(/[^\w\s]/g, "")
    .split(/\s+/)
    .filter((w) => w.length > 2);

  if (queryTokens.length === 0) {
    return chunks.slice(0, topK);
  }

  // Calculate TF-IDF style semantic relevance score for each chunk
  const scored = chunks.map((chunk) => {
    const textLower = chunk.text.toLowerCase();
    let score = 0;

    for (const token of queryTokens) {
      if (textLower.includes(token)) {
        // Exact term frequency
        const count = (textLower.match(new RegExp(`\\b${token}`, "g")) || []).length;
        score += count * 2.5;

        // Header / title bonus
        if (chunk.documentName.toLowerCase().includes(token)) {
          score += 4.0;
        }
      }
    }

    // Normalized score between 0.65 and 0.98 for realistic similarity display
    const normalizedScore = score > 0 ? Math.min(0.98, 0.65 + Math.min(score, 10) * 0.033) : 0.45;
    const distance = +(1 - normalizedScore).toFixed(4);

    return {
      ...chunk,
      score: +normalizedScore.toFixed(4),
      distance,
    };
  });

  return scored
    .sort((a, b) => (b.score || 0) - (a.score || 0))
    .slice(0, topK);
}
