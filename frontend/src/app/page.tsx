"use client";

import React, { useState, useEffect, useCallback, useRef } from "react";
import { UploadView } from "../components/UploadView";
import { MinimalChatView } from "../components/MinimalChatView";
import { ChatMessage, Chunk, DocumentItem } from "../types/rag";
import { DEFAULT_DOCUMENTS, chunkDocument } from "../lib/knowledgeBase";

export default function Home() {
  const [activeFileNames, setActiveFileNames] = useState<string[]>([]);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isBackendConnected, setIsBackendConnected] = useState(false);
  const [theme, setTheme] = useState<"dark" | "light">("dark");
  const [uploadedChunks, setUploadedChunks] = useState<Chunk[]>([]);

  const abortControllerRef = useRef<AbortController | null>(null);

  // Apply Theme to <html> element
  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
    if (theme === "dark") {
      document.documentElement.classList.add("dark");
    } else {
      document.documentElement.classList.remove("dark");
    }
  }, [theme]);

  // Toggle Theme
  const toggleTheme = () => {
    setTheme((prev) => (prev === "dark" ? "light" : "dark"));
  };

  // Check Python FastAPI backend health (only when local or NEXT_PUBLIC_BACKEND_URL is set)
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

  // Handle Multi-File Upload
  const handleFilesUpload = async (files: File[]): Promise<boolean> => {
    if (!files || files.length === 0) return false;

    try {
      const formData = new FormData();
      files.forEach((file) => {
        formData.append("files", file);
      });

      // 1. Process via Next.js Serverless route (works 100% on Vercel & locally in <200ms)
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

        // Async sync to local Python FAISS backend if connected
        if (isBackendConnected) {
          const backendUrl =
            process.env.NEXT_PUBLIC_BACKEND_URL || "http://127.0.0.1:8000";
          fetch(`${backendUrl}/api/upload`, {
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


  // Handle Sample File Click
  const handleSampleSelected = (sampleName: string) => {
    setActiveFileNames([sampleName]);
    setMessages([]);

    const found = DEFAULT_DOCUMENTS.find((d) => d.name === sampleName);
    if (found) {
      setUploadedChunks(chunkDocument(found));
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
      // If Python backend is connected, query Python server
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

      // Edge API fallback
      const activeChunks =
        uploadedChunks.length > 0
          ? uploadedChunks
          : DEFAULT_DOCUMENTS.flatMap((d) => chunkDocument(d));

      const res = await fetch("/api/rag", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: controller.signal,
        body: JSON.stringify({
          query,
          topK: 4,
          chunks: activeChunks,
        }),
      });

      if (!res.ok) {
        throw new Error(`API error: ${res.status}`);
      }

      const data = await res.json();
      const assistantMsg: ChatMessage = {
        id: `msg-${Date.now()}-asst`,
        role: "assistant",
        content: data.answer,
        timestamp: Date.now(),
        retrievedChunks: data.retrievedChunks || [],
        latencyMs: data.latencyMs,
        modelUsed: data.model,
        sourceMode: "vercel-cloud",
      };

      setMessages((prev) => [...prev, assistantMsg]);
    } catch (err: unknown) {
      if (err instanceof DOMException && err.name === "AbortError") {
        // Request aborted by user clicking stop
        return;
      }
      const errMsg = err instanceof Error ? err.message : "Error querying model";
      const errorMsg: ChatMessage = {
        id: `msg-${Date.now()}-err`,
        role: "assistant",
        content: `**Error**: ${errMsg}. Please check backend connection.`,
        timestamp: Date.now(),
      };
      setMessages((prev) => [...prev, errorMsg]);
    } finally {
      setIsLoading(false);
      abortControllerRef.current = null;
    }
  };

  const handleClearChat = () => {
    setMessages([]);
  };

  const handleUploadNewFile = () => {
    setActiveFileNames([]);
    setMessages([]);
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-zinc-950">
      {activeFileNames.length === 0 ? (
        <UploadView
          onFilesSelected={handleFilesUpload}
          onSampleSelected={handleSampleSelected}
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
          onUploadNewFile={handleUploadNewFile}
          isBackendConnected={isBackendConnected}
          theme={theme}
          onToggleTheme={toggleTheme}
        />
      )}
    </div>
  );
}
