'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Crosshair,
  Download,
  FileCode2,
  Loader2,
  Menu,
  Moon,
  PanelRightClose,
  PanelRightOpen,
  RotateCcw,
  Send,
  Square,
  Sun,
  Trash2,
  X,
} from 'lucide-react';
import ArchitectureView from './ArchitectureView';
import CodeInspectorPanel, {
  type ActiveFileContent,
} from './CodeInspectorPanel';
import FileTreeSidebar from './FileTreeSidebar';
import MarkdownRenderer from './MarkdownRenderer';
import RepoLanding from './RepoLanding';
import type {
  ChatMessage,
  LoadedRepoResponse,
  RepoSummaryListItem,
  RetrievedSource,
} from '@/lib/types';

type WorkspaceTab = 'chat' | 'architecture' | 'files';

const LOADING_STAGES = [
  'Fetching repository metadata and file tree from GitHub...',
  'Downloading priority source files and documentation...',
  'Chunking code and computing semantic embeddings...',
  'Synthesizing architectural summary and starter questions...',
];

function formatCompactNumber(n: number): string {
  if (n >= 1000) return `${(n / 1000).toFixed(1)}k`;
  return String(n);
}

export default function WorkspaceApp() {
  const [theme, setTheme] = useState<'dark' | 'light'>('dark');
  const [repo, setRepo] = useState<LoadedRepoResponse | null>(null);
  const [recentRepos, setRecentRepos] = useState<RepoSummaryListItem[]>([]);
  const [isLoadingRepo, setIsLoadingRepo] = useState(false);
  const [loadingStageIndex, setLoadingStageIndex] = useState(0);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [activeWorkspaceTab, setActiveWorkspaceTab] =
    useState<WorkspaceTab>('chat');
  const [showInspector, setShowInspector] = useState(true);
  const [inspectorTab, setInspectorTab] = useState<'context' | 'file'>('context');
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [question, setQuestion] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);
  const [chatError, setChatError] = useState<string | null>(null);
  const [needsReindex, setNeedsReindex] = useState(false);

  const [activeSources, setActiveSources] = useState<RetrievedSource[]>([]);
  const [selectedFilePath, setSelectedFilePath] = useState<string | null>(null);
  const [activeFile, setActiveFile] = useState<ActiveFileContent | null>(null);
  const [fileLoading, setFileLoading] = useState(false);
  const [fileError, setFileError] = useState<string | null>(null);
  const [highlightRange, setHighlightRange] = useState<{
    startLine: number;
    endLine: number;
  } | null>(null);
  const [focusedFile, setFocusedFile] = useState<string | null>(null);

  const abortRef = useRef<AbortController | null>(null);
  const chatBottomRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLTextAreaElement | null>(null);

  // Sync theme with <html> class and localStorage
  useEffect(() => {
    try {
      const saved = window.localStorage.getItem('gt_theme');
      if (saved === 'light' || saved === 'dark') {
        setTheme(saved);
        document.documentElement.classList.toggle('dark', saved === 'dark');
      }
    } catch {
      // Ignore storage access errors
    }
  }, []);

  const toggleTheme = () => {
    setTheme((prev) => {
      const next = prev === 'dark' ? 'light' : 'dark';
      document.documentElement.classList.toggle('dark', next === 'dark');
      try {
        window.localStorage.setItem('gt_theme', next);
      } catch {
        // Ignore storage errors
      }
      return next;
    });
  };

  // Load recent session repos from server memory
  const refreshRecentRepos = useCallback(async () => {
    try {
      const res = await fetch('/api/repos', { cache: 'no-store' });
      if (res.ok) {
        const data = (await res.json()) as { repos?: RepoSummaryListItem[] };
        setRecentRepos(data.repos ?? []);
      }
    } catch {
      // Non-fatal
    }
  }, []);

  useEffect(() => {
    refreshRecentRepos();
  }, [refreshRecentRepos]);

  // Progress stage ticker during repo ingestion
  useEffect(() => {
    if (!isLoadingRepo) {
      setLoadingStageIndex(0);
      return;
    }
    const timer = setInterval(() => {
      setLoadingStageIndex((prev) =>
        prev < LOADING_STAGES.length - 1 ? prev + 1 : prev
      );
    }, 2400);
    return () => clearInterval(timer);
  }, [isLoadingRepo]);

  // Persist messages per repoKey
  useEffect(() => {
    if (!repo) return;
    try {
      window.localStorage.setItem(
        `gt_messages_${repo.repoKey}`,
        JSON.stringify(messages)
      );
    } catch {
      // Ignore storage quota errors
    }
  }, [messages, repo]);

  // Auto-scroll chat when new content streams in
  useEffect(() => {
    if (activeWorkspaceTab === 'chat') {
      chatBottomRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, activeWorkspaceTab]);

  const validFilePaths = useMemo(() => {
    if (!repo) return new Set<string>();
    return new Set(repo.tree.map((t) => t.path));
  }, [repo]);

  const hydrateLoadedRepo = useCallback((loaded: LoadedRepoResponse) => {
    setRepo(loaded);
    setActiveWorkspaceTab('chat');
    setActiveFile(null);
    setSelectedFilePath(null);
    setHighlightRange(null);
    setFocusedFile(null);
    setChatError(null);
    setNeedsReindex(false);
    setInspectorTab('context');

    try {
      const saved = window.localStorage.getItem(`gt_messages_${loaded.repoKey}`);
      if (saved) {
        const parsed = JSON.parse(saved) as ChatMessage[];
        if (Array.isArray(parsed)) {
          setMessages(parsed);
          const lastWithSources = [...parsed]
            .reverse()
            .find((m) => m.sources && m.sources.length > 0);
          setActiveSources(lastWithSources?.sources ?? []);
          return;
        }
      }
    } catch {
      // Ignore invalid localStorage payload
    }

    setMessages([]);
    setActiveSources([]);
  }, []);

  const handleLoadRepo = async (params: {
    repoUrl: string;
    branch?: string;
    maxFiles: number;
    forceReload?: boolean;
  }) => {
    setIsLoadingRepo(true);
    setLoadError(null);
    setLoadingStageIndex(0);

    try {
      const res = await fetch('/api/load', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(params),
      });

      const data = (await res.json()) as LoadedRepoResponse & {
        error?: string;
      };

      if (!res.ok) {
        throw new Error(data.error || `Failed to load repository (HTTP ${res.status}).`);
      }

      hydrateLoadedRepo(data);
      refreshRecentRepos();
    } catch (err: unknown) {
      setLoadError(
        err instanceof Error ? err.message : 'Unable to load repository.'
      );
    } finally {
      setIsLoadingRepo(false);
    }
  };

  const handleSelectCachedRepo = async (repoKey: string) => {
    setIsLoadingRepo(true);
    setLoadError(null);
    try {
      const res = await fetch(
        `/api/repos?repoKey=${encodeURIComponent(repoKey)}`,
        { cache: 'no-store' }
      );
      const data = (await res.json()) as LoadedRepoResponse & {
        error?: string;
      };
      if (!res.ok) {
        throw new Error(data.error || 'Cached repository is no longer available.');
      }
      hydrateLoadedRepo(data);
    } catch (err: unknown) {
      setLoadError(
        err instanceof Error ? err.message : 'Unable to open cached repository.'
      );
      refreshRecentRepos();
    } finally {
      setIsLoadingRepo(false);
    }
  };

  const openFileInViewer = useCallback(
    async (
      filePath: string,
      range?: { startLine: number; endLine: number },
      switchToFilesTab = false
    ) => {
      if (!repo) return;
      setSelectedFilePath(filePath);
      setHighlightRange(range ?? null);
      setFileError(null);
      setMobileSidebarOpen(false);

      if (switchToFilesTab) {
        setActiveWorkspaceTab('files');
      } else if (activeWorkspaceTab === 'architecture') {
        setActiveWorkspaceTab('files');
      } else {
        setShowInspector(true);
        setInspectorTab('file');
      }

      if (activeFile?.path === filePath) {
        return;
      }

      setFileLoading(true);
      try {
        const res = await fetch(
          `/api/file?repoKey=${encodeURIComponent(repo.repoKey)}&path=${encodeURIComponent(filePath)}`,
          { cache: 'no-store' }
        );
        const data = (await res.json()) as ActiveFileContent & {
          error?: string;
        };
        if (!res.ok) {
          throw new Error(data.error || 'Failed to load file.');
        }
        setActiveFile(data);
      } catch (err: unknown) {
        setFileError(
          err instanceof Error ? err.message : 'Failed to load file.'
        );
      } finally {
        setFileLoading(false);
      }
    },
    [repo, activeFile?.path, activeWorkspaceTab]
  );

  const handleSendQuestion = async (
    customQuestion?: string,
    overrideFocusFile?: string
  ) => {
    if (!repo || isStreaming) return;
    const text = (customQuestion ?? question).trim();
    if (!text) return;

    const targetFocus =
      overrideFocusFile !== undefined ? overrideFocusFile : focusedFile ?? undefined;

    if (overrideFocusFile) {
      setFocusedFile(overrideFocusFile);
    }

    setActiveWorkspaceTab('chat');
    setChatError(null);
    setNeedsReindex(false);
    if (!customQuestion) setQuestion('');

    const userMsg: ChatMessage = {
      id: `u-${Date.now()}`,
      role: 'user',
      content: text,
      focusedFile: targetFocus,
      createdAt: Date.now(),
    };

    const assistantId = `a-${Date.now() + 1}`;
    const assistantPlaceholder: ChatMessage = {
      id: assistantId,
      role: 'assistant',
      content: '',
      sources: [],
      createdAt: Date.now(),
    };

    const historyPayload = messages
      .filter((m) => !m.error && m.content.trim().length > 0)
      .slice(-6)
      .map((m) => ({ role: m.role, content: m.content }));

    setMessages((prev) => [...prev, userMsg, assistantPlaceholder]);
    setIsStreaming(true);

    const controller = new AbortController();
    abortRef.current = controller;

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          repoKey: repo.repoKey,
          question: text,
          history: historyPayload,
          focusedFile: targetFocus,
        }),
        signal: controller.signal,
      });

      if (!res.ok) {
        const errData = (await res.json().catch(() => ({}))) as {
          error?: string;
          code?: string;
        };
        if (errData.code === 'REPO_NOT_LOADED') {
          setNeedsReindex(true);
        }
        throw new Error(
          errData.error || `Chat request failed (HTTP ${res.status}).`
        );
      }

      if (!res.body) {
        throw new Error('Streaming response body unavailable.');
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        const events = buffer.split('\n\n');
        buffer = events.pop() ?? '';

        for (const rawEvent of events) {
          const line = rawEvent
            .split('\n')
            .find((l) => l.startsWith('data: '));
          if (!line) continue;

          const jsonStr = line.slice(6).trim();
          if (!jsonStr) continue;

          const payload = JSON.parse(jsonStr) as {
            type: 'sources' | 'delta' | 'done' | 'error';
            sources?: RetrievedSource[];
            text?: string;
            message?: string;
          };

          if (payload.type === 'sources' && Array.isArray(payload.sources)) {
            setActiveSources(payload.sources);
            setInspectorTab('context');
            setMessages((prev) =>
              prev.map((m) =>
                m.id === assistantId ? { ...m, sources: payload.sources } : m
              )
            );
          } else if (payload.type === 'delta' && payload.text) {
            setMessages((prev) =>
              prev.map((m) =>
                m.id === assistantId
                  ? { ...m, content: m.content + payload.text }
                  : m
              )
            );
          } else if (payload.type === 'error') {
            throw new Error(payload.message || 'Streaming generation failed.');
          }
        }
      }
    } catch (err: unknown) {
      if (err instanceof Error && err.name === 'AbortError') {
        setMessages((prev) =>
          prev.map((m) =>
            m.id === assistantId && !m.content
              ? { ...m, content: '_Generation stopped._' }
              : m
          )
        );
      } else {
        const msg =
          err instanceof Error ? err.message : 'Failed to generate answer.';
        setChatError(msg);
        setMessages((prev) =>
          prev.map((m) =>
            m.id === assistantId
              ? { ...m, content: msg, error: true }
              : m
          )
        );
      }
    } finally {
      setIsStreaming(false);
      abortRef.current = null;
    }
  };

  const handleStopStreaming = () => {
    abortRef.current?.abort();
  };

  const handleClearChat = () => {
    if (isStreaming) handleStopStreaming();
    setMessages([]);
    setActiveSources([]);
    setChatError(null);
  };

  const handleExportMarkdown = () => {
    if (!repo) return;
    const parts: string[] = [
      `# ${repo.metadata.fullName} — GitHub Talker Notes`,
      `Repository: ${repo.metadata.url} (branch \`${repo.metadata.branch}\`)`,
      '',
      '## Architecture Overview',
      repo.summary.overview,
      '',
      repo.summary.architecture,
      '',
    ];

    if (messages.length > 0) {
      parts.push('## Conversation Transcript', '');
      for (const m of messages) {
        parts.push(m.role === 'user' ? `### Question\n${m.content}` : `### Answer\n${m.content}`);
        if (m.sources && m.sources.length > 0) {
          parts.push(
            '\n**Cited Files:** ' +
              m.sources
                .map((s) => `\`${s.filePath}\` (L${s.startLine}–L${s.endLine})`)
                .join(', ')
          );
        }
        parts.push('');
      }
    }

    const blob = new Blob([parts.join('\n')], {
      type: 'text/markdown;charset=utf-8',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${repo.metadata.repo}-notes.md`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleReindexCurrent = async () => {
    if (!repo) return;
    await handleLoadRepo({
      repoUrl: repo.metadata.url,
      branch: repo.metadata.branch,
      maxFiles: Math.max(repo.stats.indexedFileCount, 60),
      forceReload: true,
    });
  };

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-white text-slate-900 dark:bg-[#0B1120] dark:text-slate-100">
      {/* Top Navigation Bar (Strict 3-Zone Contract) */}
      <header className="flex h-14 shrink-0 items-center justify-between gap-8 border-b border-slate-200 bg-white px-4 lg:px-6 dark:border-slate-800 dark:bg-[#0B1120]">
        {/* Zone 1: Brand + Contextual Breadcrumb */}
        <div className="flex min-w-0 items-center gap-2.5">
          {repo && (
            <button
              type="button"
              onClick={() => setMobileSidebarOpen((v) => !v)}
              aria-label="Toggle file explorer"
              className="rounded-md p-1.5 text-slate-500 hover:bg-slate-100 hover:text-slate-900 lg:hidden dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-100"
            >
              <Menu className="h-4 w-4" />
            </button>
          )}
          <button
            type="button"
            onClick={() => {
              if (isStreaming) handleStopStreaming();
              setRepo(null);
              setLoadError(null);
              refreshRecentRepos();
            }}
            className="font-display text-base font-bold tracking-tight text-slate-900 transition-colors hover:text-blue-600 dark:text-slate-50 dark:hover:text-blue-400 whitespace-nowrap shrink-0"
          >
            GitHub Talker
          </button>

          {repo && (
            <div className="hidden min-w-0 items-center gap-2 text-sm text-slate-400 sm:flex dark:text-slate-600">
              <span aria-hidden="true">/</span>
              <span className="truncate font-mono text-xs font-medium text-slate-700 dark:text-slate-300">
                {repo.metadata.fullName}
              </span>
            </div>
          )}
        </div>

        {/* Zone 2: Clean Single-Line Navigation */}
        {repo ? (
          <nav
            aria-label="Workspace views"
            className="flex items-center gap-6 text-sm font-medium"
          >
            {(
              [
                { id: 'chat', label: 'Chat' },
                { id: 'architecture', label: 'Architecture' },
                { id: 'files', label: 'Files' },
              ] as const
            ).map((tab) => {
              const active = activeWorkspaceTab === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setActiveWorkspaceTab(tab.id)}
                  className={`relative py-4 text-sm transition-colors whitespace-nowrap shrink-0 ${
                    active
                      ? 'text-slate-900 dark:text-slate-50'
                      : 'text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-200'
                  }`}
                >
                  {tab.label}
                  {active && (
                    <span className="absolute inset-x-0 bottom-0 h-0.5 bg-blue-600 dark:bg-blue-500" />
                  )}
                </button>
              );
            })}
          </nav>
        ) : (
          <nav
            aria-label="Primary navigation"
            className="hidden items-center gap-6 text-sm font-medium text-slate-500 md:flex dark:text-slate-400"
          >
            <a
              href="#quick-start"
              className="transition-colors hover:text-slate-900 dark:hover:text-slate-100 whitespace-nowrap shrink-0"
            >
              Quick Start
            </a>
            <a
              href="#capabilities"
              className="transition-colors hover:text-slate-900 dark:hover:text-slate-100 whitespace-nowrap shrink-0"
            >
              Capabilities
            </a>
            {recentRepos.length > 0 && (
              <a
                href="#recent"
                className="transition-colors hover:text-slate-900 dark:hover:text-slate-100 whitespace-nowrap shrink-0"
              >
                Recent
              </a>
            )}
          </nav>
        )}

        {/* Zone 3: Right Actions */}
        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={toggleTheme}
            aria-label={
              theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'
            }
            className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-slate-200 text-slate-600 transition-colors hover:bg-slate-100 hover:text-slate-900 dark:border-slate-800 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-100"
          >
            {theme === 'dark' ? (
              <Sun className="h-4 w-4" />
            ) : (
              <Moon className="h-4 w-4" />
            )}
          </button>

          {repo && (
            <button
              type="button"
              onClick={() => {
                if (isStreaming) handleStopStreaming();
                setRepo(null);
                setLoadError(null);
                refreshRecentRepos();
              }}
              className="rounded-md bg-slate-900 px-3.5 py-1.5 text-xs font-medium text-white transition-colors hover:bg-slate-800 dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-white whitespace-nowrap shrink-0"
            >
              Switch Repo
            </button>
          )}
        </div>
      </header>

      {/* Main Content Area */}
      {!repo ? (
        <div className="workspace-scroll flex-1 overflow-y-auto">
          <RepoLanding
            onLoadRepo={handleLoadRepo}
            onSelectCachedRepo={handleSelectCachedRepo}
            recentRepos={recentRepos}
            isLoading={isLoadingRepo}
            loadingStage={LOADING_STAGES[loadingStageIndex]}
            error={loadError}
          />
        </div>
      ) : (
        <div className="relative flex min-h-0 flex-1 overflow-hidden">
          {/* Desktop Left File Tree Sidebar */}
          <div className="hidden w-64 shrink-0 lg:block xl:w-72">
            <FileTreeSidebar
              tree={repo.tree}
              languageStats={repo.stats.languageStats}
              selectedFile={selectedFilePath}
              focusedFile={focusedFile}
              onSelectFile={(path) => openFileInViewer(path)}
              onFocusFile={(path) => {
                setFocusedFile(path);
                if (path) {
                  setActiveWorkspaceTab('chat');
                  inputRef.current?.focus();
                }
              }}
            />
          </div>

          {/* Mobile Drawer Sidebar */}
          {mobileSidebarOpen && (
            <div className="fixed inset-0 z-40 flex lg:hidden">
              <div
                className="fixed inset-0 bg-black/50"
                onClick={() => setMobileSidebarOpen(false)}
              />
              <div className="relative z-50 flex h-full w-72 flex-col bg-white dark:bg-[#0D1425]">
                <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3 dark:border-slate-800">
                  <span className="font-mono text-xs font-semibold text-slate-900 dark:text-slate-100">
                    Repository Files
                  </span>
                  <button
                    type="button"
                    onClick={() => setMobileSidebarOpen(false)}
                    className="rounded p-1 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
                <div className="min-h-0 flex-1">
                  <FileTreeSidebar
                    tree={repo.tree}
                    languageStats={repo.stats.languageStats}
                    selectedFile={selectedFilePath}
                    focusedFile={focusedFile}
                    onSelectFile={(path) => openFileInViewer(path)}
                    onFocusFile={(path) => {
                      setFocusedFile(path);
                      setMobileSidebarOpen(false);
                      if (path) setActiveWorkspaceTab('chat');
                    }}
                  />
                </div>
              </div>
            </div>
          )}

          {/* Center + Right Workspace Views */}
          {activeWorkspaceTab === 'architecture' ? (
            <div className="min-w-0 flex-1 overflow-hidden">
              <ArchitectureView
                repo={repo}
                onOpenFile={(path) => openFileInViewer(path, undefined, true)}
                onAskQuestion={(q, focusPath) =>
                  handleSendQuestion(q, focusPath)
                }
              />
            </div>
          ) : activeWorkspaceTab === 'files' ? (
            <div className="min-w-0 flex-1 overflow-hidden">
              <CodeInspectorPanel
                activeTab="file"
                onTabChange={(t) => {
                  if (t === 'context') {
                    setActiveWorkspaceTab('chat');
                    setShowInspector(true);
                    setInspectorTab('context');
                  }
                }}
                sources={activeSources}
                activeFile={activeFile}
                fileLoading={fileLoading}
                fileError={fileError}
                highlightRange={highlightRange}
                focusedFile={focusedFile}
                onOpenFileAtRange={(p, s, e) =>
                  openFileInViewer(
                    p,
                    s && e ? { startLine: s, endLine: e } : undefined,
                    true
                  )
                }
                onAskAboutFile={(p) => {
                  setFocusedFile(p);
                  setActiveWorkspaceTab('chat');
                  setTimeout(() => inputRef.current?.focus(), 60);
                }}
              />
            </div>
          ) : (
            <div className="flex min-w-0 flex-1 overflow-hidden">
              {/* Primary Chat Column */}
              <div className="flex min-w-0 flex-1 flex-col">
                {/* Quiet Workspace Sub-bar */}
                <div className="flex items-center justify-between gap-4 border-b border-slate-200 px-5 py-2.5 text-xs text-slate-500 dark:border-slate-800 dark:text-slate-400">
                  <div className="flex min-w-0 items-center gap-2 truncate tabular-nums">
                    <span className="font-medium text-slate-700 dark:text-slate-300">
                      {repo.metadata.branch}
                    </span>
                    <span aria-hidden="true">·</span>
                    <span>{repo.stats.indexedFileCount} files indexed</span>
                    <span aria-hidden="true">·</span>
                    <span>{formatCompactNumber(repo.metadata.stars)} stars</span>
                    {repo.stats.embeddedChunks > 0 && (
                      <>
                        <span aria-hidden="true">·</span>
                        <span>Semantic index ready</span>
                      </>
                    )}
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0">
                    <button
                      type="button"
                      onClick={handleExportMarkdown}
                      className="inline-flex items-center gap-1 rounded px-2 py-1 text-xs font-medium text-slate-600 transition-colors hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-100 whitespace-nowrap shrink-0"
                      title="Export summary and chat transcript as Markdown"
                    >
                      <Download className="h-3.5 w-3.5" />
                      <span className="hidden sm:inline">Export</span>
                    </button>
                    {messages.length > 0 && (
                      <button
                        type="button"
                        onClick={handleClearChat}
                        className="inline-flex items-center gap-1 rounded px-2 py-1 text-xs font-medium text-slate-600 transition-colors hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-100 whitespace-nowrap shrink-0"
                        title="Clear conversation"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                        <span className="hidden sm:inline">Clear</span>
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => setShowInspector((v) => !v)}
                      className="hidden items-center gap-1 rounded px-2 py-1 text-xs font-medium text-slate-600 transition-colors hover:bg-slate-100 hover:text-slate-900 xl:inline-flex dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-100 whitespace-nowrap shrink-0"
                      title={
                        showInspector
                          ? 'Hide context inspector'
                          : 'Show context inspector'
                      }
                    >
                      {showInspector ? (
                        <PanelRightClose className="h-3.5 w-3.5" />
                      ) : (
                        <PanelRightOpen className="h-3.5 w-3.5" />
                      )}
                      <span>Inspector</span>
                    </button>
                  </div>
                </div>

                {/* Chat Messages Scroll Region */}
                <div className="workspace-scroll flex-1 overflow-y-auto px-5 py-6 lg:px-8">
                  <div className="mx-auto max-w-3xl">
                    {messages.length === 0 ? (
                      <div className="py-4">
                        <h2 className="text-xl font-semibold tracking-tight text-slate-900 dark:text-slate-100">
                          {repo.metadata.fullName}
                        </h2>
                        <p className="mt-2 text-sm leading-relaxed text-slate-600 dark:text-slate-300">
                          {repo.summary.overview}
                        </p>

                        <div className="mt-6 border-t border-slate-200 pt-6 dark:border-slate-800">
                          <p className="text-xs font-medium text-slate-500 dark:text-slate-400">
                            Suggested questions for this codebase
                          </p>
                          <div className="mt-3 grid grid-cols-1 gap-2.5 sm:grid-cols-2">
                            {repo.summary.suggestedQuestions.map((q, idx) => (
                              <button
                                key={idx}
                                type="button"
                                onClick={() => handleSendQuestion(q)}
                                className="rounded-lg border border-slate-200 bg-slate-50/60 px-4 py-3 text-left text-xs leading-relaxed text-slate-700 transition-colors hover:border-blue-500/50 hover:bg-slate-100/80 hover:text-slate-900 dark:border-slate-800 dark:bg-[#0F172A]/70 dark:text-slate-300 dark:hover:border-blue-500/50 dark:hover:bg-[#131E36] dark:hover:text-slate-100"
                              >
                                {q}
                              </button>
                            ))}
                          </div>
                        </div>

                        {repo.summary.keyFiles.length > 0 && (
                          <div className="mt-8 border-t border-slate-200 pt-6 dark:border-slate-800">
                            <div className="flex items-center justify-between">
                              <p className="text-xs font-medium text-slate-500 dark:text-slate-400">
                                Primary entry points
                              </p>
                              <button
                                type="button"
                                onClick={() =>
                                  setActiveWorkspaceTab('architecture')
                                }
                                className="text-xs font-medium text-blue-600 hover:underline dark:text-blue-400"
                              >
                                Full architecture report
                              </button>
                            </div>
                            <div className="mt-3 divide-y divide-slate-200 dark:divide-slate-800">
                              {repo.summary.keyFiles.slice(0, 4).map((kf) => (
                                <div
                                  key={kf.path}
                                  className="flex items-baseline justify-between gap-4 py-2.5 text-xs"
                                >
                                  <button
                                    type="button"
                                    onClick={() => openFileInViewer(kf.path)}
                                    className="font-mono font-medium text-blue-600 hover:underline dark:text-blue-400 shrink-0"
                                  >
                                    {kf.path}
                                  </button>
                                  <span className="truncate text-slate-500 dark:text-slate-400">
                                    {kf.role}
                                  </span>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="divide-y divide-slate-200 dark:divide-slate-800/80">
                        {messages.map((msg) => (
                          <article
                            key={msg.id}
                            className="py-6 first:pt-0 last:pb-2"
                          >
                            {msg.role === 'user' ? (
                              <div>
                                <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
                                  <span className="font-semibold text-slate-900 dark:text-slate-100">
                                    You
                                  </span>
                                  {msg.focusedFile && (
                                    <>
                                      <span aria-hidden="true">·</span>
                                      <span className="font-mono text-blue-600 dark:text-blue-400">
                                        Focused: {msg.focusedFile}
                                      </span>
                                    </>
                                  )}
                                </div>
                                <p className="mt-1.5 text-[15px] leading-relaxed text-slate-900 dark:text-slate-100">
                                  {msg.content}
                                </p>
                              </div>
                            ) : (
                              <div>
                                <div className="mb-2 flex items-center justify-between gap-2 text-xs text-slate-500 dark:text-slate-400">
                                  <span className="font-semibold text-blue-600 dark:text-blue-400">
                                    GitHub Talker
                                  </span>
                                  {msg.sources && msg.sources.length > 0 && (
                                    <button
                                      type="button"
                                      onClick={() => {
                                        setActiveSources(msg.sources ?? []);
                                        setShowInspector(true);
                                        setInspectorTab('context');
                                      }}
                                      className="font-mono text-[11px] tabular-nums text-slate-500 transition-colors hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-200"
                                    >
                                      Inspect {msg.sources.length} cited chunks
                                    </button>
                                  )}
                                </div>

                                {msg.error ? (
                                  <p className="text-sm text-rose-600 dark:text-rose-400">
                                    {msg.content}
                                  </p>
                                ) : msg.content ? (
                                  <MarkdownRenderer
                                    content={msg.content}
                                    validFilePaths={validFilePaths}
                                    onSelectFilePath={(path) =>
                                      openFileInViewer(path)
                                    }
                                  />
                                ) : (
                                  <div className="flex items-center gap-2 py-2 text-xs text-slate-500 dark:text-slate-400">
                                    <Loader2 className="h-3.5 w-3.5 animate-spin text-blue-500" />
                                    <span>
                                      Retrieving code context and drafting response...
                                    </span>
                                  </div>
                                )}

                                {msg.sources && msg.sources.length > 0 && (
                                  <div className="mt-4 border-t border-slate-100 pt-3 dark:border-slate-800/70">
                                    <p className="mb-2 text-[11px] font-medium text-slate-500 dark:text-slate-400">
                                      Retrieved sources
                                    </p>
                                    <div className="flex flex-wrap gap-x-4 gap-y-1.5">
                                      {msg.sources.map((src, sIdx) => (
                                        <button
                                          key={`${src.id}-${sIdx}`}
                                          type="button"
                                          onClick={() => {
                                            setActiveSources(msg.sources ?? []);
                                            openFileInViewer(src.filePath, {
                                              startLine: src.startLine,
                                              endLine: src.endLine,
                                            });
                                          }}
                                          className="inline-flex items-center gap-1.5 font-mono text-xs text-slate-600 transition-colors hover:text-blue-600 dark:text-slate-400 dark:hover:text-blue-400"
                                        >
                                          <FileCode2 className="h-3.5 w-3.5 shrink-0 text-slate-400" />
                                          <span>{src.filePath}</span>
                                          <span className="text-[11px] tabular-nums text-slate-400 dark:text-slate-500">
                                            L{src.startLine}–{src.endLine}
                                          </span>
                                        </button>
                                      ))}
                                    </div>
                                  </div>
                                )}
                              </div>
                            )}
                          </article>
                        ))}
                        <div ref={chatBottomRef} />
                      </div>
                    )}
                  </div>
                </div>

                {/* Chat Composer */}
                <div className="border-t border-slate-200 bg-white px-5 py-3.5 lg:px-8 dark:border-slate-800 dark:bg-[#0B1120]">
                  <div className="mx-auto max-w-3xl">
                    {needsReindex && (
                      <div className="mb-3 flex items-center justify-between gap-3 rounded-lg border border-amber-200 bg-amber-50 px-3.5 py-2.5 text-xs text-amber-800 dark:border-amber-900/60 dark:bg-amber-950/30 dark:text-amber-200">
                        <span>
                          Repository cache cleared after server restart. Re-index to continue chatting.
                        </span>
                        <button
                          type="button"
                          onClick={handleReindexCurrent}
                          disabled={isLoadingRepo}
                          className="inline-flex items-center gap-1 rounded bg-amber-600 px-2.5 py-1 text-xs font-medium text-white hover:bg-amber-700 whitespace-nowrap shrink-0"
                        >
                          <RotateCcw className="h-3.5 w-3.5" />
                          <span>Re-index</span>
                        </button>
                      </div>
                    )}

                    {chatError && !needsReindex && (
                      <p className="mb-2 text-xs text-rose-600 dark:text-rose-400">
                        {chatError}
                      </p>
                    )}

                    {focusedFile && (
                      <div className="mb-2 flex items-center justify-between rounded-md border border-blue-200 bg-blue-50/70 px-3 py-1.5 text-xs text-blue-800 dark:border-blue-900/60 dark:bg-blue-950/40 dark:text-blue-200">
                        <div className="flex min-w-0 items-center gap-1.5">
                          <Crosshair className="h-3.5 w-3.5 shrink-0" />
                          <span className="truncate font-mono">
                            Focused on {focusedFile}
                          </span>
                        </div>
                        <button
                          type="button"
                          onClick={() => setFocusedFile(null)}
                          className="ml-2 text-blue-600 hover:text-blue-900 dark:text-blue-300 dark:hover:text-white"
                          aria-label="Clear focused file"
                        >
                          <X className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    )}

                    <div className="flex items-end gap-2.5 rounded-lg border border-slate-300 bg-slate-50/60 p-2 focus-within:border-blue-600 focus-within:bg-white focus-within:ring-2 focus-within:ring-blue-600/15 dark:border-slate-700 dark:bg-[#0F172A] dark:focus-within:border-blue-500">
                      <textarea
                        ref={inputRef}
                        rows={1}
                        value={question}
                        onChange={(e) => setQuestion(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' && !e.shiftKey) {
                            e.preventDefault();
                            handleSendQuestion();
                          }
                        }}
                        placeholder={
                          focusedFile
                            ? `Ask a question about ${focusedFile}...`
                            : `Ask about ${repo.metadata.repo} architecture, functions, or flows...`
                        }
                        aria-label="Ask a question about the repository"
                        className="max-h-32 min-h-[36px] flex-1 resize-none bg-transparent px-2 py-1.5 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none dark:text-slate-100 dark:placeholder:text-slate-500"
                      />

                      {isStreaming ? (
                        <button
                          type="button"
                          onClick={handleStopStreaming}
                          className="inline-flex h-9 items-center gap-1.5 rounded-md bg-slate-800 px-3.5 text-xs font-medium text-white transition-colors hover:bg-slate-700 dark:bg-slate-700 dark:hover:bg-slate-600 whitespace-nowrap shrink-0"
                        >
                          <Square className="h-3.5 w-3.5 fill-current" />
                          <span>Stop</span>
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={() => handleSendQuestion()}
                          disabled={!question.trim()}
                          className="inline-flex h-9 items-center gap-1.5 rounded-md bg-blue-600 px-4 text-xs font-medium text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-slate-300 dark:disabled:bg-slate-800 dark:disabled:text-slate-500 whitespace-nowrap shrink-0"
                        >
                          <Send className="h-3.5 w-3.5" />
                          <span>Ask</span>
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* Right Split Context & Code Inspector (Desktop XL+) */}
              {showInspector && (
                <div className="hidden w-[430px] shrink-0 border-l border-slate-200 xl:block 2xl:w-[500px] dark:border-slate-800">
                  <CodeInspectorPanel
                    activeTab={inspectorTab}
                    onTabChange={setInspectorTab}
                    sources={activeSources}
                    activeFile={activeFile}
                    fileLoading={fileLoading}
                    fileError={fileError}
                    highlightRange={highlightRange}
                    focusedFile={focusedFile}
                    onOpenFileAtRange={(p, s, e) =>
                      openFileInViewer(
                        p,
                        s && e ? { startLine: s, endLine: e } : undefined,
                        false
                      )
                    }
                    onAskAboutFile={(p) => {
                      setFocusedFile(p);
                      inputRef.current?.focus();
                    }}
                  />
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
