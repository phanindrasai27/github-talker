import { GoogleGenAI, ThinkingLevel, Type } from '@google/genai';
import type { ChatTurn, RepoMetadata, RepoSummary, RetrievedSource } from './types';

export const GENERATION_MODEL = 'gemini-4-hydrogen';
export const EMBEDDING_MODEL = 'gemini-embedding-2';

let cachedClient: GoogleGenAI | null = null;

export function getGeminiClient(): GoogleGenAI {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || !apiKey.trim()) {
    throw new Error(
      'GEMINI_API_KEY is not configured on the server. Please check your Settings > Secrets panel.'
    );
  }
  if (!cachedClient) {
    cachedClient = new GoogleGenAI({
      apiKey,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        },
      },
    });
  }
  return cachedClient;
}

export async function withRetry<T>(
  operation: () => Promise<T>,
  maxRetries = 2,
  baseDelayMs = 600
): Promise<T> {
  let lastError: unknown;
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await operation();
    } catch (err: unknown) {
      lastError = err;
      const msg = err instanceof Error ? err.message : String(err);
      const isTransient =
        msg.includes('429') ||
        msg.includes('503') ||
        msg.includes('UNAVAILABLE') ||
        msg.includes('RESOURCE_EXHAUSTED') ||
        msg.includes('fetch failed');
      if (!isTransient || attempt === maxRetries) {
        throw err;
      }
      await new Promise((resolve) =>
        setTimeout(resolve, baseDelayMs * Math.pow(2, attempt))
      );
    }
  }
  throw lastError;
}

export async function embedTexts(texts: string[]): Promise<number[][]> {
  if (texts.length === 0) return [];
  const ai = getGeminiClient();
  const batchSize = 20;
  const allVectors: number[][] = [];

  for (let i = 0; i < texts.length; i += batchSize) {
    const batch = texts.slice(i, i + batchSize).map((t) => t.slice(0, 6000));
    const response = await withRetry(() =>
      ai.models.embedContent({
        model: EMBEDDING_MODEL,
        contents: batch,
      })
    );
    const embeddings = response.embeddings ?? [];
    for (let j = 0; j < batch.length; j++) {
      allVectors.push(embeddings[j]?.values ?? []);
    }
  }

  return allVectors;
}

export async function generateRepoSummary(params: {
  metadata: RepoMetadata;
  treePaths: string[];
  sampleFiles: Array<{ path: string; content: string }>;
}): Promise<RepoSummary> {
  const ai = getGeminiClient();
  const { metadata, treePaths, sampleFiles } = params;

  const treePreview = treePaths.slice(0, 140).join('\n');
  const filesContext = sampleFiles
    .map(
      (f) =>
        `=== FILE: ${f.path} ===\n${f.content.slice(0, 3200)}`
    )
    .join('\n\n');

  const prompt = `Analyze the GitHub repository "${metadata.fullName}" (branch: ${metadata.branch}).
Description: ${metadata.description || 'None provided'}
Primary Language: ${metadata.language || 'Unknown'}
Topics: ${metadata.topics.join(', ') || 'None'}

Repository File Tree (up to 140 paths):
${treePreview}

Key Indexed File Excerpts:
${filesContext}

Produce a concise, high-signal technical architectural analysis of this exact codebase.
- Ground every claim in the actual files shown above.
- For keyFiles, only list real file paths that exist in the tree above, with a crisp 1-sentence role for each (5 to 8 files).
- For suggestedQuestions, write 4 specific, insightful developer questions tailored to this repository's real architecture and files (under 14 words each).`;

  const response = await withRetry(() =>
    ai.models.generateContent({
      model: GENERATION_MODEL,
      contents: prompt,
      config: {
        systemInstruction:
          'You are a principal software architect analyzing a real GitHub codebase. Be precise, concrete, and avoid generic fluff.',
        responseMimeType: 'application/json',
        thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            overview: {
              type: Type.STRING,
              description:
                '2-3 sentences summarizing the repository purpose, target users, and core capability.',
            },
            architecture: {
              type: Type.STRING,
              description:
                '3-4 sentences explaining how the major layers, modules, and data flows fit together.',
            },
            keyComponents: {
              type: Type.ARRAY,
              items: { type: Type.STRING },
              description:
                '4 to 6 concise bullet points describing major subsystems or modules.',
            },
            keyFiles: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  path: { type: Type.STRING },
                  role: { type: Type.STRING },
                },
                required: ['path', 'role'],
              },
              description: '5 to 8 real file paths and their specific responsibilities.',
            },
            designPatterns: {
              type: Type.ARRAY,
              items: { type: Type.STRING },
              description:
                '3 to 5 notable engineering patterns, conventions, or dependency choices.',
            },
            suggestedQuestions: {
              type: Type.ARRAY,
              items: { type: Type.STRING },
              description:
                '4 sharp, repository-specific questions a developer would want to ask.',
            },
          },
          required: [
            'overview',
            'architecture',
            'keyComponents',
            'keyFiles',
            'designPatterns',
            'suggestedQuestions',
          ],
        },
      },
    })
  );

  const rawText = (response.text ?? '').trim();
  const parsed = JSON.parse(rawText) as RepoSummary;

  return {
    overview: parsed.overview || metadata.description || 'Repository indexed and ready for exploration.',
    architecture: parsed.architecture || 'Explore the file tree or ask questions about specific modules.',
    keyComponents: Array.isArray(parsed.keyComponents) ? parsed.keyComponents.slice(0, 8) : [],
    keyFiles: Array.isArray(parsed.keyFiles) ? parsed.keyFiles.slice(0, 10) : [],
    designPatterns: Array.isArray(parsed.designPatterns) ? parsed.designPatterns.slice(0, 8) : [],
    suggestedQuestions:
      Array.isArray(parsed.suggestedQuestions) && parsed.suggestedQuestions.length > 0
        ? parsed.suggestedQuestions.slice(0, 4)
        : [
            'How is the main entry point structured?',
            'Walk through the core request or data flow.',
            'What are the key dependencies and how are they used?',
            'Where is error handling implemented?',
          ],
  };
}

