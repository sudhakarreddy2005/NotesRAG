import { NextRequest, NextResponse } from "next/server";
import { DocumentItem, Chunk } from "@/types/rag";
import { chunkDocument } from "@/lib/knowledgeBase";
import { PDFParse } from "pdf-parse";

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const files = formData.getAll("files") as File[];
    const singleFile = formData.get("file") as File | null;

    const allFiles: File[] = [];
    if (files && files.length > 0) {
      allFiles.push(...files);
    }
    if (singleFile && !allFiles.some((f) => f.name === singleFile.name)) {
      allFiles.push(singleFile);
    }

    if (allFiles.length === 0) {
      return NextResponse.json({ error: "No files provided" }, { status: 400 });
    }

    const processedFiles: { name: string; sizeBytes: number; chunksCount: number }[] = [];
    const allChunks: Chunk[] = [];
    const skipped: string[] = [];

    for (const file of allFiles) {
      // Industry standard file size limit (50MB, matching OpenAI ChatGPT standard)
      const MAX_SIZE_BYTES = 50 * 1024 * 1024; // 50 MB
      if (file.size > MAX_SIZE_BYTES) {
        console.warn(`[WARN] Skipping ${file.name}: ${file.size} bytes exceeds 50MB limit.`);
        skipped.push(file.name);
        continue;
      }

      let content = "";
      const isPdf = file.name.toLowerCase().endsWith(".pdf");
      const isDocx = file.name.toLowerCase().endsWith(".docx");

      if (isPdf) {
        // Bug B-3: pdf-parse@2.x uses LoadParameters interface where `data` accepts TypedArray.
        // Pass Uint8Array (not raw Buffer) for correct API compatibility per pdf-parse@2.x spec.
        let parser: PDFParse | null = null;
        try {
          const arrayBuffer = await file.arrayBuffer();
          const uint8 = new Uint8Array(arrayBuffer);
          parser = new PDFParse({ data: uint8 });
          // getText() returns TextResult — use .text for the full concatenated document string
          const result = await parser.getText();
          content = result?.text || "";
        } catch (pdfErr) {
          console.warn(`[WARN] Could not parse PDF ${file.name}:`, pdfErr);
          content = `[Document: ${file.name} - PDF text extraction failed]`;
        } finally {
          if (parser) {
            await parser.destroy().catch(() => {});
          }
        }
      } else if (isDocx) {
        try {
          // Robust Word .docx text extraction via mammoth
          // eslint-disable-next-line @typescript-eslint/no-require-imports
          const mammoth = require("mammoth");
          const arrayBuffer = await file.arrayBuffer();
          const buffer = Buffer.from(arrayBuffer);
          const result = await mammoth.extractRawText({ buffer });
          content = result?.value || "";
        } catch (docxErr) {
          console.warn(`[WARN] Could not parse DOCX ${file.name}:`, docxErr);
          content = `[Document: ${file.name} - DOCX text extraction failed]`;
        }
      } else {
        const lower = file.name.toLowerCase();
        const isBinary = [
          ".zip", ".tar", ".gz", ".7z", ".rar", ".exe", ".bin",
          ".png", ".jpg", ".jpeg", ".gif", ".webp", ".mp4", ".mp3",
          ".xlsx", ".pptx"
        ].some((ext) => lower.endsWith(ext));

        if (isBinary) {
          console.warn(`[WARN] Skipping binary file without text extractor: ${file.name}`);
          skipped.push(file.name);
          continue;
        }

        try {
          content = await file.text();
        } catch {
          content = `[Document: ${file.name}]`;
        }
      }

      const docItem: DocumentItem = {
        id: `doc-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
        name: file.name,
        type: file.type || (isPdf ? "application/pdf" : "text/plain"),
        sizeBytes: file.size,
        chunkCount: Math.max(1, Math.round(content.length / 500)),
        content,
        createdAt: new Date().toISOString(),
        isDefault: false,
      };

      const chunks = chunkDocument(docItem);
      allChunks.push(...chunks);

      processedFiles.push({
        name: file.name,
        sizeBytes: file.size,
        chunksCount: chunks.length,
      });
    }

    return NextResponse.json({
      success: true,
      files: processedFiles,
      filenames: processedFiles.map((f) => f.name),
      chunks: allChunks,
      totalChunks: allChunks.length,
      ...(skipped.length > 0 && {
        warning: `${skipped.length} file(s) skipped (exceed 4MB limit): ${skipped.join(", ")}`,
        skipped,
      }),
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Upload error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
