import { X, Volume2, Type, Layout, Target, Eye } from 'lucide-react';
import { EditorSettings, ThemeMode, FontStyle, PageWidth } from '../types.ts';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  settings: EditorSettings;
  onUpdateSettings: (newSettings: Partial<EditorSettings>) => void;
}

export function SettingsModal({
  isOpen,
  onClose,
  settings,
  onUpdateSettings,
}: SettingsModalProps) {
  if (!isOpen) return null;

  const isDark = settings.theme === 'slate' || settings.theme === 'noir';

  const themes: { id: ThemeMode; label: string; desc: string }[] = [
    { id: 'paper', label: 'Crisp Paper', desc: 'Off-white minimalism' },
    { id: 'cream', label: 'Warm Book', desc: 'Serene literary ivory' },
    { id: 'slate', label: 'Muted Slate', desc: 'Soft dark night mode' },
    { id: 'noir', label: 'Pure Noir', desc: 'Deep black distraction-free' },
  ];

  const fonts: { id: FontStyle; label: string; fontClass: string }[] = [
    { id: 'serif', label: 'Editorial Serif', fontClass: 'font-editorial' },
    { id: 'sans', label: 'Modern Sans', fontClass: 'font-sans-clean' },
    { id: 'mono', label: 'Typewriter Mono', fontClass: 'font-code' },
  ];

  const widths: { id: PageWidth; label: string }[] = [
    { id: 'standard', label: 'Standard (720px)' },
    { id: 'wide', label: 'Wide (920px)' },
    { id: 'full', label: 'Full Viewport' },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div className="fixed inset-0 bg-black/50 backdrop-blur-xs" onClick={onClose} />

      {/* Modal */}
      <div
        className={`relative z-10 w-full max-w-lg rounded-2xl p-6 shadow-2xl border transition-all ${
          isDark
            ? 'bg-zinc-950 border-zinc-800 text-zinc-100'
            : settings.theme === 'cream'
            ? 'bg-[#f7f3e8] border-amber-900/10 text-stone-900'
            : 'bg-white border-neutral-200 text-neutral-900'
        }`}
      >
        <div className="flex items-center justify-between pb-4 border-b border-neutral-200/60 dark:border-zinc-800/60 mb-5">
          <h2 className="text-base font-semibold tracking-tight">Writing Environment Settings</h2>
          <button
            onClick={onClose}
            className="p-1 rounded-md text-neutral-400 hover:text-neutral-700 dark:hover:text-zinc-200 cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="space-y-6 text-xs">
          {/* Paper Theme */}
          <div>
            <label className="font-semibold block mb-2 text-neutral-700 dark:text-zinc-300">
              Stationery & Paper Ambiance
            </label>
            <div className="grid grid-cols-2 gap-2">
              {themes.map((t) => (
                <button
                  key={t.id}
                  onClick={() => onUpdateSettings({ theme: t.id })}
                  className={`p-2.5 rounded-lg border text-left cursor-pointer transition-colors ${
                    settings.theme === t.id
                      ? isDark
                        ? 'border-white bg-zinc-800 text-white font-medium'
                        : 'border-neutral-900 bg-neutral-100 text-neutral-900 font-medium'
                      : isDark
                      ? 'border-zinc-800 bg-zinc-900/40 text-zinc-400 hover:border-zinc-700'
                      : 'border-neutral-200 bg-neutral-50/50 text-neutral-600 hover:border-neutral-300'
                  }`}
                >
                  <div className="font-medium text-xs">{t.label}</div>
                  <div className="text-[11px] opacity-70 mt-0.5">{t.desc}</div>
                </button>
              ))}
            </div>
          </div>

          {/* Typography Choice */}
          <div>
            <label className="font-semibold block mb-2 text-neutral-700 dark:text-zinc-300">
              Typeface Family
            </label>
            <div className="grid grid-cols-3 gap-2">
              {fonts.map((f) => (
                <button
                  key={f.id}
                  onClick={() => onUpdateSettings({ font: f.id })}
                  className={`py-2 px-3 rounded-lg border text-center cursor-pointer transition-colors ${f.fontClass} ${
                    settings.font === f.id
                      ? isDark
                        ? 'border-white bg-zinc-800 text-white'
                        : 'border-neutral-900 bg-neutral-100 text-neutral-900'
                      : isDark
                      ? 'border-zinc-800 text-zinc-400 hover:border-zinc-700'
                      : 'border-neutral-200 text-neutral-600 hover:border-neutral-300'
                  }`}
                >
                  <span className="text-xs">{f.label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Font Size & Page Width */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="font-semibold block mb-2 text-neutral-700 dark:text-zinc-300">
                Font Size ({settings.fontSize}px)
              </label>
              <input
                type="range"
                min={15}
                max={24}
                step={1}
                value={settings.fontSize}
                onChange={(e) => onUpdateSettings({ fontSize: Number(e.target.value) })}
                className="w-full accent-neutral-900 dark:accent-white cursor-pointer"
              />
            </div>

            <div>
              <label className="font-semibold block mb-2 text-neutral-700 dark:text-zinc-300">
                Daily Word Target
              </label>
              <input
                type="number"
                min={100}
                max={5000}
                step={50}
                value={settings.dailyGoal}
                onChange={(e) => onUpdateSettings({ dailyGoal: Number(e.target.value) })}
                className={`w-full px-2.5 py-1.5 rounded-lg border text-xs outline-none ${
                  isDark
                    ? 'bg-zinc-900 border-zinc-800 text-zinc-100'
                    : 'bg-neutral-50 border-neutral-200 text-neutral-900'
                }`}
              />
            </div>
          </div>

          {/* Width Selection */}
          <div>
            <label className="font-semibold block mb-2 text-neutral-700 dark:text-zinc-300">
              Page Width
            </label>
            <div className="grid grid-cols-3 gap-2">
              {widths.map((w) => (
                <button
                  key={w.id}
                  onClick={() => onUpdateSettings({ pageWidth: w.id })}
                  className={`py-1.5 px-2 rounded-lg border text-center text-xs cursor-pointer transition-colors ${
                    settings.pageWidth === w.id
                      ? isDark
                        ? 'border-white bg-zinc-800 text-white font-medium'
                        : 'border-neutral-900 bg-neutral-100 text-neutral-900 font-medium'
                      : isDark
                      ? 'border-zinc-800 text-zinc-400 hover:border-zinc-700'
                      : 'border-neutral-200 text-neutral-600 hover:border-neutral-300'
                  }`}
                >
                  {w.label}
                </button>
              ))}
            </div>
          </div>

          {/* Toggles */}
          <div className="space-y-3 pt-2 border-t border-neutral-200/60 dark:border-zinc-800/60">
            <label className="flex items-center justify-between cursor-pointer">
              <span className="text-neutral-700 dark:text-zinc-300 font-medium">
                Tactile Typewriter Audio Feedback
              </span>
              <input
                type="checkbox"
                checked={settings.soundEnabled}
                onChange={(e) => onUpdateSettings({ soundEnabled: e.target.checked })}
                className="w-4 h-4 accent-neutral-900 dark:accent-white cursor-pointer"
              />
            </label>

            <label className="flex items-center justify-between cursor-pointer">
              <span className="text-neutral-700 dark:text-zinc-300 font-medium">
                Show Word & Metric Counter
              </span>
              <input
                type="checkbox"
                checked={settings.showStats}
                onChange={(e) => onUpdateSettings({ showStats: e.target.checked })}
                className="w-4 h-4 accent-neutral-900 dark:accent-white cursor-pointer"
              />
            </label>
          </div>
        </div>
      </div>
    </div>
  );
}
