'use client';

import React, { useMemo, useState } from 'react';
import {
  ChevronDown,
  ChevronRight,
  Crosshair,
  FileCode2,
  Folder,
  FolderOpen,
  Search,
  X,
} from 'lucide-react';
import type { LanguageStat, TreeItem } from '@/lib/types';

interface FileTreeSidebarProps {
  tree: TreeItem[];
  languageStats: Record<string, LanguageStat>;
  selectedFile: string | null;
  focusedFile: string | null;
  onSelectFile: (path: string) => void;
  onFocusFile: (path: string | null) => void;
}

interface FolderNode {
  name: string;
  path: string;
  folders: Map<string, FolderNode>;
  files: TreeItem[];
}

function buildFolderTree(items: TreeItem[]): FolderNode {
  const root: FolderNode = {
    name: '',
    path: '',
    folders: new Map(),
    files: [],
  };

  for (const item of items) {
    const parts = item.path.split('/');
    let current = root;
    for (let i = 0; i < parts.length - 1; i++) {
      const seg = parts[i];
      const nextPath = current.path ? `${current.path}/${seg}` : seg;
      let folder = current.folders.get(seg);
      if (!folder) {
        folder = {
          name: seg,
          path: nextPath,
          folders: new Map(),
          files: [],
        };
        current.folders.set(seg, folder);
      }
      current = folder;
    }
    current.files.push(item);
  }

  return root;
}

const LANGUAGE_COLORS = [
  'bg-blue-500',
  'bg-emerald-500',
  'bg-amber-500',
  'bg-indigo-500',
  'bg-rose-500',
  'bg-slate-400',
];

