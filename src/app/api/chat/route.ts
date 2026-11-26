import { NextRequest } from 'next/server';
import { createChatResponseStream } from '@/lib/gemini';
import { detectLanguage, fetchSingleRawFile } from '@/lib/github';
import { chunkFiles, retrieveRelevantChunks } from '@/lib/rag';
import { getRepo } from '@/lib/store';
import type { ChatTurn } from '@/lib/types';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as {
      repoKey?: string;
      question?: string;
      history?: ChatTurn[];
      focusedFile?: string;
    };

    const repoKey = (body.repoKey ?? '').trim();
    const question = (body.question ?? '').trim();
    const history = Array.isArray(body.history) ? body.history : [];
    const focusedFile = body.focusedFile?.trim() || undefined;

    if (!repoKey || !question) {
      return new Response(
        JSON.stringify({ error: 'Both repoKey and question are required.' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const repo = getRepo(repoKey);
    if (!repo) {
      return new Response(
        JSON.stringify({
          error:
            'This repository session has expired from server memory. Click reload to re-index it.',
          code: 'REPO_NOT_LOADED',
        }),
        { status: 404, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // If the user focused a file that wasn't part of the initial top-N index, load and chunk it on-demand
    let activeChunks = repo.chunks;
    if (focusedFile && !repo.files.has(focusedFile)) {
      const fetched = await fetchSingleRawFile(
        repo.metadata.owner,
        repo.metadata.repo,
        repo.metadata.branch,
        focusedFile
      );
      if (fetched !== null) {
        const language = detectLanguage(focusedFile);
        repo.files.set(focusedFile, { content: fetched, language });
        const { chunks: extraChunks } = chunkFiles([
          { path: focusedFile, language, content: fetched },
        ]);
        activeChunks = [...repo.chunks, ...extraChunks];
        repo.chunks = activeChunks;
      }
    }

    const sources = await retrieveRelevantChunks({
      chunks: activeChunks,
      query: question,
      focusedFile,
      topK: 6,
    });

    const encoder = new TextEncoder();

    const stream = new ReadableStream({
      async start(controller) {
        const sendEvent = (payload: Record<string, unknown>) => {
          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify(payload)}\n\n`)
          );
        };

        try {
          sendEvent({ type: 'sources', sources });

          const geminiStream = await createChatResponseStream({
            metadata: repo.metadata,
            summaryOverview: `${repo.summary.overview}\n\n${repo.summary.architecture}`,
            filePathsPreview: repo.tree.map((t) => t.path),
            sources,
            history,
            question,
            focusedFile,
          });

          for await (const chunk of geminiStream) {
            const text = chunk.text;
            if (text) {
              sendEvent({ type: 'delta', text });
            }
          }

          sendEvent({ type: 'done' });
        } catch (err: unknown) {
          const message =
            err instanceof Error
              ? err.message
              : 'Failed to generate a response from Gemini.';
          sendEvent({ type: 'error', message });
        } finally {
          controller.close();
        }
      },
    });

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream; charset=utf-8',
        'Cache-Control': 'no-cache, no-transform',
        Connection: 'keep-alive',
      },
    });
  } catch (err: unknown) {
    const message =
      err instanceof Error ? err.message : 'Unexpected server error.';
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}
