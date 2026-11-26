import { embedTexts } from './gemini';
import { toCodeFenceLang } from './github';
import type { CodeChunk, RetrievedSource } from './types';

const CHUNK_LINES = 85;
const OVERLAP_LINES = 15;
const MAX_CHUNK_CHARS = 3000;
const MAX_EMBEDDED_CHUNKS = 100;

export function chunkFiles(
  files: Array<{ path: string; language: string; content: string }>
): { chunks: CodeChunk[]; totalLines: number } {
  const chunks: CodeChunk[] = [];
  let totalLines = 0;

  for (const file of files) {
    const lines = file.content.split(/\r?\n/);
    totalLines += lines.length;
    const fenceLang = toCodeFenceLang(file.language);

    if (lines.length === 0) continue;

    let start = 0;
    let chunkIndex = 0;

    while (start < lines.length) {
      let end = Math.min(start + CHUNK_LINES, lines.length);
      let slice = lines.slice(start, end).join('\n');

      // Trim if single lines are very long
      while (slice.length > MAX_CHUNK_CHARS && end - start > 10) {
        end -= 10;
        slice = lines.slice(start, end).join('\n');
      }

      if (slice.trim().length > 0) {
        chunks.push({
          id: `${file.path}#${chunkIndex}`,
          filePath: file.path,
          startLine: start + 1,
          endLine: end,
          language: fenceLang,
          content: slice.slice(0, MAX_CHUNK_CHARS),
        });
        chunkIndex++;
      }

      if (end >= lines.length) break;
      start = Math.max(start + 1, end - OVERLAP_LINES);
    }
  }

  return { chunks, totalLines };
}

function normalizeVector(vec: number[]): number[] {
  let norm = 0;
  for (let i = 0; i < vec.length; i++) {
    norm += vec[i] * vec[i];
  }
  norm = Math.sqrt(norm);
  if (norm === 0) return vec;
  return vec.map((v) => v / norm);
}

function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length === 0 || a.length !== b.length) return 0;
  let dot = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
  }
  return dot;
}

export async function embedRepositoryChunks(chunks: CodeChunk[]): Promise<number> {
  if (chunks.length === 0) return 0;

  // Pick representative chunks evenly across files up to MAX_EMBEDDED_CHUNKS
  const indicesToEmbed: number[] = [];
  if (chunks.length <= MAX_EMBEDDED_CHUNKS) {
    for (let i = 0; i < chunks.length; i++) indicesToEmbed.push(i);
  } else {
    const seenFiles = new Set<string>();
    // Pass 1: First chunk of every file
    for (let i = 0; i < chunks.length && indicesToEmbed.length < MAX_EMBEDDED_CHUNKS; i++) {
      if (!seenFiles.has(chunks[i].filePath)) {
        seenFiles.add(chunks[i].filePath);
        indicesToEmbed.push(i);
      }
    }
    // Pass 2: Remaining chunks proportionally
    const selectedSet = new Set(indicesToEmbed);
    for (let i = 0; i < chunks.length && indicesToEmbed.length < MAX_EMBEDDED_CHUNKS; i++) {
      if (!selectedSet.has(i)) {
        indicesToEmbed.push(i);
      }
    }
  }

  const inputs = indicesToEmbed.map((idx) => {
    const c = chunks[idx];
    return `File: ${c.filePath} (lines ${c.startLine}-${c.endLine})\n${c.content}`;
  });

  try {
    const vectors = await embedTexts(inputs);
    let embeddedCount = 0;
    for (let i = 0; i < indicesToEmbed.length; i++) {
      const vec = vectors[i];
      if (vec && vec.length > 0) {
        chunks[indicesToEmbed[i]].embedding = normalizeVector(vec);
        embeddedCount++;
      }
    }
    return embeddedCount;
  } catch (err) {
    console.warn('[GitHub Talker] Embedding batch skipped, using lexical retrieval fallback:', err);
    return 0;
  }
}

