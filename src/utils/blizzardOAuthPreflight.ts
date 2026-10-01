/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

// Blizzard OAuth Pre-flight Validation & Token Exchange Deduplication
// Prevents duplicate code exchange requests, detects invalid/expired grants early,
// and notifies listeners when reauthentication is required.

export type CodeState = "new" | "pending" | "consumed" | "expired";

interface CodeEntry {
  code: string;
  state: CodeState;
  timestamp: number;
  inFlightPromise?: Promise<any>;
  metadata?: Record<string, any>;
}

const codeRegistry = new Map<string, CodeEntry>();
const reauthListeners = new Set<(title: string, message: string) => void>();

export function sanitizeBlizzardAuthCode(rawCode: string): string {
  if (!rawCode || typeof rawCode !== "string") return "";
  return rawCode.trim();
}

export interface PreflightResult {
  valid: boolean;
  sanitizedCode: string;
  reason?: "already_consumed" | "already_pending" | "expired" | "invalid_format";
  friendlyTitle?: string;
  friendlyMessage?: string;
  inFlightPromise?: Promise<any>;
}

export function validateBlizzardCodePreflight(code: string): PreflightResult {
  const sanitized = sanitizeBlizzardAuthCode(code);
  if (!sanitized) {
    return {
      valid: false,
      sanitizedCode: "",
      reason: "invalid_format",
      friendlyTitle: "Código Inválido",
      friendlyMessage: "O código de autorização da Blizzard está vazio.",
    };
  }

  const existing = codeRegistry.get(sanitized);
  if (existing) {
    if (existing.state === "consumed") {
      return {
        valid: false,
        sanitizedCode: sanitized,
        reason: "already_consumed",
        friendlyTitle: "Código Já Utilizado",
        friendlyMessage:
          "Este código de autorização já foi processado com sucesso anteriormente. Inicie uma nova conexão com a Blizzard.",
      };
    }
    if (existing.state === "expired") {
      return {
        valid: false,
        sanitizedCode: sanitized,
        reason: "expired",
        friendlyTitle: "Código Expirado",
        friendlyMessage:
          "Este código de autorização expirou ou foi invalidado pela Blizzard. Inicie uma nova conexão.",
      };
    }
    if (existing.state === "pending" && existing.inFlightPromise) {
      return {
        valid: true,
        sanitizedCode: sanitized,
        reason: "already_pending",
        inFlightPromise: existing.inFlightPromise,
      };
    }
  }

  return {
    valid: true,
    sanitizedCode: sanitized,
  };
}

export function markCodePending(code: string, promise?: Promise<any>): void {
  const sanitized = sanitizeBlizzardAuthCode(code);
  if (!sanitized) return;
  codeRegistry.set(sanitized, {
    code: sanitized,
    state: "pending",
    timestamp: Date.now(),
    inFlightPromise: promise,
  });
}

export function markCodeConsumed(code: string, metadata?: Record<string, any>): void {
  const sanitized = sanitizeBlizzardAuthCode(code);
  if (!sanitized) return;
  codeRegistry.set(sanitized, {
    code: sanitized,
    state: "consumed",
    timestamp: Date.now(),
    metadata,
  });
}

export function markCodeExpired(code: string, error?: string): void {
  const sanitized = sanitizeBlizzardAuthCode(code);
  if (!sanitized) return;
  codeRegistry.set(sanitized, {
    code: sanitized,
    state: "expired",
    timestamp: Date.now(),
    metadata: { error },
  });
}

export function notifyBlizzardReauthRequired(title: string, message: string): void {
  for (const listener of reauthListeners) {
    try {
      listener(title, message);
    } catch (_) {}
  }
}

export function registerBlizzardReauthListener(
  listener: (title: string, message: string) => void
): () => void {
  reauthListeners.add(listener);
  return () => {
    reauthListeners.delete(listener);
  };
}
