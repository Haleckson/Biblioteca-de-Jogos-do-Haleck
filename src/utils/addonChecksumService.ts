/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import addonTocRaw from "../addon/HaleckAccountImporter.toc?raw";
import addonLuaRaw from "../addon/HaleckAccountImporter.lua?raw";
import addonInterfaceLuaRaw from "../addon/AddonInterface.lua?raw";
import { parseAddonData, ParsedAddonResult } from "./wowAddonParser";
import { syncAddonDataToPersistentEndpoint } from "./addonExportService";

export const GITHUB_REPO_URL = "https://github.com/Haleckson/Biblioteca-de-Jogos-do-Haleck";
export const GITHUB_RAW_BASE = "https://raw.githubusercontent.com/Haleckson/Biblioteca-de-Jogos-do-Haleck/main/src/addon";

export interface FileChecksumInfo {
  filename: string;
  localHash: string | null;
  referenceHash: string;
  matches: boolean;
  localSize?: number;
  referenceSize?: number;
  status: "synced" | "outdated" | "missing";
}

export interface AddonIntegrityReport {
  checkedAt: string;
  source: "github" | "server_manifest" | "bundled_fallback";
  isUpToDate: boolean;
  status: "up_to_date" | "outdated" | "not_installed" | "error";
  totalFiles: number;
  matchedFiles: number;
  files: FileChecksumInfo[];
  repository: string;
  detectedVersion?: string;
  message: string;
}

export interface GameFolderScanResult {
  success: boolean;
  detectedGameVersion?: string;
  versionFolder?: string;
  accountsFound: string[];
  savedVariablesPath?: string;
  rawSavedVariables?: string;
  parsedData?: ParsedAddonResult;
  error?: string;
}

/**
 * Normalizes line endings (\r\n -> \n) to prevent OS-level differences from altering the cryptographic hash
 */
export function normalizeLineEndings(str: string): string {
  return str.replace(/\r\n/g, "\n");
}

/**
 * Computes SHA-256 hash using the native Web Cryptography API
 */