const STOP_WORDS = new Set([
  'the', 'and', 'for', 'are', 'but', 'not', 'you', 'all', 'can', 'had', 'her',
  'was', 'one', 'our', 'out', 'has', 'his', 'how', 'man', 'new', 'now', 'old',
  'see', 'two', 'way', 'who', 'did', 'its', 'let', 'put', 'say', 'she', 'too',
  'use', 'what', 'when', 'where', 'which', 'while', 'with', 'this', 'that',
  'from', 'have', 'does', 'into', 'about', 'code', 'file', 'repo', 'work',
  'works', 'explain', 'show', 'tell', 'please', 'find',
]);

function tokenize(text: string): string[] {
  // Split camelCase and snake_case identifiers too
  const expanded = text
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/[_\-./\\:()[\]{}<>,;'"`]/g, ' ')
    .toLowerCase();

  return expanded
    .split(/\s+/)
    .filter((tok) => tok.length >= 2 && !STOP_WORDS.has(tok));
}

function lexicalScore(chunk: CodeChunk, queryTokens: string[], rawQueryLower: string): number {
  if (queryTokens.length === 0) return 0;

  const pathLower = chunk.filePath.toLowerCase();
  const contentLower = chunk.content.toLowerCase();
  let hits = 0;

  for (const token of queryTokens) {
    if (pathLower.includes(token)) {
      hits += 2.2;
    }
    if (contentLower.includes(token)) {
      // Count up to 4 occurrences to reward dense relevance without dominating
      let count = 0;
      let pos = 0;
      while (count < 4) {
        const found = contentLower.indexOf(token, pos);
        if (found === -1) break;
        count++;
        pos = found + token.length;
      }
      hits += 0.65 + count * 0.25;
    }
  }

  // Bonus for direct path mention in query
  const fileName = pathLower.split('/').pop() ?? '';
  if (fileName.length > 3 && rawQueryLower.includes(fileName)) {
    hits += 4.0;
  }

  return Math.min(1, hits / (queryTokens.length * 2.2 + 1));
}

export async function retrieveRelevantChunks(params: {
  chunks: CodeChunk[];
  query: string;
  focusedFile?: string;
  topK?: number;
}): Promise<RetrievedSource[]> {
  const { chunks, query, focusedFile, topK = 6 } = params;
  if (chunks.length === 0) return [];

  const hasEmbeddings = chunks.some((c) => c.embedding && c.embedding.length > 0);
  let queryVector: number[] | null = null;

  if (hasEmbeddings) {
    try {
      const [vec] = await embedTexts([query]);
      if (vec && vec.length > 0) {
        queryVector = normalizeVector(vec);
      }
    } catch {
      queryVector = null;
    }
  }

  const queryTokens = tokenize(query);
  const rawQueryLower = query.toLowerCase();

  const scored = chunks.map((chunk) => {
    const lex = lexicalScore(chunk, queryTokens, rawQueryLower);
    let sem = 0;
    if (queryVector && chunk.embedding && chunk.embedding.length === queryVector.length) {
      sem = Math.max(0, cosineSimilarity(queryVector, chunk.embedding));
    }

    let combined = queryVector && chunk.embedding ? sem * 0.68 + lex * 0.32 : lex;

    if (focusedFile && chunk.filePath === focusedFile) {
      combined += 0.45;
    }

    return {
      chunk,
      score: Math.min(0.99, Math.max(0.05, combined)),
    };
  });

  scored.sort((a, b) => b.score - a.score);

  const selected: RetrievedSource[] = [];
  const fileCounts = new Map<string, number>();

  for (const item of scored) {
    if (selected.length >= topK) break;
    const maxPerFile = focusedFile && item.chunk.filePath === focusedFile ? 3 : 2;
    const count = fileCounts.get(item.chunk.filePath) ?? 0;
    if (count >= maxPerFile) continue;

    fileCounts.set(item.chunk.filePath, count + 1);
    selected.push({
      id: item.chunk.id,
      filePath: item.chunk.filePath,
      startLine: item.chunk.startLine,
      endLine: item.chunk.endLine,
      language: item.chunk.language,
      content: item.chunk.content,
      score: Number(item.score.toFixed(3)),
    });
  }

  return selected;
}
