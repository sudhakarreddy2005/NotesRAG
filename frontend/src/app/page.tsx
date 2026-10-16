"use client";

import React, { useState, useEffect, useCallback, useRef } from "react";
import { UploadView } from "../components/UploadView";
import { MinimalChatView } from "../components/MinimalChatView";
import { ChatMessage, Chunk, DocumentItem } from "../types/rag";
import { chunkDocument } from "../lib/knowledgeBase";

const STORAGE_FILES_KEY = "notesrag_active_files";
const STORAGE_CHUNKS_KEY = "notesrag_uploaded_chunks";
const STORAGE_MESSAGES_KEY = "notesrag_messages";

export default function Home() {
  const [activeFileNames, setActiveFileNames] = useState<string[]>([]);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isBackendConnected, setIsBackendConnected] = useState(false);
  const [theme, setTheme] = useState<"dark" | "light">("dark");
  const [uploadedChunks, setUploadedChunks] = useState<Chunk[]>([]);
  const [isHydrated, setIsHydrated] = useState(false);

  const abortControllerRef = useRef<AbortController | null>(null);

  // 1. Restore active session from localStorage on initial load / refresh
  useEffect(() => {
    try {
      const savedFiles = localStorage.getItem(STORAGE_FILES_KEY);
      const savedChunks = localStorage.getItem(STORAGE_CHUNKS_KEY);
      const savedMessages = localStorage.getItem(STORAGE_MESSAGES_KEY);

      if (savedFiles) {
        const parsedFiles = JSON.parse(savedFiles);
        if (Array.isArray(parsedFiles) && parsedFiles.length > 0) {
          setActiveFileNames(parsedFiles);
        }
      }
      if (savedChunks) {
        const parsedChunks = JSON.parse(savedChunks);
        if (Array.isArray(parsedChunks) && parsedChunks.length > 0) {
          setUploadedChunks(parsedChunks);
        }
      }
      if (savedMessages) {
        const parsedMessages = JSON.parse(savedMessages);
        if (Array.isArray(parsedMessages) && parsedMessages.length > 0) {
          setMessages(parsedMessages);
        }
      }
    } catch (err) {
      console.warn("Could not restore session from localStorage:", err);
    } finally {
      setIsHydrated(true);
    }
  }, []);

  // 2. Persist active file names whenever updated
  useEffect(() => {
    if (!isHydrated) return;
    try {
      if (activeFileNames.length > 0) {
        localStorage.setItem(STORAGE_FILES_KEY, JSON.stringify(activeFileNames));
      } else {
        localStorage.removeItem(STORAGE_FILES_KEY);
      }
    } catch (e) {
      console.warn("Could not persist active files to localStorage:", e);
    }
  }, [activeFileNames, isHydrated]);

  // 3. Persist uploaded document chunks whenever updated
  useEffect(() => {
    if (!isHydrated) return;
    try {
      if (uploadedChunks.length > 0) {
        localStorage.setItem(STORAGE_CHUNKS_KEY, JSON.stringify(uploadedChunks));
      } else {
        localStorage.removeItem(STORAGE_CHUNKS_KEY);
      }
    } catch (e) {
      console.warn("Could not persist chunks to localStorage:", e);
    }
  }, [uploadedChunks, isHydrated]);

  // 4. Persist messages whenever updated
  useEffect(() => {
    if (!isHydrated) return;
    try {
      if (messages.length > 0) {
        localStorage.setItem(STORAGE_MESSAGES_KEY, JSON.stringify(messages));
      } else {
        localStorage.removeItem(STORAGE_MESSAGES_KEY);
      }
    } catch (e) {
      console.warn("Could not persist messages to localStorage:", e);
    }
  }, [messages, isHydrated]);

  // Apply Theme to <html> element
  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
    if (theme === "dark") {
      document.documentElement.classList.add("dark");
    } else {
      document.documentElement.classList.remove("dark");
    }
  }, [theme]);

  const toggleTheme = () => {
    setTheme((prev) => (prev === "dark" ? "light" : "dark"));
  };

  // Check Python FastAPI backend health
  const checkBackendHealth = useCallback(async (): Promise<boolean> => {
    if (typeof window === "undefined") return false;
    const isLocal =
      window.location.hostname === "localhost" ||
      window.location.hostname === "127.0.0.1";
    const backendUrl =
      process.env.NEXT_PUBLIC_BACKEND_URL || (isLocal ? "http://127.0.0.1:8000" : null);

    if (!backendUrl) return false;

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 1500);
      const res = await fetch(`${backendUrl}/api/health`, {
        signal: controller.signal,
      });
      clearTimeout(timeoutId);
      return res.ok;
    } catch {
      return false;
    }
  }, []);

  useEffect(() => {
    let isMounted = true;
    const runCheck = () => {
      checkBackendHealth().then((online) => {
        if (isMounted) {
          setIsBackendConnected(online);
        }
      });
    };

    runCheck();
    const interval = setInterval(runCheck, 15000);
    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, [checkBackendHealth]);

  // Handle Multi-File Upload with Fresh Session Isolation
  const handleFilesUpload = async (files: File[]): Promise<boolean> => {
    if (!files || files.length === 0) return false;

    try {
      const formData = new FormData();
      files.forEach((file) => {
        formData.append("files", file);
      });

      // 1. Process via Next.js Serverless route
      const serverlessRes = await fetch("/api/upload", {
        method: "POST",
        body: formData,
      });

      if (serverlessRes.ok) {
        const data = await serverlessRes.json();
        const names = data.filenames || files.map((f) => f.name);
        if (data.chunks && data.chunks.length > 0) {
          setUploadedChunks(data.chunks);
        }
        setActiveFileNames(names);
        setMessages([]);

        // Async sync to local Python FAISS backend with clear_previous to guarantee isolation
        if (isBackendConnected) {
          const backendUrl =
            process.env.NEXT_PUBLIC_BACKEND_URL || "http://127.0.0.1:8000";
          fetch(`${backendUrl}/api/upload?clear_previous=true`, {
            method: "POST",
            body: formData,
          }).catch(() => {});
        }

        return true;
      }

      // 2. Client-side fallback if serverless threw
      const newChunks: Chunk[] = [];
      const names: string[] = [];

      for (const file of files) {
        names.push(file.name);
        try {
          const text = await file.text();
          const newDoc: DocumentItem = {
            id: `upload-${file.name}-${Date.now()}`,
            name: file.name,
            type: file.type || "text/plain",
            sizeBytes: file.size,
            chunkCount: Math.max(1, Math.round(text.length / 500)),
            content: text,
            createdAt: new Date().toISOString(),
            isDefault: false,
          };
          const chunks = chunkDocument(newDoc);
          newChunks.push(...chunks);
        } catch (readErr) {
          console.warn(`Could not read text for ${file.name}:`, readErr);
        }
      }

      setUploadedChunks(newChunks);
      setActiveFileNames(names);
      setMessages([]);
      return true;
    } catch (err) {
      console.error("Upload error:", err);
      return false;
    }
  };

  // Handle adding more files to the current active session
  const handleAddFiles = async (files: File[]): Promise<boolean> => {
    if (!files || files.length === 0) return false;

    try {
      const formData = new FormData();
      files.forEach((file) => {
        formData.append("files", file);
      });

      // 1. Process via Next.js Serverless route
      const serverlessRes = await fetch("/api/upload", {
        method: "POST",
        body: formData,
      });

      if (serverlessRes.ok) {
        const data = await serverlessRes.json();
        const incomingNames: string[] = data.filenames || files.map((f) => f.name);

        setActiveFileNames((prev) => Array.from(new Set([...prev, ...incomingNames])));
        if (data.chunks && data.chunks.length > 0) {
          setUploadedChunks((prev) => [...prev, ...data.chunks]);
        }

        // Sync to backend with clear_previous=false to append
        if (isBackendConnected) {
          const backendUrl =
            process.env.NEXT_PUBLIC_BACKEND_URL || "http://127.0.0.1:8000";
          fetch(`${backendUrl}/api/upload?clear_previous=false`, {
            method: "POST",
            body: formData,
          }).catch(() => {});
        }

        return true;
      }

      // 2. Client-side fallback
      const newChunks: Chunk[] = [];
      const newNames: string[] = [];

      for (const file of files) {
        newNames.push(file.name);
        try {
          const text = await file.text();
          const newDoc: DocumentItem = {
            id: `upload-${file.name}-${Date.now()}`,
            name: file.name,
            type: file.type || "text/plain",
            sizeBytes: file.size,
            chunkCount: Math.max(1, Math.round(text.length / 500)),
            content: text,
            createdAt: new Date().toISOString(),
            isDefault: false,
          };
          const chunks = chunkDocument(newDoc);
          newChunks.push(...chunks);
        } catch (readErr) {
          console.warn(`Could not read text for ${file.name}:`, readErr);
        }
      }

      setActiveFileNames((prev) => Array.from(new Set([...prev, ...newNames])));
      setUploadedChunks((prev) => [...prev, ...newChunks]);
      return true;
    } catch (err) {
      console.error("Add files error:", err);
      return false;
    }
  };

  // Stop generation action
  const handleStopGeneration = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    setIsLoading(false);
  };

  // Start a completely fresh new session
  const handleNewSession = async () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    setMessages([]);
    setActiveFileNames([]);
    setUploadedChunks([]);
    setIsLoading(false);

    try {
      localStorage.removeItem(STORAGE_FILES_KEY);
      localStorage.removeItem(STORAGE_CHUNKS_KEY);
      localStorage.removeItem(STORAGE_MESSAGES_KEY);
    } catch {}

    // Call Python backend to clear files and FAISS vector index
    if (isBackendConnected) {
      const backendUrl =
        process.env.NEXT_PUBLIC_BACKEND_URL || "http://127.0.0.1:8000";
      fetch(`${backendUrl}/api/clear`, {
        method: "POST",
      }).catch(() => {});
    }
  };

  const handleClearChat = () => {
    setMessages([]);
    try {
      localStorage.removeItem(STORAGE_MESSAGES_KEY);
    } catch {}
  };

  // Send Question to RAG Backend
  const handleSendMessage = async (query: string) => {
    const userMsg: ChatMessage = {
      id: `msg-${Date.now()}-user`,
      role: "user",
      content: query,
      timestamp: Date.now(),
    };

    setMessages((prev) => [...prev, userMsg]);
    setIsLoading(true);

    const controller = new AbortController();
    abortControllerRef.current = controller;

    try {
      // --- Path A: Python FastAPI backend (FAISS + Groq) ---
      if (isBackendConnected) {
        const backendUrl =
          process.env.NEXT_PUBLIC_BACKEND_URL || "http://127.0.0.1:8000";
        const res = await fetch(`${backendUrl}/api/query`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          signal: controller.signal,
          body: JSON.stringify({
            query,
            top_k: 4,
            active_files: activeFileNames,
          }),
        });

        if (res.ok) {
          const data = await res.json();
          const assistantMsg: ChatMessage = {
            id: `msg-${Date.now()}-asst`,
            role: "assistant",
            content: data.answer,
            timestamp: Date.now(),
            retrievedChunks: data.retrievedChunks || [],
            latencyMs: data.latencyMs,
            modelUsed: data.model,
            sourceMode: "python-faiss",
          };
          setMessages((prev) => [...prev, assistantMsg]);
          setIsLoading(false);
          return;
        }
      }

      // --- Path B: Serverless SSE streaming ---
      if (uploadedChunks.length === 0) {
        throw new Error("No documents loaded in this session. Please upload a document first.");
      }

      const sseRes = await fetch("/api/query/stream", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: controller.signal,
        body: JSON.stringify({
          query,
          topK: 4,
          chunks: uploadedChunks,
        }),
      });

      if (!sseRes.ok || !sseRes.body) {
        throw new Error(`Stream error: ${sseRes.status}`);
      }

      // Build a placeholder assistant message that we update incrementally
      const asstId = `msg-${Date.now()}-asst`;
      const asstMsg: ChatMessage = {
        id: asstId,
        role: "assistant",
        content: "",
        timestamp: Date.now(),
        retrievedChunks: [],
        sourceMode: "vercel-cloud",
      };
      setMessages((prev) => [...prev, asstMsg]);

      const reader = sseRes.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let fullContent = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";

        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          const raw = line.slice(6).trim();
          try {
            const event = JSON.parse(raw) as {
              type: string;
              content?: string;
              chunks?: Chunk[];
              retrieval?: number;
              inference?: number;
              total?: number;
              model?: string;
              message?: string;
            };

            if (event.type === "chunk" && event.content) {
              fullContent += event.content;
              setMessages((prev) =>
                prev.map((m) => (m.id === asstId ? { ...m, content: fullContent } : m))
              );
            } else if (event.type === "citations" && event.chunks) {
              setMessages((prev) =>
                prev.map((m) =>
                  m.id === asstId ? { ...m, retrievedChunks: event.chunks } : m
                )
              );
            } else if (event.type === "latency") {
              setMessages((prev) =>
                prev.map((m) =>
                  m.id === asstId
                    ? {
                        ...m,
                        latencyMs: {
                          retrieval: event.retrieval ?? 0,
                          inference: event.inference ?? 0,
                          total: event.total ?? 0,
                        },
                        modelUsed: event.model,
                      }
                    : m
                )
              );
            } else if (event.type === "error") {
              throw new Error(event.message || "Stream error");
            }
          } catch {
            // Malformed SSE line — skip
          }
        }
      }
    } catch (err: unknown) {
      if (err instanceof DOMException && err.name === "AbortError") {
        return;
      }
      const errMsg = err instanceof Error ? err.message : "Error querying model";
      const errorMsg: ChatMessage = {
        id: `msg-${Date.now()}-err`,
        role: "assistant",
        content: `**Error**: ${errMsg}. Please check your connection or try again.`,
        timestamp: Date.now(),
      };
      setMessages((prev) => [...prev, errorMsg]);
    } finally {
      setIsLoading(false);
      abortControllerRef.current = null;
    }
  };

  // Avoid flash of upload screen during localStorage rehydration on page refresh
  if (!isHydrated) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-zinc-950 flex items-center justify-center">
        <div className="w-8 h-8 rounded-full border-2 border-emerald-500/20 border-t-emerald-500 animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-zinc-950">
      {activeFileNames.length === 0 ? (
        <UploadView
          onFilesSelected={handleFilesUpload}
          isBackendConnected={isBackendConnected}
        />
      ) : (
        <MinimalChatView
          activeFileNames={activeFileNames}
          messages={messages}
          isLoading={isLoading}
          onSendMessage={handleSendMessage}
          onStopGeneration={handleStopGeneration}
          onClearChat={handleClearChat}
          onNewSession={handleNewSession}
          onAddFiles={handleAddFiles}
          isBackendConnected={isBackendConnected}
          theme={theme}
          onToggleTheme={toggleTheme}
        />
      )}
    </div>
  );
}
