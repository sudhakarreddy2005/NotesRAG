"use client";

import React, { useState, useRef, useEffect } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
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
  PlusCircleIcon,
  ZapIcon,
  CheckIcon as ShieldCheckIcon,
} from "./Icons";

interface MinimalChatViewProps {
  activeFileNames: string[];
  messages: ChatMessage[];
  isLoading: boolean;
  onSendMessage: (query: string) => void;
  onStopGeneration: () => void;
  onClearChat: () => void;
  onNewSession: () => void;
  onAddFiles: (files: File[]) => Promise<boolean>;
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
  onNewSession,
  onAddFiles,
  isBackendConnected,
  theme,
  onToggleTheme,
}: MinimalChatViewProps) {
  const [inputQuery, setInputQuery] = useState("");
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [openCitationsMap, setOpenCitationsMap] = useState<Record<string, boolean>>({});
  const [isUploadingMore, setIsUploadingMore] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const addFileInputRef = useRef<HTMLInputElement>(null);

  const primaryFileName = activeFileNames.length > 0 ? activeFileNames[0] : "Documents";

  // Dynamic suggestions derived from the actual uploaded document names
  const getSuggestions = () => {
    const docLabel = activeFileNames.length === 1 ? primaryFileName : "these documents";
    return [
      `Summarize the key takeaways and core concepts in ${docLabel}`,
      `What are the most critical technical details or findings discussed?`,
      `Extract any step-by-step methodologies, rules, or instructions`,
      `List key numbers, metrics, or factual statements with citations`,
    ];
  };

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isLoading]);

  // Auto-open citation proof panel for the latest assistant message
  useEffect(() => {
    if (messages.length === 0) return;
    const lastMsg = messages[messages.length - 1];
    if (lastMsg.role === "assistant" && lastMsg.content) {
      setOpenCitationsMap((prev) => ({ ...prev, [lastMsg.id]: true }));
    }
  }, [messages]);

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

  const handleAddFileInputChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      setIsUploadingMore(true);
      try {
        await onAddFiles(Array.from(e.target.files));
      } finally {
        setIsUploadingMore(false);
        if (addFileInputRef.current) addFileInputRef.current.value = "";
      }
    }
  };

  // Determine if we need to show the dedicated loading skeleton
  const lastMsg = messages[messages.length - 1];
  const showLoadingSkeleton =
    isLoading &&
    (!lastMsg || lastMsg.role === "user" || lastMsg.content.trim() === "");

  return (
    <div className="flex flex-col h-screen max-w-5xl mx-auto w-full bg-slate-50 dark:bg-zinc-950 text-slate-900 dark:text-zinc-100 transition-colors duration-200">
      {/* Hidden file input for adding more documents */}
      <input
        ref={addFileInputRef}
        type="file"
        multiple
        accept=".pdf,.txt,.md,.json,.csv,.doc,.docx"
        className="hidden"
        onChange={handleAddFileInputChange}
      />

      {/* Top Navigation Bar */}
      <header className="h-14 border-b border-slate-200 dark:border-zinc-800 flex items-center justify-between px-4 sm:px-6 bg-slate-50/90 dark:bg-zinc-950/90 backdrop-blur-md sticky top-0 z-20">
        <div className="flex items-center gap-2 sm:gap-3">
          {/* Active Session Files Pill */}
          <div
            className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 text-xs font-semibold text-emerald-600 dark:text-emerald-400 shadow-sm"
            title={activeFileNames.join(", ")}
          >
            <FileTextIcon size={14} />
            <span className="max-w-[140px] sm:max-w-[220px] truncate">
              {activeFileNames.length === 1
                ? activeFileNames[0]
                : `${activeFileNames.length} Indexed Docs`}
            </span>
            {activeFileNames.length > 1 && (
              <span className="text-[10px] bg-emerald-500 text-black font-bold px-1.5 py-0.2 rounded-full">
                +{activeFileNames.length - 1}
              </span>
            )}
          </div>

          {/* Upload More Files Button */}
          <button
            className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 text-xs font-semibold text-slate-700 dark:text-zinc-300 hover:text-emerald-600 dark:hover:text-emerald-400 hover:border-emerald-500/50 transition-all cursor-pointer shadow-sm hover:scale-[1.02] disabled:opacity-50"
            onClick={() => addFileInputRef.current?.click()}
            disabled={isUploadingMore}
            title="Upload and index additional documents into this session"
          >
            <UploadCloudIcon size={14} />
            <span className="hidden sm:inline">
              {isUploadingMore ? "Uploading..." : "Upload More"}
            </span>
          </button>

          {/* New Session Button */}
          <button
            className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/30 text-xs font-semibold text-emerald-700 dark:text-emerald-400 transition-all cursor-pointer shadow-sm hover:scale-[1.02]"
            onClick={onNewSession}
            title="Wipe previous files and start a brand new session"
          >
            <PlusCircleIcon size={14} />
            <span className="hidden sm:inline">New Session</span>
          </button>
        </div>

        {/* Right Nav Actions */}
        <div className="flex items-center gap-2">
          {/* Runtime Status Pill */}
          <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-mono border border-slate-200 dark:border-zinc-800 bg-white/70 dark:bg-zinc-900/70 text-slate-600 dark:text-zinc-400">
            <span
              className="w-1.5 h-1.5 rounded-full"
              style={{
                backgroundColor: isBackendConnected ? "#10b981" : "#06b6d4",
              }}
            />
            <span className="text-[11px] font-medium hidden sm:inline">
              {isBackendConnected ? "Local FAISS" : "Edge RAG"}
            </span>
          </div>

          {/* Theme Toggle */}
          <button
            className="p-1.5 rounded-lg bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 text-slate-600 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-zinc-100 hover:bg-slate-100 dark:hover:bg-zinc-800 transition-all cursor-pointer shadow-sm"
            onClick={onToggleTheme}
            title={theme === "dark" ? "Switch to Light Mode" : "Switch to Dark Mode"}
          >
            {theme === "dark" ? <SunIcon size={15} /> : <MoonIcon size={15} />}
          </button>

          {/* Clear Chat Button */}
          {messages.length > 0 && (
            <button
              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 text-xs font-medium text-slate-600 dark:text-zinc-400 hover:text-red-500 hover:border-red-500/30 transition-all cursor-pointer shadow-sm"
              onClick={onClearChat}
              title="Clear message conversation"
            >
              <TrashIcon size={13} />
              <span className="hidden sm:inline">Clear Chat</span>
            </button>
          )}
        </div>
      </header>

      {/* Messages Scroll Area */}
      <div className="flex-1 overflow-y-auto px-4 sm:px-6 py-6 flex flex-col gap-6">
        {messages.length === 0 ? (
          /* Empty Session State with Responsive Grid Layout */
          <div className="m-auto max-w-2xl w-full py-4 space-y-6">
            <div className="text-center space-y-2">
              <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center mx-auto mb-3 shadow-inner">
                <FileTextIcon size={24} />
              </div>
              <h2 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-zinc-50">
                Session Active & Indexed
              </h2>
              <p className="text-xs sm:text-sm text-slate-600 dark:text-zinc-400 max-w-md mx-auto leading-relaxed">
                Your uploaded documents are isolated in this session. Ask questions or add more files anytime.
              </p>
            </div>

            {/* Responsive Grid: Active Documents Overview + Add More Card */}
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs font-mono font-semibold uppercase tracking-wider text-slate-500 dark:text-zinc-500 px-1">
                <span>Active Session Documents ({activeFileNames.length})</span>
                <span className="text-[11px] text-emerald-600 dark:text-emerald-400 lowercase font-normal">
                  + click to add more
                </span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                {activeFileNames.map((name, i) => (
                  <div
                    key={i}
                    className="p-3.5 rounded-xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-sm flex items-start gap-2.5"
                  >
                    <div className="w-7 h-7 rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0 mt-0.5">
                      <FileTextIcon size={14} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-xs font-semibold text-slate-900 dark:text-zinc-100 truncate" title={name}>
                        {name}
                      </div>
                      <div className="flex items-center gap-1.5 mt-1">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                        <span className="text-[10px] font-mono text-emerald-600 dark:text-emerald-400">
                          Indexed for RAG
                        </span>
                      </div>
                    </div>
                  </div>
                ))}

                {/* Add More Document Card in Grid */}
                <button
                  onClick={() => addFileInputRef.current?.click()}
                  disabled={isUploadingMore}
                  className="p-3.5 rounded-xl border border-dashed border-slate-300 dark:border-zinc-700 hover:border-emerald-500 dark:hover:border-emerald-500 bg-white/50 dark:bg-zinc-900/40 hover:bg-emerald-500/5 transition-all text-left flex items-center gap-2.5 cursor-pointer group shadow-sm hover:shadow-md"
                >
                  <div className="w-7 h-7 rounded-lg bg-emerald-500/10 group-hover:bg-emerald-500 text-emerald-600 group-hover:text-black flex items-center justify-center shrink-0 transition-colors">
                    <PlusCircleIcon size={16} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-xs font-semibold text-slate-800 dark:text-zinc-200 group-hover:text-emerald-600 dark:group-hover:text-emerald-400">
                      {isUploadingMore ? "Uploading..." : "+ Upload More"}
                    </div>
                    <div className="text-[10px] text-slate-500 dark:text-zinc-400">
                      Add to this session
                    </div>
                  </div>
                </button>
              </div>
            </div>

            {/* Responsive Grid: Dynamic Prompt Suggestions */}
            <div className="space-y-2">
              <div className="text-xs font-mono font-semibold uppercase tracking-wider text-slate-500 dark:text-zinc-500 px-1">
                Suggested Inquiries
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {getSuggestions().map((suggestion, idx) => (
                  <button
                    key={idx}
                    className="flex items-center justify-between p-3.5 rounded-xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 hover:border-emerald-500 dark:hover:border-emerald-500 hover:bg-slate-50 dark:hover:bg-zinc-800/80 text-xs sm:text-sm font-medium text-slate-700 dark:text-zinc-300 transition-all cursor-pointer text-left group shadow-sm hover:shadow-md"
                    onClick={() => onSendMessage(suggestion)}
                  >
                    <span className="pr-2 leading-relaxed">{suggestion}</span>
                    <span className="opacity-40 group-hover:opacity-100 group-hover:text-emerald-500 transition-all font-bold text-base shrink-0">
                      →
                    </span>
                  </button>
                ))}
              </div>
            </div>
          </div>
        ) : (
          /* Render Messages */
          <>
            {messages.map((msg) => {
              const isAsst = msg.role === "assistant";
              const isCurrentlyStreaming =
                isLoading && msg === messages[messages.length - 1] && msg.role === "assistant";
              const isCitationOpen = !!openCitationsMap[msg.id];

              // If assistant message has no content yet, the dedicated Loading UI will render below
              if (isAsst && !msg.content) return null;

              return (
                <div
                  key={msg.id}
                  className={`flex flex-col ${isAsst ? "items-start w-full" : "items-end max-w-[85%] self-end"}`}
                >
                  {isAsst ? (
                    <div className="w-full bg-white dark:bg-zinc-900 border border-slate-200/90 dark:border-zinc-800/90 p-5 sm:p-6 rounded-2xl rounded-bl-sm shadow-sm relative transition-all">
                      {/* Header bar */}
                      <div className="flex flex-wrap items-center justify-between gap-2 mb-4 pb-3 border-b border-slate-100 dark:border-zinc-800/60 text-xs">
                        <div className="flex items-center gap-2">
                          <span className="px-2.5 py-0.5 rounded-md bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-mono font-semibold text-[11px] flex items-center gap-1">
                            <ZapIcon size={12} />
                            <span>Grounded RAG Answer</span>
                          </span>
                          {msg.latencyMs && (
                            <span className="text-slate-500 dark:text-zinc-500 font-mono text-[11px]">
                              ⚡ {msg.latencyMs.retrieval}ms search • {msg.latencyMs.inference}ms synthesis
                            </span>
                          )}
                        </div>

                        <div className="flex items-center gap-1.5">
                          <button
                            className="inline-flex items-center gap-1 px-2 py-1 rounded text-[11px] border border-slate-200 dark:border-zinc-800 text-slate-600 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-zinc-100 hover:bg-slate-50 dark:hover:bg-zinc-800 transition-all cursor-pointer"
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
                                <span>Copy</span>
                              </>
                            )}
                          </button>
                        </div>
                      </div>

                      {/* Rich Formatted Markdown Content */}
                      <div className="prose prose-slate dark:prose-invert max-w-none text-sm sm:text-[0.94rem] leading-relaxed text-slate-800 dark:text-zinc-200">
                        <ReactMarkdown
                          remarkPlugins={[remarkGfm]}
                          components={{
                            h1: ({ children }) => (
                              <h1 className="text-xl font-bold text-slate-900 dark:text-zinc-50 mt-4 mb-2 pb-1 border-b border-slate-200 dark:border-zinc-800">
                                {children}
                              </h1>
                            ),
                            h2: ({ children }) => (
                              <h2 className="text-lg font-bold text-slate-900 dark:text-zinc-50 mt-3 mb-2">
                                {children}
                              </h2>
                            ),
                            h3: ({ children }) => (
                              <h3 className="text-base font-semibold text-slate-900 dark:text-zinc-100 mt-2 mb-1">
                                {children}
                              </h3>
                            ),
                            p: ({ children }) => (
                              <p className="mb-3 leading-relaxed last:mb-0">{children}</p>
                            ),
                            ul: ({ children }) => (
                              <ul className="list-disc pl-5 mb-3 space-y-1">{children}</ul>
                            ),
                            ol: ({ children }) => (
                              <ol className="list-decimal pl-5 mb-3 space-y-1">{children}</ol>
                            ),
                            li: ({ children }) => (
                              <li className="leading-relaxed">{children}</li>
                            ),
                            blockquote: ({ children }) => (
                              <blockquote className="border-l-4 border-emerald-500 pl-3 py-1 my-3 bg-emerald-500/5 text-slate-700 dark:text-zinc-300 rounded-r-lg text-xs italic">
                                {children}
                              </blockquote>
                            ),
                            table: ({ children }) => (
                              <div className="overflow-x-auto my-3">
                                <table className="min-w-full divide-y divide-slate-200 dark:divide-zinc-800 border border-slate-200 dark:border-zinc-800 rounded-lg text-xs">
                                  {children}
                                </table>
                              </div>
                            ),
                            th: ({ children }) => (
                              <th className="px-3 py-2 bg-slate-100 dark:bg-zinc-800 font-semibold text-left text-slate-900 dark:text-zinc-100">
                                {children}
                              </th>
                            ),
                            td: ({ children }) => (
                              <td className="px-3 py-2 border-t border-slate-200 dark:border-zinc-800">
                                {children}
                              </td>
                            ),
                            code: ({ className, children, ...props }) => {
                              const isInline = !className && typeof children === "string" && !children.includes("\n");
                              if (isInline) {
                                return (
                                  <code
                                    className="px-1.5 py-0.5 rounded font-mono text-[12px] bg-slate-100 dark:bg-zinc-800 text-emerald-600 dark:text-emerald-400 border border-slate-200/60 dark:border-zinc-700/60"
                                    {...props}
                                  >
                                    {children}
                                  </code>
                                );
                              }
                              return (
                                <div className="my-3 rounded-xl overflow-hidden border border-slate-200 dark:border-zinc-800 bg-slate-900 text-zinc-100 p-4 font-mono text-xs overflow-x-auto">
                                  <code>{children}</code>
                                </div>
                              );
                            },
                          }}
                        >
                          {msg.content}
                        </ReactMarkdown>
                        {isCurrentlyStreaming && <span className="streaming-cursor" />}
                      </div>

                      {/* Citations Toggle Button */}
                      {msg.retrievedChunks && msg.retrievedChunks.length > 0 && (
                        <div className="mt-4 pt-3 border-t border-slate-100 dark:border-zinc-800/60">
                          <button
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border border-emerald-500/30 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/10 transition-all cursor-pointer shadow-sm"
                            onClick={() => toggleCitationProof(msg.id)}
                          >
                            <ShieldCheckIcon size={14} style={{ color: "#10b981" }} />
                            <span>
                              {isCitationOpen
                                ? `Hide Grounding Citations (${msg.retrievedChunks.length})`
                                : `Show Grounding Citations (${msg.retrievedChunks.length})`}
                            </span>
                          </button>
                        </div>
                      )}

                      {/* Responsive Grid: Verified Citation Proofs */}
                      {isCitationOpen && msg.retrievedChunks && msg.retrievedChunks.length > 0 && (
                        <div className="mt-4 p-4 rounded-xl bg-slate-50/80 dark:bg-zinc-950/80 border border-slate-200 dark:border-zinc-800 space-y-3">
                          <div className="flex items-center justify-between pb-2 border-b border-slate-200 dark:border-zinc-800">
                            <div className="flex items-center gap-1.5 font-bold text-slate-800 dark:text-zinc-200 text-xs">
                              <ShieldCheckIcon size={14} style={{ color: "#10b981" }} />
                              <span>Verbatim Evidence & Similarity Citations</span>
                            </div>
                            <span className="font-mono text-slate-500 dark:text-zinc-500 text-[11px]">
                              {msg.retrievedChunks.length} chunks extracted from current session
                            </span>
                          </div>

                          {/* Responsive Grid Layout for Chunks */}
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                            {msg.retrievedChunks.map((chunk: Chunk, cIdx: number) => {
                              const matchPct = chunk.score ? Math.round(chunk.score * 100) : 85;
                              return (
                                <div
                                  key={chunk.id || cIdx}
                                  className="flex flex-col justify-between p-3.5 rounded-xl bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 shadow-sm space-y-2.5"
                                >
                                  <div className="flex items-center justify-between gap-2">
                                    <div className="flex items-center gap-1.5 font-semibold text-cyan-600 dark:text-cyan-400 text-xs truncate">
                                      <FileTextIcon size={13} />
                                      <span className="truncate">{chunk.documentName}</span>
                                      <span className="font-mono text-[10px] bg-slate-100 dark:bg-zinc-800 px-1.5 py-0.5 rounded text-slate-600 dark:text-zinc-400 shrink-0">
                                        #{chunk.chunkIndex ?? cIdx + 1}
                                      </span>
                                    </div>

                                    <div className="flex items-center gap-1.5 shrink-0">
                                      <div className="w-12 h-1.5 bg-slate-200 dark:bg-zinc-800 rounded-full overflow-hidden">
                                        <div
                                          className="h-full bg-emerald-500 rounded-full"
                                          style={{ width: `${matchPct}%` }}
                                        />
                                      </div>
                                      <span className="font-mono text-emerald-600 dark:text-emerald-400 font-bold text-[11px]">
                                        {matchPct}%
                                      </span>
                                    </div>
                                  </div>

                                  <div className="text-xs text-slate-700 dark:text-zinc-300 font-serif leading-relaxed italic bg-slate-50 dark:bg-zinc-950/60 p-2.5 rounded-lg border-l-2 border-emerald-500 max-h-36 overflow-y-auto">
                                    "{chunk.text}"
                                  </div>

                                  <div className="flex items-center justify-between text-[10px] font-mono text-slate-400 dark:text-zinc-500 pt-1 border-t border-slate-100 dark:border-zinc-800/60">
                                    <span>{chunk.tokens || Math.round(chunk.text.length / 4)} tokens</span>
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
                    /* User Message Bubble */
                    <div className="bg-emerald-600 text-white dark:bg-emerald-600 dark:text-zinc-50 px-4 py-2.5 rounded-2xl rounded-br-sm shadow-sm text-sm sm:text-[0.93rem] leading-relaxed">
                      {msg.content}
                    </div>
                  )}
                </div>
              );
            })}

            {/* Dedicated Loading UI Component */}
            {showLoadingSkeleton && (
              <div className="flex flex-col items-start w-full animate-in fade-in duration-200">
                <div className="w-full bg-white dark:bg-zinc-900 border border-slate-200/90 dark:border-zinc-800/90 p-5 sm:p-6 rounded-2xl rounded-bl-sm shadow-sm relative">
                  <div className="flex items-center justify-between gap-2 mb-4 pb-3 border-b border-slate-100 dark:border-zinc-800/60 text-xs">
                    <div className="flex items-center gap-2">
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-mono font-semibold text-[11px]">
                        <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping" />
                        <span>Retrieving & Grounding Evidence...</span>
                      </span>
                      <span className="text-slate-400 dark:text-zinc-500 font-mono text-[11px] hidden sm:inline">
                        Searching across {activeFileNames.length} active file{activeFileNames.length > 1 ? "s" : ""}
                      </span>
                    </div>

                    <button
                      type="button"
                      onClick={onStopGeneration}
                      className="inline-flex items-center gap-1 px-2.5 py-1 rounded text-[11px] font-semibold text-red-600 dark:text-red-400 bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 transition-all cursor-pointer shadow-sm"
                    >
                      <StopIcon size={12} />
                      <span>Stop</span>
                    </button>
                  </div>

                  {/* Pulsing Skeleton Rows */}
                  <div className="space-y-3 py-1">
                    <div className="h-4 bg-gradient-to-r from-slate-200 via-slate-300 to-slate-200 dark:from-zinc-800 dark:via-zinc-700 dark:to-zinc-800 rounded-md w-3/4 animate-pulse" />
                    <div className="h-4 bg-gradient-to-r from-slate-200 via-slate-300 to-slate-200 dark:from-zinc-800 dark:via-zinc-700 dark:to-zinc-800 rounded-md w-full animate-pulse" />
                    <div className="h-4 bg-gradient-to-r from-slate-200 via-slate-300 to-slate-200 dark:from-zinc-800 dark:via-zinc-700 dark:to-zinc-800 rounded-md w-5/6 animate-pulse" />
                    <div className="h-4 bg-gradient-to-r from-slate-200 via-slate-300 to-slate-200 dark:from-zinc-800 dark:via-zinc-700 dark:to-zinc-800 rounded-md w-1/2 animate-pulse" />
                  </div>

                  <div className="mt-4 pt-3 border-t border-slate-100 dark:border-zinc-800/60 flex items-center justify-between text-[11px] text-slate-400 dark:text-zinc-500 font-mono">
                    <span className="flex items-center gap-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-cyan-500 animate-pulse" />
                      Semantic vector search
                    </span>
                    <span>Ultra-low latency Groq inference</span>
                  </div>
                </div>
              </div>
            )}
          </>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input Bar & Controls */}
      <div className="p-4 sm:p-6 border-t border-slate-200 dark:border-zinc-800 bg-slate-50/80 dark:bg-zinc-950/80 backdrop-blur-md">
        <form onSubmit={handleSubmit} className="relative flex items-center">
          <input
            ref={inputRef}
            type="text"
            value={inputQuery}
            onChange={(e) => setInputQuery(e.target.value)}
            disabled={isLoading}
            placeholder={`Ask anything about ${primaryFileName}${activeFileNames.length > 1 ? ` (+${activeFileNames.length - 1} docs)` : ""}...`}
            className="w-full bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-xl px-4 py-3.5 pr-24 text-sm text-slate-900 dark:text-zinc-100 placeholder-slate-400 dark:placeholder-zinc-500 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 shadow-sm transition-all disabled:opacity-60"
          />

          <div className="absolute right-2 flex items-center gap-1.5">
            {isLoading ? (
              <button
                type="button"
                onClick={onStopGeneration}
                className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-red-500/10 hover:bg-red-500/20 text-red-600 dark:text-red-400 text-xs font-semibold transition-all cursor-pointer border border-red-500/30"
                title="Stop response generation"
              >
                <StopIcon size={12} />
                <span>Stop</span>
              </button>
            ) : (
              <button
                type="submit"
                disabled={!inputQuery.trim()}
                className="w-9 h-9 rounded-lg bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 disabled:hover:bg-emerald-600 text-white flex items-center justify-center transition-all cursor-pointer shadow-sm"
                title="Send query"
              >
                <SendIcon size={15} />
              </button>
            )}
          </div>
        </form>

        <div className="flex items-center justify-between text-[11px] text-slate-500 dark:text-zinc-500 mt-2 px-1">
          <span>Answers are strictly grounded in active session files</span>
          <span>Press Enter to ask</span>
        </div>
      </div>
    </div>
  );
}
