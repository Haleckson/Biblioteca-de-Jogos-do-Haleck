import { uploadToImgBB } from "./imgbb";
import { uploadVideoToYoutube } from "./youtube";
import {
  isDriveAuthenticated,
  signInWithGoogleDrive,
  uploadSingleMediaBackup,
  isPopupCancelledOrClosedError,
  isYouTubeAuthenticated,
  signInWithYouTube,
} from "./googleDrive";
import { Game, MediaItem } from "../types";
import { showToast } from "./toast";
import { saveFailedUploadLog } from "./failedUploadLogs";
import { isVideoFile } from "./mediaUtils";
import { addBackupLog } from "./backupAuditLog";

export interface FileTaskItem {
  file: File;
  tempMediaId: string;
  isVideo: boolean;
  gridPosition?: number;
  status: "pending" | "uploading" | "completed" | "error";
}

export type BatchTaskType = "media_upload" | "drive_backup";

export interface UploadBatchTask {
  id: string;
  type?: BatchTaskType;
  gameId: string;
  gameName: string;
  entryId: string;
  entryTitle?: string;
  items: FileTaskItem[];
  totalCount: number;
  completedCount: number;
  currentFileName: string;
  status: "pending" | "uploading" | "paused" | "completed" | "error" | "cancelled";
  errorMessage?: string;
  createdAt: number;
  abortController?: AbortController;
}

type QueueListener = (tasks: UploadBatchTask[]) => void;
type GameUpdateCallback = (gameId: string, updateFn: (prevGame: Game) => Game) => void;
type ItemCompletionCallback = (entryId: string, tempMediaId: string, finalUrl: string, deleteUrl: string) => void;

class MediaUploadQueueManager {
  private tasks: UploadBatchTask[] = [];
  private listeners: Set<QueueListener> = new Set();
  private itemCompletionListeners: Set<ItemCompletionCallback> = new Set();
  private isProcessing = false;
  private isPaused = false;
  private gameUpdateCallback: GameUpdateCallback | null = null;

  public setGameUpdateCallback(cb: GameUpdateCallback) {
    this.gameUpdateCallback = cb;
  }

  public onItemCompleted(cb: ItemCompletionCallback): () => void {
    this.itemCompletionListeners.add(cb);
    return () => {
      this.itemCompletionListeners.delete(cb);
    };
  }

  public subscribe(listener: QueueListener): () => void {
    this.listeners.add(listener);
    listener([...this.tasks]);
    return () => {
      this.listeners.delete(listener);
    };
  }

  private notify() {
    const copy = [...this.tasks];
    this.listeners.forEach((l) => l(copy));
  }

  public getTasks(): UploadBatchTask[] {
    return [...this.tasks];
  }

  public getIsPaused(): boolean {
    return this.isPaused;
  }

  public pauseQueue() {
    this.isPaused = true;
    const activeTask = this.tasks.find((t) => t.status === "uploading" || t.status === "pending");
    if (activeTask) {
      activeTask.status = "paused";
    }
    this.notify();
  }

  public resumeQueue() {
    this.isPaused = false;
    const pausedTask = this.tasks.find((t) => t.status === "paused");
    if (pausedTask) {
      pausedTask.status = "pending";
    }
    this.notify();
    this.processNext();
  }

  public togglePauseQueue() {
    if (this.isPaused) {
      this.resumeQueue();
    } else {
      this.pauseQueue();
    }
  }

  public cancelTask(taskId: string) {
    const taskIndex = this.tasks.findIndex((t) => t.id === taskId);
    if (taskIndex !== -1) {
      const task = this.tasks[taskIndex];
      if (task.abortController) {
        try {
          task.abortController.abort();
        } catch {
          // ignore
        }
      }
      task.status = "cancelled";
      this.tasks.splice(taskIndex, 1);
      this.notify();
    }
    if (!this.isProcessing && !this.isPaused) {
      this.processNext();
    }
  }

  public cancelAllTasks() {
    this.tasks.forEach((t) => {
      if (t.abortController) {
        try {
          t.abortController.abort();
        } catch {
          // ignore
        }
      }
      t.status = "cancelled";
    });
    this.tasks = [];
    this.isPaused = false;
    this.notify();
  }

