import { setLogLevel } from "firebase/app";

/**
 * Summarizes any error or exception into a concise, direct single-line string.
 * Strips out massive code blocks, raw database rules, base64 strings, and stack trace bloat.
 */
export function summarizeError(err: any): string {
  if (!err) return "Erro desconhecido";

  // If it's a string, clean up potential massive payloads or raw Firebase warnings
  if (typeof err === "string") {
    let clean = err;
    if (clean.includes("FIREBASE WARNING") || clean.includes("permission_denied") || clean.includes("rules")) {
      return "[Firebase] Operação não permitida ou recusada pelas regras do banco de dados.";
    }
    if (clean.length > 250) {
      clean = clean.substring(0, 220) + "... [resumido para o console]";
    }
    return clean;
  }

  // Handle Firebase Error objects
  const code = err.code || err.status || "";
  const msg = err.message || String(err);

  if (code.includes("permission-denied") || code.includes("PERMISSION_DENIED") || msg.includes("permission_denied")) {
    return "[Firebase Error] Permissão negada pelas regras de segurança do banco de dados.";
  }
  if (code.includes("network-error") || msg.includes("network") || msg.includes("Failed to fetch")) {
    return "[Erro de Rede] Falha na comunicação com o servidor remoto.";
  }
  if (code.includes("quota-exceeded") || msg.includes("quota")) {
    return "[Erro de Cota] Limite de requisições ou armazenamento excedido.";
  }

  // Strip huge JSON or raw code embedded in error message
  let conciseMsg = msg;
  if (conciseMsg.includes("Rules:") || conciseMsg.includes("function") || conciseMsg.includes("{")) {
    conciseMsg = conciseMsg.split("\n")[0];
  }
  if (conciseMsg.length > 220) {
    conciseMsg = conciseMsg.substring(0, 200) + "... [resumido]";
  }

  return code ? `[${code}] ${conciseMsg}` : conciseMsg;
}

/**
 * Formats console argument lists to ensure no massive strings, code blocks, or giant arrays flood devtools.
 */
export function sanitizeConsoleArgs(args: any[]): any[] {
  return args.map((arg) => {
    if (arg === null || arg === undefined) return arg;

    if (typeof arg === "string") {
      // Catch raw Firebase warning code/rule dumps or huge string blobs
      if (
        arg.includes("FIREBASE WARNING:") ||
        (arg.includes("rules") && arg.includes("read") && arg.includes("write"))
      ) {
        return "[Firebase Warning] Alerta de regras de segurança do banco de dados (resumido).";
      }
      if (arg.startsWith("data:image/") || arg.startsWith("data:video/") || arg.startsWith("blob:")) {
        return `[Media URI string ... ${arg.substring(0, 30)}]`;
      }
      if (arg.length > 300) {
        return arg.substring(0, 250) + "... [conteúdo extenso ocultado no console]";
      }
      return arg;
    }

    if (arg instanceof Error) {
      return summarizeError(arg);
    }

    if (typeof HTMLElement !== "undefined" && arg instanceof HTMLElement) {
      return `[HTMLElement <${arg.tagName.toLowerCase()}>]`;
    }

    if (typeof arg === "object") {
      // Check if it's a jQuery or DOM container wrapper
      try {
        if (arg.jquery || (arg[0] && typeof HTMLElement !== "undefined" && arg[0] instanceof HTMLElement)) {
          return `[jQuery Container (${arg.length || 1} elements)]`;
        }
        // Shallow copy or clean check to remove __reactFiber or circular refs
        const seen = new WeakSet();
        const cleanCopy = (obj: any, depth = 0): any => {
          if (depth > 2 || obj === null || typeof obj !== "object") return obj;
          if (typeof HTMLElement !== "undefined" && obj instanceof HTMLElement) {
            return `[${obj.tagName.toLowerCase()}]`;
          }
          try {
            if (seen.has(obj)) return "[Circular]";
            seen.add(obj);
          } catch (_) {
            return "[Object]";
          }
          if (Array.isArray(obj)) return obj.map((i) => cleanCopy(i, depth + 1));
          const out: Record<string, any> = {};
          const keys = Object.keys(obj);
          for (const k of keys) {
            if (k.startsWith("__react") || k.startsWith("_react")) continue;
            try {
              const val = obj[k];
              out[k] = cleanCopy(val, depth + 1);
            } catch (_) {
              out[k] = "[Unreadable Property]";
            }
          }
          return out;
        };
        return cleanCopy(arg);
      } catch (_) {
        return (arg && (arg.message || arg.name)) ? `[${arg.name || "Object"}: ${arg.message || ""}]` : "[Object]";
      }
    }

    return arg;
  });
}

