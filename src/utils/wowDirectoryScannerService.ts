/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * WoW Directory Scanner & Automatic SavedVariables Importer Service
 * Recursively locates WoW client installations (prioritizing _classic_beta_ for WoW Forever),
 * scans WTF/Account SavedVariables, parses addon export data, and persists directly into the database.
 * Supports both FileSystemDirectoryHandle and FileList (from native folder inputs).
 */

import { parseAddonData, ParsedAddonResult } from "./wowAddonParser";
import { performSavedVariablesDryRun, DryRunReport } from "./wowSavedVariablesIntegrity";
import { getWoWClassIcon, getWoWRaceIcon } from "./blizzardIcons";

export interface ScannedCharacterEntry {
  name: string;
  realm: string;
  accountName: string;
  level: number;
  characterClass: string;
  race: string;
  gold: number;
  equippedItemLevel?: number;
  achievementPoints?: number;
  classIconUrl?: string;
  raceIconUrl?: string;
  faction?: string;
}

export interface ScannedRealmGroup {
  realmName: string;
  characters: ScannedCharacterEntry[];
  totalGold: number;
}

export interface ScannedAccountGroup {
  accountName: string;
  realms: ScannedRealmGroup[];
  totalCharacters: number;
  totalGold: number;
  files: ScannedSavedVariableFile[];
}

export interface ScannedSavedVariableFile {
  accountName: string;
  realm?: string;
  characterName?: string;
  filePath: string;
  fileName: string;
  fileSize: number;
  lastModified: string;
  rawContent: string;
  dryRunReport: DryRunReport;
  importedToDb: boolean;
  syncError?: string;
}

export interface WoWScanResult {
  success: boolean;
  rootFolderName: string;
  rootFolderPath?: string;
  detectedFlavor: "forever_beta" | "classic_era" | "retail" | "custom";
  detectedFlavorLabel: string;
  scannedAt: string;
  accountsFound: string[];
  accountGroups: ScannedAccountGroup[];
  filesFound: ScannedSavedVariableFile[];
  totalCharactersImported: number;
  totalGoldAggregated: number;
  message: string;
}

/**
 * Organizes scanned files into accounts, realms, and characters hierarchy
 */
function buildAccountGroups(files: ScannedSavedVariableFile[]): {
  accountGroups: ScannedAccountGroup[];
  totalCharacters: number;
  totalGold: number;
} {
  const accountMap = new Map<string, {
    accountName: string;
    realmsMap: Map<string, Map<string, ScannedCharacterEntry>>;
    files: ScannedSavedVariableFile[];
  }>();

  for (const f of files) {
    const acc = f.accountName || "Conta Padrão";
    if (!accountMap.has(acc)) {
      accountMap.set(acc, {
        accountName: acc,
        realmsMap: new Map(),
        files: [],
      });
    }
    const accData = accountMap.get(acc)!;
    accData.files.push(f);

    const report = f.dryRunReport;
    if (report && report.characterName && report.characterName !== "Personagem Desconhecido") {
      const realm = f.realm || report.realm || "WoW Forever (Beta)";
      if (!accData.realmsMap.has(realm)) {
        accData.realmsMap.set(realm, new Map());
      }
      const realmChars = accData.realmsMap.get(realm)!;
      const charKey = `${report.characterName}-${realm}`;
      if (!realmChars.has(charKey)) {
        const gold = report.stats?.totalGold || 0;
        realmChars.set(charKey, {
          name: report.characterName,
          realm,
          accountName: acc,
          level: report.level || 60,
          characterClass: report.characterClass || "Guerreiro",
          race: report.parsedProfile?.race || "Humano",
          gold,
          equippedItemLevel: report.stats?.equippedItemsCount || 0,
          achievementPoints: report.stats?.achievementPoints || 0,
          classIconUrl: getWoWClassIcon(report.characterClass || "Warrior"),
          raceIconUrl: getWoWRaceIcon(report.parsedProfile?.race || "Human"),
          faction: report.parsedProfile?.faction || "ALLIANCE",
        });
      }
    }
  }

  let grandTotalCharacters = 0;
  let grandTotalGold = 0;

  const accountGroups: ScannedAccountGroup[] = [];

  accountMap.forEach((accVal, accKey) => {
    const realms: ScannedRealmGroup[] = [];
    let accTotalCharacters = 0;
    let accTotalGold = 0;

    accVal.realmsMap.forEach((charMap, realmName) => {
      const characters = Array.from(charMap.values());
      const realmGold = characters.reduce((sum, c) => sum + (c.gold || 0), 0);
      accTotalCharacters += characters.length;
      accTotalGold += realmGold;
      realms.push({
        realmName,
        characters,
        totalGold: realmGold,
      });
    });

    grandTotalCharacters += accTotalCharacters;
    grandTotalGold += accTotalGold;

    accountGroups.push({
      accountName: accKey,
      realms,
      totalCharacters: accTotalCharacters,
      totalGold: accTotalGold,
      files: accVal.files,
    });
  });

  return {
    accountGroups,
    totalCharacters: grandTotalCharacters,
    totalGold: grandTotalGold,
  };
}

