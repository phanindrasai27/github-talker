'use client';

import React, { useMemo } from 'react';
import { ArrowUpRight, FileCode2, MessageSquarePlus } from 'lucide-react';
import type { LoadedRepoResponse } from '@/lib/types';

interface ArchitectureViewProps {
  repo: LoadedRepoResponse;
  onOpenFile: (path: string) => void;
  onAskQuestion: (question: string, focusedFile?: string) => void;
}

function formatNumber(n: number): string {
  return new Intl.NumberFormat('en-US').format(n);
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

export default function ArchitectureView({
  repo,
  onOpenFile,
  onAskQuestion,
}: ArchitectureViewProps) {
  const { metadata, stats, summary } = repo;

  const languageRows = useMemo(() => {
    const rows = Object.entries(stats.languageStats)
      .map(([name, stat]) => ({ name, ...stat }))
      .sort((a, b) => b.bytes - a.bytes);
    const total = rows.reduce((sum, r) => sum + r.bytes, 0) || 1;
    return rows.map((r) => ({
      ...r,
      share: ((r.bytes / total) * 100).toFixed(1),
    }));
  }, [stats.languageStats]);

  return (
    <div className="workspace-scroll h-full overflow-y-auto px-6 py-8 lg:px-10">
      <div className="mx-auto max-w-4xl space-y-10">
        {/* Repository Header */}
        <div className="border-b border-slate-200 pb-6 dark:border-slate-800">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
                {metadata.fullName}
              </h1>
              <div className="mt-1.5 flex flex-wrap items-center gap-x-2.5 gap-y-1 text-xs text-slate-500 tabular-nums dark:text-slate-400">
                <span>{metadata.language}</span>
                <span aria-hidden="true">·</span>
                <span>Branch {metadata.branch}</span>
                <span aria-hidden="true">·</span>
                <span>{formatNumber(metadata.stars)} stars</span>
                <span aria-hidden="true">·</span>
                <span>{formatNumber(metadata.forks)} forks</span>
                {metadata.license && (
                  <>
                    <span aria-hidden="true">·</span>
                    <span>{metadata.license}</span>
                  </>
                )}
              </div>
            </div>

            <a
              href={metadata.url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-3.5 py-2 text-xs font-medium text-slate-700 transition-colors hover:bg-slate-100 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800 whitespace-nowrap shrink-0"
            >
              <span>View on GitHub</span>
              <ArrowUpRight className="h-3.5 w-3.5" />
            </a>
          </div>

          <p className="mt-4 max-w-3xl text-[15px] leading-relaxed text-slate-700 dark:text-slate-300">
            {summary.overview}
          </p>
        </div>

        {/* Single-Elevation 4-Column KPI Strip */}
        <div className="grid grid-cols-2 divide-y divide-slate-200 rounded-lg border border-slate-200 bg-slate-50/50 sm:grid-cols-4 sm:divide-x sm:divide-y-0 dark:divide-slate-800 dark:border-slate-800 dark:bg-[#0F172A]/60">
          <div className="px-4 py-3.5">
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Indexed Files
            </p>
            <p className="mt-1 font-mono text-xl font-semibold tabular-nums text-slate-900 dark:text-slate-100">
              {formatNumber(stats.indexedFileCount)}
              <span className="ml-1 text-xs font-normal text-slate-400">
                / {formatNumber(stats.totalFilesInTree)}
              </span>
            </p>
          </div>
          <div className="px-4 py-3.5">
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Semantic Chunks
            </p>
            <p className="mt-1 font-mono text-xl font-semibold tabular-nums text-slate-900 dark:text-slate-100">
              {formatNumber(stats.totalChunks)}
            </p>
          </div>
          <div className="px-4 py-3.5">
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Indexed Lines
            </p>
            <p className="mt-1 font-mono text-xl font-semibold tabular-nums text-slate-900 dark:text-slate-100">
              {formatNumber(stats.totalLines)}
            </p>
          </div>
          <div className="px-4 py-3.5">
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Indexed Volume
            </p>
            <p className="mt-1 font-mono text-xl font-semibold tabular-nums text-slate-900 dark:text-slate-100">
              {formatBytes(stats.totalBytes)}
            </p>
          </div>
        </div>

        {/* Architecture Narrative */}
        <section>
          <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100">
            System Architecture
          </h2>
          <p className="mt-2.5 text-[15px] leading-relaxed text-slate-700 dark:text-slate-300">
            {summary.architecture}
          </p>

          <div className="mt-6 grid grid-cols-1 gap-8 border-t border-slate-200 pt-6 md:grid-cols-2 dark:border-slate-800">
            <div>
              <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                Core Components
              </h3>
              <ul className="mt-3 space-y-2.5 text-sm leading-relaxed text-slate-600 dark:text-slate-300">
                {summary.keyComponents.map((item, idx) => (
                  <li key={idx} className="flex gap-2.5">
                    <span className="mt-0.5 font-mono text-xs tabular-nums text-slate-400 dark:text-slate-500">
                      0{idx + 1}.
                    </span>
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>

            <div>
              <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                Design Patterns & Decisions
              </h3>
              <ul className="mt-3 space-y-2.5 text-sm leading-relaxed text-slate-600 dark:text-slate-300">
                {summary.designPatterns.map((pattern, idx) => (
                  <li key={idx} className="flex gap-2.5">
                    <span className="mt-0.5 font-mono text-xs tabular-nums text-slate-400 dark:text-slate-500">
                      0{idx + 1}.
                    </span>
                    <span>{pattern}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </section>

        {/* Key Files & Entry Points Table */}
        {summary.keyFiles.length > 0 && (
          <section>
            <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100">
              Key Files & Entry Points
            </h2>
            <div className="mt-3 overflow-hidden rounded-lg border border-slate-200 dark:border-slate-800">
              <table className="w-full text-left text-sm">
                <thead className="border-b border-slate-200 bg-slate-50 text-xs font-medium text-slate-500 dark:border-slate-800 dark:bg-[#0F172A] dark:text-slate-400">
                  <tr>
                    <th className="px-4 py-2.5">File Path</th>
                    <th className="px-4 py-2.5">Responsibility</th>
                    <th className="px-4 py-2.5 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                  {summary.keyFiles.map((kf) => (
                    <tr
                      key={kf.path}
                      className="transition-colors hover:bg-slate-50/80 dark:hover:bg-slate-900/50"
                    >
                      <td className="px-4 py-3 align-top">
                        <button
                          type="button"
                          onClick={() => onOpenFile(kf.path)}
                          className="inline-flex items-center gap-1.5 font-mono text-xs font-medium text-blue-600 hover:underline dark:text-blue-400"
                        >
                          <FileCode2 className="h-3.5 w-3.5 shrink-0" />
                          <span>{kf.path}</span>
                        </button>
                      </td>
                      <td className="px-4 py-3 align-top text-xs leading-relaxed text-slate-600 dark:text-slate-300">
                        {kf.role}
                      </td>
                      <td className="px-4 py-3 text-right align-top">
                        <button
                          type="button"
                          onClick={() =>
                            onAskQuestion(
                              `Explain how ${kf.path} works and how it connects to the rest of the codebase.`,
                              kf.path
                            )
                          }
                          className="inline-flex items-center gap-1 rounded px-2 py-1 text-xs font-medium text-slate-600 transition-colors hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-100 whitespace-nowrap shrink-0"
                        >
                          <MessageSquarePlus className="h-3.5 w-3.5" />
                          <span>Ask</span>
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        )}

        {/* Language Breakdown Table */}
        {languageRows.length > 0 && (
          <section className="pb-6">
            <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100">
              Codebase Composition
            </h2>
            <div className="mt-3 overflow-hidden rounded-lg border border-slate-200 dark:border-slate-800">
              <table className="w-full text-left text-sm">
                <thead className="border-b border-slate-200 bg-slate-50 text-xs font-medium text-slate-500 dark:border-slate-800 dark:bg-[#0F172A] dark:text-slate-400">
                  <tr>
                    <th className="px-4 py-2.5">Language</th>
                    <th className="px-4 py-2.5 text-right">Files</th>
                    <th className="px-4 py-2.5 text-right">Size</th>
                    <th className="px-4 py-2.5 text-right">Share</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                  {languageRows.slice(0, 10).map((row) => (
                    <tr
                      key={row.name}
                      className="transition-colors hover:bg-slate-50/80 dark:hover:bg-slate-900/50"
                    >
                      <td className="px-4 py-2.5 text-xs font-medium text-slate-800 dark:text-slate-200">
                        {row.name}
                      </td>
                      <td className="px-4 py-2.5 text-right font-mono text-xs tabular-nums text-slate-600 dark:text-slate-400">
                        {formatNumber(row.files)}
                      </td>
                      <td className="px-4 py-2.5 text-right font-mono text-xs tabular-nums text-slate-600 dark:text-slate-400">
                        {formatBytes(row.bytes)}
                      </td>
                      <td className="px-4 py-2.5 text-right font-mono text-xs tabular-nums text-slate-600 dark:text-slate-400">
                        {row.share}%
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        )}
      </div>
    </div>
  );
}
