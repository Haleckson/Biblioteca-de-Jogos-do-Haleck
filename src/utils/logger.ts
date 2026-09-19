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
      if (arg.jquery || (arg[0] && typeof HTMLElement !== "undefined" && arg[0] instanceof HTMLElement)) {
        return `[jQuery Container (${arg.length || 1} elements)]`;
      }
      // Shallow copy or clean check to remove __reactFiber or circular refs
      try {
        const seen = new WeakSet();
        const cleanCopy = (obj: any, depth = 0): any => {
          if (depth > 2 || obj === null || typeof obj !== "object") return obj;
          if (typeof HTMLElement !== "undefined" && obj instanceof HTMLElement) {
            return `[${obj.tagName.toLowerCase()}]`;
          }
          if (seen.has(obj)) return "[Circular]";
          seen.add(obj);
          if (Array.isArray(obj)) return obj.map((i) => cleanCopy(i, depth + 1));
          const out: Record<string, any> = {};
          for (const k of Object.keys(obj)) {
            if (k.startsWith("__react") || k.startsWith("_react")) continue;
            out[k] = cleanCopy(obj[k], depth + 1);
          }
          return out;
        };
        return cleanCopy(arg);
      } catch (_) {
        return "[Complex Object]";
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
      originalLog.apply(console, ["[Log payload]"]);
    }
  };

  console.info = (...args: any[]) => {
    try {
      const sanitized = sanitizeConsoleArgs(args);
      originalInfo.apply(console, sanitized);
    } catch (_) {
      originalInfo.apply(console, ["[Info payload]"]);
    }
  };

  console.debug = (...args: any[]) => {
    try {
      const sanitized = sanitizeConsoleArgs(args);
      originalDebug.apply(console, sanitized);
    } catch (_) {
      originalDebug.apply(console, ["[Debug payload]"]);
    }
  };

  console.warn = (...args: any[]) => {
    try {
      const sanitized = sanitizeConsoleArgs(args);
      originalWarn.apply(console, sanitized);
    } catch (_) {
      originalWarn.apply(console, ["[Warn payload]"]);
    }
  };

  console.error = (...args: any[]) => {
    try {
      const sanitized = sanitizeConsoleArgs(args);
      originalError.apply(console, sanitized);
    } catch (_) {
      originalError.apply(console, ["[Error payload]"]);
    }
  };
}
