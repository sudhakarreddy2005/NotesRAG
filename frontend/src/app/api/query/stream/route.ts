import { NextRequest } from "next/server";
import { getInitialChunks, retrieveChunks } from "@/lib/knowledgeBase";
import { buildRagPrompt, GROQ_MODELS } from "@/lib/groq";
import type { Chunk } from "@/types/rag";

export const runtime = "nodejs";

/**
 * POST /api/query/stream
 *
 * Real Server-Sent Events (SSE) endpoint for streaming Groq token generation.
 * Replaces the typewriter simulation in the client with actual server-push streaming.
 *
 * Request body:
 *   { query: string, chunks?: Chunk[], topK?: number, model?: string, apiKey?: string, temperature?: number }
 *
 * SSE event format:
 *   data: {"type":"chunk","content":"...token..."}\n\n
 *   data: {"type":"citations","chunks":[...]}\n\n
 *   data: {"type":"latency","retrieval":N,"inference":N,"total":N,"model":"..."}\n\n
 *   data: {"type":"done"}\n\n
 *   data: {"type":"error","message":"..."}\n\n
 */
export async function POST(req: NextRequest) {
  const startTotal = Date.now();

  const encoder = new TextEncoder();

  // Build the SSE readable stream
  const stream = new ReadableStream({
    async start(controller) {
      /**
       * Helper: push one SSE event to the client.
       * Format: "data: <json>\n\n"
       */
      const send = (payload: Record<string, unknown>) => {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(payload)}\n\n`));
      };

      try {
        const body = await req.json();
        const query = body.query?.trim();

        if (!query) {
          send({ type: "error", message: "Query parameter is required" });
          controller.close();
          return;
        }

        const topK = Math.min(10, Math.max(1, body.topK || 4));
        const temperature = body.temperature ?? 0.2;
        const apiKey = (body.apiKey as string | undefined) || process.env.GROQ_API_KEY;

        // Resolve model — validate against known models, fall back to default
        const requestedModel = body.model as string | undefined;
        const defaultModel = GROQ_MODELS[0].id;
        const model =
          requestedModel && GROQ_MODELS.some((m) => m.id === requestedModel)
            ? requestedModel
            : process.env.GROQ_MODEL || defaultModel;

        // --- 1. Retrieval ---
        const retrievalStart = Date.now();
        const poolOfChunks: Chunk[] =
          Array.isArray(body.chunks) && body.chunks.length > 0 ? body.chunks : getInitialChunks();
        const retrievedChunks = retrieveChunks(query, poolOfChunks, topK);
        const retrievalLatency = Date.now() - retrievalStart;

        // Push citations immediately so the UI can render them before inference completes
        send({ type: "citations", chunks: retrievedChunks });

        // --- 2. Streaming Groq inference ---
        if (!apiKey || apiKey.trim() === "" || apiKey === "your_groq_api_key_here") {
          // No API key — stream the local fallback as chunks
          const { generateLocalFallback } = await import("@/lib/groq");
          const fallback = generateLocalFallback(query, retrievedChunks);
          const words = fallback.split(/(\s+)/);
          for (const word of words) {
            send({ type: "chunk", content: word });
            // Simulate slight delay between words for visual consistency
            await new Promise((r) => setTimeout(r, 8));
          }
          const totalLatency = Date.now() - startTotal;
          send({
            type: "latency",
            retrieval: retrievalLatency,
            inference: totalLatency - retrievalLatency,
            total: totalLatency,
            model: `${model} (Local Fallback)`,
          });
          send({ type: "done" });
          controller.close();
          return;
        }

        const prompt = buildRagPrompt(query, retrievedChunks);
        const inferenceStart = Date.now();

        const groqRes = await fetch("https://api.groq.com/openai/v1/chat/completions", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${apiKey.trim()}`,
          },
          body: JSON.stringify({
            model,
            messages: [
              {
                role: "system",
                content:
                  "You are NotesRAG, a high-performance Retrieval-Augmented Generation system. Always ground answers strictly in provided context.",
              },
              { role: "user", content: prompt },
            ],
            temperature,
            max_tokens: 1024,
            stream: true, // Enable Groq streaming
          }),
        });

        if (!groqRes.ok || !groqRes.body) {
          const errText = await groqRes.text().catch(() => "Unknown error");
          let parsedErr = errText;
          try {
            parsedErr = JSON.parse(errText)?.error?.message || errText;
          } catch {
            // ignore
          }
          send({ type: "error", message: `Groq API error: ${parsedErr}` });
          controller.close();
          return;
        }

        // Read Groq SSE stream and forward each token chunk to our SSE stream
        const reader = groqRes.body.getReader();
        const decoder = new TextDecoder();

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          const raw = decoder.decode(value, { stream: true });
          // Groq SSE: each line is "data: <json>" or "data: [DONE]"
          const lines = raw.split("\n").filter((l) => l.startsWith("data: "));

          for (const line of lines) {
            const payload = line.slice(6).trim(); // strip "data: "
            if (payload === "[DONE]") continue;

            try {
              const parsed = JSON.parse(payload);
              const token: string = parsed.choices?.[0]?.delta?.content || "";
              if (token) {
                send({ type: "chunk", content: token });
              }
            } catch {
              // Malformed SSE chunk — skip
            }
          }
        }

        const inferenceLatency = Date.now() - inferenceStart;
        const totalLatency = Date.now() - startTotal;

        send({
          type: "latency",
          retrieval: retrievalLatency,
          inference: inferenceLatency,
          total: totalLatency,
          model,
        });
        send({ type: "done" });
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : "Internal Server Error";
        try {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: "error", message })}\n\n`));
        } catch {
          // Stream may already be closed
        }
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no", // Disable Nginx buffering for SSE
    },
  });
}
