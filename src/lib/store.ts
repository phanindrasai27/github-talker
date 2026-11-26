import type {
  CodeChunk,
  LoadedRepoResponse,
  RepoMetadata,
  RepoStats,
  RepoSummary,
  RepoSummaryListItem,
  TreeItem,
} from './types';

export interface StoredRepo {
  repoKey: string;
  metadata: RepoMetadata;
  stats: RepoStats;
  summary: RepoSummary;
  tree: TreeItem[];
  files: Map<string, { content: string; language: string }>;
  chunks: CodeChunk[];
  loadedAt: number;
}

const MAX_REPOS_IN_MEMORY = 12;

declare global {
  var __githubTalkerStore: Map<string, StoredRepo> | undefined;
}

function getStoreMap(): Map<string, StoredRepo> {
  if (!globalThis.__githubTalkerStore) {
    globalThis.__githubTalkerStore = new Map<string, StoredRepo>();
  }
  return globalThis.__githubTalkerStore;
}

export function buildRepoKey(owner: string, repo: string, branch: string): string {
  return `${owner.toLowerCase()}/${repo.toLowerCase()}@${branch}`;
}

export function saveRepo(record: StoredRepo): void {
  const map = getStoreMap();
  if (map.has(record.repoKey)) {
    map.delete(record.repoKey);
  }
  map.set(record.repoKey, record);

  // Evict oldest repository if above memory cap
  while (map.size > MAX_REPOS_IN_MEMORY) {
    const oldestKey = map.keys().next().value;
    if (oldestKey) map.delete(oldestKey);
    else break;
  }
}

export function getRepo(repoKey: string): StoredRepo | undefined {
  return getStoreMap().get(repoKey);
}

export function listRepos(): RepoSummaryListItem[] {
  const items: RepoSummaryListItem[] = [];
  for (const r of getStoreMap().values()) {
    items.push({
      repoKey: r.repoKey,
      fullName: r.metadata.fullName,
      branch: r.metadata.branch,
      description: r.metadata.description,
      language: r.metadata.language,
      stars: r.metadata.stars,
      indexedFileCount: r.stats.indexedFileCount,
      loadedAt: r.loadedAt,
    });
  }
  return items.sort((a, b) => b.loadedAt - a.loadedAt);
}

export function toLoadedRepoResponse(r: StoredRepo): LoadedRepoResponse {
  return {
    repoKey: r.repoKey,
    metadata: r.metadata,
    stats: r.stats,
    summary: r.summary,
    tree: r.tree,
    loadedAt: r.loadedAt,
  };
}
