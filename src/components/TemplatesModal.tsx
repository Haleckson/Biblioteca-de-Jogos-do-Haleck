import { X, FileText, Feather, Compass, CheckSquare, Sparkles, BookOpen } from 'lucide-react';
import { ThemeMode } from '../types.ts';

export interface PageTemplate {
  id: string;
  title: string;
  description: string;
  icon: typeof FileText;
  content: string;
}

export const TEMPLATES: PageTemplate[] = [
  {
    id: 'pure-blank',
    title: 'Pure Blank Slate',
    description: 'An immaculate empty page with zero pre-filled text. Ready for immediate creation.',
    icon: Feather,
    content: '',
  },
  {
    id: 'freewriting',
    title: 'Stream of Consciousness',
    description: 'Non-stop raw writing timer prompt to unlock creativity and bypass the inner editor.',
    icon: Sparkles,
    content: `# Stream of Consciousness

Prompt: "Set a timer for 15 minutes. Do not delete, do not hesitate, do not judge."

---

Write without stopping here...`,
  },
  {
    id: 'chapter-draft',
    title: 'Book Chapter / Long Essay',
    description: 'Structured layout with epigraph, section headings, and narrative progression.',
    icon: BookOpen,
    content: `# Chapter I: The Threshold

> "A journey of a thousand leagues begins beneath one's feet."

### I. The Awakening

Describe the setting, the sensory atmosphere, and the opening tension.

### II. The Discovery

The inciting incident or core analytical realization that shifts the narrative.

### III. The Complication

What resistance appears?

### IV. Resolution

Key take-away or cliffhanger for the next chapter.`,
  },
  {
    id: 'journal-gratitude',
    title: 'Daily Journal & Grounding',
    description: 'Gentle mindful structure to reflect on your day, intentions, and key learnings.',
    icon: Compass,
    content: `# Daily Journal

Date: 

### 1. Gratitude
- What is one simple thing that brought comfort today?
- Who made a positive difference in your day?

### 2. Primary Focus
- What is the single most vital accomplishment needed today?

### 3. Unfiltered Notes & Thoughts
Write freely about how you feel right now...`,
  },
  {
    id: 'meeting-notes',
    title: 'Concise Meeting Brief',
    description: 'Action-oriented meeting record with objectives, discussion items, and ownership.',
    icon: CheckSquare,
    content: `# Meeting Brief: [Topic]

Participants: 
Objective: 

### Key Decisions
- Decision 1
- Decision 2

### Discussion Points
- 

### Action Items & Owners
- [ ] Task 1 — @Owner (Due date)
- [ ] Task 2 — @Owner (Due date)`,
  },
];

interface TemplatesModalProps {
  isOpen: boolean;
  onClose: () => void;
  onApplyTemplate: (template: PageTemplate) => void;
  theme: ThemeMode;
}

export function TemplatesModal({
  isOpen,
  onClose,
  onApplyTemplate,
  theme,
}: TemplatesModalProps) {
  const isDark = theme === 'slate' || theme === 'noir';

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div className="fixed inset-0 bg-black/50 backdrop-blur-xs" onClick={onClose} />

      {/* Modal Card */}
      <div
        className={`relative z-10 w-full max-w-2xl rounded-2xl p-6 shadow-2xl border transition-all max-h-[85vh] flex flex-col ${
          isDark
            ? 'bg-zinc-950 border-zinc-800 text-zinc-100'
            : theme === 'cream'
            ? 'bg-[#f7f3e8] border-amber-900/10 text-stone-900'
            : 'bg-white border-neutral-200 text-neutral-900'
        }`}
      >
        <div className="flex items-center justify-between pb-4 border-b border-neutral-200/70 dark:border-zinc-800/70 mb-5">
          <div>
            <h2 className="text-lg font-semibold tracking-tight">Writing Templates</h2>
            <p className="text-xs text-neutral-500 dark:text-zinc-400 mt-0.5">
              Choose a starter structure or begin with a pristine blank page.
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-md text-neutral-400 hover:text-neutral-700 dark:hover:text-zinc-200 cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 overflow-y-auto pr-1">
          {TEMPLATES.map((tmpl) => {
            const Icon = tmpl.icon;
            return (
              <button
                key={tmpl.id}
                onClick={() => {
                  onApplyTemplate(tmpl);
                  onClose();
                }}
                className={`p-4 rounded-xl border text-left cursor-pointer transition-all flex flex-col justify-between group ${
                  isDark
                    ? 'border-zinc-800 bg-zinc-900/50 hover:bg-zinc-900 hover:border-zinc-700'
                    : 'border-neutral-200 bg-neutral-50/70 hover:bg-white hover:border-neutral-300 hover:shadow-xs'
                }`}
              >
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <Icon className="w-4 h-4 text-neutral-600 dark:text-zinc-400 group-hover:text-neutral-950 dark:group-hover:text-white" />
                    <span className="text-xs font-semibold text-neutral-900 dark:text-zinc-100">
                      {tmpl.title}
                    </span>
                  </div>
                  <p className="text-[12px] text-neutral-500 dark:text-zinc-400 leading-relaxed">
                    {tmpl.description}
                  </p>
                </div>
                <span className="text-[11px] font-medium text-neutral-400 dark:text-zinc-500 mt-3 group-hover:text-neutral-900 dark:group-hover:text-zinc-200">
                  Select template →
                </span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
