import type { LanguageStat, RepoMetadata, TreeItem } from './types';

const GITHUB_API_BASE = 'https://api.github.com';
const GITHUB_RAW_BASE = 'https://raw.githubusercontent.com';

const IGNORED_DIRS = new Set([
  'node_modules',
  '.git',
  '.next',
  '.nuxt',
  '.svelte-kit',
  'dist',
  'build',
  'out',
  'coverage',
  'vendor',
  'venv',
  '.venv',
  '__pycache__',
  'target',
  '.idea',
  '.vscode',
  '.cache',
  'pods',
  'bower_components',
]);

const IGNORED_FILES = new Set([
  'package-lock.json',
  'yarn.lock',
  'pnpm-lock.yaml',
  'bun.lockb',
  'bun.lock',
  'cargo.lock',
  'poetry.lock',
  'composer.lock',
  'gemfile.lock',
  'go.sum',
  '.ds_store',
]);

const EXTENSION_LANGUAGE_MAP: Record<string, string> = {
  ts: 'TypeScript',
  tsx: 'TypeScript',
  mts: 'TypeScript',
  cts: 'TypeScript',
  js: 'JavaScript',
  jsx: 'JavaScript',
  mjs: 'JavaScript',
  cjs: 'JavaScript',
  py: 'Python',
  go: 'Go',
  rs: 'Rust',
  java: 'Java',
  kt: 'Kotlin',
  kts: 'Kotlin',
  swift: 'Swift',
  rb: 'Ruby',
  php: 'PHP',
  cs: 'C#',
  cpp: 'C++',
  cc: 'C++',
  cxx: 'C++',
  c: 'C',
  h: 'C/C++',
  hpp: 'C++',
  scala: 'Scala',
  ex: 'Elixir',
  exs: 'Elixir',
  dart: 'Dart',
  vue: 'Vue',
  svelte: 'Svelte',
  html: 'HTML',
  htm: 'HTML',
  css: 'CSS',
  scss: 'SCSS',
  sass: 'Sass',
  less: 'Less',
  sql: 'SQL',
  graphql: 'GraphQL',
  gql: 'GraphQL',
  prisma: 'Prisma',
  json: 'JSON',
  yaml: 'YAML',
  yml: 'YAML',
  toml: 'TOML',
  xml: 'XML',
  md: 'Markdown',
  mdx: 'Markdown',
  sh: 'Shell',
  bash: 'Shell',
  zsh: 'Shell',
  dockerfile: 'Dockerfile',
  makefile: 'Makefile',
  tf: 'Terraform',
  proto: 'Protobuf',
  r: 'R',
  lua: 'Lua',
  zig: 'Zig',
};

const CODE_FENCE_LANGUAGE_MAP: Record<string, string> = {
  TypeScript: 'typescript',
  JavaScript: 'javascript',
  Python: 'python',
  Go: 'go',
  Rust: 'rust',
  Java: 'java',
  Kotlin: 'kotlin',
  Swift: 'swift',
  Ruby: 'ruby',
  PHP: 'php',
  'C#': 'csharp',
  'C++': 'cpp',
  C: 'c',
  'C/C++': 'cpp',
  Scala: 'scala',
  Elixir: 'elixir',
  Dart: 'dart',
  Vue: 'vue',
  Svelte: 'svelte',
  HTML: 'html',
  CSS: 'css',
  SCSS: 'scss',
  SQL: 'sql',
  GraphQL: 'graphql',
  JSON: 'json',
  YAML: 'yaml',
  TOML: 'toml',
  XML: 'xml',
  Markdown: 'markdown',
  Shell: 'bash',
  Dockerfile: 'dockerfile',
  Makefile: 'makefile',
  Terraform: 'hcl',
  Protobuf: 'protobuf',
};

const MAX_FILE_BYTES = 120_000;

export interface ParsedGitHubUrl {
  owner: string;
  repo: string;
  branch?: string;
}

