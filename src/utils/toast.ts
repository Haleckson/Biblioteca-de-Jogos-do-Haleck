/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export type ToastType = "info" | "success" | "warning" | "error" | "achievement";

export interface ToastMessage {
  id: string;
  title: string;
  message: string;
  type: ToastType;
  duration?: number; // in ms, default 5000
  createdAt: number;
  action?: {
    label: string;
    onClick: () => void;
  };
}

type ToastListener = (toasts: ToastMessage[]) => void;

let activeToasts: ToastMessage[] = [];
const listeners: Set<ToastListener> = new Set();

function notifyListeners() {
  const current = [...activeToasts];
  listeners.forEach((listener) => listener(current));
}

/**
 * Pushes a new toast notification into the bottom-right stack.
 */
export function showToast(options: {
  title: string;
  message: string;
  type?: ToastType;
  duration?: number;
  action?: {
    label: string;
    onClick: () => void;
  };
}): string {
  const id = Math.random().toString(36).substring(2, 9) + Date.now().toString(36);
  const type = options.type || "info";
  const duration = options.duration ?? 5000;

  const newToast: ToastMessage = {
    id,
    title: options.title,
    message: options.message,
    type,
    duration,
    createdAt: Date.now(),
    action: options.action,
  };

  // Prevent exact duplicate title+message flood within 1 second
  const isDuplicateRecent = activeToasts.some(
    (t) => t.title === options.title && t.message === options.message && Date.now() - t.createdAt < 1000
  );

  if (isDuplicateRecent) {
    return "";
  }

  // Prepend new toast (most recent first)
  activeToasts = [newToast, ...activeToasts];
  notifyListeners();

  if (duration > 0) {
    setTimeout(() => {
      dismissToast(id);
    }, duration);
  }

  return id;
}

/**
 * Dismisses a single toast by ID.
 */
export function dismissToast(id: string) {
  activeToasts = activeToasts.filter((t) => t.id !== id);
  notifyListeners();
}

/**
 * Dismisses all active toasts at once.
 */
export function clearAllToasts() {
  activeToasts = [];
  notifyListeners();
}

/**
 * React hook or listener subscription for active toasts.
 */
export function subscribeToToasts(listener: ToastListener): () => void {
  listeners.add(listener);
  listener([...activeToasts]);
  return () => {
    listeners.delete(listener);
  };
}
