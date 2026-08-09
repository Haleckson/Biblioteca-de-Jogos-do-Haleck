/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export interface BackupOperationLog {
  id: string;
  timestamp: number;
  provider: "ImgBB" | "Google Drive" | "YouTube" | "Firebase";
  action: string;
  status: "success" | "warning" | "error";
  gameName?: string;
  details: string;
  httpStatus?: number;
  durationMs?: number;
}

const STORAGE_KEY = "backup_audit_timeline_logs";
const MAX_LOGS = 150;

let memoryLogs: BackupOperationLog[] = [];

// Initialize memory logs from localStorage if available
try {
  if (typeof window !== "undefined" && window.localStorage) {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      memoryLogs = JSON.parse(raw);
    }
  }
} catch {
  memoryLogs = [];
}

/**
 * Adds a new entry to the backup operation timeline log.
 */
export function addBackupLog(log: Omit<BackupOperationLog, "id" | "timestamp">): BackupOperationLog {
  const fullLog: BackupOperationLog = {
    ...log,
    id: `log_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
    timestamp: Date.now(),
  };

  memoryLogs.unshift(fullLog);
  if (memoryLogs.length > MAX_LOGS) {
    memoryLogs = memoryLogs.slice(0, MAX_LOGS);
  }

  try {
    if (typeof window !== "undefined" && window.localStorage) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(memoryLogs));
    }
  } catch {
    // ignore
  }

  // Dispatch custom event so UI components can update in real-time
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent("backup_log_added", { detail: fullLog }));
  }

  return fullLog;
}

/**
 * Returns all recorded backup operation logs.
 */
export function getBackupLogs(): BackupOperationLog[] {
  return [...memoryLogs];
}

/**
 * Clears all timeline logs.
 */
export function clearBackupLogs(): void {
  memoryLogs = [];
  try {
    if (typeof window !== "undefined" && window.localStorage) {
      localStorage.removeItem(STORAGE_KEY);
    }
  } catch {
    // ignore
  }
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent("backup_logs_cleared"));
  }
}
