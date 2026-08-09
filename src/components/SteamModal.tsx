/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useState } from "react";
import {
  Gamepad2,
  X,
  Search,
  RefreshCw,
  ExternalLink,
  CheckCircle2,
  Key,
  Clock,
  Sparkles,
  Trophy,
  Plus,
  Tv,
  Check,
  AlertCircle,
} from "lucide-react";
import {
  getStoredSteamApiKey,
  setStoredSteamApiKey,
  getStoredSteamId64,
  setStoredSteamId64,
  fetchSteamProfile,
  fetchSteamOwnedGames,
  formatSteamPlaytime,
  getSteamHeaderImageUrl,
  SteamPlayerSummary,
  SteamOwnedGame,
} from "../utils/steamApi";
import { Game } from "../types";
import { useBodyScrollLock } from "../lib/bodyScrollLock";

interface SteamModalProps {
  isOpen: boolean;
  onClose: () => void;
  games: Game[];
  onImportGame: (newGame: Partial<Game>) => void;
  onUpdateGamePlaytime: (gameId: string, steamPlaytimeMins: number, appid: number) => void;
}

export default function SteamModal({
  isOpen,
  onClose,
  games,
  onImportGame,
  onUpdateGamePlaytime,
}: SteamModalProps) {
  useBodyScrollLock(isOpen);

  const [apiKey, setApiKey] = useState(getStoredSteamApiKey());
  const [steamId, setSteamId] = useState(getStoredSteamId64());
  const [showConfig, setShowConfig] = useState(false);

  const [loadingProfile, setLoadingProfile] = useState(false);
  const [loadingGames, setLoadingGames] = useState(false);
  const [profile, setProfile] = useState<SteamPlayerSummary | null>(null);
  const [ownedGames, setOwnedGames] = useState<SteamOwnedGame[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [importedIds, setImportedIds] = useState<Set<number>>(new Set());
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      loadSteamData();
    }
  }, [isOpen]);

  const loadSteamData = async () => {
    setLoadingProfile(true);
    setLoadingGames(true);
    setStatusMessage(null);

    const prof = await fetchSteamProfile(apiKey, steamId);
    setProfile(prof);
    setLoadingProfile(false);

    const steamGames = await fetchSteamOwnedGames(apiKey, steamId);
    setOwnedGames(steamGames);
    setLoadingGames(false);
  };

  const handleSaveConfig = (e: React.FormEvent) => {
    e.preventDefault();
    setStoredSteamApiKey(apiKey);
    setStoredSteamId64(steamId);
    setShowConfig(false);
    setStatusMessage("Configurações da Steam salvas!");
    loadSteamData();
  };

  if (!isOpen) return null;

  // Match Steam games to current local library
  const getMatchedLocalGame = (steamGame: SteamOwnedGame): Game | undefined => {
    return games.find((g) => {
      if (g.steamAppId && String(g.steamAppId) === String(steamGame.appid)) return true;
      return g.name.trim().toLowerCase() === steamGame.name.trim().toLowerCase();
    });
  };

  const handleImportSingle = (steamGame: SteamOwnedGame) => {
    const existing = getMatchedLocalGame(steamGame);
    const playtimeStr = formatSteamPlaytime(steamGame.playtime_forever);

    if (existing) {
      // Update playtime
      onUpdateGamePlaytime(existing.id, steamGame.playtime_forever, steamGame.appid);
      setImportedIds((prev) => new Set(prev).add(steamGame.appid));
      setStatusMessage(`Horas sincronizadas para "${existing.name}" (${playtimeStr})!`);
    } else {
      // Import as new game
      const newGame: Partial<Game> = {
        name: steamGame.name,
        platform: "PC (Steam)",
        playtime: playtimeStr,
        cover: getSteamHeaderImageUrl(steamGame.appid),
        icon: steamGame.img_icon_url
          ? `http://media.steampowered.com/steamcommunity/public/images/apps/${steamGame.appid}/${steamGame.img_icon_url}.jpg`
          : "🎮",
        iconType: steamGame.img_icon_url ? "url" : "emoji",
        status: steamGame.playtime_forever > 0 ? ["Jogando"] : ["Planejado"],
        genre: ["PC"],
        tags: ["Steam"],
        series: "",
        publisher: "Steam",
        rating: 0,
        startDate: new Date().toISOString().slice(0, 10),
        endDate: "",
        releaseDate: "",
        diary: [],
        steamAppId: steamGame.appid,
        steamPlaytimeMinutes: steamGame.playtime_forever,
        steamLastPlayedTimestamp: steamGame.rtime_last_played,
      };

      onImportGame(newGame);
      setImportedIds((prev) => new Set(prev).add(steamGame.appid));
      setStatusMessage(`"${steamGame.name}" importado com sucesso para a biblioteca!`);
    }
  };

  const filteredGames = ownedGames.filter((g) =>
    g.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md animate-fade-in cursor-pointer"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className="relative w-full max-w-4xl bg-[#0d0e17] border border-cyan-500/30 rounded-3xl p-6 sm:p-7 shadow-2xl text-white space-y-6 overflow-hidden max-h-[90vh] flex flex-col cursor-default"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Top Gradient */}
        <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-blue-600 via-cyan-500 to-indigo-600" />

        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-2 text-zinc-400 hover:text-white rounded-xl hover:bg-white/10 transition-colors cursor-pointer"
          title="Fechar"
        >
          <X size={18} />
        </button>

        {/* Header Title */}
        <div className="flex items-center justify-between gap-4 pr-8">
          <div className="flex items-center gap-3.5">
            <div className="p-3 bg-blue-500/10 border border-blue-500/30 rounded-2xl text-blue-400">
              <Gamepad2 size={24} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-xl font-bold text-white tracking-tight">Integração Steam Web API</h3>
                <span className="text-[10px] font-bold text-blue-300 bg-blue-950/60 border border-blue-500/30 px-2 py-0.5 rounded-full uppercase tracking-wider">
                  Modo Híbrido
                </span>
              </div>
              <p className="text-xs text-zinc-400 mt-0.5">
                Sincronize jogos, horas de jogo e estatísticas diretamente da sua conta Steam.
              </p>
            </div>
          </div>

          <button
            onClick={() => setShowConfig(!showConfig)}
            className="p-2.5 bg-zinc-900 hover:bg-zinc-800 border border-zinc-700/80 rounded-xl text-zinc-300 hover:text-white text-xs font-bold transition-all flex items-center gap-2 cursor-pointer"
          >
            <Key size={14} className="text-cyan-400" />
            {showConfig ? "Ver Jogos" : "Chaves API"}
          </button>
        </div>

        {/* Notification Toast */}
        {statusMessage && (
          <div className="p-3 bg-cyan-950/60 border border-cyan-500/40 rounded-xl text-cyan-200 text-xs font-semibold flex items-center gap-2 animate-fade-in">
            <CheckCircle2 size={16} className="text-cyan-400 shrink-0" />
            <span>{statusMessage}</span>
          </div>
        )}

        {/* Content Body */}
        <div className="space-y-5 overflow-y-auto pr-1 flex-1 custom-scrollbar">
          {/* Config Form Panel (Toggleable) */}
          {showConfig && (
            <form onSubmit={handleSaveConfig} className="p-4 bg-zinc-900/80 border border-zinc-800 rounded-2xl space-y-4">
              <h4 className="text-sm font-bold text-white flex items-center gap-2">
                <Key size={16} className="text-cyan-400" />
                Credenciais da API Steam (BYOB)
              </h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-zinc-300 mb-1">
                    Chave Web API do Steam
                  </label>
                  <input
                    type="password"
                    value={apiKey}
                    onChange={(e) => setApiKey(e.target.value)}
                    placeholder="Chave de API Steam"
                    className="w-full bg-zinc-950 border border-zinc-700 focus:border-cyan-500 rounded-xl px-3 py-2 text-xs text-white outline-none"
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-zinc-300 mb-1">
                    Steam ID64
                  </label>
                  <input
                    type="text"
                    value={steamId}
                    onChange={(e) => setSteamId(e.target.value)}
                    placeholder="ex: 76561198066251037"
                    className="w-full bg-zinc-950 border border-zinc-700 focus:border-cyan-500 rounded-xl px-3 py-2 text-xs text-white outline-none"
                    required
                  />
                </div>
              </div>

              <div className="flex items-center justify-between pt-2">
                <p className="text-[11px] text-zinc-400">
                  Chave configurada para sincronização sem limites com a comunidade Steam.
                </p>
                <button
                  type="submit"
                  className="px-4 py-2 bg-cyan-600 hover:bg-cyan-500 text-white font-bold text-xs rounded-xl transition-all shadow-md cursor-pointer"
                >
                  Salvar Credenciais
                </button>
              </div>
            </form>
          )}

          {/* Steam User Profile Card */}
          <div className="p-4 bg-gradient-to-r from-zinc-900/90 via-[#121624] to-zinc-900/90 border border-blue-500/20 rounded-2xl flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-3.5">
              {loadingProfile ? (
                <div className="w-12 h-12 rounded-2xl bg-zinc-800 animate-pulse" />
              ) : profile ? (
                <img
                  src={profile.avatarfull || profile.avatarmedium}
                  alt={profile.personaname}
                  className="w-12 h-12 rounded-2xl border-2 border-cyan-500/50 shadow-md object-cover"
                />
              ) : (
                <div className="w-12 h-12 rounded-2xl bg-zinc-800 border border-zinc-700 flex items-center justify-center text-zinc-500">
                  <Gamepad2 size={24} />
                </div>
              )}

              <div>
                <div className="flex items-center gap-2">
                  <h4 className="font-bold text-base text-white">
                    {profile ? profile.personaname : "Sessão Steam"}
                  </h4>
                  {profile && (
                    <span
                      className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                        profile.gameextrainfo
                          ? "bg-emerald-950/80 text-emerald-300 border-emerald-500/40"
                          : profile.personastate > 0
                          ? "bg-blue-950/80 text-blue-300 border-blue-500/40"
                          : "bg-zinc-800 text-zinc-400 border-zinc-700"
                      }`}
                    >
                      {profile.gameextrainfo
                        ? `Jogando: ${profile.gameextrainfo}`
                        : profile.personastate === 1
                        ? "Online"
                        : "Offline"}
                    </span>
                  )}
                </div>

                <p className="text-xs text-zinc-400 mt-0.5">
                  ID: {steamId} {profile?.profileurl && "• Profile URL ativa"}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={loadSteamData}
                disabled={loadingProfile || loadingGames}
                className="px-3.5 py-2 bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 text-zinc-200 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
              >
                <RefreshCw size={14} className={loadingGames ? "animate-spin text-cyan-400" : ""} />
                Atualizar
              </button>

              {profile?.profileurl && (
                <a
                  href={profile.profileurl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-3.5 py-2 bg-blue-950/60 hover:bg-blue-900/60 border border-blue-500/30 text-blue-300 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer"
                >
                  Perfil Steam <ExternalLink size={13} />
                </a>
              )}
            </div>
          </div>

          {/* Owned Games List Header & Search */}
          <div className="space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <h4 className="text-sm font-bold uppercase tracking-wider text-cyan-400 flex items-center gap-2">
                <Gamepad2 size={16} />
                Jogos da sua Biblioteca Steam ({ownedGames.length})
              </h4>

              {/* Search Bar */}
              <div className="relative w-full sm:w-64">
                <Search size={14} className="absolute left-3 top-2.5 text-zinc-400" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Buscar jogo na Steam..."
                  className="w-full bg-zinc-900/90 border border-zinc-800 focus:border-cyan-500 rounded-xl pl-9 pr-3 py-1.5 text-xs text-white placeholder-zinc-500 outline-none"
                />
              </div>
            </div>

            {loadingGames ? (
              <div className="p-8 text-center text-zinc-400 space-y-3 bg-zinc-900/40 rounded-2xl border border-zinc-800">
                <RefreshCw size={24} className="animate-spin text-cyan-400 mx-auto" />
                <p className="text-xs font-semibold">Carregando jogos da sua conta Steam...</p>
              </div>
            ) : filteredGames.length === 0 ? (
              <div className="p-8 text-center text-zinc-500 bg-zinc-900/40 rounded-2xl border border-zinc-800 space-y-2">
                <AlertCircle size={28} className="mx-auto text-zinc-600" />
                <p className="text-xs font-medium">Nenhum jogo encontrado para o filtro digitado.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-h-[380px] overflow-y-auto pr-1 custom-scrollbar">
                {filteredGames.map((steamGame) => {
                  const matchedLocal = getMatchedLocalGame(steamGame);
                  const isJustImported = importedIds.has(steamGame.appid);
                  const playtimeFormatted = formatSteamPlaytime(steamGame.playtime_forever);

                  return (
                    <div
                      key={steamGame.appid}
                      className={`p-3 bg-zinc-900/70 hover:bg-zinc-900 border rounded-2xl transition-all flex items-center justify-between gap-3 group ${
                        matchedLocal
                          ? "border-emerald-500/30 bg-emerald-950/10"
                          : "border-zinc-800/80 hover:border-cyan-500/40"
                      }`}
                    >
                      {/* Left: Thumbnail & Info */}
                      <div className="flex items-center gap-3 min-w-0">
                        <img
                          src={getSteamHeaderImageUrl(steamGame.appid)}
                          alt={steamGame.name}
                          className="w-16 h-9 rounded-lg object-cover border border-zinc-700/60 shrink-0 bg-zinc-950"
                          onError={(e) => {
                            // Fallback if header image isn't generated yet
                            (e.target as HTMLImageElement).src =
                              "https://via.placeholder.com/120x60/18181b/a1a1aa?text=Steam";
                          }}
                        />

                        <div className="min-w-0">
                          <h5 className="font-bold text-xs text-white truncate group-hover:text-cyan-300 transition-colors">
                            {steamGame.name}
                          </h5>
                          <div className="flex items-center gap-2 mt-0.5">
                            <span className="text-[11px] text-cyan-400 font-semibold flex items-center gap-1">
                              <Clock size={11} /> {playtimeFormatted}
                            </span>
                            {matchedLocal && (
                              <span className="text-[10px] font-bold text-emerald-400 bg-emerald-950/80 border border-emerald-500/30 px-1.5 py-0.2 rounded">
                                Na Biblioteca
                              </span>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Right: Action Button */}
                      <div className="shrink-0">
                        {isJustImported ? (
                          <span className="px-2.5 py-1.5 bg-emerald-950 border border-emerald-500/40 text-emerald-300 rounded-xl text-xs font-bold flex items-center gap-1">
                            <Check size={13} /> Sincronizado
                          </span>
                        ) : matchedLocal ? (
                          <button
                            onClick={() => handleImportSingle(steamGame)}
                            className="px-2.5 py-1.5 bg-zinc-800 hover:bg-cyan-950 border border-zinc-700 hover:border-cyan-500/40 text-zinc-300 hover:text-cyan-300 rounded-xl text-xs font-bold transition-all flex items-center gap-1 cursor-pointer"
                            title="Sincronizar horas de jogo"
                          >
                            <RefreshCw size={12} /> Sync Horas
                          </button>
                        ) : (
                          <button
                            onClick={() => handleImportSingle(steamGame)}
                            className="px-3 py-1.5 bg-cyan-600 hover:bg-cyan-500 text-white rounded-xl text-xs font-bold transition-all shadow-md flex items-center gap-1 cursor-pointer"
                          >
                            <Plus size={13} /> Importar
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
