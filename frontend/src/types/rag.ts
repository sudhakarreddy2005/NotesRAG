export interface Chunk {
  id: string;
  documentId: string;
  documentName: string;
  text: string;
  chunkIndex: number;
  tokens: number;
  score?: number;
  distance?: number;
  embeddingSnippet?: number[];
}

export interface DocumentItem {
  id: string;
  name: string;
  type: string;
  sizeBytes: number;
  chunkCount: number;
  content: string;
  createdAt: string;
  isDefault?: boolean;
}

export interface ChatMessage {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  timestamp: number;
  retrievedChunks?: Chunk[];
  latencyMs?: {
    retrieval: number;
    inference: number;
    total: number;
  };
  modelUsed?: string;
  sourceMode?: "vercel-cloud" | "python-faiss";
}

export interface RagSettings {
  groqApiKey: string;
  model: string;
  topK: number;
  temperature: number;
  useLocalBackend: boolean;
  localBackendUrl: string;
}

export interface QueryResponse {
  answer: string;
  retrievedChunks: Chunk[];
  latencyMs: {
    retrieval: number;
    inference: number;
    total: number;
  };
  model: string;
  sourceMode: "vercel-cloud" | "python-faiss";
}