/**
 * Dedicated storage key for the Automated Scanner root directory path
 * Completely separated from Section 2.1 Interface/AddOns target path
 */
const SCANNER_ROOT_PATH_STORAGE_KEY = "haleck_wow_scanner_root_path";
export const DEFAULT_WOW_FOREVER_SCANNER_PATH = "C:\\Program Files (x86)\\World of Warcraft\\_classic_beta_";

export function getStoredScannerRootPath(): string {
  try {
    return localStorage.getItem(SCANNER_ROOT_PATH_STORAGE_KEY) || DEFAULT_WOW_FOREVER_SCANNER_PATH;
  } catch {
    return DEFAULT_WOW_FOREVER_SCANNER_PATH;
  }
}

export function setStoredScannerRootPath(rootPath: string): void {
  try {
    localStorage.setItem(SCANNER_ROOT_PATH_STORAGE_KEY, rootPath.trim());
  } catch {}
}

/**
 * Persists Scanner Root Path across devices (Backend API + Firebase Firestore + LocalStorage)
 */
export async function savePersistentScannerRootPath(rootPath: string): Promise<void> {
  const clean = rootPath.trim();
  setStoredScannerRootPath(clean);
  try {
    await fetch("/api/blizzard/wow/paths", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ scannerRootPath: clean }),
    });
  } catch {}
  try {
    const { saveWoWPathsToFirebase } = await import("./firebase");
    await saveWoWPathsToFirebase({ scannerRootPath: clean });
  } catch {}
}

/**
 * Loads Scanner Root Path from backend/Firebase with local fallback
 */
export async function loadPersistentScannerRootPath(): Promise<string> {
  try {
    const res = await fetch("/api/blizzard/wow/paths");
    if (res.ok) {
      const data = await res.json();
      if (data && data.scannerRootPath) {
        setStoredScannerRootPath(data.scannerRootPath);
        return data.scannerRootPath;
      }
    }
  } catch {}
  return getStoredScannerRootPath();
}

/**
 * Generates an automated 1-click batch script to scan the exact configured WoW root path
 * and push all SavedVariables files to the website without manual file picking.
 */
