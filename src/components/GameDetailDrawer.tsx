/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from "react";
import { Game, DiaryEntry, MediaItem } from "../types";
import { motion, AnimatePresence } from "motion/react";
import { X, Calendar, Clock, Star, Edit, Trash2, Plus, Film, Image as ImageIcon, ChevronDown, ChevronUp, Upload, Link2, BookOpen, RefreshCw, Loader2, Globe, ExternalLink } from "lucide-react";
import { chipClass, renderStars, renderIcon } from "./GameCard";
import { uploadToImgBB } from "../utils/imgbb";
import { getYoutubeEmbedUrl, isYoutubeUrl } from "../utils/youtube";
import RichTextEditor from "./RichTextEditor";

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
}

export default function GameDetailDrawer({
  game,
  isOpen,
  onClose,
  onEditClick,
  onDeleteGame,
  onSaveDiaryEntry,
  onDeleteDiaryEntry,
  triggerAlert,
  triggerConfirm,
  isAdmin,
  onUpdateGame
}: GameDetailDrawerProps) {
  const [showAddDiary, setShowAddDiary] = useState(false);
  const [diaryStart, setDiaryStart] = useState("");
  const [diaryEnd, setDiaryEnd] = useState("");
  const [diaryText, setDiaryText] = useState("");
  const [diaryScreenshotUrl, setDiaryScreenshotUrl] = useState("");
  const [tempDiaryMedias, setTempDiaryMedias] = useState<MediaItem[]>([]);
  const [editingDiaryId, setEditingDiaryId] = useState<string | null>(null);
  const [isUploadingMedia, setIsUploadingMedia] = useState(false);
  const [zoomedImage, setZoomedImage] = useState<string | null>(null);
  const [isIndexOpen, setIsIndexOpen] = useState(false);
  const [collapsedEntries, setCollapsedEntries] = useState<Record<string, boolean>>({});

  const [coverPos, setCoverPos] = useState(50);
  const [isDragging, setIsDragging] = useState(false);
  const startY = React.useRef(0);
  const startPos = React.useRef(50);
  const coverPosRef = React.useRef(50);

  useEffect(() => {
    if (game) {
      const pos = game.coverPosition ?? 50;
      setCoverPos(pos);
      coverPosRef.current = pos;
      setIsIndexOpen(false);
    }
  }, [game?.id, game?.coverPosition]);

  const [isSyncingHltb, setIsSyncingHltb] = useState(false);

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
          hltbMain: data.gameplayMain ? `${data.gameplayMain}h` : "",
          hltbExtra: data.gameplayMainExtra ? `${data.gameplayMainExtra}h` : "",
          hltbCompletionist: data.gameplayCompletionist ? `${data.gameplayCompletionist}h` : "",
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

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!isAdmin) return;
    setIsDragging(true);
    startY.current = e.clientY;
    startPos.current = coverPosRef.current;
    e.currentTarget.setPointerCapture(e.pointerId);
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!isDragging) return;
    const deltaY = e.clientY - startY.current;
    const percentageShift = (deltaY / 224) * 100;
    let newPos = startPos.current - percentageShift;
    if (newPos < 0) newPos = 0;
    if (newPos > 100) newPos = 100;
    const roundedPos = Math.round(newPos);
    setCoverPos(roundedPos);
    coverPosRef.current = roundedPos;
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!isDragging) return;
    setIsDragging(false);
    e.currentTarget.releasePointerCapture(e.pointerId);
    
    if (onUpdateGame && game) {
      onUpdateGame({
        ...game,
        coverPosition: coverPosRef.current
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

  const handleDiaryMediaUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []) as File[];
    if (files.length === 0) return;

    setIsUploadingMedia(true);
    try {
      let currentIndex = tempDiaryMedias.length;
      for (const file of files) {
        const isVideo = file.type.startsWith("video/");
        if (isVideo) {
          const reader = new FileReader();
          await new Promise<void>((resolve) => {
            reader.onload = (event) => {
              if (event.target?.result) {
                setTempDiaryMedias((prev) => [
                  ...prev,
                  { src: event.target!.result as string, isVideo: true }
                ]);
              }
              resolve();
            };
            reader.readAsDataURL(file);
          });
        } else {
          currentIndex++;
          const fileNameParam = `${game.name}_diario_${currentIndex}`;
          // Upload to ImgBB automatically
          const uploadedUrl = await uploadToImgBB(file, fileNameParam);
          setTempDiaryMedias((prev) => [
            ...prev,
            { src: uploadedUrl, isVideo: false }
          ]);
        }
      }
    } catch (error: any) {
      console.error(error);
      triggerAlert(
        "Erro de Envio",
        `Ocorreu um erro ao enviar uma ou mais imagens para o ImgBB: ${error.message || error}`
      );
    } finally {
      setIsUploadingMedia(false);
      e.target.value = "";
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
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-40 overflow-hidden">
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
                <div className="flex-1 overflow-y-auto pb-12">
                 {/* Hero Banner */}
                <div
                  onPointerDown={handlePointerDown}
                  onPointerMove={handlePointerMove}
                  onPointerUp={handlePointerUp}
                  onPointerCancel={handlePointerUp}
                  style={{ touchAction: "none" }}
                  className={`relative h-56 sm:h-72 shrink-0 bg-black overflow-hidden ${
                    isAdmin ? "cursor-ns-resize" : ""
                  }`}
                >
                  {isAdmin && (
                    <div className="absolute top-4 left-4 bg-black/60 backdrop-blur-md text-zinc-300 text-[10px] uppercase tracking-widest font-bold px-2.5 py-1.5 rounded-lg border border-zinc-800/80 flex items-center gap-1.5 pointer-events-none select-none z-10">
                      <span className="animate-pulse text-cyan-400 font-bold">↕</span> Arraste para ajustar o banner
                    </div>
                  )}
                  <img
                    className="w-full h-full object-cover pointer-events-none select-none"
                    src={game.cover || "https://images.unsplash.com/photo-1542751371-adc38448a05e?q=80&w=1200"}
                    alt={game.name}
                    referrerPolicy="no-referrer"
                    style={{
                      objectPosition: `center ${coverPos}%`,
                      userSelect: "none",
                    }}
                    draggable={false}
                    onError={(e: any) => {
                      (e.target as HTMLImageElement).src = "https://placehold.co/1200x400/040406/ffffff?text=Sem+Capa";
                    }}
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-[#080a10] via-zinc-900/40 to-transparent pointer-events-none" />
                </div>

                {/* Profile overlap */}
                <div className="px-4 sm:px-8 space-y-6 relative z-10 -mt-16 sm:-mt-24">
                  <div className="flex flex-col sm:flex-row sm:items-end gap-4">
                    <div className="w-24 h-24 sm:w-28 sm:h-28 rounded-3xl bg-zinc-950 border-4 border-purple-500/30 overflow-hidden shadow-2xl flex items-center justify-center shrink-0">
                      {renderIcon(game, "w-full h-full object-cover")}
                    </div>
                    <div className="pb-1 min-w-0">
                      <h2 className="text-3xl sm:text-4xl font-black text-white leading-tight break-words">
                        {game.name}
                      </h2>
                      <p className="text-xs sm:text-sm text-cyan-300 uppercase tracking-wider font-bold mt-1">
                        {game.series || "Série autónoma"}
                      </p>
                    </div>
                  </div>

                  {/* Metadata Dashboard */}
                  <div className="glass rounded-3xl border border-zinc-800/80 p-5 sm:p-6 shadow-xl">
                    <div className="text-[10px] uppercase tracking-[0.35em] text-zinc-500 font-bold mb-4">Metadados de Perfil</div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-y-5 gap-x-4 text-sm">
                      <div>
                        <div className="text-zinc-500 text-xs uppercase tracking-widest font-bold">Status</div>
                        <div className="mt-1.5 flex flex-wrap gap-1">
                          {game.status.map((s, idx) => (
                            <span key={`${s}-${idx}`} className={`px-2.5 py-1 rounded-full text-xs font-bold ${chipClass(s)}`}>
                              {s}
                            </span>
                          ))}
                        </div>
                      </div>
                      <div>
                        <div className="text-zinc-500 text-xs uppercase tracking-widest font-bold">Série / Saga</div>
                        <div className="mt-1.5 text-white font-medium truncate">{game.series || "Não se aplica"}</div>
                      </div>
                      <div>
                        <div className="text-zinc-500 text-xs uppercase tracking-widest font-bold">Publisher</div>
                        <div className="mt-1.5 text-white font-medium truncate">{game.publisher || "Desconhecido"}</div>
                      </div>
                      <div>
                        <div className="text-zinc-500 text-xs uppercase tracking-widest font-bold">Plataforma</div>
                        <div className="mt-1.5 text-zinc-300 font-medium truncate">{game.platform || "PC"}</div>
                      </div>
                      <div>
                        <div className="text-zinc-500 text-xs uppercase tracking-widest font-bold">Tempo de Jogo</div>
                        <div className="mt-1.5 text-cyan-300 font-mono font-bold">{game.playtime || "00h 00m"}</div>
                      </div>
                      <div>
                        <div className="text-zinc-500 text-xs uppercase tracking-widest font-bold">Lançamento</div>
                        <div className="mt-1.5 text-zinc-300 font-mono text-xs">{formatDate(game.releaseDate)}</div>
                      </div>
                      <div>
                        <div className="text-zinc-500 text-xs uppercase tracking-widest font-bold">Data Início</div>
                        <div className="mt-1.5 text-zinc-300 font-mono text-xs">{formatDate(game.startDate)}</div>
                      </div>
                      <div>
                        <div className="text-zinc-500 text-xs uppercase tracking-widest font-bold">Data Término</div>
                        <div className="mt-1.5 text-zinc-300 font-mono text-xs">
                          {game.endDate ? formatDate(game.endDate) : "Em andamento / Em aberto"}
                        </div>
                      </div>
                      <div className="sm:col-span-2 lg:col-span-4">
                        <div className="text-zinc-500 text-xs uppercase tracking-widest font-bold">Nota Pessoal</div>
                        <div className="mt-1.5 flex items-center gap-2">
                          {renderStars(game.rating || 0)}
                          <span className="text-xs text-zinc-400 font-mono font-bold">({game.rating || 0}/5)</span>
                        </div>
                      </div>

                      {game.hltbId && (
                        <div className="sm:col-span-2 lg:col-span-4 border-t border-zinc-900/50 pt-4 mt-1">
                          <div className="text-zinc-500 text-xs uppercase tracking-widest font-bold mb-2">Ficha Técnica HLTB</div>
                          <div className="flex items-center justify-between gap-3 bg-zinc-950/40 border border-zinc-900/60 p-3.5 rounded-2xl">
                            <div className="flex items-center gap-2.5 min-w-0">
                              <Globe size={18} className="text-purple-400 shrink-0" />
                              <div className="min-w-0">
                                <div className="text-xs font-bold text-zinc-300">HowLongToBeat Oficial</div>
                                <div className="text-[10px] text-zinc-500 font-mono truncate">ID: {game.hltbId}</div>
                              </div>
                            </div>
                            <a
                              href={`https://howlongtobeat.com/game/${game.hltbId}`}
                              target="_blank"
                              rel="noreferrer"
                              className="inline-flex items-center gap-1.5 text-xs font-bold text-white bg-purple-600 hover:bg-purple-500 px-3.5 py-2 rounded-xl transition-all shadow-md hover:shadow-purple-500/20 shrink-0 select-none cursor-pointer"
                              title="Abrir página do jogo no HowLongToBeat"
                            >
                              <ExternalLink size={13} />
                              <span>Acessar Link</span>
                            </a>
                          </div>
                        </div>
                      )}
                      
                      {(game.hltbId || game.hltbMain || game.hltbExtra || game.hltbCompletionist) && (
                        <div className="sm:col-span-2 lg:col-span-4 border-t border-zinc-900 pt-5 mt-2">
                          <div className="flex items-center justify-between gap-3 mb-3 flex-wrap">
                            <div className="flex items-center gap-1.5">
                              <Globe size={14} className="text-purple-400" />
                              <span className="text-zinc-500 text-xs uppercase tracking-widest font-bold">Estimativas HowLongToBeat</span>
                            </div>
                            {game.hltbId && (
                              <button
                                type="button"
                                onClick={isAdmin ? handleSyncHltb : () => triggerAlert("Modo Admin Necessário", "É necessário ativar o Modo Admin para atualizar e persistir os dados do HowLongToBeat.") }
                                disabled={isSyncingHltb}
                                className={`text-xs font-bold flex items-center gap-1.5 transition-all px-3 py-1.5 rounded-xl cursor-pointer disabled:opacity-50 select-none ${
                                  isAdmin 
                                    ? "text-amber-400 bg-amber-950/20 hover:bg-amber-950/40 border border-amber-800/30" 
                                    : "text-zinc-400 bg-zinc-900 border border-zinc-800 hover:text-white"
                                }`}
                                title={isAdmin ? "Sincronizar médias mais recentes diretamente do HowLongToBeat" : "Ative o Modo Admin para poder atualizar"}
                              >
                                {isSyncingHltb ? (
                                  <Loader2 size={12} className="animate-spin text-amber-500" />
                                ) : (
                                  <RefreshCw size={12} />
                                )}
                                <span>{isAdmin ? "Atualizar Dados" : "Sincronizar (Requer Admin)"}</span>
                              </button>
                            )}
                          </div>
                          
                          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                            <div className="p-3 rounded-2xl bg-zinc-950/40 border border-zinc-900 flex flex-col justify-between">
                              <span className="text-[10px] uppercase tracking-wider text-zinc-500 font-bold block">Campanha</span>
                              <span className="text-sm font-extrabold text-purple-400 font-mono mt-1 block">
                                {game.hltbMain || "—"}
                              </span>
                            </div>
                            <div className="p-3 rounded-2xl bg-zinc-950/40 border border-zinc-900 flex flex-col justify-between">
                              <span className="text-[10px] uppercase tracking-wider text-zinc-500 font-bold block">História + Extras</span>
                              <span className="text-sm font-extrabold text-cyan-400 font-mono mt-1 block">
                                {game.hltbExtra || "—"}
                              </span>
                            </div>
                            <div className="p-3 rounded-2xl bg-zinc-950/40 border border-zinc-900 flex flex-col justify-between">
                              <span className="text-[10px] uppercase tracking-wider text-zinc-500 font-bold block">Complecionista (100%)</span>
                              <span className="text-sm font-extrabold text-pink-400 font-mono mt-1 block">
                                {game.hltbCompletionist || "—"}
                              </span>
                            </div>
                          </div>
                          
                          {game.hltbId && (
                            <div className="mt-3 text-[10px] text-zinc-500 flex items-center gap-1.5 flex-wrap">
                              <span>ID do Jogo:</span>
                              <code className="bg-zinc-900 px-1.5 py-0.5 rounded text-zinc-400 font-mono text-[9px]">{game.hltbId}</code>
                              <span className="text-zinc-700">|</span>
                              <a 
                                href={`https://howlongtobeat.com/game/${game.hltbId}`} 
                                target="_blank" 
                                rel="noreferrer"
                                className="text-purple-400 hover:underline inline-flex items-center gap-0.5"
                              >
                                Ver no site oficial ↗
                              </a>
                            </div>
                          )}
                        </div>
                      )}

                      <div className="sm:col-span-2 lg:col-span-4">
                        <div className="text-zinc-500 text-xs uppercase tracking-widest font-bold">Gêneros</div>
                        <div className="mt-1.5 flex flex-wrap gap-1.5">
                          {[...game.genre].sort((a, b) => a.localeCompare(b, "pt", { sensitivity: "base" })).map((g, idx) => (
                            <span key={`${g}-${idx}`} className="px-2.5 py-1 rounded-xl bg-purple-950/40 text-purple-300 text-xs font-bold border border-purple-900/40">
                              {g}
                            </span>
                          ))}
                        </div>
                      </div>
                      <div className="sm:col-span-2 lg:col-span-4">
                        <div className="text-zinc-500 text-xs uppercase tracking-widest font-bold">Tags</div>
                        <div className="mt-1.5 flex flex-wrap gap-1.5">
                          {[...game.tags].sort((a, b) => a.localeCompare(b, "pt", { sensitivity: "base" })).map((t, idx) => (
                            <span key={`${t}-${idx}`} className="px-2.5 py-1 rounded-xl bg-zinc-900 text-cyan-300 text-xs font-bold border border-cyan-900/30">
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
                          initial={{ opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: "auto" }}
                          exit={{ opacity: 0, height: 0 }}
                          className="glass rounded-3xl border border-zinc-800 p-5 space-y-4 overflow-hidden shadow-lg"
                        >
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                              <label className="block text-[10px] uppercase tracking-[0.25em] text-zinc-500 font-bold mb-1">
                                Período de Aventura *
                              </label>
                              <div className="flex items-center gap-2 font-mono text-sm">
                                <input
                                  type="date"
                                  value={diaryStart}
                                  onChange={(e) => setDiaryStart(e.target.value)}
                                  className="flex-1 px-3 py-2 rounded-xl bg-zinc-950 border border-zinc-800 text-white outline-none focus:ring-2 focus:ring-cyan-500 text-xs"
                                />
                                <span className="text-zinc-500">~</span>
                                <input
                                  type="date"
                                  value={diaryEnd}
                                  onChange={(e) => setDiaryEnd(e.target.value)}
                                  className="flex-1 px-3 py-2 rounded-xl bg-zinc-950 border border-zinc-800 text-white outline-none focus:ring-2 focus:ring-cyan-500 text-xs"
                                />
                              </div>
                            </div>
                            <div>
                              <label className="block text-[10px] uppercase tracking-[0.25em] text-zinc-500 font-bold mb-1">
                                Anexar Screenshot ou Vídeo (ImgBB & YouTube)
                              </label>
                              <div className="flex gap-2 items-center flex-col sm:flex-row">
                                <label className="w-full sm:w-auto text-center px-4 py-2.5 rounded-xl border border-zinc-800 bg-zinc-950 hover:bg-zinc-900 text-zinc-300 font-semibold text-xs select-none flex items-center justify-center gap-1.5 transition-all cursor-pointer disabled:opacity-50">
                                  {isUploadingMedia ? (
                                    <>
                                      <span className="w-3 h-3 border-2 border-cyan-400 border-t-transparent rounded-full animate-spin" />
                                      <span>Enviando...</span>
                                    </>
                                  ) : (
                                    <>
                                      <Upload size={12} className="text-purple-400" /> 
                                      <span>Upload ImgBB</span>
                                    </>
                                  )}
                                  <input
                                    type="file"
                                    multiple
                                    disabled={isUploadingMedia}
                                    accept="image/*,video/*"
                                    onChange={handleDiaryMediaUpload}
                                    className="hidden"
                                  />
                                </label>
                                <div className="flex flex-1 w-full gap-2 items-center">
                                  <input
                                    type="url"
                                    value={diaryScreenshotUrl}
                                    onChange={(e) => setDiaryScreenshotUrl(e.target.value)}
                                    placeholder="Colar link de Imagem ou YouTube..."
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
                          </div>

                          {tempDiaryMedias.length > 0 && (
                            <div className="grid grid-cols-3 sm:grid-cols-4 gap-2 p-3 rounded-2xl bg-zinc-950 border border-zinc-800">
                              {tempDiaryMedias.map((m, idx) => {
                                const isYt = isYoutubeUrl(m.src);
                                const ytThumb = isYt ? `https://img.youtube.com/vi/${getYoutubeEmbedUrl(m.src)?.split("/embed/")[1]}/0.jpg` : "";

                                return (
                                  <div key={idx} className="h-16 rounded-xl overflow-hidden border border-zinc-800 bg-zinc-900 relative group">
                                    {isYt ? (
                                      <img src={ytThumb} className="w-full h-full object-cover" alt="YouTube Thumbnail" referrerPolicy="no-referrer" />
                                    ) : m.isVideo ? (
                                      <video src={m.src} className="w-full h-full object-cover" muted />
                                    ) : (
                                      <img src={m.src} className="w-full h-full object-cover" alt="prev" referrerPolicy="no-referrer" />
                                    )}
                                    <div className="absolute bottom-1 right-1 bg-black/75 px-1 py-0.5 rounded-md text-[8px] text-zinc-300 flex items-center gap-0.5">
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
                                    <button
                                      type="button"
                                      onClick={() => setTempDiaryMedias((prev) => prev.filter((_, i) => i !== idx))}
                                      className="absolute top-1 right-1 w-5 h-5 rounded-full bg-red-600/80 hover:bg-red-500 text-white flex items-center justify-center transition-all cursor-pointer shadow-md z-10"
                                      title="Remover mídia"
                                    >
                                      <X size={10} />
                                    </button>
                                  </div>
                                );
                              })}
                            </div>
                          )}

                          <div>
                            <label className="block text-[10px] uppercase tracking-[0.25em] text-zinc-500 font-bold mb-1">
                              {editingDiaryId ? "Editar Entrada de Diário *" : "Entrada de Diário *"}
                            </label>
                            <RichTextEditor
                              value={diaryText}
                              onChange={setDiaryText}
                              placeholder="Relate conquistas, batalhas difíceis, sentimentos, chefes derrotados..."
                            />
                          </div>
                          <div className="flex justify-end gap-2">
                            <button
                              type="button"
                              onClick={handleCancelDiary}
                              className="px-4 py-2 rounded-xl bg-zinc-900 border border-zinc-800 text-zinc-300 font-semibold hover:bg-zinc-850 text-xs"
                            >
                              Cancelar
                            </button>
                            <button
                              type="button"
                              onClick={handleAddDiarySubmit}
                              className="px-4 py-2 rounded-xl bg-gradient-to-r from-purple-600 to-cyan-500 text-white font-bold text-xs"
                            >
                              {editingDiaryId ? "Atualizar Entrada" : "Publicar Entrada"}
                            </button>
                          </div>
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

                      {game.diary && game.diary.map((entry) => {
                        const isCollapsed = !!collapsedEntries[entry.id];
                        return (
                          <div key={entry.id} id={`diary-entry-${entry.id}`} className="relative pl-6 border-l-2 border-cyan-500/20 pb-4 scroll-mt-10">
                            <div className="absolute -left-[7px] top-1.5 w-3 h-3 rounded-full bg-cyan-400 ring-4 ring-[#080a10]" />
                            <div className="flex items-center justify-between gap-2">
                              <span
                                className="px-3 py-1.5 rounded-xl chip-pink text-xs sm:text-sm font-bold uppercase tracking-wider font-mono cursor-pointer hover:bg-pink-950/40 hover:border-pink-500/40 transition-all flex items-center gap-1.5 select-none"
                                onClick={() => setCollapsedEntries((prev) => ({ ...prev, [entry.id]: !prev[entry.id] }))}
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
                                  initial={{ opacity: 0, height: 0 }}
                                  animate={{ opacity: 1, height: "auto" }}
                                  exit={{ opacity: 0, height: 0 }}
                                  transition={{ duration: 0.2 }}
                                  className="overflow-hidden"
                                >
                                  <div
                                    className="mt-3 text-sm text-zinc-300 leading-relaxed prose prose-content max-w-none break-words"
                                    dangerouslySetInnerHTML={{ __html: entry.text }}
                                  />

                                  {entry.medias && entry.medias.length > 0 && (
                                    <details className="mt-3 glass rounded-2xl overflow-hidden border border-zinc-800 group">
                                      <summary className="cursor-pointer select-none px-4 py-2.5 text-xs font-bold text-cyan-300 flex items-center justify-between hover:bg-zinc-900/30">
                                        <span>Mostrar Mídias Anexas ({entry.medias.length})</span>
                                        <ChevronDown size={14} className="group-open:rotate-180 transition-transform duration-200 text-cyan-500" />
                                      </summary>
                                      <div className="p-4 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 bg-zinc-950/40">
                                        {entry.medias.map((m, mIdx) => {
                                          const embedUrl = getYoutubeEmbedUrl(m.src);
                                          return (
                                            <div key={mIdx} className="rounded-xl overflow-hidden border border-zinc-800 bg-black aspect-video w-full flex items-center justify-center">
                                              {embedUrl ? (
                                                <iframe
                                                  src={embedUrl}
                                                  title={`Vídeo do YouTube - ${mIdx}`}
                                                  frameBorder="0"
                                                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                                                  allowFullScreen
                                                  className="w-full h-full"
                                                />
                                              ) : m.isVideo ? (
                                                <video src={m.src} controls className="w-full h-full object-contain" />
                                              ) : (
                                                <img
                                                  src={m.src}
                                                  className="w-full h-full object-contain cursor-zoom-in transition-transform duration-300 hover:scale-[1.03]"
                                                  alt="Anexo de diário"
                                                  referrerPolicy="no-referrer"
                                                  onClick={() => setZoomedImage(m.src)}
                                                  onError={(e: any) => {
                                                    (e.target as HTMLImageElement).src = "https://placehold.co/400x300/040406/ffffff?text=Falha+de+Mídia";
                                                  }}
                                                />
                                              )}
                                            </div>
                                          );
                                        })}
                                      </div>
                                    </details>
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
                          {game.diary.map((entry) => (
                            <button
                              key={entry.id}
                              onClick={() => {
                                document.getElementById(`diary-entry-${entry.id}`)?.scrollIntoView({ behavior: "smooth", block: "center" });
                                setIsIndexOpen(false); // Close after clicking
                              }}
                              className="w-full text-left px-3 py-2 rounded-xl bg-zinc-900/40 hover:bg-cyan-950/20 border border-zinc-800/60 hover:border-cyan-500/40 transition-all group flex items-center justify-between cursor-pointer"
                            >
                              <span className="text-xs font-mono font-bold text-pink-400 group-hover:text-pink-300 truncate">
                                {entry.period}
                              </span>
                            </button>
                          ))}
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

      {/* Zoomed Image Dialog Overlay */}
      <AnimatePresence>
        {zoomedImage && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-black/90 backdrop-blur-md cursor-zoom-out"
              onClick={() => setZoomedImage(null)}
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.92, y: 15 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.92, y: 15 }}
              transition={{ type: "spring", damping: 28, stiffness: 350 }}
              className="relative max-w-5xl max-h-[90vh] z-10 flex flex-col items-center justify-center pointer-events-none"
            >
              <img
                src={zoomedImage}
                alt="Imagem ampliada do diário"
                className="max-w-full max-h-[85vh] object-contain rounded-2xl shadow-2xl pointer-events-auto cursor-zoom-out border border-zinc-800"
                onClick={() => setZoomedImage(null)}
                referrerPolicy="no-referrer"
                onError={(e: any) => {
                  (e.target as HTMLImageElement).src = "https://placehold.co/800x600/040406/ffffff?text=Falha+de+Mídia";
                }}
              />
              <button
                onClick={() => setZoomedImage(null)}
                className="absolute -top-3 -right-3 sm:top-4 sm:right-4 p-2.5 rounded-full bg-zinc-900 hover:bg-zinc-800 text-white transition-all cursor-pointer border border-zinc-800/80 pointer-events-auto shadow-xl"
                aria-label="Fechar zoom"
              >
                <X size={20} />
              </button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </AnimatePresence>
  );
}
