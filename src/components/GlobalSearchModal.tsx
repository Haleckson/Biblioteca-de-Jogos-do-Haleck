/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useMemo, useRef } from "react";
import { Game, DiaryEntry, DictionaryItem } from "../types";
import { Search, X, BookOpen, FileText, Gamepad2, Lightbulb, ChevronRight, Sparkles, Command, ArrowRight } from "lucide-react";
import { cleanHTMLText } from "../utils/htmlSanitizer";
import { useBodyScrollLock } from "../lib/bodyScrollLock";

export interface GlobalSearchResult {
  id: string;
  type: "game" | "diary" | "dictionary" | "notes";
  gameId: string;
  gameName: string;
  gameCover: string;
  gamePlatform: string;
  matchTitle: string;
  matchSnippet?: string;
  diaryId?: string;
  dictionaryItemId?: string;
  variants?: string[];
  formatTextColor?: string;
  formatBgColor?: string;
}

interface GlobalSearchModalProps {
  isOpen: boolean;
  onClose: () => void;
  games: Game[];
  onSelectResult: (gameId: string, options?: { diaryId?: string; openDictionary?: boolean }) => void;
}

// Helper to remove accents for diacritic-insensitive matching
const normalizeText = (str: string | undefined | null): string => {
  if (!str) return "";
  return str
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
};

// Extract a snippet centered around the matching query
const getContextSnippet = (text: string, query: string, maxLength = 120): string => {
  const clean = cleanHTMLText(text);
  const normClean = normalizeText(clean);
  const normQuery = normalizeText(query);
  const index = normClean.indexOf(normQuery);

  if (index === -1) {
    return clean.length > maxLength ? clean.substring(0, maxLength) + "..." : clean;
  }

  const start = Math.max(0, index - 35);
  const end = Math.min(clean.length, index + query.length + 85);
  let snippet = clean.substring(start, end);

  if (start > 0) snippet = "..." + snippet;
  if (end < clean.length) snippet = snippet + "...";

  return snippet;
};