export function generateAutoScanScriptBat(scannerRootPath?: string, apiEndpoint?: string): string {
  const root = (scannerRootPath || getStoredScannerRootPath()).trim();
  const endpoint = apiEndpoint || (typeof window !== "undefined" ? `${window.location.origin}/api/blizzard/wow/addon-sync` : "http://localhost:3000/api/blizzard/wow/addon-sync");

  return `@echo off
title Auto-Scan WoW SavedVariables - Haleck GameLog
color 0b
echo ========================================================================
echo        AUTO-SCANNER DE PASTAS & SUBPASTAS - HALECK ACCOUNT IMPORTER
echo ========================================================================
echo Pasta Raiz do WoW configurada:
echo "${root}"
echo.
echo Servidor de Sincronizacao:
echo "${endpoint}"
echo.

set "WOW_ROOT=${root}"
if not exist "%WOW_ROOT%" (
    echo [ERRO] A pasta raiz especificada nao foi encontrada no seu computador:
    echo "%WOW_ROOT%"
    echo Verifique o caminho ou a unidade de disco e tente novamente.
    echo.
    pause
    exit /b 1
)

echo [1/3] Varrendo recursivamente todas as pastas e subpastas de SavedVariables...
powershell -NoProfile -Command "
$root = '${root}';
$url = '${endpoint}';
Write-Host 'Procurando arquivos em:' $root -ForegroundColor Cyan;
$targetPatterns = @('*HaleckAccountImporter*.lua', '*ForeverStatistics*.lua', '*ForeverJourney*.lua');
$files = Get-ChildItem -Path $root -Recurse -File -ErrorAction SilentlyContinue | Where-Object {
    $fn = $_.Name;
    ($fn -like '*HaleckAccountImporter*.lua' -or $fn -like '*ForeverStatistics*.lua' -or $fn -like '*ForeverJourney*.lua' -or ($_.FullName -like '*SavedVariables*' -and ($fn -like '*.lua' -or $fn -like '*.json')))
};

if (-not $files -or $files.Count -eq 0) {
    Write-Host '[AVISO] Nenhum arquivo SavedVariables encontrado na pasta raiz e subpastas.' -ForegroundColor Yellow;
    Write-Host 'Certifique-se de ter feito logout no WoW para que o jogo grave as variaveis.' -ForegroundColor Yellow;
    exit 0;
}

Write-Host ('Localizados ' + $files.Count + ' arquivo(s) de SavedVariables:') -ForegroundColor Green;
$successCount = 0;
foreach ($f in $files) {
    Write-Host (' -> Processando: ' + $f.FullName) -ForegroundColor White;
    try {
        $content = [System.IO.File]::ReadAllText($f.FullName, [System.Text.Encoding]::UTF8);
        if ($content.Length -gt 10) {
            $payload = @{ rawLua = $content } | ConvertTo-Json;
            $res = Invoke-RestMethod -Uri $url -Method Post -Body $payload -ContentType 'application/json' -ErrorAction Stop;
            Write-Host ('    [OK] Sincronizado com sucesso! (' + ($res.character | Out-String).Trim() + ' / ' + ($res.realm | Out-String).Trim() + ')') -ForegroundColor Green;
            $successCount++;
        }
    } catch {
        Write-Host ('    [ERRO] Falha ao enviar: ' + $_.Exception.Message) -ForegroundColor Red;
    }
}

Write-Host '';
Write-Host ('========================================================================') -ForegroundColor Cyan;
Write-Host ('[SUCESSO] ' + $successCount + ' arquivo(s) importado(s) com sucesso para o Haleck GameLog!') -ForegroundColor Green;
Write-Host ('Seus personagens, bolsas, armaria, missões e ouro já estao atualizados no site!') -ForegroundColor Yellow;
Write-Host ('========================================================================') -ForegroundColor Cyan;
"

echo.
pause
`;
}

