import { useState } from 'react';
import { X, Plus, Search, FileText, Pin, Trash2, Copy, Check } from 'lucide-react';
import { DocumentItem, ThemeMode } from '../types.ts';

interface DocumentDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  documents: DocumentItem[];
  activeDocId: string;
  onSelectDoc: (id: string) => void;
  onNewDoc: () => void;
  onDeleteDoc: (id: string) => void;
  onDuplicateDoc: (id: string) => void;
  onTogglePin: (id: string) => void;
  theme: ThemeMode;
}

export function DocumentDrawer({
  isOpen,
  onClose,
  documents,
  activeDocId,
  onSelectDoc,
  onNewDoc,
  onDeleteDoc,
  onDuplicateDoc,
  onTogglePin,
  theme,
}: DocumentDrawerProps) {
  const [search, setSearch] = useState('');
  const isDark = theme === 'slate' || theme === 'noir';

  if (!isOpen) return null;

  const filteredDocs = documents.filter((doc) =>
    (doc.title || 'Untitled').toLowerCase().includes(search.toLowerCase()) ||
    doc.content.toLowerCase().includes(search.toLowerCase())
  );

  // Pinned first, then sorted by updatedAt desc
  const sortedDocs = [...filteredDocs].sort((a, b) => {
    if (a.pinned && !b.pinned) return -1;
    if (!a.pinned && b.pinned) return 1;
    return b.updatedAt - a.updatedAt;
  });

  return (
    <div className="fixed inset-0 z-50 flex">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/40 backdrop-blur-xs transition-opacity"
        onClick={onClose}
      />

      {/* Drawer Panel */}
      <div
        className={`relative z-10 w-full max-w-sm h-full flex flex-col shadow-2xl transition-all ${
          isDark ? 'bg-zinc-950 text-zinc-100 border-r border-zinc-800' : 'bg-white text-neutral-900 border-r border-neutral-200'
        }`}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-neutral-200 dark:border-zinc-800">
          <div className="flex items-center gap-2">
            <FileText className="w-4 h-4 text-neutral-500" />
            <h2 className="text-sm font-semibold tracking-tight">Your Pages & Manuscripts</h2>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-md text-neutral-400 hover:text-neutral-700 dark:hover:text-zinc-200 cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Search & New Page CTA */}
        <div className="p-3 border-b border-neutral-200 dark:border-zinc-800 space-y-2">
          <div className="relative">
            <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-neutral-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search written pages..."
              className={`w-full pl-9 pr-3 py-1.5 text-xs rounded-lg outline-none transition-colors border ${
                isDark
                  ? 'bg-zinc-900 border-zinc-800 text-zinc-200 placeholder-zinc-500 focus:border-zinc-600'
                  : 'bg-neutral-50 border-neutral-200 text-neutral-900 placeholder-neutral-400 focus:border-neutral-400'
              }`}
            />
          </div>

          <button
            onClick={() => {
              onNewDoc();
              onClose();
            }}
            className={`w-full py-2 px-3 rounded-lg text-xs font-medium flex items-center justify-center gap-1.5 cursor-pointer transition-colors ${
              isDark
                ? 'bg-zinc-800 hover:bg-zinc-700 text-white'
                : 'bg-neutral-900 hover:bg-neutral-800 text-white'
            }`}
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Create New Blank Page</span>
          </button>
        </div>

        {/* Document list */}
        <div className="flex-1 overflow-y-auto p-2 space-y-1">
          {sortedDocs.length === 0 ? (
            <div className="text-center py-10 px-4 text-xs text-neutral-400 dark:text-zinc-500">
              No matching pages found.
            </div>
          ) : (
            sortedDocs.map((doc) => {
              const isActive = doc.id === activeDocId;
              const wordCount = doc.content.trim() ? doc.content.trim().split(/\s+/).length : 0;
              const dateStr = new Date(doc.updatedAt).toLocaleDateString(undefined, {
                month: 'short',
                day: 'numeric',
              });

              return (
                <div
                  key={doc.id}
                  onClick={() => {
                    onSelectDoc(doc.id);
                    onClose();
                  }}
                  className={`group relative p-3 rounded-lg cursor-pointer transition-all flex flex-col gap-1 border ${
                    isActive
                      ? isDark
                        ? 'bg-zinc-900 border-zinc-700 shadow-xs'
                        : 'bg-neutral-100 border-neutral-300 shadow-xs'
                      : isDark
                      ? 'border-transparent hover:bg-zinc-900/60 hover:border-zinc-800'
                      : 'border-transparent hover:bg-neutral-50 hover:border-neutral-200'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span
                      className={`text-xs font-medium truncate max-w-[200px] ${
                        isActive
                          ? isDark
                            ? 'text-white font-semibold'
                            : 'text-neutral-950 font-semibold'
                          : isDark
                          ? 'text-zinc-300'
                          : 'text-neutral-700'
                      }`}
                    >
                      {doc.title || 'Untitled Draft'}
                    </span>

                    {/* Actions on hover */}
                    <div
                      className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <button
                        onClick={() => onTogglePin(doc.id)}
                        title={doc.pinned ? 'Unpin' : 'Pin to top'}
                        className={`p-1 rounded hover:bg-neutral-200 dark:hover:bg-zinc-800 ${
                          doc.pinned ? 'text-amber-500 opacity-100' : 'text-neutral-400'
                        }`}
                      >
                        <Pin className="w-3 h-3" />
                      </button>

                      <button
                        onClick={() => onDuplicateDoc(doc.id)}
                        title="Duplicate"
                        className="p-1 rounded text-neutral-400 hover:text-neutral-700 dark:hover:text-zinc-200 hover:bg-neutral-200 dark:hover:bg-zinc-800"
                      >
                        <Copy className="w-3 h-3" />
                      </button>

                      {documents.length > 1 && (
                        <button
                          onClick={() => onDeleteDoc(doc.id)}
                          title="Delete"
                          className="p-1 rounded text-neutral-400 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-neutral-200 dark:hover:bg-zinc-800"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-2 text-[11px] text-neutral-500 dark:text-zinc-500">
                    <span>{wordCount} words</span>
                    <span>·</span>
                    <span>{dateStr}</span>
                    {doc.pinned && (
                      <>
                        <span>·</span>
                        <span className="text-amber-600 dark:text-amber-400">Pinned</span>
                      </>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Footer info */}
        <div className="p-3 border-t border-neutral-200 dark:border-zinc-800 text-[11px] text-neutral-400 dark:text-zinc-500 flex justify-between items-center">
          <span>{documents.length} pages stored locally</span>
          <span>Auto-saved</span>
        </div>
      </div>
    </div>
  );
}
