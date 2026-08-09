import { TrashItem } from "../types";

const TRASH_STORAGE_KEY = "gaming_backlog_trash_items_v1";

type TrashListener = (items: TrashItem[]) => void;
const listeners: Set<TrashListener> = new Set();

export function getTrashItems(): TrashItem[] {
  try {
    const raw = localStorage.getItem(TRASH_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function saveTrashItems(items: TrashItem[]) {
  try {
    localStorage.setItem(TRASH_STORAGE_KEY, JSON.stringify(items));
    listeners.forEach((l) => l([...items]));
  } catch (e) {
    console.warn("Failed to save trash items:", e);
  }
}

export function subscribeToTrash(listener: TrashListener): () => void {
  listeners.add(listener);
  listener(getTrashItems());
  return () => {
    listeners.delete(listener);
  };
}

export function addTrashItem(payload: Omit<TrashItem, "id" | "deletedAt">): TrashItem {
  const current = getTrashItems();
  const newItem: TrashItem = {
    ...payload,
    id: "trash_" + Math.random().toString(36).substring(2, 9) + Date.now().toString(36),
    deletedAt: Date.now(),
  };

  // Keep up to 100 items max in trash
  const updated = [newItem, ...current].slice(0, 100);
  saveTrashItems(updated);
  return newItem;
}

export const moveToTrash = addTrashItem;

export function restoreTrashItem(id: string): TrashItem | null {
  const current = getTrashItems();
  const found = current.find((item) => item.id === id);
  if (!found) return null;

  const updated = current.filter((item) => item.id !== id);
  saveTrashItems(updated);
  return found;
}

export function deleteTrashItemPermanently(id: string): void {
  const current = getTrashItems();
  const updated = current.filter((item) => item.id !== id);
  saveTrashItems(updated);
}

export function clearTrash(): void {
  saveTrashItems([]);
}