export function parseGitHubUrl(input: string): ParsedGitHubUrl {
  const trimmed = input.trim();
  if (!trimmed) {
    throw new Error('Please enter a GitHub repository URL (e.g., https://github.com/honojs/hono).');
  }

  // Handle shorthand "owner/repo"
  const shorthandMatch = trimmed.match(/^([A-Za-z0-9_.-]+)\/([A-Za-z0-9_.-]+?)(?:\.git)?\/?$/);
  if (shorthandMatch) {
    return { owner: shorthandMatch[1], repo: shorthandMatch[2] };
  }

  let normalized = trimmed;
  if (!/^https?:\/\//i.test(normalized)) {
    normalized = `https://${normalized}`;
  }

  let parsed: URL;
  try {
    parsed = new URL(normalized);
  } catch {
    throw new Error('Invalid URL format. Enter a GitHub link like https://github.com/owner/repo.');
  }

  const host = parsed.hostname.toLowerCase();
  if (host !== 'github.com' && host !== 'www.github.com') {
    throw new Error('Only public github.com repository URLs are supported.');
  }

  const segments = parsed.pathname.split('/').filter(Boolean);
  if (segments.length < 2) {
    throw new Error('URL must include both owner and repository name (github.com/owner/repo).');
  }

  const owner = segments[0];
  const repo = segments[1].replace(/\.git$/i, '');

  const validSegment = /^[A-Za-z0-9_.-]+$/;
  if (!validSegment.test(owner) || !validSegment.test(repo)) {
    throw new Error('Invalid GitHub owner or repository name.');
  }

  let branch: string | undefined;
  if ((segments[2] === 'tree' || segments[2] === 'blob') && segments[3]) {
    branch = decodeURIComponent(segments[3]);
  }

  return { owner, repo, branch };
}

export function detectLanguage(filePath: string): string {
  const lowerName = filePath.split('/').pop()?.toLowerCase() ?? '';
  if (lowerName === 'dockerfile' || lowerName.startsWith('dockerfile.')) {
    return 'Dockerfile';
  }
  if (lowerName === 'makefile') {
    return 'Makefile';
  }
  const ext = lowerName.includes('.') ? lowerName.split('.').pop() ?? '' : '';
  return EXTENSION_LANGUAGE_MAP[ext] ?? 'Text';
}

export function toCodeFenceLang(language: string): string {
  return CODE_FENCE_LANGUAGE_MAP[language] ?? 'text';
}

export function isIndexableFile(filePath: string, size: number): boolean {
  if (size <= 0 || size > MAX_FILE_BYTES) return false;
  const parts = filePath.split('/');
  for (let i = 0; i < parts.length - 1; i++) {
    if (IGNORED_DIRS.has(parts[i].toLowerCase())) return false;
  }

  const fileName = parts[parts.length - 1].toLowerCase();
  if (IGNORED_FILES.has(fileName)) return false;
  if (fileName.endsWith('.min.js') || fileName.endsWith('.min.css') || fileName.endsWith('.map')) {
    return false;
  }
  if (fileName.startsWith('.') && !fileName.startsWith('.env.example') && !fileName.endsWith('.json') && !fileName.endsWith('.yml') && !fileName.endsWith('.yaml')) {
    return false;
  }

  if (fileName === 'dockerfile' || fileName === 'makefile' || fileName === 'readme') {
    return true;
  }
  const ext = fileName.includes('.') ? fileName.split('.').pop() ?? '' : '';
  return Boolean(EXTENSION_LANGUAGE_MAP[ext]);
}

