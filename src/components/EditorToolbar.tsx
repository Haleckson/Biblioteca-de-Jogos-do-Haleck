import {
  Heading1,
  Heading2,
  Bold,
  Italic,
  Quote,
  List,
  ListOrdered,
  CheckSquare,
  Code,
  Minus,
  Trash2,
  FolderOpen,
  Download,
  Share2,
  Volume2,
  VolumeX,
} from 'lucide-react';
import { ThemeMode } from '../types.ts';

interface EditorToolbarProps {
  onFormat: (type: 'h1' | 'h2' | 'bold' | 'italic' | 'quote' | 'bullet' | 'number' | 'check' | 'code' | 'hr') => void;
  onClear: () => void;
  onOpenDocDrawer: () => void;
  onOpenExport: () => void;
  soundEnabled: boolean;
  onToggleSound: () => void;
  theme: ThemeMode;
  docTitle: string;
}

export function EditorToolbar({
  onFormat,
  onClear,
  onOpenDocDrawer,
  onOpenExport,
  soundEnabled,
  onToggleSound,
  theme,
  docTitle,
}: EditorToolbarProps) {
  const isDark = theme === 'slate' || theme === 'noir';

  const btnStyle = `p-1.5 rounded-md cursor-pointer transition-colors ${
    isDark
      ? 'text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800'
      : 'text-neutral-600 hover:text-neutral-900 hover:bg-neutral-100'
  }`;

  return (
    <div className="no-print w-full flex items-center justify-between py-2 border-b border-neutral-200/60 dark:border-zinc-800/60 mb-6 text-xs transition-colors">
      {/* Left: Document drawer switcher & active title */}
      <div className="flex items-center gap-2">
        <button
          onClick={onOpenDocDrawer}
          className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md cursor-pointer text-xs font-medium transition-colors ${
            isDark
              ? 'text-zinc-300 hover:text-white bg-zinc-900 hover:bg-zinc-800 border border-zinc-800'
              : 'text-neutral-700 hover:text-neutral-900 bg-neutral-100 hover:bg-neutral-200/80 border border-neutral-200'
          }`}
          title="Open Pages Drawer (Cmd/Ctrl + K)"
        >
          <FolderOpen className="w-3.5 h-3.5" />
          <span className="truncate max-w-[140px] sm:max-w-[200px]">{docTitle || 'Untitled'}</span>
        </button>

        <span className="hidden sm:inline-block text-neutral-400 dark:text-zinc-600">/</span>
        <span className="hidden sm:inline-block text-neutral-400 dark:text-zinc-500 text-xs">
          Markdown supported
        </span>
      </div>

      {/* Center: Formatting tools */}
      <div className="flex items-center gap-0.5">
        <button
          onClick={() => onFormat('h1')}
          title="Heading 1 (#)"
          className={btnStyle}
          aria-label="Heading 1"
        >
          <Heading1 className="w-4 h-4" />
        </button>

        <button
          onClick={() => onFormat('h2')}
          title="Heading 2 (##)"
          className={btnStyle}
          aria-label="Heading 2"
        >
          <Heading2 className="w-4 h-4" />
        </button>

        <span className="w-[1px] h-4 bg-neutral-300 dark:bg-zinc-800 mx-1" />

        <button
          onClick={() => onFormat('bold')}
          title="Bold (**text**)"
          className={btnStyle}
          aria-label="Bold text"
        >
          <Bold className="w-3.5 h-3.5" />
        </button>

        <button
          onClick={() => onFormat('italic')}
          title="Italic (*text*)"
          className={btnStyle}
          aria-label="Italic text"
        >
          <Italic className="w-3.5 h-3.5" />
        </button>

        <button
          onClick={() => onFormat('quote')}
          title="Blockquote (>)"
          className={btnStyle}
          aria-label="Quote"
        >
          <Quote className="w-3.5 h-3.5" />
        </button>

        <span className="w-[1px] h-4 bg-neutral-300 dark:bg-zinc-800 mx-1 hidden sm:block" />

        <button
          onClick={() => onFormat('bullet')}
          title="Bullet list (-)"
          className={`${btnStyle} hidden sm:block`}
          aria-label="Bullet list"
        >
          <List className="w-3.5 h-3.5" />
        </button>

        <button
          onClick={() => onFormat('number')}
          title="Numbered list (1.)"
          className={`${btnStyle} hidden sm:block`}
          aria-label="Numbered list"
        >
          <ListOrdered className="w-3.5 h-3.5" />
        </button>

        <button
          onClick={() => onFormat('check')}
          title="Task item (- [ ])"
          className={`${btnStyle} hidden md:block`}
          aria-label="Task item"
        >
          <CheckSquare className="w-3.5 h-3.5" />
        </button>

        <button
          onClick={() => onFormat('code')}
          title="Code block (```)"
          className={`${btnStyle} hidden md:block`}
          aria-label="Code block"
        >
          <Code className="w-3.5 h-3.5" />
        </button>

        <button
          onClick={() => onFormat('hr')}
          title="Horizontal Rule (---)"
          className={`${btnStyle} hidden lg:block`}
          aria-label="Divider"
        >
          <Minus className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Right: Sound toggle, Export, and Clear */}
      <div className="flex items-center gap-1">
        <button
          onClick={onToggleSound}
          title={soundEnabled ? 'Acoustic keystrokes on' : 'Acoustic keystrokes off'}
          className={btnStyle}
          aria-label="Toggle typewriter sound"
        >
          {soundEnabled ? (
            <Volume2 className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
          ) : (
            <VolumeX className="w-3.5 h-3.5" />
          )}
        </button>

        <button
          onClick={onOpenExport}
          title="Export / Share Document"
          className={btnStyle}
          aria-label="Export"
        >
          <Download className="w-3.5 h-3.5" />
        </button>

        <button
          onClick={onClear}
          title="Clear to pure Blank Page"
          className={`p-1.5 rounded-md cursor-pointer transition-colors ${
            isDark
              ? 'text-zinc-500 hover:text-rose-400 hover:bg-rose-950/30'
              : 'text-neutral-400 hover:text-rose-600 hover:bg-rose-50'
          }`}
          aria-label="Clear page"
        >
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
}
