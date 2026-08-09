/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useMemo } from "react";
import { Game, DiaryEntry, MediaItem, splitEntities, getDlcMode, formatDateDisplay, getGameTrophies, getGameTrophyItems, parseProConTopic, parseContextNote } from "../types";
import { motion, AnimatePresence } from "motion/react";
import { X, Calendar, Clock, Star, Edit, FileText, Trash2, Plus, Film, Image as ImageIcon, ChevronDown, ChevronUp, Upload, Link2, BookOpen, RefreshCw, Loader2, Globe, ExternalLink, ZoomIn, ZoomOut, RotateCcw, ChevronLeft, ChevronRight, Mail, ArrowLeft, ArrowRight, Shield, Check, Move, Layers, Maximize2, ThumbsUp, ThumbsDown, Download, Play, Infinity, CheckSquare, Square, HardDrive, GripVertical, Gamepad2, Trophy, Search, Unlink, Sparkles, PartyPopper, DollarSign, Tag, Info, MoreHorizontal, Calculator } from "lucide-react";
import ImageZoomLightbox from "./ImageZoomLightbox";
import { chipClass, renderStars, renderIcon, getPlatformBadgeStyle } from "./GameCard";
import { uploadToImgBB, getAllCachedImgBBUrls } from "../utils/imgbb";
import { parseMassImgBBUrls, recoverAndReindexImgBBMedias } from "../utils/mediaRepair";
import { getYoutubeEmbedUrl, isYoutubeUrl, uploadVideoToYoutube } from "../utils/youtube";
import { YouTubeThumbnail } from "./YouTubeThumbnail";
import { isDriveAuthenticated, signInWithGoogleDrive } from "../utils/googleDrive";
import RichTextEditor from "./RichTextEditor";
import { DiaryMediaGrid } from "./DiaryMediaGrid";
import { formatHltbTime } from "../utils/hltbFormatter";
import { cleanHTMLText } from "../utils/htmlSanitizer";
import TrophyBadge, { TrophiesList } from "./TrophyBadge";
import { formatHoursAndMinutes, getTotalGamePlaytimeHours, getGameTimeBreakdown } from "../utils/playtime";
import { startLiveSessionForGame } from "./LiveSessionWidget";
import GameDictionaryModal from "./GameDictionaryModal";
import { getDictionaryWordCount, applyDictionaryToHtml } from "../utils/dictionaryUtils";
import { mediaUploadQueueManager } from "../utils/mediaUploadManager";
import { isVideoFile, isImageFile } from "../utils/mediaUtils";
import { useBodyScrollLock } from "../lib/bodyScrollLock";
import { fetchSteamAchievements, fetchSteamOwnedGames, formatSteamPlaytime, isPcPlatform, SteamAchievementsResult } from "../utils/steamApi";
import { showToast } from "../utils/toast";
import { moveToTrash } from "../utils/trashService";
import { exportGameDiaryToMarkdown, exportGameDiaryToPrintPDF } from "../utils/exportService";
import { addTrashItem } from "../utils/trashService";
import { playRetroSound } from "../utils/audioEffects";

const parsePeriodStartDate = (period: string): number => {
  try {
    const firstPart = period.split("~")[0].trim();
    const parts = firstPart.split("/");
    if (parts.length === 3) {
      const day = parseInt(parts[0], 10);
      const month = parseInt(parts[1], 10) - 1;
      const year = parseInt(parts[2], 10);
      return new Date(year, month, day).getTime();
    }
  } catch (err) {
    console.error("Error parsing period date:", err);
  }
  return 0;
};

const formatDate = (dateStr: string | undefined | null) => {
  return formatDateDisplay(dateStr) || "—";
};

interface GameDetailDrawerProps {
  game: Game | null;
  isOpen: boolean;
  onClose: () => void;
  onEditClick: (game: Game) => void;
  onDeleteGame: (gameId: string) => void;
  onSaveDiaryEntry: (gameId: string, entry: DiaryEntry) => void;
  onDeleteDiaryEntry: (gameId: string, entryId: string) => void;
  onDeleteMultipleDiaryEntries?: (gameId: string, entryIds: string[]) => void;
  triggerAlert: (title: string, message: string) => void;
  triggerConfirm: (title: string, message: string, callback: () => void) => void;
  isAdmin: boolean;
  onUpdateGame?: (updatedGame: Game) => void;
  onSendEmailClick?: (game: Game) => void;
  onOpenGameEstimateModal?: (game: Game) => void;
  onDeepBackupDrive?: (game: Game) => void;
  onOpenStorytelling?: (game: Game) => void;
  onOpenSocialCard?: (game: Game) => void;
  onRestoreGame?: (game: Game) => void;
  initialSelectedDiaryId?: string | null;
  initialOpenDictionary?: boolean;
}

interface ReadingModeResizableRowProps {
  entry: DiaryEntry;
  expandedMediaEntries: Record<string, boolean>;
  setExpandedMediaEntries: React.Dispatch<React.SetStateAction<Record<string, boolean>>>;
  handleOpenZoom: (url: string) => void;
  readingTextWidthPercent: number;
  setReadingTextWidthPercent: React.Dispatch<React.SetStateAction<number>>;
}