export async function computeSha256(content: string): Promise<string> {
  const normalized = normalizeLineEndings(content);
  const buffer = new TextEncoder().encode(normalized);
  const hashBuffer = await crypto.subtle.digest("SHA-256", buffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}

/**
 * Computes a quick MD5-equivalent 32-hex digest for comparison convenience
 */
export async function computeQuickHash(content: string): Promise<string> {
  const sha = await computeSha256(content);
  return sha.slice(0, 32);
}

/**
 * Fetches the reference addon files from GitHub repository (or fallback)
 */
export async function fetchReferenceAddonFiles(): Promise<{
  source: "github" | "server_manifest" | "bundled_fallback";
  files: Record<string, { content: string; hash: string }>;
}> {
  const filenames = [
    "HaleckAccountImporter.toc",
    "HaleckAccountImporter.lua",
    "AddonInterface.lua",
  ];

  const localFallbacks: Record<string, string> = {
    "HaleckAccountImporter.toc": addonTocRaw,
    "HaleckAccountImporter.lua": addonLuaRaw,
    "AddonInterface.lua": addonInterfaceLuaRaw,
  };

  const results: Record<string, { content: string; hash: string }> = {};
  let source: "github" | "server_manifest" | "bundled_fallback" = "github";

  for (const filename of filenames) {
    let content: string | null = null;

    // 1. Try GitHub Raw first
    try {
      const res = await fetch(`${GITHUB_RAW_BASE}/${filename}`, {
        cache: "no-store",
        headers: { Accept: "text/plain" },
      });
      if (res.ok) {
        content = await res.text();
      }
    } catch {
      // Fallback
    }

    // 2. Try Server backend proxy if GitHub Raw fails
    if (!content) {
      try {
        const res = await fetch(`/api/blizzard/wow/addon/raw/${filename}`);
        if (res.ok) {
          content = await res.text();
          source = "server_manifest";
        }
      } catch {}
    }

    // 3. Bundled build fallback
    if (!content) {
      content = localFallbacks[filename] || "";
      source = "bundled_fallback";
    }

    const hash = await computeSha256(content);
    results[filename] = { content, hash };
  }

  return { source, files: results };
}

/**
 * Verifies the local directory handle against the reference GitHub files
 */
export async function checkLocalAddonIntegrity(
  directoryHandle: any
): Promise<AddonIntegrityReport> {
  try {
    const refData = await fetchReferenceAddonFiles();
    const filenames = [
      "HaleckAccountImporter.toc",
      "HaleckAccountImporter.lua",
      "AddonInterface.lua",
    ];

    // Determine target directory: could be 'HaleckAccountImporter' or parent containing it
    let targetFolder = directoryHandle;
    try {
      const subFolder = await directoryHandle.getDirectoryHandle("HaleckAccountImporter", { create: false });
      if (subFolder) targetFolder = subFolder;
    } catch {
      // Already inside HaleckAccountImporter
    }

    const fileReports: FileChecksumInfo[] = [];
    let allMatched = true;
    let missingCount = 0;
    let detectedVersion: string | undefined;

    for (const name of filenames) {
      let localContent: string | null = null;
      let localSize: number | undefined;

      try {
        const fileHandle = await targetFolder.getFileHandle(name, { create: false });
        const file = await fileHandle.getFile();
        localSize = file.size;
        localContent = await file.text();
      } catch {
        localContent = null;
      }

      const ref = refData.files[name];
      if (!localContent) {
        missingCount++;
        allMatched = false;
        fileReports.push({
          filename: name,
          localHash: null,
          referenceHash: ref.hash,
          matches: false,
          referenceSize: ref.content.length,
          status: "missing",
        });
      } else {
        if (name === "HaleckAccountImporter.toc") {
          const vMatch = localContent.match(/##\s*Version:\s*([^\r\n]+)/i);
          if (vMatch) detectedVersion = vMatch[1].trim();
        }

        const localHash = await computeSha256(localContent);
        const matches = localHash === ref.hash;
        if (!matches) allMatched = false;

        fileReports.push({
          filename: name,
          localHash,
          referenceHash: ref.hash,
          matches,
          localSize,
          referenceSize: ref.content.length,
          status: matches ? "synced" : "outdated",
        });
      }
    }

    let status: "up_to_date" | "outdated" | "not_installed" | "error" = "up_to_date";
    let message = "Todos os arquivos do addon correspondem perfeitamente ao repositório GitHub!";

    if (missingCount === filenames.length) {
      status = "not_installed";
      message = "Nenhum arquivo do addon Haleck Account Importer foi detectado nesta pasta.";
    } else if (!allMatched) {
      status = "outdated";
      message = "O addon está desatualizado em comparação com a versão do GitHub. Recomendada a atualização.";
    }

    const matchedFiles = fileReports.filter((f) => f.matches).length;

    return {
      checkedAt: new Date().toLocaleTimeString("pt-BR"),
      source: refData.source,
      isUpToDate: allMatched && missingCount === 0,
      status,
      totalFiles: filenames.length,
      matchedFiles,
      files: fileReports,
      repository: GITHUB_REPO_URL,
      detectedVersion,
      message,
    };
  } catch (err: any) {
    return {
      checkedAt: new Date().toLocaleTimeString("pt-BR"),
      source: "bundled_fallback",
      isUpToDate: false,
      status: "error",
      totalFiles: 3,
      matchedFiles: 0,
      files: [],
      repository: GITHUB_REPO_URL,
      message: err?.message || "Erro ao inspecionar diretório local do addon.",
    };
  }
}

/**
 * Scans a user-selected World of Warcraft game folder for SavedVariables,
 * extracts character snapshot and imports data directly into persistent storage.
 */
export async function scanGameFolderForSavedVariables(
  gameDirHandle: any
): Promise<GameFolderScanResult> {
  try {
    let wtfHandle: any = null;
    let detectedGameVersion = "WoW Forever (Vanilla+ 16001)";
    let versionFolder = "_classic_beta_";

    // 1. Check if the user selected the root 'World of Warcraft' directory
    const candidates = ["_classic_beta_", "_classic_era_", "_classic_", "_retail_"];
    for (const v of candidates) {
      try {
        const vDir = await gameDirHandle.getDirectoryHandle(v, { create: false });
        if (vDir) {
          versionFolder = v;
          try {
            wtfHandle = await vDir.getDirectoryHandle("WTF", { create: false });
            if (wtfHandle) {
              detectedGameVersion = v === "_classic_beta_" ? "WoW Forever (Beta 16001)" : v;
              break;
            }
          } catch {}
        }
      } catch {}
    }

    // 2. If not found in subfolders, test if the user selected the version folder itself or WTF folder
    if (!wtfHandle) {
      try {
        wtfHandle = await gameDirHandle.getDirectoryHandle("WTF", { create: false });
      } catch {}
    }
    if (!wtfHandle && gameDirHandle.name?.toLowerCase() === "wtf") {
      wtfHandle = gameDirHandle;
    }

    if (!wtfHandle) {
      return {
        success: false,
        accountsFound: [],
        error: "Pasta 'WTF' não foi encontrada. Certifique-se de selecionar a pasta raiz do World of Warcraft (ou '_classic_beta_').",
      };
    }

    // 3. Find 'Account' folder inside 'WTF'
    let accountFolder: any = null;
    try {
      accountFolder = await wtfHandle.getDirectoryHandle("Account", { create: false });
    } catch {
      return {
        success: false,
        accountsFound: [],
        error: "Subpasta 'WTF/Account' não encontrada. Verifique se o jogo já foi iniciado pelo menos uma vez.",
      };
    }

    // 4. Iterate accounts inside 'Account'
    const accountsFound: string[] = [];
    let savedVariablesContent: string | null = null;
    let savedVariablesPath = "";

    // FileSystemDirectoryHandle.values() asynchronous iterator
    // @ts-ignore
    for await (const entry of accountFolder.values()) {
      if (entry.kind === "directory" && entry.name !== "SavedVariables") {
        accountsFound.push(entry.name);

        // Check for SavedVariables inside this account
        try {
          const svFolder = await entry.getDirectoryHandle("SavedVariables", { create: false });
          const targetFiles = ["HaleckAccountImporter.lua", "HaleckAccountImporterDB.lua"];

          for (const targetFile of targetFiles) {
            try {
              const fileHandle = await svFolder.getFileHandle(targetFile, { create: false });
              const file = await fileHandle.getFile();
              const text = await file.text();
              if (text && text.trim().length > 50) {
                savedVariablesContent = text;
                savedVariablesPath = `WTF/Account/${entry.name}/SavedVariables/${targetFile}`;
                break;
              }
            } catch {}
          }
        } catch {}

        if (savedVariablesContent) break;
      }
    }

    if (!savedVariablesContent) {
      return {
        success: false,
        accountsFound,
        detectedGameVersion,
        versionFolder,
        error: `Contas encontradas (${accountsFound.join(", ")}), mas nenhum arquivo 'SavedVariables/HaleckAccountImporter.lua' com dados válidos foi localizado. Inicie o jogo e digite '/hai save' antes de importar.`,
      };
    }

    // 5. Parse the SavedVariables content
    const parsedData = parseAddonData(savedVariablesContent);

    // 6. Automatically sync to persistent endpoint
    try {
      if (parsedData?.activeProfile) {
        await syncAddonDataToPersistentEndpoint({
          characterName: parsedData.activeProfile.name,
          realm: parsedData.activeProfile.realm,
          ruleset: parsedData.ruleset || versionFolder,
          gameVersion: detectedGameVersion,
          profileData: parsedData.activeProfile,
        });
      }
    } catch (syncErr) {
      console.warn("Auto-sync to persistent endpoint note:", syncErr);
    }

    return {
      success: true,
      detectedGameVersion,
      versionFolder,
      accountsFound,
      savedVariablesPath,
      rawSavedVariables: savedVariablesContent,
      parsedData,
    };
  } catch (err: any) {
    return {
      success: false,
      accountsFound: [],
      error: err?.message || "Erro desconhecido ao escanear pastas do World of Warcraft.",
    };
  }
}
