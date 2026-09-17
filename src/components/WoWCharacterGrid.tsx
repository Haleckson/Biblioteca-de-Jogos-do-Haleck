import React, { useState, useMemo } from "react";
import {
  Shield,
  Sparkles,
  Search,
  CheckCircle2,
  ExternalLink,
  Layers,
  ChevronDown,
  ChevronUp,
  ArrowDownAZ,
  LayoutGrid,
  List,
  Check,
  User,
  X,
} from "lucide-react";
import { BlizzardCharacterSummary } from "../types";
import {
  getWoWClassInfo,
  getWoWRaceInfo,
  getWoWFactionInfo,
  getWoWVersionInfo,
} from "../utils/blizzardIcons";

export interface WoWCharacterGridProps {
  characters?: BlizzardCharacterSummary[];
  activeCharacterName?: string;
  onSelectCharacter?: (char: BlizzardCharacterSummary) => void;
  isLoading?: boolean;
  filterVersion?: string;
  onFilterVersionChange?: (version: string) => void;
  showVersionTabs?: boolean;
  className?: string;
}

export const WoWCharacterGrid: React.FC<WoWCharacterGridProps> = ({
  characters = [],
  activeCharacterName,
  onSelectCharacter,
  isLoading = false,
  filterVersion = "all",
  onFilterVersionChange,
  showVersionTabs = true,
  className = "",
}) => {
  const [searchQuery, setSearchQuery] = useState("");
  const [internalVersion, setInternalVersion] = useState<string>(filterVersion);
  // Default view is the Alphabetical List (collapsed by default, click to open and show list A-Z)
  const [isListOpen, setIsListOpen] = useState(false);
  const [viewMode, setViewMode] = useState<"list_az" | "grid">("list_az");

  const currentVersion = onFilterVersionChange ? filterVersion : internalVersion;
  const handleVersionChange = (ver: string) => {
    if (onFilterVersionChange) {
      onFilterVersionChange(ver);
    } else {
      setInternalVersion(ver);
    }
  };

  // 1. Filtered & strictly sorted in ALPHABETICAL ORDER (A-Z)
  const alphabeticalCharacters = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    const filtered = characters.filter((c) => {
      if (currentVersion !== "all") {
        const raw = (c.wow_version || c.gameMode || "retail").toLowerCase();
        let key = "retail";
        if (raw.includes("classic") || raw === "era") key = "classic";
        else if (raw.includes("forever") || raw.includes("vanilla+")) key = "forever";
        else if (raw.includes("tbc") || raw.includes("crusade")) key = "tbc";
        else key = "retail";

        if (key !== currentVersion) return false;
      }

      if (!query) return true;
      const matchName = c.name.toLowerCase().includes(query);
      const matchRealm = (c.realm || "").toLowerCase().includes(query);
      const matchClass = (c.characterClass || "").toLowerCase().includes(query);
      const matchRace = (c.race || "").toLowerCase().includes(query);
      return matchName || matchRealm || matchClass || matchRace;
    });

    // Sort strictly in alphabetical order by name
    return [...filtered].sort((a, b) =>
      a.name.localeCompare(b.name, "pt-BR", { sensitivity: "base" })
    );
  }, [characters, searchQuery, currentVersion]);

  // Group characters by wow_version for grid mode fallback
  const groupedCharacters = useMemo(() => {
    const groups: Record<string, BlizzardCharacterSummary[]> = {
      retail: [],
      classic: [],
      forever: [],
      tbc: [],
    };

    alphabeticalCharacters.forEach((char) => {
      const raw = (char.wow_version || char.gameMode || "retail").toLowerCase();
      let key = "retail";
      if (raw.includes("classic") || raw === "era") key = "classic";
      else if (raw.includes("forever") || raw.includes("vanilla+")) key = "forever";
      else if (raw.includes("tbc") || raw.includes("crusade")) key = "tbc";
      else key = "retail";

      if (!groups[key]) groups[key] = [];
      groups[key].push(char);
    });

    return groups;
  }, [alphabeticalCharacters]);

  // Find currently active character object
  const activeChar = useMemo(() => {
    if (!characters || characters.length === 0) return null;
    if (activeCharacterName) {
      const found = characters.find(
        (c) => c.name.toLowerCase() === activeCharacterName.toLowerCase()
      );
      if (found) return found;
    }
    return characters[0];
  }, [characters, activeCharacterName]);

  const totalCount = characters.length;

  if (isLoading) {
    return (
      <div id="wow-grid-loading" className="py-10 flex flex-col items-center justify-center text-center space-y-3">
        <div className="w-8 h-8 border-2 border-cyan-500 border-t-transparent rounded-full animate-spin" />
        <p className="text-xs font-medium text-zinc-300">Carregando personagens da Blizzard...</p>
        <p className="text-[11px] text-zinc-500">Organizando catálogo e histórico da conta</p>
      </div>
    );
  }

  if (characters.length === 0) {
    return (
      <div className="p-6 text-center bg-zinc-950/40 rounded-xl border border-dashed border-zinc-800 space-y-2">
        <Shield size={24} className="text-zinc-500 mx-auto" />
        <p className="text-xs font-medium text-zinc-400">Nenhum personagem de World of Warcraft carregado ainda.</p>
        <p className="text-[11px] text-zinc-500">Clique em "Atualizar Battle.net" para carregar seus heróis.</p>
      </div>
    );
  }

  return (
    <div id="wow-character-selector-container" className={`space-y-3 ${className}`}>
      {/* SELETOR INTERATIVO: Clique para abrir a lista em ordem alfabética */}
      <div className="bg-zinc-900/90 rounded-2xl p-3 border border-cyan-500/30 shadow-sm space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
          {/* Active Character Chip / Status */}
          <div className="flex items-center gap-2.5 min-w-0">
            {activeChar ? (
              (() => {
                const cClass = getWoWClassInfo(activeChar.characterClass);
                const cRace = getWoWRaceInfo(activeChar.race, activeChar.gender);
                const cFact = getWoWFactionInfo(activeChar.faction);
                const vMeta = getWoWVersionInfo(activeChar.wow_version || "retail");

                return (
                  <div className="flex items-center gap-2 min-w-0">
                    <div
                      className="relative w-8 h-8 rounded-lg p-0.5 border flex-shrink-0 shadow"
                      style={{ borderColor: cClass.color }}
                    >
                      <img
                        src={activeChar.classIconUrl || cClass.iconUrl}
                        alt={cClass.ptBR}
                        className="w-full h-full object-cover rounded"
                      />
                      <div className="absolute -bottom-1 -right-1 w-3.5 h-3.5 rounded-full overflow-hidden border border-black">
                        <img src={cFact.iconUrl} alt={cFact.name} className="w-full h-full object-cover" />
                      </div>
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="text-xs font-bold text-white truncate">{activeChar.name}</span>
                        <span className="text-[10px] font-mono font-bold text-cyan-300 bg-cyan-950/60 px-1.5 py-0.2 rounded border border-cyan-500/30">
                          Nvl {activeChar.level}
                        </span>
                        <span className={`text-[9px] font-mono px-1.5 py-0.2 rounded border ${vMeta.badgeBg} ${vMeta.borderClass} ${vMeta.textClass}`}>
                          {vMeta.shortName}
                        </span>
                      </div>
                      <p className="text-[11px] text-zinc-400 truncate">
                        {cRace.ptBR} • <span style={{ color: cClass.color }}>{cClass.ptBR}</span> • {activeChar.realm}
                      </p>
                    </div>
                  </div>
                );
              })()
            ) : (
              <span className="text-xs text-zinc-400">Nenhum personagem selecionado</span>
            )}
          </div>

          {/* Action Trigger Buttons */}
          <div className="flex items-center gap-2 shrink-0">
            <button
              id="wow-toggle-alphabetical-list-btn"
              type="button"
              onClick={() => {
                setViewMode("list_az");
                setIsListOpen(!isListOpen);
              }}
              className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer border select-none ${
                isListOpen
                  ? "bg-cyan-500 text-zinc-950 border-cyan-400 shadow-md shadow-cyan-500/20"
                  : "bg-cyan-950/60 hover:bg-cyan-900/60 border-cyan-500/40 text-cyan-200"
              }`}
              title="Clique para ver a lista de personagens em ordem alfabética"
            >
              <ArrowDownAZ size={15} />
              <span>Lista de Personagens (A-Z)</span>
              <span className="text-[10px] font-mono opacity-80 px-1.5 py-0.2 rounded bg-black/20">
                {totalCount}
              </span>
              {isListOpen ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
            </button>

            {/* View Mode Toggle Button (A-Z List vs Full Grid) */}
            <button
              type="button"
              onClick={() => {
                const next = viewMode === "list_az" ? "grid" : "list_az";
                setViewMode(next);
                if (next === "grid") setIsListOpen(false);
              }}
              className="p-2 rounded-xl text-zinc-400 hover:text-white bg-zinc-800/80 hover:bg-zinc-700 border border-zinc-700 transition-colors"
              title={viewMode === "list_az" ? "Alternar para visualização em grade" : "Alternar para lista em ordem alfabética"}
            >
              {viewMode === "list_az" ? <LayoutGrid size={15} /> : <List size={15} />}
            </button>
          </div>
        </div>

        {/* 2. LISTA DESDOBRÁVEL EM ORDEM ALFABÉTICA (Abre ao clicar no botão) */}
        {isListOpen && viewMode === "list_az" && (
          <div
            id="wow-alphabetical-dropdown-list"
            className="mt-3 pt-3 border-t border-zinc-800 space-y-3 animate-in fade-in slide-in-from-top-2 duration-200"
          >
            {/* Search and Filters inside Alphabetical List */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
              <div className="relative flex-1">
                <Search className="w-3.5 h-3.5 text-zinc-400 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  id="wow-alphabetical-search-input"
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Pesquisar personagem por nome A-Z, reino ou classe..."
                  className="w-full bg-zinc-950/90 border border-zinc-700/80 rounded-xl pl-8 pr-7 py-1.5 text-xs text-zinc-200 placeholder-zinc-500 focus:outline-none focus:border-cyan-500"
                  autoFocus
                />
                {searchQuery && (
                  <button
                    type="button"
                    onClick={() => setSearchQuery("")}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-white"
                  >
                    <X size={12} />
                  </button>
                )}
              </div>

              {/* Version Filters */}
              {showVersionTabs && (
                <div className="flex items-center gap-1 overflow-x-auto pb-1 sm:pb-0 scrollbar-none text-[11px]">
                  <button
                    type="button"
                    onClick={() => handleVersionChange("all")}
                    className={`px-2.5 py-1 rounded-lg font-bold transition-all whitespace-nowrap ${
                      currentVersion === "all"
                        ? "bg-cyan-500 text-zinc-950"
                        : "bg-zinc-800 text-zinc-400 hover:text-zinc-200"
                    }`}
                  >
                    Todos
                  </button>
                  <button
                    type="button"
                    onClick={() => handleVersionChange("retail")}
                    className={`px-2.5 py-1 rounded-lg font-bold transition-all whitespace-nowrap ${
                      currentVersion === "retail"
                        ? "bg-cyan-500 text-zinc-950"
                        : "bg-zinc-800 text-zinc-400 hover:text-zinc-200"
                    }`}
                  >
                    Retail
                  </button>
                  <button
                    type="button"
                    onClick={() => handleVersionChange("classic")}
                    className={`px-2.5 py-1 rounded-lg font-bold transition-all whitespace-nowrap ${
                      currentVersion === "classic"
                        ? "bg-amber-500 text-zinc-950"
                        : "bg-zinc-800 text-zinc-400 hover:text-zinc-200"
                    }`}
                  >
                    Classic Era
                  </button>
                  <button
                    type="button"
                    onClick={() => handleVersionChange("forever")}
                    className={`px-2.5 py-1 rounded-lg font-bold transition-all whitespace-nowrap ${
                      currentVersion === "forever"
                        ? "bg-emerald-500 text-zinc-950"
                        : "bg-zinc-800 text-zinc-400 hover:text-zinc-200"
                    }`}
                  >
                    Forever
                  </button>
                  <button
                    type="button"
                    onClick={() => handleVersionChange("tbc")}
                    className={`px-2.5 py-1 rounded-lg font-bold transition-all whitespace-nowrap ${
                      currentVersion === "tbc"
                        ? "bg-teal-500 text-zinc-950"
                        : "bg-zinc-800 text-zinc-400 hover:text-zinc-200"
                    }`}
                  >
                    TBC
                  </button>
                </div>
              )}
            </div>

            {/* List Header Note */}
            <div className="flex items-center justify-between text-[11px] text-zinc-400 px-1 font-mono">
              <span className="flex items-center gap-1">
                <ArrowDownAZ size={13} className="text-cyan-400" />
                <span>Ordenados de A a Z ({alphabeticalCharacters.length} exibidos)</span>
              </span>
              <span className="text-zinc-500">Clique para selecionar</span>
            </div>

            {/* Scrollable Alphabetical Character List */}
            <div className="max-h-72 overflow-y-auto pr-1 space-y-1.5 custom-scrollbar divide-y divide-zinc-800/40">
              {alphabeticalCharacters.length === 0 ? (
                <div className="py-6 text-center bg-zinc-950/40 rounded-xl border border-dashed border-zinc-800">
                  <p className="text-xs text-zinc-400">Nenhum personagem encontrado com os filtros aplicados.</p>
                </div>
              ) : (
                alphabeticalCharacters.map((char, index) => {
                  const isSelected = activeCharacterName
                    ? char.name.toLowerCase() === activeCharacterName.toLowerCase()
                    : false;

                  const classInfo = getWoWClassInfo(char.characterClass);
                  const raceInfo = getWoWRaceInfo(char.race, char.gender);
                  const factionInfo = getWoWFactionInfo(char.faction);
                  const versionMeta = getWoWVersionInfo(char.wow_version || "retail");

                  return (
                    <button
                      key={`${char.name}-${char.realm}-${char.wow_version || "retail"}-${index}`}
                      id={`char-list-item-${char.name.toLowerCase()}`}
                      type="button"
                      onClick={() => {
                        onSelectCharacter?.(char);
                        setIsListOpen(false); // fecha a lista ao clicar no personagem
                      }}
                      className={`w-full flex items-center justify-between gap-3 p-2.5 rounded-xl transition-all cursor-pointer text-left border ${
                        isSelected
                          ? "bg-cyan-950/70 border-cyan-400 text-cyan-200 shadow-sm"
                          : "bg-zinc-950/60 hover:bg-zinc-800/80 border-zinc-800/80 hover:border-zinc-700 text-zinc-300"
                      }`}
                    >
                      {/* Left: Avatar, Class Icon, Name, Race, Realm */}
                      <div className="flex items-center gap-2.5 min-w-0">
                        {/* Class Icon */}
                        <div
                          className="relative w-8 h-8 rounded-lg p-0.5 border shrink-0 shadow-sm overflow-hidden"
                          style={{ borderColor: classInfo.color }}
                        >
                          <img
                            src={char.classIconUrl || classInfo.iconUrl}
                            alt={classInfo.ptBR}
                            className="w-full h-full object-cover rounded"
                          />
                        </div>

                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span
                              className="text-xs font-bold truncate leading-none"
                              style={{ color: isSelected ? "#38bdf8" : undefined }}
                            >
                              {char.name}
                            </span>
                            <span className="text-[10px] font-mono text-zinc-400 bg-zinc-900 px-1.5 py-0.2 rounded border border-zinc-800">
                              Nvl {char.level}
                            </span>
                            <span
                              className={`text-[9px] font-mono font-bold px-1.5 py-0.2 rounded border ${versionMeta.badgeBg} ${versionMeta.borderClass} ${versionMeta.textClass}`}
                            >
                              {versionMeta.shortName}
                            </span>
                          </div>

                          <div className="flex items-center gap-1.5 text-[11px] text-zinc-400 truncate mt-0.5">
                            <span style={{ color: classInfo.color }} className="font-semibold">
                              {classInfo.ptBR}
                            </span>
                            <span className="text-zinc-600">•</span>
                            <span className="truncate">{raceInfo.ptBR}</span>
                            <span className="text-zinc-600">•</span>
                            <span className="truncate">{char.realm}</span>
                          </div>
                        </div>
                      </div>

                      {/* Right: Faction, iLvl, Checkmark */}
                      <div className="flex items-center gap-2 shrink-0">
                        <img
                          src={char.factionIconUrl || factionInfo.iconUrl}
                          alt={factionInfo.name}
                          title={factionInfo.name}
                          className="w-4 h-4 rounded-full border border-zinc-700 object-cover"
                        />

                        {char.equippedItemLevel ? (
                          <span className="text-[10px] font-semibold text-amber-300 bg-amber-950/60 border border-amber-500/40 px-1.5 py-0.5 rounded font-mono">
                            iLvl {char.equippedItemLevel}
                          </span>
                        ) : null}

                        {isSelected && (
                          <div className="w-5 h-5 rounded-full bg-cyan-500 text-zinc-950 flex items-center justify-center">
                            <Check size={12} className="stroke-[3]" />
                          </div>
                        )}
                      </div>
                    </button>
                  );
                })
              )}
            </div>
          </div>
        )}
      </div>

      {/* 3. MODO EM GRADE COMPLETA (Caso o usuário clique no botão para expandir grade) */}
      {viewMode === "grid" && (
        <div className="space-y-6 pt-2">
          {["retail", "classic", "forever", "tbc"].map((vKey) => {
            if (currentVersion !== "all" && currentVersion !== vKey) return null;
            const chars = groupedCharacters[vKey] || [];
            if (chars.length === 0) return null;
            const versionMeta = getWoWVersionInfo(vKey);

            return (
              <div
                key={vKey}
                className="space-y-3 bg-zinc-900/40 rounded-xl p-4 border border-zinc-800/60"
              >
                <div className="flex items-center justify-between flex-wrap gap-2 pb-2 border-b border-zinc-800/80">
                  <div className="flex items-center gap-2">
                    <img
                      src={versionMeta.icon}
                      alt={versionMeta.name}
                      className="w-6 h-6 rounded-lg border border-zinc-700 object-cover"
                    />
                    <h4 className="text-sm font-bold text-zinc-100">{versionMeta.name}</h4>
                    <span className={`text-[10px] font-mono px-2 py-0.5 rounded border ${versionMeta.badgeBg} ${versionMeta.borderClass} ${versionMeta.textClass}`}>
                      Cap Nvl {versionMeta.levelCap}
                    </span>
                  </div>
                  <span className="text-xs text-zinc-400 font-mono">
                    {chars.length} {chars.length === 1 ? "personagem" : "personagens"}
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  {chars.map((char) => {
                    const isSelected = activeCharacterName
                      ? char.name.toLowerCase() === activeCharacterName.toLowerCase()
                      : false;
                    const classInfo = getWoWClassInfo(char.characterClass);
                    const raceInfo = getWoWRaceInfo(char.race, char.gender);
                    const factionInfo = getWoWFactionInfo(char.faction);

                    return (
                      <div
                        key={`${char.name}-${char.realm}`}
                        onClick={() => onSelectCharacter?.(char)}
                        className={`group relative rounded-xl p-3 border transition-all cursor-pointer select-none ${
                          isSelected
                            ? "bg-zinc-800/90 border-cyan-400 shadow-lg shadow-cyan-500/10 ring-1 ring-cyan-400"
                            : "bg-zinc-900/70 hover:bg-zinc-850 border-zinc-800 hover:border-zinc-700"
                        }`}
                      >
                        {isSelected && (
                          <div className="absolute top-2.5 right-2.5 flex items-center gap-1 text-[10px] font-semibold text-cyan-400 bg-cyan-950/80 border border-cyan-500/40 px-2 py-0.5 rounded-full">
                            <CheckCircle2 className="w-3 h-3" />
                            <span>Ativo</span>
                          </div>
                        )}

                        <div className="flex items-start gap-2.5">
                          <div
                            className="relative flex-shrink-0 w-10 h-10 rounded-lg p-0.5 border-2 overflow-hidden shadow-md"
                            style={{ borderColor: classInfo.color }}
                          >
                            <img
                              src={char.classIconUrl || classInfo.iconUrl}
                              alt={classInfo.ptBR}
                              className="w-full h-full object-cover rounded"
                            />
                            <div className="absolute bottom-0 inset-x-0 bg-black/70 text-[9px] font-bold text-center text-white py-0.2">
                              {char.level}
                            </div>
                          </div>

                          <div className="flex-1 min-w-0 pr-10">
                            <h5
                              className="text-xs font-bold truncate leading-tight group-hover:text-cyan-300"
                              style={{ color: isSelected ? "#38bdf8" : undefined }}
                            >
                              {char.name}
                            </h5>
                            <p className="text-[11px] text-zinc-400 truncate mt-0.5">{char.realm}</p>
                            <div className="flex items-center gap-1.5 mt-1 text-[11px]">
                              <span style={{ color: classInfo.color }} className="font-semibold">
                                {classInfo.ptBR}
                              </span>
                              <span className="text-zinc-600">•</span>
                              <span className="text-zinc-300 truncate">{raceInfo.ptBR}</span>
                            </div>
                          </div>
                        </div>

                        <div className="mt-2.5 pt-2 border-t border-zinc-800/80 flex items-center justify-between text-xs">
                          <div className="flex items-center gap-1.5">
                            <img
                              src={char.raceIconUrl || raceInfo.iconUrl}
                              alt={raceInfo.name}
                              className="w-4 h-4 rounded-full border border-zinc-700 object-cover"
                            />
                            <img
                              src={char.factionIconUrl || factionInfo.iconUrl}
                              alt={factionInfo.name}
                              className="w-4 h-4 rounded-full border border-zinc-700 object-cover"
                            />
                            {char.activeSpec && (
                              <span className="text-[10px] px-1.5 py-0.2 rounded bg-zinc-800 text-zinc-300 border border-zinc-700/60 truncate max-w-[80px]">
                                {char.activeSpec}
                              </span>
                            )}
                          </div>
                          {char.equippedItemLevel && (
                            <span className="text-[10px] font-semibold text-amber-300 bg-amber-950/60 border border-amber-500/40 px-1.5 py-0.5 rounded">
                              iLvl {char.equippedItemLevel}
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default WoWCharacterGrid;
