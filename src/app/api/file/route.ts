import { NextRequest, NextResponse } from 'next/server';
import { detectLanguage, fetchSingleRawFile, toCodeFenceLang } from '@/lib/github';
import { getRepo } from '@/lib/store';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const repoKey = (searchParams.get('repoKey') ?? '').trim();
    const filePath = (searchParams.get('path') ?? '').trim();

    if (!repoKey || !filePath) {
      return NextResponse.json(
        { error: 'Missing repoKey or path parameter.' },
        { status: 400 }
      );
    }

    if (filePath.includes('..') || filePath.startsWith('/')) {
      return NextResponse.json({ error: 'Invalid file path.' }, { status: 400 });
    }

    const repo = getRepo(repoKey);
    if (!repo) {
      return NextResponse.json(
        { error: 'Repository not loaded in current session.' },
        { status: 404 }
      );
    }

    const cached = repo.files.get(filePath);
    if (cached) {
      return NextResponse.json({
        path: filePath,
        language: cached.language,
        fenceLanguage: toCodeFenceLang(cached.language),
        content: cached.content,
        indexed: true,
        githubUrl: `${repo.metadata.url}/blob/${encodeURIComponent(repo.metadata.branch)}/${filePath}`,
      });
    }

    const content = await fetchSingleRawFile(
      repo.metadata.owner,
      repo.metadata.repo,
      repo.metadata.branch,
      filePath
    );

    if (content === null) {
      return NextResponse.json(
        { error: `Could not fetch file "${filePath}" from GitHub.` },
        { status: 404 }
      );
    }

    const language = detectLanguage(filePath);
    repo.files.set(filePath, { content, language });

    return NextResponse.json({
      path: filePath,
      language,
      fenceLanguage: toCodeFenceLang(language),
      content,
      indexed: false,
      githubUrl: `${repo.metadata.url}/blob/${encodeURIComponent(repo.metadata.branch)}/${filePath}`,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to load file.';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
