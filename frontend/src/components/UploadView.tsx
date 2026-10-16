"use client";

import React, { useState, useRef } from "react";
import { UploadCloudIcon, FileTextIcon, ZapIcon, LayersIcon } from "./Icons";

interface UploadViewProps {
  onFilesSelected: (files: File[]) => Promise<boolean>;
  isBackendConnected: boolean;
}

export function UploadView({
  onFilesSelected,
  isBackendConnected,
}: UploadViewProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [uploadState, setUploadState] = useState<{
    inProgress: boolean;
    stage: string;
    progress: number;
    error?: string;
  }>({
    inProgress: false,
    stage: "",
    progress: 0,
  });

  const fileInputRef = useRef<HTMLInputElement>(null);
  const progressTimerRef = useRef<NodeJS.Timeout | null>(null);

  const MAX_FILE_SIZE_BYTES = 4 * 1024 * 1024; // 4MB — Vercel serverless payload limit

  const startUpload = async (filesToUpload: File[]) => {
    if (!filesToUpload || filesToUpload.length === 0) return;

    const oversized = filesToUpload.filter((f) => f.size > MAX_FILE_SIZE_BYTES);
    const valid = filesToUpload.filter((f) => f.size <= MAX_FILE_SIZE_BYTES);

    if (oversized.length > 0 && valid.length === 0) {
      setUploadState({
        inProgress: false,
        stage: "",
        progress: 0,
        error: `File(s) exceed 4MB limit: ${oversized.map((f) => f.name).join(", ")}. Please upload files under 4MB each.`,
      });
      return;
    }

    const filesToProcess = valid;

    setUploadState({
      inProgress: true,
      stage: `Ingesting ${filesToProcess.length} document(s)...`,
      progress: 20,
    });

    let currentProgress = 20;
    if (progressTimerRef.current) clearInterval(progressTimerRef.current);

    progressTimerRef.current = setInterval(() => {
      setUploadState((prev) => {
        if (!prev.inProgress) return prev;
        if (currentProgress < 90) {
          currentProgress += Math.max(2, Math.round((95 - currentProgress) * 0.2));
        } else if (currentProgress < 98) {
          currentProgress += 1;
        }

        const stageText =
          currentProgress > 70
            ? "Building dense vector embeddings & citation index..."
            : currentProgress > 40
            ? "Extracting text, removing noise & chunking content..."
            : `Reading ${filesToProcess.length} document(s)...`;

        return {
          ...prev,
          stage: stageText,
          progress: currentProgress,
        };
      });
    }, 180);

    try {
      const ok = await onFilesSelected(filesToProcess);

      if (progressTimerRef.current) clearInterval(progressTimerRef.current);

      if (ok) {
        const skippedNote =
          oversized.length > 0
            ? ` (${oversized.length} skipped >4MB)`
            : "";
        setUploadState({
          inProgress: true,
          stage: `Ready! Session started with ${filesToProcess.length} file(s).${skippedNote}`,
          progress: 100,
        });
      } else {
        setUploadState({
          inProgress: false,
          stage: "",
          progress: 0,
          error: "Could not parse or index documents. Please try a standard text, PDF, or markdown file.",
        });
      }
    } catch (err: unknown) {
      if (progressTimerRef.current) clearInterval(progressTimerRef.current);
      const msg = err instanceof Error ? err.message : "Upload error";
      setUploadState({
        inProgress: false,
        stage: "",
        progress: 0,
        error: `Upload notice: ${msg}`,
      });
    }
  };

  const handleFileDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      startUpload(Array.from(e.dataTransfer.files));
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      startUpload(Array.from(e.target.files));
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-zinc-950 text-slate-900 dark:text-zinc-100 flex flex-col justify-center items-center px-4 py-12 transition-colors duration-200">
      {/* Brand Header */}
      <div className="text-center mb-8 max-w-2xl">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400 text-xs font-mono font-medium mb-4">
          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
          <span>Clean Session RAG Architecture</span>
        </div>

        <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-slate-900 dark:text-zinc-50 mb-3">
          Upload Documents to Start Session
        </h1>
        <p className="text-sm sm:text-base text-slate-600 dark:text-zinc-400 max-w-lg leading-relaxed mx-auto">
          Upload your notes, research papers, or documentation. Each session starts clean with 
          isolated vectors and zero cross-document contamination.
        </p>
      </div>

      {/* Main Upload Dropzone */}
      <div
        className={`w-full max-w-2xl rounded-2xl border-2 border-dashed p-8 sm:p-12 text-center transition-all duration-200 cursor-pointer ${
          isDragging
            ? "border-emerald-500 bg-emerald-500/5 scale-[1.01] shadow-2xl shadow-emerald-500/10"
            : uploadState.inProgress
            ? "border-slate-300 dark:border-zinc-800 bg-white dark:bg-zinc-900/60 cursor-default"
            : "border-slate-300 dark:border-zinc-800 bg-white dark:bg-zinc-900/60 hover:border-emerald-500 dark:hover:border-emerald-500 hover:bg-slate-100/50 dark:hover:bg-zinc-900 shadow-sm hover:shadow-xl hover:shadow-emerald-500/5 hover:-translate-y-0.5"
        }`}
        onDragOver={(e) => {
          e.preventDefault();
          setIsDragging(true);
        }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={handleFileDrop}
        onClick={() => !uploadState.inProgress && fileInputRef.current?.click()}
      >
        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept=".pdf,.txt,.md,.json,.csv,.doc,.docx"
          className="hidden"
          onChange={handleInputChange}
        />

        {uploadState.inProgress ? (
          <div className="flex flex-col items-center gap-3 py-4">
            <div className="w-12 h-12 rounded-full border-3 border-emerald-500/20 border-t-emerald-500 animate-spin mb-1" />
            <div className="text-base font-semibold text-slate-800 dark:text-zinc-200">
              {uploadState.stage}
            </div>

            <div className="w-full max-w-sm h-2.5 rounded-full bg-slate-200 dark:bg-zinc-800 overflow-hidden mt-2">
              <div
                className="h-full bg-gradient-to-r from-emerald-500 via-teal-400 to-cyan-500 rounded-full transition-all duration-300"
                style={{ width: `${uploadState.progress}%` }}
              />
            </div>

            <div className="text-xs font-mono text-slate-500 dark:text-zinc-500">
              {uploadState.progress}% processed
            </div>
          </div>
        ) : (
          <div className="flex flex-col items-center py-2">
            <div className="w-16 h-16 rounded-2xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
              <UploadCloudIcon size={36} />
            </div>

            <div className="text-base sm:text-lg font-semibold text-slate-800 dark:text-zinc-200 mb-1.5">
              <span>Drag & drop files here</span>, or{" "}
              <span className="text-emerald-600 dark:text-emerald-400 underline underline-offset-4 font-bold">
                browse from device
              </span>
            </div>

            <p className="text-xs text-slate-500 dark:text-zinc-400 mb-4 max-w-sm">
              Upload multiple files at once. Previous sessions are wiped automatically so only your current documents are indexed.
            </p>

            {/* Supported Formats Grid */}
            <div className="flex flex-wrap items-center justify-center gap-1.5 mb-5">
              {[
                { ext: "PDF", desc: "PDF Documents" },
                { ext: "TXT", desc: "Plain Text" },
                { ext: "MD", desc: "Markdown Notes" },
                { ext: "DOCX", desc: "Word Files" },
                { ext: "CSV / JSON", desc: "Data Files" },
              ].map((fmt) => (
                <span
                  key={fmt.ext}
                  title={fmt.desc}
                  className="px-2.5 py-1 text-xs font-mono font-medium rounded-lg bg-slate-100 dark:bg-zinc-800 text-slate-700 dark:text-zinc-300 border border-slate-200 dark:border-zinc-700/60"
                >
                  {fmt.ext}
                </span>
              ))}
            </div>

            {/* Backend Runtime Badge */}
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-mono font-medium border border-slate-200 dark:border-zinc-800 bg-white/80 dark:bg-zinc-900/80 shadow-sm">
              <span
                className="w-2 h-2 rounded-full"
                style={{
                  backgroundColor: isBackendConnected ? "#10b981" : "#06b6d4",
                }}
              />
              <span className="text-slate-600 dark:text-zinc-400">
                {isBackendConnected
                  ? "Local FAISS Dense Indexing Active"
                  : "Vercel Edge Vector Pipeline Active"}
              </span>
            </div>
          </div>
        )}
      </div>

      {uploadState.error && (
        <div className="mt-4 px-4 py-3 rounded-xl bg-red-500/10 border border-red-500/30 text-red-600 dark:text-red-400 text-sm max-w-2xl text-center shadow-sm">
          {uploadState.error}
        </div>
      )}

      {/* Responsive Feature Highlights Grid */}
      <div className="w-full max-w-2xl mt-10 grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="p-4 rounded-xl border border-slate-200 dark:border-zinc-800 bg-white/60 dark:bg-zinc-900/40 backdrop-blur-sm">
          <div className="w-8 h-8 rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center mb-2.5">
            <ZapIcon size={16} />
          </div>
          <div className="text-sm font-semibold text-slate-900 dark:text-zinc-200 mb-1">
            Session Isolation
          </div>
          <p className="text-xs text-slate-500 dark:text-zinc-400 leading-relaxed">
            Every session is strictly isolated. Old documents are never mixed into new queries.
          </p>
        </div>

        <div className="p-4 rounded-xl border border-slate-200 dark:border-zinc-800 bg-white/60 dark:bg-zinc-900/40 backdrop-blur-sm">
          <div className="w-8 h-8 rounded-lg bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 flex items-center justify-center mb-2.5">
            <LayersIcon size={16} />
          </div>
          <div className="text-sm font-semibold text-slate-900 dark:text-zinc-200 mb-1">
            Dense Semantic Search
          </div>
          <p className="text-xs text-slate-500 dark:text-zinc-400 leading-relaxed">
            Sub-millisecond retrieval with semantic embeddings across all uploaded chunks.
          </p>
        </div>

        <div className="p-4 rounded-xl border border-slate-200 dark:border-zinc-800 bg-white/60 dark:bg-zinc-900/40 backdrop-blur-sm">
          <div className="w-8 h-8 rounded-lg bg-purple-500/10 text-purple-600 dark:text-purple-400 flex items-center justify-center mb-2.5">
            <FileTextIcon size={16} />
          </div>
          <div className="text-sm font-semibold text-slate-900 dark:text-zinc-200 mb-1">
            Citation Proofs
          </div>
          <p className="text-xs text-slate-500 dark:text-zinc-400 leading-relaxed">
            Inspect verbatim document excerpts and similarity confidence scores for every answer.
          </p>
        </div>
      </div>
    </div>
  );
}