function scoreFilePriority(filePath: string, size: number): number {
  const lower = filePath.toLowerCase();
  const depth = filePath.split('/').length;
  const fileName = lower.split('/').pop() ?? '';
  let score = 0;

  if (fileName === 'readme.md' || fileName === 'readme.mdx' || fileName === 'readme') {
    score += depth === 1 ? 150 : 60;
  }
  if (
    depth === 1 &&
    (fileName === 'package.json' ||
      fileName === 'pyproject.toml' ||
      fileName === 'requirements.txt' ||
      fileName === 'cargo.toml' ||
      fileName === 'go.mod' ||
      fileName === 'composer.json' ||
      fileName === 'dockerfile' ||
      fileName === 'makefile')
  ) {
    score += 130;
  }
  if (
    /^(index|main|app|server|client|cli|router|routes|schema|models|config|lib|mod|__init__)\./i.test(
      fileName
    )
  ) {
    score += 70;
  }
  if (/^(src|app|lib|core|pkg|server|api|pages|components|backend|packages)\//.test(lower)) {
    score += 55;
  }
  if (
    lower.includes('/test/') ||
    lower.includes('/tests/') ||
    lower.includes('__tests__') ||
    lower.includes('.test.') ||
    lower.includes('.spec.') ||
    lower.startsWith('examples/') ||
    lower.startsWith('benchmarks/')
  ) {
    score -= 45;
  }
  if (lower.startsWith('docs/') && fileName !== 'readme.md') {
    score -= 10;
  }
  if (fileName.endsWith('.json') && depth > 1) {
    score -= 20;
  }
  // Prefer shallower and reasonably sized code files
  score -= depth * 4;
  if (size > 45_000) score -= 20;
  if (size < 80) score -= 15;

  return score;
}

function getGitHubHeaders(): Record<string, string> {
  const headers: Record<string, string> = {
    Accept: 'application/vnd.github+json',
    'User-Agent': 'GitHub-Talker-Workspace/2.0',
  };
  if (process.env.GITHUB_TOKEN) {
    headers.Authorization = `Bearer ${process.env.GITHUB_TOKEN}`;
  }
  return headers;
}

interface GitHubRepoApiResponse {
  name: string;
  full_name: string;
  html_url: string;
  description: string | null;
  default_branch: string;
  stargazers_count: number;
  forks_count: number;
  open_issues_count: number;
  language: string | null;
  license: { spdx_id?: string; name?: string } | null;
  topics?: string[];
  updated_at: string;
  homepage: string | null;
  owner: { login: string };
}

interface GitHubTreeApiResponse {
  tree: Array<{
    path: string;
    type: 'blob' | 'tree';
    size?: number;
  }>;
  truncated?: boolean;
}