export default function GlobalSearchModal({
  isOpen,
  onClose,
  games,
  onSelectResult,
}: GlobalSearchModalProps) {
  useBodyScrollLock(isOpen);

  const [query, setQuery] = useState("");
  const [activeTab, setActiveTab] = useState<"all" | "game" | "diary" | "dictionary" | "notes">("all");
  const [selectedIndex, setSelectedIndex] = useState(0);

  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  // Auto-focus input when modal opens
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 50);
      setSelectedIndex(0);
    } else {
      setQuery("");
    }
  }, [isOpen]);

  // Compute all matching search results
  const results = useMemo<GlobalSearchResult[]>(() => {
    const trimmed = query.trim();
    if (!trimmed) return [];

    const normQuery = normalizeText(trimmed);
    const matches: GlobalSearchResult[] = [];

    games.forEach((game) => {
      const gameNameNorm = normalizeText(game.name);
      const gamePlatformNorm = normalizeText(game.platform);
      const gamePublisherNorm = normalizeText(game.publisher);
      const gameDeveloperNorm = normalizeText(game.developer);
      const gameStudioNorm = normalizeText(game.studio);
      const gameSeriesNorm = normalizeText(game.series);
      const gameDlcNorm = normalizeText(game.dlcNames);
      const gameTagsNorm = (game.tags || []).map(normalizeText).join(" ");
      const gameGenreNorm = (game.genre || []).map(normalizeText).join(" ");

      // 1. MATCH IN GAME METADATA
      const isGameMatch =
        gameNameNorm.includes(normQuery) ||
        gamePlatformNorm.includes(normQuery) ||
        gamePublisherNorm.includes(normQuery) ||
        gameDeveloperNorm.includes(normQuery) ||
        gameStudioNorm.includes(normQuery) ||
        gameSeriesNorm.includes(normQuery) ||
        gameDlcNorm.includes(normQuery) ||
        gameTagsNorm.includes(normQuery) ||
        gameGenreNorm.includes(normQuery);

      if (isGameMatch) {
        matches.push({
          id: `game_${game.id}`,
          type: "game",
          gameId: game.id,
          gameName: game.name,
          gameCover: game.cover,
          gamePlatform: game.platform || "Indefinida",
          matchTitle: game.name,
          matchSnippet: [game.series, game.platform, game.publisher || game.developer || game.studio, game.genre?.join(", ")].filter(Boolean).join(" • "),
        });
      }

      // 2. MATCH IN DIARY ENTRIES
      if (Array.isArray(game.diary)) {
        game.diary.forEach((entry, idx) => {
          const periodNorm = normalizeText(entry.period);
          const textClean = cleanHTMLText(entry.text);
          const textNorm = normalizeText(textClean);

          if (periodNorm.includes(normQuery) || textNorm.includes(normQuery)) {
            matches.push({
              id: `diary_${game.id}_${entry.id || idx}`,
              type: "diary",
              gameId: game.id,
              gameName: game.name,
              gameCover: game.cover,
              gamePlatform: game.platform || "Indefinida",
              diaryId: entry.id,
              matchTitle: `Diário de Bordo (${entry.period})`,
              matchSnippet: getContextSnippet(entry.text, trimmed),
            });
          }
        });
      }

      // 3. MATCH IN DICTIONARY
      if (Array.isArray(game.dictionary)) {
        game.dictionary.forEach((item) => {
          const termNorm = normalizeText(item.term);
          const groupNorm = normalizeText(item.group);
          const variantsNorm = (item.variants || []).map(normalizeText).join(" ");

          if (termNorm.includes(normQuery) || groupNorm.includes(normQuery) || variantsNorm.includes(normQuery)) {
            matches.push({
              id: `dict_${game.id}_${item.id}`,
              type: "dictionary",
              gameId: game.id,
              gameName: game.name,
              gameCover: game.cover,
              gamePlatform: game.platform || "Indefinida",
              dictionaryItemId: item.id,
              matchTitle: item.term,
              variants: item.variants,
              matchSnippet: item.group ? `Conjunto: "${item.group}"` : "Termo do Dicionário",
              formatTextColor: item.format?.textColor,
              formatBgColor: item.format?.bgColor,
            });
          }
        });
      }

      // 4. MATCH IN PROS/CONS & REPLAY NOTES
      const prosNorm = normalizeText(game.pros);
      const consNorm = normalizeText(game.cons);
      const replayNoteNorm = normalizeText(game.replayNote);

      if (
        (prosNorm.includes(normQuery) || consNorm.includes(normQuery) || replayNoteNorm.includes(normQuery)) &&
        !isGameMatch // Avoid duplicating if already matched in primary game
      ) {
        let snippet = "";
        let title = "Anotação de Avaliação";
        if (prosNorm.includes(normQuery)) {
          snippet = getContextSnippet(game.pros || "", trimmed);
          title = "Prós / Pontos Fortes";
        } else if (consNorm.includes(normQuery)) {
          snippet = getContextSnippet(game.cons || "", trimmed);
          title = "Contras / Pontos a Melhorar";
        } else {
          snippet = getContextSnippet(game.replayNote || "", trimmed);
          title = "Anotação de Replay";
        }

        matches.push({
          id: `notes_${game.id}`,
          type: "notes",
          gameId: game.id,
          gameName: game.name,
          gameCover: game.cover,
          gamePlatform: game.platform || "Indefinida",
          matchTitle: title,
          matchSnippet: snippet,
        });
      }
    });

    return matches;
  }, [games, query]);

  // Filtered results based on active tab
  const filteredResults = useMemo(() => {
    if (activeTab === "all") return results;
    return results.filter((r) => r.type === activeTab);
  }, [results, activeTab]);

  // Counts per tab
  const tabCounts = useMemo(() => {
    return {
      all: results.length,
      game: results.filter((r) => r.type === "game").length,
      diary: results.filter((r) => r.type === "diary").length,
      dictionary: results.filter((r) => r.type === "dictionary").length,
      notes: results.filter((r) => r.type === "notes").length,
    };
  }, [results]);

  // Reset selectedIndex when results or tab changes
  useEffect(() => {
    setSelectedIndex(0);
  }, [filteredResults.length, activeTab]);

  // Keyboard navigation inside modal
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Escape") {
      onClose();
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      setSelectedIndex((prev) => (prev + 1) % Math.max(1, filteredResults.length));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSelectedIndex((prev) => (prev - 1 + filteredResults.length) % Math.max(1, filteredResults.length));
    } else if (e.key === "Enter" && filteredResults[selectedIndex]) {
      e.preventDefault();
      handleSelect(filteredResults[selectedIndex]);
    }
  };

  const handleSelect = (item: GlobalSearchResult) => {
    if (item.type === "diary") {
      onSelectResult(item.gameId, { diaryId: item.diaryId });
    } else if (item.type === "dictionary") {
      onSelectResult(item.gameId, { openDictionary: true });
    } else {
      onSelectResult(item.gameId);
    }
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-[100] bg-black/80 backdrop-blur-md flex items-start justify-center pt-10 sm:pt-20 px-3 sm:px-4 animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div
        className="w-full max-w-3xl bg-[#090b12] border border-zinc-800/90 rounded-3xl shadow-2xl shadow-cyan-950/20 overflow-hidden flex flex-col max-h-[85vh] sm:max-h-[80vh]"
        onClick={(e) => e.stopPropagation()}
        onKeyDown={handleKeyDown}
      >
        {/* Search Header Input */}
        <div className="p-4 sm:p-5 border-b border-zinc-800/80 flex items-center gap-3 bg-zinc-950/80">
          <Search size={22} className="text-cyan-400 shrink-0" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Busca Global: digite títulos, diários, palavras do dicionário, notas..."
            className="w-full bg-transparent text-sm sm:text-base text-zinc-100 placeholder-zinc-500 font-medium outline-none"
          />
          {query ? (
            <button
              onClick={() => setQuery("")}
              className="p-1 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors cursor-pointer"
            >
              <X size={18} />
            </button>
          ) : (
            <kbd className="hidden sm:inline-flex items-center gap-1 text-[10px] font-mono font-semibold text-zinc-400 bg-zinc-900 border border-zinc-800 px-2 py-1 rounded-md shrink-0">
              ESC para fechar
            </kbd>
          )}
        </div>

        {/* Category Filter Pills */}
        <div className="px-4 py-2.5 bg-zinc-950/40 border-b border-zinc-800/50 flex items-center gap-1.5 overflow-x-auto no-scrollbar">
          <button
            onClick={() => setActiveTab("all")}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer shrink-0 ${
              activeTab === "all"
                ? "bg-cyan-500/20 border border-cyan-500/50 text-cyan-300 shadow-sm"
                : "bg-zinc-900/60 border border-zinc-800 text-zinc-400 hover:text-white"
            }`}
          >
            <span>Todos</span>
            <span className="px-1.5 py-0.2 rounded-full bg-zinc-800 text-[10px] font-mono">{tabCounts.all}</span>
          </button>

          <button
            onClick={() => setActiveTab("game")}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer shrink-0 ${
              activeTab === "game"
                ? "bg-cyan-500/20 border border-cyan-500/50 text-cyan-300 shadow-sm"
                : "bg-zinc-900/60 border border-zinc-800 text-zinc-400 hover:text-white"
            }`}
          >
            <Gamepad2 size={13} className="text-cyan-400" />
            <span>Jogos</span>
            <span className="px-1.5 py-0.2 rounded-full bg-zinc-800 text-[10px] font-mono">{tabCounts.game}</span>
          </button>

          <button
            onClick={() => setActiveTab("diary")}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer shrink-0 ${
              activeTab === "diary"
                ? "bg-purple-500/20 border border-purple-500/50 text-purple-300 shadow-sm"
                : "bg-zinc-900/60 border border-zinc-800 text-zinc-400 hover:text-white"
            }`}
          >
            <FileText size={13} className="text-purple-400" />
            <span>Diário</span>
            <span className="px-1.5 py-0.2 rounded-full bg-zinc-800 text-[10px] font-mono">{tabCounts.diary}</span>
          </button>

          <button
            onClick={() => setActiveTab("dictionary")}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer shrink-0 ${
              activeTab === "dictionary"
                ? "bg-pink-500/20 border border-pink-500/50 text-pink-300 shadow-sm"
                : "bg-zinc-900/60 border border-zinc-800 text-zinc-400 hover:text-white"
            }`}
          >
            <BookOpen size={13} className="text-pink-400" />
            <span>Dicionário</span>
            <span className="px-1.5 py-0.2 rounded-full bg-zinc-800 text-[10px] font-mono">{tabCounts.dictionary}</span>
          </button>

          <button
            onClick={() => setActiveTab("notes")}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer shrink-0 ${
              activeTab === "notes"
                ? "bg-amber-500/20 border border-amber-500/50 text-amber-300 shadow-sm"
                : "bg-zinc-900/60 border border-zinc-800 text-zinc-400 hover:text-white"
            }`}
          >
            <Lightbulb size={13} className="text-amber-400" />
            <span>Anotações</span>
            <span className="px-1.5 py-0.2 rounded-full bg-zinc-800 text-[10px] font-mono">{tabCounts.notes}</span>
          </button>
        </div>

        {/* Results List */}
        <div ref={listRef} className="flex-1 overflow-y-auto p-3 sm:p-4 space-y-2.5">
          {!query.trim() ? (
            <div className="py-12 text-center text-zinc-500 space-y-3">
              <Sparkles size={32} className="mx-auto text-cyan-400/40 animate-pulse" />
              <p className="text-sm font-semibold text-zinc-400">Busca Inteligente Integrada</p>
              <p className="text-xs max-w-md mx-auto text-zinc-500 leading-relaxed">
                Digite qualquer palavra, nome de chefe, local, data ou termo cadastrado no dicionário para encontrar instantaneamente o jogo e a entrada no diário!
              </p>
            </div>
          ) : filteredResults.length === 0 ? (
            <div className="py-12 text-center text-zinc-500 space-y-2">
              <p className="text-3xl">🔍</p>
              <p className="text-sm font-bold text-zinc-300">Nenhum resultado encontrado para "{query}"</p>
              <p className="text-xs text-zinc-500">Tente buscar por termos mais genéricos ou trocar de categoria.</p>
            </div>
          ) : (
            filteredResults.map((item, idx) => {
              const isSelected = idx === selectedIndex;

              return (
                <div
                  key={item.id}
                  onClick={() => handleSelect(item)}
                  className={`p-3 rounded-2xl border transition-all cursor-pointer flex items-center gap-3.5 group ${
                    isSelected
                      ? "bg-zinc-850 border-cyan-500/60 shadow-lg shadow-cyan-950/30 ring-1 ring-cyan-500/40"
                      : "bg-zinc-950/60 border-zinc-850 hover:bg-zinc-900/80 hover:border-zinc-750"
                  }`}
                >
                  {/* Game Cover Thumbnail */}
                  <div className="relative w-12 h-14 sm:w-14 sm:h-16 rounded-xl overflow-hidden bg-zinc-900 border border-zinc-800 shrink-0 shadow-md">
                    {item.gameCover ? (
                      <img
                        src={item.gameCover}
                        alt={item.gameName}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                        loading="lazy"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-zinc-700">
                        <Gamepad2 size={20} />
                      </div>
                    )}
                  </div>

                  {/* Result Details */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      <span className="text-xs font-bold text-white truncate">{item.gameName}</span>
                      <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-zinc-900 border border-zinc-800 text-zinc-400">
                        {item.gamePlatform}
                      </span>

                      {/* Badge Type */}
                      {item.type === "diary" && (
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-purple-950/80 border border-purple-500/30 text-purple-300 flex items-center gap-1">
                          <FileText size={10} /> Diário
                        </span>
                      )}
                      {item.type === "dictionary" && (
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-pink-950/80 border border-pink-500/30 text-pink-300 flex items-center gap-1">
                          <BookOpen size={10} /> Dicionário
                        </span>
                      )}
                      {item.type === "notes" && (
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-950/80 border border-amber-500/30 text-amber-300 flex items-center gap-1">
                          <Lightbulb size={10} /> Anotação
                        </span>
                      )}
                    </div>

                    {/* Result Match Title & Snippet */}
                    <div className="space-y-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        {item.type === "dictionary" ? (
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span
                              style={{
                                color: item.formatTextColor || "#22d3ee",
                                backgroundColor: item.formatBgColor || undefined,
                              }}
                              className="text-xs px-2 py-0.5 rounded border border-zinc-800 font-bold"
                            >
                              {item.matchTitle}
                            </span>
                            {Array.isArray(item.variants) && item.variants.length > 0 && (
                              <span className="text-[10px] text-cyan-300 font-mono">
                                +{item.variants.length} variante(s): {item.variants.join(", ")}
                              </span>
                            )}
                          </div>
                        ) : (
                          <p className="text-xs font-semibold text-cyan-300 truncate">{item.matchTitle}</p>
                        )}
                      </div>

                      {item.matchSnippet && (
                        <p className="text-xs text-zinc-400 line-clamp-2 leading-relaxed italic">
                          "{item.matchSnippet}"
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Action Icon */}
                  <div className="shrink-0 text-zinc-500 group-hover:text-cyan-400 transition-colors">
                    <ArrowRight size={16} />
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Footer Info */}
        <div className="p-3 bg-zinc-950/90 border-t border-zinc-800/80 text-[11px] text-zinc-500 flex items-center justify-between gap-2 flex-wrap">
          <div className="flex items-center gap-2">
            <span>Use <kbd className="px-1.5 py-0.5 bg-zinc-900 border border-zinc-800 rounded text-zinc-300">↑</kbd> <kbd className="px-1.5 py-0.5 bg-zinc-900 border border-zinc-800 rounded text-zinc-300">↓</kbd> para navegar</span>
            <span>•</span>
            <span><kbd className="px-1.5 py-0.5 bg-zinc-900 border border-zinc-800 rounded text-zinc-300">Enter</kbd> para abrir</span>
          </div>
          <div className="text-cyan-400 font-bold flex items-center gap-1">
            <span>Total: {filteredResults.length} item(ns)</span>
          </div>
        </div>
      </div>
    </div>
  );
}
