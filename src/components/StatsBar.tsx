import { CheckCircle2 } from 'lucide-react';
import { ThemeMode } from '../types.ts';

interface StatsBarProps {
  content: string;
  theme: ThemeMode;
  dailyGoal: number;
  lastSavedAt: number;
}

export function StatsBar({
  content,
  theme,
  dailyGoal,
  lastSavedAt,
}: StatsBarProps) {
  const isDark = theme === 'slate' || theme === 'noir';

  const cleanText = content.trim();
  const wordCount = cleanText ? cleanText.split(/\s+/).length : 0;
  const charCount = content.length;
  const lineCount = content ? content.split('\n').length : 0;
  const readTimeMin = Math.max(1, Math.ceil(wordCount / 200));

  const goalPercent = Math.min(100, Math.round((wordCount / (dailyGoal || 500)) * 100));

  return (
    <footer
      className={`no-print fixed bottom-0 left-0 right-0 z-20 px-6 py-2.5 border-t text-xs transition-colors backdrop-blur-md flex items-center justify-between ${
        isDark
          ? 'bg-zinc-950/80 border-zinc-800/80 text-zinc-400'
          : theme === 'cream'
          ? 'bg-[#f7f3e8]/90 border-amber-900/10 text-stone-600'
          : 'bg-white/90 border-neutral-200/80 text-neutral-500'
      }`}
    >
      {/* Clean Unboxed Text with Typographic Separators */}
      <div className="flex items-center gap-2 font-mono tabular-nums text-[12px]">
        <span>{wordCount} words</span>
        <span aria-hidden="true" className="opacity-40">·</span>
        <span>{charCount} characters</span>
        <span aria-hidden="true" className="opacity-40 hidden sm:inline">·</span>
        <span className="hidden sm:inline">{lineCount} lines</span>
        <span aria-hidden="true" className="opacity-40 hidden md:inline">·</span>
        <span className="hidden md:inline">{readTimeMin} min read</span>
      </div>

      {/* Goal & Save status */}
      <div className="flex items-center gap-4 text-[12px]">
        {dailyGoal > 0 && (
          <div className="hidden sm:flex items-center gap-2 font-mono tabular-nums">
            <span>Goal: {wordCount}/{dailyGoal}</span>
            <div className="w-16 h-1.5 rounded-full bg-neutral-200 dark:bg-zinc-800 overflow-hidden">
              <div
                className="h-full bg-emerald-500 rounded-full transition-all duration-300"
                style={{ width: `${goalPercent}%` }}
              />
            </div>
            <span>{goalPercent}%</span>
          </div>
        )}

        <div className="flex items-center gap-1.5 text-neutral-400 dark:text-zinc-500">
          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
          <span className="text-[11px]">Saved locally</span>
        </div>
      </div>
    </footer>
  );
}
