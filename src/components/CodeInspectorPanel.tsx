'use client';

import React, { useEffect, useRef, useState } from 'react';
import {
  Check,
  Copy,
  Crosshair,
  ExternalLink,
  FileCode2,
  Loader2,
  MessageSquarePlus,
} from 'lucide-react';
import type { RetrievedSource } from '@/lib/types';

export interface ActiveFileContent {
  path: string;
  language: string;
  content: string;
  indexed: boolean;
  githubUrl: string;
}

interface CodeInspectorPanelProps {
  activeTab: 'context' | 'file';
  onTabChange: (tab: 'context' | 'file') => void;
  sources: RetrievedSource[];
  activeFile: ActiveFileContent | null;
  fileLoading: boolean;
  fileError: string | null;
  highlightRange: { startLine: number; endLine: number } | null;
  focusedFile: string | null;
  onOpenFileAtRange: (path: string, startLine?: number, endLine?: number) => void;
  onAskAboutFile: (path: string) => void;
}

export default function CodeInspectorPanel({
  activeTab,
  onTabChange,
  sources,
  activeFile,
  fileLoading,
  fileError,
  highlightRange,
  focusedFile,
  onOpenFileAtRange,
  onAskAboutFile,
}: CodeInspectorPanelProps) {
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const highlightLineRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (activeTab === 'file' && highlightRange && highlightLineRef.current) {
      highlightLineRef.current.scrollIntoView({
        behavior: 'smooth',
        block: 'center',
      });
    }
  }, [activeTab, activeFile?.path, highlightRange]);

  const handleCopy = async (id: string, text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 1800);
    } catch {
      // Clipboard unavailable
    }
  };

  const lines = activeFile ? activeFile.content.split(/\r?\n/) : [];

  return (
    <section className="flex h-full flex-col bg-white dark:bg-[#0B1120]">
      <div className="flex items-center justify-between gap-2 border-b border-slate-200 px-4 py-2.5 dark:border-slate-800">
        <div className="flex items-center gap-1 rounded-md bg-slate-100 p-0.5 dark:bg-slate-900">
          <button
            type="button"
            onClick={() => onTabChange('context')}
            className={`rounded px-3 py-1 text-xs font-medium transition-colors whitespace-nowrap shrink-0 tabular-nums ${
              activeTab === 'context'
                ? 'bg-white text-slate-900 shadow-xs dark:bg-slate-800 dark:text-slate-100'
                : 'text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-200'
            }`}
          >
            Cited Context ({sources.length})
          </button>
          <button
            type="button"
            onClick={() => onTabChange('file')}
            className={`rounded px-3 py-1 text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
              activeTab === 'file'
                ? 'bg-white text-slate-900 shadow-xs dark:bg-slate-800 dark:text-slate-100'
                : 'text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-200'
            }`}
          >
            File Viewer
          </button>
        </div>

        {activeTab === 'file' && activeFile && (
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => handleCopy('active-file', activeFile.content)}
              className="inline-flex items-center gap-1 rounded-md border border-slate-200 px-2.5 py-1 text-xs font-medium text-slate-700 transition-colors hover:bg-slate-100 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800 whitespace-nowrap shrink-0"
            >
              {copiedId === 'active-file' ? (
                <>
                  <Check className="h-3.5 w-3.5 text-emerald-500" />
                  <span>Copied</span>
                </>
              ) : (
                <>
                  <Copy className="h-3.5 w-3.5" />
                  <span>Copy</span>
                </>
              )}
            </button>
            <a
              href={activeFile.githubUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 rounded-md border border-slate-200 px-2.5 py-1 text-xs font-medium text-slate-700 transition-colors hover:bg-slate-100 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800 whitespace-nowrap shrink-0"
              title="Open file on GitHub"
            >
              <ExternalLink className="h-3.5 w-3.5" />
              <span>GitHub</span>
            </a>
          </div>
        )}
      </div>

      {activeTab === 'context' ? (
        <div className="workspace-scroll flex-1 overflow-y-auto p-4">
          {sources.length === 0 ? (
            <div className="flex h-full flex-col items-center justify-center px-6 text-center">
              <FileCode2 className="mb-3 h-7 w-7 text-slate-400 dark:text-slate-600" />
              <p className="text-sm font-medium text-slate-700 dark:text-slate-300">
                No code citations yet
              </p>
              <p className="mt-1 max-w-xs text-xs leading-relaxed text-slate-500 dark:text-slate-400">
                Ask any question in the chat to inspect the exact source chunks and line ranges retrieved for the answer.
              </p>
            </div>
          ) : (
            <div className="divide-y divide-slate-200 dark:divide-slate-800">
              {sources.map((src, idx) => (
                <div key={`${src.id}-${idx}`} className="py-4 first:pt-0 last:pb-0">
                  <div className="mb-2 flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <button
                        type="button"
                        onClick={() =>
                          onOpenFileAtRange(src.filePath, src.startLine, src.endLine)
                        }
                        className="block max-w-full truncate text-left font-mono text-xs font-medium text-blue-600 hover:underline dark:text-blue-400"
                        title={`Inspect ${src.filePath}`}
                      >
                        {src.filePath}
                      </button>
                      <div className="mt-0.5 flex items-center gap-2 text-[11px] text-slate-500 tabular-nums dark:text-slate-400">
                        <span>
                          Lines {src.startLine}–{src.endLine}
                        </span>
                        <span aria-hidden="true">·</span>
                        <span>{Math.round(src.score * 100)}% relevance</span>
                      </div>
                    </div>

                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        type="button"
                        onClick={() => handleCopy(src.id, src.content)}
                        className="rounded p-1.5 text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-800 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-200"
                        title="Copy snippet"
                      >
                        {copiedId === src.id ? (
                          <Check className="h-3.5 w-3.5 text-emerald-500" />
                        ) : (
                          <Copy className="h-3.5 w-3.5" />
                        )}
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          onOpenFileAtRange(src.filePath, src.startLine, src.endLine)
                        }
                        className="rounded px-2 py-1 text-[11px] font-medium text-slate-600 transition-colors hover:bg-slate-100 hover:text-slate-900 dark:text-slate-300 dark:hover:bg-slate-800 whitespace-nowrap shrink-0"
                      >
                        Open File
                      </button>
                    </div>
                  </div>

                  <pre className="workspace-scroll max-h-60 overflow-auto rounded-md border border-slate-200 bg-slate-50 p-3 font-mono text-[12px] leading-relaxed text-slate-800 dark:border-slate-800 dark:bg-[#0F172A] dark:text-slate-200">
                    <code>{src.content}</code>
                  </pre>
                </div>
              ))}
            </div>
          )}
        </div>
      ) : (
        <div className="flex min-h-0 flex-1 flex-col">
          {fileLoading ? (
            <div className="flex flex-1 items-center justify-center gap-2 text-sm text-slate-500 dark:text-slate-400">
              <Loader2 className="h-4 w-4 animate-spin text-blue-500" />
              <span>Loading file contents...</span>
            </div>
          ) : fileError ? (
            <div className="p-6 text-sm text-rose-600 dark:text-rose-400">
              {fileError}
            </div>
          ) : !activeFile ? (
            <div className="flex flex-1 flex-col items-center justify-center px-6 text-center">
              <FileCode2 className="mb-3 h-7 w-7 text-slate-400 dark:text-slate-600" />
              <p className="text-sm font-medium text-slate-700 dark:text-slate-300">
                Select a file to inspect
              </p>
              <p className="mt-1 max-w-xs text-xs leading-relaxed text-slate-500 dark:text-slate-400">
                Choose any file from the left repository tree or click a citation link in the chat.
              </p>
            </div>
          ) : (
            <>
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 bg-slate-50/70 px-4 py-2 dark:border-slate-800 dark:bg-[#0D1425]">
                <div className="min-w-0">
                  <p className="truncate font-mono text-xs font-medium text-slate-900 dark:text-slate-100">
                    {activeFile.path}
                  </p>
                  <div className="mt-0.5 flex items-center gap-2 text-[11px] text-slate-500 tabular-nums dark:text-slate-400">
                    <span>{activeFile.language}</span>
                    <span aria-hidden="true">·</span>
                    <span>{lines.length} lines</span>
                    <span aria-hidden="true">·</span>
                    <span>
                      {activeFile.indexed ? 'Indexed in vector store' : 'Loaded on demand'}
                    </span>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => onAskAboutFile(activeFile.path)}
                  className="inline-flex items-center gap-1.5 rounded-md bg-blue-600 px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-blue-700 whitespace-nowrap shrink-0"
                >
                  {focusedFile === activeFile.path ? (
                    <>
                      <Crosshair className="h-3.5 w-3.5" />
                      <span>Focused in Chat</span>
                    </>
                  ) : (
                    <>
                      <MessageSquarePlus className="h-3.5 w-3.5" />
                      <span>Ask About File</span>
                    </>
                  )}
                </button>
              </div>

              <div className="workspace-scroll flex-1 overflow-auto bg-slate-50/40 font-mono text-[12px] leading-6 dark:bg-[#0A101E]">
                <div className="min-w-max py-3">
                  {lines.map((line, i) => {
                    const lineNumber = i + 1;
                    const isHighlighted =
                      highlightRange !== null &&
                      lineNumber >= highlightRange.startLine &&
                      lineNumber <= highlightRange.endLine;
                    const isAnchor =
                      highlightRange !== null &&
                      lineNumber === highlightRange.startLine;

                    return (
                      <div
                        key={lineNumber}
                        ref={isAnchor ? highlightLineRef : undefined}
                        className={`flex px-4 ${
                          isHighlighted
                            ? 'bg-blue-500/12 text-slate-900 dark:bg-blue-500/18 dark:text-slate-100'
                            : 'text-slate-700 hover:bg-slate-200/40 dark:text-slate-300 dark:hover:bg-slate-800/40'
                        }`}
                      >
                        <span className="mr-4 w-10 shrink-0 select-none text-right tabular-nums text-slate-400 dark:text-slate-600">
                          {lineNumber}
                        </span>
                        <span className="whitespace-pre">{line || ' '}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            </>
          )}
        </div>
      )}
    </section>
  );
}
