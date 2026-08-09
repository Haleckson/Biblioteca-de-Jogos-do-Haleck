import { Game } from "../types";
import { getDriveAccessToken, getOrCreateFolder, listFilesAndFoldersInParent } from "./googleDrive";
import { ref, get } from "firebase/database";
import { db } from "./firebase";
import { getFailedUploadLogs } from "./failedUploadLogs";
import { isPcPlatform } from "./steamApi";

export interface DiagnosticResult {
  timestamp: string;
  localGamesCount: number;
  firebaseGamesCount?: number;
  driveFoldersCount?: number;
  discrepancies: Array<{
    type: "missing_in_firebase" | "missing_in_drive" | "orphaned_in_drive" | "media_mismatch";
    gameId?: string;
    gameName?: string;
    details: string;
  }>;
  summary: string;
}

/**
 * Performs a diagnostic cross-reference audit between:
 * 1. Local game database (state/localStorage)
 * 2. Firebase Database state (if authenticated)
 * 3. Google Drive folder structure (if authenticated)
 */
export async function runSyncDiagnostic(localGames: Game[]): Promise<DiagnosticResult> {
  const result: DiagnosticResult = {
    timestamp: new Date().toLocaleString("pt-BR"),
    localGamesCount: localGames.length,
    discrepancies: [],
    summary: "",
  };

  console.group("🔍 [Diagnostic Sync Audit] Initiating cross-reference inspection...");
  console.log(`• Local Games Database: ${localGames.length} record(s)`);

  // 1. Audit Firebase Realtime Database
  if (db) {
    try {
      const libraryRef = ref(db, "library");
      const snap = await get(libraryRef);
      if (snap.exists()) {
        const fbData = snap.val();
        const fbGames = (fbData.games || []) as Game[];
        result.firebaseGamesCount = fbGames.length;
        console.log(`• Firebase State: ${fbGames.length} record(s)`);

        const fbGameIds = new Set(fbGames.map((g) => g.id));

        // Local vs Firebase
        localGames.forEach((g) => {
          if (!fbGameIds.has(g.id)) {
            result.discrepancies.push({
              type: "missing_in_firebase",
              gameId: g.id,
              gameName: g.name,
              details: `Jogo "${g.name}" existe localmente, mas não foi encontrado no Firebase.`,
            });
          }
        });
      }
    } catch (err: any) {
      console.warn("• Firebase Diagnostic Warning:", err?.message || err);
    }
  }

  // 2. Audit Google Drive
  const isDriveFlagConnected = localStorage.getItem("google_drive_connected") === "true";
  const driveToken = getDriveAccessToken();

  if (driveToken || isDriveFlagConnected) {
    try {
      const rootFolderId = await getOrCreateFolder("Biblioteca_Jogos_Backup");
      const driveItems = await listFilesAndFoldersInParent(rootFolderId);

      // Check master json file
      const hasMasterJson = driveItems.some((item) => item.name === "dados_biblioteca.json");
      if (!hasMasterJson) {
        result.discrepancies.push({
          type: "media_mismatch",
          details: "O arquivo principal 'dados_biblioteca.json' não foi encontrado na pasta raiz do Google Drive.",
        });
      }

      const gameFolders = driveItems.filter(
        (item) =>
          item.mimeType === "application/vnd.google-apps.folder" &&
          !["Capas_Temp", "Icones_Temp", "Diario_Temp"].includes(item.name)
      );

      result.driveFoldersCount = gameFolders.length;
      console.log(`• Google Drive Folders Found: ${gameFolders.length}`);

      const localNamesSet = new Set(localGames.map((g) => g.name.trim().toLowerCase()));
      const driveFolderMap = new Map(gameFolders.map((f) => [f.name.trim().toLowerCase(), f]));

      // Check orphaned folders in Drive
      gameFolders.forEach((folder) => {
        if (!localNamesSet.has(folder.name.trim().toLowerCase())) {
          result.discrepancies.push({
            type: "orphaned_in_drive",
            gameName: folder.name,
            details: `A pasta "${folder.name}" existe no Google Drive, mas o jogo correspondente não existe na biblioteca local.`,
          });
        }
      });

      // Check missing game folders & inspect existing game folders in Drive
      for (const game of localGames) {
        const key = game.name.trim().toLowerCase();
        const driveFolder = driveFolderMap.get(key);

        if (!driveFolder) {
          result.discrepancies.push({
            type: "missing_in_drive",
            gameId: game.id,
            gameName: game.name,
            details: `A pasta de backup para "${game.name}" não foi encontrada no Google Drive.`,
          });
        } else {
          // Perform quick item verification inside game folder
          try {
            const folderItems = await listFilesAndFoldersInParent(driveFolder.id);
            const hasGameJson = folderItems.some((i) => i.name === "dados_jogo.json");
            const hasCover = folderItems.some((i) => i.name === "capa.webp");
            const hasIcon = folderItems.some((i) => i.name === "icone.webp");

            if (!hasGameJson) {
              result.discrepancies.push({
                type: "media_mismatch",
                gameId: game.id,
                gameName: game.name,
                details: `O arquivo metadados 'dados_jogo.json' de "${game.name}" está ausente no Google Drive.`,
              });
            }

            if (game.cover && !hasCover) {
              result.discrepancies.push({
                type: "media_mismatch",
                gameId: game.id,
                gameName: game.name,
                details: `A capa em formato WebP de "${game.name}" está ausente no Google Drive.`,
              });
            }

            if (game.icon && game.iconType === "upload" && !hasIcon) {
              result.discrepancies.push({
                type: "media_mismatch",
                gameId: game.id,
                gameName: game.name,
                details: `O ícone personalizado de "${game.name}" está ausente no Google Drive.`,
              });
            }
          } catch (folderErr: any) {
            console.warn(`Erro ao verificar pasta de "${game.name}":`, folderErr?.message || folderErr);
          }
        }
      }
    } catch (err: any) {
      console.warn("• Erro ao auditar Google Drive:", err?.message || err);
      result.discrepancies.push({
        type: "missing_in_drive",
        details: `Não foi possível auditar o Google Drive: ${err?.message || "Token de acesso expirado ou não autorizado. Clique em 'Conectar Google Drive' no menu."}`,
      });
    }
  } else {
    console.log("• Google Drive não está autenticado nesta sessão (ignorado na auditoria).");
  }

  // 3. Audit ImgBB / Media Failed Upload Logs
  const failedUploads = getFailedUploadLogs();
  if (failedUploads.length > 0) {
    result.discrepancies.push({
      type: "media_mismatch",
      details: `Existem ${failedUploads.length} arquivo(s) de mídia que falharam no envio para o ImgBB e necessitam de atenção. Verifique a lista de logs de erros abaixo.`,
    });
  }

  // 4. Audit PC/Steam Games for Steam App ID & Stats
  localGames.forEach((g) => {
    if (isPcPlatform(g.platform)) {
      if (!g.steamAppId) {
        result.discrepancies.push({
          type: "media_mismatch",
          gameId: g.id,
          gameName: g.name,
          details: `O jogo de PC "${g.name}" não possui um Steam App ID vinculado para sincronização automática de horas/conquistas.`,
        });
      } else if (g.steamPlaytimeMinutes === undefined) {
        result.discrepancies.push({
          type: "media_mismatch",
          gameId: g.id,
          gameName: g.name,
          details: `O jogo de PC "${g.name}" (App ID: ${g.steamAppId}) possui App ID, mas não possui o tempo de jogo na Steam registrado.`,
        });
      }
    }
  });

  const discrepancyCount = result.discrepancies.length;
  if (discrepancyCount === 0) {
    result.summary = `✅ Estado de Sincronia Perfeito! Todos os ${localGames.length} jogo(s) estão perfeitamente sincronizados.`;
  } else {
    result.summary = `⚠️ Auditoria concluída: ${discrepancyCount} inconsistência(s) identificada(s).`;
  }

  console.log(result.summary);
  console.groupEnd();

  return result;
}