export default function FileTreeSidebar({
  tree,
  languageStats,
  selectedFile,
  focusedFile,
  onSelectFile,
  onFocusFile,
}: FileTreeSidebarProps) {
  const [query, setQuery] = useState('');
  const [filterMode, setFilterMode] = useState<'all' | 'indexed'>('all');
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(() => {
    const initial = new Set<string>();
    for (const item of tree) {
      const first = item.path.split('/')[0];
      if (item.path.includes('/') && (first === 'src' || first === 'app' || first === 'lib' || first === 'pages')) {
        initial.add(first);
      }
    }
    return initial;
  });

  const filteredItems = useMemo(() => {
    const q = query.trim().toLowerCase();
    return tree.filter((item) => {
      if (filterMode === 'indexed' && !item.indexed) return false;
      if (q && !item.path.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [tree, query, filterMode]);

  const folderRoot = useMemo(() => buildFolderTree(filteredItems), [filteredItems]);

  const indexedCount = useMemo(
    () => tree.filter((t) => t.indexed).length,
    [tree]
  );

  const topLanguages = useMemo(() => {
    const entries = Object.entries(languageStats)
      .map(([name, stat]) => ({ name, ...stat }))
      .sort((a, b) => b.bytes - a.bytes);
    const totalBytes = entries.reduce((sum, e) => sum + e.bytes, 0) || 1;
    return entries.slice(0, 5).map((e, i) => ({
      ...e,
      pct: Math.max(1, Math.round((e.bytes / totalBytes) * 100)),
      color: LANGUAGE_COLORS[i % LANGUAGE_COLORS.length],
    }));
  }, [languageStats]);

  const toggleFolder = (folderPath: string) => {
    setExpandedFolders((prev) => {
      const next = new Set(prev);
      if (next.has(folderPath)) next.delete(folderPath);
      else next.add(folderPath);
      return next;
    });
  };

  const renderNode = (node: FolderNode, depth: number): React.ReactNode => {
    const sortedFolders = Array.from(node.folders.values()).sort((a, b) =>
      a.name.localeCompare(b.name)
    );
    const sortedFiles = [...node.files].sort((a, b) =>
      a.name.localeCompare(b.name)
    );

    return (
      <>
        {sortedFolders.map((folder) => {
          const isOpen =
            query.trim().length > 0 || expandedFolders.has(folder.path);
          return (
            <div key={folder.path}>
              <button
                type="button"
                onClick={() => toggleFolder(folder.path)}
                style={{ paddingLeft: `${depth * 12 + 10}px` }}
                className="flex w-full items-center gap-1.5 rounded-md py-1.5 pr-2 text-left text-[13px] text-slate-700 transition-colors hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800/70"
              >
                {isOpen ? (
                  <ChevronDown className="h-3.5 w-3.5 shrink-0 text-slate-400" />
                ) : (
                  <ChevronRight className="h-3.5 w-3.5 shrink-0 text-slate-400" />
                )}
                {isOpen ? (
                  <FolderOpen className="h-3.5 w-3.5 shrink-0 text-slate-500 dark:text-slate-400" />
                ) : (
                  <Folder className="h-3.5 w-3.5 shrink-0 text-slate-500 dark:text-slate-400" />
                )}
                <span className="truncate font-medium">{folder.name}</span>
              </button>
              {isOpen && renderNode(folder, depth + 1)}
            </div>
          );
        })}

        {sortedFiles.map((file) => {
          const isSelected = selectedFile === file.path;
          const isFocused = focusedFile === file.path;

          return (
            <div
              key={file.path}
              className={`group flex items-center justify-between rounded-md pr-1 transition-colors ${
                isSelected
                  ? 'bg-blue-50 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300'
                  : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800/70 dark:hover:text-slate-100'
              }`}
            >
              <button
                type="button"
                onClick={() => onSelectFile(file.path)}
                style={{ paddingLeft: `${depth * 12 + 24}px` }}
                className="flex min-w-0 flex-1 items-center gap-1.5 py-1.5 text-left text-[13px]"
                title={file.path}
              >
                <FileCode2
                  className={`h-3.5 w-3.5 shrink-0 ${
                    file.indexed
                      ? 'text-blue-600 dark:text-blue-400'
                      : 'text-slate-400 dark:text-slate-500'
                  }`}
                />
                <span className="truncate font-mono text-[12px]">
                  {file.name}
                </span>
              </button>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onFocusFile(isFocused ? null : file.path);
                }}
                title={
                  isFocused
                    ? 'Remove chat focus on this file'
                    : 'Focus chat questions on this file'
                }
                className={`rounded p-1 transition-opacity ${
                  isFocused
                    ? 'text-blue-600 opacity-100 dark:text-blue-400'
                    : 'text-slate-400 opacity-0 hover:text-slate-700 group-hover:opacity-100 dark:hover:text-slate-200'
                }`}
              >
                <Crosshair className="h-3.5 w-3.5" />
              </button>
            </div>
          );
        })}
      </>
    );
  };

  return (
    <aside className="flex h-full flex-col border-r border-slate-200 bg-slate-50/70 dark:border-slate-800 dark:bg-[#0D1425]">
      <div className="border-b border-slate-200 p-3 dark:border-slate-800">
        <div className="relative">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Filter files..."
            aria-label="Filter repository files"
            className="w-full rounded-md border border-slate-200 bg-white py-1.5 pl-8 pr-7 text-xs text-slate-900 placeholder:text-slate-400 focus:border-blue-500 focus:outline-none dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:placeholder:text-slate-500"
          />
          {query && (
            <button
              type="button"
              onClick={() => setQuery('')}
              aria-label="Clear filter"
              className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>

        <div className="mt-2.5 flex items-center gap-1 rounded-md bg-slate-200/70 p-0.5 dark:bg-slate-900">
          <button
            type="button"
            onClick={() => setFilterMode('all')}
            className={`flex-1 rounded px-2 py-1 text-xs font-medium transition-colors whitespace-nowrap shrink-0 tabular-nums ${
              filterMode === 'all'
                ? 'bg-white text-slate-900 shadow-xs dark:bg-slate-800 dark:text-slate-100'
                : 'text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-200'
            }`}
          >
            All ({tree.length})
          </button>
          <button
            type="button"
            onClick={() => setFilterMode('indexed')}
            className={`flex-1 rounded px-2 py-1 text-xs font-medium transition-colors whitespace-nowrap shrink-0 tabular-nums ${
              filterMode === 'indexed'
                ? 'bg-white text-slate-900 shadow-xs dark:bg-slate-800 dark:text-slate-100'
                : 'text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-200'
            }`}
          >
            Indexed ({indexedCount})
          </button>
        </div>
      </div>

      <div className="workspace-scroll flex-1 overflow-y-auto px-2 py-2">
        {filteredItems.length === 0 ? (
          <p className="px-3 py-6 text-center text-xs text-slate-500 dark:text-slate-400">
            No files match &ldquo;{query}&rdquo;.
          </p>
        ) : (
          renderNode(folderRoot, 0)
        )}
      </div>

      {topLanguages.length > 0 && (
        <div className="border-t border-slate-200 p-3 dark:border-slate-800">
          <div className="mb-2 flex items-center justify-between text-xs font-medium text-slate-600 dark:text-slate-400">
            <span>Languages</span>
            <span className="font-mono tabular-nums text-[11px]">
              {Object.keys(languageStats).length} detected
            </span>
          </div>
          <div className="mb-2.5 flex h-1.5 overflow-hidden rounded-full bg-slate-200 dark:bg-slate-800">
            {topLanguages.map((lang) => (
              <div
                key={lang.name}
                style={{ width: `${lang.pct}%` }}
                className={lang.color}
                title={`${lang.name}: ${lang.pct}%`}
              />
            ))}
          </div>
          <div className="space-y-1">
            {topLanguages.map((lang) => (
              <div
                key={lang.name}
                className="flex items-center justify-between text-xs text-slate-600 dark:text-slate-400"
              >
                <span className="truncate">{lang.name}</span>
                <span className="font-mono text-[11px] tabular-nums text-slate-500 dark:text-slate-400">
                  {lang.pct}%
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </aside>
  );
}
