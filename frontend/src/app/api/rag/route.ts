import { NextRequest, NextResponse } from "next/server";
import { getInitialChunks, retrieveChunks } from "@/lib/knowledgeBase";
import { executeGroqCompletion } from "@/lib/groq";
import { Chunk } from "@/types/rag";

export async function POST(req: NextRequest) {
  const startTotal = Date.now();
  try {
    const body = await req.json();
    const query = body.query?.trim();

    if (!query) {
      return NextResponse.json({ error: "Query parameter is required" }, { status: 400 });
    }

    const topK = Math.min(10, Math.max(1, body.topK || 4));
    const model = body.model;
    const apiKey = body.apiKey;
    const temperature = body.temperature ?? 0.2;

    // Retrieve chunks (either from custom session chunks or default knowledge base)
    const retrievalStart = Date.now();
    const poolOfChunks: Chunk[] = Array.isArray(body.chunks) && body.chunks.length > 0
      ? body.chunks
      : getInitialChunks();

    const retrievedChunks = retrieveChunks(query, poolOfChunks, topK);
    const retrievalLatency = Date.now() - retrievalStart;

    // Execute Groq Inference
    const groqResult = await executeGroqCompletion({
      query,
      contextChunks: retrievedChunks,
      apiKey,
      model,
      temperature,
    });

    const totalLatency = Date.now() - startTotal;

    return NextResponse.json({
      answer: groqResult.answer,
      retrievedChunks,
      model: groqResult.model,
      tokensGenerated: groqResult.tokensGenerated,
      sourceMode: "vercel-cloud",
      latencyMs: {
        retrieval: retrievalLatency,
        inference: groqResult.latencyMs,
        total: totalLatency,
      },
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Internal Server Error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
