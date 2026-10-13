"use client";

import React, { useState, useRef } from "react";
import { UploadCloudIcon, FileTextIcon, ZapIcon } from "./Icons";
import { DEFAULT_DOCUMENTS } from "../lib/knowledgeBase";

interface UploadViewProps {
  onFilesSelected: (files: File[]) => Promise<boolean>;
  onSampleSelected: (sampleName: string) => void;
  isBackendConnected: boolean;
}

export function UploadView({
  onFilesSelected,
  onSampleSelected,
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

  const startUpload = async (filesToUpload: File[]) => {
    if (!filesToUpload || filesToUpload.length === 0) return;

    setUploadState({
      inProgress: true,
      stage: `Uploading ${filesToUpload.length} document(s)...`,
      progress: 20,
    });

    let currentProgress = 20;
    if (progressTimerRef.current) clearInterval(progressTimerRef.current);

    // Dynamic progress ticker that steadily advances
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
            ? "Vectorizing & generating embeddings..."
            : currentProgress > 40
            ? "Extracting text and chunking content..."
            : `Uploading ${filesToUpload.length} document(s)...`;

        return {
          ...prev,
          stage: stageText,
          progress: currentProgress,
        };
      });
    }, 200);

    try {
      const ok = await onFilesSelected(filesToUpload);

      if (progressTimerRef.current) clearInterval(progressTimerRef.current);

      if (ok) {
        setUploadState({
          inProgress: true,
          stage: "Success! All documents indexed.",
          progress: 100,
        });
      } else {
        setUploadState({
          inProgress: false,
          stage: "",
          progress: 0,
          error: "Could not process files. Please try another document format.",
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
      <div className="text-center mb-8 max-w-xl">
        <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-emerald-500 to-cyan-500 flex items-center justify-center text-zinc-950 shadow-lg shadow-emerald-500/20 mx-auto mb-4">
          <ZapIcon size={24} />
        </div>
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-900 dark:text-zinc-50 mb-2">
          Upload Documents for RAG
        </h1>
        <p className="text-sm sm:text-base text-slate-600 dark:text-zinc-400 max-w-lg leading-relaxed mx-auto">
          Drop any files (PDF, DOCX, TXT, MD, Code, CSV, JSON). NotesRAG extracts
          knowledge into vector representations for instant, humanized Q&A with verified citation proofs.
        </p>
      </div>

      {/* Drag & Drop Area */}
      <div
        className={`w-full max-w-xl rounded-2xl border-2 border-dashed p-8 sm:p-12 text-center transition-all duration-200 cursor-pointer ${
          isDragging
            ? "border-emerald-500 bg-emerald-500/5 scale-[1.01] shadow-xl shadow-emerald-500/10"
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
          accept="*/*"
          className="hidden"
          onChange={handleInputChange}
        />

        {uploadState.inProgress ? (
          <div className="flex flex-col items-center gap-3">
            <div className="w-10 h-10 rounded-full border-3 border-emerald-500/20 border-t-emerald-500 animate-spin mb-1" />
            <div className="text-sm font-semibold text-slate-800 dark:text-zinc-200">
              {uploadState.stage}
            </div>

            <div className="w-full max-w-xs h-2 rounded-full bg-slate-200 dark:bg-zinc-800 overflow-hidden mt-1">
              <div
                className="h-full bg-gradient-to-r from-emerald-500 to-cyan-500 rounded-full transition-all duration-300"
                style={{ width: `${uploadState.progress}%` }}
              />
            </div>

            <div className="text-xs font-mono text-slate-500 dark:text-zinc-500">
              {uploadState.progress}%
            </div>
          </div>
        ) : (
          <div className="flex flex-col items-center">
            <div className="w-16 h-16 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center mb-4">
              <UploadCloudIcon size={36} />
            </div>
            <div className="text-base font-medium text-slate-800 dark:text-zinc-200 mb-2">
              <span>Drop multiple files here</span>, or{" "}
              <span className="text-emerald-600 dark:text-emerald-400 underline underline-offset-4 font-semibold">
                browse from your computer
              </span>
            </div>
            <div className="flex flex-wrap items-center justify-center gap-1.5 mb-4">
              {["PDF", "DOCX", "TXT", "MD", "CODE", "CSV", "ANY"].map((fmt) => (
                <span
                  key={fmt}
                  className="px-2 py-0.5 text-xs font-mono font-medium rounded-md bg-slate-100 dark:bg-zinc-800 text-slate-600 dark:text-zinc-400 border border-slate-200 dark:border-zinc-700/60"
                >
                  {fmt}
                </span>
              ))}
            </div>
            <div className="mt-1">
              <span
                className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-mono font-medium ${
                  isBackendConnected
                    ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20"
                    : "bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 border border-cyan-500/20"
                }`}
              >
                ● {isBackendConnected ? "Python FAISS Active" : "Vercel Edge RAG Active"}
              </span>
            </div>
          </div>
        )}
      </div>

      {uploadState.error && (
        <div className="mt-4 px-4 py-2.5 rounded-lg bg-red-500/10 border border-red-500/30 text-red-600 dark:text-red-400 text-sm max-w-xl text-center">
          {uploadState.error}
        </div>
      )}

      {/* Sample Docs Option */}
      {!uploadState.inProgress && (
        <div className="w-full max-w-xl mt-8">
          <div className="relative flex items-center justify-center mb-4">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-slate-200 dark:border-zinc-800" />
            </div>
            <span className="relative bg-slate-50 dark:bg-zinc-950 px-3 text-xs font-medium uppercase tracking-wider text-slate-400 dark:text-zinc-500">
              or test with sample knowledge notes
            </span>
          </div>

          <div className="flex flex-col gap-2.5">
            {DEFAULT_DOCUMENTS.map((doc) => (
              <button
                key={doc.id}
                className="flex items-center gap-3.5 p-3 rounded-xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900/60 hover:bg-slate-100/70 dark:hover:bg-zinc-800/80 transition-all text-left cursor-pointer group hover:translate-x-1"
                onClick={() => onSampleSelected(doc.name)}
              >
                <div className="w-8 h-8 rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
                  <FileTextIcon size={16} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-semibold text-slate-900 dark:text-zinc-200 truncate">
                    {doc.name}
                  </div>
                  <div className="text-xs text-slate-500 dark:text-zinc-400 truncate">
                    {doc.name.includes("machinelearning")
                      ? "Supervised, Unsupervised, RL, Deep Learning, ML Lifecycle"
                      : doc.name.includes("python")
                      ? "Python PVM, Dynamic Typing, Bytecode, AI ecosystem"
                      : "FAISS FlatL2, SentenceTransformers, Groq LPU Pipeline"}
                  </div>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
