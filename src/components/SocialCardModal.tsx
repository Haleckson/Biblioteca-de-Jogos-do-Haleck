import React, { useRef, useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  X,
  Download,
  Share2,
  Copy,
  Check,
  Sparkles,
  Trophy,
  Clock,
  Star,
  Gamepad2,
  Quote,
} from "lucide-react";
import { Game, getGameHighestTrophy, getGameTrophies } from "../types";
import { showToast } from "../utils/toast";
import { playRetroSound } from "../utils/audioEffects";

interface SocialCardModalProps {
  isOpen: boolean;
  onClose: () => void;
  game: Game | null;
}

type AspectRatio = "1:1" | "16:9" | "9:16";
type CardTheme = "cyber" | "gold" | "twilight" | "minimal";

export default function SocialCardModal({ isOpen, onClose, game }: SocialCardModalProps) {
  const [aspectRatio, setAspectRatio] = useState<AspectRatio>("16:9");
  const [theme, setTheme] = useState<CardTheme>("cyber");
  const [customQuote, setCustomQuote] = useState<string>("");
  const [copied, setCopied] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const cardRef = useRef<HTMLDivElement>(null);

  if (!isOpen || !game) return null;

  const highestTrophy = getGameHighestTrophy(game);
  const trophiesList = getGameTrophies(game);

  // Theme styling helpers
  const getThemeClasses = () => {
    switch (theme) {
      case "cyber":
        return {
          bg: "bg-gradient-to-br from-zinc-950 via-zinc-900 to-cyan-950/80 border-cyan-500/40 text-cyan-100",
          accent: "text-cyan-400 border-cyan-500/50 bg-cyan-500/10",
          title: "text-cyan-300",
          glow: "bg-cyan-500/20 shadow-cyan-500/30",
        };
      case "gold":
        return {
          bg: "bg-gradient-to-br from-zinc-950 via-zinc-900 to-amber-950/80 border-amber-500/50 text-amber-100",
          accent: "text-amber-400 border-amber-500/50 bg-amber-500/10",
          title: "text-amber-300",
          glow: "bg-amber-500/20 shadow-amber-500/30",
        };
      case "twilight":
        return {
          bg: "bg-gradient-to-br from-zinc-950 via-slate-900 to-indigo-950/80 border-indigo-500/40 text-indigo-100",
          accent: "text-indigo-400 border-indigo-500/50 bg-indigo-500/10",
          title: "text-indigo-300",
          glow: "bg-indigo-500/20 shadow-indigo-500/30",
        };
      case "minimal":
      default:
        return {
          bg: "bg-gradient-to-br from-zinc-950 to-zinc-900 border-zinc-700/60 text-zinc-100",
          accent: "text-white border-zinc-600 bg-zinc-800",
          title: "text-white",
          glow: "bg-zinc-700/20 shadow-zinc-800/30",
        };
    }
  };

  const currentTheme = getThemeClasses();

  // Aspect ratio wrapper style
  const getRatioDimensions = () => {
    switch (aspectRatio) {
      case "1:1":
        return "w-full max-w-[420px] aspect-square";
      case "9:16":
        return "w-full max-w-[320px] aspect-[9/16]";
      case "16:9":
      default:
        return "w-full max-w-[520px] aspect-[16/9]";
    }
  };

  const handleCopyPostText = () => {
    const statusArray = Array.isArray(game.status) ? game.status : typeof game.status === "string" ? [game.status] : [];
    const text = `🎮 Status: ${game.name}\n` +
      `📌 Plataforma: ${game.platform}\n` +
      `⭐ Nota: ${game.rating}/5\n` +
      `⏱️ Tempo Jogado: ${game.playtime || "N/A"}\n` +
      `${statusArray.length > 0 ? `🏷️ ${statusArray.join(", ")}\n` : ""}` +
      `${customQuote ? `💬 "${customQuote}"\n` : ""}` +
      `#Gamer #GamingBacklog #${game.name.replace(/\s+/g, "")}`;

    navigator.clipboard.writeText(text);
    setCopied(true);
    playRetroSound("click");
    showToast({
      title: "Copiado! 📋",
      message: "Texto formatado para post enviado para a área de transferência.",
      type: "success",
    });
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownloadImage = async () => {
    if (!cardRef.current) return;
    setDownloading(true);
    playRetroSound("save");

    try {
      // Use SVG canvas snapshot or SVG dataUrl conversion
      const cardEl = cardRef.current;
      const width = cardEl.offsetWidth * 2;
      const height = cardEl.offsetHeight * 2;

      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext("2d");

      if (ctx) {
        // Render stylized preview onto canvas
        ctx.fillStyle = theme === "cyber" ? "#090d16" : theme === "gold" ? "#140f07" : "#09090b";
        ctx.fillRect(0, 0, width, height);

        // Draw cover if image loaded
        const img = new Image();
        img.crossOrigin = "anonymous";
        img.src = game.cover;

        await new Promise((resolve) => {
          img.onload = resolve;
          img.onerror = resolve;
        });

        if (img.complete && img.naturalWidth) {
          ctx.globalAlpha = 0.35;
          ctx.drawImage(img, 0, 0, width, height);
          ctx.globalAlpha = 1.0;
        }

        // Overlay gradient
        const grad = ctx.createLinearGradient(0, 0, 0, height);
        grad.addColorStop(0, "rgba(0,0,0,0.4)");
        grad.addColorStop(1, "rgba(0,0,0,0.95)");
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, width, height);

        // Draw text
        ctx.fillStyle = "#ffffff";
        ctx.font = "bold 32px sans-serif";
        ctx.fillText(game.name, 40, height - 120);

        ctx.fillStyle = theme === "cyber" ? "#22d3ee" : theme === "gold" ? "#fbbf24" : "#a1a1aa";
        ctx.font = "bold 20px sans-serif";
        ctx.fillText(`${game.platform} • ⭐ ${game.rating}/5 • ⏱️ ${game.playtime || "0h"}`, 40, height - 70);

        if (customQuote) {
          ctx.fillStyle = "#e4e4e7";
          ctx.font = "italic 18px sans-serif";
          ctx.fillText(`"${customQuote}"`, 40, height - 30);
        }

        const dataUrl = canvas.toDataURL("image/png");
        const a = document.createElement("a");
        a.href = dataUrl;
        a.download = `${game.name.toLowerCase().replace(/\s+/g, "_")}_social_card.png`;
        a.click();

        showToast({
          title: "Card Baixado! 📸",
          message: "A imagem do card foi salva no seu dispositivo.",
          type: "success",
        });
      }
    } catch (e) {
      console.warn("Card download canvas error:", e);
      showToast({
        title: "Download Iniciado",
        message: "Gerando imagem do card...",
        type: "info",
      });
    } finally {
      setDownloading(false);
    }
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[99999] flex items-center justify-center p-3 sm:p-5 bg-black/80 backdrop-blur-md">
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 15 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 15 }}
          className="bg-zinc-950 border border-zinc-800 rounded-3xl w-full max-w-3xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden relative"
        >
          {/* Header */}
          <div className="p-4 sm:p-5 border-b border-zinc-800/80 flex items-center justify-between bg-zinc-900/50">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-2xl bg-cyan-500/10 border border-cyan-500/30 text-cyan-400">
                <Share2 size={22} />
              </div>
              <div>
                <h3 className="text-lg font-black text-white flex items-center gap-2">
                  <span>Gerador de Card para Redes Sociais</span>
                  <Sparkles size={16} className="text-amber-400 animate-pulse" />
                </h3>
                <p className="text-xs text-zinc-400 mt-0.5">
                  Crie posts e histórias impressionantes para Discord, Twitter/X e Instagram.
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-2 rounded-xl bg-zinc-900 hover:bg-zinc-800 text-zinc-400 hover:text-white transition-all cursor-pointer"
            >
              <X size={18} />
            </button>
          </div>

          {/* Settings controls */}
          <div className="p-4 border-b border-zinc-800/60 bg-zinc-950 flex flex-wrap items-center justify-between gap-3">
            {/* Format selector */}
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-zinc-400">Formato:</span>
              {(["16:9", "1:1", "9:16"] as AspectRatio[]).map((r) => (
                <button
                  key={r}
                  onClick={() => setAspectRatio(r)}
                  className={`px-3 py-1 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                    aspectRatio === r
                      ? "bg-cyan-500 text-zinc-950 shadow-md shadow-cyan-500/20"
                      : "bg-zinc-900 text-zinc-400 hover:bg-zinc-800 border border-zinc-800"
                  }`}
                >
                  {r === "16:9" ? "Landscape (16:9)" : r === "1:1" ? "Quadrado (1:1)" : "Story (9:16)"}
                </button>
              ))}
            </div>

            {/* Theme selector */}
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-zinc-400">Tema:</span>
              {[
                { id: "cyber", name: "Cyber Cyan" },
                { id: "gold", name: "Ouro Luxo" },
                { id: "twilight", name: "Crepúsculo" },
                { id: "minimal", name: "Minimalista" },
              ].map((t) => (
                <button
                  key={t.id}
                  onClick={() => setTheme(t.id as CardTheme)}
                  className={`px-2.5 py-1 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                    theme === t.id
                      ? "bg-amber-500 text-zinc-950 shadow-md shadow-amber-500/20"
                      : "bg-zinc-900 text-zinc-400 hover:bg-zinc-800 border border-zinc-800"
                  }`}
                >
                  {t.name}
                </button>
              ))}
            </div>
          </div>

          {/* Card Preview & Quote Input */}
          <div className="p-4 sm:p-6 flex-1 overflow-y-auto custom-scrollbar flex flex-col items-center justify-center gap-4 bg-zinc-900/30">
            {/* Live Card Container */}
            <div
              ref={cardRef}
              className={`relative rounded-3xl overflow-hidden border shadow-2xl p-5 sm:p-6 flex flex-col justify-between transition-all duration-300 ${getRatioDimensions()} ${currentTheme.bg}`}
            >
              {/* Cover background blend */}
              {game.cover && (
                <div
                  className="absolute inset-0 bg-cover bg-center opacity-25 mix-blend-overlay pointer-events-none filter blur-sm scale-105"
                  style={{ backgroundImage: `url(${game.cover})` }}
                />
              )}

              {/* Top Header Row */}
              <div className="relative z-10 flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <div className={`p-2 rounded-xl border ${currentTheme.accent}`}>
                    <Gamepad2 size={20} />
                  </div>
                  <div>
                    <span className="text-[10px] font-mono font-bold tracking-widest uppercase opacity-75">
                      {game.platform}
                    </span>
                    <h4 className={`text-base sm:text-lg font-black leading-tight truncate ${currentTheme.title}`}>
                      {game.name}
                    </h4>
                  </div>
                </div>

                {highestTrophy !== "none" && (
                  <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-500/20 border border-amber-400/50 text-amber-300 text-xs font-black shadow-lg">
                    <Trophy size={14} className="animate-pulse" />
                    <span className="capitalize">{highestTrophy}</span>
                  </div>
                )}
              </div>

              {/* Middle Section: Cover + Metrics */}
              <div className="relative z-10 my-3 flex items-center gap-4">
                {game.cover && (
                  <img
                    src={game.cover}
                    alt={game.name}
                    className="w-20 h-28 sm:w-24 sm:h-32 object-cover rounded-2xl shadow-xl border border-white/20 shrink-0"
                  />
                )}
                <div className="flex-1 min-w-0 space-y-2">
                  <div className="flex flex-wrap gap-1.5">
                    {(Array.isArray(game.status) ? game.status : typeof game.status === "string" ? [game.status] : []).map((s) => (
                      <span
                        key={s}
                        className="px-2.5 py-1 rounded-lg bg-zinc-950/80 border border-white/10 text-[10px] font-bold text-white uppercase tracking-wider shadow-sm"
                      >
                        {s}
                      </span>
                    ))}
                  </div>

                  <div className="flex items-center gap-3 text-sm font-bold text-white flex-wrap">
                    <span className="flex items-center gap-1 text-amber-400">
                      <Star size={16} className="fill-amber-400" />
                      <span>{game.rating} / 5</span>
                    </span>
                    {game.playtime && (
                      <span className="flex items-center gap-1 text-cyan-300">
                        <Clock size={16} />
                        <span>{game.playtime}</span>
                      </span>
                    )}
                  </div>

                  {customQuote && (
                    <div className="p-2.5 rounded-xl bg-zinc-950/60 border border-white/10 text-xs text-zinc-200 italic flex items-start gap-1.5">
                      <Quote size={14} className="shrink-0 text-amber-400 mt-0.5" />
                      <p className="line-clamp-2">"{customQuote}"</p>
                    </div>
                  )}
                </div>
              </div>

              {/* Footer Stamp */}
              <div className="relative z-10 border-t border-white/10 pt-2.5 flex items-center justify-between text-[11px] font-semibold text-zinc-400">
                <span className="font-mono text-cyan-400">#GamingBacklog</span>
                <span>Diário de Jogatina</span>
              </div>
            </div>

            {/* Custom Quote Input */}
            <div className="w-full max-w-lg">
              <label className="text-xs font-bold text-zinc-400 flex items-center gap-1.5 mb-1.5">
                <Quote size={14} className="text-cyan-400" />
                <span>Adicionar Frase / Destaque do Diário (Opcional):</span>
              </label>
              <input
                type="text"
                value={customQuote}
                onChange={(e) => setCustomQuote(e.target.value)}
                placeholder="Ex: 'Uma das melhores batalhas de chefe da geração!'"
                className="w-full px-3.5 py-2 rounded-xl bg-zinc-900 border border-zinc-800 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-cyan-500 transition-colors"
              />
            </div>
          </div>

          {/* Footer Actions */}
          <div className="p-4 border-t border-zinc-800/80 bg-zinc-950 flex items-center justify-end gap-2">
            <button
              onClick={handleCopyPostText}
              className="px-4 py-2 rounded-xl bg-zinc-900 hover:bg-zinc-800 border border-zinc-700 text-zinc-200 text-xs font-bold transition-all cursor-pointer flex items-center gap-2 active:scale-95"
            >
              {copied ? <Check size={16} className="text-emerald-400" /> : <Copy size={16} />}
              <span>{copied ? "Texto Copiado!" : "Copiar Texto Formatado"}</span>
            </button>

            <button
              onClick={handleDownloadImage}
              disabled={downloading}
              className="px-4 py-2 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-zinc-950 text-xs font-black transition-all cursor-pointer flex items-center gap-2 shadow-lg shadow-cyan-500/20 active:scale-95 disabled:opacity-50"
            >
              <Download size={16} />
              <span>{downloading ? "Gerando..." : "Baixar Card (PNG)"}</span>
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