  public startDriveBackupTask(params: {
    id: string;
    gameCount: number;
    abortController?: AbortController;
  }): UploadBatchTask {
    // Remove any previous drive backup tasks if completed or canceled
    this.tasks = this.tasks.filter((t) => t.type !== "drive_backup" || t.status === "uploading" || t.status === "pending");

    const newTask: UploadBatchTask = {
      id: params.id,
      type: "drive_backup",
      gameId: "google_drive",
      gameName: "Backup Google Drive",
      entryId: "",
      items: [],
      totalCount: params.gameCount || 1,
      completedCount: 0,
      currentFileName: "Iniciando backup no Google Drive...",
      status: "uploading",
      createdAt: Date.now(),
      abortController: params.abortController,
    };

    this.tasks.push(newTask);
    this.notify();
    return newTask;
  }

  public updateDriveBackupProgress(params: {
    id: string;
    completedCount: number;
    totalCount: number;
    currentMessage: string;
  }) {
    const task = this.tasks.find((t) => t.id === params.id && t.type === "drive_backup");
    if (task) {
      task.completedCount = params.completedCount;
      if (params.totalCount > 0) task.totalCount = params.totalCount;
      task.currentFileName = params.currentMessage;
      task.status = "uploading";
      this.notify();
    }
  }

  public finishDriveBackupTask(id: string, errorMessage?: string) {
    const task = this.tasks.find((t) => t.id === id && t.type === "drive_backup");
    if (task) {
      if (errorMessage) {
        task.status = "error";
        task.errorMessage = errorMessage;
        task.currentFileName = `Erro no backup: ${errorMessage}`;
      } else {
        task.status = "completed";
        task.completedCount = task.totalCount;
        task.currentFileName = "Backup do Google Drive concluído com sucesso!";
      }
      this.notify();

      setTimeout(() => {
        this.tasks = this.tasks.filter((t) => t.id !== id);
        this.notify();
      }, 5000);
    }
  }