export async function createChatResponseStream(params: {
  metadata: RepoMetadata;
  summaryOverview: string;
  filePathsPreview: string[];
  sources: RetrievedSource[];
  history: ChatTurn[];
  question: string;
  focusedFile?: string;
}) {
  const ai = getGeminiClient();
  const {
    metadata,
    summaryOverview,
    filePathsPreview,
    sources,
    history,
    question,
    focusedFile,
  } = params;

  const formattedSources =
    sources.length > 0
      ? sources
          .map(
            (src, idx) =>
              `[Source ${idx + 1}] ${src.filePath} (lines ${src.startLine}-${src.endLine}):\n\`\`\`${src.language}\n${src.content}\n\`\`\``
          )
          .join('\n\n')
      : 'No matching indexed code chunks were retrieved for this query.';

  const systemInstruction = `You are GitHub Talker, an expert codebase analyst answering questions about the GitHub repository "${metadata.fullName}" (branch: ${metadata.branch}).

Repository Overview:
${summaryOverview}

Partial File Tree (${filePathsPreview.length} paths shown):
${filePathsPreview.slice(0, 100).join('\n')}

Guidelines:
1. Ground every technical explanation strictly in the retrieved code snippets and repository tree below.
2. Always cite exact file paths and line ranges inline when referencing implementation details (for example: \`src/router.ts\` (L42–L78)).
3. Use clean Markdown: concise headings when helpful, bullet lists for multi-step flows, and fenced code blocks with language identifiers.
4. If the retrieved snippets do not contain the exact file needed to answer completely, clearly say which file in the tree would need to be inspected next rather than fabricating code.
5. Keep answers focused, authoritative, and developer-grade.`;

  const recentHistory = history.slice(-6).map((turn) => ({
    role: turn.role === 'assistant' ? 'model' : 'user',
    parts: [{ text: turn.content }],
  }));

  const focusNote = focusedFile
    ? `Focused file selected by user: \`${focusedFile}\`\n\n`
    : '';

  const userTurnContent = `${focusNote}Retrieved Code Context:\n${formattedSources}\n\nDeveloper Question:\n${question}`;

  return withRetry(() =>
    ai.models.generateContentStream({
      model: GENERATION_MODEL,
      contents: [
        ...recentHistory,
        {
          role: 'user',
          parts: [{ text: userTurnContent }],
        },
      ],
      config: {
        systemInstruction,
        thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
      },
    })
  );
}
