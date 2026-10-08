/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * WoW Addon Checksum & GitHub Integrity Verification Service
 * Compares local installed files in WoW Forever (Interface/AddOns/HaleckAccountImporter)
 * with reference hashes from https://github.com/Haleckson/Biblioteca-de-Jogos-do-Haleck
 */

import addonLuaRaw from "../addon/HaleckAccountImporter.lua?raw";
import addonInterfaceLuaRaw from "../addon/AddonInterface.lua?raw";
import addonTocRaw from "../addon/HaleckAccountImporter.toc?raw";
import addonVanillaTocRaw from "../addon/HaleckAccountImporter_Vanilla.toc?raw";
import addonMainlineTocRaw from "../addon/HaleckAccountImporter_Mainline.toc?raw";
import addonTbcTocRaw from "../addon/HaleckAccountImporter_TBC.toc?raw";
import addonWrathTocRaw from "../addon/HaleckAccountImporter_Wrath.toc?raw";
import addonCataTocRaw from "../addon/HaleckAccountImporter_Cata.toc?raw";

export const ADDON_GITHUB_REPO_URL = "https://github.com/Haleckson/Biblioteca-de-Jogos-do-Haleck";
export const ADDON_FILES_LIST = [
  "HaleckAccountImporter.toc",
  "HaleckAccountImporter_Vanilla.toc",
  "HaleckAccountImporter_Mainline.toc",
  "HaleckAccountImporter_TBC.toc",
  "HaleckAccountImporter_Wrath.toc",
  "HaleckAccountImporter_Cata.toc",
  "HaleckAccountImporter.lua",
  "AddonInterface.lua",
] as const;

export type AddonFileName = typeof ADDON_FILES_LIST[number];

export interface FileChecksumInfo {
  fileName: string;
  name: string; // Compatibility alias
  localHash: string | null;
  remoteHash: string | null;
  status: "match" | "divergent" | "missing_local" | "missing_remote" | "pending";
  isMatch: boolean; // Compatibility alias
  localSize?: number;
  remoteSize?: number;
  lastModified?: string;
  source: "github" | "bundled_fallback";
}

export interface AddonIntegrityReport {
  isUpToDate: boolean;
  status: "up_to_date" | "outdated" | "not_installed" | "error";
  checkedAt: string;
  gitHubRepo: string;
  branch: string;
  totalFiles: number;
  matchingFiles: number;
  divergentFiles: number;
  missingFiles: number;
  files: FileChecksumInfo[];
  alert?: string;
  summaryMessage: string;
  actionRecommendation: string;
}

/**
 * Calculates SHA-256 hex string using browser native Web Crypto API
 */
