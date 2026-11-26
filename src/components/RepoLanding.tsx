'use client';

import React, { useEffect, useState } from 'react';
import {
  AlertCircle,
  ArrowRight,
  Clock,
  GitBranch,
  Loader2,
  SlidersHorizontal,
} from 'lucide-react';
import type { RepoSummaryListItem } from '@/lib/types';

interface RepoLandingProps {
  onLoadRepo: (params: {
    repoUrl: string;
    branch?: string;
    maxFiles: number;
  }) => Promise<void>;
  onSelectCachedRepo: (repoKey: string) => Promise<void>;
  recentRepos: RepoSummaryListItem[];
  isLoading: boolean;
  loadingStage: string;
  error: string | null;
}

const FEATURED_REPOS = [
  {
    fullName: 'honojs/hono',
    language: 'TypeScript',
    summary: 'Ultrafast web framework built on Web Standards for edge and Node runtimes.',
  },
  {
    fullName: 'pmndrs/zustand',
    language: 'TypeScript',
    summary: 'Minimalist, unopinionated state-management solution for React applications.',
  },
  {
    fullName: 'colinhacks/zod',
    language: 'TypeScript',
    summary: 'TypeScript-first schema declaration and runtime validation library.',
  },
  {
    fullName: 'expressjs/express',
    language: 'JavaScript',
    summary: 'Fast, minimalist web framework for Node.js routing and middleware.',
  },
  {
    fullName: 'tiangolo/fastapi',
    language: 'Python',
    summary: 'High-performance Python API framework powered by Starlette and Pydantic.',
  },
  {
    fullName: 'gin-gonic/gin',
    language: 'Go',
    summary: 'HTTP web framework written in Go with radix-tree routing and middleware.',
  },
];