/**
 * Global initializer that cleans console outputs and silences internal SDK noise.
 */
let isSanitizerInitialized = false;

export function setupConsoleSanitizer(): void {
  if (isSanitizerInitialized) return;
  isSanitizerInitialized = true;

  // Set Firebase SDK log level to 'error' to prevent internal verbose rule/warning dumps
  try {
    setLogLevel("error");
  } catch (_) {
    // Ignore if firebase/app is not initialized yet
  }

  if (typeof window === "undefined" || !window.console) return;

  const originalLog = console.log;
  const originalInfo = console.info;
  const originalDebug = console.debug;
  const originalWarn = console.warn;
  const originalError = console.error;

  console.log = (...args: any[]) => {
    try {
      const sanitized = sanitizeConsoleArgs(args);
      originalLog.apply(console, sanitized);
    } catch (_) {
      try {
        originalLog.apply(console, args);
      } catch {
        originalLog(String(args[0] || ""));
      }
    }
  };

  console.info = (...args: any[]) => {
    try {
      const sanitized = sanitizeConsoleArgs(args);
      originalInfo.apply(console, sanitized);
    } catch (_) {
      try {
        originalInfo.apply(console, args);
      } catch {
        originalInfo(String(args[0] || ""));
      }
    }
  };

  console.debug = (...args: any[]) => {
    try {
      const sanitized = sanitizeConsoleArgs(args);
      originalDebug.apply(console, sanitized);
    } catch (_) {
      try {
        originalDebug.apply(console, args);
      } catch {
        originalDebug(String(args[0] || ""));
      }
    }
  };

  const isBenignNoise = (first: any): boolean => {
    if (typeof first === "string") {
      return (
        first.includes("IndexedDB is not available") ||
        first.includes("[StorageDB] Erro ao salvar chave") ||
        first.includes("[StorageDB] Falha ao abrir IndexedDB") ||
        first.includes("[BlizzardAssetCache]") ||
        first.includes("Falha no token exchange da Blizzard") ||
        first.includes("invalid_grant") ||
        first.includes("Warn payload")
      );
    }
    if (first instanceof Error) {
      const msg = first.message || String(first);
      return msg.includes("IndexedDB is not available") || msg.includes("invalid_grant");
    }
    return false;
  };

  console.warn = (...args: any[]) => {
    try {
      // Filter out benign internal storage messages or noise in restricted environments
      if (isBenignNoise(args[0])) {
        return;
      }
      const sanitized = sanitizeConsoleArgs(args);
      originalWarn.apply(console, sanitized);
    } catch (_) {
      try {
        originalWarn.apply(console, args);
      } catch {
        originalWarn(String(args[0] || ""));
      }
    }
  };

  console.error = (...args: any[]) => {
    try {
      if (isBenignNoise(args[0])) {
        return;
      }
      const sanitized = sanitizeConsoleArgs(args);
      originalError.apply(console, sanitized);
    } catch (_) {
      try {
        originalError.apply(console, args);
      } catch {
        originalError(String(args[0] || ""));
      }
    }
  };
}
