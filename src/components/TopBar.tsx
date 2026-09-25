import { Maximize2, Minimize2, Plus, Sliders, Moon, Sun, BookOpen } from 'lucide-react';
import { ThemeMode } from '../types.ts';

interface TopBarProps {
  currentView: 'write' | 'scratchpad' | 'templates';
  onSelectView: (view: 'write' | 'scratchpad' | 'templates') => void;
  onNewPage: () => void;
  onOpenSettings: () => void;
  onOpenShortcuts: () => void;
  zenMode: boolean;
  onToggleZen: () => void;
  theme: ThemeMode;
  onToggleTheme: () => void;
}

export function TopBar({
  currentView,
  onSelectView,
  onNewPage,
  onOpenSettings,
  onOpenShortcuts,
  zenMode,
  onToggleZen,
  theme,
  onToggleTheme,
}: TopBarProps) {
  const isDark = theme === 'slate' || theme === 'noir';

  return (
    <header
      className={`no-print sticky top-0 z-30 flex items-center justify-between px-6 py-3.5 transition-colors border-b ${
        isDark
          ? 'bg-zinc-950/80 border-zinc-800/70 text-zinc-100 backdrop-blur-md'
          : theme === 'cream'
          ? 'bg-[#f7f3e8]/90 border-amber-900/10 text-stone-900 backdrop-blur-md'
          : 'bg-white/90 border-neutral-200/80 text-neutral-900 backdrop-blur-md'
      }`}
    >
      {/* Zone 1: Single text element wordmark */}
      <button
        onClick={() => onSelectView('write')}
        className="text-xl font-display font-medium tracking-tight hover:opacity-80 transition-opacity text-left cursor-pointer"
      >
        Blank Page
      </button>

      {/* Zone 2: 4 nav links, 1-2 word labels, single-line */}
      <nav className="hidden md:flex items-center gap-6 text-sm font-medium">
        <button
          onClick={() => onSelectView('write')}
          className={`cursor-pointer whitespace-nowrap transition-colors py-1 ${
            currentView === 'write'
              ? isDark
                ? 'text-white border-b-2 border-white font-semibold'
                : 'text-neutral-950 border-b-2 border-neutral-950 font-semibold'
              : isDark
              ? 'text-zinc-400 hover:text-zinc-200'
              : 'text-neutral-600 hover:text-neutral-950'
          }`}
        >
          Manuscript
        </button>

        <button
          onClick={() => onSelectView('scratchpad')}
          className={`cursor-pointer whitespace-nowrap transition-colors py-1 ${
            currentView === 'scratchpad'
              ? isDark
                ? 'text-white border-b-2 border-white font-semibold'
                : 'text-neutral-950 border-b-2 border-neutral-950 font-semibold'
              : isDark
              ? 'text-zinc-400 hover:text-zinc-200'
              : 'text-neutral-600 hover:text-neutral-950'
          }`}
        >
          Scratchpad
        </button>

        <button
          onClick={() => onSelectView('templates')}
          className={`cursor-pointer whitespace-nowrap transition-colors py-1 ${
            currentView === 'templates'
              ? isDark
                ? 'text-white border-b-2 border-white font-semibold'
                : 'text-neutral-950 border-b-2 border-neutral-950 font-semibold'
              : isDark
              ? 'text-zinc-400 hover:text-zinc-200'
              : 'text-neutral-600 hover:text-neutral-950'
          }`}
        >
          Templates
        </button>

        <button
          onClick={onOpenShortcuts}
          className={`cursor-pointer whitespace-nowrap transition-colors py-1 ${
            isDark
              ? 'text-zinc-400 hover:text-zinc-200'
              : 'text-neutral-600 hover:text-neutral-950'
          }`}
        >
          Shortcuts
        </button>
      </nav>

      {/* Zone 3: Primary actions */}
      <div className="flex items-center gap-2">
        <button
          onClick={onToggleTheme}
          title={isDark ? 'Switch to Light Paper' : 'Switch to Dark Noir'}
          className={`p-2 rounded-lg cursor-pointer transition-colors ${
            isDark
              ? 'text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800'
              : 'text-neutral-600 hover:text-neutral-900 hover:bg-neutral-100'
          }`}
          aria-label="Toggle theme"
        >
          {isDark ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
        </button>

        <button
          onClick={onOpenSettings}
          title="Typography & Page Settings"
          className={`p-2 rounded-lg cursor-pointer transition-colors ${
            isDark
              ? 'text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800'
              : 'text-neutral-600 hover:text-neutral-900 hover:bg-neutral-100'
          }`}
          aria-label="Editor settings"
        >
          <Sliders className="w-4 h-4" />
        </button>

        <button
          onClick={onToggleZen}
          title={zenMode ? 'Exit Zen Mode (Esc)' : 'Zen Focus Mode (F11)'}
          className={`p-2 rounded-lg cursor-pointer transition-colors ${
            zenMode
              ? isDark
                ? 'bg-zinc-800 text-white'
                : 'bg-neutral-200 text-neutral-900'
              : isDark
              ? 'text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800'
              : 'text-neutral-600 hover:text-neutral-900 hover:bg-neutral-100'
          }`}
          aria-label="Toggle Zen Focus"
        >
          {zenMode ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
        </button>

        <button
          onClick={onNewPage}
          className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-medium cursor-pointer transition-all whitespace-nowrap shadow-xs ${
            isDark
              ? 'bg-zinc-100 hover:bg-white text-zinc-950 font-semibold'
              : 'bg-neutral-900 hover:bg-neutral-800 text-white font-semibold'
          }`}
        >
          <Plus className="w-3.5 h-3.5" />
          <span>New Page</span>
        </button>
      </div>
    </header>
  );
}
