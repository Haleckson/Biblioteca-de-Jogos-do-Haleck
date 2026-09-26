/**
 * Blizzard OAuth Pre-flight Validation & Code Lifecycle Tracker
 *
 * Validates authorization codes prior to transmission to prevent redundant API calls,
 * catches consumed or expired OAuth codes early, deduplicates concurrent in-flight exchanges,
 * and triggers friendly, human-readable notifications when re-authentication is required.
 */

export interface CodeLifecycleRecord {
  codeHash: string;
  codeSnippet: string; // First 6 + last 4 characters for debugging/logging without leaking full token
  status: "pending" | "consumed" | "expired" | "failed";
  capturedAt: number;
  completedAt?: number;
  battleTag?: string;
  errorReason?: string;
}

export interface PreflightValidationResult {
  valid: boolean;
  sanitizedCode: string;
  reason?: "already_consumed" | "expired" | "in_flight" | "malformed";
  requiresReauth?: boolean;
  friendlyTitle?: string;
  friendlyMessage?: string;
  inFlightPromise?: Promise<any>;
}

// Blizzard OAuth codes typically expire within 5 to 10 minutes
export const BLIZZARD_CODE_MAX_AGE_MS = 10 * 60 * 1000; // 10 minutes

const SESSION_STORAGE_KEY = "blizzard_consumed_oauth_codes";

// In-flight token exchange promises to prevent race condition multi-requests for the same code
const inFlightExchanges = new Map<string, Promise<any>>();

// Registered re-auth notification callbacks (e.g. SiteSettingsModal, GameFormModal, App alert)
type NotificationListener = (title: string, message: string, requiresReauth: boolean) => void;
const notificationListeners = new Set<NotificationListener>();

/**
 * Generates a stable deterministic hash for an authorization code
 */
function hashOAuthCode(code: string): string {
  let hash = 0;
  for (let i = 0; i < code.length; i++) {
    hash = (hash << 5) - hash + code.charCodeAt(i);
    hash |= 0;
  }
  return `code_${Math.abs(hash)}_${code.length}`;
}

/**
 * Loads code history from sessionStorage
 */
function loadTrackedCodes(): Map<string, CodeLifecycleRecord> {
  const map = new Map<string, CodeLifecycleRecord>();
  if (typeof window === "undefined" || !window.sessionStorage) return map;

  try {
    const raw = window.sessionStorage.getItem(SESSION_STORAGE_KEY);
    if (raw) {
      const parsed: Record<string, CodeLifecycleRecord> = JSON.parse(raw);
      for (const [k, v] of Object.entries(parsed)) {
        // Drop records older than 24 hours
        if (Date.now() - v.capturedAt < 24 * 60 * 60 * 1000) {
          map.set(k, v);
        }
      }
    }
  } catch {
    // Ignore storage parse errors
  }
  return map;
}

/**
 * Saves tracked codes into sessionStorage
 */
function saveTrackedCodes(map: Map<string, CodeLifecycleRecord>): void {
  if (typeof window === "undefined" || !window.sessionStorage) return;

  try {
    const obj: Record<string, CodeLifecycleRecord> = {};
    map.forEach((val, key) => {
      obj[key] = val;
    });
    window.sessionStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(obj));
  } catch {
    // Ignore storage write errors
  }
}

/**
 * Registers an active UI notification listener for Blizzard re-authentication prompts
 */
export function registerBlizzardReauthListener(listener: NotificationListener): () => void {
  notificationListeners.add(listener);
  return () => {
    notificationListeners.delete(listener);
  };
}

/**
 * Broadcasts a friendly re-authentication prompt to all registered UI listeners and DOM events
 */