export async function fetchGitHubRepoSnapshot(params: {
  owner: string;
  repo: string;
  branch?: string;
  maxFiles?: number;
}): Promise<{
  metadata: RepoMetadata;
  tree: TreeItem[];
  files: Array<{ path: string; language: string; content: string; size: number }>;
  languageStats: Record<string, LanguageStat>;
}> {
  const { owner, repo } = params;
  const maxFiles = Math.min(Math.max(params.maxFiles ?? 60, 15), 100);
  const headers = getGitHubHeaders();

  const repoRes = await fetch(`${GITHUB_API_BASE}/repos/${owner}/${repo}`, {
    headers,
    cache: 'no-store',
  });

  if (repoRes.status === 404) {
    throw new Error(
      `Repository "${owner}/${repo}" was not found or is private. Only public GitHub repositories can be loaded.`
    );
  }
  if (repoRes.status === 403) {
    const remaining = repoRes.headers.get('x-ratelimit-remaining');
    if (remaining === '0') {
      throw new Error(
        'GitHub API rate limit reached for unauthenticated requests. Please try again in a few minutes or configure GITHUB_TOKEN.'
      );
    }
    throw new Error('Access forbidden by GitHub API.');
  }
  if (!repoRes.ok) {
    throw new Error(`GitHub API error (${repoRes.status}) while loading ${owner}/${repo}.`);
  }

  const repoData = (await repoRes.json()) as GitHubRepoApiResponse;
  const targetBranch = params.branch?.trim() || repoData.default_branch || 'main';

  const treeRes = await fetch(
    `${GITHUB_API_BASE}/repos/${owner}/${repo}/git/trees/${encodeURIComponent(targetBranch)}?recursive=1`,
    { headers, cache: 'no-store' }
  );

  if (treeRes.status === 404) {
    throw new Error(
      `Branch "${targetBranch}" was not found in ${owner}/${repo}. Default branch is "${repoData.default_branch}".`
    );
  }
  if (!treeRes.ok) {
    throw new Error(`Failed to fetch repository file tree (HTTP ${treeRes.status}).`);
  }

  const treeData = (await treeRes.json()) as GitHubTreeApiResponse;

  const rawBlobs = (treeData.tree ?? []).filter((entry) => {
    if (entry.type !== 'blob') return false;
    const parts = entry.path.split('/');
    for (let i = 0; i < parts.length - 1; i++) {
      if (IGNORED_DIRS.has(parts[i].toLowerCase())) return false;
    }
    return true;
  });

  // Compute language stats across all text/code blobs in the tree
  const languageStats: Record<string, LanguageStat> = {};
  const candidates: Array<{ path: string; size: number; language: string; priority: number }> = [];

  for (const blob of rawBlobs) {
    const size = blob.size ?? 0;
    const language = detectLanguage(blob.path);
    if (language !== 'Text') {
      if (!languageStats[language]) {
        languageStats[language] = { files: 0, bytes: 0 };
      }
      languageStats[language].files += 1;
      languageStats[language].bytes += size;
    }
    if (isIndexableFile(blob.path, size)) {
      candidates.push({
        path: blob.path,
        size,
        language,
        priority: scoreFilePriority(blob.path, size),
      });
    }
  }

  candidates.sort((a, b) => b.priority - a.priority || a.path.localeCompare(b.path));
  const selected = candidates.slice(0, maxFiles);
  const selectedSet = new Set(selected.map((c) => c.path));

  // Fetch file contents concurrently from raw.githubusercontent.com
  const fetchedFiles: Array<{ path: string; language: string; content: string; size: number }> = [];
  const concurrency = 8;

  for (let i = 0; i < selected.length; i += concurrency) {
    const batch = selected.slice(i, i + concurrency);
    const results = await Promise.all(
      batch.map(async (item) => {
        try {
          const content = await fetchSingleRawFile(
            repoData.owner.login,
            repoData.name,
            targetBranch,
            item.path
          );
          if (content === null || content.includes('\u0000')) {
            return null;
          }
          return {
            path: item.path,
            language: item.language,
            content,
            size: Buffer.byteLength(content, 'utf8'),
          };
        } catch {
          return null;
        }
      })
    );

    for (const r of results) {
      if (r) fetchedFiles.push(r);
    }
  }

  const actuallyIndexedSet = new Set(fetchedFiles.map((f) => f.path));

  // Build clean tree items (cap to 1500 blobs for UI responsiveness)
  const tree: TreeItem[] = rawBlobs.slice(0, 1500).map((blob) => ({
    path: blob.path,
    name: blob.path.split('/').pop() ?? blob.path,
    type: 'blob',
    size: blob.size ?? 0,
    indexed: actuallyIndexedSet.has(blob.path) && selectedSet.has(blob.path),
    language: detectLanguage(blob.path),
  }));

  const metadata: RepoMetadata = {
    owner: repoData.owner.login,
    repo: repoData.name,
    fullName: repoData.full_name,
    url: repoData.html_url,
    description: repoData.description ?? '',
    defaultBranch: repoData.default_branch,
    branch: targetBranch,
    stars: repoData.stargazers_count ?? 0,
    forks: repoData.forks_count ?? 0,
    openIssues: repoData.open_issues_count ?? 0,
    language: repoData.language ?? 'Mixed',
    license: repoData.license?.spdx_id || repoData.license?.name || null,
    topics: Array.isArray(repoData.topics) ? repoData.topics : [],
    updatedAt: repoData.updated_at,
    homepage: repoData.homepage || null,
  };

  return {
    metadata,
    tree,
    files: fetchedFiles,
    languageStats,
  };
}

export async function fetchSingleRawFile(
  owner: string,
  repo: string,
  branch: string,
  filePath: string
): Promise<string | null> {
  const encodedPath = filePath
    .split('/')
    .map((seg) => encodeURIComponent(seg))
    .join('/');
  const url = `${GITHUB_RAW_BASE}/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/${encodeURIComponent(branch)}/${encodedPath}`;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 12_000);
  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': 'GitHub-Talker-Workspace/2.0' },
      signal: controller.signal,
      cache: 'no-store',
    });
    if (!res.ok) return null;
    const text = await res.text();
    if (text.length > 250_000) {
      return text.slice(0, 250_000) + '\n\n// [Truncated for display — file exceeds 250KB]';
    }
    return text;
  } finally {
    clearTimeout(timeout);
  }
}
