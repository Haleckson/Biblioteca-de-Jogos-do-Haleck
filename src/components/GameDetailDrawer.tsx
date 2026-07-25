/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useMemo } from "react";
import { Game, DiaryEntry, MediaItem, splitEntities, getDlcMode, formatDateDisplay, getGameTrophies, getGameTrophyItems, parseProConTopic, parseContextNote } from "../types";
import { motion, AnimatePresence } from "motion/react";
import { X, Calendar, Clock, Star, Edit, Trash2, Plus, Film, Image as ImageIcon, ChevronDown, ChevronUp, Upload, Link2, BookOpen, RefreshCw, Loader2, Globe, ExternalLink, ZoomIn, ZoomOut, RotateCcw, ChevronLeft, ChevronRight, Mail, ArrowLeft, ArrowRight, Shield, Check, Move, Layers, Maximize2, ThumbsUp, ThumbsDown } from "lucide-react";
import ImageZoomLightbox from "./ImageZoomLightbox";
import { chipClass, renderStars, renderIcon, getPlatformBadgeStyle } from "./GameCard";
import { uploadToImgBB } from "../utils/imgbb";
import { getYoutubeEmbedUrl, isYoutubeUrl, uploadVideoToYoutube } from "../utils/youtube";
import { isDriveAuthenticated } from "../utils/googleDrive";
import RichTextEditor from "./RichTextEditor";
import { DiaryMediaGrid } from "./DiaryMediaGrid";
import { formatHltbTime } from "../utils/hltbFormatter";
import { cleanHTMLText } from "../utils/htmlSanitizer";
import TrophyBadge, { TrophiesList } from "./TrophyBadge";
import { formatHoursAndMinutes, getTotalGamePlaytimeHours } from "./DashboardView";

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
  triggerAlert: (title: string, message: string) => void;
  triggerConfirm: (title: string, message: string, callback: () => void) => void;
  isAdmin: boolean;
  onUpdateGame?: (updatedGame: Game) => void;
  onSendEmailClick?: (game: Game) => void;
  onOpenGameEstimateModal?: (game: Game) => void;
}