const ReadingModeResizableRow: React.FC<ReadingModeResizableRowProps> = ({
  entry,
  expandedMediaEntries,
  setExpandedMediaEntries,
  handleOpenZoom,
  readingTextWidthPercent,
  setReadingTextWidthPercent,
}) => {
  const containerRef = React.useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isLgScreen, setIsLgScreen] = useState(false);

  // Carrega a largura customizada para esta entrada específica no localStorage
  const getSavedWidth = (entryId: string): number => {
    try {
      if (entryId) {
        const saved = localStorage.getItem(`reading_width_entry_${entryId}`);
        if (saved) {
          const parsed = parseInt(saved, 10);
          if (!isNaN(parsed) && parsed >= 20 && parsed <= 80) {
            return parsed;
          }
        }
      }
    } catch (e) {
      console.warn("Erro ao ler largura da entrada no localStorage:", e);
    }
    return readingTextWidthPercent || 58;
  };

  const [rowWidthPercent, setRowWidthPercent] = useState<number>(() => getSavedWidth(entry.id));

  useEffect(() => {
    setRowWidthPercent(getSavedWidth(entry.id));
  }, [entry.id]);

  const updateWidth = (newPct: number) => {
    const rounded = Math.round(newPct);
    setRowWidthPercent(rounded);
    if (setReadingTextWidthPercent) {
      setReadingTextWidthPercent(rounded);
    }
    if (entry.id) {
      try {
        localStorage.setItem(`reading_width_entry_${entry.id}`, String(rounded));
      } catch (e) {
        console.warn("Erro ao salvar largura da entrada no localStorage:", e);
      }
    }
  };

  useEffect(() => {
    const checkLg = () => setIsLgScreen(window.innerWidth >= 1024);
    checkLg();
    window.addEventListener("resize", checkLg);
    return () => window.removeEventListener("resize", checkLg);
  }, []);

  const startDragging = (e: React.MouseEvent | React.TouchEvent) => {
    e.stopPropagation();
    setIsDragging(true);

    const handleMove = (clientX: number) => {
      if (!containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      if (rect.width <= 0) return;
      const offsetX = clientX - rect.left;
      const pct = (offsetX / rect.width) * 100;
      const clampedPct = Math.min(Math.max(pct, 25), 75);
      updateWidth(clampedPct);
    };

    const onMouseMove = (ev: MouseEvent) => {
      handleMove(ev.clientX);
    };

    const onTouchMove = (ev: TouchEvent) => {
      if (ev.touches[0]) {
        handleMove(ev.touches[0].clientX);
      }
    };

    const stopDragging = () => {
      setIsDragging(false);
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseup", stopDragging);
      window.removeEventListener("touchmove", onTouchMove);
      window.removeEventListener("touchend", stopDragging);
    };

    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseup", stopDragging);
    window.addEventListener("touchmove", onTouchMove);
    window.addEventListener("touchend", stopDragging);
  };

  const isExpanded = expandedMediaEntries[entry.id];
  const hasMedias = entry.medias && entry.medias.length > 0;

  if (!hasMedias) {
    return (
      <div className="mt-3 bg-zinc-900/50 p-5 border border-amber-500/20 rounded-2xl">
        <div
          className="text-sm sm:text-base text-zinc-100 leading-relaxed prose prose-invert prose-sm max-w-none break-words"
          dangerouslySetInnerHTML={{ __html: cleanHTMLText(entry.text) }}
        />
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className={`mt-4 flex flex-col lg:flex-row items-stretch gap-0 relative ${
        isDragging ? "select-none cursor-col-resize" : ""
      }`}
    >
      {/* Coluna da Esquerda: Texto da Jornada */}
      <div
        style={{
          flexBasis: isLgScreen ? `calc(${rowWidthPercent}% - 12px)` : "100%",
          width: isLgScreen ? `calc(${rowWidthPercent}% - 12px)` : "100%",
          flexShrink: 0,
        }}
        className={`bg-zinc-900/60 p-5 border border-amber-500/30 rounded-2xl shadow-lg backdrop-blur-md transition-all ${
          isExpanded ? "lg:sticky lg:top-4 max-h-[75vh] overflow-y-auto custom-scrollbar" : ""
        }`}
      >
        <div className="flex items-center justify-between gap-2 pb-2.5 mb-3 border-b border-zinc-800/80">
          <span className="text-[11px] font-mono font-extrabold uppercase tracking-widest text-amber-400 flex items-center gap-1.5">
            <BookOpen size={13} /> Texto da Jornada
          </span>
          <span className="text-[10px] font-mono text-zinc-400 bg-zinc-950 px-2 py-0.5 rounded border border-zinc-800">
            {isExpanded ? "Leitura Fixa" : "Jornada"}
          </span>
        </div>
        <div
          className="text-sm sm:text-base text-zinc-100 leading-relaxed prose prose-invert prose-sm max-w-none break-words"
          dangerouslySetInnerHTML={{ __html: cleanHTMLText(entry.text) }}
        />
      </div>

      {/* Divisória com Efeito Neon & Arraste Realtime */}
      <div
        onMouseDown={startDragging}
        onTouchStart={startDragging}
        onDoubleClick={() => updateWidth(58)}
        title="Clique e arraste para redimensionar colunas | Duplo clique para resetar (58/42)"
        className={`hidden lg:flex flex-col items-center justify-center w-6 cursor-col-resize group shrink-0 relative z-20 mx-0.5 select-none transition-all ${
          isDragging ? "opacity-100" : "opacity-75 hover:opacity-100"
        }`}
      >
        {/* Linha Divisória com Efeito Neon Amber */}
        <div
          className={`w-1 h-full rounded-full transition-all duration-150 ${
            isDragging
              ? "bg-amber-400 shadow-[0_0_14px_rgba(245,158,11,0.9)] scale-x-125"
              : "bg-zinc-800 group-hover:bg-amber-500/80 group-hover:shadow-[0_0_10px_rgba(245,158,11,0.5)]"
          }`}
        />

        {/* Botão de Pegada / Grip */}
        <div
          className={`absolute top-1/2 -translate-y-1/2 p-1 rounded-md border transition-all ${
            isDragging
              ? "bg-amber-500 text-zinc-950 border-amber-300 shadow-xl scale-125"
              : "bg-zinc-900 text-zinc-400 group-hover:text-amber-300 border-zinc-700 group-hover:border-amber-500/60 shadow-md"
          }`}
        >
          <GripVertical size={13} />
        </div>

        {/* Indicador Flutuante de Proporção ao Arrastar */}
        {isDragging && (
          <div className="absolute top-2 left-1/2 -translate-x-1/2 bg-amber-500 text-zinc-950 text-[10px] font-mono font-extrabold px-2 py-0.5 rounded-full shadow-lg whitespace-nowrap z-30">
            {rowWidthPercent}% / {100 - rowWidthPercent}%
          </div>
        )}
      </div>

      {/* Coluna da Direita: Mídias (Sempre à direita) */}
      <div
        style={{
          flexBasis: isLgScreen ? `calc(${100 - rowWidthPercent}% - 12px)` : "100%",
          width: isLgScreen ? `calc(${100 - rowWidthPercent}% - 12px)` : "100%",
          flexShrink: 0,
        }}
        className="mt-4 lg:mt-0 border border-amber-500/30 bg-zinc-950/90 rounded-2xl overflow-hidden shadow-xl p-4 self-start transition-all"
      >
        <div className="px-1 mb-3 flex items-center justify-between">
          <span className="text-xs font-bold font-mono text-cyan-400 uppercase tracking-widest flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse" />
            Mídias ({entry.medias.length})
          </span>
          {isExpanded ? (
            <button
              onClick={() => setExpandedMediaEntries((prev) => ({ ...prev, [entry.id]: false }))}
              className="text-[11px] font-mono font-bold text-amber-300 hover:text-amber-200 bg-amber-950/80 hover:bg-amber-900/90 px-2.5 py-1 rounded-lg border border-amber-500/50 transition-all flex items-center gap-1 cursor-pointer shadow-sm"
              title="Recolher galeria de mídias"
            >
              <ChevronUp size={13} /> Ocultar
            </button>
          ) : (
            <span className="text-[10px] font-mono text-amber-500/80 uppercase tracking-wider font-bold">
              Colapsado
            </span>
          )}
        </div>

        {isExpanded ? (
          <div className="bg-zinc-900/30 border border-zinc-900 rounded-xl p-2 max-h-[75vh] overflow-y-auto custom-scrollbar">
            <DiaryMediaGrid
              medias={entry.medias}
              handleOpenZoom={handleOpenZoom}
              readOnly={true}
            />
          </div>
        ) : (
          <div className="bg-zinc-900/40 p-4 rounded-xl border border-zinc-850/80 flex flex-col items-center justify-center text-center gap-3">
            <div className="flex items-center justify-center -space-x-2 my-1">
              {entry.medias.slice(0, 4).map((m, mIdx) => (
                <div
                  key={`mini-prev-${mIdx}`}
                  className="w-10 h-10 rounded-lg overflow-hidden border-2 border-zinc-900 bg-zinc-950 shadow-md shrink-0"
                >
                  <img src={m.src} alt="" className="w-full h-full object-cover opacity-75 hover:opacity-100 transition-opacity" />
                </div>
              ))}
              {entry.medias.length > 4 && (
                <div className="w-10 h-10 rounded-lg border-2 border-zinc-900 bg-zinc-900 flex items-center justify-center text-[10px] font-mono font-bold text-cyan-400 shadow-md">
                  +{entry.medias.length - 4}
                </div>
              )}
            </div>
            <p className="text-xs text-zinc-400 font-mono">
              {entry.medias.length} {entry.medias.length === 1 ? "mídia anexada" : "mídias anexadas"} nesta entrada.
            </p>
            <button
              onClick={() => setExpandedMediaEntries((prev) => ({ ...prev, [entry.id]: true }))}
              className="w-full py-2.5 px-3.5 rounded-xl bg-gradient-to-r from-amber-950/90 to-orange-950/90 hover:from-amber-900 hover:to-orange-900 border border-amber-500/50 hover:border-amber-400 text-amber-300 hover:text-amber-200 text-xs font-mono font-bold transition-all flex items-center justify-center gap-2 cursor-pointer shadow-md hover:scale-102 active:scale-98"
            >
              <ImageIcon size={14} className="text-amber-400" />
              <span>Exibir Mídias da Entrada</span>
              <ChevronDown size={14} />
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default function GameDetailDrawer({
  game: propGame,
  isOpen,
  onClose,
  onEditClick,
  onDeleteGame,
  onSaveDiaryEntry,
  onDeleteDiaryEntry,
  onDeleteMultipleDiaryEntries,
  triggerAlert,
  triggerConfirm,
  isAdmin,
  onUpdateGame,
  onSendEmailClick,
  onOpenGameEstimateModal,
  onDeepBackupDrive,
  onOpenStorytelling,
  onOpenSocialCard,
  onRestoreGame,
  initialSelectedDiaryId,
  initialOpenDictionary
}: GameDetailDrawerProps) {
  const [lastGame, setLastGame] = useState<Game | null>(null);

  useEffect(() => {
    if (propGame) {
      setLastGame(propGame);
    }
  }, [propGame]);

  const game = propGame || lastGame;

  useBodyScrollLock(isOpen);

  const [showAddDiary, setShowAddDiary] = useState(false);
  const [diaryStart, setDiaryStart] = useState("");
  const [diaryEnd, setDiaryEnd] = useState("");
  const [diaryText, setDiaryText] = useState("");
  const [diaryKeyMoments, setDiaryKeyMoments] = useState<string[]>([]);
  const [diaryScreenshotUrl, setDiaryScreenshotUrl] = useState("");
  const [tempDiaryMedias, setTempDiaryMedias] = useState<MediaItem[]>([]);
  const [isFormSelectionMode, setIsFormSelectionMode] = useState(false);
  const [selectedTempIndices, setSelectedTempIndices] = useState<Set<number>>(new Set());
  const [isEntrySelectionMode, setIsEntrySelectionMode] = useState(false);
  const [selectedEntryIds, setSelectedEntryIds] = useState<Set<string>>(new Set<string>());
  const [editingDiaryId, setEditingDiaryId] = useState<string | null>(null);
  const currentFormEntryId = React.useRef<string | null>(null);
  const [editDiaryMode, setEditDiaryMode] = useState<"text" | "full">("full");
  const [draggedMediaIndex, setDraggedMediaIndex] = useState<number | null>(null);
  const [dragOverMediaIndex, setDragOverMediaIndex] = useState<number | null>(null);
  const [isUploadingMedia, setIsUploadingMedia] = useState(false);
  const [isDragOverDiaryMedia, setIsDragOverDiaryMedia] = useState(false);
  const [uploadProgressText, setUploadProgressText] = useState("");
  const [uploadStats, setUploadStats] = useState<{ current: number; total: number; fileName: string; percent: number } | null>(null);
  const [zoomedImage, setZoomedImage] = useState<string | null>(null);
  const [zoomScale, setZoomScale] = useState(1);
  const [isIndexOpen, setIsIndexOpen] = useState(false);
  const [collapsedEntries, setCollapsedEntries] = useState<Record<string, boolean>>({});
  const [expandedMediaEntries, setExpandedMediaEntries] = useState<Record<string, boolean>>({});
  const [isDictionaryModalOpen, setIsDictionaryModalOpen] = useState(false);
  const [isReadingMode, setIsReadingMode] = useState(true);
  const [readingTextWidthPercent, setReadingTextWidthPercent] = useState<number>(58);
  const [isMoreMenuOpen, setIsMoreMenuOpen] = useState(false);

  const [isEditingPrice, setIsEditingPrice] = useState(false);
  const [priceInput, setPriceInput] = useState("");

  useEffect(() => {
    if (game) {
      setPriceInput(game.pricePaid !== undefined && game.pricePaid !== null ? String(game.pricePaid) : "");
    }
  }, [game?.id, game?.pricePaid]);

  const handleSavePriceInDrawer = () => {
    if (!isAdmin) {
      triggerAlert("Modo Admin Necessário", "É necessário ativar o Modo Admin (Editor) para alterar o valor pago.");
      return;
    }
    if (!game || !onUpdateGame) return;
    const cleaned = priceInput.replace(",", ".").replace(/[^0-9.]/g, "");
    const newPrice = cleaned !== "" ? parseFloat(cleaned) : undefined;
    onUpdateGame({
      ...game,
      pricePaid: newPrice,
    });
    setIsEditingPrice(false);
    showToast({ title: "Valor Pago Atualizado", message: "Valor pago atualizado com sucesso!", type: "success" });
  };

  // Auto expand and scroll to target diary entry or open dictionary if requested
  useEffect(() => {
    if (isOpen) {
      setIsReadingMode(true);
      setExpandedMediaEntries({});
      setIsAchievementsGalleryOpen(false);
      if (initialSelectedDiaryId) {
        setCollapsedEntries((prev) => ({ ...prev, [initialSelectedDiaryId]: false }));
        setTimeout(() => {
          const el = document.getElementById(`diary-entry-${initialSelectedDiaryId}`);
          if (el) {
            el.scrollIntoView({ behavior: "smooth", block: "center" });
          }
        }, 200);
      }
      if (initialOpenDictionary) {
        setIsDictionaryModalOpen(true);
      }
    } else {
      setIsReadingMode(false);
    }
  }, [isOpen, initialSelectedDiaryId, initialOpenDictionary]);

  useEffect(() => {
    const unsubscribe = mediaUploadQueueManager.onItemCompleted((_entryId, tempMediaId, finalUrl, deleteUrl) => {
      setTempDiaryMedias((prev) =>
        prev.map((m) => {
          if (m.id === tempMediaId || m.src === tempMediaId) {
            return { ...m, src: finalUrl, deleteUrl: deleteUrl || m.deleteUrl };
          }
          return m;
        })
      );
    });
    return unsubscribe;
  }, []);

  const sortedDiary = useMemo(() => {
    if (!game || !game.diary) return [];
    return [...game.diary].sort((a, b) => parsePeriodStartDate(a.period) - parsePeriodStartDate(b.period));
  }, [game?.diary]);

  const [controlsVisible, setControlsVisible] = useState(true);

  const allImages = useMemo(() => {
    if (!game) return [];
    const images: string[] = [];
    if (game.cover && !images.includes(game.cover)) {
      images.push(game.cover);
    }
    if ((game.iconType === "upload" || game.iconType === "url") && game.icon && game.icon.startsWith("http") && !images.includes(game.icon)) {
      images.push(game.icon);
    }
    if (game.diary) {
      sortedDiary.forEach((entry) => {
        if (entry.medias) {
          entry.medias.forEach((m) => {
            const isYt = isYoutubeUrl(m.src);
            if (!isYt && !m.isVideo && !images.includes(m.src)) {
              images.push(m.src);
            }
          });
        }
      });
    }
    return images;
  }, [sortedDiary, game]);

  const handleNextImage = () => {
    if (allImages.length <= 1 || !zoomedImage) return;
    const currentIndex = allImages.indexOf(zoomedImage);
    if (currentIndex === -1) return;
    const nextIndex = (currentIndex + 1) % allImages.length;
    setZoomScale(1);
    setZoomedImage(allImages[nextIndex]);
  };

  const handlePrevImage = () => {
    if (allImages.length <= 1 || !zoomedImage) return;
    const currentIndex = allImages.indexOf(zoomedImage);
    if (currentIndex === -1) return;
    const prevIndex = (currentIndex - 1 + allImages.length) % allImages.length;
    setZoomScale(1);
    setZoomedImage(allImages[prevIndex]);
  };

  useEffect(() => {
    if (!zoomedImage) {
      setControlsVisible(true);
      return;
    }

    let timeoutId: NodeJS.Timeout;

    const resetTimer = () => {
      setControlsVisible(true);
      clearTimeout(timeoutId);
      timeoutId = setTimeout(() => {
        setControlsVisible(false);
      }, 6000);
    };

    resetTimer();

    const handleMouseMove = () => {
      resetTimer();
    };

    const handleMouseDown = () => {
      resetTimer();
    };

    const handleTouchStart = () => {
      resetTimer();
    };

    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mousedown", handleMouseDown);
    window.addEventListener("touchstart", handleTouchStart);

    const handleKeyDown = (e: KeyboardEvent) => {
      resetTimer();
      if (e.key === "Escape") {
        setZoomedImage(null);
      } else if (e.key === "ArrowRight") {
        handleNextImage();
      } else if (e.key === "ArrowLeft") {
        handlePrevImage();
      }
    };

    window.addEventListener("keydown", handleKeyDown);

    return () => {
      clearTimeout(timeoutId);
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mousedown", handleMouseDown);
      window.removeEventListener("touchstart", handleTouchStart);
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [zoomedImage, allImages]);

  const handleOpenZoom = (src: string) => {
    setZoomScale(1);
    setControlsVisible(true);
    setZoomedImage(src);
  };

  const [coverPos, setCoverPos] = useState(50);
  const [coverPosX, setCoverPosX] = useState(50);
  const [coverZoom, setCoverZoom] = useState(100);
  const [isRepositioningCover, setIsRepositioningCover] = useState(false);
  const [showSavedCoverNotification, setShowSavedCoverNotification] = useState(false);
  const [isDragging, setIsDragging] = useState(false);

  const dragStartRef = React.useRef({
    startX: 0,
    startY: 0,
    startPosX: 50,
    startPosY: 50,
  });

  const coverPosRef = React.useRef(50);
  const coverPosXRef = React.useRef(50);
  const coverZoomRef = React.useRef(100);
  const coverContainerRef = React.useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (propGame) {
      const pos = propGame.coverPosition ?? 50;
      const posX = propGame.coverPositionX ?? 50;
      const zoom = propGame.coverZoom ?? 100;
      setCoverPos(pos);
      setCoverPosX(posX);
      setCoverZoom(zoom);
      coverPosRef.current = pos;
      coverPosXRef.current = posX;
      coverZoomRef.current = zoom;
      setIsIndexOpen(false);
    }
  }, [propGame?.id, propGame?.coverPosition, propGame?.coverPositionX, propGame?.coverZoom]);

  useEffect(() => {
    setIsRepositioningCover(false);
    setShowAddDiary(false);
    setDiaryStart("");
    setDiaryEnd("");
    setDiaryText("");
    setDiaryScreenshotUrl("");
    setTempDiaryMedias([]);
    setEditingDiaryId(null);
    currentFormEntryId.current = null;
    setSelectedTempIndices(new Set());
    setIsFormSelectionMode(false);
    setSelectedEntryIds(new Set());
    setIsEntrySelectionMode(false);
    setCelebrationData(null);
    setIsAchievementsGalleryOpen(false);
  }, [propGame?.id]);

  useEffect(() => {
    const el = coverContainerRef.current;
    if (!el) return;

    const onWheel = (e: WheelEvent) => {
      if (isRepositioningCover) {
        e.preventDefault();
        e.stopPropagation();
        const delta = e.deltaY < 0 ? 5 : -5;
        const nextZoom = Math.max(100, Math.min(300, coverZoomRef.current + delta));
        setCoverZoom(nextZoom);
        coverZoomRef.current = nextZoom;
        
        if (onUpdateGame && propGame) {
          onUpdateGame({
            ...propGame,
            coverZoom: nextZoom,
          } as any);
        }
      }
    };

    el.addEventListener("wheel", onWheel, { passive: false });
    return () => {
      el.removeEventListener("wheel", onWheel);
    };
  }, [isRepositioningCover, propGame, onUpdateGame]);

  const [isSyncingHltb, setIsSyncingHltb] = useState(false);
  const [isSyncingMetacritic, setIsSyncingMetacritic] = useState(false);
  const [drawerMetacriticPlatforms, setDrawerMetacriticPlatforms] = useState<{ code: string; name: string }[]>([]);
  const [selectedDrawerPlatform, setSelectedDrawerPlatform] = useState<string>("");

  const [steamAchieveData, setSteamAchieveData] = useState<SteamAchievementsResult | null>(null);
  const [celebrationData, setCelebrationData] = useState<{ diff: number; unlockedCount: number; totalCount: number; gameName: string } | null>(null);
  const [isSyncingSteamDrawer, setIsSyncingSteamDrawer] = useState(false);
  const [showSteamLinkPanel, setShowSteamLinkPanel] = useState(false);
  const [steamDrawerSearchInput, setSteamDrawerSearchInput] = useState("");
  const [drawerSteamOwnedGames, setDrawerSteamOwnedGames] = useState<any[]>([]);
  const [isFetchingDrawerOwnedGames, setIsFetchingDrawerOwnedGames] = useState(false);
  const [isLinkingSteamDrawer, setIsLinkingSteamDrawer] = useState(false);

  // Steam Achievements Gallery State
  const [achievementsFilter, setAchievementsFilter] = useState<"all" | "unlocked" | "locked" | "rare">("all");
  const [achievementsSort, setAchievementsSort] = useState<"unlocked_first" | "rare_first" | "recent">("unlocked_first");
  const [achievementsSearch, setAchievementsSearch] = useState("");
  const [isAchievementsGalleryOpen, setIsAchievementsGalleryOpen] = useState(false);

  // Process and filter Steam Achievements
  const processedAchievements = useMemo(() => {
    if (!steamAchieveData?.achievements) return [];

    let list = [...steamAchieveData.achievements];

    // Filter by search query
    if (achievementsSearch.trim()) {
      const q = achievementsSearch.toLowerCase().trim();
      list = list.filter(
        (a) => (a.name && a.name.toLowerCase().includes(q)) || (a.description && a.description.toLowerCase().includes(q))
      );
    }

    // Filter by tab
    if (achievementsFilter === "unlocked") {
      list = list.filter((a) => a.achieved === 1);
    } else if (achievementsFilter === "locked") {
      list = list.filter((a) => a.achieved === 0);
    } else if (achievementsFilter === "rare") {
      list = list.filter((a) => a.isUltraRare || (a.globalPercent !== undefined && a.globalPercent <= 10));
    }

    // Sort
    list.sort((a, b) => {
      if (achievementsSort === "unlocked_first") {
        if (a.achieved !== b.achieved) return b.achieved - a.achieved;
        return (b.unlocktime || 0) - (a.unlocktime || 0);
      }
      if (achievementsSort === "rare_first") {
        const percA = a.globalPercent !== undefined ? a.globalPercent : 100;
        const percB = b.globalPercent !== undefined ? b.globalPercent : 100;
        return percA - percB;
      }
      if (achievementsSort === "recent") {
        return (b.unlocktime || 0) - (a.unlocktime || 0);
      }
      return 0;
    });

    return list;
  }, [steamAchieveData, achievementsSearch, achievementsFilter, achievementsSort]);

  const handleFetchDrawerOwnedGames = async () => {
    if (drawerSteamOwnedGames.length > 0) return;
    setIsFetchingDrawerOwnedGames(true);
    try {
      const owned = await fetchSteamOwnedGames();
      setDrawerSteamOwnedGames(owned || []);
    } catch (e) {
      console.warn("Erro ao buscar jogos do usuário:", e);
    } finally {
      setIsFetchingDrawerOwnedGames(false);
    }
  };

  const handleLinkSteamAppIdInDrawer = async (appidInput: number | string) => {
    if (!isAdmin) {
      triggerAlert("Modo Admin Necessário", "É necessário ativar o Modo Admin (Editor) para vincular o jogo à Steam.");
      return;
    }
    if (!game || !onUpdateGame) return;
    setIsLinkingSteamDrawer(true);
    try {
      let numAppId = typeof appidInput === "number" ? appidInput : parseInt(String(appidInput).trim(), 10);

      if (isNaN(numAppId) || numAppId <= 0) {
        const match = String(appidInput).match(/app\/(\d+)/) || String(appidInput).match(/run\/(\d+)/) || String(appidInput).match(/^(\d+)$/);
        if (match) {
          numAppId = parseInt(match[1], 10);
        } else {
          // If searching by title in owned games list
          let list = drawerSteamOwnedGames;
          if (list.length === 0) {
            list = await fetchSteamOwnedGames();
            setDrawerSteamOwnedGames(list || []);
          }
          const matched = list.find((g) => g.name && g.name.toLowerCase().includes(String(appidInput).trim().toLowerCase()));
          if (matched) {
            numAppId = matched.appid;
          } else {
            throw new Error("Não foi possível identificar o App ID da Steam. Digite o número do App ID (ex: 39140) ou link da loja.");
          }
        }
      }

      let playtime: number | undefined = undefined;
      let lastPlayed: number | undefined = undefined;

      let list = drawerSteamOwnedGames;
      if (list.length === 0) {
        list = await fetchSteamOwnedGames();
        setDrawerSteamOwnedGames(list || []);
      }
      const match = list.find((g) => g.appid === numAppId || String(g.appid) === String(numAppId));
      if (match) {
        playtime = match.playtime_forever;
        lastPlayed = match.rtime_last_played;
      }

      let achCount: number | undefined = undefined;
      let achTotal: number | undefined = undefined;
      try {
        const ach = await fetchSteamAchievements(numAppId);
        setSteamAchieveData(ach);
        if (ach) {
          achCount = ach.unlockedCount;
          achTotal = ach.totalCount;
        }
      } catch (e) {
        console.warn("Erro ao buscar conquistas:", e);
      }

      const updatedGame: Game = {
        ...game,
        steamAppId: numAppId,
        steamPlaytimeMinutes: playtime !== undefined ? playtime : game.steamPlaytimeMinutes,
        steamLastPlayedTimestamp: lastPlayed !== undefined ? lastPlayed : game.steamLastPlayedTimestamp,
        steamAchievementsCount: achCount !== undefined ? achCount : game.steamAchievementsCount,
        steamAchievementsTotal: achTotal !== undefined ? achTotal : game.steamAchievementsTotal,
      };

      onUpdateGame(updatedGame);
      setShowSteamLinkPanel(false);
      setSteamDrawerSearchInput("");
      triggerAlert(
        "Vínculo Steam Salvo!",
        `"${game.name}" foi vinculado com sucesso ao Steam App ID ${numAppId}! ${playtime ? `(${formatSteamPlaytime(playtime)} gravadas)` : ""}`
      );
    } catch (err: any) {
      console.error(err);
      triggerAlert("Erro ao Vincular", err.message || "Erro ao vincular jogo à Steam.");
    } finally {
      setIsLinkingSteamDrawer(false);
    }
  };

  const handleUnlinkSteamInDrawer = () => {
    if (!isAdmin) {
      triggerAlert("Modo Admin Necessário", "É necessário ativar o Modo Admin (Editor) para desvincular o jogo da Steam.");
      return;
    }
    if (!game || !onUpdateGame) return;
    triggerConfirm(
      "Desvincular Steam",
      `Deseja remover o vínculo com a Steam do jogo "${game.name}"?`,
      () => {
        const updatedGame: Game = {
          ...game,
          steamAppId: undefined,
          steamPlaytimeMinutes: undefined,
          steamLastPlayedTimestamp: undefined,
          steamAchievementsCount: undefined,
          steamAchievementsTotal: undefined,
        };
        onUpdateGame(updatedGame);
        setSteamAchieveData(null);
        setShowSteamLinkPanel(false);
        triggerAlert("Vínculo Removido", `O jogo "${game.name}" foi desvinculado da Steam.`);
      }
    );
  };

  const handleSyncSteamInDrawer = async () => {
    if (!isAdmin) {
      triggerAlert("Modo Admin Necessário", "É necessário ativar o Modo Admin (Editor) para sincronizar dados da Steam.");
      return;
    }
    if (!game || !game.steamAppId) return;
    setIsSyncingSteamDrawer(true);
    try {
      const ownedList = await fetchSteamOwnedGames();
      const match = ownedList.find((g) => g.appid === game.steamAppId || String(g.appid) === String(game.steamAppId));
      let updatedGame = { ...game };
      if (match) {
        updatedGame.steamPlaytimeMinutes = match.playtime_forever;
        if (match.rtime_last_played) {
          updatedGame.steamLastPlayedTimestamp = match.rtime_last_played;
        }
      }
      const ach = await fetchSteamAchievements(game.steamAppId);
      setSteamAchieveData(ach);
      if (ach) {
        const prevCount = game.steamAchievementsCount;
        const currentCount = ach.unlockedCount;
        const totalCount = ach.totalCount;

        if (prevCount !== undefined && currentCount > prevCount) {
          const diff = currentCount - prevCount;
          showToast({
            title: "🏆 Novas Conquistas Desbloqueadas!",
            message: `Você conquistou +${diff} nova(s) conquista(s) em "${game.name}"!\nTotal: ${currentCount} / ${totalCount}`,
            type: "achievement",
            duration: 8000,
          });
          setCelebrationData({
            diff,
            unlockedCount: currentCount,
            totalCount,
            gameName: game.name,
          });
        }

        updatedGame.steamAchievementsCount = currentCount;
        updatedGame.steamAchievementsTotal = totalCount;
      }
      if (onUpdateGame) {
        onUpdateGame(updatedGame);
      }
      triggerAlert("Sincronização Steam Concluída", "Estatísticas, horas e conquistas da Steam atualizadas com sucesso!");
    } catch (err: any) {
      console.error(err);
      triggerAlert("Erro ao Sincronizar", "Não foi possível atualizar os dados da Steam.");
    } finally {
      setIsSyncingSteamDrawer(false);
    }
  };

  const handleCopySteamPlaytimeToPersonal = () => {
    if (!isAdmin) {
      triggerAlert("Modo Admin Necessário", "É necessário ativar o Modo Admin (Editor) para copiar as horas da Steam para o seu Tempo Investido Pessoal.");
      return;
    }
    if (!game || !game.steamPlaytimeMinutes || !onUpdateGame) return;
    const formatted = formatSteamPlaytime(game.steamPlaytimeMinutes);
    const updatedGame = {
      ...game,
      playtime: formatted,
    };
    onUpdateGame(updatedGame);
    triggerAlert("Tempo Atualizado", `O seu Tempo Investido pessoal foi definido para "${formatted}" (Horas da Steam).`);
  };

  const formatLastPlayedDate = (timestamp?: number) => {
    if (!timestamp || timestamp <= 0) return null;
    const date = new Date(timestamp * 1000);
    return date.toLocaleDateString("pt-BR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  useEffect(() => {
    if (game?.steamAppId && isOpen) {
      fetchSteamAchievements(game.steamAppId)
        .then((data) => {
          setSteamAchieveData(data);
          if (data && data.unlockedCount !== undefined) {
            const prevCount = game.steamAchievementsCount;
            const currentCount = data.unlockedCount;
            const totalCount = data.totalCount;

            if (prevCount !== undefined && currentCount > prevCount) {
              const diff = currentCount - prevCount;
              showToast({
                title: "🏆 Novas Conquistas Desbloqueadas!",
                message: `Você conquistou +${diff} nova(s) conquista(s) em "${game.name}" desde a última sincronização!\nTotal: ${currentCount} / ${totalCount} (${data.percentage}%)`,
                type: "achievement",
                duration: 8000,
              });
              setCelebrationData({
                diff,
                unlockedCount: currentCount,
                totalCount,
                gameName: game.name,
              });
              if (onUpdateGame) {
                onUpdateGame({
                  ...game,
                  steamAchievementsCount: currentCount,
                  steamAchievementsTotal: totalCount,
                });
              }
            } else if (prevCount === undefined) {
              if (onUpdateGame) {
                onUpdateGame({
                  ...game,
                  steamAchievementsCount: currentCount,
                  steamAchievementsTotal: totalCount,
                });
              }
            }
          }
        })
        .catch((err) => console.warn("Erro ao carregar conquistas Steam:", err));
    } else {
      setSteamAchieveData(null);
    }
  }, [game?.steamAppId, isOpen]);

  useEffect(() => {
    if (game && game.metacriticUrl && isOpen) {
      fetch(`/api/metacritic?url=${encodeURIComponent(game.metacriticUrl)}`)
        .then((res) => {
          if (!res.ok) return null;
          return res.json();
        })
        .then((data) => {
          if (data && data.platforms) {
            setDrawerMetacriticPlatforms(data.platforms);
            
            // Try matching game's selected platform
            let matchedPlatformCode = "";
            if (data.platforms.length > 0 && game.platform) {
              const platformLower = game.platform.toLowerCase();
              const found = data.platforms.find((p: any) => 
                p.name.toLowerCase().includes(platformLower) || 
                platformLower.includes(p.name.toLowerCase()) ||
                p.code.toLowerCase().includes(platformLower) ||
                platformLower.includes(p.code.toLowerCase())
              );
              if (found) {
                matchedPlatformCode = found.code;
              }
            }
            setSelectedDrawerPlatform(matchedPlatformCode || "");
          }
        })
        .catch((err) => {
          console.warn("Não foi possível obter plataformas no drawer:", err?.message || err);
        });
    } else {
      setDrawerMetacriticPlatforms([]);
      setSelectedDrawerPlatform("");
    }
  }, [game?.metacriticUrl, isOpen, game?.platform]);

  const handleSyncHltb = async () => {
    if (!isAdmin) {
      triggerAlert("Modo Admin Necessário", "É necessário ativar o Modo Admin (Editor) para atualizar os dados do HowLongToBeat.");
      return;
    }
    if (!game || !game.hltbId) {
      triggerAlert("ID ausente", "Não há um ID do HowLongToBeat associado a este jogo para atualizar.");
      return;
    }

    setIsSyncingHltb(true);
    try {
      const response = await fetch(`/api/hltb?url=${encodeURIComponent(game.hltbId)}`);
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `Servidor retornou erro: ${response.status}`);
      }
      const data = await response.json();
      
      if (onUpdateGame) {
        onUpdateGame({
          ...game,
          hltbMain: data.gameplayMain ? formatHltbTime(data.gameplayMain) : "",
          hltbExtra: data.gameplayMainExtra ? formatHltbTime(data.gameplayMainExtra) : "",
          hltbCompletionist: data.gameplayCompletionist ? formatHltbTime(data.gameplayCompletionist) : "",
          hltbId: data.id || game.hltbId
        });
        triggerAlert("Métricas Atualizadas", "As médias do HowLongToBeat foram atualizadas com sucesso!");
      }
    } catch (err: any) {
      console.error(err);
      triggerAlert("Erro ao atualizar", `Não foi possível atualizar dados: ${err.message || err}`);
    } finally {
      setIsSyncingHltb(false);
    }
  };

  const handleSyncMetacritic = async (customPlatformCode?: string) => {
    if (!isAdmin) {
      triggerAlert("Modo Admin Necessário", "É necessário ativar o Modo Admin (Editor) para atualizar as notas do Metacritic.");
      return;
    }
    if (!game || !game.metacriticUrl) {
      triggerAlert("Link ausente", "Não há um link do Metacritic associado a este jogo para atualizar.");
      return;
    }
    
    const targetPlatform = typeof customPlatformCode === "string" ? customPlatformCode : selectedDrawerPlatform;
    setIsSyncingMetacritic(true);
    try {
      const response = await fetch(`/api/metacritic?url=${encodeURIComponent(game.metacriticUrl)}&platform=${targetPlatform}`);
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `Servidor retornou erro: ${response.status}`);
      }
      const data = await response.json();
      
      if (onUpdateGame) {
        onUpdateGame({
          ...game,
          metacriticCritScore: data.metacriticCritScore !== null ? data.metacriticCritScore : undefined,
          metacriticUserScore: data.metacriticUserScore !== null ? data.metacriticUserScore : undefined,
          metacriticUrl: data.metacriticUrl || game.metacriticUrl
        });
        triggerAlert("Notas Atualizadas", "As notas do Metacritic foram atualizadas com sucesso!");
      }
    } catch (err: any) {
      console.error(err);
      triggerAlert("Erro ao atualizar", `Não foi possível atualizar dados: ${err.message || err}`);
    } finally {
      setIsSyncingMetacritic(false);
    }
  };

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!isAdmin || !isRepositioningCover) return;
    
    // Evita capturar o ponteiro se o clique ocorreu em um botão ou elemento interativo
    const target = e.target as HTMLElement;
    if (target.closest("button") || target.tagName === "BUTTON") {
      return;
    }

    e.preventDefault();
    setIsDragging(true);
    dragStartRef.current = {
      startX: e.clientX,
      startY: e.clientY,
      startPosX: coverPosXRef.current,
      startPosY: coverPosRef.current,
    };
    e.currentTarget.setPointerCapture(e.pointerId);
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!isDragging) return;
    const container = e.currentTarget;
    const rect = container.getBoundingClientRect();
    const containerWidth = rect.width || 800;
    const containerHeight = rect.height || 288;

    const deltaX = e.clientX - dragStartRef.current.startX;
    const deltaY = e.clientY - dragStartRef.current.startY;

    const deltaPctX = (deltaX / containerWidth) * 100;
    const deltaPctY = (deltaY / containerHeight) * 100;

    const zoomFactor = coverZoomRef.current / 100;
    const sensitivity = 0.8 / zoomFactor;
    const nextX = Math.max(0, Math.min(100, dragStartRef.current.startPosX - deltaPctX * sensitivity));
    const nextY = Math.max(0, Math.min(100, dragStartRef.current.startPosY - deltaPctY * sensitivity));

    const roundedX = Math.round(nextX);
    const roundedY = Math.round(nextY);

    setCoverPosX(roundedX);
    setCoverPos(roundedY);
    coverPosXRef.current = roundedX;
    coverPosRef.current = roundedY;
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!isDragging) return;
    setIsDragging(false);
    e.currentTarget.releasePointerCapture(e.pointerId);
    
    if (onUpdateGame && game) {
      onUpdateGame({
        ...game,
        coverPosition: coverPosRef.current,
        coverPositionX: coverPosXRef.current,
        coverZoom: coverZoomRef.current
      } as any);
    }
  };

  if (!game) return null;

  const formatDate = (dateStr: string) => {
    if (!dateStr) return "—";
    const parts = dateStr.split("-");
    return parts.length === 3 ? `${parts[2]}/${parts[1]}/${parts[0]}` : dateStr;
  };

  const handleEditDiaryClick = (entry: DiaryEntry, mode: "text" | "full" = "full") => {
    if (!isAdmin) {
      triggerAlert("Modo Admin Necessário", "É necessário ativar o Modo Admin (Editor) para editar entradas do diário.");
      return;
    }
    setEditingDiaryId(entry.id);
    setEditDiaryMode(mode);
    setDiaryText(entry.text);
    setDiaryKeyMoments(entry.keyMoments || []);
    
    if (entry.period) {
      const parts = entry.period.split(" ~ ");
      if (parts.length === 2) {
        const parseDate = (dStr: string) => {
          const dParts = dStr.trim().split("/");
          if (dParts.length === 3) {
            return `${dParts[2]}-${dParts[1]}-${dParts[0]}`;
          }
          return "";
        };
        setDiaryStart(parseDate(parts[0]));
        setDiaryEnd(parseDate(parts[1]));
      }
    }
    
    if (entry.medias && entry.medias.length > 0) {
      const seen = new Set<string>();
      const cleanMedias = entry.medias.filter((m) => {
        if (!m || !m.src) return false;
        const clean = m.src.trim();
        if (seen.has(clean)) return false;
        seen.add(clean);
        return true;
      });
      setTempDiaryMedias(cleanMedias);
    } else {
      setTempDiaryMedias([]);
    }
    
    // Automatically expand entry if it was collapsed
    setCollapsedEntries((prev) => ({ ...prev, [entry.id]: false }));
    setShowAddDiary(true);

    // Scroll directly to the inline editor form right under this entry
    setTimeout(() => {
      const el = document.getElementById(`diary-editor-panel-${entry.id}`);
      if (el) {
        el.scrollIntoView({ behavior: "smooth", block: "center" });
      } else {
        const fallbackEl = document.getElementById(`diary-entry-${entry.id}`);
        if (fallbackEl) {
          fallbackEl.scrollIntoView({ behavior: "smooth", block: "center" });
        }
      }
    }, 150);
  };

  const handleAddNewDiaryClick = () => {
    if (!isAdmin) {
      triggerAlert("Modo Admin Necessário", "É necessário ativar o Modo Admin (Editor) para adicionar entradas ao diário.");
      return;
    }
    if (showAddDiary && editingDiaryId === null) {
      handleCancelDiary();
    } else {
      setEditingDiaryId(null);
      setEditDiaryMode("full");
      setDiaryStart("");
      setDiaryEnd("");
      setDiaryText("");
      setDiaryScreenshotUrl("");
      setTempDiaryMedias([]);
      setShowAddDiary(true);

      setTimeout(() => {
        const el = document.getElementById("diary-editor-panel-new");
        if (el) {
          el.scrollIntoView({ behavior: "smooth", block: "center" });
        }
      }, 150);
    }
  };

  const handleCancelDiary = () => {
    setDiaryStart("");
    setDiaryEnd("");
    setDiaryText("");
    setDiaryScreenshotUrl("");
    setTempDiaryMedias([]);
    setShowAddDiary(false);
    setEditingDiaryId(null);
    setEditDiaryMode("full");
    currentFormEntryId.current = null;
  };

  const uploadDiaryMediaFiles = async (files: File[]) => {
    if (!isAdmin) {
      triggerAlert("Modo Admin Necessário", "É necessário ativar o Modo Admin (Editor) para fazer upload de mídias.");
      return;
    }
    const activeGame = propGame || game;
    if (files.length === 0 || !activeGame) return;

    const hasVideo = files.some((f) => isVideoFile(f));
    if (hasVideo && !isDriveAuthenticated()) {
      try {
        await signInWithGoogleDrive();
      } catch (authErr: any) {
        triggerAlert(
          "Login no YouTube Necessário",
          "Para salvar seus vídeos no YouTube e organizá-los em playlists por jogo, é necessário conectar sua conta do Google."
        );
        return;
      }
    }

    const entryId = editingDiaryId || currentFormEntryId.current || `diary_${Date.now()}`;
    currentFormEntryId.current = entryId;

    const entryTitle =
      diaryStart && diaryEnd
        ? `${diaryStart} até ${diaryEnd}`
        : diaryStart
        ? diaryStart
        : `Entrada do Diário (${new Date().toLocaleDateString("pt-BR")})`;

    const currentMediaCount = tempDiaryMedias.length;
    const batchFiles: Array<{ file: File; tempMediaId: string; isVideo: boolean; gridPosition: number }> = [];

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const isVideo = isVideoFile(file);
      const gridPosition = currentMediaCount + i + 1;

      const tempMediaId = `temp_media_${Date.now()}_${i}_${Math.random().toString(36).substring(2, 6)}`;
      const blobUrl = URL.createObjectURL(file);

      // Instantly show local preview thumbnail in UI
      setTempDiaryMedias((prev) => [
        ...prev,
        { id: tempMediaId, src: blobUrl, isVideo }
      ]);

      // Read image as Base64 data URL so it's persistent across page reloads if saved before ImgBB completes
      if (!isVideo) {
        const reader = new FileReader();
        reader.onload = () => {
          const base64 = reader.result as string;
          if (base64) {
            setTempDiaryMedias((prev) =>
              prev.map((m) => (m.id === tempMediaId && m.src.startsWith("blob:") ? { ...m, src: base64 } : m))
            );
          }
        };
        reader.readAsDataURL(file);
      }

      batchFiles.push({ file, tempMediaId, isVideo, gridPosition });
    }

    if (batchFiles.length > 0) {
      // Enqueue to global queue so user can navigate freely across games
      mediaUploadQueueManager.enqueueBatch({
        gameId: activeGame.id,
        gameName: activeGame.name,
        entryId,
        entryTitle,
        files: batchFiles,
      });
    }
  };

  const handleDiaryMediaUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []) as File[];
    if (files.length > 0) {
      uploadDiaryMediaFiles(files);
      e.target.value = "";
    }
  };

  const handleDiaryDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOverDiaryMedia(true);
  };

  const handleDiaryDragLeave = () => {
    setIsDragOverDiaryMedia(false);
  };

  const handleDiaryDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOverDiaryMedia(false);
    const files = Array.from(e.dataTransfer.files || []) as File[];
    const validFiles = files.filter(f => isImageFile(f) || isVideoFile(f));
    if (validFiles.length > 0) {
      uploadDiaryMediaFiles(validFiles);
    } else if (files.length > 0) {
      triggerAlert("Formatos Inválidos", "Por favor, envie apenas arquivos de imagem ou vídeo.");
    }
  };

  const handleAddLink = () => {
    if (!diaryScreenshotUrl.trim()) return;

    const massItems = parseMassImgBBUrls(diaryScreenshotUrl);
    if (massItems.length > 0) {
      const existingSrcs = new Set(tempDiaryMedias.map((m) => m.src));
      const newUnique = massItems.filter((item) => !existingSrcs.has(item.src));

      setTempDiaryMedias((prev) => [...prev, ...newUnique]);
      triggerAlert(
        "Mídias Adicionadas em Lote",
        `${newUnique.length} link(s) de imagem foram extraídos e contabilizados nesta entrada de diário!`
      );
    } else {
      const urls = diaryScreenshotUrl
        .split(/[\s,;\n]+/)
        .map((u) => u.trim())
        .filter(Boolean);

      const existingSrcs = new Set(tempDiaryMedias.map((m) => m.src));
      let added = 0;

      urls.forEach((url) => {
        if (!existingSrcs.has(url)) {
          existingSrcs.add(url);
          const isYt = isYoutubeUrl(url);
          const isVideo = isYt || /\.(mp4|webm|mov)$/i.test(url) || url.includes("video");
          setTempDiaryMedias((prev) => [
            ...prev,
            { src: url, isVideo }
          ]);
          added++;
        }
      });

      if (added > 0) {
        triggerAlert("Mídias Adicionadas", `${added} link(s) adicionados com sucesso.`);
      }
    }

    setDiaryScreenshotUrl("");
  };

  const handleReindexCacheMedias = () => {
    if (!isAdmin) {
      triggerAlert("Modo Admin Necessário", "É necessário ativar o Modo Admin (Editor) para reindexar mídias.");
      return;
    }
    const cachedUrls = getAllCachedImgBBUrls();
    if (cachedUrls.length === 0) {
      triggerAlert(
        "Nenhuma Mídia em Cache",
        "Não foram encontradas mídias pendentes de reindexação no cache local."
      );
      return;
    }

    const existingSrcs = new Set(tempDiaryMedias.map((m) => m.src));
    let addedCount = 0;

    cachedUrls.forEach((url) => {
      if (!existingSrcs.has(url)) {
        existingSrcs.add(url);
        setTempDiaryMedias((prev) => [...prev, { src: url, isVideo: false }]);
        addedCount++;
      }
    });

    if (addedCount > 0) {
      triggerAlert(
        "Mídias Recuperadas",
        `${addedCount} imagens enviadas ao ImgBB foram reindexadas e vinculadas com sucesso a esta entrada!`
      );
    } else {
      triggerAlert(
        "Mídias Já Indexadas",
        "Todas as mídias salvas no ImgBB já estão contabilizadas nesta entrada."
      );
    }
  };

  const moveMedia = (index: number, direction: "left" | "right") => {
    const newIndex = direction === "left" ? index - 1 : index + 1;
    if (newIndex < 0 || newIndex >= tempDiaryMedias.length) return;
    const updated = [...tempDiaryMedias];
    const temp = updated[index];
    updated[index] = updated[newIndex];
    updated[newIndex] = temp;
    setTempDiaryMedias(updated);
  };

  const handleMediaDragStart = (e: React.DragEvent, index: number) => {
    setDraggedMediaIndex(index);
    e.dataTransfer.effectAllowed = "move";
  };

  const handleMediaDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    if (draggedMediaIndex === null || draggedMediaIndex === index) return;

    // Real-time swap to visually shift elements instantly
    const updated = [...tempDiaryMedias];
    const draggedItem = updated[draggedMediaIndex];
    updated.splice(draggedMediaIndex, 1);
    updated.splice(index, 0, draggedItem);
    
    setTempDiaryMedias(updated);
    setDraggedMediaIndex(index);
    setDragOverMediaIndex(index);
  };

  const handleMediaDrop = (index: number) => {
    setDraggedMediaIndex(null);
    setDragOverMediaIndex(null);
  };

  const handleAddDiarySubmit = () => {
    if (!isAdmin) {
      triggerAlert("Modo Admin Necessário", "É necessário ativar o Modo Admin (Editor) para salvar entradas no diário.");
      return;
    }
    if (!diaryStart || !diaryEnd || !diaryText.trim()) {
      triggerAlert("Campos Obrigatórios", "Por favor, preencha as datas do período e o texto da entrada.");
      return;
    }

    const period = `${formatDate(diaryStart)} ~ ${formatDate(diaryEnd)}`;
    
    let medias: MediaItem[] = [...tempDiaryMedias];
    if (diaryScreenshotUrl.trim()) {
      const urls = diaryScreenshotUrl
        .split(",")
        .map((u) => u.trim())
        .filter(Boolean);
      urls.forEach((url) => {
        const isYt = isYoutubeUrl(url);
        const isVideo = isYt || /\.(mp4|webm|mov)$/i.test(url) || url.includes("video");
        medias.push({ src: url, isVideo });
      });
    }

    const newEntry: DiaryEntry = {
      id: editingDiaryId || currentFormEntryId.current || ("diary-" + Date.now()),
      period,
      medias,
      text: diaryText.trim(),
      keyMoments: diaryKeyMoments,
    };

    playRetroSound("save");
    onSaveDiaryEntry(game.id, newEntry);

    // reset state
    setDiaryStart("");
    setDiaryEnd("");
    setDiaryText("");
    setDiaryKeyMoments([]);
    setDiaryScreenshotUrl("");
    setTempDiaryMedias([]);
    setShowAddDiary(false);
    setEditingDiaryId(null);
    setEditDiaryMode("full");
    currentFormEntryId.current = null;
    setIsFormSelectionMode(false);
    setSelectedTempIndices(new Set());
  };

  const handleDeleteEntryMedias = (entryId: string, mediasToDelete: MediaItem[]) => {
    if (!isAdmin) {
      triggerAlert("Modo Admin Necessário", "É necessário ativar o Modo Admin (Editor) para excluir mídias.");
      return;
    }
    if (!game) return;
    const targetEntry = (game.diary || []).find((e) => e.id === entryId);
    if (!targetEntry) return;

    const removeSrcs = new Set(mediasToDelete.map((m) => m.src));

    mediasToDelete.forEach((m) => {
      moveToTrash({
        type: "media",
        title: m.isVideo ? "Vídeo da Jornada" : "Imagem da Jornada",
        data: m,
        gameId: game.id,
        diaryEntryId: entryId,
        gameTitle: game.name,
      });
    });

    const remainingMedias = (targetEntry.medias || []).filter((m) => !removeSrcs.has(m.src));
    const updatedEntry: DiaryEntry = {
      ...targetEntry,
      medias: remainingMedias,
    };

    onSaveDiaryEntry(game.id, updatedEntry);
    showToast({
      title: "Mídia Movidada para Lixeira 🗑️",
      message: `${mediasToDelete.length} mídia(s) enviada(s) para a Lixeira.`,
      type: "info",
    });
  };

  const handleDeleteAllEntryMedias = (entryId: string) => {
    if (!isAdmin) {
      triggerAlert("Modo Admin Necessário", "É necessário ativar o Modo Admin (Editor) para excluir mídias.");
      return;
    }
    if (!game) return;
    const targetEntry = (game.diary || []).find((e) => e.id === entryId);
    if (!targetEntry) return;

    if (targetEntry.medias) {
      targetEntry.medias.forEach((m) => {
        moveToTrash({
          type: "media",
          title: m.isVideo ? "Vídeo da Jornada" : "Imagem da Jornada",
          data: m,
          gameId: game.id,
          diaryEntryId: entryId,
          gameTitle: game.name,
        });
      });
    }

    const updatedEntry: DiaryEntry = {
      ...targetEntry,
      medias: [],
    };

    onSaveDiaryEntry(game.id, updatedEntry);
    showToast({
      title: "Mídias Movidas para Lixeira 🗑️",
      message: "Todas as mídias da entrada foram enviadas para a Lixeira.",
      type: "info",
    });
  };

  const renderDiaryForm = (targetEntryId: string | null) => {
    const isEditing = targetEntryId !== null;
    const isTextOnly = isEditing && editDiaryMode === "text";

    return (
      <motion.div
        key={`add-diary-form-panel-${targetEntryId || "new"}`}
        id={targetEntryId ? `diary-editor-panel-${targetEntryId}` : "diary-editor-panel-new"}
        initial={{ opacity: 0, height: 0 }}
        animate={{ opacity: 1, height: "auto" }}
        exit={{ opacity: 0, height: 0 }}
        className="glass rounded-3xl border border-cyan-500/40 p-5 space-y-4 overflow-hidden shadow-2xl my-3 bg-zinc-950/95 relative"
      >
        {/* Sticky Top Header with Always Visible Save & Cancel Actions */}
        <div className="sticky -top-5 z-30 bg-zinc-950/95 backdrop-blur-md pt-3 pb-3 -mx-5 px-5 -mt-5 border-b border-cyan-500/30 shadow-lg flex flex-col gap-2">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <span className="text-[10px] uppercase tracking-[0.2em] text-cyan-300 font-bold flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-cyan-400 animate-pulse" />
              {isEditing
                ? isTextOnly
                  ? "EDITANDO APENAS O TEXTO DO REGISTRO"
                  : "EDITANDO ENTRADA COMPLETA (TEXTO E MÍDIAS)"
                : "NOVO REGISTRO DE DIÁRIO"}
            </span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleCancelDiary}
                className="px-3.5 py-1.5 rounded-xl bg-zinc-900 border border-zinc-700 text-zinc-200 font-bold hover:bg-zinc-800 text-xs cursor-pointer transition-all active:scale-95 shadow-sm"
                title="Cancelar e descartar alterações"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleAddDiarySubmit}
                className="px-4 py-1.5 rounded-xl bg-gradient-to-r from-purple-600 to-cyan-500 hover:from-purple-500 hover:to-cyan-400 text-white font-extrabold text-xs cursor-pointer active:scale-95 transition-all shadow-md shadow-cyan-950/60 flex items-center gap-1.5"
                title="Salvar alterações no diário da jogatina"
              >
                <Check size={14} className="stroke-[3]" />
                {isEditing ? (isTextOnly ? "Salvar Texto" : "Atualizar Entrada") : "Salvar Entrada"}
              </button>
            </div>
          </div>

          {/* Sticky Media Upload Progress Indicator */}
          {isUploadingMedia && uploadStats && (
            <div className="w-full bg-cyan-950/80 border border-cyan-500/40 rounded-xl px-3 py-2 flex items-center justify-between gap-3 text-xs font-mono shadow-inner animate-fadeIn">
              <div className="flex items-center gap-2 min-w-0">
                <span className="w-2.5 h-2.5 rounded-full bg-cyan-400 animate-ping shrink-0" />
                <span className="text-cyan-200 font-bold truncate">
                  Upload: <strong className="text-white font-black">{uploadStats.current} de {uploadStats.total} imagens</strong>
                </span>
              </div>
              <div className="flex items-center gap-2.5 shrink-0">
                <div className="w-20 sm:w-32 h-2 rounded-full bg-zinc-900 border border-zinc-700 overflow-hidden">
                  <div 
                    className="h-full bg-gradient-to-r from-cyan-400 via-purple-400 to-emerald-400 transition-all duration-300 rounded-full"
                    style={{ width: `${uploadStats.percent}%` }}
                  />
                </div>
                <span className="text-cyan-400 font-extrabold text-[11px]">{uploadStats.percent}%</span>
              </div>
            </div>
          )}
        </div>

        <div>
          <label className="block text-[10px] uppercase tracking-[0.25em] text-zinc-400 font-bold mb-1">
            Período de Aventura *
          </label>
          <div className="flex items-center gap-2 font-mono text-sm max-w-md">
            <input
              type="date"
              value={diaryStart}
              onChange={(e) => setDiaryStart(e.target.value)}
              className="flex-1 px-3 py-2 rounded-xl bg-zinc-900 border border-zinc-800 text-white outline-none focus:ring-2 focus:ring-cyan-500 text-xs"
            />
            <span className="text-zinc-400">~</span>
            <input
              type="date"
              value={diaryEnd}
              onChange={(e) => setDiaryEnd(e.target.value)}
              className="flex-1 px-3 py-2 rounded-xl bg-zinc-900 border border-zinc-800 text-white outline-none focus:ring-2 focus:ring-cyan-500 text-xs"
            />
          </div>
        </div>

        {/* Key Moments Tag Picker */}
        <div>
          <label className="block text-[10px] uppercase tracking-[0.25em] text-cyan-400 font-bold mb-1.5 flex items-center gap-1">
            <Tag size={12} />
            Momentos Chave / Destaques da Entrada
          </label>
          <div className="flex flex-wrap gap-1.5">
            {["Boss Fight ⚔️", "Platina 🏆", "Plot Twist 🎭", "Review Final ⭐", "Momento Épico ⚡", "Segredo 🔑", "SPOILER ⚠️"].map((tag) => {
              const selected = diaryKeyMoments.includes(tag);
              return (
                <button
                  key={tag}
                  type="button"
                  onClick={() => {
                    if (selected) {
                      setDiaryKeyMoments(diaryKeyMoments.filter((t) => t !== tag));
                    } else {
                      setDiaryKeyMoments([...diaryKeyMoments, tag]);
                    }
                  }}
                  className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer border ${
                    selected
                      ? "bg-cyan-500 text-zinc-950 border-cyan-400 shadow-md shadow-cyan-500/20"
                      : "bg-zinc-900 text-zinc-400 border-zinc-800 hover:border-zinc-700 hover:text-zinc-300"
                  }`}
                >
                  {tag}
                </button>
              );
            })}
          </div>
        </div>

        <div>
          <label className="block text-[10px] uppercase tracking-[0.25em] text-zinc-400 font-bold mb-1">
            {isEditing ? (isTextOnly ? "Texto do Diário (Apenas Texto) *" : "Texto da Entrada *") : "Entrada de Diário *"}
          </label>
          <RichTextEditor
            value={diaryText}
            onChange={setDiaryText}
            gameName={game?.name}
            game={game}
            onUpdateGame={onUpdateGame}
            onOpenDictionaryModal={() => setIsDictionaryModalOpen(true)}
            placeholder="Relate conquistas, batalhas difíceis, sentimentos, chefes derrotados..."
          />
        </div>

        {!isTextOnly && (
          <div className="pt-2 border-t border-zinc-850">
            <label className="block text-[10px] uppercase tracking-[0.25em] text-zinc-400 font-bold mb-1.5">
              Anexar Screenshot ou Vídeo (ImgBB & YouTube)
            </label>
            
            <div className="space-y-3">
              {/* Drag and drop zone */}
              <div
                onDragOver={handleDiaryDragOver}
                onDragLeave={handleDiaryDragLeave}
                onDrop={handleDiaryDrop}
                className={`flex flex-col items-center justify-center p-5 rounded-2xl bg-zinc-950 border-2 border-dashed transition-all cursor-pointer relative overflow-hidden ${
                  isDragOverDiaryMedia
                    ? "border-cyan-500 bg-cyan-950/10 scale-[1.01]"
                    : "border-zinc-800 hover:border-zinc-700 hover:bg-zinc-900/40"
                }`}
                onClick={() => {
                  const diaryInput = document.getElementById("diary-media-input");
                  if (diaryInput) diaryInput.click();
                }}
              >
                <input
                  id="diary-media-input"
                  type="file"
                  multiple
                  disabled={isUploadingMedia}
                  accept="image/*,video/*"
                  onChange={handleDiaryMediaUpload}
                  className="hidden"
                />
                {isUploadingMedia ? (
                  <div className="flex flex-col items-center gap-3 py-2 text-center w-full max-w-md px-2">
                    <div className="flex items-center gap-3 w-full justify-between text-xs font-bold text-cyan-300">
                      <span className="flex items-center gap-1.5 font-mono">
                        <span className="w-2.5 h-2.5 rounded-full bg-cyan-400 animate-ping" />
                        {uploadStats ? `${uploadStats.current} de ${uploadStats.total} imagens em progresso` : "Enviando mídias..."}
                      </span>
                      {uploadStats && (
                        <span className="text-cyan-400 font-extrabold font-mono bg-cyan-950/80 px-2.5 py-0.5 rounded-md border border-cyan-500/30 text-xs">
                          {uploadStats.percent}%
                        </span>
                      )}
                    </div>

                    {/* Integrated Progress Bar */}
                    <div className="w-full h-3 rounded-full bg-zinc-900 overflow-hidden border border-zinc-800 p-0.5 relative">
                      <div 
                        className="h-full bg-gradient-to-r from-cyan-500 via-purple-500 to-emerald-400 rounded-full transition-all duration-300 shadow-md shadow-cyan-500/30"
                        style={{ width: `${uploadStats?.percent || 0}%` }}
                      />
                    </div>

                    {uploadStats && (
                      <p className="text-[11px] text-zinc-400 font-mono truncate max-w-full">
                        Arquivo atual: <span className="text-zinc-200 font-medium">{uploadStats.fileName}</span>
                      </p>
                    )}
                  </div>
                ) : (
                  <div className="flex flex-col items-center gap-1.5 text-center">
                    <Upload size={20} className="text-cyan-400" />
                    <p className="text-xs font-semibold text-zinc-300">
                      Arraste screenshots ou vídeos aqui ou <span className="text-cyan-400 underline decoration-dashed underline-offset-4">escolha ficheiros</span>
                    </p>
                    <p className="text-[10px] text-zinc-500 uppercase tracking-widest font-semibold">
                      Múltiplos arquivos suportados
                    </p>
                  </div>
                )}
              </div>

              {/* Manual Link or Batch URLs input fallback */}
              <div className="flex w-full gap-2 items-center flex-wrap sm:flex-nowrap">
                <input
                  type="text"
                  value={diaryScreenshotUrl}
                  onChange={(e) => setDiaryScreenshotUrl(e.target.value)}
                  placeholder="Cole link direto ou lista de URLs (ImgBB, YouTube, etc)..."
                  className="flex-1 px-3 py-2 rounded-xl bg-zinc-900 border border-zinc-800 text-white outline-none focus:ring-2 focus:ring-cyan-500 text-xs"
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      handleAddLink();
                    }
                  }}
                />
                <button
                  type="button"
                  onClick={handleAddLink}
                  className="px-3 py-2 rounded-xl bg-zinc-900 border border-zinc-800 hover:bg-zinc-800 text-cyan-400 transition-all flex items-center justify-center gap-1.5 text-xs font-mono font-semibold cursor-pointer shrink-0"
                  title="Adicionar Link ou Lote de URLs"
                >
                  <Link2 size={14} />
                  <span>Adicionar</span>
                </button>
                <button
                  type="button"
                  onClick={handleReindexCacheMedias}
                  className="px-3 py-2 rounded-xl bg-amber-950/70 border border-amber-500/40 hover:bg-amber-900/90 text-amber-300 transition-all flex items-center justify-center gap-1.5 text-xs font-mono font-semibold cursor-pointer shrink-0"
                  title="Recuperar e reindexar mídias do ImgBB do cache do navegador"
                >
                  <RefreshCw size={13} />
                  <span>Reindexar Cache</span>
                </button>
              </div>
            </div>

            {tempDiaryMedias.length > 0 && (
              <div className="space-y-2 mt-3">
                {/* Batch selection and action toolbar */}
                <div className="p-2.5 rounded-xl bg-zinc-950 border border-zinc-800 flex flex-wrap items-center justify-between gap-2 text-xs font-mono">
                  <p className="text-[10px] text-zinc-400 flex items-center gap-1.5 text-left">
                    <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse" />
                    Arraste e solte para reordenar ou selecione para excluir em lote
                  </p>

                  <div className="flex items-center gap-2 flex-wrap">
                    <button
                      type="button"
                      onClick={() => {
                        setIsFormSelectionMode(!isFormSelectionMode);
                        setSelectedTempIndices(new Set());
                      }}
                      className={`px-2.5 py-1 rounded-lg border flex items-center gap-1 font-bold transition-all cursor-pointer text-[11px] ${
                        isFormSelectionMode
                          ? "bg-cyan-950 border-cyan-500/60 text-cyan-300"
                          : "bg-zinc-900 border-zinc-800 text-zinc-400 hover:text-white hover:border-zinc-700"
                      }`}
                    >
                      {isFormSelectionMode ? <CheckSquare size={12} /> : <Square size={12} />}
                      <span>{isFormSelectionMode ? "Sair da Seleção" : "Seleção em Lote"}</span>
                    </button>

                    {isFormSelectionMode && selectedTempIndices.size > 0 && (
                      <button
                        type="button"
                        onClick={() => {
                          triggerConfirm(
                            "Excluir Mídias Selecionadas",
                            `Excluir ${selectedTempIndices.size} mídias selecionadas?`,
                            () => {
                              Array.from(selectedTempIndices).forEach((i) => {
                                const item = tempDiaryMedias[i];
                                if (item?.deleteUrl) {
                                  fetch("/api/delete-imgbb", {
                                    method: "POST",
                                    headers: { "Content-Type": "application/json" },
                                    body: JSON.stringify({ deleteUrl: item.deleteUrl }),
                                  }).catch((err) => console.error("Erro ImgBB delete:", err));
                                }
                              });
                              setTempDiaryMedias((prev) => prev.filter((_, i) => !selectedTempIndices.has(i)));
                              setSelectedTempIndices(new Set());
                              setIsFormSelectionMode(false);
                            }
                          );
                        }}
                        className="px-2.5 py-1 rounded-lg bg-red-950 border border-red-500/60 text-red-300 hover:bg-red-900 hover:text-white font-bold transition-all cursor-pointer flex items-center gap-1 text-[11px] animate-pulse"
                      >
                        <Trash2 size={12} />
                        <span>Excluir Selecionadas ({selectedTempIndices.size})</span>
                      </button>
                    )}

                    <button
                      type="button"
                      onClick={() => {
                        triggerConfirm(
                          "Deletar Todas as Mídias",
                          "Tem certeza que deseja apagar TODAS as mídias anexadas neste diário?",
                          () => {
                            tempDiaryMedias.forEach((item) => {
                              if (item.deleteUrl) {
                                fetch("/api/delete-imgbb", {
                                  method: "POST",
                                  headers: { "Content-Type": "application/json" },
                                  body: JSON.stringify({ deleteUrl: item.deleteUrl }),
                                }).catch((err) => console.error("Erro ImgBB delete:", err));
                              }
                            });
                            setTempDiaryMedias([]);
                            setSelectedTempIndices(new Set());
                            setIsFormSelectionMode(false);
                          }
                        );
                      }}
                      className="px-2.5 py-1 rounded-lg bg-zinc-900 border border-zinc-800 hover:bg-red-950 hover:border-red-500/50 text-zinc-400 hover:text-red-300 transition-all cursor-pointer flex items-center gap-1 text-[11px]"
                      title="Apagar todas as mídias da lista"
                    >
                      <Trash2 size={12} />
                      <span>Deletar Todas ({tempDiaryMedias.length})</span>
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3 p-3 rounded-2xl bg-zinc-950 border border-zinc-800">
                  {tempDiaryMedias.map((m, idx) => {
                    const isYt = isYoutubeUrl(m.src);
                    const isDragged = draggedMediaIndex === idx;
                    const isSelected = selectedTempIndices.has(idx);

                    const toggleSelectThis = () => {
                      setSelectedTempIndices((prev) => {
                        const next = new Set(prev);
                        if (next.has(idx)) next.delete(idx);
                        else next.add(idx);
                        return next;
                      });
                    };

                    return (
                      <motion.div
                        layout
                        transition={{ type: "spring", stiffness: 300, damping: 25 }}
                        key={m.src || idx}
                        draggable={!isFormSelectionMode}
                        onDragStart={(e) => handleMediaDragStart(e, idx)}
                        onDragOver={(e) => handleMediaDragOver(e, idx)}
                        onDragLeave={() => {
                          if (dragOverMediaIndex === idx) setDragOverMediaIndex(null);
                        }}
                        onDrop={() => handleMediaDrop(idx)}
                        onDragEnd={() => {
                          setDraggedMediaIndex(null);
                          setDragOverMediaIndex(null);
                        }}
                        onClick={() => {
                          if (isFormSelectionMode) toggleSelectThis();
                        }}
                        className={`flex flex-col rounded-xl overflow-hidden border bg-zinc-900 relative transition-all duration-300 select-none ${
                          isSelected
                            ? "border-cyan-400 ring-2 ring-cyan-500/50 scale-[0.98]"
                            : isDragged
                            ? "opacity-35 border-cyan-500 scale-95 shadow-inner bg-zinc-950 border-dashed"
                            : "border-zinc-800 hover:border-zinc-700 hover:scale-[1.01]"
                        } ${isFormSelectionMode ? "cursor-pointer" : "cursor-grab active:cursor-grabbing"}`}
                      >
                        {/* Checkbox overlay when selection mode is ON */}
                        {isFormSelectionMode && (
                          <div
                            className={`absolute top-1.5 left-1.5 z-20 w-5 h-5 rounded-md flex items-center justify-center transition-all ${
                              isSelected
                                ? "bg-cyan-500 text-black font-extrabold shadow"
                                : "bg-black/70 border border-zinc-600 text-transparent"
                            }`}
                          >
                            <Check size={12} className={isSelected ? "stroke-[3]" : "opacity-0"} />
                          </div>
                        )}

                        <div className="h-20 w-full relative bg-black flex items-center justify-center overflow-hidden pointer-events-none">
                          {isYt ? (
                            <YouTubeThumbnail url={m.src} className="w-full h-full object-cover" />
                          ) : m.isVideo ? (
                            <video src={m.src} className="w-full h-full object-cover" muted preload="metadata" />
                          ) : (
                            <img src={m.src} className="w-full h-full object-cover" alt="prev" referrerPolicy="no-referrer" />
                          )}

                          {/* Loading overlay when uploading media */}
                          {(m.isUploading || (m.src && (m.src.startsWith("blob:") || m.src.startsWith("data:")))) && (
                            <div className="absolute inset-0 bg-black/80 backdrop-blur-[2px] flex flex-col items-center justify-center p-1 text-center z-10 space-y-1">
                              <RefreshCw size={16} className="animate-spin text-cyan-400" />
                              <span className="text-[9px] font-extrabold text-cyan-300 uppercase tracking-tight">
                                {m.isVideo || isYt ? "Enviando Vídeo..." : "Enviando ImgBB..."}
                              </span>
                              <span className="text-[8px] text-zinc-400 font-mono">Processando</span>
                            </div>
                          )}

                          <div className="absolute bottom-1 right-1 bg-black/80 px-1 py-0.5 rounded text-[8px] text-zinc-300 flex items-center gap-0.5 z-20">
                            {isYt ? (
                              <>
                                <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />
                                <span>YouTube</span>
                              </>
                            ) : m.isVideo ? (
                              <>
                                <Film size={8} className="text-cyan-400" />
                                <span>Vídeo</span>
                              </>
                            ) : (
                              <>
                                <ImageIcon size={8} className="text-purple-400" />
                                <span>Imagem</span>
                              </>
                            )}
                          </div>
                        </div>

                        <div className="h-8 bg-zinc-950 border-t border-zinc-800/80 flex items-center justify-between px-2">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              moveMedia(idx, "left");
                            }}
                            disabled={idx === 0 || isFormSelectionMode}
                            className="p-1 rounded text-zinc-400 hover:text-cyan-400 disabled:opacity-20 disabled:hover:text-zinc-400 transition-all cursor-pointer"
                            title="Mover para esquerda"
                          >
                            <ArrowLeft size={12} />
                          </button>

                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              triggerConfirm(
                                "Excluir Mídia",
                                "Tem certeza que deseja apagar esta mídia da entrada do diário?",
                                () => {
                                  const itemToRemove = tempDiaryMedias[idx];
                                  if (itemToRemove && itemToRemove.deleteUrl) {
                                    fetch("/api/delete-imgbb", {
                                      method: "POST",
                                      headers: { "Content-Type": "application/json" },
                                      body: JSON.stringify({ deleteUrl: itemToRemove.deleteUrl })
                                    }).catch((err) => console.error("Erro ao deletar do ImgBB no backend:", err));
                                  }
                                  setTempDiaryMedias((prev) => prev.filter((_, i) => i !== idx));
                                  setSelectedTempIndices((prev) => {
                                    const next = new Set(prev);
                                    next.delete(idx);
                                    return next;
                                  });
                                }
                              );
                            }}
                            className="p-1 rounded text-zinc-500 hover:text-red-400 hover:bg-red-500/10 transition-all cursor-pointer"
                            title="Remover mídia"
                          >
                            <Trash2 size={12} />
                          </button>

                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              moveMedia(idx, "right");
                            }}
                            disabled={idx === tempDiaryMedias.length - 1 || isFormSelectionMode}
                            className="p-1 rounded text-zinc-400 hover:text-cyan-400 disabled:opacity-20 disabled:hover:text-zinc-400 transition-all cursor-pointer"
                            title="Mover para direita"
                          >
                            <ArrowRight size={12} />
                          </button>
                        </div>
                      </motion.div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Sticky Bottom Action Bar so Save & Cancel are always immediately accessible */}
        <div className="sticky -bottom-5 z-30 bg-zinc-950/95 backdrop-blur-md py-3 -mx-5 px-5 -mb-5 border-t border-cyan-500/30 shadow-2xl flex items-center justify-between flex-wrap gap-2 mt-4">
          <div className="text-[10px] text-zinc-400 font-mono flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse" />
            <span>{isEditing ? (isTextOnly ? "Modo: Apenas Texto" : "Modo: Entrada Completa") : "Novo Registro de Diário"}</span>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleCancelDiary}
              className="px-3.5 py-1.5 rounded-xl bg-zinc-900 border border-zinc-700 text-zinc-200 font-bold hover:bg-zinc-800 text-xs cursor-pointer transition-all active:scale-95 shadow-sm"
              title="Cancelar e descartar alterações"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={handleAddDiarySubmit}
              className="px-4 py-1.5 rounded-xl bg-gradient-to-r from-purple-600 to-cyan-500 hover:from-purple-500 hover:to-cyan-400 text-white font-extrabold text-xs cursor-pointer active:scale-95 transition-all shadow-md shadow-cyan-950/60 flex items-center gap-1.5"
              title="Salvar alterações no diário da jogatina"
            >
              <Check size={14} className="stroke-[3]" />
              {isEditing ? (isTextOnly ? "Salvar Texto" : "Atualizar Entrada") : "Salvar Entrada"}
            </button>
          </div>
        </div>
      </motion.div>
    );
  };

  const handleDeleteClick = () => {
    if (!isAdmin) {
      triggerAlert("Modo Admin Necessário", "É necessário ativar o Modo Admin (Editor) para remover um jogo.");
      return;
    }
    triggerConfirm(
      "Remover Jogo",
      `Queres mover "${game.name}" para a Lixeira? Poderás restaurá-lo a qualquer momento.`,
      () => {
        addTrashItem({
          type: "game",
          title: game.name,
          data: game,
        });
        onDeleteGame(game.id);
        playRetroSound("delete");
        showToast({
          title: "Jogo enviado para a Lixeira 🗑️",
          message: `"${game.name}" foi movido para a lixeira.`,
          type: "info",
          duration: 8000,
          action: {
            label: "Desfazer",
            onClick: () => {
              if (onRestoreGame) onRestoreGame(game);
            },
          },
        });
        onClose();
      }
    );
  };

  const handleDeleteDiaryClick = (entryId: string) => {
    if (!isAdmin) {
      triggerAlert("Modo Admin Necessário", "É necessário ativar o Modo Admin (Editor) para apagar uma entrada do diário.");
      return;
    }
    const targetEntry = (game.diary || []).find((e) => e.id === entryId);
    if (!targetEntry) return;

    triggerConfirm(
      "Eliminar Entrada de Diário",
      "Queres mover esta entrada de diário para a Lixeira?",
      () => {
        addTrashItem({
          type: "diary_entry",
          title: `Registro (${targetEntry.period || "Diário"})`,
          gameId: game.id,
          gameTitle: game.name,
          data: targetEntry,
        });
        onDeleteDiaryEntry(game.id, entryId);
        playRetroSound("delete");
        showToast({
          title: "Entrada na Lixeira 🗑️",
          message: `Entrada do diário (${targetEntry.period}) foi para a lixeira.`,
          type: "info",
          duration: 8000,
          action: {
            label: "Desfazer",
            onClick: () => {
              onSaveDiaryEntry(game.id, targetEntry);
            },
          },
        });
      }
    );
  };

  const downloadAllGameMedia = async () => {
    const urlsToDownload: { name: string; src: string }[] = [];
    if (game.cover) {
      urlsToDownload.push({ name: `${game.name.replace(/[^a-z0-9]/gi, '_').toLowerCase()}_cover`, src: game.cover });
    }
    if (game.icon) {
      urlsToDownload.push({ name: `${game.name.replace(/[^a-z0-9]/gi, '_').toLowerCase()}_icon`, src: game.icon });
    }
    if (game.diary) {
      game.diary.forEach((entry) => {
        if (entry.medias) {
          entry.medias.forEach((m, mIdx) => {
            if (m.src) {
              const cleanedPeriod = entry.period.replace(/[^a-z0-9]/gi, '_').toLowerCase();
              urlsToDownload.push({ 
                name: `${game.name.replace(/[^a-z0-9]/gi, '_').toLowerCase()}_diario_${cleanedPeriod}_${mIdx + 1}`, 
                src: m.src 
              });
            }
          });
        }
      });
    }

    if (urlsToDownload.length === 0) {
      triggerAlert("Download de Mídias", "Este jogo não possui nenhuma mídia (capa, ícone ou imagens do diário) disponível para download.");
      return;
    }

    triggerAlert(
      "Iniciando Download", 
      `Iniciando o download de ${urlsToDownload.length} mídia(s). Se o seu navegador solicitar, por favor permita o download de múltiplos arquivos.`
    );

    for (let i = 0; i < urlsToDownload.length; i++) {
      const item = urlsToDownload[i];
      try {
        if (item.src.startsWith("data:")) {
          const link = document.createElement("a");
          link.href = item.src;
          let ext = "png";
          const match = item.src.match(/data:image\/([a-zA-Z+]+);base64/);
          if (match && match[1]) {
            ext = match[1] === "jpeg" ? "jpg" : match[1];
          }
          link.download = `${item.name}.${ext}`;
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);
        } else {
          const response = await fetch(item.src);
          if (!response.ok) throw new Error("Network or CORS issue");
          const blob = await response.blob();
          const blobUrl = URL.createObjectURL(blob);
          
          const link = document.createElement("a");
          link.href = blobUrl;
          let ext = "jpg";
          if (blob.type) {
            const typeExt = blob.type.split("/")[1];
            if (typeExt) ext = typeExt === "jpeg" ? "jpg" : typeExt;
          }
          link.download = `${item.name}.${ext}`;
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);
          URL.revokeObjectURL(blobUrl);
        }
      } catch (err) {
        console.warn(`Erro ao baixar via blob, usando link direto: ${item.src}`, err);
        const link = document.createElement("a");
        link.href = item.src;
        link.target = "_blank";
        link.download = item.name;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
      }
      await new Promise((r) => setTimeout(r, 400));
    }
  };

  return (
    <>
      <AnimatePresence>
        {isOpen && (
          <div key="game-detail-drawer-root" className="fixed inset-0 z-40 overflow-hidden">
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 bg-black/80 backdrop-blur-md cursor-pointer"
            onClick={onClose}
          />

          {/* Sliding Panel */}
          <div className="absolute inset-y-0 right-0 max-w-full flex pl-2 sm:pl-[5vw] pointer-events-none">
            <motion.div
              initial={{ x: "100%" }}
              animate={{ x: 0 }}
              exit={{ x: "100%" }}
              transition={{ type: "spring", damping: 30, stiffness: 300 }}
              className={`pointer-events-auto w-screen max-w-full lg:max-w-[95vw] bg-[#080a10] shadow-2xl flex flex-col h-full relative transition-all duration-300 ${
                isReadingMode
                  ? "border-l-4 border-amber-500 shadow-amber-500/10 ring-1 ring-amber-500/30"
                  : "border-l border-purple-500/20"
              }`}
            >
              {/* Sticky Header */}
              <div className={`p-3.5 sm:p-5 border-b backdrop-blur-md flex items-center justify-between gap-2 sm:gap-3 shrink-0 z-20 transition-colors ${
                isReadingMode ? "border-amber-500/40 bg-amber-950/20" : "border-zinc-800 bg-zinc-950/95"
              }`}>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <div className="text-[10px] uppercase tracking-[0.25em] sm:tracking-[0.35em] text-zinc-500 font-bold truncate">Perfil detalhado</div>
                    {isReadingMode && (
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-mono font-extrabold uppercase tracking-wider bg-gradient-to-r from-amber-500/20 to-orange-500/20 text-amber-400 border border-amber-500/50 shadow-sm animate-pulse">
                        <BookOpen size={11} className="text-amber-400 shrink-0" />
                        Modo Leitura Ativo
                      </span>
                    )}
                  </div>
                  <h3 className="text-xs sm:text-sm font-extrabold text-zinc-400 truncate">Biblioteca / Diário da Jogatina</h3>
                </div>
                <div className="flex items-center gap-1.5 sm:gap-2 shrink-0 relative">
                  {/* Sessão ao Vivo */}
                  {game && (
                    <button
                      onClick={() => startLiveSessionForGame(game.id)}
                      className="h-10 px-2.5 sm:px-3 rounded-xl bg-gradient-to-r from-rose-950/90 to-red-950/90 hover:from-rose-900 hover:to-red-900 border border-rose-500/50 hover:border-rose-400 text-rose-200 transition-all flex items-center justify-center gap-1.5 cursor-pointer shadow-lg hover:shadow-rose-500/20 active:scale-95 shrink-0"
                      title="Iniciar Cronômetro de Sessão ao Vivo"
                    >
                      <Play size={16} className="fill-rose-400 text-rose-400 shrink-0" />
                      <span className="hidden sm:inline text-xs font-bold">Sessão ao Vivo</span>
                    </button>
                  )}

                  {/* Modo de Leitura / Revisão */}
                  <button
                    onClick={() => {
                      const nextMode = !isReadingMode;
                      setIsReadingMode(nextMode);
                      if (nextMode) {
                        setShowAddDiary(false);
                        setIsEntrySelectionMode(false);
                        setSelectedEntryIds(new Set());
                        setExpandedMediaEntries({});
                        if (game?.diary) {
                          const expandedCollapsedMap: Record<string, boolean> = {};
                          game.diary.forEach((e) => {
                            expandedCollapsedMap[e.id] = false;
                          });
                          setCollapsedEntries(expandedCollapsedMap);
                        }
                      }
                    }}
                    className={`h-10 px-2.5 sm:px-3 rounded-xl border transition-all flex items-center justify-center gap-1.5 cursor-pointer shadow-lg active:scale-95 shrink-0 ${
                      isReadingMode
                        ? "bg-gradient-to-r from-amber-500 to-orange-500 border-amber-300 text-zinc-950 shadow-amber-500/30 ring-2 ring-amber-400/50"
                        : "bg-zinc-900/90 hover:bg-zinc-800 border-zinc-700 text-zinc-300"
                    }`}
                    title={isReadingMode ? "Sair do Modo Leitura" : "Ativar Modo Leitura"}
                  >
                    <BookOpen size={16} className={isReadingMode ? "text-zinc-950 shrink-0" : "text-amber-400 shrink-0"} />
                    <span className="hidden sm:inline text-xs font-bold">
                      {isReadingMode ? "Leitura" : "Modo Leitura"}
                    </span>
                  </button>

                  {/* Editar Ficha */}
                  {!isReadingMode && game && (
                    <button
                      onClick={() => onEditClick(game)}
                      className="h-10 w-10 rounded-xl bg-gradient-to-r from-purple-950/90 to-pink-950/90 hover:from-purple-900 hover:to-pink-900 border border-purple-500/50 hover:border-purple-400 text-purple-200 transition-all flex items-center justify-center cursor-pointer shadow-lg active:scale-95 shrink-0"
                      title="Editar Ficha Completa do Jogo"
                    >
                      <Edit size={16} className="text-purple-300 shrink-0" />
                    </button>
                  )}

                  {/* Botão Overflow Menu "..." */}
                  {game && (
                    <div className="relative">
                      <button
                        onClick={() => {
                          playRetroSound("click");
                          setIsMoreMenuOpen(!isMoreMenuOpen);
                        }}
                        className={`h-10 px-3 rounded-xl border transition-all flex items-center justify-center gap-1 cursor-pointer shadow-md active:scale-95 shrink-0 ${
                          isMoreMenuOpen
                            ? "bg-cyan-500 text-zinc-950 border-cyan-400 font-extrabold"
                            : "bg-zinc-900 hover:bg-zinc-800 border-zinc-700 text-zinc-300 hover:text-white"
                        }`}
                        title="Mais opções e ferramentas"
                      >
                        <MoreHorizontal size={20} />
                      </button>

                      {/* Dropdown Menu Popup */}
                      <AnimatePresence>
                        {isMoreMenuOpen && (
                          <>
                            {/* Backdrop overlay to dismiss menu */}
                            <div
                              className="fixed inset-0 z-30"
                              onClick={() => setIsMoreMenuOpen(false)}
                            />

                            <motion.div
                              initial={{ opacity: 0, scale: 0.95, y: -8 }}
                              animate={{ opacity: 1, scale: 1, y: 0 }}
                              exit={{ opacity: 0, scale: 0.95, y: -8 }}
                              transition={{ duration: 0.15 }}
                              className="absolute right-0 top-12 z-40 w-72 bg-zinc-950 border border-zinc-800 rounded-2xl shadow-2xl p-2 text-zinc-200 space-y-1 backdrop-blur-xl"
                            >
                              <div className="px-3 py-1.5 text-[10px] font-mono font-bold uppercase tracking-wider text-cyan-400 border-b border-zinc-800/80 mb-1 flex items-center justify-between">
                                <span>Mais Opções & Ferramentas</span>
                                <Sparkles size={12} />
                              </div>

                              {/* Storytelling Slides */}
                              {onOpenStorytelling && (
                                <button
                                  onClick={() => {
                                    setIsMoreMenuOpen(false);
                                    onOpenStorytelling(game);
                                  }}
                                  className="w-full text-left px-3 py-2 rounded-xl text-xs font-bold flex items-center gap-2.5 hover:bg-purple-950/60 hover:text-purple-200 transition-colors cursor-pointer text-zinc-300"
                                >
                                  <Film size={16} className="text-purple-400 shrink-0" />
                                  <span>Slides / Storytelling 🎬</span>
                                </button>
                              )}

                              {/* Card Social */}
                              {onOpenSocialCard && (
                                <button
                                  onClick={() => {
                                    setIsMoreMenuOpen(false);
                                    onOpenSocialCard(game);
                                  }}
                                  className="w-full text-left px-3 py-2 rounded-xl text-xs font-bold flex items-center gap-2.5 hover:bg-pink-950/60 hover:text-pink-200 transition-colors cursor-pointer text-zinc-300"
                                >
                                  <Sparkles size={16} className="text-pink-400 shrink-0" />
                                  <span>Card Social 📸</span>
                                </button>
                              )}

                              {/* Export Markdown */}
                              <button
                                onClick={() => {
                                  setIsMoreMenuOpen(false);
                                  exportGameDiaryToMarkdown(game);
                                }}
                                className="w-full text-left px-3 py-2 rounded-xl text-xs font-bold flex items-center gap-2.5 hover:bg-cyan-950/60 hover:text-cyan-200 transition-colors cursor-pointer text-zinc-300"
                              >
                                <FileText size={16} className="text-cyan-400 shrink-0" />
                                <span>Exportar Diário (.MD) 📝</span>
                              </button>

                              {/* Export PDF */}
                              <button
                                onClick={() => {
                                  setIsMoreMenuOpen(false);
                                  exportGameDiaryToPrintPDF(game);
                                }}
                                className="w-full text-left px-3 py-2 rounded-xl text-xs font-bold flex items-center gap-2.5 hover:bg-emerald-950/60 hover:text-emerald-200 transition-colors cursor-pointer text-zinc-300"
                              >
                                <Download size={16} className="text-emerald-400 shrink-0" />
                                <span>Imprimir / Exportar PDF 🖨️</span>
                              </button>

                              {/* Download All Media */}
                              <button
                                onClick={() => {
                                  setIsMoreMenuOpen(false);
                                  downloadAllGameMedia();
                                }}
                                className="w-full text-left px-3 py-2 rounded-xl text-xs font-bold flex items-center gap-2.5 hover:bg-blue-950/60 hover:text-blue-200 transition-colors cursor-pointer text-zinc-300"
                              >
                                <Download size={16} className="text-blue-400 shrink-0" />
                                <span>Baixar Mídias (Imagens/Vídeos) 📥</span>
                              </button>

                              {/* Send Email */}
                              {onSendEmailClick && (
                                <button
                                  onClick={() => {
                                    setIsMoreMenuOpen(false);
                                    onSendEmailClick(game);
                                  }}
                                  className="w-full text-left px-3 py-2 rounded-xl text-xs font-bold flex items-center gap-2.5 hover:bg-amber-950/60 hover:text-amber-200 transition-colors cursor-pointer text-zinc-300"
                                >
                                  <Mail size={16} className="text-amber-400 shrink-0" />
                                  <span>Enviar por E-mail (Gmail) ✉️</span>
                                </button>
                              )}

                              {/* Deep Backup Drive */}
                              {onDeepBackupDrive && (
                                <button
                                  onClick={() => {
                                    setIsMoreMenuOpen(false);
                                    onDeepBackupDrive(game);
                                  }}
                                  className="w-full text-left px-3 py-2 rounded-xl text-xs font-bold flex items-center gap-2.5 hover:bg-teal-950/60 hover:text-teal-200 transition-colors cursor-pointer text-zinc-300"
                                >
                                  <HardDrive size={16} className="text-teal-400 shrink-0" />
                                  <span>Backup Profundo Google Drive ☁️</span>
                                </button>
                              )}

                              {/* Dicionário Gamer */}
                              <button
                                onClick={() => {
                                  setIsMoreMenuOpen(false);
                                  setIsDictionaryModalOpen(true);
                                }}
                                className="w-full text-left px-3 py-2 rounded-xl text-xs font-bold flex items-center gap-2.5 hover:bg-indigo-950/60 hover:text-indigo-200 transition-colors cursor-pointer text-zinc-300"
                              >
                                <BookOpen size={16} className="text-indigo-400 shrink-0" />
                                <span>Dicionário Gamer ({getDictionaryWordCount(game.dictionary)}) 📖</span>
                              </button>

                              {/* Estimate Playtime */}
                              {onOpenGameEstimateModal && (
                                <button
                                  onClick={() => {
                                    setIsMoreMenuOpen(false);
                                    onOpenGameEstimateModal(game);
                                  }}
                                  className="w-full text-left px-3 py-2 rounded-xl text-xs font-bold flex items-center gap-2.5 hover:bg-rose-950/60 hover:text-rose-200 transition-colors cursor-pointer text-zinc-300"
                                >
                                  <Calculator size={16} className="text-rose-400 shrink-0" />
                                  <span>Estimar Horas com IA (HLTB) ⏱️</span>
                                </button>
                              )}

                              <div className="border-t border-zinc-800/80 my-1 pt-1">
                                <button
                                  onClick={() => {
                                    setIsMoreMenuOpen(false);
                                    triggerAlert(
                                      "Provedor Descentralizado (BYOB) 🚀",
                                      "O sistema BYOB (Bring Your Own Backend) permite conectar suas próprias chaves do Firebase Firestore, ImgBB e Google Drive. Suas credenciais permanecem salvas localmente e isoladas!"
                                    );
                                  }}
                                  className="w-full text-left px-3 py-2 rounded-xl text-[11px] font-bold flex items-center gap-2.5 bg-zinc-900 hover:bg-zinc-800 text-cyan-300 transition-colors cursor-pointer"
                                >
                                  <Info size={14} className="text-cyan-400 shrink-0" />
                                  <span>Funções Futuras & BYOB 🚀</span>
                                </button>
                              </div>
                            </motion.div>
                          </>
                        )}
                      </AnimatePresence>
                    </div>
                  )}

                  {/* Botão Fechar - Fixo e Acessível */}
                  <button
                    onClick={onClose}
                    className="h-10 px-3 rounded-xl bg-zinc-900 hover:bg-rose-950/70 border border-zinc-800 hover:border-rose-500/50 text-zinc-300 hover:text-rose-300 flex items-center justify-center gap-1.5 transition-all shadow-md cursor-pointer font-bold text-xs shrink-0 active:scale-95"
                    title="Fechar Painel Detalhado (Esc)"
                  >
                    <X size={18} className="shrink-0" />
                    <span className="hidden md:inline uppercase text-[11px] tracking-wider">Fechar</span>
                  </button>
                </div>
              </div>

              {/* Scrollable Content wrapper */}
              <div className="flex-1 flex overflow-hidden">
                {/* Scrollable Content */}
                <div className="flex-1 overflow-y-auto pb-12 drawer-scrollable-container overscroll-contain">
                 {/* Hero Banner */}
                <div
                  ref={coverContainerRef}
                  onPointerDown={handlePointerDown}
                  onPointerMove={handlePointerMove}
                  onPointerUp={handlePointerUp}
                  onPointerCancel={handlePointerUp}
                  onClick={() => {
                    if (!isRepositioningCover && game.cover) {
                      handleOpenZoom(game.cover);
                    }
                  }}
                  style={{ touchAction: "none" }}
                  className={`relative h-56 sm:h-72 shrink-0 bg-black overflow-hidden group/banner ${
                    isAdmin && isRepositioningCover ? "cursor-move select-none" : "cursor-zoom-in"
                  }`}
                >
                  {!isRepositioningCover && game.cover && (
                    <div className="absolute top-4 right-4 z-20 opacity-0 group-hover/banner:opacity-100 transition-all duration-300 flex items-center gap-1.5 bg-black/70 backdrop-blur-md px-3 py-1.5 rounded-xl border border-zinc-700/80 text-xs font-bold text-white shadow-xl pointer-events-none">
                      <Maximize2 size={13} className="text-cyan-400" />
                      <span>Ampliar Banner</span>
                    </div>
                  )}
                  {isAdmin && isRepositioningCover && (
                    <div className="absolute top-4 left-4 bg-black/60 backdrop-blur-md text-zinc-300 text-[10px] uppercase tracking-widest font-bold px-2.5 py-1.5 rounded-lg border border-zinc-800/80 flex items-center gap-1.5 pointer-events-none select-none z-10">
                      <span className="animate-pulse text-cyan-400 font-bold">↕</span> Arraste para Mover • Scroll para Zoom
                    </div>
                  )}
                  {showSavedCoverNotification && (
                    <div className="absolute top-4 left-4 z-30 flex items-center gap-1.5 bg-emerald-500/95 text-white font-black text-[10px] uppercase tracking-widest px-2.5 py-1.5 rounded-lg border border-emerald-400/40 shadow-lg backdrop-blur-md animate-fade-in">
                      <Check size={11} className="text-white" />
                      Salvo
                    </div>
                  )}
                  {/* Background blurred cover to prevent cutoffs when zoom < 100% */}
                  <img
                    src={game.cover || "https://images.unsplash.com/photo-1542751371-adc38448a05e?q=80&w=1200"}
                    alt=""
                    className="absolute inset-0 w-full h-full object-cover blur-xl scale-110 opacity-50 select-none pointer-events-none"
                  />
                  <img
                    className="w-full h-full object-cover pointer-events-none select-none transform relative z-10"
                    src={game.cover || "https://images.unsplash.com/photo-1542751371-adc38448a05e?q=80&w=1200"}
                    alt={game.name}
                    referrerPolicy="no-referrer"
                    style={{
                      objectPosition: `${coverPosX}% ${coverPos}%`,
                      transformOrigin: `${coverPosX}% ${coverPos}%`,
                      transform: `scale(${Math.max(1, coverZoom / 100)})`,
                      objectFit: "cover",
                      userSelect: "none",
                      transition: isDragging ? "none" : "transform 0.3s ease-out",
                    }}
                    draggable={false}
                    onError={(e: any) => {
                      (e.target as HTMLImageElement).src = "https://placehold.co/1200x400/040406/ffffff?text=Sem+Capa";
                    }}
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-[#080a10] via-zinc-900/40 to-transparent pointer-events-none" />
                  
                  {isAdmin && (
                    <div 
                      className="absolute bottom-4 right-4 z-20 flex items-center gap-2"
                      onPointerDown={(e) => e.stopPropagation()}
                      onPointerUp={(e) => e.stopPropagation()}
                    >
                      {isRepositioningCover ? (
                        <>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setCoverPos(50);
                              setCoverPosX(50);
                              setCoverZoom(100);
                              coverPosRef.current = 50;
                              coverPosXRef.current = 50;
                              coverZoomRef.current = 100;
                              
                              if (onUpdateGame && game) {
                                onUpdateGame({
                                  ...game,
                                  coverPosition: 50,
                                  coverPositionX: 50,
                                  coverZoom: 100,
                                } as any);
                              }
                            }}
                            className="px-2.5 py-1.5 rounded-lg bg-zinc-950/90 hover:bg-zinc-800 text-zinc-200 border border-zinc-800 text-[10px] font-bold uppercase tracking-wider transition-all cursor-pointer shadow-lg flex items-center gap-1.5 animate-fade-in"
                            title="Restaurar Padrão"
                          >
                            <RotateCcw size={11} />
                            Restaurar
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setIsRepositioningCover(false);
                              if (onUpdateGame && game) {
                                onUpdateGame({
                                  ...game,
                                  coverPosition: coverPos,
                                  coverPositionX: coverPosX,
                                  coverZoom: coverZoom,
                                } as any);
                                setShowSavedCoverNotification(true);
                                setTimeout(() => {
                                  setShowSavedCoverNotification(false);
                                }, 2500);
                              }
                            }}
                            className="px-3 py-1.5 flex items-center gap-1.5 rounded-lg bg-emerald-500 hover:bg-emerald-600 text-white border border-emerald-400/30 font-extrabold text-[10px] uppercase tracking-wider transition-all duration-300 shadow-lg cursor-pointer animate-fade-in"
                            title="Concluir Ajuste"
                          >
                            <Check size={11} />
                            Concluir
                          </button>
                        </>
                      ) : (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setIsRepositioningCover(true);
                          }}
                          className="w-8 h-8 flex items-center justify-center rounded-lg bg-zinc-950/80 hover:bg-cyan-500 hover:text-black text-zinc-400 border border-zinc-800 font-extrabold text-xs tracking-widest transition-all duration-300 shadow-lg cursor-pointer opacity-0 group-hover/banner:opacity-100 hover:scale-110 active:scale-95"
                          title="Ajustar Capa"
                        >
                          ...
                        </button>
                      )}
                    </div>
                  )}
                </div>

                {/* Profile overlap */}
                <div className="px-4 sm:px-8 space-y-6 relative z-10 -mt-16 sm:-mt-24">
                  <div className="flex flex-col sm:flex-row sm:items-end gap-4">
                    <div 
                      onClick={() => {
                        if (game.icon && (game.iconType === "upload" || game.iconType === "url")) {
                          handleOpenZoom(game.icon);
                        } else if (game.cover) {
                          handleOpenZoom(game.cover);
                        }
                      }}
                      className="w-24 h-24 sm:w-28 sm:h-28 rounded-3xl bg-zinc-950 border-4 border-purple-500/30 overflow-hidden shadow-2xl flex items-center justify-center shrink-0 cursor-zoom-in group/icon relative"
                      title="Clique para ampliar imagem"
                    >
                      {renderIcon(game, "w-full h-full object-cover")}
                      <div className="absolute inset-0 bg-black/40 opacity-0 group-hover/icon:opacity-100 transition-all flex items-center justify-center text-white">
                        <Maximize2 size={20} />
                      </div>
                    </div>
                    <div className="pb-1 min-w-0">
                      <h2 className="text-3xl sm:text-4xl font-black text-white leading-tight break-words [text-shadow:_0_2px_10px_rgb(0_0_0_/_90%),_0_1px_3px_rgb(0_0_0_/_100%)] drop-shadow-[0_4px_12px_rgba(0,0,0,0.9)] flex items-center flex-wrap gap-2">
                        <span className="align-middle">{game.name}</span>
                        {game.trophy && game.trophy !== "none" && (
                          <span className="inline-flex align-middle shrink-0">
                            <TrophyBadge trophy={game.trophy} mode="detail" />
                          </span>
                        )}
                        {((steamAchieveData && steamAchieveData.percentage === 100) ||
                          (game.steamAchievementsCount !== undefined &&
                            game.steamAchievementsTotal !== undefined &&
                            game.steamAchievementsTotal > 0 &&
                            game.steamAchievementsCount === game.steamAchievementsTotal)) && (
                          <span className="inline-flex items-center gap-1.5 align-middle shrink-0 px-3 py-1 rounded-full bg-gradient-to-r from-amber-500/30 via-yellow-400/30 to-amber-500/30 border border-amber-400/80 text-amber-300 text-xs font-extrabold font-mono shadow-xl shadow-amber-500/20 animate-pulse">
                            <Sparkles size={14} className="text-yellow-300 shrink-0" />
                            <span>👑 100% Achiev.</span>
                          </span>
                        )}
                      </h2>
                      <p className="text-xs sm:text-sm text-cyan-300 uppercase tracking-wider font-bold mt-1 [text-shadow:_0_2px_10px_rgb(0_0_0_/_95%),_0_1px_3px_rgb(0_0_0_/_100%)] drop-shadow-[0_4px_12px_rgba(0,0,0,0.9)]">
                        {game.series || "Série autónoma"}
                      </p>
                    </div>
                  </div>

                  {/* Metadata Dashboard / Ficha Técnica */}
                  <div className="bg-zinc-950/80 rounded-2xl border-2 border-cyan-500/50 hover:border-cyan-500/80 shadow-md shadow-cyan-500/10 p-5 sm:p-6 space-y-4 transition-all">
                    <div className="text-xs uppercase tracking-[0.2em] text-cyan-300 font-mono font-bold pb-2 border-b border-cyan-500/30 flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Info size={16} className="text-cyan-400 shrink-0" />
                        <span>Ficha Técnica do Jogo</span>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-x-5 gap-y-4 text-xs">
                      <div title="Status de progresso atual no jogo">
                        <div className="text-zinc-400 text-xs uppercase tracking-wider font-bold mb-1">Status</div>
                        <div className="flex flex-wrap gap-1.5 items-center">
                          {(Array.isArray(game.status) ? game.status : typeof game.status === "string" ? [game.status] : []).map((s, idx) => (
                            <span key={`${s}-${idx}`} className={`px-2.5 py-1 rounded-lg text-xs font-extrabold shadow-sm ${chipClass(s)}`} title={`Status: ${s}`}>
                              {s}
                            </span>
                          ))}
                          {game.replayed && (
                            <span 
                              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold bg-violet-950/90 text-purple-200 border border-purple-500/40 cursor-help shadow-sm" 
                              data-tooltip={game.replayNote || `Status: Replay (${game.replayCount || 1}x)`}
                              data-tooltip-title={`Replay (${game.replayCount || 1}x)`}
                              data-tooltip-theme="purple"
                            >
                              <RotateCcw size={12} className="stroke-[2.5]" />
                              Replay ({(game.replayCount && game.replayCount > 0) ? game.replayCount : 1}x)
                            </span>
                          )}
                          {getDlcMode(game) !== "none" && (
                            <span 
                              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold bg-amber-950/90 text-amber-200 border border-amber-500/40 shadow-sm" 
                              title={getDlcMode(game) === "plus_dlc" ? "Status: Jogo Base + DLC" : "Status: Expansão / DLC"}
                            >
                              <Layers size={12} className="stroke-[2.5]" />
                              {getDlcMode(game) === "plus_dlc" ? "+DLC" : "DLC / Expansão"}
                            </span>
                          )}
                        </div>
                      </div>
                      <div title="Série, franquia ou universo do jogo">
                        <div className="text-zinc-400 text-xs uppercase tracking-wider font-bold mb-1">Série / Saga</div>
                        <div className="flex flex-wrap gap-1.5">
                          {game.series ? (
                            splitEntities(game.series).map((s, sIdx) => (
                              <span key={`${s}-${sIdx}`} className="px-2.5 py-1 rounded-lg bg-zinc-900 text-purple-200 text-xs font-bold border border-purple-900/40 shadow-sm">
                                {s}
                              </span>
                            ))
                          ) : (
                            <span className="text-zinc-500 italic text-xs">Não se aplica</span>
                          )}
                        </div>
                      </div>
                      <div title="Empresa publicadora / distribuidora do jogo">
                        <div className="text-zinc-400 text-xs uppercase tracking-wider font-bold mb-1">Publicadora</div>
                        <div className="flex flex-wrap gap-1.5">
                          {game.publisher ? (
                            splitEntities(game.publisher).map((p, pIdx) => (
                              <span key={`${p}-${pIdx}`} className="px-2.5 py-1 rounded-lg bg-zinc-900 text-zinc-200 text-xs font-semibold border border-zinc-800 shadow-sm">
                                {p}
                              </span>
                            ))
                          ) : (
                            <span className="text-zinc-500 italic text-xs">Desconhecido</span>
                          )}
                        </div>
                      </div>
                      {(getDlcMode(game) !== "none" || game.dlcNames) && (
                        <div title="DLCs e Expansões jogadas">
                          <div className="text-zinc-400 text-xs uppercase tracking-wider font-bold mb-1">DLCs / Expansões</div>
                          <div className="flex flex-wrap gap-1.5">
                            {game.dlcNames ? (
                              splitEntities(game.dlcNames).map((dlc, dIdx) => {
                                const parsedDlc = parseContextNote(dlc);
                                return (
                                  <span 
                                    key={`${dlc}-${dIdx}`}
                                    className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold bg-amber-950/60 text-amber-200 border border-amber-500/40 backdrop-blur-md cursor-help shadow-sm"
                                    data-tooltip={parsedDlc.note || `DLC: ${parsedDlc.main}`}
                                    data-tooltip-title={parsedDlc.note ? `DLC: ${parsedDlc.main}` : undefined}
                                    data-tooltip-theme="amber"
                                  >
                                    <Layers size={11} className="shrink-0 text-amber-400" />
                                    <span>{parsedDlc.main}</span>
                                  </span>
                                );
                              })
                            ) : (
                              <span className="text-amber-400/80 italic text-xs inline-flex items-center gap-1">
                                <Layers size={11} />
                                {getDlcMode(game) === "plus_dlc" ? "+DLC" : "DLC"}
                              </span>
                            )}
                          </div>
                        </div>
                      )}
                      <div title="Estúdio responsável pelo desenvolvimento do jogo">
                        <div className="text-zinc-400 text-xs uppercase tracking-wider font-bold mb-1">Estúdio/Developer</div>
                        <div className="flex flex-wrap gap-1.5">
                          {(() => {
                            const val = game.studio || game.developer;
                            return val ? (
                              splitEntities(val).map((std, sIdx) => (
                                <span key={`${std}-${sIdx}`} className="px-2.5 py-1 rounded-lg bg-zinc-900 text-zinc-200 text-xs font-semibold border border-zinc-800 shadow-sm">
                                  {std}
                                </span>
                              ))
                            ) : (
                              <span className="text-zinc-500 italic text-xs">Desconhecido</span>
                            );
                          })()}
                        </div>
                      </div>
                      <div title="Plataforma de jogo">
                        <div className="text-zinc-400 text-xs uppercase tracking-wider font-bold mb-1">Plataforma</div>
                        <div className="flex flex-wrap gap-1.5">
                          {splitEntities(game.platform || "PC").map((p, pIdx) => {
                            const parsedP = parseContextNote(p);
                            const style = getPlatformBadgeStyle(parsedP.main);
                            return (
                              <span 
                                key={`${p}-${pIdx}`}
                                className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold uppercase tracking-wider border backdrop-blur-md cursor-help shadow-sm ${style.text} ${style.border} ${style.bg}`}
                                data-tooltip={parsedP.note || `Plataforma: ${parsedP.main}`}
                                data-tooltip-title={parsedP.note ? `Plataforma: ${parsedP.main}` : undefined}
                                data-tooltip-theme="cyan"
                              >
                                <span>{parsedP.main}</span>
                              </span>
                            );
                          })}

                          {(game.integrationPlatform === "steam" || (!game.integrationPlatform && game.steamAppId)) && (
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-extrabold uppercase tracking-wider bg-blue-950/90 text-blue-300 border border-blue-500/50 shadow-sm shadow-blue-500/20" title={`Integrado via Steam (App ID: ${game.steamAppId || 'Vinc.'})`}>
                              <span className="w-2 h-2 rounded-full bg-blue-400 animate-pulse" />
                              <span>Steam Sync</span>
                            </span>
                          )}

                          {(game.integrationPlatform === "gog" || (!game.integrationPlatform && game.gogGameId)) && (
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-extrabold uppercase tracking-wider bg-purple-950/90 text-purple-300 border border-purple-500/50 shadow-sm shadow-purple-500/20" title={`Integrado via GOG Galaxy (Game ID: ${game.gogGameId || 'Vinc.'})`}>
                              <span className="w-2 h-2 rounded-full bg-purple-400 animate-pulse" />
                              <span>GOG Sync</span>
                            </span>
                          )}
                        </div>
                      </div>

                      {game.difficulty && (
                        <div title="Dificuldade selecionada ou jogada">
                          <div className="text-zinc-400 text-xs uppercase tracking-wider font-bold mb-1">Dificuldade</div>
                          <div className="flex flex-wrap gap-1.5">
                            {splitEntities(game.difficulty).map((d, dIdx) => {
                              const parsedD = parseContextNote(d);
                              return (
                                <span 
                                  key={`${d}-${dIdx}`}
                                  className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold uppercase tracking-wider bg-amber-950/50 text-amber-200 border border-amber-500/30 backdrop-blur-md cursor-help shadow-sm"
                                  data-tooltip={parsedD.note || `Dificuldade: ${parsedD.main}`}
                                  data-tooltip-title={parsedD.note ? `Dificuldade: ${parsedD.main}` : undefined}
                                  data-tooltip-theme="amber"
                                >
                                  <Shield size={11} className="shrink-0 opacity-90 text-amber-400" />
                                  <span>{parsedD.main}</span>
                                </span>
                              );
                            })}
                          </div>
                        </div>
                      )}

                      <div title="Data de lançamento oficial do jogo">
                        <div className="text-zinc-400 text-xs uppercase tracking-wider font-bold mb-1">Lançamento</div>
                        <div className="text-zinc-200 font-mono text-xs sm:text-sm font-semibold" title={`Data de Lançamento: ${formatDate(game.releaseDate)}`}>{formatDate(game.releaseDate)}</div>
                      </div>
                      <div title="Data em que iniciei a jogatina">
                        <div className="text-zinc-400 text-xs uppercase tracking-wider font-bold mb-1">Data Início</div>
                        <div className="text-zinc-200 font-mono text-xs sm:text-sm font-semibold" title={`Data de Início: ${formatDate(game.startDate)}`}>{formatDate(game.startDate)}</div>
                      </div>
                      <div title="Data em que finalizei ou encerrei a jogatina">
                        <div className="text-zinc-400 text-xs uppercase tracking-wider font-bold mb-1">Data Término</div>
                        <div className="text-zinc-200 font-mono text-xs sm:text-sm font-semibold truncate" title={`Data de Término: ${game.endDate ? formatDate(game.endDate) : "Ainda em progresso"}`}>
                          {game.endDate ? formatDate(game.endDate) : "Em aberto"}
                        </div>
                      </div>

                      {/* Valor Pago & Custo por Hora */}
                      <div title="Valor pago pelo jogo e custo por hora de jogo" className="col-span-2 sm:col-span-2 md:col-span-2 bg-emerald-950/20 rounded-xl p-3 border border-emerald-500/30 my-1 shadow-sm max-w-sm">
                        <div className="flex items-center justify-between gap-2 mb-1.5">
                          <div className="text-emerald-400 text-xs uppercase tracking-wider font-bold font-mono flex items-center gap-1.5">
                            <DollarSign size={13} className="text-emerald-400 shrink-0" />
                            <span>Valor Pago & Custo</span>
                          </div>
                          {onUpdateGame && (
                            !isEditingPrice ? (
                              <button
                                type="button"
                                onClick={() => {
                                  setPriceInput(game.pricePaid !== undefined && game.pricePaid !== null ? String(game.pricePaid) : "");
                                  setIsEditingPrice(true);
                                }}
                                className="text-[11px] text-emerald-400 hover:text-emerald-300 hover:underline font-bold transition-all cursor-pointer flex items-center gap-1"
                              >
                                <Edit size={10} />
                                <span>Ajustar</span>
                              </button>
                            ) : (
                              <div className="flex items-center gap-1.5">
                                <button
                                  type="button"
                                  onClick={handleSavePriceInDrawer}
                                  className="text-xs text-emerald-950 bg-emerald-400 hover:bg-emerald-300 px-2 py-0.5 rounded-md font-extrabold shadow-sm cursor-pointer transition-all"
                                >
                                  Salvar
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setIsEditingPrice(false)}
                                  className="text-xs text-zinc-400 hover:text-white px-1 py-0.5 cursor-pointer"
                                >
                                  Cancelar
                                </button>
                              </div>
                            )
                          )}
                        </div>

                        {isEditingPrice ? (
                          <div className="flex items-center gap-2 mt-1">
                            <div className="relative flex-1">
                              <span className="absolute left-2.5 top-1.5 text-xs font-bold font-mono text-emerald-400">R$</span>
                              <input
                                type="number"
                                step="0.01"
                                min="0"
                                value={priceInput}
                                onChange={(e) => setPriceInput(e.target.value)}
                                placeholder="149.90"
                                className="w-full bg-zinc-900 border border-emerald-500/60 rounded-lg pl-8 pr-2.5 py-1 text-xs text-emerald-200 font-mono font-bold focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
                                autoFocus
                                onKeyDown={(e) => {
                                  if (e.key === "Enter") handleSavePriceInDrawer();
                                  if (e.key === "Escape") setIsEditingPrice(false);
                                }}
                              />
                            </div>
                          </div>
                        ) : (
                          <div className="flex items-center justify-between flex-wrap gap-2 font-mono text-xs">
                            <div className="flex items-center gap-1.5">
                              <span className="text-xs sm:text-sm font-black text-emerald-300">
                                {game.pricePaid !== undefined && game.pricePaid !== null && game.pricePaid > 0
                                  ? `R$ ${game.pricePaid.toFixed(2).replace(".", ",")}`
                                  : game.pricePaid === 0
                                  ? "Gratuito (R$ 0,00)"
                                  : "Não informado"}
                              </span>
                            </div>

                            {(() => {
                              const hours = getTotalGamePlaytimeHours(game);
                              const price = typeof game.pricePaid === "number" ? game.pricePaid : 0;
                              if (price > 0 && hours > 0) {
                                const costPerHour = price / hours;
                                return (
                                  <div className="flex items-center gap-1 text-cyan-300 font-bold bg-cyan-950/60 px-2 py-0.5 rounded-lg border border-cyan-500/30">
                                    <span className="text-[9px] text-cyan-400/80 uppercase font-sans">Custo/h:</span>
                                    <span className="text-xs font-black">R$ {costPerHour.toFixed(2).replace(".", ",")}</span>
                                  </div>
                                );
                              }
                              return null;
                            })()}
                          </div>
                        )}
                      </div>

                      {/* Bloco: Tempo Investido */}
                      <div className="col-span-2 sm:col-span-3 md:col-span-4 bg-zinc-950/80 rounded-2xl p-4.5 border-2 border-teal-500/50 hover:border-teal-500/80 my-1 shadow-md shadow-teal-500/10 transition-all" title="Divisão do Tempo Investido">
                        <div className="space-y-2.5">
                          <div className="flex items-center justify-start gap-3 flex-wrap pb-2 border-b border-teal-500/30">
                            <div className="flex items-center gap-2">
                              <Clock size={16} className="text-teal-400 shrink-0" />
                              <span className="text-teal-300 text-xs uppercase tracking-wider font-extrabold font-mono">Tempo Investido</span>
                            </div>
                            {game.isGaaS && (
                              <div 
                                className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-xl bg-gradient-to-r from-violet-950 via-fuchsia-950 to-pink-950 text-pink-300 border border-pink-500/50 shadow-md cursor-help"
                                data-tooltip="Jogo como Serviço (GaaS) - Atividade e jogatina contínuas sem término estrito"
                                data-tooltip-title="Game as a Service ♾️"
                                data-tooltip-theme="pink"
                              >
                                <Infinity size={14} className="stroke-[2.5] text-pink-400 animate-pulse shrink-0" />
                                <span className="text-[10px] font-black uppercase tracking-wider font-mono">GaaS</span>
                              </div>
                            )}
                            {getGameTrophyItems(game).length > 0 && (
                              <div>
                                <TrophiesList trophies={getGameTrophyItems(game)} mode="detail" />
                              </div>
                            )}
                          </div>

                          <div className="flex items-center gap-2.5 font-mono flex-wrap">
                            {(() => {
                              const breakdown = getGameTimeBreakdown(game);
                              const parsedPlay = parseContextNote(breakdown.playtimeRaw);
                              const parsedAdd = parseContextNote(breakdown.additionalPlaytimeRaw);

                              return (
                                <>
                                  <div 
                                    className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-purple-950/50 text-purple-200 border border-purple-500/30 shadow-sm cursor-help" 
                                    data-tooltip={parsedPlay.note || `${breakdown.currentLabel}: ${breakdown.isGaaS || breakdown.isCurrentlyPlaying ? breakdown.currentTimeFormatted : breakdown.finalTimeFormatted}`}
                                    data-tooltip-title={parsedPlay.note ? `Contexto - ${breakdown.currentLabel}` : undefined}
                                    data-tooltip-theme="purple"
                                  >
                                    <Clock size={13} className="text-purple-400 shrink-0" />
                                    <span className="text-xs font-sans text-purple-300/80 font-medium">{breakdown.currentLabel}:</span>
                                    <strong className="text-sm sm:text-base font-extrabold font-mono text-purple-200">
                                      {breakdown.isGaaS || breakdown.isCurrentlyPlaying
                                        ? breakdown.currentTimeFormatted
                                        : breakdown.finalTimeFormatted}
                                    </strong>
                                  </div>

                                  <div 
                                    className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-cyan-950/50 text-cyan-200 border border-cyan-500/30 shadow-sm cursor-help" 
                                    data-tooltip={parsedAdd.note || `${breakdown.extraLabel}: ${breakdown.extraTimeFormatted}`}
                                    data-tooltip-title={parsedAdd.note ? `Contexto - ${breakdown.extraLabel}` : undefined}
                                    data-tooltip-theme="cyan"
                                  >
                                    <Clock size={13} className="text-cyan-400 shrink-0" />
                                    <span className="text-xs font-sans text-cyan-300/80 font-medium">{breakdown.extraLabel}:</span>
                                    <strong className="text-sm sm:text-base font-extrabold font-mono text-cyan-200">{breakdown.extraTimeFormatted}</strong>
                                  </div>

                                  <div 
                                    className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-emerald-950/60 text-emerald-200 font-bold border border-emerald-500/40 shadow-sm cursor-help" 
                                    title={`${breakdown.totalLabel}: Somatório do ${breakdown.currentLabel} + ${breakdown.extraLabel}`}
                                  >
                                    <Clock size={13} className="text-emerald-400 shrink-0" />
                                    <span className="text-xs font-sans text-emerald-300/80 font-medium">Total:</span>
                                    <strong className="text-sm sm:text-base font-extrabold font-mono text-emerald-300">{breakdown.totalTimeFormatted}</strong>
                                  </div>
                                </>
                              );
                            })()}

                            {onOpenGameEstimateModal && (
                              <button
                                type="button"
                                onClick={() => onOpenGameEstimateModal(game)}
                                className="px-3.5 py-1.5 rounded-xl bg-amber-950/80 hover:bg-amber-900/80 text-amber-300 border border-amber-500/40 text-xs font-bold font-mono flex items-center gap-1.5 transition-all cursor-pointer shadow-md hover:scale-[1.02] active:scale-95"
                                title="Calcular estimativa de tempo para terminar este jogo"
                              >
                                <Clock size={13} className="text-amber-400 shrink-0" />
                                <span>Calcular Estimativa</span>
                              </button>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Steam Web API Block - Only rendered for PC Platform games with a linked Steam App ID */}
                      {isPcPlatform(game.platform) && game.steamAppId && (
                        <div className="col-span-2 sm:col-span-3 md:col-span-4 mt-1 text-left">
                          <div className="bg-zinc-950/80 border-2 border-blue-500/50 hover:border-blue-500/80 rounded-2xl p-4.5 shadow-md shadow-blue-500/10 space-y-3 transition-all">
                            <div className="flex items-center justify-between gap-3 flex-wrap border-b border-blue-500/30 pb-2.5">
                              <div className="flex items-center gap-2">
                                <Gamepad2 size={16} className="text-blue-400 shrink-0" />
                                <span className="text-blue-300 text-xs uppercase tracking-wider font-extrabold font-mono">
                                  Integracao Steam Web API
                                </span>
                              </div>

                              <div className="flex items-center gap-2 flex-wrap">
                                <button
                                  type="button"
                                  onClick={handleSyncSteamInDrawer}
                                  disabled={isSyncingSteamDrawer}
                                  className="text-xs font-bold flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-blue-950/60 hover:bg-blue-900/80 border border-blue-500/40 text-blue-200 transition-all cursor-pointer disabled:opacity-50 shadow-sm"
                                  title="Atualizar horas, conquistas e ultima sessao direto da Steam"
                                >
                                  {isSyncingSteamDrawer ? (
                                    <Loader2 size={12} className="animate-spin text-blue-400" />
                                  ) : (
                                    <RefreshCw size={12} />
                                  )}
                                  <span>Sincronizar</span>
                                </button>

                                <a
                                  href={`steam://run/${game.steamAppId}`}
                                  className="text-xs font-bold flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-cyan-950/60 hover:bg-cyan-900/80 border border-cyan-500/40 text-cyan-200 transition-all cursor-pointer shadow-sm"
                                  title="Iniciar o jogo no aplicativo da Steam"
                                >
                                  <Play size={12} className="fill-current text-cyan-400" />
                                  <span>Abrir na Steam</span>
                                </a>
                              </div>
                            </div>

                            {/* CELEBRATION BANNER FOR UNLOCKED ACHIEVEMENTS */}
                            <AnimatePresence>
                              {celebrationData && (
                                <motion.div
                                  initial={{ opacity: 0, scale: 0.95, y: -10 }}
                                  animate={{ opacity: 1, scale: 1, y: 0 }}
                                  exit={{ opacity: 0, scale: 0.95, y: -10 }}
                                  className="relative overflow-hidden p-4 rounded-2xl bg-gradient-to-r from-amber-950/90 via-yellow-950/80 to-zinc-950/90 border-2 border-amber-400/70 text-amber-100 shadow-2xl shadow-amber-500/20"
                                >
                                  <div className="absolute inset-0 pointer-events-none overflow-hidden">
                                    <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-amber-400 via-yellow-200 to-amber-500 animate-pulse" />
                                    <motion.div
                                      animate={{ scale: [0.8, 1.2, 0.8], opacity: [0.3, 0.8, 0.3] }}
                                      transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
                                      className="absolute -top-10 -right-10 w-32 h-32 bg-amber-400/20 rounded-full blur-2xl"
                                    />
                                  </div>

                                  <div className="relative z-10 flex items-start justify-between gap-3">
                                    <div className="flex items-start gap-3 min-w-0">
                                      <div className="p-2.5 rounded-2xl bg-amber-500/20 border border-amber-400/40 text-amber-300 shrink-0">
                                        <Trophy size={22} className="animate-bounce text-amber-300" />
                                      </div>
                                      <div className="space-y-1.5 min-w-0">
                                        <div className="flex items-center gap-2 flex-wrap">
                                          <h4 className="font-extrabold text-xs sm:text-sm text-white tracking-wide flex items-center gap-1.5">
                                            <span>🎉 Novas Conquistas Desbloqueadas!</span>
                                          </h4>
                                          <span className="text-[10px] font-mono font-bold px-2.5 py-0.5 rounded-full bg-amber-400/20 text-yellow-300 border border-amber-400/40 uppercase">
                                            +{celebrationData.diff} Conquista{celebrationData.diff > 1 ? "s" : ""}
                                          </span>
                                        </div>
                                        <p className="text-xs text-amber-200/90 leading-relaxed">
                                          Parabéns pelo seu progresso em <strong className="text-white font-semibold">{celebrationData.gameName}</strong>! Você conquistou <strong className="text-yellow-300 font-bold font-mono">+{celebrationData.diff}</strong> conquista(s) desde o último sync!
                                        </p>

                                        <div className="pt-1 flex items-center gap-3">
                                          <div className="flex-1 bg-zinc-950/80 rounded-full h-2.5 overflow-hidden border border-amber-500/30">
                                            <motion.div
                                              initial={{ width: 0 }}
                                              animate={{ width: `${Math.round((celebrationData.unlockedCount / celebrationData.totalCount) * 100)}%` }}
                                              transition={{ duration: 1, ease: "easeOut" }}
                                              className="h-full bg-gradient-to-r from-amber-500 via-yellow-400 to-amber-300"
                                            />
                                          </div>
                                          <span className="text-xs font-mono font-bold text-amber-300 shrink-0">
                                            {celebrationData.unlockedCount} / {celebrationData.totalCount} ({Math.round((celebrationData.unlockedCount / celebrationData.totalCount) * 100)}%)
                                          </span>
                                        </div>
                                      </div>
                                    </div>

                                    <button
                                      type="button"
                                      onClick={() => setCelebrationData(null)}
                                      className="p-1.5 text-amber-300/70 hover:text-white rounded-lg hover:bg-amber-400/20 transition-colors cursor-pointer shrink-0"
                                      title="Fechar celebração"
                                    >
                                      <X size={16} />
                                    </button>
                                  </div>
                                </motion.div>
                              )}
                            </AnimatePresence>

                            {/* DISPLAY LINKED STEAM DATA */}
                            <div className="space-y-3">
                              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-1">
                                {/* Steam Playtime Card */}
                                <div className="p-3 rounded-xl bg-zinc-900/90 border border-blue-500/20 flex flex-col justify-between gap-2">
                                  <div className="flex items-center justify-between gap-2">
                                    <div className="flex items-center gap-2">
                                      <Clock size={14} className="text-blue-400" />
                                      <span className="text-xs uppercase tracking-wider text-zinc-400 font-bold font-sans">
                                        Tempo na Steam:
                                      </span>
                                    </div>
                                    <span className="font-extrabold text-blue-300 font-mono text-sm sm:text-base">
                                      {game.steamPlaytimeMinutes ? formatSteamPlaytime(game.steamPlaytimeMinutes) : "0h 0m"}
                                    </span>
                                  </div>

                                  {game.steamPlaytimeMinutes && game.steamPlaytimeMinutes > 0 && onUpdateGame && (
                                    <button
                                      type="button"
                                      onClick={handleCopySteamPlaytimeToPersonal}
                                      className="w-full mt-1 px-2.5 py-1.5 bg-blue-950/60 hover:bg-blue-900 border border-blue-500/40 text-blue-200 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-1.5 shadow-sm"
                                      title="Importar as horas registradas na Steam para o seu atributo de Tempo Investido Pessoal"
                                    >
                                      <ArrowRight size={12} className="text-blue-400" />
                                      <span>Copiar para Tempo Pessoal</span>
                                    </button>
                                  )}
                                </div>

                                {/* Last Session / Achievements */}
                                <div className="p-3 rounded-xl bg-zinc-900/90 border border-amber-500/20 space-y-2">
                                  <div className="flex items-center justify-between gap-2 text-xs">
                                    <span className="uppercase tracking-wider text-zinc-400 font-bold font-sans">
                                      Ultima Sessao:
                                    </span>
                                    <span className="font-mono font-semibold text-zinc-200">
                                      {formatLastPlayedDate(game.steamLastPlayedTimestamp) || "Desconhecido / Antigo"}
                                    </span>
                                  </div>

                                  {steamAchieveData && steamAchieveData.totalCount > 0 ? (
                                    <div className="pt-1.5 border-t border-zinc-800/80 space-y-1">
                                      <div className="flex items-center justify-between gap-2 text-xs">
                                        <div className="flex items-center gap-1.5">
                                          <Trophy size={13} className="text-amber-400 shrink-0" />
                                          <span className="uppercase tracking-wider text-zinc-400 font-bold font-sans">
                                            Conquistas:
                                          </span>
                                        </div>
                                        <span className="font-extrabold text-amber-300 font-mono">
                                          {steamAchieveData.unlockedCount} / {steamAchieveData.totalCount} ({steamAchieveData.percentage}%)
                                        </span>
                                      </div>
                                      <div className="w-full h-2 bg-zinc-950 rounded-full overflow-hidden border border-zinc-800">
                                        <div
                                          className="h-full bg-gradient-to-r from-amber-500 to-yellow-400 transition-all duration-500"
                                          style={{ width: `${steamAchieveData.percentage}%` }}
                                        />
                                      </div>
                                    </div>
                                  ) : game.steamAchievementsTotal && game.steamAchievementsTotal > 0 ? (
                                    <div className="pt-1.5 border-t border-zinc-800/80 space-y-1">
                                      <div className="flex items-center justify-between gap-2 text-xs">
                                        <div className="flex items-center gap-1.5">
                                          <Trophy size={13} className="text-amber-400 shrink-0" />
                                          <span className="uppercase tracking-wider text-zinc-400 font-bold font-sans">
                                            Conquistas:
                                          </span>
                                        </div>
                                        <span className="font-extrabold text-amber-300 font-mono">
                                          {game.steamAchievementsCount || 0} / {game.steamAchievementsTotal} ({Math.round(((game.steamAchievementsCount || 0) / game.steamAchievementsTotal) * 100)}%)
                                        </span>
                                      </div>
                                      <div className="w-full h-2 bg-zinc-950 rounded-full overflow-hidden border border-zinc-800">
                                        <div
                                          className="h-full bg-gradient-to-r from-amber-500 to-yellow-400 transition-all duration-500"
                                          style={{ width: `${Math.round(((game.steamAchievementsCount || 0) / game.steamAchievementsTotal) * 100)}%` }}
                                        />
                                      </div>
                                    </div>
                                  ) : (
                                    <div className="pt-1 text-[11px] text-zinc-500 italic">
                                      Conquistas nao encontradas ou perfil Steam privado.
                                    </div>
                                  )}
                                </div>
                              </div>

                              <div className="pt-1 text-xs text-zinc-400 flex items-center justify-between gap-2 flex-wrap">
                                <div className="flex items-center gap-2">
                                  <span>App ID:</span>
                                  <code className="bg-zinc-900 px-1.5 py-0.5 rounded text-zinc-300 font-mono text-xs">
                                    {game.steamAppId}
                                  </code>
                                </div>
                                <div className="flex items-center gap-3">
                                  <a
                                    href={`https://store.steampowered.com/app/${game.steamAppId}`}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="text-blue-400 hover:text-blue-300 hover:underline inline-flex items-center gap-1 text-[11px] font-medium"
                                  >
                                    Página da Loja ↗
                                  </a>
                                  <a
                                    href={`https://steamcommunity.com/stats/${game.steamAppId}/achievements`}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="text-amber-400 hover:text-amber-300 hover:underline inline-flex items-center gap-1 text-[11px] font-medium"
                                  >
                                    Comunidade & Conquistas ↗
                                  </a>
                                </div>
                              </div>

                              {/* STEAM ACHIEVEMENTS GALLERY & TIMELINE */}
                              {steamAchieveData && steamAchieveData.achievements && steamAchieveData.achievements.length > 0 && (
                                <div className="mt-4 border-t border-zinc-800/80 pt-4 space-y-3">
                                  {/* Section Title & Collapsible Header */}
                                  <div
                                    onClick={() => setIsAchievementsGalleryOpen((prev) => !prev)}
                                    className="flex items-center justify-between gap-2 p-3 rounded-xl bg-zinc-950/90 border border-zinc-800 hover:border-amber-500/40 cursor-pointer transition-all select-none group"
                                  >
                                    <div className="flex items-center gap-2 min-w-0">
                                      <Trophy size={16} className="text-amber-400 shrink-0 group-hover:scale-110 transition-transform" />
                                      <h4 className="font-extrabold text-sm text-white tracking-wide uppercase font-mono flex items-center gap-2 truncate">
                                        <span>Galeria de Conquistas Steam</span>
                                        <span className="text-xs font-normal text-zinc-400 normal-case font-sans">
                                          ({steamAchieveData.unlockedCount}/{steamAchieveData.totalCount})
                                        </span>
                                      </h4>
                                    </div>

                                    <div className="flex items-center gap-2 shrink-0">
                                      {/* 100% Perfect Game / Platinum Badge */}
                                      {steamAchieveData.percentage === 100 && (
                                        <div className="px-2.5 py-0.5 bg-gradient-to-r from-amber-500/20 via-yellow-400/20 to-amber-500/20 border border-amber-400/50 rounded-full text-amber-300 text-[10px] sm:text-xs font-extrabold font-mono flex items-center gap-1.5 shadow-lg shadow-amber-500/10 animate-pulse">
                                          <Sparkles size={12} className="text-yellow-300" />
                                          <span>👑 100% Achiev.</span>
                                        </div>
                                      )}
                                      <div className="p-1 rounded-lg bg-zinc-900 border border-zinc-700 text-zinc-300 group-hover:text-amber-400 transition-colors">
                                        {isAchievementsGalleryOpen ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                                      </div>
                                    </div>
                                  </div>

                                  {/* Collapsible Content */}
                                  {isAchievementsGalleryOpen && (
                                    <div className="space-y-3 pt-1 animate-fade-in">
                                      {/* Filter Controls Bar */}
                                      <div className="flex items-center justify-between gap-2 flex-wrap bg-zinc-950/80 p-2.5 rounded-xl border border-zinc-800">
                                        {/* Tabs */}
                                        <div className="flex items-center gap-1 overflow-x-auto text-xs font-semibold">
                                          <button
                                            type="button"
                                            onClick={() => setAchievementsFilter("all")}
                                            className={`px-2.5 py-1 rounded-lg transition-colors cursor-pointer ${
                                              achievementsFilter === "all"
                                                ? "bg-amber-500/20 text-amber-300 border border-amber-500/30 font-bold"
                                                : "text-zinc-400 hover:text-white hover:bg-zinc-900"
                                            }`}
                                          >
                                            Todas ({steamAchieveData.achievements.length})
                                          </button>
                                          <button
                                            type="button"
                                            onClick={() => setAchievementsFilter("unlocked")}
                                            className={`px-2.5 py-1 rounded-lg transition-colors cursor-pointer ${
                                              achievementsFilter === "unlocked"
                                                ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 font-bold"
                                                : "text-zinc-400 hover:text-white hover:bg-zinc-900"
                                            }`}
                                          >
                                            Desbloqueadas ({steamAchieveData.unlockedCount})
                                          </button>
                                          <button
                                            type="button"
                                            onClick={() => setAchievementsFilter("locked")}
                                            className={`px-2.5 py-1 rounded-lg transition-colors cursor-pointer ${
                                              achievementsFilter === "locked"
                                                ? "bg-zinc-800 text-zinc-200 border border-zinc-700 font-bold"
                                                : "text-zinc-400 hover:text-white hover:bg-zinc-900"
                                            }`}
                                          >
                                            Bloqueadas ({steamAchieveData.totalCount - steamAchieveData.unlockedCount})
                                          </button>
                                          <button
                                            type="button"
                                            onClick={() => setAchievementsFilter("rare")}
                                            className={`px-2.5 py-1 rounded-lg transition-colors cursor-pointer flex items-center gap-1 ${
                                              achievementsFilter === "rare"
                                                ? "bg-purple-500/20 text-purple-300 border border-purple-500/30 font-bold"
                                                : "text-zinc-400 hover:text-white hover:bg-zinc-900"
                                            }`}
                                          >
                                            <Sparkles size={12} className="text-purple-400" />
                                            <span>Ultra Raras</span>
                                          </button>
                                        </div>

                                        {/* Search & Sort */}
                                        <div className="flex items-center gap-2 text-xs w-full sm:w-auto">
                                          <input
                                            type="text"
                                            placeholder="Buscar conquista..."
                                            value={achievementsSearch}
                                            onChange={(e) => setAchievementsSearch(e.target.value)}
                                            className="bg-zinc-900 border border-zinc-800 text-zinc-200 text-xs rounded-lg px-2.5 py-1 focus:outline-none focus:border-amber-500/50 w-full sm:w-36"
                                          />
                                          <select
                                            value={achievementsSort}
                                            onChange={(e) => setAchievementsSort(e.target.value as any)}
                                            className="bg-zinc-900 border border-zinc-800 text-zinc-300 text-xs rounded-lg px-2 py-1 focus:outline-none focus:border-amber-500/50 cursor-pointer"
                                          >
                                            <option value="unlocked_first">Desbloqueadas 1º</option>
                                            <option value="rare_first">Mais Raras 1º (%)</option>
                                            <option value="recent">Recentes 1º</option>
                                          </select>
                                        </div>
                                      </div>

                                      {/* Achievements List Grid */}
                                      {processedAchievements.length > 0 ? (
                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 max-h-96 overflow-y-auto pr-1 custom-scrollbar">
                                          {processedAchievements.map((ach) => {
                                            const isUnlocked = ach.achieved === 1;
                                            const iconSrc = isUnlocked
                                              ? ach.icon || ach.icongray
                                              : ach.icongray || ach.icon;

                                            return (
                                              <div
                                                key={ach.apiname}
                                                className={`p-2.5 rounded-xl border transition-all flex items-start gap-3 relative overflow-hidden group ${
                                                  isUnlocked
                                                    ? "bg-zinc-900/90 border-amber-500/30 hover:border-amber-400/60 shadow-sm"
                                                    : "bg-zinc-950/60 border-zinc-800/80 opacity-70 hover:opacity-100"
                                                }`}
                                              >
                                                {/* Achievement Icon */}
                                                <div className="relative shrink-0">
                                                  {iconSrc ? (
                                                    <img
                                                      src={iconSrc}
                                                      alt={ach.name || ach.apiname}
                                                      className={`w-12 h-12 rounded-lg object-cover border ${
                                                        isUnlocked
                                                          ? "border-amber-400/50 shadow-md"
                                                          : "border-zinc-800 grayscale opacity-60"
                                                      }`}
                                                      loading="lazy"
                                                    />
                                                  ) : (
                                                    <div
                                                      className={`w-12 h-12 rounded-lg border flex items-center justify-center ${
                                                        isUnlocked
                                                          ? "bg-amber-500/20 border-amber-400/40 text-amber-300"
                                                          : "bg-zinc-900 border-zinc-800 text-zinc-600"
                                                      }`}
                                                    >
                                                      <Trophy size={20} />
                                                    </div>
                                                  )}

                                                  {/* Checkmark overlay for unlocked */}
                                                  {isUnlocked && (
                                                    <div className="absolute -bottom-1 -right-1 bg-emerald-500 text-zinc-950 rounded-full p-0.5 border border-zinc-900 shadow">
                                                      <Check size={10} className="font-bold stroke-[3]" />
                                                    </div>
                                                  )}
                                                </div>

                                                {/* Achievement Info */}
                                                <div className="min-w-0 flex-1 space-y-1">
                                                  <div className="flex items-center justify-between gap-1 flex-wrap">
                                                    <h5
                                                      className={`font-bold text-xs leading-snug truncate ${
                                                        isUnlocked ? "text-zinc-100" : "text-zinc-400"
                                                      }`}
                                                      title={ach.name || ach.apiname}
                                                    >
                                                      {ach.name || ach.apiname}
                                                    </h5>

                                                    {/* Ultra Rare / Global Percent Badge */}
                                                    {ach.globalPercent !== undefined && (
                                                      <span
                                                        className={`text-[9px] font-mono font-bold px-1.5 py-0.5 rounded-full border shrink-0 ${
                                                          ach.isUltraRare || ach.globalPercent <= 10
                                                            ? "bg-purple-950/80 text-purple-300 border-purple-500/40"
                                                            : "bg-zinc-900 text-zinc-400 border-zinc-800"
                                                        }`}
                                                        title="Porcentagem de todos os jogadores da Steam que possuem esta conquista"
                                                      >
                                                        {ach.isUltraRare || ach.globalPercent <= 10 ? "💎 " : ""}
                                                        {ach.globalPercent}%
                                                      </span>
                                                    )}
                                                  </div>

                                                  <p className="text-[11px] text-zinc-400 leading-tight line-clamp-2">
                                                    {ach.description || "Conquista secreta ou sem descrição."}
                                                  </p>

                                                  {/* Unlock timestamp */}
                                                  {isUnlocked && ach.unlocktime > 0 && (
                                                    <span className="text-[9px] font-mono text-amber-400/90 font-medium flex items-center gap-1 pt-0.5">
                                                      <Clock size={9} />
                                                      <span>
                                                        Desbloqueado em:{" "}
                                                        {new Date(ach.unlocktime * 1000).toLocaleString("pt-BR", {
                                                          day: "2-digit",
                                                          month: "2-digit",
                                                          year: "numeric",
                                                          hour: "2-digit",
                                                          minute: "2-digit",
                                                        })}
                                                      </span>
                                                    </span>
                                                  )}
                                                </div>
                                              </div>
                                            );
                                          })}
                                        </div>
                                      ) : (
                                        <div className="p-4 bg-zinc-950 rounded-xl border border-zinc-800 text-center text-xs text-zinc-400">
                                          Nenhuma conquista encontrada com os filtros selecionados.
                                        </div>
                                      )}
                                    </div>
                                  )}
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      )}

                      {(game.hltbId || game.hltbMain || game.hltbExtra || game.hltbCompletionist) && (
                        <div className="col-span-2 sm:col-span-3 md:col-span-4 bg-zinc-950/80 rounded-2xl p-4.5 border-2 border-purple-500/50 hover:border-purple-500/80 shadow-md shadow-purple-500/10 mt-1 text-left space-y-3 transition-all">
                          <div className="flex items-center justify-between gap-3 flex-wrap border-b border-purple-500/30 pb-2">
                            <div className="flex items-center gap-2">
                              <Globe size={16} className="text-purple-400 shrink-0" />
                              <span className="text-purple-300 text-xs uppercase tracking-wider font-extrabold font-mono">HowLongToBeat (Médias da Comunidade)</span>
                            </div>
                            {game.hltbId && (
                              <button
                                type="button"
                                onClick={isAdmin ? handleSyncHltb : () => triggerAlert("Modo Admin Necessário", "É necessário ativar o Modo Admin para atualizar e persistir os dados do HowLongToBeat.") }
                                disabled={isSyncingHltb}
                                className={`text-xs font-bold flex items-center gap-1.5 px-3 py-1.5 rounded-xl transition-all cursor-pointer disabled:opacity-50 select-none shadow-sm ${
                                  isAdmin 
                                    ? "text-amber-300 bg-amber-950/40 hover:bg-amber-900/50 border border-amber-500/40" 
                                    : "text-zinc-400 bg-zinc-900 border border-zinc-800 hover:text-white"
                                  }`}
                                title={isAdmin ? "Sincronizar médias mais recentes diretamente do HowLongToBeat" : "Ative o Modo Admin para poder atualizar"}
                              >
                                {isSyncingHltb ? (
                                  <Loader2 size={12} className="animate-spin text-amber-400" />
                                ) : (
                                  <RefreshCw size={12} />
                                )}
                                <span>{isAdmin ? "Atualizar HLTB" : "Sincronizar (Requer Admin)"}</span>
                              </button>
                            )}
                          </div>
                          
                          <div className="flex flex-wrap items-center gap-x-6 gap-y-2.5 mt-2 text-zinc-200">
                            <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-zinc-900/80 border border-purple-500/20 shadow-sm">
                              <span className="text-xs uppercase tracking-wider text-zinc-400 font-bold font-sans">Campanha:</span>
                              <span className="font-extrabold text-purple-300 font-mono text-sm sm:text-base">
                                {formatHltbTime(game.hltbMain) || "—"}
                              </span>
                            </div>
                            <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-zinc-900/80 border border-cyan-500/20 shadow-sm">
                              <span className="text-xs uppercase tracking-wider text-zinc-400 font-bold font-sans">História + Extras:</span>
                              <span className="font-extrabold text-cyan-300 font-mono text-sm sm:text-base">
                                {formatHltbTime(game.hltbExtra) || "—"}
                              </span>
                            </div>
                            <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-zinc-900/80 border border-pink-500/20 shadow-sm">
                              <span className="text-xs uppercase tracking-wider text-zinc-400 font-bold font-sans">Complecionista:</span>
                              <span className="font-extrabold text-pink-300 font-mono text-sm sm:text-base">
                                {formatHltbTime(game.hltbCompletionist) || "—"}
                              </span>
                            </div>
                          </div>
                          
                          {game.hltbId && (
                            <div className="mt-2 text-xs text-zinc-400 flex items-center gap-2 flex-wrap">
                              <span>ID HLTB:</span>
                              <code className="bg-zinc-900 px-1.5 py-0.5 rounded text-zinc-300 font-mono text-xs">{game.hltbId}</code>
                              <span className="text-zinc-700">|</span>
                              <a 
                                href={`https://howlongtobeat.com/game/${game.hltbId}`} 
                                target="_blank" 
                                rel="noreferrer"
                                className="text-purple-400 hover:text-purple-300 hover:underline inline-flex items-center gap-1 font-medium"
                              >
                                Ver no site oficial ↗
                              </a>
                            </div>
                          )}
                        </div>
                      )}

                      {/* Bloco: Métricas de Avaliação */}
                      <div className="col-span-2 sm:col-span-3 md:col-span-4 bg-zinc-950/80 rounded-2xl p-4.5 border-2 border-amber-500/50 hover:border-amber-500/80 shadow-md shadow-amber-500/10 mt-1 text-left space-y-3 transition-all">
                        <div className="flex items-center justify-between gap-3 flex-wrap border-b border-amber-500/30 pb-2">
                          <div className="flex items-center gap-2">
                            <Star size={16} className="text-amber-400 shrink-0" />
                            <span className="text-amber-300 text-xs uppercase tracking-wider font-extrabold font-mono">Métricas de Avaliação</span>
                          </div>
                          {game.metacriticUrl && (
                            <button
                              type="button"
                              onClick={isAdmin ? () => handleSyncMetacritic() : () => triggerAlert("Modo Admin Necessário", "É necessário ativar o Modo Admin para atualizar e persistir os dados do Metacritic.") }
                              disabled={isSyncingMetacritic}
                              className={`text-xs font-bold flex items-center gap-1.5 px-3 py-1.5 rounded-xl transition-all cursor-pointer disabled:opacity-50 select-none shadow-sm ${
                                isAdmin 
                                  ? "text-amber-300 bg-amber-950/40 hover:bg-amber-900/50 border border-amber-500/40" 
                                  : "text-zinc-400 bg-zinc-900 border border-zinc-800 hover:text-white"
                                }`}
                              title={isAdmin ? "Sincronizar médias mais recentes diretamente do Metacritic" : "Ative o Modo Admin para poder atualizar"}
                            >
                              {isSyncingMetacritic ? (
                                <Loader2 size={12} className="animate-spin text-amber-400" />
                              ) : (
                                <RefreshCw size={12} />
                              )}
                              <span>{isAdmin ? "Atualizar Metacritic" : "Sincronizar (Requer Admin)"}</span>
                            </button>
                          )}
                        </div>
                        
                        <div className="flex flex-wrap items-center gap-x-6 gap-y-2.5 mt-2 text-zinc-200">
                          <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-zinc-900/80 border border-zinc-700/50 shadow-sm">
                            <span className="text-xs uppercase tracking-wider text-zinc-400 font-bold font-sans">Nota Pessoal:</span>
                            <div className="flex items-center gap-1.5">
                              <span className="font-extrabold text-zinc-200 font-mono text-sm sm:text-base">({game.rating || 0})</span>
                              {renderStars(game.rating || 0, `${game.id}-drawer-personal`, "w-4 h-4")}
                            </div>
                          </div>
                          {game.metacriticCritScore !== undefined && game.metacriticCritScore !== null && (
                            <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-zinc-900/80 border border-amber-500/30 shadow-sm">
                              <span className="text-xs uppercase tracking-wider text-amber-400 font-bold font-sans">Metascore:</span>
                              <div className="flex items-center gap-1.5">
                                <span className="font-extrabold text-amber-300 font-mono text-sm sm:text-base">({game.metacriticCritScore})</span>
                                {renderStars(Math.round((game.metacriticCritScore / 20) * 2) / 2, `${game.id}-drawer-crit`, "w-4 h-4", "", game.metacriticCritScore >= 95)}
                              </div>
                            </div>
                          )}
                          {game.metacriticUserScore !== undefined && game.metacriticUserScore !== null && (
                            <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-zinc-900/80 border border-cyan-500/30 shadow-sm">
                              <span className="text-xs uppercase tracking-wider text-cyan-400 font-bold font-sans">Usuários:</span>
                              <div className="flex items-center gap-1.5">
                                <span className="font-extrabold text-cyan-300 font-mono text-sm sm:text-base">({game.metacriticUserScore.toFixed(1)})</span>
                                {renderStars(Math.round((game.metacriticUserScore / 2) * 2) / 2, `${game.id}-drawer-user`, "w-4 h-4", "", game.metacriticUserScore >= 9.5)}
                              </div>
                            </div>
                          )}
                        </div>

                        {isAdmin && drawerMetacriticPlatforms.length > 0 && (
                          <div className="mt-3 flex items-center gap-2">
                            <span className="text-xs uppercase tracking-wider text-zinc-400 font-bold font-sans">Versão da Nota:</span>
                            <select
                              value={selectedDrawerPlatform}
                              onChange={(e) => {
                                const newPlat = e.target.value;
                                setSelectedDrawerPlatform(newPlat);
                                handleSyncMetacritic(newPlat);
                              }}
                              disabled={isSyncingMetacritic}
                              className="bg-zinc-950 border border-zinc-800 rounded-lg px-2.5 py-1 text-xs text-zinc-200 focus:outline-none focus:ring-1 focus:ring-amber-500 cursor-pointer disabled:opacity-50"
                            >
                              <option value="">Geral (Média Principal)</option>
                              {drawerMetacriticPlatforms.map((p) => (
                                <option key={p.code} value={p.code}>
                                  {p.name}
                                </option>
                              ))}
                            </select>
                          </div>
                        )}
                        
                        {game.metacriticUrl && (
                          <div className="mt-1.5 text-[9px] text-zinc-500 flex items-center gap-1.5 flex-wrap">
                            <a 
                              href={game.metacriticUrl} 
                              target="_blank" 
                              rel="noreferrer"
                              className="text-amber-400/80 hover:text-amber-300 hover:underline inline-flex items-center gap-0.5"
                            >
                              Ver no Metacritic oficial ↗
                            </a>
                          </div>
                        )}
                      </div>
                        
                        {/* Pros & Cons Display Section */}
                        {(() => {
                          const prosList = game.pros
                            ? splitEntities(game.pros)
                                .filter(Boolean)
                                .sort((a, b) => parseProConTopic(a).topic.localeCompare(parseProConTopic(b).topic, "pt", { sensitivity: "base" }))
                            : [];
                          const consList = game.cons
                            ? splitEntities(game.cons)
                                .filter(Boolean)
                                .sort((a, b) => parseProConTopic(a).topic.localeCompare(parseProConTopic(b).topic, "pt", { sensitivity: "base" }))
                            : [];

                          return (
                            <div className="mt-3 col-span-2 sm:col-span-3 md:col-span-4 bg-zinc-950/80 rounded-2xl p-4.5 border-2 border-emerald-500/50 hover:border-emerald-500/80 shadow-md shadow-emerald-500/10 space-y-3 transition-all">
                              <div className="flex items-center gap-2 pb-2 border-b border-emerald-500/30">
                                <ThumbsUp size={16} className="text-emerald-400 shrink-0" />
                                <span className="text-emerald-300 text-xs uppercase tracking-wider font-extrabold font-mono">Prós e Contras</span>
                              </div>
                              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                              {/* + Prós */}
                              <div className="p-3 rounded-2xl bg-emerald-950/20 border border-emerald-500/20 space-y-1.5">
                                <div className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-emerald-400 font-mono">
                                  <ThumbsUp size={13} className="text-emerald-400 shrink-0" />
                                  <span>+ Prós (Pontos Positivos)</span>
                                  {prosList.length > 0 && (
                                    <span className="text-[10px] text-emerald-400/60 font-mono font-normal">({prosList.length})</span>
                                  )}
                                </div>
                                {prosList.length > 0 ? (
                                  <ul className={`text-xs text-emerald-200/90 font-medium pl-1 ${
                                    prosList.length >= 10
                                      ? "grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-1.5"
                                      : "space-y-1.5"
                                  }`}>
                                    {prosList.map((proRaw, pIdx) => {
                                      const { topic, note } = parseProConTopic(proRaw);
                                      return (
                                        <li key={pIdx} className="flex items-start gap-1.5 min-w-0">
                                          <span className="text-emerald-400 font-bold shrink-0">+</span>
                                          <div 
                                            className="inline-flex items-center gap-1.5 min-w-0 flex-wrap cursor-help"
                                            data-tooltip={note || topic}
                                            data-tooltip-title={note ? `Pró: ${topic}` : undefined}
                                            data-tooltip-theme="emerald"
                                          >
                                            <span className="break-words font-medium text-emerald-100">{topic}</span>
                                            {note && (
                                              <span className="px-1.5 py-0.2 rounded bg-emerald-900/80 text-emerald-300 border border-emerald-500/40 font-mono text-[9px] uppercase tracking-wider shrink-0">
                                                info
                                              </span>
                                            )}
                                          </div>
                                        </li>
                                      );
                                    })}
                                  </ul>
                                ) : (
                                  <p className="text-[11px] text-zinc-500 italic">Nenhum ponto positivo cadastrado.</p>
                                )}
                              </div>

                              {/* - Contras */}
                              <div className="p-3 rounded-2xl bg-rose-950/20 border border-rose-500/20 space-y-1.5">
                                <div className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-rose-400 font-mono">
                                  <ThumbsDown size={13} className="text-rose-400 shrink-0" />
                                  <span>- Contras (Pontos Negativos)</span>
                                  {consList.length > 0 && (
                                    <span className="text-[10px] text-rose-400/60 font-mono font-normal">({consList.length})</span>
                                  )}
                                </div>
                                {consList.length > 0 ? (
                                  <ul className={`text-xs text-rose-200/90 font-medium pl-1 ${
                                    consList.length >= 10
                                      ? "grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-1.5"
                                      : "space-y-1.5"
                                  }`}>
                                    {consList.map((conRaw, cIdx) => {
                                      const { topic, note } = parseProConTopic(conRaw);
                                      return (
                                        <li key={cIdx} className="flex items-start gap-1.5 min-w-0">
                                          <span className="text-rose-400 font-bold shrink-0">-</span>
                                          <div 
                                            className="inline-flex items-center gap-1.5 min-w-0 flex-wrap cursor-help"
                                            data-tooltip={note || topic}
                                            data-tooltip-title={note ? `Contra: ${topic}` : undefined}
                                            data-tooltip-theme="rose"
                                          >
                                            <span className="break-words font-medium text-rose-100">{topic}</span>
                                            {note && (
                                              <span className="px-1.5 py-0.2 rounded bg-rose-900/80 text-rose-300 border border-rose-500/40 font-mono text-[9px] uppercase tracking-wider shrink-0">
                                                info
                                              </span>
                                            )}
                                          </div>
                                        </li>
                                      );
                                    })}
                                  </ul>
                                ) : (
                                  <p className="text-[11px] text-zinc-500 italic">Nenhum ponto negativo cadastrado.</p>
                                )}
                              </div>
                            </div>
                          </div>
                        );
                      })()}

                      {/* Bloco: Gêneros */}
                      <div className="col-span-2 sm:col-span-3 md:col-span-4 bg-zinc-950/80 rounded-2xl p-4 border-2 border-fuchsia-500/50 hover:border-fuchsia-500/80 shadow-md shadow-fuchsia-500/10 mt-1 transition-all">
                        <div className="flex flex-col sm:flex-row sm:items-center gap-2">
                          <div className="flex items-center gap-1.5 w-24 shrink-0">
                            <Gamepad2 size={16} className="text-fuchsia-400 shrink-0" />
                            <span className="text-xs uppercase tracking-wider text-fuchsia-300 font-extrabold font-mono">Gêneros:</span>
                          </div>
                          <div className="flex flex-wrap gap-1.5">
                            {[...game.genre].sort((a, b) => a.localeCompare(b, "pt", { sensitivity: "base" })).map((g, idx) => (
                              <span key={`${g}-${idx}`} className="px-2.5 py-1 rounded-lg bg-fuchsia-950/40 text-fuchsia-200 text-xs font-bold border border-fuchsia-500/40 shadow-sm">
                                {g}
                              </span>
                            ))}
                          </div>
                        </div>
                      </div>

                      {/* Bloco: Tags / Etiquetas */}
                      <div className="col-span-2 sm:col-span-3 md:col-span-4 bg-zinc-950/80 rounded-2xl p-4 border-2 border-cyan-500/50 hover:border-cyan-500/80 shadow-md shadow-cyan-500/10 mt-1 transition-all">
                        <div className="flex flex-col sm:flex-row sm:items-center gap-2">
                          <div className="flex items-center gap-1.5 w-24 shrink-0">
                            <Tag size={16} className="text-cyan-400 shrink-0" />
                            <span className="text-xs uppercase tracking-wider text-cyan-300 font-extrabold font-mono">Tags:</span>
                          </div>
                          <div className="flex flex-wrap gap-1.5">
                            {[...game.tags].sort((a, b) => a.localeCompare(b, "pt", { sensitivity: "base" })).map((t, idx) => (
                              <span key={`${t}-${idx}`} className="px-2.5 py-1 rounded-lg bg-cyan-950/40 text-cyan-200 text-xs font-bold border border-cyan-500/40 shadow-sm">
                                {t}
                              </span>
                            ))}
                            {game.tags.length === 0 && (
                              <span className="text-xs text-zinc-500 italic">Nenhuma tag atribuída.</span>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Reading Mode Banner */}
                  {isReadingMode && (
                    <motion.div
                      initial={{ opacity: 0, y: -8 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="p-4 rounded-2xl bg-gradient-to-r from-amber-950/80 via-orange-950/60 to-zinc-950 border border-amber-500/40 flex flex-wrap items-center justify-between gap-3 text-amber-200 text-xs shadow-xl"
                    >
                      <div className="flex items-center gap-2.5">
                        <BookOpen size={18} className="text-amber-400 shrink-0" />
                        <div>
                          <p className="font-extrabold text-amber-100 uppercase tracking-wider text-[11px] font-mono">
                            Modo de Leitura e Revisão Imersivo Ativo
                          </p>
                          <p className="text-zinc-300 text-xs font-medium">
                            Controles de edição ocultos para focar inteiramente na leitura da sua jornada e mídias.
                          </p>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => setIsReadingMode(false)}
                        className="px-3 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-zinc-950 font-extrabold text-xs transition-all cursor-pointer shadow-md"
                      >
                        Sair do Modo Leitura
                      </button>
                    </motion.div>
                  )}

                  {/* Bloco: Diário da Jogatina */}
                  <div className="bg-zinc-950/80 rounded-2xl p-5 border-2 border-cyan-500/50 hover:border-cyan-500/80 shadow-md shadow-cyan-500/10 space-y-4 transition-all">
                    <div className="flex items-center justify-between gap-3 pb-2.5 border-b border-cyan-500/30 flex-wrap">
                      <div className="flex items-center gap-2">
                        <BookOpen size={18} className="text-cyan-400 shrink-0" />
                        <h3 className="text-sm sm:text-base font-extrabold text-cyan-300 font-mono uppercase tracking-wider">Diário da Jogatina & Anotações</h3>
                      </div>
                      <div className="flex items-center gap-2">
                        {!isReadingMode && game.diary && game.diary.length > 0 && (
                          <button
                            type="button"
                            onClick={() => {
                              setIsEntrySelectionMode(!isEntrySelectionMode);
                              setSelectedEntryIds(new Set());
                            }}
                            className={`px-3 py-1.5 rounded-xl border flex items-center gap-1.5 text-xs font-bold transition-all cursor-pointer ${
                              isEntrySelectionMode
                                ? "bg-cyan-950 border-cyan-500/60 text-cyan-300"
                                : "bg-zinc-900 border-zinc-800 text-zinc-400 hover:text-white hover:border-zinc-700"
                            }`}
                          >
                            {isEntrySelectionMode ? <CheckSquare size={13} /> : <Square size={13} />}
                            <span>{isEntrySelectionMode ? "Sair da Seleção" : "Seleção em Lote"}</span>
                          </button>
                        )}

                        {game.diary && game.diary.length > 0 && (
                          <button
                            onClick={() => {
                              const allCollapsed = game.diary.every((e) => collapsedEntries[e.id]);
                              const newCollapsed: Record<string, boolean> = {};
                              if (!allCollapsed) {
                                game.diary.forEach((e) => {
                                  newCollapsed[e.id] = true;
                                });
                              }
                              setCollapsedEntries(newCollapsed);
                            }}
                            className="px-3 py-1.5 rounded-xl bg-zinc-900 hover:bg-zinc-800 text-zinc-400 hover:text-white border border-zinc-800 text-xs font-bold transition-all cursor-pointer"
                            title="Recolher ou expandir todas as entradas"
                          >
                            {game.diary.every((e) => collapsedEntries[e.id]) ? "Expandir Tudo" : "Colapsar Tudo"}
                          </button>
                        )}

                        {!isReadingMode && (
                          <button
                            onClick={handleAddNewDiaryClick}
                            className="px-3 py-1.5 rounded-xl bg-cyan-950/45 hover:bg-cyan-900/45 text-cyan-300 border border-cyan-800/30 text-xs font-bold flex items-center gap-1 transition-all cursor-pointer"
                          >
                            <Plus size={12} /> {editingDiaryId ? "Editar Entrada" : "Adicionar Entrada"}
                          </button>
                        )}
                      </div>
                    </div>

                      {/* Batch Entry Action Bar */}
                      {isEntrySelectionMode && game.diary && game.diary.length > 0 && (
                        <div className="p-3 rounded-2xl bg-zinc-950 border border-zinc-800 flex flex-wrap items-center justify-between gap-3 text-xs font-mono mb-4 animate-fadeIn">
                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              onClick={() => {
                                if (selectedEntryIds.size === game.diary!.length) {
                                  setSelectedEntryIds(new Set());
                                } else {
                                  const allIds = new Set(game.diary!.map((e) => e.id));
                                  setSelectedEntryIds(allIds);
                                }
                              }}
                              className="px-3 py-1.5 rounded-xl bg-zinc-900 border border-zinc-800 hover:border-zinc-700 text-zinc-300 hover:text-white transition-all cursor-pointer text-xs font-bold"
                            >
                              {selectedEntryIds.size === game.diary.length ? "Desmarcar Todas" : "Marcar Todas"}
                            </button>
                            <span className="text-zinc-400 text-xs font-sans">
                              <strong>{selectedEntryIds.size}</strong> de {game.diary.length} entrada(s) selecionada(s)
                            </span>
                          </div>

                          <div className="flex items-center gap-2">
                            {selectedEntryIds.size > 0 && (
                              <button
                                type="button"
                                onClick={() => {
                                  const count = selectedEntryIds.size;
                                  triggerConfirm(
                                    "Excluir Entradas Selecionadas",
                                    `Tem certeza que deseja excluir permanentemente ${count} ${count === 1 ? "entrada" : "entradas"} de diário selecionada(s)?`,
                                    () => {
                                      const entryIdsArray: string[] = Array.from(selectedEntryIds) as any;
                                      if (onDeleteMultipleDiaryEntries) {
                                        onDeleteMultipleDiaryEntries(game.id, entryIdsArray);
                                      } else {
                                        entryIdsArray.forEach((id) => onDeleteDiaryEntry(game.id, id));
                                      }
                                      setSelectedEntryIds(new Set());
                                      setIsEntrySelectionMode(false);
                                    }
                                  );
                                }}
                                className="px-3 py-1.5 rounded-xl bg-red-950 border border-red-500/60 text-red-300 hover:bg-red-900 hover:text-white font-bold transition-all cursor-pointer flex items-center gap-1.5 shadow-lg animate-pulse text-xs"
                              >
                                <Trash2 size={13} />
                                <span>Excluir Selecionadas ({selectedEntryIds.size})</span>
                              </button>
                            )}

                            <button
                              type="button"
                              onClick={() => {
                                triggerConfirm(
                                  "Excluir TODAS as Entradas",
                                  `Tem certeza que deseja apagar TODAS as ${game.diary!.length} entradas do diário de "${game.name}"?`,
                                  () => {
                                    const allIds = game.diary!.map((e) => e.id);
                                    if (onDeleteMultipleDiaryEntries) {
                                      onDeleteMultipleDiaryEntries(game.id, allIds);
                                    } else {
                                      allIds.forEach((id) => onDeleteDiaryEntry(game.id, id));
                                    }
                                    setSelectedEntryIds(new Set());
                                    setIsEntrySelectionMode(false);
                                  }
                                );
                              }}
                              className="px-3 py-1.5 rounded-xl bg-zinc-900 border border-zinc-800 hover:bg-red-950 hover:border-red-500/50 text-zinc-400 hover:text-red-300 transition-all cursor-pointer flex items-center gap-1.5 text-xs font-bold"
                              title="Eliminar todas as entradas deste diário"
                            >
                              <Trash2 size={13} />
                              <span>Deletar Todas ({game.diary.length})</span>
                            </button>
                          </div>
                        </div>
                      )}

                      {/* Inline diary entry form for NEW entry */}
                      <AnimatePresence>
                        {showAddDiary && editingDiaryId === null && renderDiaryForm(null)}
                      </AnimatePresence>

                      {/* Timeline Log Lists */}
                      <div className="space-y-5 pt-2">
                        {(!game.diary || game.diary.length === 0) && (
                          <div className="glass rounded-3xl border border-dashed border-zinc-800 p-8 text-center text-sm text-zinc-500">
                            Nenhuma entrada registrada ainda no diário da jogatina deste jogo.
                          </div>
                        )}

                        {sortedDiary.map((entry, idx) => {
                          const isCollapsed = collapsedEntries[entry.id] !== false;
                          const entryKey = entry.id ? `${entry.id}-${idx}` : `diary-${idx}`;
                          const isEditingThisEntry = showAddDiary && editingDiaryId === entry.id;
                          const isEntrySelected = selectedEntryIds.has(entry.id);

                          return (
                            <div key={entryKey} id={`diary-entry-${entry.id || idx}`} className="relative pl-6 border-l-2 border-cyan-500/20 pb-4 scroll-mt-10">
                              <div className="absolute -left-[7px] top-1.5 w-3 h-3 rounded-full bg-cyan-400 ring-4 ring-[#080a10]" />
                              <div className="flex items-center justify-between gap-2 flex-wrap">
                                <div className="flex items-center gap-2">
                                  {isEntrySelectionMode && (
                                    <button
                                      type="button"
                                      onClick={() => {
                                        setSelectedEntryIds((prev) => {
                                          const next = new Set(prev);
                                          if (next.has(entry.id)) next.delete(entry.id);
                                          else next.add(entry.id);
                                          return next;
                                        });
                                      }}
                                      className={`px-2.5 py-1 rounded-xl border flex items-center gap-1.5 text-xs font-bold transition-all cursor-pointer ${
                                        isEntrySelected
                                          ? "bg-cyan-950 border-cyan-500/80 text-cyan-300"
                                          : "bg-zinc-900 border-zinc-800 text-zinc-400 hover:text-white"
                                      }`}
                                    >
                                      {isEntrySelected ? <CheckSquare size={13} className="text-cyan-400" /> : <Square size={13} />}
                                      <span>{isEntrySelected ? "Selecionada" : "Selecionar"}</span>
                                    </button>
                                  )}

                                  <span
                                    className="px-3 py-1.5 rounded-xl chip-pink text-xs sm:text-sm font-bold uppercase tracking-wider font-mono cursor-pointer hover:bg-pink-950/40 hover:border-pink-500/40 transition-all flex items-center gap-1.5 select-none"
                                    onClick={() => setCollapsedEntries((prev) => ({ ...prev, [entry.id]: prev[entry.id] === false }))}
                                    title="Clique para expandir ou colapsar esta entrada"
                                  >
                                    {entry.period}
                                    {isCollapsed ? <ChevronDown size={12} /> : <ChevronUp size={12} />}
                                  </span>
                                </div>
                                
                                {!isReadingMode && (
                                  <div className="flex items-center gap-2 flex-wrap">
                                    <button
                                      type="button"
                                      onClick={() => handleEditDiaryClick(entry, "text")}
                                      className="text-xs font-semibold text-cyan-300 hover:text-white flex items-center gap-1.5 transition-all cursor-pointer bg-cyan-950/60 hover:bg-cyan-900/80 px-2.5 py-1 rounded-xl border border-cyan-500/40 shadow-sm"
                                      title="Editar apenas o texto desta entrada (sem carregar fotos e vídeos)"
                                    >
                                      <FileText size={12} className="text-cyan-400" /> Editar Texto
                                    </button>
                                    
                                    <button
                                      type="button"
                                      onClick={() => handleEditDiaryClick(entry, "full")}
                                      className="text-xs font-semibold text-purple-300 hover:text-white flex items-center gap-1.5 transition-all cursor-pointer bg-purple-950/60 hover:bg-purple-900/80 px-2.5 py-1 rounded-xl border border-purple-500/40 shadow-sm"
                                      title="Editar texto e gerenciar mídias desta entrada"
                                    >
                                      <Edit size={12} className="text-purple-400" /> Editar Entrada
                                    </button>
                                    
                                    <button
                                      type="button"
                                      onClick={() => handleDeleteDiaryClick(entry.id)}
                                      className="text-xs font-semibold text-red-400 hover:text-red-300 flex items-center gap-1 transition-all cursor-pointer bg-red-950/30 hover:bg-red-900/40 px-2.5 py-1 rounded-xl border border-red-900/30"
                                      title="Eliminar esta entrada de diário"
                                    >
                                      <Trash2 size={12} />
                                    </button>
                                  </div>
                                )}
                              </div>
                              
                              <AnimatePresence initial={false}>
                                {!isCollapsed && (
                                  <motion.div
                                    key={`diary-entry-content-${entry.id || idx}`}
                                    initial={{ opacity: 0, height: 0 }}
                                    animate={{ opacity: 1, height: "auto" }}
                                    exit={{ opacity: 0, height: 0 }}
                                    transition={{ duration: 0.2 }}
                                    className="overflow-hidden"
                                  >
                                    {isReadingMode ? (
                                      <ReadingModeResizableRow
                                        entry={entry}
                                        expandedMediaEntries={expandedMediaEntries}
                                        setExpandedMediaEntries={setExpandedMediaEntries}
                                        handleOpenZoom={handleOpenZoom}
                                        readingTextWidthPercent={readingTextWidthPercent}
                                        setReadingTextWidthPercent={setReadingTextWidthPercent}
                                      />
                                    ) : (
                                      /* Layout Padrão Stacked */
                                      <div className="space-y-4">
                                        <div className="mt-3 bg-zinc-900/30 p-5 border border-zinc-850 rounded-2xl">
                                          <div
                                            className="text-sm sm:text-base text-zinc-200 leading-relaxed prose prose-invert prose-sm max-w-none break-words"
                                            dangerouslySetInnerHTML={{ __html: cleanHTMLText(entry.text) }}
                                          />
                                        </div>

                                        {entry.medias && entry.medias.length > 0 && (
                                          <div className="border border-zinc-800 bg-zinc-950 rounded-3xl overflow-hidden shadow-2xl p-4">
                                            <button
                                              onClick={() => setExpandedMediaEntries((prev) => ({ ...prev, [entry.id]: !prev[entry.id] }))}
                                              className="w-full text-left px-1 flex items-center justify-between hover:opacity-80 transition-all select-none cursor-pointer focus:outline-none"
                                            >
                                              <span className="text-xs font-bold font-mono text-cyan-400 uppercase tracking-widest flex items-center gap-1.5">
                                                <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse" />
                                                Mídias Acopladas ({entry.medias.length})
                                              </span>
                                              <span className="text-xs font-bold text-cyan-500 hover:text-cyan-400 flex items-center gap-1.5 font-mono uppercase tracking-wider">
                                                {expandedMediaEntries[entry.id] ? "Ocultar" : "Visualizar"}
                                                {expandedMediaEntries[entry.id] ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                                              </span>
                                            </button>
                                            
                                            <AnimatePresence initial={false}>
                                              {expandedMediaEntries[entry.id] && (
                                                <motion.div
                                                  initial={{ opacity: 0, height: 0, marginTop: 0 }}
                                                  animate={{ opacity: 1, height: "auto", marginTop: 12 }}
                                                  exit={{ opacity: 0, height: 0, marginTop: 0 }}
                                                  transition={{ duration: 0.2 }}
                                                  className="overflow-hidden"
                                                >
                                                  <div className="max-h-[720px] overflow-y-auto p-3 bg-zinc-900/20 border border-zinc-900 rounded-2xl">
                                                    <DiaryMediaGrid
                                                      medias={entry.medias}
                                                      handleOpenZoom={handleOpenZoom}
                                                      onDeleteMedias={(mediasToDelete) => handleDeleteEntryMedias(entry.id, mediasToDelete)}
                                                      onDeleteAllMedias={() => handleDeleteAllEntryMedias(entry.id)}
                                                      triggerConfirm={triggerConfirm}
                                                      readOnly={isReadingMode}
                                                    />
                                                  </div>
                                                </motion.div>
                                              )}
                                            </AnimatePresence>
                                          </div>
                                        )}
                                      </div>
                                    )}
                                  </motion.div>
                                )}
                              </AnimatePresence>

                              {/* Inline Editing Form directly under THIS specific entry */}
                              <AnimatePresence>
                                {isEditingThisEntry && renderDiaryForm(entry.id)}
                              </AnimatePresence>
                            </div>
                          );
                        })}
                      </div>
                  </div>

                  {/* Danger Zone */}
                  {!isReadingMode && (
                    <div className="pt-6 border-t border-zinc-800 flex flex-col sm:flex-row justify-between items-center gap-3">
                      <button
                        onClick={handleDeleteClick}
                        className="text-sm font-bold text-red-400 hover:text-red-300 flex items-center gap-1.5 transition-all cursor-pointer"
                      >
                        <Trash2 size={14} /> Remover Jogo da Coleção
                      </button>
                      <span className="text-xs text-zinc-500">Catálogo local seguro no navegador</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Floating Table of Contents Index Gadget (Collapsible Floating Bubble) */}
              {game.diary && game.diary.length > 0 && (
                <div className="absolute top-24 right-6 sm:right-8 z-30 flex flex-col items-end select-none">
                  {/* Floating Trigger button */}
                  <button
                    onClick={() => setIsIndexOpen(!isIndexOpen)}
                    className="w-11 h-11 sm:w-12 sm:h-12 rounded-xl bg-zinc-900/90 border border-cyan-500/30 hover:border-cyan-400 text-cyan-400 hover:text-cyan-300 flex items-center justify-center transition-all shadow-lg hover:shadow-cyan-950/40 relative cursor-pointer"
                    title="Índice do Diário"
                  >
                    <BookOpen size={18} />
                    <span className="absolute -top-1.5 -right-1.5 bg-pink-500 text-white text-[9px] font-black w-5 h-5 rounded-full flex items-center justify-center border-2 border-[#080a10]">
                      {game.diary.length}
                    </span>
                  </button>

                  {/* Dropdown Floating Panel */}
                  <AnimatePresence>
                    {isIndexOpen && (
                      <motion.div
                        key="diary-index-dropdown-menu"
                        initial={{ opacity: 0, scale: 0.95, y: -10 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.95, y: -10 }}
                        className="mt-3 w-64 max-h-[300px] overflow-y-auto rounded-2xl bg-zinc-950/95 border border-cyan-500/20 backdrop-blur-md p-4 shadow-2xl flex flex-col gap-2 scrollbar-none"
                      >
                        <div className="flex items-center gap-2 mb-1.5 pb-2 border-b border-zinc-800/60 text-cyan-400">
                          <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse" />
                          <span className="text-[10px] font-bold uppercase tracking-wider font-mono">Índice do Diário</span>
                        </div>
                        <div className="space-y-1.5">
                          {sortedDiary.map((entry, idx) => {
                            const entryKey = entry.id ? `index-${entry.id}-${idx}` : `index-diary-${idx}`;
                            return (
                              <button
                                key={entryKey}
                                onClick={() => {
                                  document.getElementById(`diary-entry-${entry.id || idx}`)?.scrollIntoView({ behavior: "smooth", block: "center" });
                                  setIsIndexOpen(false); // Close after clicking
                                }}
                                className="w-full text-left px-3 py-2 rounded-xl bg-zinc-900/40 hover:bg-cyan-950/20 border border-zinc-800/60 hover:border-cyan-500/40 transition-all group flex items-center justify-between cursor-pointer"
                              >
                                <span className="text-xs font-mono font-bold text-pink-400 group-hover:text-pink-300 truncate">
                                  {entry.period}
                                </span>
                              </button>
                            );
                          })}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              )}
            </div>
            </motion.div>
          </div>
        </div>
      )}
      </AnimatePresence>

      {/* Zoomed Image Lightbox */}
      <ImageZoomLightbox
        isOpen={!!zoomedImage}
        onClose={() => setZoomedImage(null)}
        currentSrc={zoomedImage}
        allImages={allImages}
        onSelectImage={(src) => setZoomedImage(src)}
        title={game?.name ? `Mídias - ${game.name}` : undefined}
      />

      {/* Game Dictionary Modal */}
      {game && (
        <GameDictionaryModal
          isOpen={isDictionaryModalOpen}
          onClose={() => setIsDictionaryModalOpen(false)}
          game={game}
          onUpdateGame={onUpdateGame}
          onApplyToCurrentEditor={() => {
            if (diaryText && game.dictionary) {
              const res = applyDictionaryToHtml(diaryText, game.dictionary);
              setDiaryText(res.updatedHtml);
            }
          }}
        />
      )}
    </>
  );
}
