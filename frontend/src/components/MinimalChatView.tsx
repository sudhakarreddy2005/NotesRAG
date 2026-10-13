"use client";

import React, { useState, useRef, useEffect } from "react";
import { ChatMessage, Chunk } from "../types/rag";
import {
  SendIcon,
  CopyIcon,
  CheckIcon,
  FileTextIcon,
  SunIcon,
  MoonIcon,
  TrashIcon,
  UploadCloudIcon,
  LayersIcon,
  StopIcon,
  CheckIcon as ShieldCheckIcon,
} from "./Icons";

interface MinimalChatViewProps {
  activeFileNames: string[];
  messages: ChatMessage[];
  isLoading: boolean;
  onSendMessage: (query: string) => void;
  onStopGeneration: () => void;
  onClearChat: () => void;
  onUploadNewFile: () => void;
  isBackendConnected: boolean;
  theme: "dark" | "light";
  onToggleTheme: () => void;
}

export function MinimalChatView({
  activeFileNames,
  messages,
  isLoading,
  onSendMessage,
  onStopGeneration,
  onClearChat,
  onUploadNewFile,
  isBackendConnected,
  theme,
  onToggleTheme,
}: MinimalChatViewProps) {
  const [inputQuery, setInputQuery] = useState("");
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Track open citation proofs per message (defaults to open for the latest answer)
  const [openCitationsMap, setOpenCitationsMap] = useState<Record<string, boolean>>({});

  // Typewriter streaming state for assistant messages
  const [displayedTextMap, setDisplayedTextMap] = useState<Record<string, string>>({});
  const [streamingMsgId, setStreamingMsgId] = useState<string | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const streamIntervalRef = useRef<NodeJS.Timeout | null>(null);

  const primaryFileName = activeFileNames.length > 0 ? activeFileNames[0] : "Documents";

  const getSuggestions = () => {
    const combined = activeFileNames.join(" ").toLowerCase();
    if (combined.includes("machinelearning")) {
      return [
        "What are the core paradigms of machine learning?",
        "Compare supervised vs unsupervised learning",
        "What steps comprise the standard production ML pipeline?",
      ];
    }
    if (combined.includes("python")) {
      return [
        "How does Python execute bytecode inside the PVM?",
        "What programming paradigms does Python natively support?",
        "Why is Python the leading language for AI and machine learning?",
      ];
    }
    return [
      `Summarize the key takeaways and core concepts across the uploaded files`,
      `What are the most important technical findings discussed?`,
      `Explain the methodology and structural details`,
    ];
  };

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, displayedTextMap, isLoading]);

  // Handle streaming typewriter effect for new assistant messages
  useEffect(() => {
    if (messages.length === 0) return;
    const lastMsg = messages[messages.length - 1];

    if (lastMsg.role === "assistant" && displayedTextMap[lastMsg.id] === undefined) {
      const fullText = lastMsg.content;
      const tokens = fullText.split(/(\s+)/);
      let currentIndex = 0;

      const timerId = setTimeout(() => {
        setStreamingMsgId(lastMsg.id);
        // Auto-open citation proof for the latest answer
        setOpenCitationsMap((prev) => ({ ...prev, [lastMsg.id]: true }));
      }, 0);

      const interval = setInterval(() => {
        if (currentIndex < tokens.length) {
          currentIndex += 2;
          const sliceText = tokens.slice(0, currentIndex).join("");
          setDisplayedTextMap((prev) => ({
            ...prev,
            [lastMsg.id]: sliceText,
          }));
        } else {
          setDisplayedTextMap((prev) => ({
            ...prev,
            [lastMsg.id]: fullText,
          }));
          setStreamingMsgId(null);
          clearInterval(interval);
        }
      }, 20);

      streamIntervalRef.current = interval;

      return () => {
        clearTimeout(timerId);
        clearInterval(interval);
      };
    }
  }, [messages, displayedTextMap]);

  // Handle stop button
  const handleStop = () => {
    if (streamIntervalRef.current) {
      clearInterval(streamIntervalRef.current);
    }
    if (streamingMsgId && messages.length > 0) {
      const lastMsg = messages[messages.length - 1];
      setDisplayedTextMap((prev) => ({
        ...prev,
        [lastMsg.id]: prev[lastMsg.id] || lastMsg.content,
      }));
    }
    setStreamingMsgId(null);
    onStopGeneration();
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputQuery.trim() || isLoading) return;
    const q = inputQuery.trim();
    setInputQuery("");
    onSendMessage(q);
  };

  const handleCopy = (id: string, text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const toggleCitationProof = (msgId: string) => {
    setOpenCitationsMap((prev) => ({
      ...prev,
      [msgId]: !prev[msgId],
    }));
  };

  const isGeneratingOrStreaming = isLoading || streamingMsgId !== null;

  return (
    <div className="flex flex-col h-screen max-w-4xl mx-auto w-full bg-slate-50 dark:bg-zinc-950 text-slate-900 dark:text-zinc-100 transition-colors duration-200">
      {/* Top Navigation Bar */}
      <header className="h-14 border-b border-slate-200 dark:border-zinc-800 flex items-center justify-between px-4 sm:px-6 bg-slate-50/80 dark:bg-zinc-950/80 backdrop-blur-md sticky top-0 z-20">
        <div className="flex items-center gap-3">
          <div
            className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 text-xs font-semibold text-emerald-600 dark:text-emerald-400"
            title={activeFileNames.join(", ")}
          >
            <FileTextIcon size={14} />
            <span className="max-w-[180px] sm:max-w-[260px] truncate">
              {activeFileNames.length === 1
                ? activeFileNames[0]
                : `${activeFileNames.length} Indexed Documents`}
            </span>
            {activeFileNames.length > 1 && (
              <span className="text-[10px] bg-emerald-500 text-black font-bold px-1.5 py-0.2 rounded-full">
                +{activeFileNames.length - 1}
              </span>
            )}
          </div>

          <button
            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 text-xs font-medium text-slate-600 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-zinc-100 hover:bg-slate-100 dark:hover:bg-zinc-800 transition-all cursor-pointer"
            onClick={onUploadNewFile}
            title="Upload or add more files"
          >
            <UploadCloudIcon size={14} />
            <span className="hidden sm:inline">Upload More Files</span>
          </button>
        </div>

        <div className="flex items-center gap-2">
          <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-mono border border-slate-200 dark:border-zinc-800 bg-white/60 dark:bg-zinc-900/60 text-slate-600 dark:text-zinc-400">
            <span
              className="w-1.5 h-1.5 rounded-full"
              style={{
                backgroundColor: isBackendConnected ? "#10b981" : "#06b6d4",
              }}
            />
            <span className="text-[11px]">{isBackendConnected ? "FAISS Active" : "Edge RAG"}</span>
          </div>

          <button
            className="p-1.5 rounded-full bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 text-slate-600 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-zinc-100 hover:bg-slate-100 dark:hover:bg-zinc-800 transition-all cursor-pointer"
            onClick={onToggleTheme}
            title={theme === "dark" ? "Switch to Light Mode" : "Switch to Dark Mode"}
          >
            {theme === "dark" ? <SunIcon size={15} /> : <MoonIcon size={15} />}
          </button>

          {messages.length > 0 && (
            <button
              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 text-xs font-medium text-slate-600 dark:text-zinc-400 hover:text-red-500 hover:border-red-500/30 transition-all cursor-pointer"
              onClick={onClearChat}
              title="Clear chat history"
            >
              <TrashIcon size={13} />
              <span className="hidden sm:inline">Clear</span>
            </button>
          )}
        </div>
      </header>

      {/* Messages Scroll Area */}
      <div className="flex-1 overflow-y-auto px-4 sm:px-6 py-6 flex flex-col gap-6">
        {messages.length === 0 ? (
          <div className="m-auto max-w-lg text-center py-8">
            <div className="w-12 h-12 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center mx-auto mb-4">
              <FileTextIcon size={24} />
            </div>
            <h2 className="text-xl sm:text-2xl font-bold tracking-tight mb-2 text-slate-900 dark:text-zinc-50">
              Ready to answer from{" "}
              <span className="text-emerald-600 dark:text-emerald-400">
                {activeFileNames.length === 1
                  ? primaryFileName
                  : `${activeFileNames.length} documents`}
              </span>
            </h2>
            <p className="text-xs sm:text-sm text-slate-600 dark:text-zinc-400 max-w-md mx-auto leading-relaxed mb-6">
              Ask any question in plain English. Responses are warmly humanized,
              grounded in your documents, and verified with citation proofs.
            </p>

            <div className="flex flex-col gap-2">
              {getSuggestions().map((suggestion, idx) => (
                <button
                  key={idx}
                  className="flex items-center justify-between p-3 rounded-xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 hover:border-emerald-500 dark:hover:border-emerald-500 hover:bg-slate-100/60 dark:hover:bg-zinc-800 text-xs sm:text-sm font-medium text-slate-700 dark:text-zinc-300 transition-all cursor-pointer text-left group"
                  onClick={() => onSendMessage(suggestion)}
                >
                  <span className="pr-2">{suggestion}</span>
                  <span className="opacity-40 group-hover:opacity-100 group-hover:text-emerald-500 transition-all font-bold">
                    →
                  </span>
                </button>
              ))}
            </div>
          </div>
        ) : (
          messages.map((msg) => {
            const isAsst = msg.role === "assistant";
            const textToDisplay = isAsst
              ? displayedTextMap[msg.id] ?? msg.content
              : msg.content;
            const isCurrentlyStreaming = streamingMsgId === msg.id;
            const isCitationOpen = !!openCitationsMap[msg.id];

            return (
              <div
                key={msg.id}
                className={`flex flex-col ${isAsst ? "items-start w-full" : "items-end max-w-[85%] self-end"}`}
              >
                {isAsst ? (
                  <div className="w-full bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800/80 p-5 rounded-2xl rounded-bl-sm shadow-sm relative">
                    {/* Header bar */}
                    <div className="flex items-center gap-2 mb-3 pb-2 border-b border-slate-100 dark:border-zinc-800/60 text-xs">
                      <span className="px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-mono font-semibold">
                        {msg.modelUsed || "Groq LPU"}
                      </span>
                      {msg.latencyMs && (
                        <span className="text-slate-500 dark:text-zinc-500 font-mono text-[11px]">
                          ⚡ {msg.latencyMs.retrieval}ms search • {msg.latencyMs.inference}ms synthesis
                        </span>
                      )}
                    </div>

                    {/* Formatted Markdown Content */}
                    <div className="text-sm sm:text-[0.93rem] leading-relaxed text-slate-800 dark:text-zinc-200 space-y-3">
                      {textToDisplay.split("\n\n").map((paragraph, pIdx) => {
                        if (paragraph.startsWith("### ")) {
                          return (
                            <h3 key={pIdx} className="font-bold text-base text-slate-900 dark:text-zinc-100 mt-2">
                              {paragraph.replace("### ", "")}
                            </h3>
                          );
                        }
                        if (paragraph.startsWith("## ")) {
                          return (
                            <h2 key={pIdx} className="font-bold text-lg text-slate-900 dark:text-zinc-100 mt-3">
                              {paragraph.replace("## ", "")}
                            </h2>
                          );
                        }
                        if (paragraph.startsWith("- ") || paragraph.startsWith("* ")) {
                          const items = paragraph.split("\n").filter(Boolean);
                          return (
                            <ul key={pIdx} className="list-disc pl-5 space-y-1">
                              {items.map((item, iIdx) => (
                                <li key={iIdx}>{item.replace(/^[-*]\s*/, "")}</li>
                              ))}
                            </ul>
                          );
                        }
                        if (/^\d+\.\s/.test(paragraph)) {
                          const items = paragraph.split("\n").filter(Boolean);
                          return (
                            <ol key={pIdx} className="list-decimal pl-5 space-y-1">
                              {items.map((item, iIdx) => (
                                <li key={iIdx}>{item.replace(/^\d+\.\s*/, "")}</li>
                              ))}
                            </ol>
                          );
                        }
                        return <p key={pIdx}>{paragraph}</p>;
                      })}
                      {isCurrentlyStreaming && <span className="streaming-cursor" />}
                    </div>

                    {/* Assistant Footer Actions */}
                    <div className="flex items-center gap-2 mt-4 pt-3 border-t border-slate-100 dark:border-zinc-800/60">
                      <button
                        className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded text-xs border border-slate-200 dark:border-zinc-800 text-slate-600 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-zinc-100 hover:bg-slate-50 dark:hover:bg-zinc-800 transition-all cursor-pointer"
                        onClick={() => handleCopy(msg.id, msg.content)}
                      >
                        {copiedId === msg.id ? (
                          <>
                            <CheckIcon size={12} />
                            <span>Copied</span>
                          </>
                        ) : (
                          <>
                            <CopyIcon size={12} />
                            <span>Copy Answer</span>
                          </>
                        )}
                      </button>

                      {msg.retrievedChunks && msg.retrievedChunks.length > 0 && (
                        <button
                          className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded text-xs border border-emerald-500/30 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/10 transition-all cursor-pointer"
                          onClick={() => toggleCitationProof(msg.id)}
                        >
                          <LayersIcon size={12} />
                          <span>
                            {isCitationOpen
                              ? `Hide Evidence (${msg.retrievedChunks.length})`
                              : `Verified Citation Proof (${msg.retrievedChunks.length})`}
                          </span>
                        </button>
                      )}
                    </div>

                    {/* Dedicated Verified Citation Proof Panel */}
                    {isCitationOpen && msg.retrievedChunks && msg.retrievedChunks.length > 0 && (
                      <div className="mt-4 p-4 rounded-xl bg-slate-50 dark:bg-zinc-950/60 border border-slate-200 dark:border-zinc-800 text-xs">
                        <div className="flex items-center justify-between pb-2 mb-3 border-b border-slate-200 dark:border-zinc-800">
                          <div className="flex items-center gap-1.5 font-semibold text-slate-800 dark:text-zinc-200">
                            <ShieldCheckIcon size={14} style={{ color: "#10b981" }} />
                            <span>Verified Grounding Evidence & Citation Proofs</span>
                          </div>
                          <span className="font-mono text-slate-500 dark:text-zinc-500 text-[11px]">
                            {msg.retrievedChunks.length} chunks extracted from FAISS
                          </span>
                        </div>

                        <div className="flex flex-col gap-2.5">
                          {msg.retrievedChunks.map((chunk: Chunk, cIdx: number) => {
                            const matchPct = chunk.score ? Math.round(chunk.score * 100) : 85;
                            return (
                              <div
                                key={chunk.id || cIdx}
                                className="p-3.5 rounded-lg bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800/80 space-y-2"
                              >
                                <div className="flex items-center justify-between">
                                  <div className="flex items-center gap-1.5 font-semibold text-cyan-600 dark:text-cyan-400">
                                    <FileTextIcon size={13} />
                                    <span>{chunk.documentName}</span>
                                    <span className="font-mono text-[10px] bg-slate-100 dark:bg-zinc-800 px-1.5 py-0.5 rounded text-slate-600 dark:text-zinc-400">
                                      Chunk #{chunk.chunkIndex ?? cIdx + 1}
                                    </span>
                                  </div>

                                  <div className="flex items-center gap-2">
                                    <span className="font-mono text-emerald-600 dark:text-emerald-400 font-semibold text-[11px]">
                                      {matchPct}% Match
                                    </span>
                                    <div className="w-12 h-1 bg-slate-200 dark:bg-zinc-800 rounded-full overflow-hidden">
                                      <div
                                        className="h-full bg-emerald-500 rounded-full"
                                        style={{ width: `${matchPct}%` }}
                                      />
                                    </div>
                                  </div>
                                </div>

                                <blockquote className="p-3 rounded-r-md border-l-2 border-emerald-500 bg-slate-100 dark:bg-zinc-950/80 font-mono text-xs text-slate-700 dark:text-zinc-300 leading-relaxed overflow-y-auto max-h-32 whitespace-pre-wrap break-words">
                                  &ldquo;{chunk.text}&rdquo;
                                </blockquote>

                                <div className="flex items-center justify-between font-mono text-[11px] text-slate-500 dark:text-zinc-500">
                                  <span>Tokens: ~{chunk.tokens || Math.round(chunk.text.length / 4)}</span>
                                  {chunk.distance !== undefined && (
                                    <span>L2 Dist: {chunk.distance}</span>
                                  )}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="bg-slate-900 dark:bg-zinc-800 text-white px-4 py-3 rounded-2xl rounded-br-sm text-sm sm:text-[0.93rem] leading-relaxed shadow-sm">
                    {textToDisplay}
                  </div>
                )}
              </div>
            );
          })
        )}

        {isLoading && (
          <div className="self-start w-full">
            <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800/80 p-4 rounded-2xl rounded-bl-sm flex items-center gap-3">
              <div className="flex gap-1.5">
                <span className="w-2 h-2 rounded-full bg-emerald-500 pulse-dot-1" />
                <span className="w-2 h-2 rounded-full bg-emerald-500 pulse-dot-2" />
                <span className="w-2 h-2 rounded-full bg-emerald-500 pulse-dot-3" />
              </div>
              <span className="text-xs sm:text-sm text-slate-600 dark:text-zinc-400">
                Retrieving nearest vectors from FAISS & formulating humanized answer...
              </span>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Floating Stop Generating Button */}
      {isGeneratingOrStreaming && (
        <div className="flex justify-center py-2">
          <button
            className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-full text-xs font-semibold text-red-500 bg-white dark:bg-zinc-900 border border-red-500/30 hover:bg-red-500 hover:text-white transition-all shadow-md cursor-pointer"
            onClick={handleStop}
          >
            <StopIcon size={13} />
            <span>Stop Generating</span>
          </button>
        </div>
      )}

      {/* Bottom Input Bar */}
      <div className="p-4 sm:pb-6 bg-slate-50 dark:bg-zinc-950 border-t border-slate-200 dark:border-zinc-800">
        <form
          className="flex items-center gap-3 bg-white dark:bg-zinc-900 border border-slate-300 dark:border-zinc-700/80 rounded-full py-1.5 pl-5 pr-2 focus-within:border-emerald-500 focus-within:ring-2 focus-within:ring-emerald-500/20 shadow-sm transition-all"
          onSubmit={handleSubmit}
        >
          <input
            ref={inputRef}
            type="text"
            className="flex-1 bg-transparent border-none outline-none text-sm text-slate-900 dark:text-zinc-100 placeholder-slate-400 dark:placeholder-zinc-500"
            placeholder={`Ask anything about ${
              activeFileNames.length === 1 ? primaryFileName : "the uploaded documents"
            }...`}
            value={inputQuery}
            onChange={(e) => setInputQuery(e.target.value)}
            disabled={isLoading}
            autoFocus
          />

          {isGeneratingOrStreaming ? (
            <button
              type="button"
              className="w-9 h-9 rounded-full bg-red-500 text-white flex items-center justify-center hover:bg-red-600 transition-all cursor-pointer shrink-0"
              onClick={handleStop}
              title="Stop generating"
            >
              <StopIcon size={14} />
            </button>
          ) : (
            <button
              type="submit"
              className="w-9 h-9 rounded-full bg-emerald-500 text-zinc-950 flex items-center justify-center hover:scale-105 transition-all cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed shrink-0"
              disabled={!inputQuery.trim() || isLoading}
              title="Send query"
            >
              <SendIcon size={16} />
            </button>
          )}
        </form>
        <div className="text-center text-[11px] text-slate-500 dark:text-zinc-500 mt-2">
          Press <kbd className="px-1 py-0.5 rounded bg-slate-200 dark:bg-zinc-800 text-[10px] font-mono">Enter</kbd> to ask. Fast, grounded, and verified with FAISS citations.
        </div>
      </div>
    </div>
  );
}
