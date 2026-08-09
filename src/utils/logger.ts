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

  const originalWarn = console.warn;
  const originalError = console.error;

  console.warn = (...args: any[]) => {
    const sanitized = sanitizeConsoleArgs(args);
    originalWarn.apply(console, sanitized);
  };

  console.error = (...args: any[]) => {
    const sanitized = sanitizeConsoleArgs(args);
    originalError.apply(console, sanitized);
  };
}
