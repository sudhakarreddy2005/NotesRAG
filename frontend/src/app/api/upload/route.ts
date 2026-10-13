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

    for (const file of allFiles) {
      let content = "";
      const isPdf = file.name.toLowerCase().endsWith(".pdf");

      if (isPdf) {
        try {
          const arrayBuffer = await file.arrayBuffer();
          const buffer = Buffer.from(arrayBuffer);
          const parser = new PDFParse({ data: buffer });
          const parsed = await parser.getText();
          content = parsed?.text || "";
        } catch (pdfErr) {
          console.warn(`Could not parse PDF ${file.name}:`, pdfErr);
          content = `[Document: ${file.name} - Extracted binary representation]`;
        }
      } else {
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
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Upload error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
