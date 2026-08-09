/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export interface FailedUploadLog {
  id: string;
  fileName: string;
  fileSize?: number;
  gameName: string;
  entryId: string;
  timestamp: string;
  errorMessage: string;
}

const FAILED_LOGS_STORAGE_KEY = "imgbb_failed_upload_logs";

export function getFailedUploadLogs(): FailedUploadLog[] {
  try {
    if (typeof window !== "undefined" && window.localStorage) {
      const raw = localStorage.getItem(FAILED_LOGS_STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) return parsed;
      }
    }
  } catch {
    // Ignore storage errors
  }
  return [];
}

export function saveFailedUploadLog(log: Omit<FailedUploadLog, "id" | "timestamp">) {
  try {
    const logs = getFailedUploadLogs();
    const newLog: FailedUploadLog = {
      ...log,
      id: `log_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      timestamp: new Date().toLocaleString("pt-BR"),
    };
    // Deduplicate if exact same fileName + gameName + errorMessage logged in last 10s
    const isDuplicate = logs.some(
      (l) =>
        l.fileName === log.fileName &&
        l.gameName === log.gameName &&
        l.errorMessage === log.errorMessage &&
        Date.now() - new Date(l.timestamp).getTime() < 10000
    );
    if (isDuplicate) return;

    const updated = [newLog, ...logs].slice(0, 300); // keep up to 300 recent logs
    if (typeof window !== "undefined" && window.localStorage) {
      localStorage.setItem(FAILED_LOGS_STORAGE_KEY, JSON.stringify(updated));
    }
  } catch {
    // Ignore storage errors
  }
}

export function clearFailedUploadLogs() {
  try {
    if (typeof window !== "undefined" && window.localStorage) {
      localStorage.removeItem(FAILED_LOGS_STORAGE_KEY);
    }
  } catch {
    // Ignore storage errors
  }
}