  public enqueueBatch(params: {
    gameId: string;
    gameName: string;
    entryId: string;
    entryTitle?: string;
    files: Array<{ file: File; tempMediaId: string; isVideo: boolean; gridPosition?: number }>;
  }): UploadBatchTask {
    const batchId = `batch_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    
    const items: FileTaskItem[] = params.files.map((f, idx) => ({
      file: f.file,
      tempMediaId: f.tempMediaId,
      isVideo: f.isVideo || isVideoFile(f.file),
      gridPosition: f.gridPosition || (idx + 1),
      status: "pending",
    }));

    const abortController = new AbortController();

    const newTask: UploadBatchTask = {
      id: batchId,
      gameId: params.gameId,
      gameName: params.gameName,
      entryId: params.entryId,
      entryTitle: params.entryTitle,
      items,
      totalCount: items.length,
      completedCount: 0,
      currentFileName: items[0]?.file.name || "",
      status: this.isPaused ? "paused" : "pending",
      createdAt: Date.now(),
      abortController,
    };

    this.tasks.push(newTask);
    this.notify();

    // Trigger queue processing asynchronously
    if (!this.isPaused) {
      this.processNext();
    }

    return newTask;
  }

  private async checkPauseAndAbort(task: UploadBatchTask) {
    while (this.isPaused || task.status === "paused") {
      if (
        task.status === "cancelled" ||
        task.abortController?.signal.aborted ||
        !this.tasks.some((t) => t.id === task.id)
      ) {
        throw new DOMException("Tarefa cancelada pelo usuário", "AbortError");
      }
      await new Promise((r) => setTimeout(r, 400));
    }
    if (
      task.status === "cancelled" ||
      task.abortController?.signal.aborted ||
      !this.tasks.some((t) => t.id === task.id)
    ) {
      throw new DOMException("Tarefa cancelada pelo usuário", "AbortError");
    }
  }

  private async processNext() {
    if (this.isProcessing) return;

    const currentTask = this.tasks.find((t) => t.status === "pending" || t.status === "uploading" || t.status === "paused");
    if (!currentTask) {
      this.isProcessing = false;
      return;
    }

    if (this.isPaused || currentTask.status === "paused") {
      this.isProcessing = false;
      currentTask.status = "paused";
      this.notify();
      return;
    }

    this.isProcessing = true;
    currentTask.status = "uploading";
    this.notify();

    try {
      for (let i = 0; i < currentTask.items.length; i++) {
        await this.checkPauseAndAbort(currentTask);

        const item = currentTask.items[i];
        if (item.status === "completed") continue;

        currentTask.currentFileName = item.file.name;
        item.status = "uploading";
        this.notify();

        let finalUrl = "";
        let finalDeleteUrl = "";
        let finalType: "image" | "video" = "image";

        if (item.isVideo) {
          finalType = "video";
          currentTask.currentFileName = `${item.file.name} - Preparando envio de vídeo para o YouTube...`;
          this.notify();

          // Auto-prompt for YouTube login if user is not authenticated
          if (!isYouTubeAuthenticated()) {
            try {
              currentTask.currentFileName = `${item.file.name} - Solicitando autorização no YouTube/Google...`;
              this.notify();
              await signInWithYouTube();
            } catch (authErr: any) {
              if (isPopupCancelledOrClosedError(authErr)) {
                throw new Error("Upload de vídeo cancelado: a janela de autorização do YouTube foi fechada.");
              }
              throw new Error(`Autorização no YouTube necessária para o upload do vídeo: ${authErr.message || authErr}`);
            }
          }

          await this.checkPauseAndAbort(currentTask);

          const gridPos = item.gridPosition || (i + 1);
          const ytResult = await uploadVideoToYoutube(
            item.file,
            currentTask.gameName,
            currentTask.entryTitle || `Entrada (${new Date().toLocaleDateString("pt-BR")})`,
            gridPos,
            (statusMsg) => {
              currentTask.currentFileName = `${item.file.name} (${statusMsg})`;
              this.notify();
            },
            currentTask.abortController?.signal
          );
          finalUrl = typeof ytResult === "string" ? ytResult : ((ytResult as any)?.videoUrl || "");

          addBackupLog({
            provider: "YouTube",
            action: "Upload Vídeo e Playlist",
            status: "success",
            gameName: currentTask.gameName,
            details: `Vídeo ${item.file.name} enviado. URL: ${finalUrl}${ytResult?.playlistUrl ? ` | Playlist: ${ytResult.playlistUrl}` : ""}`
          });

          // Show Toast notification when video backup finishes
          const playlistText = (ytResult as any)?.playlistUrl ? ` Playlist do Jogo: ${(ytResult as any).playlistUrl}` : "";
          showToast({
            title: "🎬 Vídeo do Diário Concluído!",
            message: `O vídeo de "${currentTask.gameName}" foi publicado no YouTube com sucesso!${playlistText}`,
            type: "success",
            duration: 8000,
          });
        } else {
          finalType = "image";
          const isWebPFile = item.file.type === "image/webp" || item.file.name.toLowerCase().endsWith(".webp");
          
          if (!isWebPFile) {
            currentTask.currentFileName = `${item.file.name} - Convertendo imagem para WebP (100% de qualidade, resolução original)...`;
          } else {
            currentTask.currentFileName = `${item.file.name} - Preservando qualidade WebP original sem redução...`;
          }
          this.notify();

          const fileNameParam = `${currentTask.gameName}_diario_${Date.now()}`;
          let res = null;
          let uploadErr = null;

          for (let uploadAttempt = 1; uploadAttempt <= 3; uploadAttempt++) {
            await this.checkPauseAndAbort(currentTask);
            try {
              currentTask.currentFileName = `${item.file.name} - Enviando para hospedagem ImgBB (tentativa ${uploadAttempt}/3)...`;
              this.notify();

              res = await uploadToImgBB(item.file, fileNameParam, uploadAttempt, 3, currentTask.abortController?.signal);
              if (res?.url) break;
            } catch (e) {
              uploadErr = e;
              if (uploadAttempt < 3) {
                await new Promise((r) => setTimeout(r, 2000 * uploadAttempt));
              }
            }
          }

          await this.checkPauseAndAbort(currentTask);

          if (!res?.url) {
            addBackupLog({
              provider: "ImgBB",
              action: "Upload Imagem Mídia",
              status: "error",
              gameName: currentTask.gameName,
              details: `Falha ao enviar ${item.file.name} para ImgBB.`
            });
            throw uploadErr || new Error("Falha ao enviar imagem para o ImgBB");
          }

          finalUrl = res.url;
          finalDeleteUrl = res.deleteUrl || "";

          addBackupLog({
            provider: "ImgBB",
            action: "Upload Imagem Mídia",
            status: "success",
            gameName: currentTask.gameName,
            details: `Imagem ${item.file.name} enviada ao ImgBB (${(item.file.size / 1024).toFixed(1)} KB)`
          });

          currentTask.currentFileName = `${item.file.name} - URL direta ImgBB gerada (${finalUrl.substring(0, 30)}...)`;
          this.notify();
        }

        item.status = "completed";
        currentTask.completedCount++;

        // Notify active form listeners if form is open
        if (finalUrl) {
          this.itemCompletionListeners.forEach((cb) => {
            try {
              cb(currentTask.entryId, item.tempMediaId, finalUrl, finalDeleteUrl);
            } catch (e) {
              console.error("Erro no listener onItemCompleted:", e);
            }
          });
        }

        // Send single media backup to Google Drive asynchronously if authenticated
        if (isDriveAuthenticated()) {
          try {
            await uploadSingleMediaBackup(
              item.isVideo ? finalUrl : item.file,
              "diary",
              item.file.name,
              currentTask.gameName,
              {
                entryId: currentTask.entryId,
                period: currentTask.entryTitle || "",
                mediaIndex: item.gridPosition || (i + 1),
              },
              currentTask.abortController?.signal
            );
          } catch (driveErr) {
            console.warn("Aviso: Falha ao enviar backup de mídia para o Google Drive:", driveErr);
          }
        }

        // Update the game state globally replacing the temp media blob/base64 URL with finalUrl, auto-saving into entry
        if (this.gameUpdateCallback && finalUrl) {
          this.gameUpdateCallback(currentTask.gameId, (prevGame) => {
            let entryFound = false;
            const updatedEntries = (prevGame.diary || []).map((entry) => {
              if (entry.id !== currentTask.entryId) return entry;
              entryFound = true;
              const updatedMedias = [...(entry.medias || [])];
              const matchIndex = updatedMedias.findIndex(
                (m) =>
                  m.id === item.tempMediaId ||
                  m.src === item.tempMediaId ||
                  (m.src && item.tempMediaId && m.src.includes(item.tempMediaId))
              );

              if (matchIndex !== -1) {
                updatedMedias[matchIndex] = {
                  ...updatedMedias[matchIndex],
                  src: finalUrl,
                  deleteUrl: finalDeleteUrl || updatedMedias[matchIndex].deleteUrl,
                  isVideo: finalType === "video",
                };
              } else {
                updatedMedias.push({
                  id: item.tempMediaId,
                  src: finalUrl,
                  deleteUrl: finalDeleteUrl,
                  isVideo: finalType === "video",
                });
              }
              return { ...entry, medias: updatedMedias };
            });

            // If entry does not exist yet in saved game.diary, append auto-saved entry so uploaded media is immediately persistent
            if (!entryFound) {
              updatedEntries.push({
                id: currentTask.entryId,
                period: new Date().toLocaleDateString("pt-BR"),
                text: "",
                medias: [
                  {
                    id: item.tempMediaId,
                    src: finalUrl,
                    deleteUrl: finalDeleteUrl,
                    isVideo: finalType === "video",
                  },
                ],
              });
            }

            return { ...prevGame, diary: updatedEntries };
          });
        }
      }

      const failedItems = currentTask.items.filter((i) => i.status === "error");
      if (failedItems.length > 0) {
        showToast({
          title: "⚠️ Falha de Upload em Lote",
          message: `${failedItems.length} de ${currentTask.totalCount} mídias falharam ao enviar para "${currentTask.gameName}". As enviadas com sucesso foram mantidas no cache.`,
          type: "error",
          duration: 7000,
        });
      } else if (currentTask.totalCount > 0) {
        showToast({
          title: "Uploads Concluídos",
          message: `${currentTask.totalCount} mídia(s) de "${currentTask.gameName}" enviadas e vinculadas com sucesso!`,
          type: "success",
          duration: 4500,
        });
      }

      currentTask.status = "completed";
      this.notify();

      // Auto remove completed task after 5 seconds
      setTimeout(() => {
        this.tasks = this.tasks.filter((t) => t.id !== currentTask.id);
        this.notify();
      }, 5000);
    } catch (err: any) {
      if (err.name === "AbortError" || String(err).includes("cancel")) {
        console.log(`Tarefa ${currentTask.id} cancelada.`);
        showToast({
          title: "Tarefa Cancelada",
          message: `O envio das mídias de "${currentTask.gameName}" foi cancelado pelo usuário.`,
          type: "info",
          duration: 4000,
        });
      } else {
        console.error(`Erro ao processar lote ${currentTask.id}:`, err);
      }
    } finally {
      this.isProcessing = false;
      this.processNext();
    }
  }
}

export const mediaUploadQueueManager = new MediaUploadQueueManager();