export async function calculateSHA256(content: string | ArrayBuffer): Promise<string> {
  let buffer: ArrayBuffer;
  if (typeof content === "string") {
    // Normalize CRLF to LF to avoid false positives between Windows and Git checkout
    const normalized = content.replace(/\r\n/g, "\n");
    buffer = new TextEncoder().encode(normalized).buffer;
  } else {
    buffer = content;
  }

  const hashBuffer = await crypto.subtle.digest("SHA-256", buffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}

/**
 * Calculates short display hash (first 10 characters)
 */
export function formatShortHash(hash: string | null): string {
  if (!hash) return "—";
  return hash.substring(0, 10).toUpperCase();
}

/**
 * Fetches the reference file content from GitHub repository with fallback
 */
async function fetchRemoteFile(fileName: string, branch = "main"): Promise<{ content: string; source: "github" | "bundled_fallback" }> {
  const primaryUrl = `https://raw.githubusercontent.com/Haleckson/Biblioteca-de-Jogos-do-Haleck/${branch}/src/addon/${fileName}`;
  const masterUrl = `https://raw.githubusercontent.com/Haleckson/Biblioteca-de-Jogos-do-Haleck/master/src/addon/${fileName}`;

  try {
    const res = await fetch(primaryUrl, { cache: "no-store" });
    if (res.ok) {
      const text = await res.text();
      return { content: text, source: "github" };
    }
  } catch {}

  try {
    const res2 = await fetch(masterUrl, { cache: "no-store" });
    if (res2.ok) {
      const text = await res2.text();
      return { content: text, source: "github" };
    }
  } catch {}

  // Fallback to application's current compiled files
  let fallbackContent = "";
  if (fileName === "HaleckAccountImporter.toc") fallbackContent = addonTocRaw;
  else if (fileName === "HaleckAccountImporter_Vanilla.toc") fallbackContent = addonVanillaTocRaw;
  else if (fileName === "HaleckAccountImporter_Mainline.toc") fallbackContent = addonMainlineTocRaw;
  else if (fileName === "HaleckAccountImporter_TBC.toc") fallbackContent = addonTbcTocRaw;
  else if (fileName === "HaleckAccountImporter_Wrath.toc") fallbackContent = addonWrathTocRaw;
  else if (fileName === "HaleckAccountImporter_Cata.toc") fallbackContent = addonCataTocRaw;
  else if (fileName === "HaleckAccountImporter.lua") fallbackContent = addonLuaRaw;
  else if (fileName === "AddonInterface.lua") fallbackContent = addonInterfaceLuaRaw;

  return { content: fallbackContent, source: "bundled_fallback" };
}

/**
 * Calculates remote reference hashes for all addon files
 */
export async function fetchReferenceHashes(): Promise<Record<string, { hash: string; size: number; source: "github" | "bundled_fallback" }>> {
  const result: Record<string, { hash: string; size: number; source: "github" | "bundled_fallback" }> = {};

  for (const fileName of ADDON_FILES_LIST) {
    const { content, source } = await fetchRemoteFile(fileName);
    const hash = await calculateSHA256(content);
    result[fileName] = {
      hash,
      size: new Blob([content]).size,
      source,
    };
  }

  return result;
}

/**
 * Calculates local hashes from installed AddOn folder via File System Access API
 */
export async function calculateLocalInstalledHashes(addonFolderHandle: any): Promise<Record<string, { hash: string; size: number; lastModified: string } | null>> {
  const result: Record<string, { hash: string; size: number; lastModified: string } | null> = {};

  for (const fileName of ADDON_FILES_LIST) {
    try {
      const fileHandle = await addonFolderHandle.getFileHandle(fileName);
      const file = await fileHandle.getFile();
      const text = await file.text();
      const hash = await calculateSHA256(text);
      result[fileName] = {
        hash,
        size: file.size,
        lastModified: new Date(file.lastModified).toLocaleString(),
      };
    } catch {
      result[fileName] = null;
    }
  }

  return result;
}

/**
 * Performs full integrity comparison between local installed files and GitHub reference
 */
export async function performAddonIntegrityCheck(addonFolderHandle?: any): Promise<AddonIntegrityReport> {
  const remoteHashes = await fetchReferenceHashes();

  let localHashes: Record<string, { hash: string; size: number; lastModified: string } | null> = {};
  if (addonFolderHandle) {
    localHashes = await calculateLocalInstalledHashes(addonFolderHandle);
  }

  const filesArray: FileChecksumInfo[] = [];
  let matchingCount = 0;
  let divergentCount = 0;
  let missingCount = 0;

  for (const fileName of ADDON_FILES_LIST) {
    const remote = remoteHashes[fileName];
    const local = localHashes[fileName];

    if (!local) {
      missingCount++;
      filesArray.push({
        fileName,
        name: fileName,
        localHash: null,
        remoteHash: remote ? remote.hash : null,
        status: "missing_local",
        isMatch: false,
        remoteSize: remote ? remote.size : undefined,
        source: remote ? remote.source : "bundled_fallback",
      });
    } else {
      const isMatch = local.hash.toLowerCase() === (remote ? remote.hash.toLowerCase() : "");
      if (isMatch) {
        matchingCount++;
      } else {
        divergentCount++;
      }

      filesArray.push({
        fileName,
        name: fileName,
        localHash: local.hash,
        remoteHash: remote ? remote.hash : null,
        status: isMatch ? "match" : "divergent",
        isMatch,
        localSize: local.size,
        remoteSize: remote ? remote.size : undefined,
        lastModified: local.lastModified,
        source: remote ? remote.source : "bundled_fallback",
      });
    }
  }

  let overallStatus: "up_to_date" | "outdated" | "not_installed" | "error" = "up_to_date";
  let summaryMessage = "";
  let actionRecommendation = "";

  if (missingCount === ADDON_FILES_LIST.length) {
    overallStatus = "not_installed";
    summaryMessage = "O addon 'HaleckAccountImporter' não foi detectado na pasta local de AddOns.";
    actionRecommendation = "Clique em 'Instalar Addon' para copiar todos os arquivos fundamentais para a pasta Interface/AddOns.";
  } else if (divergentCount > 0 || missingCount > 0) {
    overallStatus = "outdated";
    summaryMessage = `${divergentCount} arquivo(s) possuem checksum divergente do repositório oficial GitHub (${missingCount} ausente(s)).`;
    actionRecommendation = "Clique em 'Atualizar Addon' para sincronizar e sobrescrever os arquivos locais com a versão mais recente.";
  } else {
    overallStatus = "up_to_date";
    summaryMessage = "Todos os arquivos instalados no cliente coincidem perfeitamente (100% de integridade com o GitHub).";
    actionRecommendation = "Nenhuma ação necessária. Seu cliente WoW está pronto para extração in-game.";
  }

  return {
    isUpToDate: overallStatus === "up_to_date",
    status: overallStatus,
    checkedAt: new Date().toLocaleTimeString(),
    gitHubRepo: ADDON_GITHUB_REPO_URL,
    branch: "main",
    totalFiles: ADDON_FILES_LIST.length,
    matchingFiles: matchingCount,
    divergentFiles: divergentCount,
    missingFiles: missingCount,
    files: filesArray,
    alert: summaryMessage,
    summaryMessage,
    actionRecommendation,
  };
}
