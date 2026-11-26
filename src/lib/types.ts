export interface RepoMetadata {
  owner: string;
  repo: string;
  fullName: string;
  url: string;
  description: string;
  defaultBranch: string;
  branch: string;
  stars: number;
  forks: number;
  openIssues: number;
  language: string;
  license: string | null;
  topics: string[];
  updatedAt: string;
  homepage: string | null;
}

export interface TreeItem {
  path: string;
  name: string;
  type: 'blob' | 'tree';
  size: number;
  indexed: boolean;
  language: string;
}

export interface LanguageStat {
  files: number;
  bytes: number;
}

export interface RepoStats {
  totalFilesInTree: number;
  indexedFileCount: number;
  totalChunks: number;
  embeddedChunks: number;
  totalLines: number;
  totalBytes: number;
  languageStats: Record<string, LanguageStat>;
}

export interface KeyFileInsight {
  path: string;
  role: string;
}

export interface RepoSummary {
  overview: string;
  architecture: string;
  keyComponents: string[];
  keyFiles: KeyFileInsight[];
  designPatterns: string[];
  suggestedQuestions: string[];
}

export interface CodeChunk {
  id: string;
  filePath: string;
  startLine: number;
  endLine: number;
  language: string;
  content: string;
  embedding?: number[];
}

export interface RetrievedSource {
  id: string;
  filePath: string;
  startLine: number;
  endLine: number;
  language: string;
  content: string;
  score: number;
}

export interface ChatTurn {
  role: 'user' | 'assistant';
  content: string;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  sources?: RetrievedSource[];
  focusedFile?: string;
  createdAt: number;
  error?: boolean;
}

export interface LoadedRepoResponse {
  repoKey: string;
  metadata: RepoMetadata;
  stats: RepoStats;
  summary: RepoSummary;
  tree: TreeItem[];
  loadedAt: number;
}

export interface RepoSummaryListItem {
  repoKey: string;
  fullName: string;
  branch: string;
  description: string;
  language: string;
  stars: number;
  indexedFileCount: number;
  loadedAt: number;
}
