import { useState } from 'react';
import { X, FileDown, Copy, Check, Printer, Share2 } from 'lucide-react';
import { DocumentItem, ThemeMode } from '../types.ts';

interface ExportModalProps {
  isOpen: boolean;
  onClose: () => void;
  document: DocumentItem;
  theme: ThemeMode;
}

export function ExportModal({
  isOpen,
  onClose,
  document,
  theme,
}: ExportModalProps) {
  const [copied, setCopied] = useState(false);
  const isDark = theme === 'slate' || theme === 'noir';

  if (!isOpen) return null;

  const handleCopy = () => {
    navigator.clipboard.writeText(document.content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const downloadFile = (filename: string, text: string, type: string) => {
    const blob = new Blob([text], { type });
    const url = URL.createObjectURL(blob);
    const a = window.document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleDownloadMarkdown = () => {
    const safeTitle = (document.title || 'untitled').toLowerCase().replace(/[^a-z0-9]+/g, '-');
    downloadFile(`${safeTitle}.md`, document.content, 'text/markdown');
  };

  const handleDownloadText = () => {
    const safeTitle = (document.title || 'untitled').toLowerCase().replace(/[^a-z0-9]+/g, '-');
    downloadFile(`${safeTitle}.txt`, document.content, 'text/plain');
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div className="fixed inset-0 bg-black/50 backdrop-blur-xs" onClick={onClose} />

      {/* Modal */}
      <div
        className={`relative z-10 w-full max-w-md rounded-2xl p-6 shadow-2xl border transition-all ${
          isDark
            ? 'bg-zinc-950 border-zinc-800 text-zinc-100'
            : theme === 'cream'
            ? 'bg-[#f7f3e8] border-amber-900/10 text-stone-900'
            : 'bg-white border-neutral-200 text-neutral-900'
        }`}
      >
        <div className="flex items-center justify-between pb-4 border-b border-neutral-200/60 dark:border-zinc-800/60 mb-5">
          <div className="flex items-center gap-2">
            <Share2 className="w-4 h-4 text-neutral-500" />
            <h2 className="text-sm font-semibold tracking-tight">Export & Share Page</h2>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-md text-neutral-400 hover:text-neutral-700 dark:hover:text-zinc-200 cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="space-y-3 text-xs">
          {/* Copy */}
          <button
            onClick={handleCopy}
            className={`w-full p-3 rounded-xl border flex items-center justify-between cursor-pointer transition-colors ${
              isDark
                ? 'bg-zinc-900/60 border-zinc-800 hover:border-zinc-700'
                : 'bg-neutral-50 border-neutral-200 hover:border-neutral-300'
            }`}
          >
            <div className="flex items-center gap-3">
              {copied ? <Check className="w-4 h-4 text-emerald-500" /> : <Copy className="w-4 h-4 text-neutral-500" />}
              <div className="text-left">
                <div className="font-semibold">{copied ? 'Copied to Clipboard!' : 'Copy to Clipboard'}</div>
                <div className="text-[11px] text-neutral-400 dark:text-zinc-500">
                  Quickly paste into another editor or email
                </div>
              </div>
            </div>
            <span className="text-[11px] text-neutral-400 font-mono">⌘C</span>
          </button>

          {/* Download Markdown */}
          <button
            onClick={handleDownloadMarkdown}
            className={`w-full p-3 rounded-xl border flex items-center justify-between cursor-pointer transition-colors ${
              isDark
                ? 'bg-zinc-900/60 border-zinc-800 hover:border-zinc-700'
                : 'bg-neutral-50 border-neutral-200 hover:border-neutral-300'
            }`}
          >
            <div className="flex items-center gap-3">
              <FileDown className="w-4 h-4 text-neutral-500" />
              <div className="text-left">
                <div className="font-semibold">Download as Markdown (.md)</div>
                <div className="text-[11px] text-neutral-400 dark:text-zinc-500">
                  Preserves headings, lists, and formatting
                </div>
              </div>
            </div>
            <span className="text-[11px] text-neutral-400 font-mono">.md</span>
          </button>

          {/* Download Text */}
          <button
            onClick={handleDownloadText}
            className={`w-full p-3 rounded-xl border flex items-center justify-between cursor-pointer transition-colors ${
              isDark
                ? 'bg-zinc-900/60 border-zinc-800 hover:border-zinc-700'
                : 'bg-neutral-50 border-neutral-200 hover:border-neutral-300'
            }`}
          >
            <div className="flex items-center gap-3">
              <FileDown className="w-4 h-4 text-neutral-500" />
              <div className="text-left">
                <div className="font-semibold">Download as Plain Text (.txt)</div>
                <div className="text-[11px] text-neutral-400 dark:text-zinc-500">
                  Raw unformatted manuscript file
                </div>
              </div>
            </div>
            <span className="text-[11px] text-neutral-400 font-mono">.txt</span>
          </button>

          {/* Print to PDF */}
          <button
            onClick={handlePrint}
            className={`w-full p-3 rounded-xl border flex items-center justify-between cursor-pointer transition-colors ${
              isDark
                ? 'bg-zinc-900/60 border-zinc-800 hover:border-zinc-700'
                : 'bg-neutral-50 border-neutral-200 hover:border-neutral-300'
            }`}
          >
            <div className="flex items-center gap-3">
              <Printer className="w-4 h-4 text-neutral-500" />
              <div className="text-left">
                <div className="font-semibold">Print / Save as PDF</div>
                <div className="text-[11px] text-neutral-400 dark:text-zinc-500">
                  Render clean typography sheet for paper or PDF
                </div>
              </div>
            </div>
            <span className="text-[11px] text-neutral-400 font-mono">⌘P</span>
          </button>
        </div>
      </div>
    </div>
  );
}
