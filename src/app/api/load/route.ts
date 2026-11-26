import { NextRequest, NextResponse } from 'next/server';
import { generateRepoSummary } from '@/lib/gemini';
import { fetchGitHubRepoSnapshot, parseGitHubUrl } from '@/lib/github';
import { chunkFiles, embedRepositoryChunks } from '@/lib/rag';
import {
  buildRepoKey,
  getRepo,
  saveRepo,
  toLoadedRepoResponse,
} from '@/lib/store';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as {
      repoUrl?: string;
      repo_url?: string;
      branch?: string;
      maxFiles?: number;
      forceReload?: boolean;
    };

    const rawUrl = (body.repoUrl ?? body.repo_url ?? '').trim();
    const parsed = parseGitHubUrl(rawUrl);
    const requestedBranch = body.branch?.trim() || parsed.branch;
    const maxFiles = typeof body.maxFiles === 'number' ? body.maxFiles : 60;

    // Return cached repository immediately if branch matches and reload is not forced
    if (!body.forceReload && requestedBranch) {
      const possibleKey = buildRepoKey(parsed.owner, parsed.repo, requestedBranch);
      const cached = getRepo(possibleKey);
      if (cached) {
        return NextResponse.json(toLoadedRepoResponse(cached));
      }
    }

    const snapshot = await fetchGitHubRepoSnapshot({
      owner: parsed.owner,
      repo: parsed.repo,
      branch: requestedBranch,
      maxFiles,
    });

    const repoKey = buildRepoKey(
      snapshot.metadata.owner,
      snapshot.metadata.repo,
      snapshot.metadata.branch
    );

    if (!body.forceReload) {
      const existing = getRepo(repoKey);
      if (existing && existing.stats.indexedFileCount >= snapshot.files.length) {
        return NextResponse.json(toLoadedRepoResponse(existing));
      }
    }

    if (snapshot.files.length === 0) {
      return NextResponse.json(
        {
          error:
            'No supported source or documentation files were found in this repository.',
        },
        { status: 400 }
      );
    }

    const { chunks, totalLines } = chunkFiles(snapshot.files);
    const totalBytes = snapshot.files.reduce((sum, f) => sum + f.size, 0);

    // Select representative files for the architectural summary (README, manifests, top prioritized files)
    const sampleFiles = snapshot.files.slice(0, 12).map((f) => ({
      path: f.path,
      content: f.content,
    }));

    // Run semantic embedding and structured architecture summary concurrently
    const [embeddedChunks, summary] = await Promise.all([
      embedRepositoryChunks(chunks),
      generateRepoSummary({
        metadata: snapshot.metadata,
        treePaths: snapshot.tree.map((t) => t.path),
        sampleFiles,
      }),
    ]);

    const fileMap = new Map<string, { content: string; language: string }>();
    for (const f of snapshot.files) {
      fileMap.set(f.path, { content: f.content, language: f.language });
    }

    const record = {
      repoKey,
      metadata: snapshot.metadata,
      stats: {
        totalFilesInTree: snapshot.tree.length,
        indexedFileCount: snapshot.files.length,
        totalChunks: chunks.length,
        embeddedChunks,
        totalLines,
        totalBytes,
        languageStats: snapshot.languageStats,
      },
      summary,
      tree: snapshot.tree,
      files: fileMap,
      chunks,
      loadedAt: Date.now(),
    };

    saveRepo(record);
    return NextResponse.json(toLoadedRepoResponse(record));
  } catch (err: unknown) {
    const message =
      err instanceof Error ? err.message : 'Failed to load GitHub repository.';
    const lower = message.toLowerCase();
    const status = lower.includes('not found')
      ? 404
      : lower.includes('invalid') || lower.includes('please enter') || lower.includes('only public')
        ? 400
        : lower.includes('rate limit')
          ? 429
          : 500;

    return NextResponse.json({ error: message }, { status });
  }
}