export function downloadAutoScanScriptBat(scannerRootPath?: string): void {
  const content = generateAutoScanScriptBat(scannerRootPath);
  const blob = new Blob([content], { type: "text/plain;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "auto-scan-wow.bat";
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/**
 * Searches a FileSystemDirectoryHandle recursively through all folders and subfolders
 * for HaleckAccountImporter and ForeverStatistics SavedVariables.
 */
export async function scanAndImportWoWDirectory(
  rootHandle: any,
  customRootPath?: string
): Promise<WoWScanResult> {
  const rootName = (rootHandle?.name || "World of Warcraft").toLowerCase();
  let flavor: "forever_beta" | "classic_era" | "retail" | "custom" = "custom";
  let flavorLabel = "Personalizado";

  if (rootName.includes("beta") || rootName.includes("forever") || rootName.includes("_classic_beta_")) {
    flavor = "forever_beta";
    flavorLabel = "WoW Forever Beta (_classic_beta_)";
  } else if (rootName.includes("era") || rootName.includes("classic")) {
    flavor = "classic_era";
    flavorLabel = "WoW Classic Era";
  } else if (rootName.includes("retail")) {
    flavor = "retail";
    flavorLabel = "WoW Retail";
  } else if (rootName === "world of warcraft" || rootName === "wow") {
    flavor = "forever_beta";
    flavorLabel = "World of Warcraft (Raiz)";
  }

  interface DiscoveredFile {
    handle: any;
    relativePath: string;
    fileName: string;
  }

  const discoveredFiles: DiscoveredFile[] = [];
  const IGNORED_DIRS = new Set([
    ".git", "node_modules", "screenshots", "logs", "cache", "data", "errors", "gpucache", "crashpad", "updates"
  ]);

  // Recursive traversal helper through all folders and subfolders
  async function traverseDirectory(dir: any, currentPath: string, depth: number) {
    if (depth <= 0 || !dir) return;
    try {
      for await (const [entryName, entryHandle] of dir.entries()) {
        const lowerName = entryName.toLowerCase();
        if (entryHandle.kind === "file") {
          const isTargetAddon =
            lowerName.includes("haleck") ||
            lowerName.includes("accountimporter") ||
            lowerName.includes("foreverstatistics") ||
            lowerName.includes("foreverjourney") ||
            lowerName.includes("foreverchronicle") ||
            (currentPath.toLowerCase().includes("savedvariables") && (lowerName.endsWith(".lua") || lowerName.endsWith(".json")));
          const isTargetExt =
            lowerName.endsWith(".lua") ||
            lowerName.endsWith(".lua.bak") ||
            lowerName.endsWith(".json");

          if (isTargetAddon && isTargetExt) {
            discoveredFiles.push({
              handle: entryHandle,
              relativePath: currentPath ? `${currentPath}/${entryName}` : entryName,
              fileName: entryName,
            });
          }
        } else if (entryHandle.kind === "directory") {
          if (!IGNORED_DIRS.has(lowerName)) {
            const nextPath = currentPath ? `${currentPath}/${entryName}` : entryName;
            await traverseDirectory(entryHandle, nextPath, depth - 1);
          }
        }
      }
    } catch (e) {
      console.warn("Aviso ao ler diretório:", currentPath, e);
    }
  }

  // Execute recursive scan up to 8 levels deep across all folders
  await traverseDirectory(rootHandle, rootHandle?.name || "", 8);

  const accountsFound = new Set<string>();
  const filesFound: ScannedSavedVariableFile[] = [];

  for (const item of discoveredFiles) {
    try {
      const file = await item.handle.getFile();
      const text = await file.text();

      if (text && text.trim().length > 10) {
        const dryRun = performSavedVariablesDryRun(text);

        // Derive account, realm and character from path parts
        const parts = item.relativePath.replace(/\\/g, "/").split("/");
        let accName = "Conta Padrão";
        let realmName: string | undefined;
        let charName: string | undefined;

        const accountIdx = parts.findIndex((p) => p.toLowerCase() === "account");
        if (accountIdx !== -1 && parts[accountIdx + 1]) {
          accName = parts[accountIdx + 1];
          if (parts[accountIdx + 2] && parts[accountIdx + 2].toLowerCase() !== "savedvariables") {
            realmName = parts[accountIdx + 2];
            if (parts[accountIdx + 3] && parts[accountIdx + 3].toLowerCase() !== "savedvariables") {
              charName = parts[accountIdx + 3];
            }
          }
        }

        // If path didn't have character name, fallback to parsed profile from inside file
        if (!charName && dryRun.characterName && dryRun.characterName !== "Personagem Desconhecido") {
          charName = dryRun.characterName;
        }
        if (!realmName && dryRun.parsedProfile?.realm) {
          realmName = dryRun.parsedProfile.realm;
        }

        accountsFound.add(accName);

        // Import to persistent backend database
        let imported = false;
        let syncError: string | undefined;

        try {
          const syncRes = await fetch("/api/blizzard/wow/addon-sync", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ rawLua: text }),
          });
          if (syncRes.ok) {
            imported = true;
            const syncJson = await syncRes.json().catch(() => ({}));
            if (syncJson?.character && (!charName || charName === "Personagem Desconhecido")) {
              charName = syncJson.character;
            }
            if (syncJson?.realm && (!realmName || realmName === "WoW Forever (Beta)")) {
              realmName = syncJson.realm;
            }
          } else {
            const err = await syncRes.json().catch(() => ({}));
            syncError = err.error || "Erro na resposta do backend";
          }
        } catch (e: any) {
          syncError = e?.message || "Falha de conexão";
        }

        filesFound.push({
          accountName: accName,
          realm: realmName,
          characterName: charName,
          filePath: item.relativePath,
          fileName: item.fileName,
          fileSize: file.size,
          lastModified: new Date(file.lastModified).toLocaleString(),
          rawContent: text,
          dryRunReport: dryRun,
          importedToDb: imported,
          syncError,
        });
      }
    } catch (err: any) {
      console.warn("Aviso ao processar arquivo:", item.relativePath, err);
    }
  }

  const { accountGroups, totalCharacters, totalGold } = buildAccountGroups(filesFound);
  const accountsList = Array.from(accountsFound);
  const success = filesFound.length > 0;
  const message = success
    ? `Varredura concluída! ${filesFound.length} arquivo(s) de SavedVariables localizados através das pastas e subpastas, ${accountGroups.length} conta(s) mapeadas e ${totalCharacters} personagem(ns) sincronizados com o banco de dados!`
    : `Varredura concluída em '${rootHandle?.name || "diretório"}'. Nenhum arquivo de SavedVariables do addon (HaleckAccountImporter.lua, HaleckAccountImporterCharDB.lua, ForeverStatistics.lua) foi encontrado nas pastas e subpastas.`;

  return {
    success,
    rootFolderName: rootHandle?.name || "World of Warcraft",
    rootFolderPath: customRootPath,
    detectedFlavor: flavor,
    detectedFlavorLabel: flavorLabel,
    scannedAt: new Date().toLocaleTimeString(),
    accountsFound: accountsList,
    accountGroups,
    filesFound,
    totalCharactersImported: totalCharacters,
    totalGoldAggregated: totalGold,
    message,
  };
}