export function notifyBlizzardReauthRequired(title: string, message: string): void {
  // 1. Notify direct programmatic subscribers
  notificationListeners.forEach((fn) => {
    try {
      fn(title, message, true);
    } catch (err) {
      console.warn("[BlizzardOAuthPreflight] Listener error:", err);
    }
  });

  // 2. Dispatch custom window event for decoupled components and toast banners
  if (typeof window !== "undefined") {
    try {
      const event = new CustomEvent("blizzard-reauth-required", {
        detail: {
          title,
          message,
          requiresReauth: true,
          timestamp: Date.now(),
        },
      });
      window.dispatchEvent(event);
    } catch {
      // Ignore event dispatch failure in non-browser context
    }
  }
}

/**
 * Sanitizes and extracts the pure authorization code from raw string inputs
 */
export function sanitizeBlizzardAuthCode(rawCode: string): string {
  if (!rawCode) return "";

  let cleaned = rawCode.trim();

  // If user pasted a full callback URL, extract the query param
  if (cleaned.includes("code=") || cleaned.includes("blizzard_code=")) {
    try {
      const url = new URL(cleaned.startsWith("http") ? cleaned : `http://localhost/${cleaned.replace(/^\?/, "")}`);
      const extracted = url.searchParams.get("blizzard_code") || url.searchParams.get("code");
      if (extracted) cleaned = extracted;
    } catch {
      const match = cleaned.match(/(?:[?&]|^)(?:blizzard_code|code)=([^&#\s]+)/);
      if (match) cleaned = match[1];
    }
  }

  // Remove Bearer prefix if user pasted a full header or token
  cleaned = cleaned.replace(/^Bearer\s+/i, "").trim();
  // Strip enclosing quotes or trailing punctuation
  cleaned = cleaned.replace(/^["']|["']$/g, "").trim();

  return cleaned;
}

/**
 * Performs pre-flight verification on a Blizzard authorization code BEFORE making network requests.
 * Detects already-consumed codes, expired codes, malformed strings, and concurrent in-flight requests.
 */
export function validateBlizzardCodePreflight(rawCode: string): PreflightValidationResult {
  const sanitized = sanitizeBlizzardAuthCode(rawCode);

  // 1. Check for empty or malformed code
  if (!sanitized) {
    const title = "Código de Autorização Inválido";
    const msg = "Nenhum código de autorização foi fornecido. Por favor, inicie a conexão clicando em 'Conectar com Blizzard'.";
    notifyBlizzardReauthRequired(title, msg);
    return {
      valid: false,
      sanitizedCode: "",
      reason: "malformed",
      requiresReauth: true,
      friendlyTitle: title,
      friendlyMessage: msg,
    };
  }

  // Check if it's an explicit error string returned by OAuth
  if (sanitized.includes("access_denied") || sanitized.includes("error=")) {
    const title = "Autorização Não Concluída";
    const msg = "O acesso à conta Battle.net foi cancelado ou negado na tela da Blizzard. Por favor, tente novamente se deseja sincronizar seus personagens.";
    notifyBlizzardReauthRequired(title, msg);
    return {
      valid: false,
      sanitizedCode: sanitized,
      reason: "malformed",
      requiresReauth: true,
      friendlyTitle: title,
      friendlyMessage: msg,
    };
  }

  const codeHash = hashOAuthCode(sanitized);

  // 2. Check for in-flight concurrent execution (deduplicate)
  if (inFlightExchanges.has(codeHash)) {
    return {
      valid: true,
      sanitizedCode: sanitized,
      reason: "in_flight",
      inFlightPromise: inFlightExchanges.get(codeHash),
    };
  }

  // 3. Check tracked code history in session
  const trackedMap = loadTrackedCodes();
  const existing = trackedMap.get(codeHash);

  if (existing) {
    if (existing.status === "consumed") {
      const title = "Código Já Utilizado";
      const msg =
        "Este código de autorização da Blizzard já foi consumido por uma troca anterior. " +
        "Por diretrizes de segurança da Blizzard, códigos de autorização OAuth são de uso único. " +
        "Por favor, inicie uma nova autenticação clicando em 'Conectar com Blizzard'.";
      notifyBlizzardReauthRequired(title, msg);
      return {
        valid: false,
        sanitizedCode: sanitized,
        reason: "already_consumed",
        requiresReauth: true,
        friendlyTitle: title,
        friendlyMessage: msg,
      };
    }

    if (existing.status === "expired" || Date.now() - existing.capturedAt > BLIZZARD_CODE_MAX_AGE_MS) {
      const title = "Código de Autorização Expirado";
      const msg =
        "O código de autorização da Blizzard expirou. Os códigos de acesso da Battle.net possuem " +
        "validade restrita de poucos minutos. Por favor, clique em 'Conectar com Blizzard' para gerar uma nova autorização.";
      notifyBlizzardReauthRequired(title, msg);
      return {
        valid: false,
        sanitizedCode: sanitized,
        reason: "expired",
        requiresReauth: true,
        friendlyTitle: title,
        friendlyMessage: msg,
      };
    }
  }

  return {
    valid: true,
    sanitizedCode: sanitized,
  };
}

/**
 * Registers an in-flight promise for this code to prevent concurrent duplicate exchanges
 */
export function setInFlightExchange(sanitizedCode: string, promise: Promise<any>): void {
  const codeHash = hashOAuthCode(sanitizedCode);
  inFlightExchanges.set(codeHash, promise);

  // Clean up when promise settles
  promise.finally(() => {
    inFlightExchanges.delete(codeHash);
  });
}

/**
 * Marks an authorization code as currently pending exchange
 */
export function markCodePending(sanitizedCode: string): void {
  const codeHash = hashOAuthCode(sanitizedCode);
  const trackedMap = loadTrackedCodes();

  trackedMap.set(codeHash, {
    codeHash,
    codeSnippet: sanitizedCode.length > 10 ? `${sanitizedCode.slice(0, 6)}...${sanitizedCode.slice(-4)}` : sanitizedCode,
    status: "pending",
    capturedAt: Date.now(),
  });

  saveTrackedCodes(trackedMap);
}

/**
 * Marks an authorization code as successfully consumed and saved
 */
export function markCodeConsumed(sanitizedCode: string, metadata?: { battleTag?: string }): void {
  const codeHash = hashOAuthCode(sanitizedCode);
  const trackedMap = loadTrackedCodes();

  trackedMap.set(codeHash, {
    codeHash,
    codeSnippet: sanitizedCode.length > 10 ? `${sanitizedCode.slice(0, 6)}...${sanitizedCode.slice(-4)}` : sanitizedCode,
    status: "consumed",
    capturedAt: trackedMap.get(codeHash)?.capturedAt || Date.now(),
    completedAt: Date.now(),
    battleTag: metadata?.battleTag,
  });

  saveTrackedCodes(trackedMap);
}

/**
 * Marks an authorization code as expired or invalid_grant so subsequent attempts are intercepted early
 */
export function markCodeExpired(sanitizedCode: string, reason?: string): void {
  const codeHash = hashOAuthCode(sanitizedCode);
  const trackedMap = loadTrackedCodes();

  trackedMap.set(codeHash, {
    codeHash,
    codeSnippet: sanitizedCode.length > 10 ? `${sanitizedCode.slice(0, 6)}...${sanitizedCode.slice(-4)}` : sanitizedCode,
    status: "expired",
    capturedAt: trackedMap.get(codeHash)?.capturedAt || Date.now(),
    completedAt: Date.now(),
    errorReason: reason || "Code expired or rejected by Blizzard API",
  });

  saveTrackedCodes(trackedMap);
}

/**
 * Clears the session tracking history of consumed codes (for testing or hard reset)
 */
export function clearTrackedCodes(): void {
  if (typeof window !== "undefined" && window.sessionStorage) {
    try {
      window.sessionStorage.removeItem(SESSION_STORAGE_KEY);
    } catch {}
  }
}
