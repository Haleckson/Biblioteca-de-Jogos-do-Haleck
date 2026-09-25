import { X, Command } from 'lucide-react';
import { ThemeMode } from '../types.ts';

interface ShortcutsModalProps {
  isOpen: boolean;
  onClose: () => void;
  theme: ThemeMode;
}

export function ShortcutsModal({ isOpen, onClose, theme }: ShortcutsModalProps) {
  if (!isOpen) return null;
  const isDark = theme === 'slate' || theme === 'noir';

  const shortcuts = [
    { key: 'Cmd/Ctrl + N', desc: 'Create a new blank page' },
    { key: 'Cmd/Ctrl + K', desc: 'Open page drawer / switcher' },
    { key: 'Cmd/Ctrl + B', desc: 'Toggle bold formatting' },
    { key: 'Cmd/Ctrl + I', desc: 'Toggle italic formatting' },
    { key: 'Cmd/Ctrl + S', desc: 'Save snapshot (auto-saved live)' },
    { key: 'Cmd/Ctrl + P', desc: 'Print or export to PDF' },
    { key: 'F11 / Esc', desc: 'Toggle or exit Zen Focus mode' },
    { key: 'Tab', desc: 'Insert tab indentation' },
  ];

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
            <Command className="w-4 h-4 text-neutral-500" />
            <h2 className="text-sm font-semibold tracking-tight">Keyboard Gestures</h2>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-md text-neutral-400 hover:text-neutral-700 dark:hover:text-zinc-200 cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="space-y-2 text-xs">
          {shortcuts.map((s, i) => (
            <div
              key={i}
              className="flex items-center justify-between py-2 border-b border-neutral-100 dark:border-zinc-900 last:border-none"
            >
              <span className="text-neutral-600 dark:text-zinc-400">{s.desc}</span>
              <kbd
                className={`px-2 py-1 rounded font-mono text-[11px] border ${
                  isDark
                    ? 'bg-zinc-900 border-zinc-800 text-zinc-300'
                    : 'bg-neutral-100 border-neutral-200 text-neutral-800'
                }`}
              >
                {s.key}
              </kbd>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