export default function GameDetailDrawer({
  game: propGame,
  isOpen,
  onClose,
  onEditClick,
  onDeleteGame,
  onSaveDiaryEntry,
  onDeleteDiaryEntry,
  triggerAlert,
  triggerConfirm,
  isAdmin,
  onUpdateGame,
  onSendEmailClick,
  onOpenGameEstimateModal
}: GameDetailDrawerProps) {
  const [lastGame, setLastGame] = useState<Game | null>(null);

  useEffect(() => {
    if (propGame) {
      setLastGame(propGame);
    }
  }, [propGame]);

  const game = propGame || lastGame;

  const [showAddDiary, setShowAddDiary] = useState(false);
  const [diaryStart, setDiaryStart] = useState("");
  const [diaryEnd, setDiaryEnd] = useState("");
  const [diaryText, setDiaryText] = useState("");
  const [diaryScreenshotUrl, setDiaryScreenshotUrl] = useState("");
  const [tempDiaryMedias, setTempDiaryMedias] = useState<MediaItem[]>([]);
  const [editingDiaryId, setEditingDiaryId] = useState<string | null>(null);
  const [draggedMediaIndex, setDraggedMediaIndex] = useState<number | null>(null);
  const [dragOverMediaIndex, setDragOverMediaIndex] = useState<number | null>(null);
  const [isUploadingMedia, setIsUploadingMedia] = useState(false);
  const [isDragOverDiaryMedia, setIsDragOverDiaryMedia] = useState(false);
  const [uploadProgressText, setUploadProgressText] = useState("");
  const [zoomedImage, setZoomedImage] = useState<string | null>(null);
  const [zoomScale, setZoomScale] = useState(1);
  const [isIndexOpen, setIsIndexOpen] = useState(false);
  const [collapsedEntries, setCollapsedEntries] = useState<Record<string, boolean>>({});
  const [expandedMediaEntries, setExpandedMediaEntries] = useState<Record<string, boolean>>({});

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
      }, 3000);
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

  useEffect(() => {
    if (game && game.metacriticUrl && isOpen) {
      fetch(`/api/metacritic?url=${encodeURIComponent(game.metacriticUrl)}`)
        .then((res) => res.json())
        .then((data) => {
          if (data.platforms) {
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
        .catch((err) => console.error("Erro ao carregar plataformas no drawer:", err));
    } else {
      setDrawerMetacriticPlatforms([]);
      setSelectedDrawerPlatform("");
    }
  }, [game?.metacriticUrl, isOpen, game?.platform]);

  const handleSyncHltb = async () => {
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

  const handleEditDiaryClick = (entry: DiaryEntry) => {
    setEditingDiaryId(entry.id);
    setDiaryText(entry.text);
    
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
      setTempDiaryMedias(entry.medias);
    } else {
      setTempDiaryMedias([]);
    }
    
    setShowAddDiary(true);
  };

  const handleCancelDiary = () => {
    setDiaryStart("");
    setDiaryEnd("");
    setDiaryText("");
    setDiaryScreenshotUrl("");
    setTempDiaryMedias([]);
    setShowAddDiary(false);
    setEditingDiaryId(null);
  };

  const uploadDiaryMediaFiles = async (files: File[]) => {
    if (files.length === 0) return;

    setIsUploadingMedia(true);
    setUploadProgressText("Preparando envio...");
    try {
      let currentIndex = tempDiaryMedias.length;
      for (const file of files) {
        const isVideo = file.type.startsWith("video/");
        if (isVideo) {
          if (!isDriveAuthenticated()) {
            triggerAlert(
              "Conexão do Google Necessária",
              "Para fazer upload de vídeos diretamente do seu site para o YouTube, você precisa conectar sua conta Google no topo da página (clique em 'Conectar Google Drive'). Isso permite criar uma playlist do jogo no seu YouTube e salvar o vídeo automaticamente lá de forma privada/unlisted!"
            );
            continue;
          }

          // Automated YouTube upload and playlist link flow
          const ytUrl = await uploadVideoToYoutube(file, game.name, (statusText) => {
            setUploadProgressText(statusText);
          });

          setTempDiaryMedias((prev) => [
            ...prev,
            { src: ytUrl, isVideo: true }
          ]);
        } else {
          currentIndex++;
          const fileNameParam = `${game.name}_diario_${currentIndex}`;
          setUploadProgressText(`Enviando imagem ${file.name} para o ImgBB...`);
          // Upload to ImgBB automatically
          const res = await uploadToImgBB(file, fileNameParam);
          setTempDiaryMedias((prev) => [
            ...prev,
            { src: res.url, isVideo: false, deleteUrl: res.deleteUrl }
          ]);
        }
      }
    } catch (error: any) {
      console.error(error);
      triggerAlert(
        "Erro de Envio",
        `Ocorreu um erro ao processar as mídias: ${error.message || error}`
      );
    } finally {
      setIsUploadingMedia(false);
      setUploadProgressText("");
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
    const validFiles = files.filter(f => f.type.startsWith("image/") || f.type.startsWith("video/"));
    if (validFiles.length > 0) {
      uploadDiaryMediaFiles(validFiles);
    } else if (files.length > 0) {
      triggerAlert("Formatos Inválidos", "Por favor, envie apenas arquivos de imagem ou vídeo.");
    }
  };

  const handleAddLink = () => {
    if (!diaryScreenshotUrl.trim()) return;

    const urls = diaryScreenshotUrl
      .split(",")
      .map((u) => u.trim())
      .filter(Boolean);

    urls.forEach((url) => {
      const isYt = isYoutubeUrl(url);
      const isVideo = isYt || /\.(mp4|webm|mov)$/i.test(url) || url.includes("video");
      setTempDiaryMedias((prev) => [
        ...prev,
        { src: url, isVideo }
      ]);
    });

    setDiaryScreenshotUrl("");
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
      id: editingDiaryId || "diary-" + Date.now(),
      period,
      medias,
      text: diaryText.trim()
    };

    onSaveDiaryEntry(game.id, newEntry);

    // reset state
    setDiaryStart("");
    setDiaryEnd("");
    setDiaryText("");
    setDiaryScreenshotUrl("");
    setTempDiaryMedias([]);
    setShowAddDiary(false);
    setEditingDiaryId(null);
  };

  const handleDeleteClick = () => {
    triggerConfirm(
      "Remover Jogo",
      `Tens a certeza que queres remover permanentemente "${game.name}" e todos os diários de bordo associados?`,
      () => {
        onDeleteGame(game.id);
        onClose();
      }
    );
  };

  const handleDeleteDiaryClick = (entryId: string) => {
    triggerConfirm(
      "Eliminar Entrada de Diário",
      "Queres apagar permanentemente esta entrada de diário?",
      () => {
        onDeleteDiaryEntry(game.id, entryId);
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
            className="absolute inset-0 bg-black/80 backdrop-blur-md"
            onClick={onClose}
          />

          {/* Sliding Panel */}
          <div className="absolute inset-y-0 right-0 max-w-full flex pl-10">
            <motion.div
              initial={{ x: "100%" }}
              animate={{ x: 0 }}
              exit={{ x: "100%" }}
              transition={{ type: "spring", damping: 30, stiffness: 300 }}
              className="w-screen max-w-full lg:max-w-[90vw] bg-[#080a10] border-l border-purple-500/20 shadow-2xl flex flex-col h-full relative"
            >
              {/* Sticky Header */}
              <div className="p-4 sm:p-5 border-b border-zinc-800 bg-zinc-950/95 backdrop-blur-md flex items-center justify-between gap-3 shrink-0 z-20">
                <div>
                  <div className="text-[10px] uppercase tracking-[0.35em] text-zinc-500 font-bold">Perfil detalhado</div>
                  <h3 className="text-sm font-extrabold text-zinc-400">Biblioteca / Diário da Jogatina</h3>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={downloadAllGameMedia}
                    className="px-3 py-1.5 sm:px-4 sm:py-2 rounded-xl bg-cyan-950/50 hover:bg-cyan-900/50 border border-cyan-800/30 text-cyan-300 text-xs font-bold transition-all cursor-pointer"
                  >
                    Baixar Mídias
                  </button>
                  {onSendEmailClick && game && (
                    <button
                      onClick={() => onSendEmailClick(game)}
                      className="px-3 py-1.5 sm:px-4 sm:py-2 rounded-xl bg-cyan-950/40 hover:bg-cyan-900/40 border border-cyan-500/30 hover:border-cyan-400/50 text-cyan-200 text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer shadow-lg"
                      title="Compartilhar diário de jogatina por e-mail"
                    >
                      <Mail size={12} /> <span className="hidden sm:inline">Enviar Gmail</span>
                    </button>
                  )}
                  <button
                    onClick={() => {
                      onEditClick(game);
                    }}
                    className="px-3 py-1.5 sm:px-4 sm:py-2 rounded-xl bg-purple-950/50 hover:bg-purple-900/50 border border-purple-800/30 text-purple-300 text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer"
                  >
                    <Edit size={12} /> <span className="hidden sm:inline">Editar</span>
                  </button>
                  <button
                    onClick={onClose}
                    className="h-10 px-4 rounded-xl bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 hover:border-zinc-700 text-zinc-300 hover:text-white flex items-center gap-1.5 transition-all shadow-md cursor-pointer font-bold text-xs uppercase tracking-wider shrink-0"
                    title="Fechar Janela"
                  >
                    <X size={14} /> <span>Fechar</span>
                  </button>
                </div>
              </div>

              {/* Scrollable Content wrapper */}
              <div className="flex-1 flex overflow-hidden">
                {/* Scrollable Content */}
                <div className="flex-1 overflow-y-auto pb-12 drawer-scrollable-container">
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
                      <h2 className="text-3xl sm:text-4xl font-black text-white leading-tight break-words [text-shadow:_0_2px_10px_rgb(0_0_0_/_90%),_0_1px_3px_rgb(0_0_0_/_100%)] drop-shadow-[0_4px_12px_rgba(0,0,0,0.9)]">
                        <span className="align-middle">{game.name}</span>
                        {game.trophy && game.trophy !== "none" && (
                          <span className="inline-flex align-middle ml-2.5 shrink-0">
                            <TrophyBadge trophy={game.trophy} mode="detail" />
                          </span>
                        )}
                      </h2>
                      <p className="text-xs sm:text-sm text-cyan-300 uppercase tracking-wider font-bold mt-1 [text-shadow:_0_2px_10px_rgb(0_0_0_/_95%),_0_1px_3px_rgb(0_0_0_/_100%)] drop-shadow-[0_4px_12px_rgba(0,0,0,0.9)]">
                        {game.series || "Série autónoma"}
                      </p>
                    </div>
                  </div>

                  {/* Metadata Dashboard */}
                  <div className="glass rounded-2xl border border-zinc-800/80 p-5 sm:p-6 shadow-xl">
                    <div className="text-xs uppercase tracking-[0.2em] text-cyan-400/90 font-mono font-bold mb-4 pb-2 border-b border-zinc-800/80 flex items-center justify-between">
                      <span>Ficha Técnica do Jogo</span>
                    </div>
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-x-5 gap-y-4 text-xs">
                      <div title="Status de progresso atual no jogo">
                        <div className="text-zinc-400 text-xs uppercase tracking-wider font-bold mb-1">Status</div>
                        <div className="flex flex-wrap gap-1.5 items-center">
                          {game.status.map((s, idx) => (
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

                      {/* 3-Part Playtime Bar */}
                      <div className="col-span-2 sm:col-span-3 md:col-span-4 bg-zinc-950/80 rounded-2xl p-4 border border-zinc-800/80 my-1 shadow-inner" title="Divisão do Tempo Investido">
                        <div className="space-y-2.5">
                          <div className="flex items-center justify-start gap-3 flex-wrap pb-1.5 border-b border-zinc-900/80">
                            <div className="flex items-center gap-2">
                              <Clock size={15} className="text-purple-400 shrink-0" />
                              <span className="text-purple-300 text-xs uppercase tracking-wider font-bold font-mono">Tempo Investido</span>
                            </div>
                            {getGameTrophyItems(game).length > 0 && (
                              <div>
                                <TrophiesList trophies={getGameTrophyItems(game)} mode="detail" />
                              </div>
                            )}
                          </div>

                          <div className="flex items-center gap-2.5 font-mono flex-wrap">
                            {(() => {
                              const parsedPlay = parseContextNote(game.playtime || "0h");
                              const parsedAdd = parseContextNote(game.additionalPlaytime || "0h");
                              return (
                                <>
                                  <div 
                                    className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-purple-950/50 text-purple-200 border border-purple-500/30 shadow-sm cursor-help" 
                                    data-tooltip={parsedPlay.note || `Jogatina: ${parsedPlay.main}`}
                                    data-tooltip-title={parsedPlay.note ? "Contexto - Jogatina" : undefined}
                                    data-tooltip-theme="purple"
                                  >
                                    <Clock size={13} className="text-purple-400 shrink-0" />
                                    <span className="text-xs font-sans text-purple-300/80 font-medium">Jogatina:</span>
                                    <strong className="text-sm sm:text-base font-extrabold font-mono text-purple-200">{parsedPlay.main}</strong>
                                  </div>

                                  <div 
                                    className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-cyan-950/50 text-cyan-200 border border-cyan-500/30 shadow-sm cursor-help" 
                                    data-tooltip={parsedAdd.note || `Jogatinas Passadas: ${parsedAdd.main}`}
                                    data-tooltip-title={parsedAdd.note ? "Contexto - Jogatinas Passadas" : undefined}
                                    data-tooltip-theme="cyan"
                                  >
                                    <Clock size={13} className="text-cyan-400 shrink-0" />
                                    <span className="text-xs font-sans text-cyan-300/80 font-medium">Passadas:</span>
                                    <strong className="text-sm sm:text-base font-extrabold font-mono text-cyan-200">{parsedAdd.main}</strong>
                                  </div>
                                </>
                              );
                            })()}

                            <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-emerald-950/60 text-emerald-200 font-bold border border-emerald-500/40 shadow-sm" title="Tempo Total Investido: somatório total de todas as jogatinas (atual + passadas)">
                              <Clock size={13} className="text-emerald-400 shrink-0" />
                              <span className="text-xs font-sans text-emerald-300/80 font-medium">Total:</span>
                              <strong className="text-sm sm:text-base font-extrabold font-mono text-emerald-300">{formatHoursAndMinutes(getTotalGamePlaytimeHours(game))}</strong>
                            </div>

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

                      {(game.hltbId || game.hltbMain || game.hltbExtra || game.hltbCompletionist) && (
                        <div className="sm:col-span-2 lg:col-span-4 border-t border-zinc-800/80 pt-3.5 mt-2 text-left">
                          <div className="flex items-center justify-start gap-3 mb-2 flex-wrap">
                            <div className="flex items-center gap-2">
                              <Globe size={15} className="text-purple-400" />
                              <span className="text-purple-300 text-xs uppercase tracking-wider font-bold font-mono">HowLongToBeat (Médias da Comunidade)</span>
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

                      <div className="sm:col-span-2 lg:col-span-4 border-t border-zinc-800/80 pt-3.5 mt-2 text-left">
                        <div className="flex items-center justify-start gap-3 mb-2 flex-wrap">
                          <div className="flex items-center gap-2">
                            <Globe size={15} className="text-amber-400" />
                            <span className="text-amber-300 text-xs uppercase tracking-wider font-bold font-mono">Métricas de Avaliação</span>
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
                            <div className="mt-3 border-t border-zinc-900/80 pt-3 grid grid-cols-1 md:grid-cols-2 gap-3">
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
                          );
                        })()}
                      </div>

                      <div className="sm:col-span-2 lg:col-span-4 border-t border-zinc-800/80 pt-3.5 mt-2">
                        <div className="flex flex-col sm:flex-row sm:items-center gap-2">
                          <span className="text-xs uppercase tracking-wider text-zinc-400 font-bold w-20 shrink-0">Gêneros:</span>
                          <div className="flex flex-wrap gap-1.5">
                            {[...game.genre].sort((a, b) => a.localeCompare(b, "pt", { sensitivity: "base" })).map((g, idx) => (
                              <span key={`${g}-${idx}`} className="px-2.5 py-1 rounded-lg bg-purple-950/40 text-purple-200 text-xs font-bold border border-purple-900/40 shadow-sm">
                                {g}
                              </span>
                            ))}
                          </div>
                        </div>
                      </div>
                      <div className="sm:col-span-2 lg:col-span-4 pt-1">
                        <div className="flex flex-col sm:flex-row sm:items-center gap-2">
                          <span className="text-xs uppercase tracking-wider text-zinc-400 font-bold w-20 shrink-0">Tags:</span>
                          <div className="flex flex-wrap gap-1.5">
                            {[...game.tags].sort((a, b) => a.localeCompare(b, "pt", { sensitivity: "base" })).map((t, idx) => (
                              <span key={`${t}-${idx}`} className="px-2.5 py-1 rounded-lg bg-zinc-900 text-cyan-200 text-xs font-bold border border-cyan-900/40 shadow-sm">
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

                  {/* Diary / Journal Timeline */}
                  <div className="space-y-4">
                    <div className="flex items-center justify-between gap-3">
                      <h3 className="text-lg font-bold text-white">Diário da Jogatina</h3>
                      <div className="flex items-center gap-2">
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
                        <button
                          onClick={() => {
                            if (showAddDiary) {
                              handleCancelDiary();
                            } else {
                              setShowAddDiary(true);
                            }
                          }}
                          className="px-3 py-1.5 rounded-xl bg-cyan-950/45 hover:bg-cyan-900/45 text-cyan-300 border border-cyan-800/30 text-xs font-bold flex items-center gap-1 transition-all"
                        >
                          <Plus size={12} /> {editingDiaryId ? "Editar Entrada" : "Adicionar Entrada"}
                        </button>
                      </div>
                    </div>

                    {/* Inline diary entry form */}
                    <AnimatePresence>
                      {showAddDiary && (
                        <motion.div
                          key="add-diary-form-panel"
                          initial={{ opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: "auto" }}
                          exit={{ opacity: 0, height: 0 }}
                          className="glass rounded-3xl border border-zinc-800 p-5 space-y-4 overflow-hidden shadow-lg"
                        >
                          <div className="flex items-center justify-between border-b border-zinc-800/80 pb-3">
                            <span className="text-[10px] uppercase tracking-[0.25em] text-zinc-400 font-bold flex items-center gap-1.5">
                              <span className="w-1.5 h-1.5 rounded-full bg-purple-500 animate-pulse" />
                              {editingDiaryId ? "Editar Registro" : "Novo Registro"}
                            </span>
                            <div className="flex gap-2">
                              <button
                                type="button"
                                onClick={handleCancelDiary}
                                className="px-3 py-1.5 rounded-xl bg-zinc-900 border border-zinc-800 text-zinc-300 font-bold hover:bg-zinc-850 text-xs cursor-pointer transition-all active:scale-95"
                              >
                                Cancelar
                              </button>
                              <button
                                type="button"
                                onClick={handleAddDiarySubmit}
                                className="px-3 py-1.5 rounded-xl bg-gradient-to-r from-purple-600 to-cyan-500 text-white font-bold text-xs cursor-pointer hover:opacity-90 active:scale-95 transition-all"
                              >
                                {editingDiaryId ? "Atualizar Entrada" : "Salvar Entrada"}
                              </button>
                            </div>
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
                                className="flex-1 px-3 py-2 rounded-xl bg-zinc-950 border border-zinc-800 text-white outline-none focus:ring-2 focus:ring-cyan-500 text-xs"
                              />
                              <span className="text-zinc-400">~</span>
                              <input
                                type="date"
                                value={diaryEnd}
                                onChange={(e) => setDiaryEnd(e.target.value)}
                                className="flex-1 px-3 py-2 rounded-xl bg-zinc-950 border border-zinc-800 text-white outline-none focus:ring-2 focus:ring-cyan-500 text-xs"
                              />
                            </div>
                          </div>

                          <div>
                            <label className="block text-[10px] uppercase tracking-[0.25em] text-zinc-400 font-bold mb-1">
                              {editingDiaryId ? "Editar Entrada de Diário *" : "Entrada de Diário *"}
                            </label>
                            <RichTextEditor
                              value={diaryText}
                              onChange={setDiaryText}
                              gameName={game?.name}
                              placeholder="Relate conquistas, batalhas difíceis, sentimentos, chefes derrotados..."
                            />
                          </div>

                          <div>
                            <label className="block text-[10px] uppercase tracking-[0.25em] text-zinc-400 font-bold mb-1.5">
                              Anexar Screenshot ou Vídeo (ImgBB & YouTube)
                            </label>
                            
                            <div className="space-y-3">
                              {/* Drag and drop zone */}
                              <div
                                onDragOver={handleDiaryDragOver}
                                onDragLeave={handleDiaryDragLeave}
                                onDrop={handleDiaryDrop}
                                className={`flex flex-col items-center justify-center p-6 rounded-2xl bg-zinc-950 border-2 border-dashed transition-all cursor-pointer relative overflow-hidden ${
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
                                  <div className="flex flex-col items-center gap-2 py-1 text-center">
                                    <span className="w-6 h-6 border-2 border-cyan-400 border-t-transparent rounded-full animate-spin" />
                                    <span className="text-xs text-cyan-400 font-semibold animate-pulse">{uploadProgressText || "Enviando mídias..."}</span>
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

                              {/* Manual Link input fallback */}
                              <div className="flex w-full gap-2 items-center">
                                <input
                                  type="url"
                                  value={diaryScreenshotUrl}
                                  onChange={(e) => setDiaryScreenshotUrl(e.target.value)}
                                  placeholder="Ou cole link direto de Imagem ou YouTube..."
                                  className="flex-1 px-3 py-2 rounded-xl bg-zinc-950 border border-zinc-800 text-white outline-none focus:ring-2 focus:ring-cyan-500 text-xs"
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
                                  className="p-2 rounded-xl bg-zinc-900 border border-zinc-800 hover:bg-zinc-800 text-cyan-400 transition-all flex items-center justify-center cursor-pointer"
                                  title="Adicionar Link"
                                >
                                  <Link2 size={14} />
                                </button>
                              </div>
                            </div>
                          </div>

                          {tempDiaryMedias.length > 0 && (
                            <div className="space-y-1.5">
                              <p className="text-[10px] text-zinc-400 flex items-center gap-1.5 px-1 text-left">
                                <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse" />
                                Arraste e solte as mídias para reordenar a exibição
                              </p>
                              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3 p-3 rounded-2xl bg-zinc-950 border border-zinc-800">
                                {tempDiaryMedias.map((m, idx) => {
                                  const isYt = isYoutubeUrl(m.src);
                                  const ytThumb = isYt ? `https://img.youtube.com/vi/${getYoutubeEmbedUrl(m.src)?.split("/embed/")[1]}/0.jpg` : "";
                                  const isDragged = draggedMediaIndex === idx;
                                  const isDragOver = dragOverMediaIndex === idx;

                                  return (
                                    <motion.div
                                      layout
                                      transition={{ type: "spring", stiffness: 300, damping: 25 }}
                                      key={m.src || idx}
                                      draggable
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
                                      className={`flex flex-col rounded-xl overflow-hidden border bg-zinc-900 relative transition-all duration-300 cursor-grab active:cursor-grabbing select-none ${
                                        isDragged ? "opacity-35 border-cyan-500 scale-95 shadow-inner bg-zinc-950 border-dashed" : "border-zinc-800 hover:border-zinc-700 hover:scale-[1.01]"
                                      }`}
                                    >
                                      {/* Media Thumbnail */}
                                      <div className="h-20 w-full relative bg-black flex items-center justify-center overflow-hidden pointer-events-none">
                                        {isYt ? (
                                          <img src={ytThumb} className="w-full h-full object-cover" alt="YouTube Thumbnail" referrerPolicy="no-referrer" />
                                        ) : m.isVideo ? (
                                          <video src={m.src} className="w-full h-full object-cover" muted />
                                        ) : (
                                          <img src={m.src} className="w-full h-full object-cover" alt="prev" referrerPolicy="no-referrer" />
                                        )}
                                        
                                        {/* Media type indicator */}
                                        <div className="absolute bottom-1 right-1 bg-black/80 px-1 py-0.5 rounded text-[8px] text-zinc-300 flex items-center gap-0.5">
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

                                      {/* Actions / Reordering Bar */}
                                      <div className="h-8 bg-zinc-950 border-t border-zinc-800/80 flex items-center justify-between px-2">
                                        {/* Move Left */}
                                        <button
                                          type="button"
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            moveMedia(idx, "left");
                                          }}
                                          disabled={idx === 0}
                                          className="p-1 rounded text-zinc-400 hover:text-cyan-400 disabled:opacity-20 disabled:hover:text-zinc-400 transition-all cursor-pointer"
                                          title="Mover para esquerda"
                                        >
                                          <ArrowLeft size={12} />
                                        </button>

                                        {/* Remove */}
                                        <button
                                          type="button"
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            const itemToRemove = tempDiaryMedias[idx];
                                            if (itemToRemove && itemToRemove.deleteUrl) {
                                              fetch("/api/delete-imgbb", {
                                                method: "POST",
                                                headers: { "Content-Type": "application/json" },
                                                body: JSON.stringify({ deleteUrl: itemToRemove.deleteUrl })
                                              }).catch((err) => console.error("Erro ao deletar do ImgBB no backend:", err));
                                            }
                                            setTempDiaryMedias((prev) => prev.filter((_, i) => i !== idx));
                                          }}
                                          className="p-1 rounded text-zinc-500 hover:text-red-400 hover:bg-red-500/10 transition-all cursor-pointer"
                                          title="Remover mídia"
                                        >
                                          <Trash2 size={12} />
                                        </button>

                                        {/* Move Right */}
                                        <button
                                          type="button"
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            moveMedia(idx, "right");
                                          }}
                                          disabled={idx === tempDiaryMedias.length - 1}
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
                        </motion.div>
                      )}
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
                        return (
                          <div key={entryKey} id={`diary-entry-${entry.id || idx}`} className="relative pl-6 border-l-2 border-cyan-500/20 pb-4 scroll-mt-10">
                            <div className="absolute -left-[7px] top-1.5 w-3 h-3 rounded-full bg-cyan-400 ring-4 ring-[#080a10]" />
                            <div className="flex items-center justify-between gap-2">
                              <span
                                className="px-3 py-1.5 rounded-xl chip-pink text-xs sm:text-sm font-bold uppercase tracking-wider font-mono cursor-pointer hover:bg-pink-950/40 hover:border-pink-500/40 transition-all flex items-center gap-1.5 select-none"
                                onClick={() => setCollapsedEntries((prev) => ({ ...prev, [entry.id]: prev[entry.id] === false }))}
                                title="Clique para expandir ou colapsar esta entrada"
                              >
                                {entry.period}
                                {isCollapsed ? <ChevronDown size={12} /> : <ChevronUp size={12} />}
                              </span>
                              <div className="flex items-center gap-3">
                                <button
                                  onClick={() => handleEditDiaryClick(entry)}
                                  className="text-xs font-semibold text-purple-400 hover:text-purple-300 flex items-center gap-1 transition-all cursor-pointer"
                                >
                                  <Edit size={12} /> Editar
                                </button>
                                <button
                                  onClick={() => handleDeleteDiaryClick(entry.id)}
                                  className="text-xs font-semibold text-red-400 hover:text-red-300 flex items-center gap-1 transition-all cursor-pointer"
                                >
                                  <Trash2 size={12} /> Eliminar
                                </button>
                              </div>
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
                                  <div className="mt-3 bg-zinc-900/30 p-5 border border-zinc-850 rounded-2xl">
                                    <div
                                      className="text-sm sm:text-base text-zinc-200 leading-relaxed prose prose-invert prose-sm max-w-none break-words"
                                      dangerouslySetInnerHTML={{ __html: cleanHTMLText(entry.text) }}
                                    />
                                  </div>

                                  {entry.medias && entry.medias.length > 0 && (
                                    <div className="mt-4 border border-zinc-800 bg-zinc-950 rounded-3xl overflow-hidden shadow-2xl p-4">
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
                                              <DiaryMediaGrid medias={entry.medias} handleOpenZoom={handleOpenZoom} />
                                            </div>
                                          </motion.div>
                                        )}
                                      </AnimatePresence>
                                    </div>
                                  )}
                                </motion.div>
                              )}
                            </AnimatePresence>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* Danger Zone */}
                  <div className="pt-6 border-t border-zinc-800 flex flex-col sm:flex-row justify-between items-center gap-3">
                    <button
                      onClick={handleDeleteClick}
                      className="text-sm font-bold text-red-400 hover:text-red-300 flex items-center gap-1.5 transition-all"
                    >
                      <Trash2 size={14} /> Remover Jogo da Coleção
                    </button>
                    <span className="text-xs text-zinc-500">Catálogo local seguro no navegador</span>
                  </div>
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
    </>
  );
}
