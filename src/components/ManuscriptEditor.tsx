import React, { useRef, useEffect } from 'react';
import { EditorSettings, ThemeMode } from '../types.ts';
import { playKeystrokeSound } from '../utils/audio.ts';

interface ManuscriptEditorProps {
  title: string;
  content: string;
  onChangeTitle: (title: string) => void;
  onChangeContent: (content: string) => void;
  settings: EditorSettings;
  textareaRef: React.RefObject<HTMLTextAreaElement | null>;
  onKeyDownShortcut: (e: React.KeyboardEvent<HTMLTextAreaElement>) => void;
  zenMode: boolean;
  onExitZen: () => void;
}

export function ManuscriptEditor({
  title,
  content,
  onChangeTitle,
  onChangeContent,
  settings,
  textareaRef,
  onKeyDownShortcut,
  zenMode,
  onExitZen,
}: ManuscriptEditorProps) {
  const titleInputRef = useRef<HTMLInputElement>(null);

  // Auto-resize textarea to fit content smoothly
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      const scrollH = textareaRef.current.scrollHeight;
      textareaRef.current.style.height = `${Math.max(scrollH, 500)}px`;
    }
  }, [content]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (settings.soundEnabled) {
      playKeystrokeSound(e.key === 'Enter', e.key === ' ');
    }
    onKeyDownShortcut(e);
  };

  const isDark = settings.theme === 'slate' || settings.theme === 'noir';

  // Typography class
  const fontClass =
    settings.font === 'serif'
      ? 'font-editorial'
      : settings.font === 'mono'
      ? 'font-code'
      : 'font-sans-clean';

  // Container width
  const widthClass =
    settings.pageWidth === 'full'
      ? 'max-w-5xl'
      : settings.pageWidth === 'wide'
      ? 'max-w-[920px]'
      : 'max-w-[720px]';

  return (
    <div className={`w-full mx-auto ${widthClass} transition-all duration-200`}>
      {/* Title Input */}
      <input
        ref={titleInputRef}
        type="text"
        value={title}
        onChange={(e) => onChangeTitle(e.target.value)}
        onKeyDown={(e) => {
          if (settings.soundEnabled) playKeystrokeSound(e.key === 'Enter');
          if (e.key === 'Enter') {
            e.preventDefault();
            textareaRef.current?.focus();
          }
        }}
        placeholder="Untitled Blank Page..."
        className={`w-full bg-transparent outline-none font-display font-medium tracking-tight mb-4 pb-2 border-b border-transparent hover:border-neutral-200/50 dark:hover:border-zinc-800/50 focus:border-neutral-300 dark:focus:border-zinc-700 transition-colors ${
          isDark
            ? 'text-zinc-100 placeholder-zinc-700'
            : settings.theme === 'cream'
            ? 'text-stone-900 placeholder-stone-400'
            : 'text-neutral-900 placeholder-neutral-300'
        }`}
        style={{ fontSize: `${Math.round(settings.fontSize * 1.7)}px`, lineHeight: 1.25 }}
      />

      {/* Main Textarea Manuscript Surface */}
      <textarea
        ref={textareaRef}
        value={content}
        onChange={(e) => onChangeContent(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder="A pristine blank page awaits. Begin typing your thoughts, notes, or story..."
        spellCheck="true"
        className={`w-full bg-transparent resize-none outline-none leading-relaxed overflow-hidden transition-colors ${fontClass} ${
          isDark
            ? 'text-zinc-200 placeholder-zinc-700'
            : settings.theme === 'cream'
            ? 'text-[#2a241e] placeholder-stone-400'
            : 'text-neutral-900 placeholder-neutral-300'
        }`}
        style={{
          fontSize: `${settings.fontSize}px`,
          lineHeight:
            settings.lineHeight === 'tight' ? 1.4 : settings.lineHeight === 'relaxed' ? 1.8 : 1.6,
          minHeight: '65vh',
        }}
      />
    </div>
  );
}