/**
 * Searches a FileList or array of Files (from <input webkitdirectory />)
 * Recursively scans through all folders and subfolders.
 * Works seamlessly in all environments, including cross-origin iframes.
 */
export async function scanAndImportWoWFiles(
  files: FileList | File[],
  customRootPath?: string
): Promise<WoWScanResult> {
  const fileArray = Array.from(files);
  const accountsFound = new Set<string>();
  const filesFound: ScannedSavedVariableFile[] = [];

  let detectedFlavor: "forever_beta" | "classic_era" | "retail" | "custom" = "forever_beta";
  let detectedFlavorLabel = "WoW Forever Beta (_classic_beta_)";
  let rootFolderName = "World of Warcraft";

  for (const file of fileArray) {
    const relPath = (file as any).webkitRelativePath || file.name || "";
    const normalized = relPath.replace(/\\/g, "/");
    const lower = normalized.toLowerCase();
    const fileName = file.name.toLowerCase();

    // Detect root folder
    const parts = normalized.split("/");
    if (parts.length > 0 && !rootFolderName) {
      rootFolderName = parts[0];
    }

    if (lower.includes("_classic_beta_")) {
      detectedFlavor = "forever_beta";
      detectedFlavorLabel = "WoW Forever Beta (_classic_beta_)";
    } else if (lower.includes("_classic_era_")) {
      detectedFlavor = "classic_era";
      detectedFlavorLabel = "WoW Classic Era (_classic_era_)";
    } else if (lower.includes("_retail_")) {
      detectedFlavor = "retail";
      detectedFlavorLabel = "WoW Retail (_retail_)";
    }

    // Match any target addon file in any subfolder:
    // HaleckAccountImporter.lua, HaleckAccountImporter.lua.bak, HaleckAccountImporterCharDB.lua,
    // HaleckAccountImporter_Snapshot.json, ForeverStatistics.lua, ForeverJourney.lua
    const isTargetFile =
      fileName.includes("haleck") ||
      fileName.includes("accountimporter") ||
      fileName.includes("foreverstatistics") ||
      fileName.includes("foreverjourney") ||
      fileName.includes("foreverchronicle") ||
      (lower.includes("savedvariables") && (fileName.endsWith(".lua") || fileName.endsWith(".json")));
    const isTargetExt =
      fileName.endsWith(".lua") ||
      fileName.endsWith(".lua.bak") ||
      fileName.endsWith(".json");

    if (isTargetFile && isTargetExt) {
      let accName = "Conta Padrão";
      let realmName: string | undefined;
      let charName: string | undefined;

      const accountIdx = parts.findIndex((p) => p.toLowerCase() === "account");
      if (accountIdx !== -1 && parts[accountIdx + 1]) {
        accName = parts[accountIdx + 1];
        if (parts[accountIdx + 2] && parts[accountIdx + 2].toLowerCase() !== "savedvariables") {
          realmName = parts[accountIdx + 2];
          if (parts[accountIdx + 3] && parts[accountIdx + 3].toLowerCase() !== "savedvariables") {
            charName = parts[accountIdx + 3];
          }
        }
      }

      accountsFound.add(accName);

      try {
        const text = await file.text();
        if (text && text.trim().length > 10) {
          const dryRun = performSavedVariablesDryRun(text);

          if (!charName && dryRun.characterName && dryRun.characterName !== "Personagem Desconhecido") {
            charName = dryRun.characterName;
          }
          if (!realmName && dryRun.parsedProfile?.realm) {
            realmName = dryRun.parsedProfile.realm;
          }

          let imported = false;
          let syncError: string | undefined;

          try {
            const syncRes = await fetch("/api/blizzard/wow/addon-sync", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ rawLua: text }),
            });
            if (syncRes.ok) {
              imported = true;
              const syncJson = await syncRes.json().catch(() => ({}));
              if (syncJson?.character && (!charName || charName === "Personagem Desconhecido")) {
                charName = syncJson.character;
              }
              if (syncJson?.realm && (!realmName || realmName === "WoW Forever (Beta)")) {
                realmName = syncJson.realm;
              }
            } else {
              const err = await syncRes.json().catch(() => ({}));
              syncError = err.error || "Erro na resposta do backend";
            }
          } catch (e: any) {
            syncError = e?.message || "Falha de conexão";
          }

          filesFound.push({
            accountName: accName,
            realm: realmName,
            characterName: charName,
            filePath: normalized,
            fileName: file.name,
            fileSize: file.size,
            lastModified: new Date(file.lastModified).toLocaleString(),
            rawContent: text,
            dryRunReport: dryRun,
            importedToDb: imported,
            syncError,
          });
        }
      } catch (err: any) {
        console.warn("Erro ao ler arquivo:", relPath, err);
      }
    }
  }

  const { accountGroups, totalCharacters, totalGold } = buildAccountGroups(filesFound);
  const accountsList = Array.from(accountsFound);
  const success = filesFound.length > 0;
  const message = success
    ? `Varredura concluída! ${filesFound.length} arquivo(s) de SavedVariables encontrados através das pastas e subpastas, ${accountGroups.length} conta(s) mapeadas e ${totalCharacters} heróis sincronizados com o banco de dados!`
    : `Varredura realizada em ${fileArray.length} arquivo(s). Nenhum arquivo SavedVariables de HaleckAccountImporter foi localizado através das pastas e subpastas selecionadas.`;

  return {
    success,
    rootFolderName,
    rootFolderPath: customRootPath,
    detectedFlavor,
    detectedFlavorLabel,
    scannedAt: new Date().toLocaleTimeString(),
    accountsFound: accountsList,
    accountGroups,
    filesFound,
    totalCharactersImported: totalCharacters,
    totalGoldAggregated: totalGold,
    message,
  };
}
