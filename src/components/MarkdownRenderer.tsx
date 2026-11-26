'use client';

import React, { useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Check, Copy } from 'lucide-react';

interface MarkdownRendererProps {
  content: string;
  validFilePaths?: Set<string>;
  onSelectFilePath?: (path: string) => void;
}

function CodeBlock({
  language,
  code,
}: {
  language: string;
  code: string;
}) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      // Clipboard API unavailable
    }
  };

  return (
    <div className="my-3 overflow-hidden rounded-lg border border-slate-200 bg-slate-50 dark:border-slate-800 dark:bg-[#0F172A]">
      <div className="flex items-center justify-between border-b border-slate-200 px-3 py-1.5 text-xs text-slate-500 dark:border-slate-800 dark:text-slate-400">
        <span className="font-mono lowercase">{language || 'text'}</span>
        <button
          type="button"
          onClick={handleCopy}
          className="inline-flex items-center gap-1.5 rounded px-2 py-0.5 text-xs font-medium text-slate-600 transition-colors hover:bg-slate-200/70 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-100 whitespace-nowrap shrink-0"
        >
          {copied ? (
            <>
              <Check className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
              <span>Copied</span>
            </>
          ) : (
            <>
              <Copy className="h-3.5 w-3.5" />
              <span>Copy</span>
            </>
          )}
        </button>
      </div>
      <pre className="workspace-scroll overflow-x-auto p-3.5 text-[13px] leading-relaxed text-slate-800 dark:text-slate-200">
        <code>{code}</code>
      </pre>
    </div>
  );
}

export default function MarkdownRenderer({
  content,
  validFilePaths,
  onSelectFilePath,
}: MarkdownRendererProps) {
  return (
    <div className="markdown-body text-slate-800 dark:text-slate-200">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          pre({ children }) {
            return <>{children}</>;
          },
          code({ className, children, ...props }) {
            const match = /language-(\w+)/.exec(className || '');
            const rawText = String(children).replace(/\n$/, '');
            const isBlock = Boolean(match) || rawText.includes('\n');

            if (isBlock) {
              return (
                <CodeBlock
                  language={match ? match[1] : 'code'}
                  code={rawText}
                />
              );
            }

            const cleaned = rawText.trim();
            const isKnownFile =
              Boolean(validFilePaths?.has(cleaned)) && Boolean(onSelectFilePath);

            if (isKnownFile && onSelectFilePath) {
              return (
                <button
                  type="button"
                  onClick={() => onSelectFilePath(cleaned)}
                  className="inline rounded bg-blue-50 px-1.5 py-0.5 font-mono text-[13px] text-blue-700 underline decoration-blue-400/60 underline-offset-2 transition-colors hover:bg-blue-100 dark:bg-blue-950/60 dark:text-blue-300 dark:hover:bg-blue-900/60"
                  title={`Open ${cleaned} in file viewer`}
                >
                  {cleaned}
                </button>
              );
            }

            return (
              <code
                {...props}
                className="rounded bg-slate-100 px-1.5 py-0.5 font-mono text-[13px] text-slate-800 dark:bg-slate-800/80 dark:text-slate-200"
              >
                {children}
              </code>
            );
          },
          a({ href, children }) {
            return (
              <a
                href={href}
                target="_blank"
                rel="noopener noreferrer"
                className="font-medium text-blue-600 underline decoration-blue-400/50 underline-offset-2 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300"
              >
                {children}
              </a>
            );
          },
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}
