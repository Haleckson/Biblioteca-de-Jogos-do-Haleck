import { useState } from 'react';
import { Plus, Trash2, Copy, ArrowUpRight, Check, Sparkles } from 'lucide-react';
import { ScratchpadNote, ThemeMode } from '../types.ts';

interface ScratchpadViewProps {
  notes: ScratchpadNote[];
  onAddNote: (text: string) => void;
  onDeleteNote: (id: string) => void;
  onInsertToDoc: (text: string) => void;
  theme: ThemeMode;
}

export function ScratchpadView({
  notes,
  onAddNote,
  onDeleteNote,
  onInsertToDoc,
  theme,
}: ScratchpadViewProps) {
  const [newText, setNewText] = useState('');
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const isDark = theme === 'slate' || theme === 'noir';

  const handleAdd = () => {
    if (!newText.trim()) return;
    onAddNote(newText.trim());
    setNewText('');
  };

  const handleCopy = (id: string, text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 1500);
  };

  return (
    <div className="max-w-4xl mx-auto py-8 px-4 sm:px-6">
      <div className="mb-6">
        <h1 className="text-2xl font-display font-medium tracking-tight mb-1">
          Daily Scratchpad
        </h1>
        <p className="text-xs text-neutral-500 dark:text-zinc-400">
          Ephemeral ideas, quick references, and fleeting thoughts. Send them into your manuscript with one click.
        </p>
      </div>

      {/* Quick Input Bar */}
      <div
        className={`p-4 rounded-xl border mb-8 transition-colors ${
          isDark
            ? 'bg-zinc-900/80 border-zinc-800'
            : theme === 'cream'
            ? 'bg-[#f7f3e8] border-amber-900/10'
            : 'bg-white border-neutral-200'
        }`}
      >
        <textarea
          value={newText}
          onChange={(e) => setNewText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
              e.preventDefault();
              handleAdd();
            }
          }}
          placeholder="Jot down a fleeting thought... (Ctrl+Enter to post)"
          rows={3}
          className={`w-full bg-transparent resize-none outline-none text-sm leading-relaxed ${
            isDark ? 'text-zinc-100 placeholder-zinc-500' : 'text-neutral-900 placeholder-neutral-400'
          }`}
        />
        <div className="flex items-center justify-between pt-2 border-t border-neutral-200/60 dark:border-zinc-800/60">
          <span className="text-[11px] text-neutral-400 dark:text-zinc-500">
            Press Cmd/Ctrl + Enter to save note
          </span>
          <button
            onClick={handleAdd}
            disabled={!newText.trim()}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium cursor-pointer transition-colors flex items-center gap-1.5 ${
              newText.trim()
                ? isDark
                  ? 'bg-zinc-100 hover:bg-white text-zinc-950'
                  : 'bg-neutral-900 hover:bg-neutral-800 text-white'
                : 'bg-neutral-200 dark:bg-zinc-800 text-neutral-400 cursor-not-allowed'
            }`}
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Add Note</span>
          </button>
        </div>
      </div>

      {/* Notes Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {notes.length === 0 ? (
          <div className="col-span-full text-center py-12 border border-dashed border-neutral-300 dark:border-zinc-800 rounded-xl p-8">
            <Sparkles className="w-6 h-6 mx-auto mb-2 text-neutral-400" />
            <p className="text-sm font-medium text-neutral-600 dark:text-zinc-400">
              Your scratchpad is clean and empty.
            </p>
            <p className="text-xs text-neutral-400 dark:text-zinc-500 mt-1">
              Add quick brainstorm points above.
            </p>
          </div>
        ) : (
          notes.map((note) => {
            const timeAgo = new Date(note.createdAt).toLocaleTimeString([], {
              hour: '2-digit',
              minute: '2-digit',
            });
            const isCopied = copiedId === note.id;

            return (
              <div
                key={note.id}
                className={`p-4 rounded-xl border flex flex-col justify-between transition-all group ${
                  isDark
                    ? 'bg-zinc-900/50 border-zinc-800 hover:border-zinc-700'
                    : theme === 'cream'
                    ? 'bg-[#f7f3e8]/70 border-amber-900/10 hover:border-amber-900/20'
                    : 'bg-white border-neutral-200 hover:border-neutral-300'
                }`}
              >
                <p className="text-sm leading-relaxed whitespace-pre-wrap mb-4">
                  {note.text}
                </p>

                <div className="flex items-center justify-between pt-2 border-t border-neutral-200/50 dark:border-zinc-800/50 text-[11px] text-neutral-400 dark:text-zinc-500">
                  <span>{timeAgo}</span>

                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={() => handleCopy(note.id, note.text)}
                      title="Copy to clipboard"
                      className="p-1 rounded hover:bg-neutral-100 dark:hover:bg-zinc-800 text-neutral-500 dark:text-zinc-400"
                    >
                      {isCopied ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
                    </button>

                    <button
                      onClick={() => onInsertToDoc(note.text)}
                      title="Insert into current manuscript"
                      className="p-1 rounded hover:bg-neutral-100 dark:hover:bg-zinc-800 text-neutral-500 dark:text-zinc-400 hover:text-neutral-900 dark:hover:text-zinc-200"
                    >
                      <ArrowUpRight className="w-3.5 h-3.5" />
                    </button>

                    <button
                      onClick={() => onDeleteNote(note.id)}
                      title="Delete note"
                      className="p-1 rounded hover:bg-neutral-100 dark:hover:bg-zinc-800 text-neutral-400 hover:text-rose-500"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
