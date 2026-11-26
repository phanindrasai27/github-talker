import { NextRequest, NextResponse } from 'next/server';
import { getRepo, listRepos, toLoadedRepoResponse } from '@/lib/store';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const repoKey = (searchParams.get('repoKey') ?? '').trim();

  if (repoKey) {
    const repo = getRepo(repoKey);
    if (!repo) {
      return NextResponse.json(
        { error: 'Repository not found in memory.' },
        { status: 404 }
      );
    }
    return NextResponse.json(toLoadedRepoResponse(repo));
  }

  return NextResponse.json({ repos: listRepos() });
}