export default function RepoLanding({
  onLoadRepo,
  onSelectCachedRepo,
  recentRepos,
  isLoading,
  loadingStage,
  error,
}: RepoLandingProps) {
  const [repoUrl, setRepoUrl] = useState('');
  const [branch, setBranch] = useState('');
  const [maxFiles, setMaxFiles] = useState<number>(60);
  const [showOptions, setShowOptions] = useState(false);

  useEffect(() => {
    // Keep options open only if user explicitly expanded them
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!repoUrl.trim() || isLoading) return;
    await onLoadRepo({
      repoUrl: repoUrl.trim(),
      branch: branch.trim() || undefined,
      maxFiles,
    });
  };

  const handleQuickStart = async (fullName: string) => {
    if (isLoading) return;
    const url = `https://github.com/${fullName}`;
    setRepoUrl(url);
    setBranch('');
    await onLoadRepo({ repoUrl: url, maxFiles });
  };

  return (
    <main className="mx-auto w-full max-w-5xl px-6 py-12 lg:py-16">
      {/* Hero & Intake Form */}
      <section className="max-w-3xl">
        <h1 className="text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl dark:text-slate-50 [text-wrap:balance]">
          Understand any GitHub repository in minutes.
        </h1>
        <p className="mt-3 max-w-2xl text-[15px] leading-relaxed text-slate-600 dark:text-slate-400">
          Paste any public repository URL to index its source tree, generate an architectural overview, inspect files, and ask questions backed by line-numbered code citations.
        </p>

        <form onSubmit={handleSubmit} className="mt-8">
          <div className="flex flex-col gap-3 sm:flex-row">
            <input
              type="text"
              value={repoUrl}
              onChange={(e) => setRepoUrl(e.target.value)}
              disabled={isLoading}
              placeholder="https://github.com/owner/repo or owner/repo"
              aria-label="GitHub repository URL"
              className="h-12 flex-1 rounded-lg border border-slate-300 bg-white px-4 font-mono text-sm text-slate-900 placeholder:font-sans placeholder:text-slate-400 focus:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-600/20 disabled:opacity-60 dark:border-slate-700 dark:bg-[#0F172A] dark:text-slate-100 dark:placeholder:text-slate-500 dark:focus:border-blue-500"
            />
            <button
              type="submit"
              disabled={isLoading || !repoUrl.trim()}
              className="inline-flex h-12 items-center justify-center gap-2 rounded-lg bg-blue-600 px-6 text-sm font-medium text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-slate-300 dark:disabled:bg-slate-800 dark:disabled:text-slate-500 whitespace-nowrap shrink-0"
            >
              {isLoading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span>Analyzing...</span>
                </>
              ) : (
                <>
                  <span>Analyze Repository</span>
                  <ArrowRight className="h-4 w-4" />
                </>
              )}
            </button>
          </div>

          <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
            <button
              type="button"
              onClick={() => setShowOptions((prev) => !prev)}
              className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-500 transition-colors hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-200 whitespace-nowrap shrink-0"
            >
              <SlidersHorizontal className="h-3.5 w-3.5" />
              <span>
                {showOptions ? 'Hide indexing options' : 'Branch & indexing depth'}
              </span>
            </button>

            <span className="text-xs text-slate-500 tabular-nums dark:text-slate-400">
              {branch.trim() ? `Branch: ${branch.trim()}` : 'Default branch'}
              <span className="mx-1.5" aria-hidden="true">
                ·
              </span>
              Up to {maxFiles} priority source files
            </span>
          </div>

          {showOptions && (
            <div className="mt-4 grid grid-cols-1 gap-4 rounded-lg border border-slate-200 bg-slate-50/70 p-4 sm:grid-cols-2 dark:border-slate-800 dark:bg-[#0F172A]/70">
              <div>
                <label
                  htmlFor="branch-input"
                  className="mb-1.5 flex items-center gap-1.5 text-xs font-medium text-slate-700 dark:text-slate-300"
                >
                  <GitBranch className="h-3.5 w-3.5 text-slate-400" />
                  <span>Branch (optional)</span>
                </label>
                <input
                  id="branch-input"
                  type="text"
                  value={branch}
                  onChange={(e) => setBranch(e.target.value)}
                  disabled={isLoading}
                  placeholder="Leave blank for default branch"
                  className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 font-mono text-xs text-slate-900 placeholder:font-sans placeholder:text-slate-400 focus:border-blue-500 focus:outline-none dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                />
              </div>

              <div>
                <span className="mb-1.5 block text-xs font-medium text-slate-700 dark:text-slate-300">
                  Max indexed files
                </span>
                <div className="flex items-center gap-1 rounded-md bg-slate-200/70 p-1 dark:bg-slate-900">
                  {[40, 60, 100].map((count) => (
                    <button
                      key={count}
                      type="button"
                      disabled={isLoading}
                      onClick={() => setMaxFiles(count)}
                      className={`flex-1 rounded py-1.5 text-xs font-medium tabular-nums transition-colors ${
                        maxFiles === count
                          ? 'bg-white text-slate-900 shadow-xs dark:bg-slate-800 dark:text-slate-100'
                          : 'text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-200'
                      }`}
                    >
                      {count} files
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {isLoading && (
            <div className="mt-4 flex items-center gap-3 rounded-lg border border-blue-200 bg-blue-50/70 px-4 py-3 text-sm text-blue-800 dark:border-blue-900/60 dark:bg-blue-950/30 dark:text-blue-200">
              <Loader2 className="h-4 w-4 shrink-0 animate-spin text-blue-600 dark:text-blue-400" />
              <span>{loadingStage}</span>
            </div>
          )}

          {error && (
            <div
              role="alert"
              className="mt-4 flex items-start gap-2.5 rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700 dark:border-rose-900/60 dark:bg-rose-950/30 dark:text-rose-300"
            >
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}
        </form>
      </section>

      {/* Recently Indexed Repositories */}
      {recentRepos.length > 0 && (
        <section
          id="recent"
          className="mt-12 border-t border-slate-200 pt-8 dark:border-slate-800"
        >
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
              Active Session Repositories
            </h2>
            <span className="text-xs text-slate-500 tabular-nums dark:text-slate-400">
              {recentRepos.length} cached in memory
            </span>
          </div>

          <div className="mt-4 divide-y divide-slate-200 rounded-lg border border-slate-200 dark:divide-slate-800 dark:border-slate-800">
            {recentRepos.map((item) => (
              <button
                key={item.repoKey}
                type="button"
                disabled={isLoading}
                onClick={() => onSelectCachedRepo(item.repoKey)}
                className="flex w-full items-center justify-between gap-4 px-4 py-3.5 text-left transition-colors hover:bg-slate-50 disabled:opacity-60 dark:hover:bg-slate-900/60"
              >
                <div className="min-w-0">
                  <p className="truncate font-mono text-sm font-medium text-slate-900 dark:text-slate-100">
                    {item.fullName}
                  </p>
                  <div className="mt-0.5 flex flex-wrap items-center gap-x-2 text-xs text-slate-500 tabular-nums dark:text-slate-400">
                    <span>{item.language}</span>
                    <span aria-hidden="true">·</span>
                    <span>{item.branch}</span>
                    <span aria-hidden="true">·</span>
                    <span>{item.indexedFileCount} files indexed</span>
                  </div>
                </div>
                <span className="inline-flex items-center gap-1 text-xs font-medium text-blue-600 dark:text-blue-400 whitespace-nowrap shrink-0">
                  <Clock className="h-3.5 w-3.5" />
                  <span>Resume</span>
                </span>
              </button>
            ))}
          </div>
        </section>
      )}

      {/* Curated Quick-Start Repositories */}
      <section
        id="quick-start"
        className="mt-12 border-t border-slate-200 pt-8 dark:border-slate-800"
      >
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
            Quick-Start Public Repositories
          </h2>
          <span className="text-xs text-slate-500 dark:text-slate-400">
            Select any open-source repository to index live
          </span>
        </div>

        <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {FEATURED_REPOS.map((item) => (
            <button
              key={item.fullName}
              type="button"
              disabled={isLoading}
              onClick={() => handleQuickStart(item.fullName)}
              className="group flex flex-col justify-between rounded-lg border border-slate-200 bg-white p-4 text-left transition-colors hover:border-blue-500/60 hover:bg-slate-50/70 disabled:opacity-60 dark:border-slate-800 dark:bg-[#0F172A]/60 dark:hover:border-blue-500/50 dark:hover:bg-[#111C33]"
            >
              <div>
                <div className="flex items-center justify-between gap-2">
                  <span className="truncate font-mono text-sm font-semibold text-slate-900 group-hover:text-blue-600 dark:text-slate-100 dark:group-hover:text-blue-400">
                    {item.fullName}
                  </span>
                  <ArrowRight className="h-3.5 w-3.5 shrink-0 text-slate-400 transition-transform group-hover:translate-x-0.5 group-hover:text-blue-500" />
                </div>
                <p className="mt-2 text-xs leading-relaxed text-slate-600 dark:text-slate-400">
                  {item.summary}
                </p>
              </div>
              <div className="mt-3 text-[11px] font-medium text-slate-500 dark:text-slate-400">
                {item.language}
              </div>
            </button>
          ))}
        </div>
      </section>

      {/* Capabilities Breakdown */}
      <section
        id="capabilities"
        className="mt-14 border-t border-slate-200 pt-8 dark:border-slate-800"
      >
        <div className="grid grid-cols-1 gap-8 md:grid-cols-3">
          <div>
            <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
              01. Hybrid Code Retrieval
            </h3>
            <p className="mt-2 text-xs leading-relaxed text-slate-600 dark:text-slate-400">
              Combines vector embeddings with symbol and file-path matching so both architectural questions and exact function lookups surface accurate line ranges.
            </p>
          </div>
          <div>
            <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
              02. Grounded Line Citations
            </h3>
            <p className="mt-2 text-xs leading-relaxed text-slate-600 dark:text-slate-400">
              Every streamed answer links directly to the retrieved source snippets. Click any cited file path to jump straight to those highlighted lines.
            </p>
          </div>
          <div>
            <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
              03. Full Tree Inspection
            </h3>
            <p className="mt-2 text-xs leading-relaxed text-slate-600 dark:text-slate-400">
              Browse the entire GitHub file tree, view any file on demand, and pin a specific file to focus follow-up questions on its implementation.
            </p>
          </div>
        </div>
      </section>
    </main>
  );
}
