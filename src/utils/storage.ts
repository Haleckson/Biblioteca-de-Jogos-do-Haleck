import { DocumentItem, EditorSettings, ScratchpadNote } from '../types.ts';

const DOCS_KEY = 'blank_page_docs_v1';
const ACTIVE_DOC_KEY = 'blank_page_active_id_v1';
const SETTINGS_KEY = 'blank_page_settings_v1';
const SCRATCH_KEY = 'blank_page_scratch_v1';

export const DEFAULT_SETTINGS: EditorSettings = {
  theme: 'paper',
  font: 'serif',
  fontSize: 18,
  lineHeight: 'relaxed',
  pageWidth: 'standard',
  soundEnabled: false,
  typewriterMode: false,
  showStats: true,
  dailyGoal: 500,
};

export const DEFAULT_DOCUMENTS: DocumentItem[] = [
  {
    id: 'doc-welcome',
    title: 'The Clean Canvas',
    content: `# The Clean Canvas

> "The blank page is not an empty room; it is an open horizon."

Welcome to **Blank Page** — a quiet, distraction-free sanctuary designed for pure thought, focused writing, and uninterrupted flow.

### Why Blank Page?

1. **Silence the Noise**: No floating clutter, no notifications, no intrusive toolbars.
2. **Tactile Delight**: Optional typewriter acoustic feedback and warm literary typography.
3. **Always Yours**: Everything stays saved on your device with instant Markdown, text, and PDF export.

---

### Quick Gestures & Commands

- **Cmd/Ctrl + B**: Bold text
- **Cmd/Ctrl + I**: Italic text
- **Cmd/Ctrl + N**: New blank page
- **Cmd/Ctrl + K**: Quick page switcher
- **Esc**: Exit Zen Focus mode

Start typing here, or press **New Page** in the top navigation to begin your own chapter.`,
    createdAt: Date.now() - 3600000,
    updatedAt: Date.now() - 1800000,
    pinned: true,
    targetWordCount: 500,
  },
  {
    id: 'doc-morning-pages',
    title: 'Morning Reflections',
    content: `# Morning Reflections

Date: Early morning, stillness in the air.

The first ten minutes of the day belong to unfiltered perception. Write three things that caught your attention:

- The low slant of sunlight across the timber desk
- The quiet steam rising from fresh black coffee
- A sudden clarity regarding the project blueprint

What needs to be finished before the sun sets today?
1. Outline core structure
2. Send drafted brief to team
3. Read twenty pages of source material`,
    createdAt: Date.now() - 86400000,
    updatedAt: Date.now() - 43200000,
    pinned: false,
    targetWordCount: 300,
  }
];

export const DEFAULT_SCRATCHPAD: ScratchpadNote[] = [
  {
    id: 'scratch-1',
    text: 'Key reference quote: "Simplicity is about subtracting the obvious and adding the meaningful."',
    createdAt: Date.now() - 7200000,
  },
  {
    id: 'scratch-2',
    text: 'Next milestone: Test typography contrast across bright paper and deep obsidian themes.',
    createdAt: Date.now() - 3600000,
  }
];

export function loadDocuments(): DocumentItem[] {
  try {
    const raw = localStorage.getItem(DOCS_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed;
      }
    }
  } catch (err) {
    console.error('Failed to load documents from storage:', err);
  }
  return DEFAULT_DOCUMENTS;
}

export function saveDocuments(docs: DocumentItem[]): void {
  try {
    localStorage.setItem(DOCS_KEY, JSON.stringify(docs));
  } catch (err) {
    console.error('Failed to save documents to storage:', err);
  }
}

export function loadActiveDocId(): string {
  try {
    const id = localStorage.getItem(ACTIVE_DOC_KEY);
    if (id) return id;
  } catch {}
  return DEFAULT_DOCUMENTS[0].id;
}

export function saveActiveDocId(id: string): void {
  try {
    localStorage.setItem(ACTIVE_DOC_KEY, id);
  } catch {}
}

export function loadSettings(): EditorSettings {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    if (raw) {
      return { ...DEFAULT_SETTINGS, ...JSON.parse(raw) };
    }
  } catch {}
  return DEFAULT_SETTINGS;
}

export function saveSettings(settings: EditorSettings): void {
  try {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
  } catch {}
}

export function loadScratchpad(): ScratchpadNote[] {
  try {
    const raw = localStorage.getItem(SCRATCH_KEY);
    if (raw) {
      return JSON.parse(raw);
    }
  } catch {}
  return DEFAULT_SCRATCHPAD;
}

export function saveScratchpad(notes: ScratchpadNote[]): void {
  try {
    localStorage.setItem(SCRATCH_KEY, JSON.stringify(notes));
  } catch {}
}
