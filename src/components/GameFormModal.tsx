/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from "react";
import { Game, TrophyItem, getDlcMode, getGameTrophyItems, getGameHighestTrophy, parseProConTopic, splitEntities, parseContextNote } from "../types";
import { motion, AnimatePresence } from "motion/react";
import { X, Plus, Image as ImageIcon, Upload, Globe, Smile, Check, CheckCircle, Tag, Loader2, Search, Clock, RefreshCw, RotateCcw, Sparkles, Trophy, Layers, ThumbsUp, ThumbsDown, Infinity as InfinityIcon, Gamepad2, Calendar, Monitor, ChevronDown, ChevronRight, DollarSign, Eye, CheckSquare, Square, PackagePlus, ArrowRight, SlidersHorizontal, BookOpen, AlertCircle, Star, Edit3, Maximize2, Shield, Copy, ExternalLink, Key } from "lucide-react";
import ProsConsModal from "./ProsConsModal";
import { detectProConCategory } from "../utils/proConCategories";
import { COVER_BANK } from "../data";
import { uploadToImgBB } from "../utils/imgbb";
import { formatHltbTime } from "../utils/hltbFormatter";
import { formatHoursAndMinutes, parsePlaytimeHours } from "../utils/playtime";
import { useBodyScrollLock } from "../lib/bodyScrollLock";
import { getPlatformBadgeStyle } from "./GameCard";
import {
  fetchSteamOwnedGames,
  fetchSteamAchievements,
  formatSteamPlaytime,
  getSteamHeaderImageUrl,
  isPcPlatform,
  SteamOwnedGame,
  SteamAchievementsResult,
} from "../utils/steamApi";
import {
  fetchGogOwnedGames,
  fetchGogAchievements,
  formatGogPlaytime,
  resolveGogGame,
  GogOwnedGame,
  GogAchievementsResult,
} from "../utils/gogApi";
import {
  searchIgdbGames,
  fetchIgdbGameDetails
} from "../utils/igdbApi";
import {
  searchSteamGridGames,
  fetchSteamGridMedia,
  fetchSteamGridIcons,
  getStoredSteamGridApiKey
} from "../utils/steamGridDbApi";
import {
  BLIZZARD_OFFICIAL_GAMES,
  getStoredBlizzardBattleTag,
  setStoredBlizzardBattleTag,
  getStoredBlizzardOAuthToken,
  getStoredBlizzardRegion,
  setStoredBlizzardRegion,
  isBlizzardAuthenticated,
  clearBlizzardOAuthSession,
  getBlizzardAuthUrl,
  exchangeBlizzardCode,
  fetchBlizzardWoWCharacters,
  fetchBlizzardCharacterProfile,
  getStoredBlizzardRedirectUri,
  setStoredBlizzardRedirectUri,
  getEffectiveBlizzardRedirectUri,
  verifyAndSaveManualToken,
  registerBlizzardReauthListener,
} from "../utils/blizzardApi";
import {
  IgdbGameCandidate,
  SteamGridGameCandidate,
  SteamGridMediaItem,
  SteamGridAssetType,
  BlizzardCharacterSummary,
  BlizzardProfileData,
  BlizzardOfficialGame
} from "../types";

interface GameFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  game: Game | null;
  onSave: (gameData: Omit<Game, "id" | "diary"> & { id?: string; diary?: any[] }) => void;
  onBulkSaveGames?: (games: Array<Omit<Game, "id" | "diary"> & { id?: string; diary?: any[] }>) => void;
  globalTags: string[];
  globalGenres: string[];
  onAddGlobalTag: (tag: string) => void;
  onAddGlobalGenre: (genre: string) => void;
  onDeleteGlobalTag?: (tag: string) => void;
  onDeleteGlobalGenre?: (genre: string) => void;
  onEditGlobalTag?: (oldTag: string, newTag: string) => void;
  onEditGlobalGenre?: (oldGenre: string, newGenre: string) => void;
  triggerAlert: (title: string, msg: string) => void;
}

export default function GameFormModal({
  isOpen,
  onClose,
  game,
  onSave,
  onBulkSaveGames,
  globalTags,
  globalGenres,
  onAddGlobalTag,
  onAddGlobalGenre,
  onDeleteGlobalTag,
  onDeleteGlobalGenre,
  onEditGlobalTag,
  onEditGlobalGenre,
  triggerAlert
}: GameFormModalProps) {
  useBodyScrollLock(isOpen);

  // Form fields state
  const [name, setName] = useState("");
  const [series, setSeries] = useState("");
  const [publisher, setPublisher] = useState("");
  const [studio, setStudio] = useState("");
  const [pricePaid, setPricePaid] = useState<string>("");
  const [playtime, setPlaytime] = useState("");
  const [additionalPlaytime, setAdditionalPlaytime] = useState("");
  const [trophy, setTrophy] = useState<"none" | "bronze" | "silver" | "gold" | "platinum">("none");
  const [selectedTrophyItems, setSelectedTrophyItems] = useState<TrophyItem[]>([]);

  const addTrophy = (type: "bronze" | "silver" | "gold" | "platinum") => {
    setSelectedTrophyItems((prev) => [...prev, { type, note: "" }]);
  };

  const removeTrophy = (type: "bronze" | "silver" | "gold" | "platinum") => {
    setSelectedTrophyItems((prev) => {
      const idx = prev.map((t) => t.type).lastIndexOf(type);
      if (idx === -1) return prev;
      const next = [...prev];
      next.splice(idx, 1);
      return next;
    });
  };

  const updateTrophyNote = (index: number, note: string) => {
    setSelectedTrophyItems((prev) => {
      const next = [...prev];
      if (next[index]) {
        next[index] = { ...next[index], note };
      }
      return next;
    });
  };

  const removeTrophyIndex = (index: number) => {
    setSelectedTrophyItems((prev) => prev.filter((_, i) => i !== index));
  };

  const bronzeCount = selectedTrophyItems.filter((t) => t.type === "bronze").length;
  const silverCount = selectedTrophyItems.filter((t) => t.type === "silver").length;
  const goldCount = selectedTrophyItems.filter((t) => t.type === "gold").length;
  const platinumCount = selectedTrophyItems.filter((t) => t.type === "platinum").length;
  const [pros, setPros] = useState("");
  const [cons, setCons] = useState("");
  const [showProsConsModal, setShowProsConsModal] = useState(false);
  const [replayed, setReplayed] = useState(false);
  const [replayCount, setReplayCount] = useState<number>(0);
  const [replayNote, setReplayNote] = useState("");
  const [isGaaS, setIsGaaS] = useState(false);
  const [dlcMode, setDlcMode] = useState<"none" | "dlc" | "plus_dlc">("none");
  const [dlcNames, setDlcNames] = useState("");
  const [platform, setPlatform] = useState("");
  const [availablePlatforms, setAvailablePlatforms] = useState<string[]>([]);
  const [showNewAvailablePlatform, setShowNewAvailablePlatform] = useState(false);
  const [newAvailablePlatformVal, setNewAvailablePlatformVal] = useState("");
  const [difficulty, setDifficulty] = useState("");
  const [rating, setRating] = useState(0);
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [releaseDate, setReleaseDate] = useState("");
  const [coverUrl, setCoverUrl] = useState("");

  const toggleAvailablePlatform = (plat: string) => {
    setAvailablePlatforms((prev) =>
      prev.includes(plat) ? prev.filter((p) => p !== plat) : [...prev, plat]
    );
  };

  const addCustomAvailablePlatform = () => {
    const trimmed = newAvailablePlatformVal.trim();
    if (!trimmed) return;
    if (!availablePlatforms.includes(trimmed)) {
      setAvailablePlatforms((prev) => [...prev, trimmed]);
    }
    setNewAvailablePlatformVal("");
    setShowNewAvailablePlatform(false);
  };

  const [activeIconTab, setActiveIconTab] = useState<"emoji" | "upload" | "url" | "steamgriddb">("emoji");
  const [iconEmoji, setIconEmoji] = useState("🎮");
  const [tempUploadedIcon, setTempUploadedIcon] = useState("");
  const [iconUrl, setIconUrl] = useState("");

  const [selectedStatus, setSelectedStatus] = useState<string[]>([]);
  const [selectedGenres, setSelectedGenres] = useState<string[]>([]);
  const [selectedTags, setSelectedTags] = useState<string[]>([]);

  // Toggle custom creation inputs
  const [showNewGenre, setShowNewGenre] = useState(false);
  const [newGenreVal, setNewGenreVal] = useState("");
  const [showNewTag, setShowNewTag] = useState(false);
  const [newTagVal, setNewTagVal] = useState("");

  const [editingGenre, setEditingGenre] = useState<string | null>(null);
  const [editingGenreValue, setEditingGenreValue] = useState("");
  const [editingTag, setEditingTag] = useState<string | null>(null);
  const [editingTagValue, setEditingTagValue] = useState("");

  // ImgBB Uploaded Image covers/icons
  const [tempUploadedCover, setTempUploadedCover] = useState("");
  const [isUploadingCover, setIsUploadingCover] = useState(false);
  const [isUploadingIcon, setIsUploadingIcon] = useState(false);
  const [isDragOverIcon, setIsDragOverIcon] = useState(false);
  const [isDragOverCover, setIsDragOverCover] = useState(false);

  // HowLongToBeat States
  const [hltbMain, setHltbMain] = useState("");
  const [hltbExtra, setHltbExtra] = useState("");
  const [hltbCompletionist, setHltbCompletionist] = useState("");
  const [hltbId, setHltbId] = useState("");

  const [isFetchingHltb, setIsFetchingHltb] = useState(false);
  const [hltbUrlInput, setHltbUrlInput] = useState("");
  const [showHltbImport, setShowHltbImport] = useState(false);

  // Metacritic States
  const [metacriticUrl, setMetacriticUrl] = useState("");
  const [metacriticCritScore, setMetacriticCritScore] = useState<number | undefined>(undefined);
  const [metacriticUserScore, setMetacriticUserScore] = useState<number | undefined>(undefined);

  // Replay Prompt Modal States
  const [showReplayPromptModal, setShowReplayPromptModal] = useState(false);
  const [pendingReplayPreviousStatus, setPendingReplayPreviousStatus] = useState<string[]>([]);
  const [autoArchivePlaytime, setAutoArchivePlaytime] = useState(true);

  const [isFetchingMetacritic, setIsFetchingMetacritic] = useState(false);
  const [metacriticUrlInput, setMetacriticUrlInput] = useState("");
  const [showMetacriticImport, setShowMetacriticImport] = useState(false);
  const [metacriticPlatforms, setMetacriticPlatforms] = useState<{ code: string; name: string }[]>([]);
  const [selectedMetacriticPlatform, setSelectedMetacriticPlatform] = useState<string>("");

  // Integration Platform Switcher
  const [integrationPlatform, setIntegrationPlatform] = useState<"none" | "steam" | "gog" | "battlenet" | "blizzard">("steam");

  // Steam States
  const [steamAppId, setSteamAppId] = useState<number | string | undefined>(undefined);
  const [steamPlaytimeMinutes, setSteamPlaytimeMinutes] = useState<number | undefined>(undefined);
  const [steamLastPlayedTimestamp, setSteamLastPlayedTimestamp] = useState<number | undefined>(undefined);
  const [steamAchievementsCount, setSteamAchievementsCount] = useState<number | undefined>(undefined);
  const [steamAchievementsTotal, setSteamAchievementsTotal] = useState<number | undefined>(undefined);

  // GOG States
  const [gogGameId, setGogGameId] = useState<number | string | undefined>(undefined);
  const [gogPlaytimeMinutes, setGogPlaytimeMinutes] = useState<number | undefined>(undefined);
  const [gogLastPlayedTimestamp, setGogLastPlayedTimestamp] = useState<number | undefined>(undefined);
  const [gogAchievementsCount, setGogAchievementsCount] = useState<number | undefined>(undefined);
  const [gogAchievementsTotal, setGogAchievementsTotal] = useState<number | undefined>(undefined);

  // Battle.net / Blizzard States
  const [blizzardGameId, setBlizzardGameId] = useState<string>("");
  const [blizzardGameName, setBlizzardGameName] = useState<string>("");
  const [blizzardRegion, setBlizzardRegion] = useState<"us" | "eu" | "kr" | "tw">("us");
  const [blizzardSelectedCharacter, setBlizzardSelectedCharacter] = useState<string>("");
  const [blizzardCharacters, setBlizzardCharacters] = useState<BlizzardCharacterSummary[]>([]);
  const [blizzardProfileData, setBlizzardProfileData] = useState<BlizzardProfileData | null>(null);
  const [isBlizzardLoggedIn, setIsBlizzardLoggedIn] = useState<boolean>(false);
  const [blizzardBattleTag, setBlizzardBattleTag] = useState<string>("");
  const [isLoadingBlizzardChars, setIsLoadingBlizzardChars] = useState<boolean>(false);
  const [isLoadingBlizzardProfile, setIsLoadingBlizzardProfile] = useState<boolean>(false);
  const [manualBattleTagInput, setManualBattleTagInput] = useState<string>("");
  const [showBlizzardAdvancedConfig, setShowBlizzardAdvancedConfig] = useState<boolean>(false);
  const [customRedirectUriInput, setCustomRedirectUriInput] = useState<string>(() => getStoredBlizzardRedirectUri());
  const [manualTokenInput, setManualTokenInput] = useState<string>("");
  const [manualTokenTagInput, setManualTokenTagInput] = useState<string>("");
  const [copiedRedirectUri, setCopiedRedirectUri] = useState<boolean>(false);
  const [manualRealmInput, setManualRealmInput] = useState<string>("Azralon");
  const [manualCharNameInput, setManualCharNameInput] = useState<string>("");
  const [isSearchingArmory, setIsSearchingArmory] = useState<boolean>(false);
  const [selectedWowVersion, setSelectedWowVersion] = useState<"forever" | "forever_beta" | "classic" | "retail" | "mop" | "tbc">("forever");

  const [showGogImport, setShowGogImport] = useState(false);
  const [isFetchingGog, setIsFetchingGog] = useState(false);
  const [gogUrlInput, setGogUrlInput] = useState("");
  const [gogUserGamesList, setGogUserGamesList] = useState<GogOwnedGame[]>([]);
  const [isLoadingGogGames, setIsLoadingGogGames] = useState(false);
  const [gogAchieveData, setGogAchieveData] = useState<GogAchievementsResult | null>(null);

  const [gameCandidates, setGameCandidates] = useState<any[]>([]);
  const [isSelectingCandidate, setIsSelectingCandidate] = useState(false);
  const [igdbSearchQuery, setIgdbSearchQuery] = useState("");
  const [hasSearchedIgdb, setHasSearchedIgdb] = useState(false);
  const [selectedBulkCandidateIds, setSelectedBulkCandidateIds] = useState<number[]>([]);
  const [isBulkImporting, setIsBulkImporting] = useState(false);

  // IGDB Preview Comparison State
  const [showMetadataPreviewModal, setShowMetadataPreviewModal] = useState(false);
  const [previewCandidateData, setPreviewCandidateData] = useState<any | null>(null);
  const [selectedPreviewFields, setSelectedPreviewFields] = useState<Record<string, boolean>>({
    title: true,
    cover: true,
    developer: true,
    publisher: true,
    series: true,
    releaseDate: true,
    platforms: true,
    genres: true,
    metacritic: true,
    igdbRating: true,
    hltb: true,
    synopsis: true,
  });

  // IGDB States
  const [isFetchingIgdb, setIsFetchingIgdb] = useState(false);
  const [igdbId, setIgdbId] = useState<number | undefined>(game?.igdbId);
  const [igdbRating, setIgdbRating] = useState<number | undefined>(game?.igdbRating);
  const [igdbSlug, setIgdbSlug] = useState<string | undefined>(game?.igdbSlug);

  // SteamGridDB Media Gallery States
  const [showSteamGridModal, setShowSteamGridModal] = useState(false);
  const [steamGridMediaList, setSteamGridMediaList] = useState<SteamGridMediaItem[]>([]);
  const [isLoadingSteamGridMedia, setIsLoadingSteamGridMedia] = useState(false);
  const [activeSteamGridFilter, setActiveSteamGridFilter] = useState<"all" | "grid" | "hero" | "logo" | "icon">("all");
  const [steamGridGridOrientation, setSteamGridGridOrientation] = useState<"all" | "vertical" | "horizontal">("all");
  const [steamGridSearchTerm, setSteamGridSearchTerm] = useState("");
  const [steamGridCandidates, setSteamGridCandidates] = useState<SteamGridGameCandidate[]>([]);
  const [selectedSteamGridGame, setSelectedSteamGridGame] = useState<{ id: number; name: string } | null>(null);
  const [previewMediaItem, setPreviewMediaItem] = useState<SteamGridMediaItem | null>(null);
  const [steamGridTargetMode, setSteamGridTargetMode] = useState<"cover" | "icon">("cover");

  // Inline SteamGridDB Quick Icons (for Profile Icon Block)
  const [quickSteamGridIcons, setQuickSteamGridIcons] = useState<SteamGridMediaItem[]>([]);
  const [isLoadingQuickIcons, setIsLoadingQuickIcons] = useState(false);
  const [quickIconsSearchTerm, setQuickIconsSearchTerm] = useState("");

  // Estado dos blocos colapsáveis (todos iniciam colapsados por padrão)
  const [openBlocks, setOpenBlocks] = useState<Record<string, boolean>>({});
  const [activeBlock, setActiveBlock] = useState<string>("basic");
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const chipsBarRef = useRef<HTMLDivElement>(null);
  const isProgrammaticScrollRef = useRef(false);
  const scrollTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const handleScrollModal = () => {
    if (isProgrammaticScrollRef.current || !scrollContainerRef.current) return;
    const containerTop = scrollContainerRef.current.getBoundingClientRect().top;
    const targetLine = containerTop + 130;

    const blocks = [
      "basic",
      "status",
      "platform",
      "playtime",
      "dates",
      "trophies",
      "replay",
      "icon",
      "cover",
      "proscons",
      "genres",
      "tags",
      "hltb",
      "metacritic",
      "steam",
    ];

    let bestBlock: string | null = null;
    let minDistance = Infinity;

    for (const key of blocks) {
      const el = document.getElementById(`block-${key}`);
      if (!el) continue;

      const rect = el.getBoundingClientRect();
      const isOpen = !!openBlocks[key];

      // If the block encompasses the reading line
      if (rect.top <= targetLine && rect.bottom >= targetLine - 30) {
        if (isOpen) {
          bestBlock = key;
          minDistance = 0;
          break;
        } else {
          const dist = Math.abs(rect.top - targetLine);
          if (dist < minDistance) {
            minDistance = dist;
            bestBlock = key;
          }
        }
      } else {
        let dist = Math.abs(rect.top - targetLine);
        if (isOpen) dist -= 50; // Give priority to open blocks

        if (dist < minDistance) {
          minDistance = dist;
          bestBlock = key;
        }
      }
    }

    if (bestBlock) {
      setActiveBlock(bestBlock);
    }
  };

  useEffect(() => {
    if (!activeBlock || !chipsBarRef.current) return;
    const activeChipEl = chipsBarRef.current.querySelector(`[data-chip-key="${activeBlock}"]`) as HTMLElement;
    if (activeChipEl) {
      activeChipEl.scrollIntoView({ behavior: "smooth", inline: "center", block: "nearest" });
    }
  }, [activeBlock]);

  const toggleBlock = (blockKey: string) => {
    setOpenBlocks((prev) => {
      const willBeOpen = !prev[blockKey];
      if (willBeOpen) {
        setActiveBlock(blockKey);
      }
      return {
        ...prev,
        [blockKey]: willBeOpen,
      };
    });
  };

  const getCategoryBorderClass = (category: string, isOpen: boolean) => {
    switch (category) {
      case "steam":
        return isOpen
          ? "border-2 border-blue-500/80 shadow-md shadow-blue-500/10"
          : "border-2 border-blue-500/50 hover:border-blue-500/80 shadow-sm shadow-blue-500/5";
      case "metacritic":
        return isOpen
          ? "border-2 border-amber-500/80 shadow-md shadow-amber-500/10"
          : "border-2 border-amber-500/50 hover:border-amber-500/80 shadow-sm shadow-amber-500/5";
      case "hltb":
        return isOpen
          ? "border-2 border-purple-500/80 shadow-md shadow-purple-500/10"
          : "border-2 border-purple-500/50 hover:border-purple-500/80 shadow-sm shadow-purple-500/5";
      case "basic":
        return isOpen
          ? "border-2 border-cyan-500/80 shadow-md shadow-cyan-500/10"
          : "border-2 border-cyan-500/50 hover:border-cyan-500/80 shadow-sm shadow-cyan-500/5";
      case "playtime":
        return isOpen
          ? "border-2 border-teal-500/80 shadow-md shadow-teal-500/10"
          : "border-2 border-teal-500/50 hover:border-teal-500/80 shadow-sm shadow-teal-500/5";
      case "trophies":
        return isOpen
          ? "border-2 border-amber-500/80 shadow-md shadow-amber-500/10"
          : "border-2 border-amber-500/50 hover:border-amber-500/80 shadow-sm shadow-amber-500/5";
      case "replay":
        return isOpen
          ? "border-2 border-purple-500/80 shadow-md shadow-purple-500/10"
          : "border-2 border-purple-500/50 hover:border-purple-500/80 shadow-sm shadow-purple-500/5";
      case "gaas":
        return isOpen
          ? "border-2 border-pink-500/80 shadow-md shadow-pink-500/10"
          : "border-2 border-pink-500/50 hover:border-pink-500/80 shadow-sm shadow-pink-500/5";
      case "dates":
        return isOpen
          ? "border-2 border-sky-500/80 shadow-md shadow-sky-500/10"
          : "border-2 border-sky-500/50 hover:border-sky-500/80 shadow-sm shadow-sky-500/5";
      case "platform":
        return isOpen
          ? "border-2 border-indigo-500/80 shadow-md shadow-indigo-500/10"
          : "border-2 border-indigo-500/50 hover:border-indigo-500/80 shadow-sm shadow-indigo-500/5";
      case "proscons":
        return isOpen
          ? "border-2 border-emerald-500/80 shadow-md shadow-emerald-500/10"
          : "border-2 border-emerald-500/50 hover:border-emerald-500/80 shadow-sm shadow-emerald-500/5";
      case "status":
        return isOpen
          ? "border-2 border-emerald-500/80 shadow-md shadow-emerald-500/10"
          : "border-2 border-emerald-500/50 hover:border-emerald-500/80 shadow-sm shadow-emerald-500/5";
      case "genres":
        return isOpen
          ? "border-2 border-fuchsia-500/80 shadow-md shadow-fuchsia-500/10"
          : "border-2 border-fuchsia-500/50 hover:border-fuchsia-500/80 shadow-sm shadow-fuchsia-500/5";
      case "tags":
        return isOpen
          ? "border-2 border-cyan-500/80 shadow-md shadow-cyan-500/10"
          : "border-2 border-cyan-500/50 hover:border-cyan-500/80 shadow-sm shadow-cyan-500/5";
      case "icon":
        return isOpen
          ? "border-2 border-sky-500/80 shadow-md shadow-sky-500/10"
          : "border-2 border-sky-500/50 hover:border-sky-500/80 shadow-sm shadow-sky-500/5";
      case "cover":
        return isOpen
          ? "border-2 border-rose-500/80 shadow-md shadow-rose-500/10"
          : "border-2 border-rose-500/50 hover:border-rose-500/80 shadow-sm shadow-rose-500/5";
      default:
        return isOpen
          ? "border-2 border-zinc-700 shadow-md"
          : "border-2 border-zinc-800 hover:border-zinc-700";
    }
  };

  const openMetadataPreview = (data: any) => {
    setPreviewCandidateData(data);
    const currentTitle = name.trim();
    const candidateTitle = (data.name || "").trim();
    // Se o usuário já possui um título customizado que difere do IGDB, mantém o título do site desmarcado por padrão
    const isDifferentTitle = currentTitle.length > 0 && currentTitle.toLowerCase() !== candidateTitle.toLowerCase();

    setSelectedPreviewFields({
      title: !isDifferentTitle,
      cover: true,
      developer: true,
      publisher: true,
      series: true,
      releaseDate: true,
      platforms: true,
      genres: true,
      metacritic: true,
      igdbRating: true,
      hltb: true,
      synopsis: true,
    });
    setShowMetadataPreviewModal(true);
  };

  const togglePreviewField = (key: string) => {
    setSelectedPreviewFields((prev) => ({
      ...prev,
      [key]: !prev[key],
    }));
  };

  const toggleAllPreviewFields = (checked: boolean) => {
    setSelectedPreviewFields({
      title: checked,
      cover: checked,
      developer: checked,
      publisher: checked,
      series: checked,
      releaseDate: checked,
      platforms: checked,
      genres: checked,
      metacritic: checked,
      igdbRating: checked,
      hltb: checked,
      synopsis: checked,
    });
  };

  const applySelectedMetadataFields = () => {
    if (!previewCandidateData) return;
    const data = previewCandidateData;

    if (selectedPreviewFields.title && data.name) setName(data.name);
    if (selectedPreviewFields.developer && data.developer) setStudio(data.developer);
    if (selectedPreviewFields.publisher && data.publisher) setPublisher(data.publisher);
    if (selectedPreviewFields.series && data.series) setSeries(data.series);
    if (selectedPreviewFields.releaseDate && data.releaseDate) setReleaseDate(data.releaseDate);
    if (selectedPreviewFields.platforms && data.platforms && data.platforms.length > 0) {
      setAvailablePlatforms(data.platforms);
    }

    if (data.id && typeof data.id === "number") {
      setIgdbId(data.id);
    }
    if (data.slug) {
      setIgdbSlug(data.slug);
    }
    if (selectedPreviewFields.igdbRating && data.rating !== undefined) {
      setIgdbRating(data.rating);
    }

    if (selectedPreviewFields.metacritic) {
      if (data.aggregatedRating !== undefined && data.aggregatedRating !== null) {
        setMetacriticCritScore(data.aggregatedRating);
      } else if (data.metacritic !== undefined && data.metacritic !== null) {
        setMetacriticCritScore(data.metacritic);
      }
    }

    if (selectedPreviewFields.hltb) {
      if (data.hltbMain !== undefined && data.hltbMain !== null) {
        setHltbMain(formatHltbTime(data.hltbMain));
      }
      if (data.hltbMainExtra !== undefined && data.hltbMainExtra !== null) {
        setHltbExtra(formatHltbTime(data.hltbMainExtra));
      }
      if (data.hltbCompletionist !== undefined && data.hltbCompletionist !== null) {
        setHltbCompletionist(formatHltbTime(data.hltbCompletionist));
      }
    }

    if (selectedPreviewFields.cover) {
      const finalCover = data.coverHdUrl || data.coverUrl;
      if (finalCover) {
        setCoverUrl(finalCover);
        setTempUploadedCover(finalCover);
      }
    }

    if (data.iconUrl) {
      setActiveIconTab("url");
      setIconUrl(data.iconUrl);
    }

    if (selectedPreviewFields.genres && data.genres && Array.isArray(data.genres)) {
      data.genres.forEach((genreName: string) => {
        const capitalized = genreName.trim();
        if (capitalized) {
          if (!globalGenres.includes(capitalized)) {
            onAddGlobalGenre(capitalized);
          }
          setSelectedGenres((prev) => {
            if (prev.includes(capitalized)) return prev;
            return [...prev, capitalized];
          });
        }
      });
    }

    setShowMetadataPreviewModal(false);
    setIsSelectingCandidate(false);
    triggerAlert(
      "Metadados Aplicados!",
      `Os metadados selecionados de "${data.name}" foram aplicados à sua ficha técnica (Plataformas Disponíveis atualizadas).`
    );
  };

  const applyCandidateDirectly = (cand: any) => {
    if (!cand) return;
    if (cand.name) setName(cand.name);
    if (cand.developer) setStudio(cand.developer);
    if (cand.publisher) setPublisher(cand.publisher);
    if (cand.series) setSeries(cand.series);
    if (cand.releaseDate) setReleaseDate(cand.releaseDate);
    if (cand.platforms && Array.isArray(cand.platforms) && cand.platforms.length > 0) {
      setAvailablePlatforms(cand.platforms);
    }
    if (cand.id && typeof cand.id === "number") setIgdbId(cand.id);
    if (cand.slug) setIgdbSlug(cand.slug);
    if (cand.rating !== undefined) setIgdbRating(cand.rating);
    if (cand.aggregatedRating !== undefined && cand.aggregatedRating !== null) {
      setMetacriticCritScore(cand.aggregatedRating);
    } else if (cand.metacritic !== undefined && cand.metacritic !== null) {
      setMetacriticCritScore(cand.metacritic);
    }
    if (cand.hltbMain !== undefined && cand.hltbMain !== null) setHltbMain(formatHltbTime(cand.hltbMain));
    if (cand.hltbMainExtra !== undefined && cand.hltbMainExtra !== null) setHltbExtra(formatHltbTime(cand.hltbMainExtra));
    if (cand.hltbCompletionist !== undefined && cand.hltbCompletionist !== null) setHltbCompletionist(formatHltbTime(cand.hltbCompletionist));
    const finalCover = cand.coverHdUrl || cand.coverUrl;
    if (finalCover) {
      setCoverUrl(finalCover);
      setTempUploadedCover(finalCover);
    }
    if (cand.iconUrl) {
      setActiveIconTab("url");
      setIconUrl(cand.iconUrl);
    }
    if (cand.genres && Array.isArray(cand.genres)) {
      cand.genres.forEach((genreName: string) => {
        const capitalized = genreName.trim();
        if (capitalized) {
          if (!globalGenres.includes(capitalized)) {
            onAddGlobalGenre(capitalized);
          }
          setSelectedGenres((prev) => {
            if (prev.includes(capitalized)) return prev;
            return [...prev, capitalized];
          });
        }
      });
    }
    setIsSelectingCandidate(false);
    triggerAlert("Metadados Aplicados!", `Encontramos os detalhes de "${cand.name}" e preenchemos as Plataformas Disponíveis e a ficha técnica com sucesso.`);
  };

  const applyGameCandidate = (data: any) => {
    openMetadataPreview(data);
  };

  const toggleBulkCandidateSelection = (candidateId: number) => {
    setSelectedBulkCandidateIds((prev) =>
      prev.includes(candidateId) ? prev.filter((id) => id !== candidateId) : [...prev, candidateId]
    );
  };

  const toggleSelectAllBulkCandidates = () => {
    if (selectedBulkCandidateIds.length === gameCandidates.length) {
      setSelectedBulkCandidateIds([]);
    } else {
      setSelectedBulkCandidateIds(gameCandidates.map((c) => c.id).filter(Boolean));
    }
  };

  const handleExecuteBulkImport = async () => {
    if (selectedBulkCandidateIds.length === 0) {
      triggerAlert("Nenhum Jogo Selecionado", "Selecione pelo menos um jogo nos checkboxes para importar em lote.");
      return;
    }

    const selectedGamesData = gameCandidates.filter((c) => selectedBulkCandidateIds.includes(c.id));
    if (selectedGamesData.length === 0) return;

    setIsBulkImporting(true);
    try {
      const mappedGames = selectedGamesData.map((cand) => {
        const cover = cand.coverHdUrl || cand.coverUrl || "";
        const genres = Array.isArray(cand.genres) && cand.genres.length > 0 ? cand.genres : ["Ação"];
        genres.forEach((g: string) => {
          if (!globalGenres.includes(g)) onAddGlobalGenre(g);
        });

        return {
          name: cand.name || "Sem título",
          cover: cover,
          coverUrl: cover,
          icon: "🎮",
          iconType: "emoji" as const,
          studio: cand.developer || "",
          publisher: cand.publisher || "",
          series: cand.series || "",
          releaseDate: cand.releaseDate || "",
          startDate: "",
          endDate: "",
          platform: Array.isArray(cand.platforms) && cand.platforms.length > 0 ? cand.platforms[0] : "PC",
          availablePlatforms: Array.isArray(cand.platforms) ? cand.platforms : [],
          genre: genres,
          status: ["Quero Jogar"],
          rating: 0,
          playtime: "00h 00m",
          additionalPlaytime: "",
          igdbId: cand.id,
          igdbRating: cand.rating,
          igdbSlug: cand.slug,
          metacriticCritScore: cand.aggregatedRating || cand.metacritic || undefined,
          hltbMain: cand.hltbMain ? formatHltbTime(cand.hltbMain) : undefined,
          hltbExtra: cand.hltbMainExtra ? formatHltbTime(cand.hltbMainExtra) : undefined,
          hltbCompletionist: cand.hltbCompletionist ? formatHltbTime(cand.hltbCompletionist) : undefined,
          tags: ["IGDB Import"],
        };
      });

      if (onBulkSaveGames) {
        onBulkSaveGames(mappedGames);
      } else {
        // Fallback: apply the first one
        applyGameCandidate(selectedGamesData[0]);
      }

      setIsSelectingCandidate(false);
      setSelectedBulkCandidateIds([]);
    } catch (err: any) {
      triggerAlert("Erro na Importação em Lote", `Ocorreu um erro: ${err?.message || err}`);
    } finally {
      setIsBulkImporting(false);
    }
  };

  const handleOpenIgdbSearch = (initialTerm?: string) => {
    const term = (initialTerm !== undefined ? initialTerm : (igdbSearchQuery || name)).trim();
    setIgdbSearchQuery(term);
    setIsSelectingCandidate(true);
    if (term) {
      handlePerformIgdbSearch(term);
    }
  };

  const handlePerformIgdbSearch = async (termToSearch: string) => {
    const term = termToSearch.trim();
    if (!term) {
      triggerAlert("Termo de Busca Vazio", "Por favor, digite o nome do jogo para pesquisar no catálogo do IGDB.");
      return;
    }

    setIsFetchingIgdb(true);
    setHasSearchedIgdb(true);
    try {
      const games = await searchIgdbGames(term, 12);
      if (!games || games.length === 0) {
        setGameCandidates([]);
        triggerAlert("Sem Resultados no IGDB", `Nenhum jogo encontrado para "${term}". Tente pesquisar pelo nome original ou franquia em inglês.`);
      } else {
        setGameCandidates(games);
      }
    } catch (err: any) {
      console.error("Erro ao buscar no IGDB:", err);
      triggerAlert("Busca IGDB Indisponível", `Não foi possível carregar os dados do IGDB: ${err?.message || err}`);
    } finally {
      setIsFetchingIgdb(false);
    }
  };

  // SteamGridDB Gallery Handlers
  const handleOpenSteamGridGallery = async (customTerm?: string, targetMode: "cover" | "icon" = "cover", customGameId?: number) => {
    const term = (customTerm !== undefined ? customTerm : (steamGridSearchTerm || name)).trim();
    if (!term && !customGameId && !steamAppId) {
      triggerAlert("Título Necessário", "Digite o título do jogo antes de abrir a galeria do SteamGridDB.");
      return;
    }

    setSteamGridTargetMode(targetMode);
    setActiveSteamGridFilter(targetMode === "icon" ? "icon" : "all");
    setSteamGridSearchTerm(term);
    setShowSteamGridModal(true);
    setIsLoadingSteamGridMedia(true);
    try {
      const res = await fetchSteamGridMedia({
        query: term,
        gameId: customGameId,
        steamAppId: steamAppId,
        types: ["grid", "hero", "logo", "icon"],
      });
      setSteamGridMediaList(res.media);
      setSteamGridCandidates(res.candidates || []);
      if (res.game) {
        setSelectedSteamGridGame(res.game);
      } else if (customGameId) {
        setSelectedSteamGridGame({ id: customGameId, name: term });
      }
    } catch (err: any) {
      console.error("Erro ao carregar mídias do SteamGridDB:", err);
      triggerAlert("SteamGridDB Indisponível", err?.message || "Não foi possível carregar as imagens do jogo no SteamGridDB.");
    } finally {
      setIsLoadingSteamGridMedia(false);
    }
  };

  const handleSelectSteamGridMediaAsCover = (item: SteamGridMediaItem) => {
    const url = item.url || item.thumb;
    setCoverUrl(url);
    setTempUploadedCover(url);
    setShowSteamGridModal(false);
    setPreviewMediaItem(null);
    triggerAlert("Capa SteamGridDB Atualizada!", `A imagem (${item.width}x${item.height} ${item.type.toUpperCase()}) foi definida como capa do jogo.`);
  };

  const handleSelectSteamGridMediaAsIcon = (item: SteamGridMediaItem) => {
    const url = item.url || item.thumb;
    setActiveIconTab("url");
    setIconUrl(url);
    setTempUploadedIcon(url);
    setShowSteamGridModal(false);
    setPreviewMediaItem(null);
    triggerAlert("Ícone SteamGridDB Atualizado!", `O ícone (${item.width}x${item.height}) foi definido como ícone do jogo.`);
  };

  const handleFetchQuickSteamGridIcons = async (customQuery?: string) => {
    const term = (customQuery !== undefined ? customQuery : (quickIconsSearchTerm || name)).trim();
    if (!term && !steamAppId) {
      triggerAlert("Título Necessário", "Digite o título do jogo para buscar ícones no SteamGridDB.");
      return;
    }

    setQuickIconsSearchTerm(term);
    setIsLoadingQuickIcons(true);
    try {
      const res = await fetchSteamGridIcons({
        query: term,
        steamAppId: steamAppId,
      });
      setQuickSteamGridIcons(res.icons);
      if (res.icons.length === 0) {
        triggerAlert("Nenhum Ícone Encontrado", `Não encontramos ícones específicos para "${term}" no SteamGridDB. Tente buscar na Galeria Completa.`);
      }
    } catch (err: any) {
      console.error("Erro ao buscar ícones rápidos do SteamGridDB:", err);
      triggerAlert("Erro ao Buscar Ícones", err?.message || "Não foi possível conectar com o SteamGridDB.");
    } finally {
      setIsLoadingQuickIcons(false);
    }
  };

  const handleLoadHltbUrl = async () => {
    const input = hltbUrlInput.trim();
    if (!input) {
      triggerAlert("Link Vazio", "Por favor, insira o link da página do jogo do HowLongToBeat ou o ID numérico.");
      return;
    }

    setIsFetchingHltb(true);
    try {
      const response = await fetch(`/api/hltb?url=${encodeURIComponent(input)}`);
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `Servidor retornou erro: ${response.status}`);
      }
      const data = await response.json();
      
      // Set the 3 times
      setHltbMain(data.gameplayMain ? formatHltbTime(data.gameplayMain) : "");
      setHltbExtra(data.gameplayMainExtra ? formatHltbTime(data.gameplayMainExtra) : "");
      setHltbCompletionist(data.gameplayCompletionist ? formatHltbTime(data.gameplayCompletionist) : "");
      if (data.id) {
        setHltbId(data.id);
      }
      
      setShowHltbImport(false);
      setHltbUrlInput("");
      triggerAlert("Sucesso", "Métricas carregadas com sucesso do HowLongToBeat!");
    } catch (err: any) {
      console.error(err);
      triggerAlert("Erro ao carregar", `Não foi possível extrair dados: ${err.message || err}`);
    } finally {
      setIsFetchingHltb(false);
    }
  };

  const handleRefreshHltb = async () => {
    if (!hltbId) {
      triggerAlert("ID ausente", "Não há um ID do HowLongToBeat associado a este jogo para atualizar.");
      return;
    }
    setIsFetchingHltb(true);
    try {
      const response = await fetch(`/api/hltb?url=${encodeURIComponent(hltbId)}`);
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `Servidor retornou erro: ${response.status}`);
      }
      const data = await response.json();
      
      setHltbMain(data.gameplayMain ? formatHltbTime(data.gameplayMain) : "");
      setHltbExtra(data.gameplayMainExtra ? formatHltbTime(data.gameplayMainExtra) : "");
      setHltbCompletionist(data.gameplayCompletionist ? formatHltbTime(data.gameplayCompletionist) : "");
      
      triggerAlert("Métricas Atualizadas", "As médias do HowLongToBeat foram atualizadas com sucesso!");
    } catch (err: any) {
      console.error(err);
      triggerAlert("Erro ao atualizar", `Não foi possível atualizar dados: ${err.message || err}`);
    } finally {
      setIsFetchingHltb(false);
    }
  };

  const handleLoadMetacriticUrl = async () => {
    const input = metacriticUrlInput.trim();
    if (!input) {
      triggerAlert("Link Vazio", "Por favor, insira o link da página do jogo do Metacritic.");
      return;
    }

    setIsFetchingMetacritic(true);
    try {
      const response = await fetch(`/api/metacritic?url=${encodeURIComponent(input)}`);
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `Servidor retornou erro: ${response.status}`);
      }
      const data = await response.json();
      
      const targetUrl = data.metacriticUrl || input;
      setMetacriticUrl(targetUrl);
      
      const platformsList = data.platforms || [];
      setMetacriticPlatforms(platformsList);

      let matchedPlatformCode = "";
      if (platformsList.length > 0 && platform) {
        const platformLower = platform.toLowerCase();
        const found = platformsList.find((p: any) => 
          p.name.toLowerCase().includes(platformLower) || 
          platformLower.includes(p.name.toLowerCase()) ||
          p.code.toLowerCase().includes(platformLower) ||
          platformLower.includes(p.code.toLowerCase())
        );
        if (found) {
          matchedPlatformCode = found.code;
        }
      }

      if (matchedPlatformCode) {
        setSelectedMetacriticPlatform(matchedPlatformCode);
        const platResponse = await fetch(`/api/metacritic?url=${encodeURIComponent(targetUrl)}&platform=${matchedPlatformCode}`);
        if (platResponse.ok) {
          const platData = await platResponse.json();
          setMetacriticCritScore(platData.metacriticCritScore !== null ? platData.metacriticCritScore : undefined);
          setMetacriticUserScore(platData.metacriticUserScore !== null ? platData.metacriticUserScore : undefined);
          triggerAlert("Sucesso", `Dados da plataforma "${matchedPlatformCode}" carregados com sucesso!`);
        } else {
          setMetacriticCritScore(data.metacriticCritScore !== null ? data.metacriticCritScore : undefined);
          setMetacriticUserScore(data.metacriticUserScore !== null ? data.metacriticUserScore : undefined);
          triggerAlert("Sucesso", "Dados gerais carregados com sucesso!");
        }
      } else {
        setSelectedMetacriticPlatform("");
        setMetacriticCritScore(data.metacriticCritScore !== null ? data.metacriticCritScore : undefined);
        setMetacriticUserScore(data.metacriticUserScore !== null ? data.metacriticUserScore : undefined);
        triggerAlert("Sucesso", "Dados carregados com sucesso do Metacritic!");
      }
      
      setShowMetacriticImport(false);
      setMetacriticUrlInput("");
    } catch (err: any) {
      console.error(err);
      triggerAlert("Erro ao carregar", `Não foi possível extrair dados: ${err.message || err}`);
    } finally {
      setIsFetchingMetacritic(false);
    }
  };

  const handleSelectFormPlatform = async (platformCode: string) => {
    setSelectedMetacriticPlatform(platformCode);
    if (!metacriticUrl) return;
    setIsFetchingMetacritic(true);
    try {
      const response = await fetch(`/api/metacritic?url=${encodeURIComponent(metacriticUrl)}&platform=${platformCode}`);
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `Servidor retornou erro: ${response.status}`);
      }
      const data = await response.json();
      setMetacriticCritScore(data.metacriticCritScore !== null ? data.metacriticCritScore : undefined);
      setMetacriticUserScore(data.metacriticUserScore !== null ? data.metacriticUserScore : undefined);
      triggerAlert("Atualizado", `Notas atualizadas para a plataforma selecionada!`);
    } catch (err: any) {
      console.error(err);
      triggerAlert("Erro", `Não foi possível carregar notas para esta plataforma: ${err.message || err}`);
    } finally {
      setIsFetchingMetacritic(false);
    }
  };

  const handleRefreshMetacritic = async () => {
    if (!metacriticUrl) {
      triggerAlert("Link ausente", "Não há um link do Metacritic associado a este jogo para atualizar.");
      return;
    }
    setIsFetchingMetacritic(true);
    try {
      const response = await fetch(`/api/metacritic?url=${encodeURIComponent(metacriticUrl)}&platform=${selectedMetacriticPlatform}`);
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `Servidor retornou erro: ${response.status}`);
      }
      const data = await response.json();
      
      setMetacriticCritScore(data.metacriticCritScore !== null ? data.metacriticCritScore : undefined);
      setMetacriticUserScore(data.metacriticUserScore !== null ? data.metacriticUserScore : undefined);
      
      triggerAlert("Notas Atualizadas", "As notas do Metacritic foram atualizadas com sucesso!");
    } catch (err: any) {
      console.error(err);
      triggerAlert("Erro ao atualizar", `Não foi possível atualizar dados: ${err.message || err}`);
    } finally {
      setIsFetchingMetacritic(false);
    }
  };

  // Steam States
  const [showSteamImport, setShowSteamImport] = useState(false);
  const [isFetchingSteam, setIsFetchingSteam] = useState(false);
  const [steamUrlInput, setSteamUrlInput] = useState("");
  const [steamUserGamesList, setSteamUserGamesList] = useState<SteamOwnedGame[]>([]);
  const [isLoadingSteamGames, setIsLoadingSteamGames] = useState(false);
  const [steamAchieveData, setSteamAchieveData] = useState<SteamAchievementsResult | null>(null);

  // Auto fetch Steam achievements if steamAppId exists
  useEffect(() => {
    if (steamAppId && isOpen) {
      fetchSteamAchievements(steamAppId)
        .then((data) => setSteamAchieveData(data))
        .catch(() => setSteamAchieveData(null));
    } else {
      setSteamAchieveData(null);
    }
  }, [steamAppId, isOpen]);

  const handleFetchUserSteamGames = async () => {
    if (steamUserGamesList.length > 0) return;
    setIsLoadingSteamGames(true);
    try {
      const owned = await fetchSteamOwnedGames();
      setSteamUserGamesList(owned);
    } catch (err) {
      console.warn("Erro ao buscar jogos do usuário na Steam:", err);
    } finally {
      setIsLoadingSteamGames(false);
    }
  };

  const handleLinkSteamGame = async (steamGame: SteamOwnedGame) => {
    setSteamAppId(steamGame.appid);
    setSteamPlaytimeMinutes(steamGame.playtime_forever);
    setSteamLastPlayedTimestamp(steamGame.rtime_last_played);
    setShowSteamImport(false);
    try {
      const ach = await fetchSteamAchievements(steamGame.appid);
      if (ach) {
        setSteamAchieveData(ach);
        setSteamAchievementsCount(ach.unlockedCount);
        setSteamAchievementsTotal(ach.totalCount);
      }
    } catch {
      // Ignore
    }
    triggerAlert("Steam Vinculada", `Jogo "${steamGame.name}" vinculado com sucesso! (${formatSteamPlaytime(steamGame.playtime_forever)} registrados na Steam)`);
  };

  const handleLoadSteamInput = async () => {
    const input = steamUrlInput.trim();
    if (!input) {
      triggerAlert("Campo Vazio", "Por favor, digite um App ID, link da loja Steam ou nome do jogo.");
      return;
    }

    setIsFetchingSteam(true);
    try {
      const match = input.match(/app\/(\d+)/) || input.match(/run\/(\d+)/) || input.match(/^(\d+)$/);
      let foundAppId = match ? parseInt(match[1], 10) : null;

      if (!foundAppId) {
        let list = steamUserGamesList;
        if (list.length === 0) {
          list = await fetchSteamOwnedGames();
          setSteamUserGamesList(list);
        }
        const matchGame = list.find((g) => g.name.toLowerCase().includes(input.toLowerCase()));
        if (matchGame) {
          await handleLinkSteamGame(matchGame);
          return;
        }
      }

      if (!foundAppId) {
        throw new Error("Não foi possível identificar o App ID na Steam. Digite o código numérico do App ID (ex: 39140).");
      }

      setSteamAppId(foundAppId);

      let list = steamUserGamesList;
      if (list.length === 0) {
        list = await fetchSteamOwnedGames();
        setSteamUserGamesList(list);
      }
      const ownedMatch = list.find((g) => g.appid === foundAppId);
      if (ownedMatch) {
        setSteamPlaytimeMinutes(ownedMatch.playtime_forever);
        setSteamLastPlayedTimestamp(ownedMatch.rtime_last_played);
      } else {
        setSteamPlaytimeMinutes(0);
      }

      try {
        const ach = await fetchSteamAchievements(foundAppId);
        if (ach) {
          setSteamAchieveData(ach);
          setSteamAchievementsCount(ach.unlockedCount);
          setSteamAchievementsTotal(ach.totalCount);
        }
      } catch {
        // Ignore
      }

      setShowSteamImport(false);
      triggerAlert("Steam Vinculada", `App ID ${foundAppId} vinculado com sucesso!`);
    } catch (err: any) {
      console.error(err);
      triggerAlert("Erro ao Vincular", err.message || "Erro ao processar dados da Steam.");
    } finally {
      setIsFetchingSteam(false);
    }
  };

  const handleSyncSteamData = async () => {
    if (!steamAppId) return;
    setIsFetchingSteam(true);
    try {
      const owned = await fetchSteamOwnedGames();
      setSteamUserGamesList(owned);
      const match = owned.find((g) => g.appid === steamAppId);
      if (match) {
        setSteamPlaytimeMinutes(match.playtime_forever);
        setSteamLastPlayedTimestamp(match.rtime_last_played);
      }
      const ach = await fetchSteamAchievements(steamAppId);
      if (ach) {
        setSteamAchieveData(ach);
        setSteamAchievementsCount(ach.unlockedCount);
        setSteamAchievementsTotal(ach.totalCount);
      }
      triggerAlert("Dados Atualizados", `Estatísticas da Steam atualizadas para o App ID ${steamAppId}!`);
    } catch (err: any) {
      console.error(err);
      triggerAlert("Erro de Sincronização", "Não foi possível atualizar dados da Steam.");
    } finally {
      setIsFetchingSteam(false);
    }
  };

  const handleUnlinkSteam = () => {
    setSteamAppId(undefined);
    setSteamPlaytimeMinutes(undefined);
    setSteamLastPlayedTimestamp(undefined);
    setSteamAchieveData(null);
    triggerAlert("Steam Desvinculada", "Os dados da Steam foram removidos deste jogo.");
  };

  // GOG Handlers
  const handleFetchUserGogGames = async () => {
    if (gogUserGamesList.length > 0) return;
    setIsLoadingGogGames(true);
    try {
      const owned = await fetchGogOwnedGames();
      setGogUserGamesList(owned);
    } catch (err) {
      console.warn("Erro ao buscar jogos do usuário na GOG:", err);
    } finally {
      setIsLoadingGogGames(false);
    }
  };

  const handleLinkGogGame = async (gogGame: GogOwnedGame) => {
    setGogGameId(gogGame.id);
    let finalPlaytime = gogGame.playtime_minutes || 0;
    setGogPlaytimeMinutes(finalPlaytime);
    setGogLastPlayedTimestamp(gogGame.last_played_timestamp);
    setIntegrationPlatform("gog");
    setShowGogImport(false);

    try {
      const ach = await fetchGogAchievements(gogGame.id);
      if (ach) {
        setGogAchieveData(ach);
        setGogAchievementsCount(ach.unlockedCount);
        setGogAchievementsTotal(ach.totalCount);
        if (typeof ach.playtime_minutes === "number" && ach.playtime_minutes > 0) {
          finalPlaytime = Math.max(finalPlaytime, ach.playtime_minutes);
          setGogPlaytimeMinutes(finalPlaytime);
        }
      }
    } catch {}

    if (finalPlaytime > 0 && (!playtime || playtime.trim() === "" || playtime.trim() === "0h")) {
      setPlaytime(formatGogPlaytime(finalPlaytime));
    }

    triggerAlert(
      "GOG Vinculada",
      `Jogo "${gogGame.title}" vinculado com sucesso! (${formatGogPlaytime(finalPlaytime)} registrados na GOG)`
    );
  };

  const handleLoadGogInput = async () => {
    const input = gogUrlInput.trim();
    if (!input) {
      triggerAlert("Campo Vazio", "Por favor, digite o nome do jogo, ID ou cole a URL da loja GOG.");
      return;
    }
    setIsFetchingGog(true);
    try {
      // 1. Try smart resolver first (handles URLs, Slugs, Store links, IDs and maps to user library)
      const resolved = await resolveGogGame(input);
      if (resolved && resolved.success) {
        setGogGameId(resolved.gameId);
        let finalPlaytime = resolved.playtime_minutes || 0;
        setGogPlaytimeMinutes(finalPlaytime);
        setGogLastPlayedTimestamp(resolved.last_played_timestamp);
        setIntegrationPlatform("gog");
        if (resolved.achievements) {
          setGogAchieveData(resolved.achievements);
          setGogAchievementsCount(resolved.achievements.unlockedCount);
          setGogAchievementsTotal(resolved.achievements.totalCount);
        }
        if (!coverUrl && resolved.coverUrl) {
          setCoverUrl(resolved.coverUrl);
        }
        if (finalPlaytime > 0 && (!playtime || playtime.trim() === "" || playtime.trim() === "0h")) {
          setPlaytime(formatGogPlaytime(finalPlaytime));
        }
        setShowGogImport(false);
        triggerAlert(
          "GOG Sincronizada",
          `Jogo "${resolved.title}" vinculado com sucesso via GOG Galaxy! (${formatGogPlaytime(finalPlaytime)} e ${resolved.achievements?.unlockedCount || 0}/${resolved.achievements?.totalCount || 0} conquistas)`
        );
        return;
      }

      // 2. Fallback to searching user owned games locally
      let list = gogUserGamesList;
      if (list.length === 0) {
        list = await fetchGogOwnedGames();
        setGogUserGamesList(list);
      }
      const matchGame = list.find(
        (g) => g.title.toLowerCase().includes(input.toLowerCase()) || String(g.id) === input
      );
      if (matchGame) {
        await handleLinkGogGame(matchGame);
        return;
      }

      setGogGameId(input);
      setGogPlaytimeMinutes(0);
      setIntegrationPlatform("gog");
      setShowGogImport(false);
      triggerAlert("GOG Vinculada", `ID de jogo GOG ${input} vinculado com sucesso!`);
    } catch (err: any) {
      triggerAlert("Erro ao Vincular GOG", err?.message || "Erro ao processar dados da GOG.");
    } finally {
      setIsFetchingGog(false);
    }
  };

  const handleSyncGogData = async () => {
    if (!gogGameId) return;
    setIsFetchingGog(true);
    try {
      let finalPlaytime = gogPlaytimeMinutes || 0;
      const resolved = await resolveGogGame(String(gogGameId));
      if (resolved && resolved.success) {
        if (typeof resolved.playtime_minutes === "number" && resolved.playtime_minutes > 0) {
          finalPlaytime = resolved.playtime_minutes;
        }
        setGogPlaytimeMinutes(finalPlaytime);
        setGogLastPlayedTimestamp(resolved.last_played_timestamp);
        if (resolved.achievements) {
          setGogAchieveData(resolved.achievements);
          setGogAchievementsCount(resolved.achievements.unlockedCount);
          setGogAchievementsTotal(resolved.achievements.totalCount);
        }
      } else {
        const owned = await fetchGogOwnedGames();
        setGogUserGamesList(owned);
        const match = owned.find((g) => String(g.id) === String(gogGameId));
        if (match) {
          if (typeof match.playtime_minutes === "number" && match.playtime_minutes > 0) {
            finalPlaytime = match.playtime_minutes;
          }
          setGogPlaytimeMinutes(finalPlaytime);
          setGogLastPlayedTimestamp(match.last_played_timestamp);
        }
        const ach = await fetchGogAchievements(gogGameId);
        if (ach) {
          setGogAchieveData(ach);
          setGogAchievementsCount(ach.unlockedCount);
          setGogAchievementsTotal(ach.totalCount);
          if (typeof ach.playtime_minutes === "number" && ach.playtime_minutes > 0) {
            finalPlaytime = Math.max(finalPlaytime, ach.playtime_minutes);
            setGogPlaytimeMinutes(finalPlaytime);
          }
        }
      }
      if (finalPlaytime > 0 && (!playtime || playtime.trim() === "" || playtime.trim() === "0h")) {
        setPlaytime(formatGogPlaytime(finalPlaytime));
      }
      setIntegrationPlatform("gog");
      triggerAlert("Estatísticas GOG Atualizadas", `Estatísticas da GOG sincronizadas com sucesso! (${formatGogPlaytime(finalPlaytime)})`);
    } catch (err: any) {
      triggerAlert("Erro de Sincronização", "Não foi possível atualizar dados da GOG.");
    } finally {
      setIsFetchingGog(false);
    }
  };

  const handleUnlinkGog = () => {
    setGogGameId(undefined);
    setGogPlaytimeMinutes(undefined);
    setGogLastPlayedTimestamp(undefined);
    setGogAchieveData(null);
    triggerAlert("GOG Desvinculada", "Os dados da GOG foram removidos deste jogo.");
  };

  // Battle.net Handlers
  const handleBlizzardLogin = async () => {
    const width = 600;
    const height = 750;
    const left = window.screenX + (window.outerWidth - width) / 2;
    const top = window.screenY + (window.outerHeight - height) / 2;

    const effRedirectUri = getEffectiveBlizzardRedirectUri();

    // Open popup immediately to avoid browser popup blockers
    const popup = window.open(
      "about:blank",
      "blizzard_oauth_popup",
      `width=${width},height=${height},left=${left},top=${top},status=no,toolbar=no,menubar=no`
    );

    try {
      // Fetch the generated authorize URL with effective redirectUri
      const res = await fetch(
        `/api/blizzard/auth-url?json=true&region=${encodeURIComponent(blizzardRegion)}&redirectUri=${encodeURIComponent(effRedirectUri)}`
      );
      if (res.ok) {
        const data = await res.json();
        if (data.authUrl && popup) {
          popup.location.href = data.authUrl;
          return;
        }
      }
      // Fallback: direct server route that redirects via 302
      if (popup) {
        popup.location.href = `/api/blizzard/auth-url?region=${encodeURIComponent(blizzardRegion)}&redirectUri=${encodeURIComponent(effRedirectUri)}`;
      }
    } catch (err) {
      console.warn("Aviso ao abrir login Battle.net:", err);
      if (popup) {
        popup.location.href = `/api/blizzard/auth-url?region=${encodeURIComponent(blizzardRegion)}&redirectUri=${encodeURIComponent(effRedirectUri)}`;
      }
    }
  };

  // Listen for popup message from Blizzard OAuth callback
  useEffect(() => {
    const unsubscribe = registerBlizzardReauthListener((title, message) => {
      triggerAlert(title, message);
    });

    const handleMessage = async (event: MessageEvent) => {
      if (event.data?.type === "BLIZZARD_AUTH_SUCCESS") {
        if (event.data.error) {
          triggerAlert("Erro na Battle.net", `Falha na autorização: ${event.data.error}`);
          return;
        }
        if (event.data.code) {
          try {
            const effRedirectUri = getEffectiveBlizzardRedirectUri();
            const exchangeResult = await exchangeBlizzardCode(event.data.code, effRedirectUri);
            if (exchangeResult.success) {
              setIsBlizzardLoggedIn(true);
              if (exchangeResult.battleTag) {
                setBlizzardBattleTag(exchangeResult.battleTag);
              }
              triggerAlert(
                "Battle.net Conectada!",
                `Autenticado com sucesso como ${exchangeResult.battleTag || "Jogador"}!`
              );
              // If selected game is WoW, automatically load character list
              if (blizzardGameId?.startsWith("wow")) {
                handleFetchBlizzardCharacters(blizzardGameId);
              }
            } else {
              const alertTitle = exchangeResult.userNotice?.title || "Aviso de Conexão";
              const alertMsg = exchangeResult.userNotice?.message || exchangeResult.error || "Não foi possível validar as credenciais. Por favor, tente novamente.";
              triggerAlert(alertTitle, alertMsg);
            }
          } catch (err: any) {
            triggerAlert("Erro na Conexão", err?.message || "Falha ao processar código de acesso da Blizzard.");
          }
        } else if (event.data.battleTag) {
          setIsBlizzardLoggedIn(true);
          setBlizzardBattleTag(event.data.battleTag);
          triggerAlert("Battle.net Conectada!", `Autenticado como ${event.data.battleTag}!`);
        }
      }
    };
    window.addEventListener("message", handleMessage);
    return () => {
      unsubscribe();
      window.removeEventListener("message", handleMessage);
    };
  }, [blizzardGameId, blizzardRegion, triggerAlert]);

  const handleCopyCallbackUrl = () => {
    const urlToCopy = customRedirectUriInput.trim() || getEffectiveBlizzardRedirectUri();
    try {
      navigator.clipboard.writeText(urlToCopy);
      setCopiedRedirectUri(true);
      setTimeout(() => setCopiedRedirectUri(false), 2500);
    } catch {
      // ignore clipboard error
    }
  };

  const handleSaveCustomRedirectUri = () => {
    const trimmed = customRedirectUriInput.trim();
    setStoredBlizzardRedirectUri(trimmed);
    triggerAlert(
      "URL de Retorno Salva",
      trimmed ? "URL personalizada salva com sucesso!" : "URL padrão da aplicação restaurada."
    );
  };

  const handleResetDefaultRedirectUri = () => {
    setStoredBlizzardRedirectUri("");
    setCustomRedirectUriInput("");
    triggerAlert("URL Restaurada", "URL de retorno restaurada para o padrão oficial da aplicação.");
  };

  const handleSaveManualToken = async () => {
    if (!manualTokenInput.trim()) {
      triggerAlert("Token Obrigatório", "Por favor, cole o Access Token da Blizzard.");
      return;
    }
    const res = await verifyAndSaveManualToken(manualTokenInput, manualTokenTagInput);
    if (res.success) {
      setIsBlizzardLoggedIn(true);
      setBlizzardBattleTag(res.battleTag || "Jogador");
      setManualTokenInput("");
      setManualTokenTagInput("");
      triggerAlert("Battle.net Conectada!", `Token salvo com sucesso para ${res.battleTag}!`);
      if (blizzardGameId?.startsWith("wow")) {
        handleFetchBlizzardCharacters(blizzardGameId);
      }
    } else {
      triggerAlert("Falha ao Salvar", res.error || "Token inválido.");
    }
  };

  // Load characters if Blizzard is logged in and game is WoW
  const handleFetchBlizzardCharacters = async (selectedGameId?: string, forceRefresh?: boolean) => {
    const targetGame = selectedGameId || blizzardGameId || "wow-retail";
    setIsLoadingBlizzardChars(true);
    try {
      const chars = await fetchBlizzardWoWCharacters({
        region: blizzardRegion,
        gameId: targetGame,
        force: forceRefresh,
      });
      if (chars && chars.length > 0) {
        setBlizzardCharacters(chars);
        try {
          localStorage.setItem("halo_blizzard_cached_characters", JSON.stringify(chars));
        } catch {}

        // Check if current selected character is present in the newly fetched list
        const selName = (blizzardSelectedCharacter || game?.blizzardCharacterName || "").split("-")[0]?.toLowerCase();
        const selRealm = (blizzardSelectedCharacter || "").split("-").slice(1).join("-")?.toLowerCase();

        const existingMatch = chars.find((c) => {
          const cName = c.name.toLowerCase();
          const cRealm = (c.realmSlug || c.realm).toLowerCase();
          if (selRealm) {
            return cName === selName && cRealm === selRealm;
          }
          return cName === selName;
        });

        if (existingMatch) {
          const charKey = `${existingMatch.name}-${existingMatch.realmSlug || existingMatch.realm}`;
          setBlizzardSelectedCharacter(charKey);
          handleFetchBlizzardProfile(existingMatch.name, existingMatch.realmSlug || existingMatch.realm, targetGame, existingMatch);
        } else if (!blizzardSelectedCharacter && !game?.blizzardCharacterName && chars.length > 0) {
          const first = chars[0];
          const charKey = `${first.name}-${first.realmSlug || first.realm}`;
          setBlizzardSelectedCharacter(charKey);
          handleFetchBlizzardProfile(first.name, first.realmSlug || first.realm, targetGame, first);
        }
      }
    } catch (err: any) {
      console.warn("Aviso ao buscar personagens Blizzard:", err);
    } finally {
      setIsLoadingBlizzardChars(false);
    }
  };

  const handleFetchBlizzardProfile = async (
    charName: string,
    realmSlug: string,
    gameIdVal?: string,
    summaryObj?: BlizzardCharacterSummary
  ) => {
    setIsLoadingBlizzardProfile(true);
    try {
      const profile = await fetchBlizzardCharacterProfile(charName, realmSlug, {
        region: blizzardRegion,
        gameId: gameIdVal || blizzardGameId || "wow-retail",
        characterSummary: summaryObj,
        characterClass: summaryObj?.characterClass,
        race: summaryObj?.race,
        level: summaryObj?.level,
        gender: summaryObj?.gender,
        faction: summaryObj?.faction,
        activeSpec: summaryObj?.activeSpec,
        equippedItemLevel: summaryObj?.equippedItemLevel,
        version: summaryObj?.wow_version,
      });
      setBlizzardProfileData(profile);
      triggerAlert("Armory Atualizado", `Personagem ${charName} sincronizado com sucesso do Armory da Blizzard!`);
    } catch (err: any) {
      console.warn("Aviso ao carregar perfil de personagem:", err);
    } finally {
      setIsLoadingBlizzardProfile(false);
    }
  };

  const handleDirectArmorySearch = async () => {
    if (!manualCharNameInput.trim()) {
      triggerAlert("Campo Obrigatório", "Digite o nome do personagem para buscar no Armory oficial.");
      return;
    }
    const rName = manualRealmInput.trim() || "Azralon";
    const cName = manualCharNameInput.trim();
    setIsSearchingArmory(true);
    try {
      const profile = await fetchBlizzardCharacterProfile(cName, rName, {
        region: blizzardRegion,
        gameId: blizzardGameId || "wow-retail",
      });
      setBlizzardProfileData(profile);

      const charKey = `${profile.name}-${profile.realmSlug || profile.realm}`;
      const newSummary: BlizzardCharacterSummary = {
        name: profile.name,
        realm: profile.realm,
        realmSlug: profile.realmSlug,
        level: profile.level,
        characterClass: profile.characterClass,
        race: profile.race,
        gender: profile.gender,
        faction: profile.faction,
        equippedItemLevel: profile.equippedItemLevel,
        activeSpec: profile.activeSpec,
        gameMode: (blizzardGameId?.replace("wow-", "") as any) || "retail",
        wow_version: (blizzardGameId?.replace("wow-", "") as any) || "retail",
        classIconUrl: profile.classIconUrl,
        raceIconUrl: profile.raceIconUrl,
        factionIconUrl: profile.factionIconUrl,
        avatarUrl: profile.avatarUrl,
      };

      setBlizzardCharacters((prev) => {
        const filtered = prev.filter((p) => `${p.name}-${p.realmSlug || p.realm}` !== charKey);
        const nextList = [newSummary, ...filtered];
        try {
          localStorage.setItem("halo_blizzard_cached_characters", JSON.stringify(nextList));
        } catch {}
        return nextList;
      });

      setBlizzardSelectedCharacter(charKey);
      triggerAlert("Armory Conectado", `Personagem ${cName} (${rName}) importado do Armory oficial da Blizzard com sucesso!`);
    } catch (err: any) {
      triggerAlert("Aviso Armory", err?.message || "Não foi possível carregar o personagem no Armory.");
    } finally {
      setIsSearchingArmory(false);
    }
  };

  const handleSelectBlizzardGame = (gameItem: BlizzardOfficialGame) => {
    setBlizzardGameId(gameItem.id);
    setBlizzardGameName(gameItem.name);
    if (!name || name.trim() === "" || name === "Novo Jogo") {
      setName(gameItem.name);
    }
    if (gameItem.isWow) {
      handleFetchBlizzardCharacters(gameItem.id, false);
    }
  };

  const handleManualBattleTagConnect = () => {
    if (!manualBattleTagInput.trim()) {
      triggerAlert("Campo Vazio", "Digite sua BattleTag (ex: Player#1234).");
      return;
    }
    setStoredBlizzardBattleTag(manualBattleTagInput.trim());
    setStoredBlizzardRegion(blizzardRegion);
    setBlizzardBattleTag(manualBattleTagInput.trim());
    setIsBlizzardLoggedIn(true);
    triggerAlert("BattleTag Conectada", `BattleTag ${manualBattleTagInput.trim()} vinculada com sucesso!`);
    if (blizzardGameId) {
      handleFetchBlizzardCharacters(blizzardGameId);
    }
  };

  const handleDisconnectBlizzard = () => {
    clearBlizzardOAuthSession();
    setIsBlizzardLoggedIn(false);
    setBlizzardBattleTag("");
    setBlizzardCharacters([]);
    setBlizzardProfileData(null);
    setBlizzardSelectedCharacter("");
    triggerAlert("Battle.net Desconectada", "Sua sessão da Battle.net foi encerrada.");
  };

  // Initialize form
  useEffect(() => {
    if (game) {
      setName(game.name || "");
      setSeries(game.series || "");
      setPublisher(game.publisher || "");
      setStudio(game.studio || game.developer || "");
      setPricePaid(game.pricePaid !== undefined && game.pricePaid !== null ? String(game.pricePaid) : "");
      setReplayed(!!game.replayed);
      setReplayCount(game.replayCount || 0);
      setReplayNote(game.replayNote || "");
      setIsGaaS(!!game.isGaaS);
      setDlcMode(getDlcMode(game));
      setDlcNames(game.dlcNames || "");
      const rawPlaytime = game.playtime || "";
      if (parsePlaytimeHours(rawPlaytime) > 25000) {
        setPlaytime("0h");
      } else {
        setPlaytime(rawPlaytime);
      }
      setAdditionalPlaytime(game.additionalPlaytime || "");
      setTrophy(game.trophy || "none");
      setSelectedTrophyItems(getGameTrophyItems(game));
      setPros(game.pros || "");
      setCons(game.cons || "");
      setPlatform(game.platform || "");

      const rawAvail = game.availablePlatforms;
      if (Array.isArray(rawAvail)) {
        setAvailablePlatforms(rawAvail);
      } else if (typeof rawAvail === "string" && rawAvail.trim()) {
        setAvailablePlatforms(splitEntities(rawAvail));
      } else {
        setAvailablePlatforms([]);
      }

      setDifficulty(game.difficulty || "");
      setRating(game.rating || 0);
      setStartDate(game.startDate || "");
      setEndDate(game.endDate || "");
      setReleaseDate(game.releaseDate || "");

      const isDataCover = game.cover && game.cover.startsWith("data:");
      setCoverUrl(isDataCover ? "" : game.cover || "");
      setTempUploadedCover(isDataCover ? "" : game.cover || ""); // Clean up potential legacy base64 if needed, otherwise use cover

      const iconType = game.iconType || "emoji";
      setActiveIconTab(iconType);
      if (iconType === "emoji") {
        setIconEmoji(game.icon || "🎮");
      } else if (iconType === "upload") {
        setTempUploadedIcon(game.icon || "");
      } else {
        setIconUrl(game.icon || "");
      }

      setSelectedStatus(game.status || []);
      setSelectedGenres(game.genre || []);
      setSelectedTags(game.tags || []);

      // HLTB values
      setHltbMain(game.hltbMain || "");
      setHltbExtra(game.hltbExtra || "");
      setHltbCompletionist(game.hltbCompletionist || "");
      setHltbId(game.hltbId || "");

      // Metacritic values
      setMetacriticUrl(game.metacriticUrl || "");
      setMetacriticCritScore(game.metacriticCritScore !== undefined ? game.metacriticCritScore : undefined);
      setMetacriticUserScore(game.metacriticUserScore !== undefined ? game.metacriticUserScore : undefined);

      // IGDB values
      setIgdbId(game.igdbId);
      setIgdbRating(game.igdbRating);
      setIgdbSlug(game.igdbSlug);

      // Integration platform selection
      const activePlat = game.integrationPlatform || (game.gogGameId ? "gog" : game.steamAppId ? "steam" : "none");
      setIntegrationPlatform(activePlat);

      // Steam values
      setSteamAppId(game.steamAppId);
      setSteamPlaytimeMinutes(game.steamPlaytimeMinutes);
      setSteamLastPlayedTimestamp(game.steamLastPlayedTimestamp);
      setSteamAchievementsCount(game.steamAchievementsCount);
      setSteamAchievementsTotal(game.steamAchievementsTotal);

      // GOG values
      setGogGameId(game.gogGameId);
      const safeGogMins = game.gogPlaytimeMinutes && game.gogPlaytimeMinutes > 300000 ? 0 : game.gogPlaytimeMinutes;
      setGogPlaytimeMinutes(safeGogMins);
      setGogLastPlayedTimestamp(game.gogLastPlayedTimestamp);
      setGogAchievementsCount(game.gogAchievementsCount);
      setGogAchievementsTotal(game.gogAchievementsTotal);

      // Blizzard / Battle.net values
      setBlizzardGameId(game.blizzardGameId || "");
      setBlizzardGameName(game.blizzardGameName || "");
      setBlizzardRegion((game.blizzardRegion as any) || getStoredBlizzardRegion());
      const rawWowVer = (game.wowVersion || (game.blizzardGameId ? game.blizzardGameId.replace("wow-", "") : "forever")).toLowerCase();
      if (rawWowVer.includes("beta")) setSelectedWowVersion("forever_beta");
      else if (rawWowVer.includes("classic")) setSelectedWowVersion("classic");
      else if (rawWowVer.includes("retail") || rawWowVer.includes("midnight") || rawWowVer.includes("tww")) setSelectedWowVersion("retail");
      else if (rawWowVer.includes("mop")) setSelectedWowVersion("mop");
      else if (rawWowVer.includes("tbc")) setSelectedWowVersion("tbc");
      else setSelectedWowVersion("forever");
      const initialStoredChar =
        game.blizzardSelectedCharacter ||
        (game.blizzardCharacterName && game.blizzardRealm ? `${game.blizzardCharacterName}-${game.blizzardRealm}` : "") ||
        (game.id ? localStorage.getItem(`halo_blizzard_selected_char_${game.id}`) : null) ||
        (game.blizzardGameId ? localStorage.getItem(`halo_blizzard_selected_char_${game.blizzardGameId}`) : null) ||
        localStorage.getItem("halo_blizzard_selected_char_global") ||
        "";
      setBlizzardSelectedCharacter(initialStoredChar);
      setBlizzardProfileData(game.blizzardProfileData || null);
      const isBlizzAuthed = isBlizzardAuthenticated();
      setIsBlizzardLoggedIn(isBlizzAuthed);
      setBlizzardBattleTag(getStoredBlizzardBattleTag());
      let initialChars: BlizzardCharacterSummary[] = [];
      if (Array.isArray(game.blizzardCharacters) && game.blizzardCharacters.length > 0) {
        initialChars = game.blizzardCharacters;
      } else {
        try {
          const saved = localStorage.getItem("halo_blizzard_cached_characters");
          if (saved) {
            initialChars = JSON.parse(saved);
          }
        } catch {}
      }
      if (initialChars.length > 0) {
        setBlizzardCharacters(initialChars);
      }

      if (game.blizzardGameId?.startsWith("wow") || (!game.blizzardGameId && game.name?.toLowerCase().includes("warcraft"))) {
        fetchBlizzardWoWCharacters({
          region: (game.blizzardRegion as any) || getStoredBlizzardRegion(),
          gameId: game.blizzardGameId || "wow-retail"
        }).then((chars) => {
          if (chars && chars.length > 0) {
            setBlizzardCharacters(chars);
          }
        }).catch(() => {});
      }

      if (game.steamAppId) {
        fetchSteamAchievements(game.steamAppId)
          .then((ach) => {
            if (ach) {
              setSteamAchieveData(ach);
              setSteamAchievementsCount(ach.unlockedCount);
              setSteamAchievementsTotal(ach.totalCount);
            }
          })
          .catch(() => {});
      } else {
        setSteamAchieveData(null);
      }

      if (game.gogGameId) {
        fetchGogAchievements(game.gogGameId)
          .then((ach) => {
            if (ach) {
              setGogAchieveData(ach);
              setGogAchievementsCount(ach.unlockedCount);
              setGogAchievementsTotal(ach.totalCount);
            }
          })
          .catch(() => {});
      } else {
        setGogAchieveData(null);
      }
      
      if (game.metacriticUrl) {
        fetch(`/api/metacritic?url=${encodeURIComponent(game.metacriticUrl)}`)
          .then((res) => {
            if (!res.ok) return null;
            return res.json();
          })
          .then((data) => {
            if (data && data.platforms) {
              setMetacriticPlatforms(data.platforms);
            }
          })
          .catch((err) => {
            console.warn("Não foi possível obter plataformas no modal:", err?.message || err);
          });
      } else {
        setMetacriticPlatforms([]);
        setSelectedMetacriticPlatform("");
      }
    } else {
      // Clear all
      setName("");
      setSeries("");
      setPublisher("");
      setStudio("");
      setPricePaid("");
      setReplayed(false);
      setReplayCount(0);
      setReplayNote("");
      setDlcMode("none");
      setDlcNames("");
      setPlaytime("");
      setAdditionalPlaytime("");
      setTrophy("none");
      setSelectedTrophyItems([]);
      setPros("");
      setCons("");
      setPlatform("");
      setAvailablePlatforms([]);
      setShowNewAvailablePlatform(false);
      setNewAvailablePlatformVal("");
      setDifficulty("");
      setRating(0);
      setStartDate("");
      setEndDate("");
      setReleaseDate("");
      setCoverUrl("");
      setTempUploadedCover("");
      setActiveIconTab("emoji");
      setIconEmoji("🎮");
      setTempUploadedIcon("");
      setIconUrl("");
      setSelectedStatus([]);
      setSelectedGenres([]);
      setSelectedTags([]);

      // HLTB values
      setHltbMain("");
      setHltbExtra("");
      setHltbCompletionist("");
      setHltbId("");

      // Metacritic values
      setMetacriticUrl("");
      setMetacriticCritScore(undefined);
      setMetacriticUserScore(undefined);
      setMetacriticPlatforms([]);
      setSelectedMetacriticPlatform("");

      // Steam values
      setIntegrationPlatform("steam");
      setSteamAppId(undefined);
      setSteamPlaytimeMinutes(undefined);
      setSteamLastPlayedTimestamp(undefined);
      setSteamAchievementsCount(undefined);
      setSteamAchievementsTotal(undefined);
      setSteamAchieveData(null);

      // GOG values
      setGogGameId(undefined);
      setGogPlaytimeMinutes(undefined);
      setGogLastPlayedTimestamp(undefined);
      setGogAchievementsCount(undefined);
      setGogAchievementsTotal(undefined);
      setGogAchieveData(null);
      setShowGogImport(false);
      setGogUrlInput("");

      // Blizzard values
      setBlizzardGameId("");
      setBlizzardGameName("");
      setBlizzardSelectedCharacter("");
      setBlizzardCharacters([]);
      setBlizzardProfileData(null);
      setIsBlizzardLoggedIn(isBlizzardAuthenticated());
      setBlizzardBattleTag(getStoredBlizzardBattleTag());
      setBlizzardRegion(getStoredBlizzardRegion());

      // IGDB values
      setIgdbId(undefined);
      setIgdbRating(undefined);
      setIgdbSlug(undefined);
    }
    setShowNewGenre(false);
    setShowNewTag(false);
    setNewGenreVal("");
    setNewTagVal("");

    // Clear HLTB import states
    setIsFetchingHltb(false);
    setHltbUrlInput("");
    setShowHltbImport(false);

    // Clear Metacritic import states
    setIsFetchingMetacritic(false);
    setMetacriticUrlInput("");
    setShowMetacriticImport(false);
  }, [game, isOpen]);

  const uploadCoverFile = async (file: File) => {
    setIsUploadingCover(true);
    try {
      const fileNameParam = `${name.trim() || "jogo"}_cover`;
      const res = await uploadToImgBB(file, fileNameParam);
      setTempUploadedCover(res.url);
      setCoverUrl(""); // override text input with direct ImgBB url
    } catch (err: any) {
      console.error(err);
      triggerAlert(
        "Erro de Upload",
        `Não foi possível enviar a capa para o ImgBB: ${err.message || err}`
      );
    } finally {
      setIsUploadingCover(false);
    }
  };

  const uploadIconFile = async (file: File) => {
    setIsUploadingIcon(true);
    try {
      const fileNameParam = `${name.trim() || "jogo"}_icon`;
      const res = await uploadToImgBB(file, fileNameParam);
      setTempUploadedIcon(res.url);
    } catch (err: any) {
      console.error(err);
      triggerAlert(
        "Erro de Upload",
        `Não foi possível enviar o ícone para o ImgBB: ${err.message || err}`
      );
    } finally {
      setIsUploadingIcon(false);
    }
  };

  const handleCoverUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) uploadCoverFile(file);
  };

  const handleIconUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) uploadIconFile(file);
  };

  // Drag and drop events for Icon
  const handleIconDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOverIcon(true);
  };

  const handleIconDragLeave = () => {
    setIsDragOverIcon(false);
  };

  const handleIconDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOverIcon(false);
    const file = e.dataTransfer.files?.[0];
    if (file && file.type.startsWith("image/")) {
      uploadIconFile(file);
    } else if (file) {
      triggerAlert("Formato Inválido", "Por favor, envie apenas arquivos de imagem para o ícone.");
    }
  };

  // Drag and drop events for Cover
  const handleCoverDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOverCover(true);
  };

  const handleCoverDragLeave = () => {
    setIsDragOverCover(false);
  };

  const handleCoverDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOverCover(false);
    const file = e.dataTransfer.files?.[0];
    if (file && file.type.startsWith("image/")) {
      uploadCoverFile(file);
    } else if (file) {
      triggerAlert("Formato Inválido", "Por favor, envie apenas arquivos de imagem para a capa do jogo.");
    }
  };

  const toggleStatus = (statusVal: string) => {
    const isTurningOnJogando = statusVal === "Jogando" && !selectedStatus.includes("Jogando");

    if (isTurningOnJogando) {
      const prevStatusList = game ? (game.status || []) : selectedStatus;
      const wasInactiveOrFinished =
        prevStatusList.some((s) => ["Terminado", "Em Hiatus", "Desistido", "Backlog"].includes(s)) ||
        (prevStatusList.length > 0 && !prevStatusList.includes("Jogando"));

      if (wasInactiveOrFinished) {
        setPendingReplayPreviousStatus(prevStatusList);
        setAutoArchivePlaytime(parsePlaytimeHours(playtime) > 0);
        setShowReplayPromptModal(true);
      }
    }

    setSelectedStatus((prev) =>
      prev.includes(statusVal) ? prev.filter((s) => s !== statusVal) : [...prev, statusVal]
    );
  };

  const handleConfirmReplayPrompt = (addReplay: boolean) => {
    if (addReplay) {
      const currentCount = replayed ? (replayCount || 1) : 0;
      const nextCount = currentCount + 1;
      setReplayed(true);
      setReplayCount(nextCount);

      const todayStr = new Date().toLocaleDateString("pt-BR");
      const newNoteChunk = `Replay #${nextCount} iniciado em ${todayStr}`;
      setReplayNote((prev) => {
        const trimmed = prev.trim();
        return trimmed ? `${trimmed}; ${newNoteChunk}` : newNoteChunk;
      });

      if (autoArchivePlaytime && parsePlaytimeHours(playtime) > 0) {
        const currentMainH = parsePlaytimeHours(playtime);
        const currentAddH = parsePlaytimeHours(additionalPlaytime);
        const newAddH = currentAddH + currentMainH;
        setAdditionalPlaytime(
          formatHoursAndMinutes(newAddH) + ` [Campanha anterior: ${playtime}]`
        );
        setPlaytime("0h");
      }
    }
    setShowReplayPromptModal(false);
  };

  const toggleGenre = (genreVal: string) => {
    setSelectedGenres((prev) =>
      prev.includes(genreVal) ? prev.filter((g) => g !== genreVal) : [...prev, genreVal]
    );
  };

  const toggleTag = (tagVal: string) => {
    setSelectedTags((prev) =>
      prev.includes(tagVal) ? prev.filter((t) => t !== tagVal) : [...prev, tagVal]
    );
  };

  const submitCustomGenre = () => {
    const val = newGenreVal.trim();
    if (!val) return;
    onAddGlobalGenre(val);
    if (!selectedGenres.includes(val)) {
      setSelectedGenres((prev) => [...prev, val]);
    }
    setNewGenreVal("");
    setShowNewGenre(false);
  };

  const submitCustomTag = () => {
    const val = newTagVal.trim();
    if (!val) return;
    onAddGlobalTag(val);
    if (!selectedTags.includes(val)) {
      setSelectedTags((prev) => [...prev, val]);
    }
    setNewTagVal("");
    setShowNewTag(false);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!name.trim()) {
      triggerAlert("Campo Obrigatório", "Por favor, preencha o título do jogo.");
      return;
    }

    if (selectedStatus.length === 0) {
      triggerAlert("Progresso Requerido", "Por favor, selecione pelo menos uma categoria de progresso.");
      return;
    }

    if (selectedGenres.length === 0) {
      triggerAlert("Gênero Requerido", "Por favor, selecione pelo menos um gênero para o jogo.");
      return;
    }

    // Determine icon
    let finalIcon = "🎮";
    if (activeIconTab === "emoji") finalIcon = iconEmoji.trim() || "🎮";
    if (activeIconTab === "upload") finalIcon = tempUploadedIcon || "🎮";
    if (activeIconTab === "url") finalIcon = iconUrl.trim() || "🎮";
    if (activeIconTab === "steamgriddb") finalIcon = tempUploadedIcon || iconUrl.trim() || "🎮";

    // Determine cover
    const finalCover = tempUploadedCover || coverUrl.trim() || COVER_BANK[0];

    const formatAndSortList = (raw: string) => {
      if (!raw) return "";
      const items = raw
        .split(/[;\n\r]+/)
        .map((item) => item.trim())
        .filter(Boolean);
      items.sort((a, b) => {
        const topicA = parseProConTopic(a).topic;
        const topicB = parseProConTopic(b).topic;
        return topicA.localeCompare(topicB, "pt", { sensitivity: "base" });
      });
      return items.join("; ");
    };

    const highestTrophy = getGameHighestTrophy({ trophies: selectedTrophyItems });

    const parsePriceInput = (val: string): number | undefined => {
      if (!val || !val.trim()) return undefined;
      const sanitized = val.replace(",", ".").replace(/[^0-9.]/g, "");
      if (!sanitized) return undefined;
      const parsed = parseFloat(sanitized);
      return isNaN(parsed) ? undefined : parsed;
    };

    onSave({
      id: game?.id,
      name: name.trim(),
      series: series.trim(),
      publisher: publisher.trim(),
      studio: studio.trim(),
      pricePaid: parsePriceInput(pricePaid),
      playtime: playtime.trim() || "00h 00m",
      additionalPlaytime: additionalPlaytime.trim(),
      trophy: highestTrophy,
      trophies: selectedTrophyItems,
      pros: formatAndSortList(pros),
      cons: formatAndSortList(cons),
      rating: Math.min(5, Math.max(0, rating)),
      startDate,
      endDate,
      releaseDate,
      cover: finalCover,
      icon: finalIcon,
      iconType: activeIconTab === "steamgriddb" ? "url" : activeIconTab,
      status: selectedStatus,
      replayed,
      replayCount: replayed ? Math.max(1, replayCount) : 0,
      replayNote: replayed ? replayNote.trim() : "",
      isGaaS,
      dlcMode,
      dlcNames: dlcMode !== "none" ? dlcNames.trim() : "",
      isDlc: dlcMode === "dlc" || dlcMode === "plus_dlc",
      difficulty: difficulty.trim(),
      genre: selectedGenres,
      tags: selectedTags,
      platform: platform.trim() || "PC",
      availablePlatforms: availablePlatforms.length > 0 ? availablePlatforms : undefined,
      hltbMain,
      hltbExtra,
      hltbCompletionist,
      hltbId,
      metacriticUrl,
      metacriticCritScore,
      metacriticUserScore,
      integrationPlatform: integrationPlatform || (gogGameId ? "gog" : (steamAppId ? "steam" : "none")),
      steamAppId: steamAppId && !isNaN(Number(steamAppId)) ? Number(steamAppId) : undefined,
      steamPlaytimeMinutes: typeof steamPlaytimeMinutes === "number" && !isNaN(steamPlaytimeMinutes) ? steamPlaytimeMinutes : undefined,
      steamLastPlayedTimestamp: typeof steamLastPlayedTimestamp === "number" && !isNaN(steamLastPlayedTimestamp) ? steamLastPlayedTimestamp : undefined,
      steamAchievementsCount: steamAchieveData ? (!isNaN(steamAchieveData.unlockedCount) ? steamAchieveData.unlockedCount : undefined) : (typeof steamAchievementsCount === "number" && !isNaN(steamAchievementsCount) ? steamAchievementsCount : (game?.steamAchievementsCount && !isNaN(game.steamAchievementsCount) ? game.steamAchievementsCount : undefined)),
      steamAchievementsTotal: steamAchieveData ? (!isNaN(steamAchieveData.totalCount) ? steamAchieveData.totalCount : undefined) : (typeof steamAchievementsTotal === "number" && !isNaN(steamAchievementsTotal) ? steamAchievementsTotal : (game?.steamAchievementsTotal && !isNaN(game.steamAchievementsTotal) ? game.steamAchievementsTotal : undefined)),
      gogGameId: gogGameId ? (typeof gogGameId === "number" ? (!isNaN(gogGameId) ? gogGameId : undefined) : (String(gogGameId).trim() || undefined)) : undefined,
      gogPlaytimeMinutes: typeof gogPlaytimeMinutes === "number" && !isNaN(gogPlaytimeMinutes) ? gogPlaytimeMinutes : undefined,
      gogLastPlayedTimestamp: typeof gogLastPlayedTimestamp === "number" && !isNaN(gogLastPlayedTimestamp) ? gogLastPlayedTimestamp : undefined,
      gogAchievementsCount: gogAchieveData ? (!isNaN(gogAchieveData.unlockedCount) ? gogAchieveData.unlockedCount : undefined) : (typeof gogAchievementsCount === "number" && !isNaN(gogAchievementsCount) ? gogAchievementsCount : (game?.gogAchievementsCount && !isNaN(game.gogAchievementsCount) ? game.gogAchievementsCount : undefined)),
      gogAchievementsTotal: gogAchieveData ? (!isNaN(gogAchieveData.totalCount) ? gogAchieveData.totalCount : undefined) : (typeof gogAchievementsTotal === "number" && !isNaN(gogAchievementsTotal) ? gogAchievementsTotal : (game?.gogAchievementsTotal && !isNaN(game.gogAchievementsTotal) ? game.gogAchievementsTotal : undefined)),
      blizzardGameId: blizzardGameId || (selectedWowVersion ? (selectedWowVersion === "forever_beta" ? "wow-forever" : `wow-${selectedWowVersion}`) : undefined),
      blizzardGameName: blizzardGameName || (selectedWowVersion === "forever" ? "World of Warcraft: Forever" : (selectedWowVersion === "forever_beta" ? "World of Warcraft: Forever Beta" : (selectedWowVersion === "classic" ? "World of Warcraft: Classic Era" : "World of Warcraft: Retail"))),
      blizzardRegion: blizzardRegion || undefined,
      blizzardCharacterName: blizzardSelectedCharacter ? blizzardSelectedCharacter.split("-")[0] : (game?.blizzardCharacterName || undefined),
      blizzardRealm: blizzardSelectedCharacter ? blizzardSelectedCharacter.split("-").slice(1).join("-") : (game?.blizzardRealm || undefined),
      blizzardSelectedCharacter: blizzardSelectedCharacter || game?.blizzardSelectedCharacter || undefined,
      blizzardProfileData: blizzardProfileData || game?.blizzardProfileData || undefined,
      blizzardCharacters: blizzardCharacters.length > 0 ? blizzardCharacters : (game?.blizzardCharacters || undefined),
      wowVersion: (blizzardGameId?.startsWith("wow") || name.toLowerCase().includes("warcraft") || integrationPlatform === "battlenet") ? selectedWowVersion : (game?.wowVersion || undefined),
      igdbId,
      igdbRating,
      igdbSlug,
      igdbUrl: igdbSlug ? `https://www.igdb.com/games/${igdbSlug}` : (igdbId ? `https://www.igdb.com/games/${igdbId}` : undefined),
      ...(game ? { diary: game.diary } : { diary: [] })
    });
  };

  const scrollToBlock = (blockKey: string) => {
    isProgrammaticScrollRef.current = true;
    if (scrollTimeoutRef.current) {
      clearTimeout(scrollTimeoutRef.current);
    }

    setActiveBlock(blockKey);
    // Expand ONLY the clicked block and collapse all others
    setOpenBlocks({ [blockKey]: true });

    setTimeout(() => {
      const el = document.getElementById(`block-${blockKey}`);
      if (el) {
        el.scrollIntoView({ behavior: "smooth", block: "start" });
      }
      scrollTimeoutRef.current = setTimeout(() => {
        isProgrammaticScrollRef.current = false;
      }, 750);
    }, 50);
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 overflow-hidden">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 bg-black/80 backdrop-blur-md"
            onClick={onClose}
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.96, y: 15 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: 15 }}
            className="bg-zinc-950 rounded-2xl sm:rounded-3xl w-[96vw] lg:w-[93vw] xl:w-[91vw] max-w-[1850px] h-[91vh] max-h-[94vh] flex flex-col shadow-2xl border border-purple-500/40 relative z-10 shadow-[0_0_60px_rgba(0,0,0,0.85)] overflow-hidden"
          >
            <div className="p-4 sm:p-5 border-b border-zinc-800 flex justify-between items-center bg-zinc-950/95 sticky top-0 backdrop-blur-md z-30 shadow-md gap-3 shrink-0">
              <h3 className="text-base sm:text-lg font-bold text-white truncate">
                {game ? "Editar Ficha de Jogo" : "Adicionar Novo Jogo"}
              </h3>
              <div className="flex items-center gap-2 sm:gap-3 shrink-0">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-3 py-1.5 sm:px-4 sm:py-2 rounded-xl bg-zinc-900 border border-zinc-800 text-zinc-300 font-semibold hover:bg-zinc-800 transition-all text-xs cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  form="game-form"
                  className="btn-neon px-4 py-2 sm:px-5 sm:py-2 rounded-xl bg-gradient-to-r from-purple-600 to-cyan-500 hover:from-purple-500 hover:to-cyan-400 text-white font-bold text-xs sm:text-sm shadow-lg shadow-purple-600/20 cursor-pointer flex items-center gap-1.5"
                >
                  <Check size={15} />
                  <span>Salvar Ficha</span>
                </button>
                <button
                  type="button"
                  onClick={onClose}
                  className="text-zinc-400 hover:text-white transition-colors p-1.5 hover:bg-zinc-800 rounded-lg ml-0.5 cursor-pointer"
                  title="Fechar"
                >
                  <X size={18} />
                </button>
              </div>
            </div>

            {/* Quick Navigation Chips Bar */}
            <div className="sticky top-0 z-20 bg-zinc-950/95 backdrop-blur-md border-b border-zinc-800/80 px-4 sm:px-6 py-2 flex items-center gap-2 overflow-x-auto scrollbar-none shadow-sm shrink-0">
              <span className="text-[10px] font-mono text-cyan-400 font-bold uppercase tracking-wider shrink-0 flex items-center gap-1 mr-1">
                <Sparkles size={11} className="text-purple-400" />
                <span>Atalhos:</span>
              </span>
              <div ref={chipsBarRef} className="flex items-center gap-1.5 shrink-0">
                {[
                  { key: "basic", label: "Informações & GaaS", icon: Gamepad2, activeClass: "bg-cyan-500/25 text-cyan-300 border-cyan-400 border-b-2 ring-2 ring-cyan-500/40 shadow-md shadow-cyan-500/20 font-extrabold scale-[1.03]" },
                  { key: "status", label: "Status & DLC", icon: CheckCircle, activeClass: "bg-emerald-500/25 text-emerald-300 border-emerald-400 border-b-2 ring-2 ring-emerald-500/40 shadow-md shadow-emerald-500/20 font-extrabold scale-[1.03]" },
                  { key: "platform", label: "Plataforma", icon: Monitor, activeClass: "bg-indigo-500/25 text-indigo-300 border-indigo-400 border-b-2 ring-2 ring-indigo-500/40 shadow-md shadow-indigo-500/20 font-extrabold scale-[1.03]" },
                  { key: "playtime", label: "Tempo", icon: Clock, activeClass: "bg-teal-500/25 text-teal-300 border-teal-400 border-b-2 ring-2 ring-teal-500/40 shadow-md shadow-teal-500/20 font-extrabold scale-[1.03]" },
                  { key: "dates", label: "Datas", icon: Calendar, activeClass: "bg-sky-500/25 text-sky-300 border-sky-400 border-b-2 ring-2 ring-sky-500/40 shadow-md shadow-sky-500/20 font-extrabold scale-[1.03]" },
                  { key: "trophies", label: "Troféus", icon: Trophy, activeClass: "bg-amber-500/25 text-amber-300 border-amber-400 border-b-2 ring-2 ring-amber-500/40 shadow-md shadow-amber-500/20 font-extrabold scale-[1.03]" },
                  { key: "replay", label: "Replay", icon: RotateCcw, activeClass: "bg-purple-500/25 text-purple-300 border-purple-400 border-b-2 ring-2 ring-purple-500/40 shadow-md shadow-purple-500/20 font-extrabold scale-[1.03]" },
                  { key: "icon", label: "Ícone", icon: Smile, activeClass: "bg-sky-500/25 text-sky-300 border-sky-400 border-b-2 ring-2 ring-sky-500/40 shadow-md shadow-sky-500/20 font-extrabold scale-[1.03]" },
                  { key: "cover", label: "Capa", icon: ImageIcon, activeClass: "bg-rose-500/25 text-rose-300 border-rose-400 border-b-2 ring-2 ring-rose-500/40 shadow-md shadow-rose-500/20 font-extrabold scale-[1.03]" },
                  { key: "proscons", label: "Prós/Contras", icon: ThumbsUp, activeClass: "bg-emerald-500/25 text-emerald-300 border-emerald-400 border-b-2 ring-2 ring-emerald-500/40 shadow-md shadow-emerald-500/20 font-extrabold scale-[1.03]" },
                  { key: "genres", label: "Gêneros", icon: Gamepad2, activeClass: "bg-fuchsia-500/25 text-fuchsia-300 border-fuchsia-400 border-b-2 ring-2 ring-fuchsia-500/40 shadow-md shadow-fuchsia-500/20 font-extrabold scale-[1.03]" },
                  { key: "tags", label: "Tags", icon: Tag, activeClass: "bg-cyan-500/25 text-cyan-300 border-cyan-400 border-b-2 ring-2 ring-cyan-500/40 shadow-md shadow-cyan-500/20 font-extrabold scale-[1.03]" },
                  { key: "hltb", label: "HLTB", icon: Sparkles, activeClass: "bg-purple-500/25 text-purple-300 border-purple-400 border-b-2 ring-2 ring-purple-500/40 shadow-md shadow-purple-500/20 font-extrabold scale-[1.03]" },
                  { key: "metacritic", label: "Metacritic", icon: Star, activeClass: "bg-amber-500/25 text-amber-300 border-amber-400 border-b-2 ring-2 ring-amber-500/40 shadow-md shadow-amber-500/20 font-extrabold scale-[1.03]" },
                  { key: "steam", label: "Loja / Sinc", icon: Globe, activeClass: "bg-blue-500/25 text-blue-300 border-blue-400 border-b-2 ring-2 ring-blue-500/40 shadow-md shadow-blue-500/20 font-extrabold scale-[1.03]" },
                ].map((chip) => {
                  const IconComp = chip.icon;
                  const isOpen = !!openBlocks[chip.key];
                  const isActive = activeBlock === chip.key;
                  return (
                    <button
                      key={chip.key}
                      data-chip-key={chip.key}
                      type="button"
                      onClick={() => scrollToBlock(chip.key)}
                      className={`px-2.5 py-1 rounded-xl border text-[11px] font-bold transition-all flex items-center gap-1.5 cursor-pointer whitespace-nowrap select-none ${
                        isActive
                          ? chip.activeClass
                          : isOpen
                          ? "bg-zinc-900 text-zinc-200 border-zinc-700 hover:text-white hover:bg-zinc-800"
                          : "bg-zinc-900/80 text-zinc-400 border-zinc-800 hover:text-white hover:bg-zinc-800"
                      }`}
                    >
                      <IconComp size={12} className={isActive ? "animate-pulse" : ""} />
                      <span>{chip.label}</span>
                      {isActive ? (
                        <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse" />
                      ) : isOpen ? (
                        <span className="w-1.5 h-1.5 rounded-full bg-zinc-500" />
                      ) : null}
                    </button>
                  );
                })}
              </div>
            </div>

            {isSelectingCandidate && (
              <div className="absolute inset-x-0 bottom-0 top-[73px] bg-zinc-950 z-40 flex flex-col p-6 space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-zinc-900 pb-4 shrink-0">
                  <div>
                    <h4 className="text-base font-black text-cyan-400 uppercase tracking-wider flex items-center gap-2">
                      <Search size={16} className="text-emerald-400" />
                      Procurar e Importar do IGDB
                    </h4>
                    <p className="text-xs text-zinc-400 mt-0.5">
                      Pesquise por qualquer jogo no catálogo oficial e escolha seletivamente o que importar para a ficha técnica:
                    </p>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      type="button"
                      onClick={() => setIsSelectingCandidate(false)}
                      className="p-1.5 rounded-xl bg-zinc-900 hover:bg-zinc-800 text-zinc-400 hover:text-white border border-zinc-800 transition-colors cursor-pointer"
                      title="Fechar busca IGDB"
                    >
                      <X size={18} />
                    </button>
                  </div>
                </div>

                {/* Search Input Bar */}
                <div className="flex flex-col sm:flex-row gap-2 shrink-0 bg-zinc-900/90 p-2.5 rounded-2xl border border-zinc-800 shadow-md">
                  <div className="relative flex-1">
                    <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-400" />
                    <input
                      type="text"
                      value={igdbSearchQuery}
                      onChange={(e) => setIgdbSearchQuery(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          handlePerformIgdbSearch(igdbSearchQuery);
                        }
                      }}
                      placeholder="Digite o título do jogo no IGDB (ex: Resident Evil, Elden Ring, The Witcher 3)..."
                      className="w-full pl-10 pr-9 py-2.5 rounded-xl bg-black/60 border border-zinc-750 text-white text-xs sm:text-sm placeholder-zinc-500 focus:outline-none focus:border-cyan-500 transition-colors"
                      autoFocus
                    />
                    {igdbSearchQuery && (
                      <button
                        type="button"
                        onClick={() => setIgdbSearchQuery("")}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-300 p-0.5 rounded cursor-pointer"
                      >
                        <X size={14} />
                      </button>
                    )}
                  </div>

                  <button
                    type="button"
                    onClick={() => handlePerformIgdbSearch(igdbSearchQuery)}
                    disabled={isFetchingIgdb || !igdbSearchQuery.trim()}
                    className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white text-xs sm:text-sm font-bold shadow-lg shadow-emerald-950/40 transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                  >
                    {isFetchingIgdb ? (
                      <>
                        <Loader2 size={15} className="animate-spin" />
                        <span>Buscando...</span>
                      </>
                    ) : (
                      <>
                        <Search size={15} />
                        <span>Buscar no IGDB</span>
                      </>
                    )}
                  </button>
                </div>

                {/* Bulk & Count Bar (when results exist) */}
                {gameCandidates.length > 0 && (
                  <div className="flex flex-wrap items-center justify-between gap-2 shrink-0 px-1">
                    <span className="text-xs text-zinc-400 font-mono">
                      {gameCandidates.length} {gameCandidates.length === 1 ? "resultado encontrado" : "resultados encontrados"}
                    </span>

                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={toggleSelectAllBulkCandidates}
                        className="px-2.5 py-1 rounded-lg bg-zinc-900 border border-zinc-800 hover:border-zinc-700 text-xs font-semibold text-zinc-300 hover:text-white transition-all cursor-pointer flex items-center gap-1.5"
                      >
                        {selectedBulkCandidateIds.length === gameCandidates.length && gameCandidates.length > 0 ? (
                          <>
                            <CheckSquare size={13} className="text-cyan-400" />
                            <span>Desmarcar Todos</span>
                          </>
                        ) : (
                          <>
                            <Square size={13} className="text-zinc-500" />
                            <span>Selecionar Todos</span>
                          </>
                        )}
                      </button>

                      {selectedBulkCandidateIds.length > 0 && (
                        <button
                          type="button"
                          onClick={handleExecuteBulkImport}
                          disabled={isBulkImporting}
                          className="px-3 py-1 rounded-lg bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white text-xs font-bold shadow-lg shadow-emerald-900/30 transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                        >
                          {isBulkImporting ? (
                            <>
                              <Loader2 size={12} className="animate-spin" />
                              <span>Importando...</span>
                            </>
                          ) : (
                            <>
                              <PackagePlus size={13} />
                              <span>Importar {selectedBulkCandidateIds.length} em Lote</span>
                            </>
                          )}
                        </button>
                      )}
                    </div>
                  </div>
                )}

                {/* Results list */}
                <div className="flex-1 overflow-y-auto pr-1 min-h-[220px] custom-scrollbar">
                  {isFetchingIgdb ? (
                    <div className="h-full flex flex-col items-center justify-center p-8 text-center">
                      <Loader2 size={32} className="animate-spin text-emerald-400 mb-3" />
                      <p className="text-sm font-semibold text-zinc-200">Consultando catálogo oficial do IGDB...</p>
                      <p className="text-xs text-zinc-500 mt-1">Buscando metadados, capas em alta resolução, gêneros e plataformas.</p>
                    </div>
                  ) : gameCandidates.length === 0 ? (
                    <div className="h-full flex flex-col items-center justify-center p-8 text-center bg-zinc-900/20 border border-dashed border-zinc-800 rounded-2xl">
                      <Globe size={36} className="text-zinc-600 mb-3" />
                      <p className="text-sm font-semibold text-zinc-300">
                        {hasSearchedIgdb ? "Nenhum jogo encontrado no IGDB" : "Pronto para buscar no IGDB"}
                      </p>
                      <p className="text-xs text-zinc-500 max-w-md mt-1">
                        {hasSearchedIgdb
                          ? "Tente digitar o nome original em inglês ou uma palavra-chave da franquia no campo acima."
                          : "Digite o nome de qualquer jogo no campo de busca acima e clique em 'Buscar no IGDB'. Você poderá comparar e escolher seletivamente o que importar."}
                      </p>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5 pb-2">
                      {gameCandidates.map((cand, idx) => {
                        const isSelected = selectedBulkCandidateIds.includes(cand.id);
                        return (
                          <div
                            key={cand.id || idx}
                            className={`w-full group flex flex-col min-[520px]:flex-row gap-3 p-3.5 rounded-2xl border transition-all ${
                              isSelected
                                ? "bg-cyan-950/25 border-cyan-500/60 shadow-lg shadow-cyan-950/30"
                                : "bg-zinc-900/40 border-zinc-850 hover:border-zinc-700 hover:bg-zinc-900/70"
                            }`}
                          >
                            {/* Checkbox for bulk import + Cover */}
                            <div className="flex items-center gap-2.5 shrink-0">
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  toggleBulkCandidateSelection(cand.id);
                                }}
                                className="p-1 rounded-lg hover:bg-zinc-800 text-zinc-400 hover:text-cyan-400 transition-colors cursor-pointer"
                                title={isSelected ? "Desmarcar para importação em lote" : "Selecionar para importação em lote"}
                              >
                                {isSelected ? (
                                  <CheckSquare size={18} className="text-cyan-400" />
                                ) : (
                                  <Square size={18} className="text-zinc-600" />
                                )}
                              </button>

                              <div className="w-16 h-24 bg-black rounded-xl overflow-hidden border border-zinc-800 shrink-0">
                                <img
                                  src={cand.coverHdUrl || cand.coverUrl || "https://images.unsplash.com/photo-1538481199705-c710c4e965fc?auto=format&fit=crop&q=80&w=150"}
                                  alt={cand.name}
                                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                                  referrerPolicy="no-referrer"
                                  onError={(e) => {
                                    (e.target as HTMLImageElement).src = `https://placehold.co/150x225/0c0a0f/ffffff?text=${encodeURIComponent(cand.name)}`;
                                  }}
                                />
                              </div>
                            </div>

                            {/* Info */}
                            <div className="flex-1 min-w-0 flex flex-col justify-between py-0.5 space-y-1">
                              <div>
                                <div className="flex flex-wrap items-center gap-1.5">
                                  <h5 className="text-xs sm:text-sm font-black text-white group-hover:text-cyan-400 transition-colors line-clamp-1">
                                    {cand.name}
                                  </h5>
                                  {cand.source === "igdb" && (
                                    <span className="text-[9px] font-bold text-emerald-400 bg-emerald-950/60 border border-emerald-500/30 px-1.5 py-0.2 rounded shrink-0">
                                      IGDB Oficial
                                    </span>
                                  )}
                                  {(cand.rating !== undefined || cand.aggregatedRating !== undefined) && (
                                    <span className="text-[9px] font-mono font-bold text-amber-400 bg-amber-950/40 border border-amber-500/30 px-1.5 py-0.2 rounded shrink-0">
                                      ★ {cand.rating ? Math.round(cand.rating) : Math.round(cand.aggregatedRating)}%
                                    </span>
                                  )}
                                </div>

                                {cand.releaseDate && (
                                  <span className="text-[10px] font-mono text-zinc-400 block mt-0.5">
                                    Lançamento: {cand.releaseDate.split("-")[0] || cand.releaseDate}
                                  </span>
                                )}
                                {(cand.developer || cand.publisher) && (
                                  <span className="text-[10px] text-zinc-500 block mt-0.5 line-clamp-1">
                                    {cand.developer ? `Dev: ${cand.developer}` : ""} {cand.publisher ? `| Pub: ${cand.publisher}` : ""}
                                  </span>
                                )}

                                {cand.genres && cand.genres.length > 0 && (
                                  <div className="flex flex-wrap gap-1 mt-1">
                                    {cand.genres.slice(0, 2).map((g: string) => (
                                      <span key={g} className="text-[9px] font-medium px-1.5 py-0.5 rounded bg-zinc-800/80 text-zinc-300 border border-zinc-750 truncate max-w-[110px]">
                                        {g}
                                      </span>
                                    ))}
                                  </div>
                                )}
                              </div>

                              {cand.platforms && cand.platforms.length > 0 && (
                                <div className="flex flex-wrap gap-1 mt-1">
                                  {cand.platforms.slice(0, 3).map((plat: string) => (
                                    <span key={plat} className="text-[8px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded-md bg-zinc-800 border border-zinc-750 text-zinc-300">
                                      {plat}
                                    </span>
                                  ))}
                                  {cand.platforms.length > 3 && (
                                    <span className="text-[8px] font-mono text-zinc-500">
                                      +{cand.platforms.length - 3}
                                    </span>
                                  )}
                                </div>
                              )}
                            </div>

                            {/* Actions for this specific candidate */}
                            <div className="flex min-[520px]:flex-col justify-center gap-1.5 shrink-0 border-t min-[520px]:border-t-0 min-[520px]:border-l border-zinc-800/60 pt-2 min-[520px]:pt-0 min-[520px]:pl-2.5">
                              <button
                                type="button"
                                onClick={() => openMetadataPreview(cand)}
                                className="flex-1 min-[520px]:flex-none px-2.5 py-1.5 rounded-xl bg-cyan-950/70 hover:bg-cyan-900 border border-cyan-500/40 text-cyan-300 text-[11px] font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer shadow-sm hover:shadow-cyan-500/20 whitespace-nowrap"
                                title="Visualizar e comparar os metadados campo a campo antes de aplicar (você pode manter o título do seu site)"
                              >
                                <Eye size={12} />
                                <span>Comparar</span>
                              </button>

                              <button
                                type="button"
                                onClick={() => applyCandidateDirectly(cand)}
                                className="flex-1 min-[520px]:flex-none px-2.5 py-1.5 rounded-xl bg-zinc-850 hover:bg-zinc-800 border border-zinc-750 text-zinc-300 hover:text-white text-[11px] font-semibold transition-all flex items-center justify-center gap-1.5 cursor-pointer whitespace-nowrap"
                                title="Importar todos os dados oficiais deste jogo diretamente"
                              >
                                <ArrowRight size={12} />
                                <span>Aplicar</span>
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>

                <div className="flex flex-col sm:flex-row justify-between items-center gap-3 pt-3 border-t border-zinc-900 shrink-0">
                  <p className="text-[11px] text-zinc-500">
                    Clique em <strong className="text-cyan-400">Comparar & Importar</strong> para escolher quais campos deseja atualizar (título, capa, plataformas, etc).
                  </p>
                  <button
                    type="button"
                    onClick={() => setIsSelectingCandidate(false)}
                    className="px-4 py-2 rounded-xl bg-zinc-900 border border-zinc-800 text-xs font-bold text-zinc-300 hover:text-white hover:bg-zinc-800 transition-all cursor-pointer shrink-0"
                  >
                    Voltar ao Formulário
                  </button>
                </div>
              </div>
            )}

            <div
              ref={scrollContainerRef}
              onScroll={handleScrollModal}
              className="flex-1 overflow-y-auto custom-scrollbar p-4 sm:p-6"
            >
              <form id="game-form" onSubmit={handleSubmit} className="space-y-5">
                {/* Controles Globais de Expansão/Colapso dos Blocos */}
                <div className="flex items-center justify-between p-3.5 rounded-2xl bg-zinc-900/80 border border-zinc-800">
                  <span className="text-xs text-zinc-300 font-mono font-semibold">
                    📂 Blocos do formulário (iniciam colapsados):
                  </span>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        setOpenBlocks({
                          basic: true,
                          status: true,
                          platform: true,
                          playtime: true,
                          dates: true,
                          trophies: true,
                          replay: true,
                          icon: true,
                          cover: true,
                          proscons: true,
                          genres: true,
                          tags: true,
                          hltb: true,
                          metacritic: true,
                          steam: true,
                        });
                      }}
                      className="text-[11px] font-bold text-cyan-400 hover:text-cyan-300 px-3 py-1.5 bg-cyan-950/60 border border-cyan-500/40 rounded-xl transition-all cursor-pointer"
                    >
                      Expandir Todos
                    </button>
                    <button
                      type="button"
                      onClick={() => setOpenBlocks({})}
                      className="text-[11px] font-bold text-zinc-400 hover:text-zinc-200 px-3 py-1.5 bg-zinc-950 border border-zinc-800 rounded-xl transition-all cursor-pointer"
                    >
                      Recolher Todos
                    </button>
                  </div>
                </div>

                {/* Grid de 2 Colunas para Agrupamento Compacto dos Blocos */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 items-start">
                  {/* COLUNA 1: Identificação, Cronologia, Progresso & Ícone */}
                  <div className="space-y-4.5">
                    {/* Bloco 1: Informações Básicas & GaaS */}
                    <div id="block-basic" className={`scroll-mt-28 bg-zinc-950/80 p-4.5 rounded-2xl transition-all ${getCategoryBorderClass("basic", !!openBlocks["basic"])}`}>
                <div
                  onClick={() => toggleBlock("basic")}
                  className="flex items-center justify-between cursor-pointer select-none pb-2 border-b border-cyan-500/30"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <Gamepad2 size={16} className="text-cyan-400 shrink-0" />
                    <h4 className="text-xs font-bold text-cyan-300 uppercase tracking-wider font-mono shrink-0">
                      Informações Básicas
                    </h4>
                    {!openBlocks["basic"] && (
                      <span className="text-xs text-zinc-400 font-normal truncate">
                        — {name || "Sem título"} {isGaaS ? "(GaaS)" : ""}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-1.5 sm:gap-2 shrink-0" onClick={(e) => e.stopPropagation()}>
                    {/* IGDB Procurar Quick Button */}
                    <button
                      type="button"
                      onClick={() => handleOpenIgdbSearch(name)}
                      disabled={isFetchingIgdb}
                      className={`text-xs font-bold text-emerald-400 flex items-center gap-1.5 hover:text-emerald-300 px-2.5 py-1 rounded-lg bg-emerald-950/40 border border-emerald-500/30 hover:bg-emerald-900/40 transition-all cursor-pointer ${
                        isFetchingIgdb ? "opacity-50 cursor-not-allowed" : ""
                      }`}
                      title="Procurar jogo no IGDB para comparar e importar metadados, plataformas, sinopse e capa"
                    >
                      {isFetchingIgdb ? (
                        <>
                          <Loader2 size={12} className="animate-spin text-emerald-400" />
                          <span>Buscando IGDB...</span>
                        </>
                      ) : (
                        <>
                          <Search size={12} className="text-emerald-400" />
                          <span>Procurar no IGDB</span>
                        </>
                      )}
                    </button>

                    <button
                      type="button"
                      onClick={() => toggleBlock("basic")}
                      className="p-1 rounded-lg text-cyan-400 hover:text-white transition-colors cursor-pointer"
                    >
                      {openBlocks["basic"] ? <ChevronDown size={18} /> : <ChevronRight size={18} />}
                    </button>
                  </div>
                </div>

                {openBlocks["basic"] && (
                  <div className="pt-4 space-y-4">
                    <div>
                      <div className="flex justify-between items-center mb-1.5">
                        <label className="block text-xs font-bold text-zinc-300 uppercase tracking-widest">
                          Título do Jogo *
                        </label>
                      </div>
                      <input
                        type="text"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        required
                        placeholder="Ex: Metroid Dread"
                        className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:ring-2 focus:ring-cyan-500"
                      />
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-xs font-bold text-zinc-300 uppercase tracking-widest mb-1.5">
                          Série / Saga
                        </label>
                        <input
                          type="text"
                          value={series}
                          onChange={(e) => setSeries(e.target.value)}
                          placeholder="Ex: Metroid"
                          className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:ring-2 focus:ring-cyan-500"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-bold text-zinc-300 uppercase tracking-widest mb-1.5">
                          Publicadora
                        </label>
                        <input
                          type="text"
                          value={publisher}
                          onChange={(e) => setPublisher(e.target.value)}
                          placeholder="Ex: Nintendo"
                          className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:ring-2 focus:ring-cyan-500"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-zinc-300 uppercase tracking-widest mb-1.5">
                        Estúdio/Developer
                      </label>
                      <input
                        type="text"
                        value={studio}
                        onChange={(e) => setStudio(e.target.value)}
                        placeholder="Ex: Retro Studios / MercurySteam"
                        className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:ring-2 focus:ring-cyan-500"
                      />
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                      <div>
                        <label className="block text-xs font-bold text-zinc-300 uppercase tracking-widest mb-1.5">
                          Nota Pessoal (0-5)
                        </label>
                        <input
                          type="number"
                          min="0"
                          max="5"
                          step="0.5"
                          value={rating}
                          onChange={(e) => setRating(parseFloat(e.target.value) || 0)}
                          className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:ring-2 focus:ring-cyan-500 font-mono"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-bold text-emerald-400 uppercase tracking-widest mb-1.5 flex items-center gap-1">
                          <DollarSign size={13} className="text-emerald-400 shrink-0" />
                          <span>Valor Pago (R$)</span>
                        </label>
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          placeholder="Ex: 149.90"
                          value={pricePaid}
                          onChange={(e) => setPricePaid(e.target.value)}
                          className="w-full bg-zinc-900 border border-zinc-800 focus:border-emerald-500/50 rounded-xl px-4 py-2.5 text-sm text-emerald-300 focus:outline-none focus:ring-2 focus:ring-emerald-500 font-mono"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-bold text-zinc-300 uppercase tracking-widest mb-1.5">
                          Lançamento
                        </label>
                        <input
                          type="date"
                          value={releaseDate}
                          onChange={(e) => setReleaseDate(e.target.value)}
                          className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:ring-2 focus:ring-cyan-500 font-mono"
                        />
                      </div>
                    </div>

                    {/* Marcador GaaS Integrado */}
                    <div className="pt-2 border-t border-zinc-800/80 flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-pink-950/20 border border-pink-500/30 rounded-xl p-3">
                      <div className="flex items-start sm:items-center gap-2.5">
                        <InfinityIcon size={18} className="text-pink-400 shrink-0 mt-0.5 sm:mt-0" />
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-bold uppercase tracking-wider text-pink-200 font-mono">
                              Game as a Service (GaaS)
                            </span>
                            {isGaaS && (
                              <span className="px-2 py-0.5 rounded-full bg-pink-950 text-pink-300 border border-pink-500/40 text-[10px] font-mono font-bold">
                                Ativo
                              </span>
                            )}
                          </div>
                          <p className="text-[11px] text-zinc-400 mt-0.5">
                            Jogos com conteúdo contínuo (MMO, Gacha, Live-service). Não afeta taxas de 100% de conclusão.
                          </p>
                        </div>
                      </div>

                      <label className="flex items-center gap-2 cursor-pointer select-none bg-zinc-900 hover:bg-zinc-850 px-3.5 py-1.5 rounded-xl border border-zinc-800 transition-colors shrink-0 self-start sm:self-auto" onClick={(e) => e.stopPropagation()}>
                        <input
                          type="checkbox"
                          checked={isGaaS}
                          onChange={(e) => setIsGaaS(e.target.checked)}
                          className="rounded border-zinc-800 bg-zinc-950 text-pink-500 focus:ring-pink-500 h-4 w-4 accent-pink-500"
                        />
                        <span className="text-xs font-bold uppercase tracking-wider text-pink-300 font-mono">
                          Marcar como GaaS
                        </span>
                      </label>
                    </div>
                  </div>
                )}
              </div>

              {/* Categoria de Progresso & DLC */}
              <div id="block-status" className={`scroll-mt-28 bg-zinc-950/80 p-4.5 rounded-2xl transition-all ${getCategoryBorderClass("status", !!openBlocks["status"])}`}>
                <div
                  onClick={() => toggleBlock("status")}
                  className="flex items-center justify-between cursor-pointer select-none pb-2 border-b border-emerald-500/30"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <CheckCircle size={16} className="text-emerald-400 shrink-0" />
                    <h4 className="text-xs font-bold text-emerald-300 uppercase tracking-wider font-mono shrink-0">
                      Categoria de Progresso & Expansões *
                    </h4>
                    {!openBlocks["status"] && selectedStatus.length > 0 && (
                      <span className="text-xs text-emerald-400 font-mono font-bold truncate">
                        — {selectedStatus.join(", ")} {dlcMode !== "none" ? `(${dlcMode})` : ""}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      type="button"
                      onClick={() => toggleBlock("status")}
                      className="p-1 rounded-lg text-emerald-400 hover:text-white transition-colors cursor-pointer"
                    >
                      {openBlocks["status"] ? <ChevronDown size={18} /> : <ChevronRight size={18} />}
                    </button>
                  </div>
                </div>

                {openBlocks["status"] && (
                  <div className="pt-4 space-y-3">
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 bg-zinc-900 border border-zinc-800 rounded-2xl p-4">
                      {["Jogando", "Em Hiatus", "Terminado", "Backlog", "Desistido"].map((status) => (
                        <label key={status} className="flex items-center gap-2 text-sm text-zinc-300 cursor-pointer select-none">
                          <input
                            type="checkbox"
                            checked={selectedStatus.includes(status)}
                            onChange={() => toggleStatus(status)}
                            className="rounded border-zinc-800 bg-zinc-950 text-emerald-500 focus:ring-emerald-500 h-4 w-4 accent-emerald-500"
                          />
                          {status}
                        </label>
                      ))}
                    </div>
                    <div className="mt-3 px-1 pt-2 border-t border-zinc-800/60">
                      <div className="w-full">
                        <span className="block font-bold text-xs uppercase tracking-wider text-amber-300 mb-1.5 flex items-center gap-1.5">
                          <Layers size={13} className="stroke-[2.5]" />
                          Marcador de DLC / Expansão
                        </span>
                        <div className="grid grid-cols-3 gap-1.5 bg-zinc-950 p-1 rounded-xl border border-zinc-800">
                          <button
                            type="button"
                            onClick={() => setDlcMode("none")}
                            className={`py-1.5 px-2 rounded-lg text-[11px] font-extrabold transition-all cursor-pointer ${
                              dlcMode === "none"
                                ? "bg-zinc-800 text-white shadow"
                                : "text-zinc-500 hover:text-zinc-300"
                            }`}
                          >
                            Nenhum
                          </button>
                          <button
                            type="button"
                            onClick={() => setDlcMode("dlc")}
                            className={`py-1.5 px-2 rounded-lg text-[11px] font-extrabold flex items-center justify-center gap-1 transition-all cursor-pointer ${
                              dlcMode === "dlc"
                                ? "bg-amber-950 text-amber-300 border border-amber-500/50 shadow"
                                : "text-zinc-500 hover:text-amber-300"
                            }`}
                            title="Apenas a Expansão / DLC"
                          >
                            <Layers size={11} />
                            DLC
                          </button>
                          <button
                            type="button"
                            onClick={() => setDlcMode("plus_dlc")}
                            className={`py-1.5 px-2 rounded-lg text-[11px] font-extrabold flex items-center justify-center gap-1 transition-all cursor-pointer ${
                              dlcMode === "plus_dlc"
                                ? "bg-amber-950 text-amber-300 border border-amber-500/50 shadow"
                                : "text-zinc-500 hover:text-amber-300"
                            }`}
                            title="Jogo Base + Conteúdo DLC"
                          >
                            <Layers size={11} />
                            +DLC
                          </button>
                        </div>
                        <p className="text-[10px] text-zinc-500 italic mt-1 font-sans">
                          {dlcMode === "none" && "Jogo padrão sem marcador adicional"}
                          {dlcMode === "dlc" && "Indica que este item é uma Expansão / DLC individual"}
                          {dlcMode === "plus_dlc" && "Indica que a jogada conta o Jogo Base + DLC"}
                        </p>

                        {dlcMode !== "none" && (
                          <div className="mt-3 animate-fade-in">
                            <label className="block text-[10px] uppercase tracking-wider text-amber-300 font-bold mb-1">
                              Nome das DLCs / Expansões Jogadas
                            </label>
                            <input
                              type="text"
                              value={dlcNames}
                              onChange={(e) => setDlcNames(e.target.value)}
                              placeholder="Ex: Shadow of the Erdtree [100% Zerada]; Blood and Wine [Terminada no PS5]"
                              className="w-full px-3 py-2 rounded-xl bg-zinc-950 border border-amber-900/40 text-amber-200 placeholder-zinc-600 outline-none focus:ring-2 focus:ring-amber-500 text-xs"
                            />
                            <p className="text-[10px] text-zinc-500 italic mt-1">
                              Separe nomes por ponto e vírgula ( ; ). Use colchetes <code className="text-amber-400 font-mono font-bold">[ ]</code> para contextualizar no tooltip!
                            </p>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Plataforma e Dificuldade */}
              <div id="block-platform" className={`scroll-mt-28 bg-zinc-950/80 p-4.5 rounded-2xl transition-all ${getCategoryBorderClass("platform", !!openBlocks["platform"])}`}>
                <div
                  onClick={() => toggleBlock("platform")}
                  className="flex items-center justify-between cursor-pointer select-none pb-2 border-b border-indigo-500/30"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <Monitor size={16} className="text-indigo-400 shrink-0" />
                    <h4 className="text-xs font-bold text-indigo-300 uppercase tracking-wider font-mono shrink-0">
                      Plataformas e Dificuldade
                    </h4>
                    {!openBlocks["platform"] && (platform || availablePlatforms.length > 0 || difficulty) && (
                      <span className="text-xs text-indigo-400 font-mono font-bold truncate">
                        — {platform || "Sem escolha"} {availablePlatforms.length > 0 ? `(${availablePlatforms.length} disp.)` : ""} {difficulty ? `| ${difficulty}` : ""}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      type="button"
                      onClick={() => toggleBlock("platform")}
                      className="p-1 rounded-lg text-indigo-400 hover:text-white transition-colors cursor-pointer"
                    >
                      {openBlocks["platform"] ? <ChevronDown size={18} /> : <ChevronRight size={18} />}
                    </button>
                  </div>
                </div>

                {openBlocks["platform"] && (
                  <div className="pt-4 space-y-5">
                    {/* Linha superior: Plataforma de Escolha e Dificuldade */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {/* Plataforma de Escolha (onde joguei) */}
                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <label className="block text-xs font-bold text-indigo-300 uppercase tracking-widest flex items-center gap-1.5 font-mono">
                            <Gamepad2 size={14} className="text-indigo-400" />
                            <span>Plataforma de Escolha *</span>
                          </label>
                          {platform && (
                            <span className="text-[10px] text-zinc-400 font-semibold">
                              Exibida no Card
                            </span>
                          )}
                        </div>

                        <input
                          type="text"
                          value={platform}
                          onChange={(e) => setPlatform(e.target.value)}
                          placeholder="Ex: PC, Nintendo Switch [OLED], PS5"
                          className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                        />

                        {/* Quick Presets for Plataforma de Escolha */}
                        <div className="flex flex-wrap items-center gap-1.5 pt-1">
                          <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider mr-1">
                            {availablePlatforms.length > 0 ? "Das Disponíveis:" : "Rápido:"}
                          </span>
                          {(availablePlatforms.length > 0
                            ? availablePlatforms
                            : ["PC", "PlayStation 5", "PlayStation 4", "Xbox Series X/S", "Xbox One", "Nintendo Switch", "Steam Deck", "Mobile"]
                          ).map((plat) => {
                            const isCurrent = platform.trim().toLowerCase() === plat.toLowerCase();
                            return (
                              <button
                                key={`quick-plat-${plat}`}
                                type="button"
                                onClick={() => setPlatform(plat)}
                                className={`text-[11px] font-semibold px-2 py-0.5 rounded-lg border transition-all cursor-pointer ${
                                  isCurrent
                                    ? "bg-indigo-600/40 text-indigo-200 border-indigo-500/60 shadow-sm"
                                    : "bg-zinc-900/90 text-zinc-400 border-zinc-800 hover:text-zinc-200 hover:bg-zinc-850"
                                }`}
                              >
                                {plat}
                              </button>
                            );
                          })}
                        </div>

                        <p className="text-[10px] text-zinc-500">
                          Use colchetes <code className="text-indigo-400 font-mono font-bold">[ ]</code> para notas de contexto (ex: <code>Nintendo Switch [Docked]</code>).
                        </p>
                      </div>

                      {/* Dificuldade */}
                      <div className="space-y-2">
                        <label className="block text-xs font-bold text-zinc-300 uppercase tracking-widest font-mono">
                          Dificuldade
                        </label>
                        <input
                          type="text"
                          value={difficulty}
                          onChange={(e) => setDifficulty(e.target.value)}
                          placeholder="Ex: Hard [Sem Checklist], Marcha da Morte"
                          className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                        />

                        {/* Quick Presets for Dificuldade */}
                        <div className="flex flex-wrap items-center gap-1.5 pt-1">
                          <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider mr-1">Exemplos:</span>
                          {["Fácil", "Normal", "Difícil", "Muito Difícil", "Pesadelo"].map((diff) => (
                            <button
                              key={`quick-diff-${diff}`}
                              type="button"
                              onClick={() => setDifficulty(diff)}
                              className="text-[11px] font-semibold px-2 py-0.5 rounded-lg border border-zinc-800 bg-zinc-900/90 text-zinc-400 hover:text-zinc-200 hover:bg-zinc-850 transition-all cursor-pointer"
                            >
                              {diff}
                            </button>
                          ))}
                        </div>

                        <p className="text-[10px] text-zinc-500">
                          Use colchetes <code className="text-indigo-400 font-mono font-bold">[ ]</code> para contextualizar no tooltip!
                        </p>
                      </div>
                    </div>

                    {/* Plataformas Disponíveis (Ficha Técnica) */}
                    <div className="pt-3 border-t border-zinc-800/80 space-y-3">
                      <div className="flex items-center justify-between">
                        <div>
                          <label className="block text-xs font-bold text-cyan-300 uppercase tracking-widest flex items-center gap-1.5 font-mono">
                            <Monitor size={14} className="text-cyan-400" />
                            <span>Plataformas Disponíveis (Ficha Técnica)</span>
                          </label>
                          <p className="text-[11px] text-zinc-400 mt-0.5">
                            Lista onde este jogo foi lançado ou está disponível (preenchido automaticamente pelo IGDB/IA).
                          </p>
                        </div>

                        <button
                          type="button"
                          onClick={() => setShowNewAvailablePlatform(!showNewAvailablePlatform)}
                          className="text-[10px] uppercase tracking-[0.2em] text-cyan-400 font-extrabold hover:underline cursor-pointer flex items-center gap-1 shrink-0"
                        >
                          <Plus size={12} />
                          <span>Outra Plataforma</span>
                        </button>
                      </div>

                      {showNewAvailablePlatform && (
                        <div className="flex gap-2">
                          <input
                            type="text"
                            value={newAvailablePlatformVal}
                            onChange={(e) => setNewAvailablePlatformVal(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === "Enter") {
                                e.preventDefault();
                                addCustomAvailablePlatform();
                              }
                            }}
                            placeholder="Nome da plataforma (ex: PlayStation 2, Dreamcast, Atari)..."
                            className="flex-1 px-3 py-2 rounded-xl bg-zinc-900 border border-zinc-800 text-white outline-none focus:ring-2 focus:ring-cyan-500 text-sm"
                          />
                          <button
                            type="button"
                            onClick={addCustomAvailablePlatform}
                            className="px-4 py-2 rounded-xl bg-cyan-600 text-white font-bold text-xs hover:bg-cyan-500 transition-colors cursor-pointer"
                          >
                            Adicionar
                          </button>
                        </div>
                      )}

                      {/* Lista de Plataformas Disponíveis Selecionadas / Rápidas */}
                      <div className="flex flex-wrap gap-1.5 p-3 rounded-2xl bg-zinc-900/90 border border-zinc-800">
                        {[
                          "PC",
                          "PlayStation 5",
                          "PlayStation 4",
                          "PlayStation 3",
                          "Xbox Series X/S",
                          "Xbox One",
                          "Xbox 360",
                          "Nintendo Switch",
                          "Nintendo 3DS",
                          "Wii U",
                          "iOS",
                          "Android",
                          "macOS",
                          "Linux",
                          ...availablePlatforms.filter((p) => ![
                            "PC",
                            "PlayStation 5",
                            "PlayStation 4",
                            "PlayStation 3",
                            "Xbox Series X/S",
                            "Xbox One",
                            "Xbox 360",
                            "Nintendo Switch",
                            "Nintendo 3DS",
                            "Wii U",
                            "iOS",
                            "Android",
                            "macOS",
                            "Linux"
                          ].includes(p))
                        ].map((plat, idx) => {
                          const isSelected = availablePlatforms.includes(plat);
                          const badgeStyle = getPlatformBadgeStyle(plat);
                          return (
                            <button
                              key={`avail-plat-btn-${plat}-${idx}`}
                              type="button"
                              onClick={() => toggleAvailablePlatform(plat)}
                              className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl text-xs font-bold transition-all cursor-pointer border ${
                                isSelected
                                  ? `${badgeStyle.bg} ${badgeStyle.text} ${badgeStyle.border} shadow-sm`
                                  : "bg-zinc-950 text-zinc-500 border-zinc-800 hover:text-zinc-300 hover:border-zinc-700"
                              }`}
                            >
                              <span>{isSelected ? "✓" : "+"}</span>
                              <span>{plat}</span>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Tempo de Jogo Reformulado (Normais x GaaS) */}
              <div id="block-playtime" className={`scroll-mt-28 bg-zinc-950/80 p-4.5 rounded-2xl transition-all ${getCategoryBorderClass("playtime", !!openBlocks["playtime"])}`}>
                <div
                  onClick={() => toggleBlock("playtime")}
                  className="flex items-center justify-between cursor-pointer select-none pb-2 border-b border-teal-500/30"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <Clock size={16} className="text-teal-400 shrink-0" />
                    <h4 className="text-xs font-bold text-teal-300 uppercase tracking-wider font-mono shrink-0">
                      {isGaaS
                        ? "Horas de Jogo (Game as a Service)"
                        : selectedStatus.includes("Jogando")
                        ? "Horas de Jogo (Em Andamento)"
                        : "Horas de Jogo (Campanha & Extras)"}
                    </h4>
                    {!openBlocks["playtime"] && (playtime || additionalPlaytime) && (
                      <span className="text-xs text-teal-400 font-mono font-bold truncate">
                        — {formatHoursAndMinutes(parsePlaytimeHours(playtime) + parsePlaytimeHours(additionalPlaytime))}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="text-[10px] text-teal-400/80 font-mono hidden sm:inline">
                      {isGaaS ? "Modo GaaS Ativo" : selectedStatus.includes("Jogando") ? "Em Andamento" : "Campanha Concluída/Pausada"}
                    </span>
                    <button
                      type="button"
                      onClick={() => toggleBlock("playtime")}
                      className="p-1 rounded-lg text-teal-400 hover:text-white transition-colors cursor-pointer"
                    >
                      {openBlocks["playtime"] ? <ChevronDown size={18} /> : <ChevronRight size={18} />}
                    </button>
                  </div>
                </div>

                {openBlocks["playtime"] && (
                  <div className="pt-4 space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-xs font-bold text-cyan-300 uppercase tracking-widest mb-1.5 flex items-center justify-between">
                          <span>
                            {isGaaS
                              ? "Tempo Atual (Season / Atividade)"
                              : selectedStatus.includes("Jogando")
                              ? "Tempo Atual (Em Andamento)"
                              : "Tempo Final (Campanha Principal)"}
                          </span>
                          <span className="text-[10px] text-cyan-500/80 font-normal">Campanha/Atividade</span>
                        </label>
                        <input
                          type="text"
                          value={playtime}
                          onChange={(e) => setPlaytime(e.target.value)}
                          placeholder={
                            isGaaS
                              ? "Ex: 42h 15m [Season 3 - Passe de Batalha]"
                              : selectedStatus.includes("Jogando")
                              ? "Ex: 18h 30m [Capítulo 4 - Em andamento]"
                              : "Ex: 24h 15m [Zerado no Hard]"
                          }
                          className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:ring-2 focus:ring-cyan-500 font-mono"
                        />
                        <p className="text-[10px] text-zinc-500 mt-1 font-sans">
                          {isGaaS
                            ? "Tempo investido na Season ou atividade atual. Colchetes [ ] viram tooltip!"
                            : selectedStatus.includes("Jogando")
                            ? "Tempo investido até agora na campanha atual. Ao mudar status p/ Terminado, torna-se Tempo Final da Campanha."
                            : "Tempo investido exclusivamente na campanha principal deste jogo. Colchetes [ ] viram tooltip!"}
                        </p>
                      </div>

                      <div>
                        <label className="block text-xs font-bold text-purple-300 uppercase tracking-widest mb-1.5 flex items-center justify-between">
                          <span>
                            {isGaaS ? "Tempo da Conta (Histórico Acumulado)" : "Tempo Extra (Replays / Pós-jogo / Outras vezes)"}
                          </span>
                          <span className="text-[10px] text-purple-500/80 font-normal">Extra/Conta</span>
                        </label>
                        <input
                          type="text"
                          value={additionalPlaytime}
                          onChange={(e) => setAdditionalPlaytime(e.target.value)}
                          placeholder={
                            isGaaS
                              ? "Ex: 350h [Acumulado desde o lançamento em 2022]"
                              : "Ex: 120h 30m [Replay no New Game+ em 2024]"
                          }
                          className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:ring-2 focus:ring-purple-500 font-mono"
                        />
                        <p className="text-[10px] text-zinc-500 mt-1 font-sans">
                          {isGaaS
                            ? "Horas totais anteriores ou acumuladas na conta do jogo. Colchetes [ ] viram tooltip!"
                            : "Tempo extra investido em replays, DLCs ou outras jogatinas. Colchetes [ ] viram tooltip!"}
                        </p>
                      </div>
                    </div>

                    {/* Helper p/ Replay */}
                    {!isGaaS && parsePlaytimeHours(playtime) > 0 && selectedStatus.includes("Jogando") && (
                      <div className="bg-purple-950/40 p-2.5 rounded-xl border border-purple-500/40 flex items-center justify-between gap-2 flex-wrap">
                        <div className="flex items-center gap-2 text-xs text-purple-200">
                          <RotateCcw size={14} className="text-purple-400 shrink-0" />
                          <span>Rejogando este título? Você pode mover o tempo da campanha anterior para <strong>Tempo Extra</strong>.</span>
                        </div>
                        <button
                          type="button"
                          onClick={() => {
                            const playH = parsePlaytimeHours(playtime);
                            const addH = parsePlaytimeHours(additionalPlaytime);
                            const newAddH = addH + playH;
                            setAdditionalPlaytime(formatHoursAndMinutes(newAddH) + ` [Campanha anterior: ${playtime}]`);
                            setPlaytime("0h");
                          }}
                          className="px-3 py-1.5 rounded-lg bg-purple-600 hover:bg-purple-500 text-white font-extrabold text-[11px] transition-all shadow-md active:scale-95 cursor-pointer flex items-center gap-1.5"
                        >
                          <span>📦 Arquivar {formatHoursAndMinutes(parsePlaytimeHours(playtime))} em Tempo Extra</span>
                        </button>
                      </div>
                    )}

                    <div className="bg-zinc-900/90 p-3 rounded-xl border border-cyan-500/30 flex items-center justify-between gap-3 flex-wrap">
                      <div className="flex items-center gap-2">
                        <Clock size={15} className="text-cyan-400 shrink-0" />
                        <span className="text-xs font-bold text-zinc-300">Tempo Total Investido (Somatório):</span>
                      </div>
                      <div className="flex items-center gap-2 font-mono">
                        <span className="text-xs text-zinc-400">
                          ({formatHoursAndMinutes(parsePlaytimeHours(playtime))} + {formatHoursAndMinutes(parsePlaytimeHours(additionalPlaytime))}) =
                        </span>
                        <strong className="text-sm font-black text-cyan-300 bg-cyan-950/80 px-2.5 py-1 rounded-lg border border-cyan-500/40">
                          {formatHoursAndMinutes(parsePlaytimeHours(playtime) + parsePlaytimeHours(additionalPlaytime))}
                        </strong>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Datas de Jogatina */}
              <div id="block-dates" className={`scroll-mt-28 bg-zinc-950/80 p-4.5 rounded-2xl transition-all ${getCategoryBorderClass("dates", !!openBlocks["dates"])}`}>
                <div
                  onClick={() => toggleBlock("dates")}
                  className="flex items-center justify-between cursor-pointer select-none pb-2 border-b border-sky-500/30"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <Calendar size={16} className="text-sky-400 shrink-0" />
                    <h4 className="text-xs font-bold text-sky-300 uppercase tracking-wider font-mono shrink-0">
                      Datas de Jogatina
                    </h4>
                    {!openBlocks["dates"] && (startDate || endDate) && (
                      <span className="text-xs text-sky-400 font-mono font-bold truncate">
                        — {startDate || "..."} até {endDate || "..."}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      type="button"
                      onClick={() => toggleBlock("dates")}
                      className="p-1 rounded-lg text-sky-400 hover:text-white transition-colors cursor-pointer"
                    >
                      {openBlocks["dates"] ? <ChevronDown size={18} /> : <ChevronRight size={18} />}
                    </button>
                  </div>
                </div>

                {openBlocks["dates"] && (
                  <div className="pt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-bold text-zinc-300 uppercase tracking-widest mb-1.5">
                        Data de Início
                      </label>
                      <input
                        type="date"
                        value={startDate}
                        onChange={(e) => setStartDate(e.target.value)}
                        className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:ring-2 focus:ring-sky-500 font-mono"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-zinc-300 uppercase tracking-widest mb-1.5">
                        Data de Término
                      </label>
                      <input
                        type="date"
                        value={endDate}
                        onChange={(e) => setEndDate(e.target.value)}
                        className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:ring-2 focus:ring-sky-500 font-mono"
                      />
                    </div>
                  </div>
                )}
              </div>

              {/* Seção de Troféus Organizada */}
              <div id="block-trophies" className={`scroll-mt-28 bg-zinc-950/80 p-4.5 rounded-2xl transition-all ${getCategoryBorderClass("trophies", !!openBlocks["trophies"])}`}>
                <div
                  onClick={() => toggleBlock("trophies")}
                  className="flex items-center justify-between cursor-pointer select-none pb-2 border-b border-amber-500/30"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <Trophy size={16} className="text-amber-400 shrink-0" />
                    <h4 className="text-xs font-bold text-amber-300 uppercase tracking-wider font-mono shrink-0">
                      Troféus & Conquistas
                    </h4>
                    {!openBlocks["trophies"] && selectedTrophyItems.length > 0 && (
                      <span className="text-xs text-amber-400 font-mono font-bold truncate">
                        — {selectedTrophyItems.length} troféus (P:{platinumCount} O:{goldCount} P:{silverCount} B:{bronzeCount})
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      type="button"
                      onClick={() => toggleBlock("trophies")}
                      className="p-1 rounded-lg text-amber-400 hover:text-white transition-colors cursor-pointer"
                    >
                      {openBlocks["trophies"] ? <ChevronDown size={18} /> : <ChevronRight size={18} />}
                    </button>
                  </div>
                </div>

                {openBlocks["trophies"] && (
                  <div className="pt-4 space-y-4">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="text-[11px] text-zinc-400">
                        Adicione as conquistas do jogo e registre anotações ou datas individuais.
                      </p>

                      {selectedTrophyItems.length > 0 && (
                        <button
                          type="button"
                          onClick={() => setSelectedTrophyItems([])}
                          className="text-[10px] text-zinc-400 hover:text-rose-400 font-bold uppercase transition-colors cursor-pointer px-2 py-1 rounded-lg bg-zinc-900 border border-zinc-800 hover:border-rose-500/40"
                        >
                          Limpar todos ({selectedTrophyItems.length})
                        </button>
                      )}
                    </div>

                    {/* Seletores / Contadores Rápidos */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5">
                      {/* Bronze Card */}
                      <div className={`p-2.5 rounded-xl border transition-all flex flex-col justify-between gap-2 ${bronzeCount > 0 ? "bg-amber-950/90 border-amber-700/60 shadow-[0_0_10px_rgba(217,119,6,0.2)]" : "bg-zinc-900/80 border-zinc-800/80"}`}>
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-1.5">
                            <Trophy size={14} fill="currentColor" className={bronzeCount > 0 ? "text-amber-600" : "text-zinc-600"} />
                            <span className={`text-xs font-bold ${bronzeCount > 0 ? "text-amber-500" : "text-zinc-400"}`}>Bronze</span>
                          </div>
                          {bronzeCount > 0 && (
                            <span className="px-2 py-0.5 rounded-full bg-amber-950 text-amber-500 font-mono text-[10px] font-extrabold border border-amber-700 shrink-0">
                              x{bronzeCount}
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-1.5 w-full">
                          <button
                            type="button"
                            onClick={() => removeTrophy("bronze")}
                            disabled={bronzeCount === 0}
                            className="w-7 h-7 rounded-lg bg-zinc-800 hover:bg-zinc-700 disabled:opacity-20 text-zinc-300 font-black flex items-center justify-center text-sm cursor-pointer transition-all shrink-0"
                            title="Remover 1 Bronze"
                          >
                            -
                          </button>
                          <button
                            type="button"
                            onClick={() => addTrophy("bronze")}
                            className="flex-1 h-7 rounded-lg bg-amber-950/80 hover:bg-amber-900/90 text-amber-500 border border-amber-700/50 text-xs font-extrabold flex items-center justify-center gap-1 cursor-pointer transition-all min-w-0"
                            title="Adicionar 1 Bronze"
                          >
                            <Plus size={12} className="shrink-0" />
                            <span className="truncate">Bronze</span>
                          </button>
                        </div>
                      </div>

                      {/* Silver Card */}
                      <div className={`p-2.5 rounded-xl border transition-all flex flex-col justify-between gap-2 ${silverCount > 0 ? "bg-slate-900/90 border-slate-500/50 shadow-[0_0_10px_rgba(203,213,225,0.15)]" : "bg-zinc-900/80 border-zinc-800/80"}`}>
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-1.5">
                            <Trophy size={14} fill="currentColor" className={silverCount > 0 ? "text-slate-300" : "text-zinc-600"} />
                            <span className={`text-xs font-bold ${silverCount > 0 ? "text-slate-200" : "text-zinc-400"}`}>Prata</span>
                          </div>
                          {silverCount > 0 && (
                            <span className="px-2 py-0.5 rounded-full bg-slate-800 text-slate-200 font-mono text-[10px] font-extrabold border border-slate-600 shrink-0">
                              x{silverCount}
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-1.5 w-full">
                          <button
                            type="button"
                            onClick={() => removeTrophy("silver")}
                            disabled={silverCount === 0}
                            className="w-7 h-7 rounded-lg bg-zinc-800 hover:bg-zinc-700 disabled:opacity-20 text-zinc-300 font-black flex items-center justify-center text-sm cursor-pointer transition-all shrink-0"
                            title="Remover 1 Prata"
                          >
                            -
                          </button>
                          <button
                            type="button"
                            onClick={() => addTrophy("silver")}
                            className="flex-1 h-7 rounded-lg bg-slate-800/90 hover:bg-slate-700 text-slate-100 border border-slate-500/40 text-xs font-extrabold flex items-center justify-center gap-1 cursor-pointer transition-all min-w-0"
                            title="Adicionar 1 Prata"
                          >
                            <Plus size={12} className="shrink-0" />
                            <span className="truncate">Prata</span>
                          </button>
                        </div>
                      </div>

                      {/* Gold Card */}
                      <div className={`p-2.5 rounded-xl border transition-all flex flex-col justify-between gap-2 ${goldCount > 0 ? "bg-amber-950/80 border-amber-500/60 shadow-[0_0_12px_rgba(251,191,36,0.2)]" : "bg-zinc-900/80 border-zinc-800/80"}`}>
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-1.5">
                            <Trophy size={14} fill="currentColor" className={goldCount > 0 ? "text-amber-400" : "text-zinc-600"} />
                            <span className={`text-xs font-bold ${goldCount > 0 ? "text-amber-300" : "text-zinc-400"}`}>Ouro</span>
                          </div>
                          {goldCount > 0 && (
                            <span className="px-2 py-0.5 rounded-full bg-amber-900 text-amber-300 font-mono text-[10px] font-extrabold border border-amber-500 shrink-0">
                              x{goldCount}
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-1.5 w-full">
                          <button
                            type="button"
                            onClick={() => removeTrophy("gold")}
                            disabled={goldCount === 0}
                            className="w-7 h-7 rounded-lg bg-zinc-800 hover:bg-zinc-700 disabled:opacity-20 text-zinc-300 font-black flex items-center justify-center text-sm cursor-pointer transition-all shrink-0"
                            title="Remover 1 Ouro"
                          >
                            -
                          </button>
                          <button
                            type="button"
                            onClick={() => addTrophy("gold")}
                            className="flex-1 h-7 rounded-lg bg-amber-950 hover:bg-amber-900 text-amber-300 border border-amber-500/50 text-xs font-extrabold flex items-center justify-center gap-1 cursor-pointer transition-all min-w-0"
                            title="Adicionar 1 Ouro"
                          >
                            <Plus size={12} className="shrink-0" />
                            <span className="truncate">Ouro</span>
                          </button>
                        </div>
                      </div>

                      {/* Platinum Card */}
                      <div className={`p-2.5 rounded-xl border transition-all flex flex-col justify-between gap-2 ${platinumCount > 0 ? "bg-cyan-950/90 border-cyan-400/80 shadow-[0_0_14px_rgba(34,211,238,0.25)]" : "bg-zinc-900/80 border-zinc-800/80"}`}>
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-1.5">
                            <Trophy size={14} fill="currentColor" className={platinumCount > 0 ? "text-cyan-200 animate-pulse" : "text-zinc-600"} />
                            <span className={`text-xs font-bold ${platinumCount > 0 ? "text-cyan-100" : "text-zinc-400"}`}>Platina</span>
                          </div>
                          {platinumCount > 0 && (
                            <span className="px-2 py-0.5 rounded-full bg-cyan-900 text-cyan-200 font-mono text-[10px] font-extrabold border border-cyan-400 shrink-0">
                              x{platinumCount}
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-1.5 w-full">
                          <button
                            type="button"
                            onClick={() => removeTrophy("platinum")}
                            disabled={platinumCount === 0}
                            className="w-7 h-7 rounded-lg bg-zinc-800 hover:bg-zinc-700 disabled:opacity-20 text-zinc-300 font-black flex items-center justify-center text-sm cursor-pointer transition-all shrink-0"
                            title="Remover 1 Platina"
                          >
                            -
                          </button>
                          <button
                            type="button"
                            onClick={() => addTrophy("platinum")}
                            className="flex-1 h-7 rounded-lg bg-slate-900 hover:bg-slate-800 text-cyan-100 border border-cyan-400/60 text-xs font-extrabold flex items-center justify-center gap-1 cursor-pointer transition-all min-w-0"
                            title="Adicionar 1 Platina"
                          >
                            <Plus size={12} className="shrink-0" />
                            <span className="truncate">Platina</span>
                          </button>
                        </div>
                      </div>
                    </div>

                    {/* Lista de Troféus com Caixas de Texto */}
                    {selectedTrophyItems.length > 0 ? (
                      <div className="space-y-2 pt-1">
                        <div className="flex items-center justify-between text-[11px] font-bold text-zinc-400 uppercase tracking-wider font-mono">
                          <span>Anotações dos Troféus ({selectedTrophyItems.length})</span>
                          <span className="text-[10px] text-zinc-500 font-normal italic">
                            Aparece no tooltip em mouseover no card/painel
                          </span>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                          {selectedTrophyItems.map((item, idx) => (
                            <div
                              key={idx}
                              className={`p-3 rounded-xl border flex flex-col gap-2 transition-all ${
                                item.type === "platinum"
                                  ? "bg-cyan-950/30 border-cyan-500/40 text-cyan-100"
                                  : item.type === "gold"
                                  ? "bg-amber-950/30 border-amber-500/40 text-amber-100"
                                  : item.type === "silver"
                                  ? "bg-slate-900/50 border-slate-700/50 text-slate-100"
                                  : "bg-amber-950/20 border-amber-700/40 text-amber-200"
                              }`}
                            >
                              <div className="flex items-center justify-between gap-2">
                                <div className="flex items-center gap-2">
                                  <span
                                    className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-lg border text-xs font-bold ${
                                      item.type === "platinum"
                                        ? "bg-cyan-950 border-cyan-400/60 text-cyan-200"
                                        : item.type === "gold"
                                        ? "bg-amber-950 border-amber-500/60 text-amber-300"
                                        : item.type === "silver"
                                        ? "bg-slate-800 border-slate-500/60 text-slate-200"
                                        : "bg-amber-950/80 border-amber-700/60 text-amber-500"
                                    }`}
                                  >
                                    <Trophy size={12} fill="currentColor" />
                                    <span>
                                      {item.type === "platinum"
                                        ? "Platina"
                                        : item.type === "gold"
                                        ? "Ouro"
                                        : item.type === "silver"
                                        ? "Prata"
                                        : "Bronze"}{" "}
                                      #{idx + 1}
                                    </span>
                                  </span>
                                </div>
                                <button
                                  type="button"
                                  onClick={() => removeTrophyIndex(idx)}
                                  className="p-1 text-zinc-400 hover:text-rose-400 font-bold text-xs rounded-lg hover:bg-rose-950/40 transition-colors cursor-pointer"
                                  title="Remover este troféu"
                                >
                                  <X size={14} />
                                </button>
                              </div>

                              <textarea
                                rows={2}
                                value={item.note || ""}
                                onChange={(e) => updateTrophyNote(idx, e.target.value)}
                                placeholder="Escreva a anotação do troféu..."
                                className="w-full bg-zinc-950/90 border border-zinc-800 rounded-xl px-3 py-2 text-xs text-zinc-100 placeholder:text-zinc-600 focus:outline-none focus:border-cyan-500/70 focus:ring-1 focus:ring-cyan-500/30 font-mono leading-relaxed resize-y"
                              />
                            </div>
                          ))}
                        </div>
                      </div>
                    ) : (
                      <div className="p-3 bg-zinc-900/40 border border-zinc-800/60 rounded-xl text-center">
                        <p className="text-xs text-zinc-500 italic">
                          Nenhum troféu adicionado ainda. Clique nos botões acima para incluir Bronze, Prata, Ouro ou Platina.
                        </p>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Bloco: Replay & Re-plays */}
              <div id="block-replay" className={`scroll-mt-28 bg-zinc-950/80 p-4.5 rounded-2xl transition-all ${getCategoryBorderClass("replay", !!openBlocks["replay"])}`}>
                <div
                  onClick={() => toggleBlock("replay")}
                  className="flex items-center justify-between cursor-pointer select-none pb-2 border-b border-purple-500/30"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <RotateCcw size={16} className="text-purple-400 shrink-0" />
                    <h4 className="text-xs font-bold text-purple-200 uppercase tracking-wider font-mono shrink-0">
                      Replay & Re-plays
                    </h4>
                    {replayed && (
                      <span className="px-2 py-0.5 rounded-full bg-purple-900/80 text-purple-200 text-[10px] font-mono border border-purple-500/50 shrink-0">
                        {replayCount || 1}x
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      type="button"
                      onClick={() => toggleBlock("replay")}
                      className="p-1 rounded-lg text-purple-400 hover:text-white transition-colors cursor-pointer"
                    >
                      {openBlocks["replay"] ? <ChevronDown size={18} /> : <ChevronRight size={18} />}
                    </button>
                  </div>
                </div>

                {openBlocks["replay"] && (
                  <div className="pt-4 space-y-3.5">
                    <div className="flex items-center justify-between gap-3">
                      <p className="text-[11px] text-zinc-400">
                        Ative para indicar que jogou este jogo mais de uma vez e adicione observações.
                      </p>
                      <label className="flex items-center gap-2 cursor-pointer select-none bg-zinc-900 hover:bg-zinc-850 px-3.5 py-1.5 rounded-xl border border-zinc-800 transition-colors shrink-0" onClick={(e) => e.stopPropagation()}>
                        <input
                          type="checkbox"
                          checked={replayed}
                          onChange={(e) => {
                            setReplayed(e.target.checked);
                            if (e.target.checked && replayCount === 0) {
                              setReplayCount(1);
                            }
                          }}
                          className="rounded border-zinc-800 bg-zinc-950 text-purple-500 focus:ring-purple-500 h-4 w-4 accent-purple-500"
                        />
                        <span className="text-xs font-bold uppercase tracking-wider text-purple-300">
                          Ativar Replay
                        </span>
                      </label>
                    </div>

                    {replayed ? (
                      <div className="space-y-3 pt-1 animate-fade-in">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-zinc-900/70 p-3 rounded-xl border border-zinc-800/60">
                          <div className="flex items-center gap-2 shrink-0">
                            <span className="text-xs text-purple-300 font-bold uppercase tracking-wider font-mono">
                              Vezes Jogadas:
                            </span>
                            <div className="flex items-center gap-1.5 bg-zinc-950 border border-zinc-800 rounded-xl p-1">
                              <button
                                type="button"
                                onClick={() => setReplayCount(Math.max(1, replayCount - 1))}
                                className="w-7 h-7 rounded-lg bg-zinc-900 text-zinc-300 hover:text-white font-bold text-sm flex items-center justify-center cursor-pointer hover:bg-zinc-800 transition-colors"
                              >
                                -
                              </button>
                              <input
                                type="number"
                                min="1"
                                value={replayCount || 1}
                                onChange={(e) => setReplayCount(Math.max(1, parseInt(e.target.value) || 1))}
                                className="w-12 py-0.5 bg-transparent text-sm text-white font-mono font-bold text-center focus:outline-none"
                              />
                              <button
                                type="button"
                                onClick={() => setReplayCount(replayCount + 1)}
                                className="w-7 h-7 rounded-lg bg-zinc-900 text-zinc-300 hover:text-white font-bold text-sm flex items-center justify-center cursor-pointer hover:bg-zinc-800 transition-colors"
                              >
                                +
                              </button>
                            </div>
                          </div>
                          <p className="text-[11px] text-zinc-400 italic font-sans flex-1">
                            Apenas o ícone <span className="font-mono text-purple-300 font-bold bg-purple-950/60 px-1.5 py-0.5 rounded border border-purple-500/30">[{replayCount || 1}x]</span> continuará visível nos cards, e a anotação vai para o tooltip.
                          </p>
                        </div>

                        <div>
                          <label className="block text-xs font-bold text-purple-300 uppercase tracking-widest mb-1.5 font-mono">
                            Anotação do Replay (Exibida na Tooltip)
                          </label>
                          <textarea
                            rows={2.5}
                            value={replayNote}
                            onChange={(e) => setReplayNote(e.target.value)}
                            placeholder="Ex: 1ª Jogatina no PS4 em 2021; 2ª Jogatina no PS5 em 2026 no New Game+ (Modo Marcha da Morte sem morrer)"
                            className="w-full bg-zinc-900/90 border border-purple-900/40 rounded-xl px-3.5 py-2.5 text-xs text-white placeholder:text-zinc-600 focus:outline-none focus:ring-2 focus:ring-purple-500/60 leading-relaxed font-sans resize-y"
                          />
                        </div>
                      </div>
                    ) : (
                      <div className="p-3 bg-zinc-900/40 border border-zinc-800/60 rounded-xl text-center">
                        <p className="text-xs text-zinc-500 italic">
                          Marque a caixa acima se você jogou este jogo novamente para registrar quantas vezes jogou e suas anotações.
                        </p>
                      </div>
                    )}
                  </div>
                )}
              </div>

                {/* Bloco 8: Ícone do Perfil */}
                <div id="block-icon" className={`scroll-mt-28 bg-zinc-950/80 p-4.5 rounded-2xl transition-all ${getCategoryBorderClass("icon", !!openBlocks["icon"])}`}>
                  <div
                    onClick={() => toggleBlock("icon")}
                    className="flex items-center justify-between cursor-pointer select-none pb-2 border-b border-sky-500/30"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <Smile size={16} className="text-sky-400 shrink-0" />
                      <h4 className="text-xs font-bold text-sky-300 uppercase tracking-wider font-mono shrink-0">
                        Ícone do Perfil
                      </h4>
                      {!openBlocks["icon"] && (iconEmoji || tempUploadedIcon || iconUrl) && (
                        <span className="text-xs text-sky-400 font-mono font-bold truncate">
                          — {iconEmoji || (tempUploadedIcon ? "Arquivo carregado" : "URL")}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-1.5 sm:gap-2 shrink-0" onClick={(e) => e.stopPropagation()}>
                      <button
                        type="button"
                        onClick={() => handleOpenSteamGridGallery(undefined, "icon")}
                        disabled={isLoadingSteamGridMedia}
                        className="text-xs font-bold text-sky-400 hover:text-sky-300 flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-sky-950/50 border border-sky-500/40 hover:bg-sky-900/50 transition-all cursor-pointer shadow-sm"
                        title="Buscar ícones oficiais e da comunidade no SteamGridDB"
                      >
                        <Sparkles size={12} className="text-sky-400" />
                        <span>Ícones SteamGridDB</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => toggleBlock("icon")}
                        className="p-1 rounded-lg text-sky-400 hover:text-white transition-colors cursor-pointer"
                      >
                        {openBlocks["icon"] ? <ChevronDown size={18} /> : <ChevronRight size={18} />}
                      </button>
                    </div>
                  </div>

                  {openBlocks["icon"] && (
                    <div className="pt-4 space-y-3">
                      <div className="flex flex-wrap gap-2 mb-1">
                        <button
                          type="button"
                          onClick={() => setActiveIconTab("emoji")}
                          className={`px-3 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
                            activeIconTab === "emoji" ? "bg-cyan-600 text-white" : "bg-zinc-900 text-zinc-400 border border-zinc-800"
                          }`}
                        >
                          <Smile size={14} /> Emoji
                        </button>
                        <button
                          type="button"
                          onClick={() => setActiveIconTab("upload")}
                          className={`px-3 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
                            activeIconTab === "upload" ? "bg-cyan-600 text-white" : "bg-zinc-900 text-zinc-400 border border-zinc-800"
                          }`}
                        >
                          <Upload size={14} /> Subir Ícone
                        </button>
                        <button
                          type="button"
                          onClick={() => setActiveIconTab("url")}
                          className={`px-3 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
                            activeIconTab === "url" ? "bg-cyan-600 text-white" : "bg-zinc-900 text-zinc-400 border border-zinc-800"
                          }`}
                        >
                          <Globe size={14} /> URL da Web
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setActiveIconTab("steamgriddb");
                            if (quickSteamGridIcons.length === 0) {
                              handleFetchQuickSteamGridIcons(name);
                            }
                          }}
                          className={`px-3 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
                            activeIconTab === "steamgriddb" ? "bg-sky-600 text-white shadow-md shadow-sky-500/20" : "bg-zinc-900 text-sky-400 border border-sky-500/30 hover:border-sky-500/60"
                          }`}
                        >
                          <Sparkles size={14} className={activeIconTab === "steamgriddb" ? "text-white" : "text-sky-400"} /> SteamGridDB
                        </button>
                      </div>

                      {activeIconTab === "emoji" && (
                        <input
                          type="text"
                          value={iconEmoji}
                          onChange={(e) => setIconEmoji(e.target.value)}
                          placeholder="Ex: 👾, 👑, ☄️, 🕹️"
                          className="w-full px-4 py-2.5 rounded-xl bg-zinc-900 border border-zinc-800 focus:outline-none focus:ring-2 focus:ring-cyan-500 text-white text-sm"
                        />
                      )}

                      {activeIconTab === "upload" && (
                        <div 
                          onDragOver={handleIconDragOver}
                          onDragLeave={handleIconDragLeave}
                          onDrop={handleIconDrop}
                          className={`flex flex-col items-center justify-center p-5 rounded-2xl bg-zinc-950 border-2 border-dashed transition-all cursor-pointer relative overflow-hidden ${
                            isDragOverIcon 
                              ? "border-cyan-500 bg-cyan-950/10 scale-[1.01]" 
                              : "border-zinc-800 hover:border-zinc-700 hover:bg-zinc-900/40"
                          }`}
                          onClick={() => {
                            const iconInput = document.getElementById("icon-file-input");
                            if (iconInput) iconInput.click();
                          }}
                        >
                          <input
                            id="icon-file-input"
                            type="file"
                            accept="image/*"
                            disabled={isUploadingIcon}
                            onChange={handleIconUpload}
                            className="hidden"
                          />
                          {isUploadingIcon ? (
                            <div className="flex flex-col items-center gap-2 py-1 text-center">
                              <Loader2 size={20} className="animate-spin text-cyan-400" />
                              <span className="text-xs text-zinc-300 font-medium animate-pulse">Enviando ícone...</span>
                            </div>
                          ) : (
                            <div className="flex flex-col items-center gap-1.5 text-center">
                              <Upload size={18} className="text-purple-400" />
                              <p className="text-xs font-semibold text-zinc-300">
                                Arraste o ícone aqui ou <span className="text-cyan-400 underline decoration-dashed underline-offset-4">escolha um arquivo</span>
                              </p>
                            </div>
                          )}
                          {tempUploadedIcon && !isUploadingIcon && (
                            <div className="absolute right-3 top-3 flex items-center gap-1.5 bg-zinc-900/90 backdrop-blur-sm border border-zinc-800 px-2 py-1 rounded-xl">
                              <img
                                src={tempUploadedIcon}
                                className="w-5 h-5 rounded-md object-cover border border-cyan-500"
                                alt="Icon Preview"
                              />
                              <span className="text-[9px] text-zinc-400 font-bold uppercase tracking-wider">Salvo</span>
                            </div>
                          )}
                        </div>
                      )}

                      {activeIconTab === "url" && (
                        <input
                          type="url"
                          value={iconUrl}
                          onChange={(e) => setIconUrl(e.target.value)}
                          placeholder="https://..."
                          className="w-full px-4 py-2.5 rounded-xl bg-zinc-900 border border-zinc-800 focus:outline-none focus:ring-2 focus:ring-cyan-500 text-white text-sm"
                        />
                      )}

                      {activeIconTab === "steamgriddb" && (
                        <div className="space-y-3 p-3 bg-zinc-900/70 border border-sky-500/30 rounded-2xl">
                          <div className="flex items-center gap-2">
                            <input
                              type="text"
                              value={quickIconsSearchTerm || name}
                              onChange={(e) => setQuickIconsSearchTerm(e.target.value)}
                              placeholder="Pesquisar ícones do jogo no SteamGridDB..."
                              className="flex-1 px-3 py-2 rounded-xl bg-zinc-950 border border-zinc-800 focus:outline-none focus:border-sky-500 text-white text-xs font-medium"
                              onKeyDown={(e) => {
                                if (e.key === "Enter") {
                                  e.preventDefault();
                                  handleFetchQuickSteamGridIcons(quickIconsSearchTerm || name);
                                }
                              }}
                            />
                            <button
                              type="button"
                              onClick={() => handleFetchQuickSteamGridIcons(quickIconsSearchTerm || name)}
                              disabled={isLoadingQuickIcons}
                              className="px-3 py-2 rounded-xl bg-sky-600 hover:bg-sky-500 disabled:opacity-50 text-white text-xs font-bold transition-all flex items-center gap-1 cursor-pointer shrink-0 shadow-sm"
                            >
                              {isLoadingQuickIcons ? <Loader2 size={13} className="animate-spin" /> : <Search size={13} />}
                              <span>Buscar</span>
                            </button>
                          </div>

                          {isLoadingQuickIcons ? (
                            <div className="flex items-center justify-center py-6 gap-2 text-zinc-400 text-xs">
                              <Loader2 size={16} className="animate-spin text-sky-400" />
                              <span>Carregando ícones do SteamGridDB...</span>
                            </div>
                          ) : quickSteamGridIcons.length > 0 ? (
                            <div className="space-y-2">
                              <div className="grid grid-cols-4 sm:grid-cols-6 gap-2.5 max-h-48 overflow-y-auto p-1">
                                {quickSteamGridIcons.map((item) => (
                                  <div
                                    key={item.id}
                                    className="group relative flex flex-col items-center p-2 rounded-xl bg-zinc-950/80 border border-zinc-800 hover:border-sky-500/80 transition-all cursor-pointer"
                                    onClick={() => handleSelectSteamGridMediaAsIcon(item)}
                                    title={`Selecionar ícone (${item.width}x${item.height})`}
                                  >
                                    <div className="w-12 h-12 rounded-lg overflow-hidden bg-zinc-900 border border-zinc-800 flex items-center justify-center relative shadow-inner">
                                      <img
                                        src={item.thumb || item.url}
                                        alt={item.title || "Icon"}
                                        className="w-full h-full object-contain p-1 group-hover:scale-110 transition-transform"
                                        loading="lazy"
                                        referrerPolicy="no-referrer"
                                        onError={(e) => {
                                          (e.target as HTMLImageElement).src = "https://placehold.co/128x128/1e1b4b/38bdf8?text=Icon";
                                        }}
                                      />
                                    </div>
                                    <span className="text-[9px] font-mono text-zinc-400 mt-1">
                                      {item.width}x{item.height}
                                    </span>
                                  </div>
                                ))}
                              </div>

                              <div className="flex items-center justify-between pt-1 border-t border-zinc-800 text-[11px] text-zinc-400">
                                <span>{quickSteamGridIcons.length} ícones encontrados</span>
                                <button
                                  type="button"
                                  onClick={() => handleOpenSteamGridGallery(quickIconsSearchTerm || name, "icon")}
                                  className="text-sky-400 hover:text-sky-300 font-bold hover:underline cursor-pointer flex items-center gap-1"
                                >
                                  <span>Abrir Galeria Completa & Preview</span>
                                  <ArrowRight size={12} />
                                </button>
                              </div>
                            </div>
                          ) : (
                            <div className="flex items-center justify-between py-2 text-zinc-400 text-xs">
                              <span>Busque ícones oficiais e da comunidade no SteamGridDB.</span>
                              <button
                                type="button"
                                onClick={() => handleOpenSteamGridGallery(quickIconsSearchTerm || name, "icon")}
                                className="text-sky-400 hover:text-sky-300 font-bold hover:underline cursor-pointer"
                              >
                                Abrir Galeria Completa
                              </button>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>

              {/* COLUNA 2: Mídias, Avaliações, Metadados & Integrações */}
              <div className="space-y-4.5">
                {/* Bloco 9: Imagem de Capa */}
                <div id="block-cover" className={`scroll-mt-28 bg-zinc-950/80 p-4.5 rounded-2xl transition-all ${getCategoryBorderClass("cover", !!openBlocks["cover"])}`}>
                  <div
                    onClick={() => toggleBlock("cover")}
                    className="flex items-center justify-between cursor-pointer select-none pb-2 border-b border-rose-500/30"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <ImageIcon size={16} className="text-rose-400 shrink-0" />
                      <h4 className="text-xs font-bold text-rose-300 uppercase tracking-wider font-mono shrink-0">
                        Imagem de Capa
                      </h4>
                      {!openBlocks["cover"] && (tempUploadedCover || coverUrl) && (
                        <span className="text-xs text-rose-400 font-mono font-bold truncate">
                          — Capa configurada
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-1.5 sm:gap-2 shrink-0" onClick={(e) => e.stopPropagation()}>
                      <button
                        type="button"
                        onClick={() => handleOpenSteamGridGallery(undefined, "cover")}
                        disabled={isLoadingSteamGridMedia}
                        className="text-xs font-bold text-cyan-400 hover:text-cyan-300 flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-cyan-950/50 border border-cyan-500/40 hover:bg-cyan-900/50 transition-all cursor-pointer shadow-sm"
                        title="Buscar e selecionar capas (grids), heroes panorâmicos e logos no SteamGridDB"
                      >
                        {isLoadingSteamGridMedia ? (
                          <>
                            <Loader2 size={12} className="animate-spin text-cyan-400" />
                            <span>Buscando...</span>
                          </>
                        ) : (
                          <>
                            <ImageIcon size={13} className="text-cyan-400" />
                            <span>Galeria SteamGridDB</span>
                          </>
                        )}
                      </button>
                      <button
                        type="button"
                        onClick={() => toggleBlock("cover")}
                        className="p-1 rounded-lg text-rose-400 hover:text-white transition-colors cursor-pointer"
                      >
                        {openBlocks["cover"] ? <ChevronDown size={18} /> : <ChevronRight size={18} />}
                      </button>
                    </div>
                  </div>

                  {openBlocks["cover"] && (
                    <div className="pt-4 space-y-3">
                      <div className="flex flex-col md:flex-row gap-3">
                        <div className="flex-1">
                          <input
                            type="url"
                            value={coverUrl}
                            onChange={(e) => {
                              setCoverUrl(e.target.value);
                              setTempUploadedCover(""); // clear upload if text changes
                            }}
                            placeholder="https://images.unsplash.com/photo-..."
                            className="w-full px-4 py-3 rounded-2xl bg-zinc-900 border border-zinc-800 focus:outline-none focus:ring-2 focus:ring-rose-500 text-sm text-white mb-2"
                          />
                          <div 
                            onDragOver={handleCoverDragOver}
                            onDragLeave={handleCoverDragLeave}
                            onDrop={handleCoverDrop}
                            className={`flex flex-col items-center justify-center p-5 rounded-2xl bg-zinc-950 border-2 border-dashed transition-all cursor-pointer relative overflow-hidden ${
                              isDragOverCover 
                                ? "border-rose-500 bg-rose-950/10 scale-[1.01]" 
                                : "border-zinc-800 hover:border-zinc-700 hover:bg-zinc-900/40"
                            }`}
                            onClick={() => {
                              const coverInput = document.getElementById("cover-file-input");
                              if (coverInput) coverInput.click();
                            }}
                          >
                            <input
                              id="cover-file-input"
                              type="file"
                              accept="image/*"
                              disabled={isUploadingCover}
                              onChange={handleCoverUpload}
                              className="hidden"
                            />
                            {isUploadingCover ? (
                              <div className="flex flex-col items-center gap-2 py-1 text-center">
                                <Loader2 size={20} className="animate-spin text-rose-400" />
                                <span className="text-xs text-zinc-300 font-medium animate-pulse">Enviando imagem de capa...</span>
                              </div>
                            ) : (
                              <div className="flex flex-col items-center gap-1.5 text-center">
                                <Upload size={18} className="text-rose-400" />
                                <p className="text-xs font-semibold text-zinc-300">
                                  Arraste a capa aqui ou <span className="text-rose-400 underline decoration-dashed underline-offset-4">escolha um arquivo</span>
                                </p>
                                <p className="text-[10px] text-zinc-500 uppercase tracking-widest font-semibold">
                                  Formatos: JPG, PNG, WEBP, GIF
                                </p>
                              </div>
                            )}
                          </div>
                        </div>
                        {(tempUploadedCover || coverUrl) && (
                          <div className="w-28 h-20 rounded-2xl overflow-hidden border border-rose-500/40 shrink-0 bg-black">
                            <img
                              src={tempUploadedCover || coverUrl}
                              className="w-full h-full object-cover"
                              alt="Capa"
                              onError={(e) => {
                                (e.target as HTMLImageElement).src = "https://placehold.co/100x100/040406/ffffff?text=Capa";
                              }}
                            />
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>

                {/* Pros & Cons Inputs */}
                <div id="block-proscons" className={`scroll-mt-28 bg-zinc-950/80 p-4.5 rounded-2xl transition-all ${getCategoryBorderClass("proscons", !!openBlocks["proscons"])}`}>
                <div
                  onClick={() => toggleBlock("proscons")}
                  className="flex items-center justify-between cursor-pointer select-none pb-2 border-b border-emerald-500/30"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <ThumbsUp size={16} className="text-emerald-400 shrink-0" />
                    <h4 className="text-xs font-bold text-emerald-300 uppercase tracking-wider font-mono shrink-0">
                      Prós e Contras
                    </h4>
                    {!openBlocks["proscons"] && (pros || cons) && (
                      <span className="text-xs text-emerald-400 font-mono font-bold truncate">
                        — +{splitEntities(pros).filter(Boolean).length} Prós / -{splitEntities(cons).filter(Boolean).length} Contras
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setShowProsConsModal(true);
                      }}
                      className="px-2.5 sm:px-3 py-1 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-bold text-xs shadow-md shadow-emerald-950/40 flex items-center gap-1.5 transition-all cursor-pointer hover:scale-[1.02] active:scale-[0.98]"
                      title="Abrir editor de prós e contras em tela cheia (90% da tela)"
                    >
                      <Edit3 size={13} />
                      <span>Editar Prós e Contras</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => toggleBlock("proscons")}
                      className="p-1 rounded-lg text-emerald-400 hover:text-white transition-colors cursor-pointer"
                    >
                      {openBlocks["proscons"] ? <ChevronDown size={18} /> : <ChevronRight size={18} />}
                    </button>
                  </div>
                </div>

                {openBlocks["proscons"] && (
                  <div className="pt-4 space-y-4">
                    {/* Big Callout Banner to open 90% wide modal */}
                    <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 p-3.5 rounded-2xl bg-gradient-to-r from-emerald-950/40 via-zinc-900/90 to-rose-950/40 border border-zinc-800 shadow-sm">
                      <div className="flex items-center gap-3">
                        <div className="p-2.5 rounded-xl bg-zinc-900 border border-zinc-700/80 text-emerald-400 shrink-0">
                          <Maximize2 size={18} />
                        </div>
                        <div>
                          <div className="text-xs font-bold text-zinc-200">
                            Editor Amplo de Prós e Contras (90% da Tela)
                          </div>
                          <div className="text-[11px] text-zinc-400">
                            Ambiente espaçoso, fácil de ler, com formulário guiado de tópicos e tooltips interativos.
                          </div>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => setShowProsConsModal(true)}
                        className="w-full sm:w-auto px-4 py-2 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-bold text-xs shadow-lg shadow-emerald-950/50 flex items-center justify-center gap-2 transition-all cursor-pointer hover:scale-[1.02] active:scale-[0.98] shrink-0"
                      >
                        <Edit3 size={14} />
                        <span>Abrir Editor Completo</span>
                      </button>
                    </div>

                    {/* Categorized and Separated Preview of Existing Pros & Cons */}
                    {(pros || cons) && (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-4 rounded-2xl bg-zinc-950/80 border border-zinc-800/90 shadow-sm">
                        {/* Prós Preview Categorizados */}
                        <div className="space-y-2.5">
                          <div className="flex items-center justify-between pb-1.5 border-b border-emerald-500/20">
                            <span className="text-xs uppercase font-bold text-emerald-400 font-mono flex items-center gap-1.5">
                              <ThumbsUp size={13} className="text-emerald-400" />
                              <span>+ Prós Cadastrados</span>
                              <span className="text-[10px] text-emerald-400/70 font-normal">
                                ({splitEntities(pros).filter(Boolean).length})
                              </span>
                            </span>
                            <button
                              type="button"
                              onClick={() => setShowProsConsModal(true)}
                              className="text-[11px] text-emerald-400 hover:text-emerald-300 font-medium flex items-center gap-1 cursor-pointer"
                            >
                              <Edit3 size={11} />
                              <span>Gerenciar</span>
                            </button>
                          </div>

                          {splitEntities(pros).filter(Boolean).length === 0 ? (
                            <p className="text-[11px] text-zinc-500 italic py-1">Nenhum pró cadastrado.</p>
                          ) : (
                            <div className="space-y-2">
                              {splitEntities(pros).filter(Boolean).map((item, idx) => {
                                const { topic, note } = parseProConTopic(item);
                                const cat = detectProConCategory(topic, note);
                                return (
                                  <div
                                    key={idx}
                                    className="p-2.5 rounded-xl bg-emerald-950/20 hover:bg-emerald-950/35 border border-emerald-500/25 transition-all text-xs space-y-1 group"
                                  >
                                    <div className="flex items-center justify-between gap-2">
                                      <div className="flex items-center gap-1.5 min-w-0 flex-wrap">
                                        <span className="text-emerald-400 font-bold shrink-0">+</span>
                                        <span className={`px-1.5 py-0.2 rounded text-[9px] font-mono font-bold border ${cat.bgClass} ${cat.borderClass} ${cat.textClass} shrink-0`}>
                                          {cat.shortName}
                                        </span>
                                        <span className="font-bold text-emerald-200 break-words">{topic}</span>
                                      </div>
                                      <button
                                        type="button"
                                        onClick={() => setShowProsConsModal(true)}
                                        className="opacity-0 group-hover:opacity-100 transition-opacity text-zinc-500 hover:text-emerald-400 p-0.5 cursor-pointer shrink-0"
                                        title="Editar este ponto no modal amplo"
                                      >
                                        <Edit3 size={12} />
                                      </button>
                                    </div>
                                    {note && (
                                      <div
                                        className="flex items-start gap-1 pl-2 text-[11px] text-zinc-400 cursor-help"
                                        data-tooltip={note}
                                        data-tooltip-title={`Pró: ${topic}`}
                                        data-tooltip-theme="emerald"
                                      >
                                        <span className="text-emerald-500/70 font-mono text-[10px] shrink-0 font-bold">↳ tooltip:</span>
                                        <span className="text-zinc-300 italic">{note}</span>
                                      </div>
                                    )}
                                  </div>
                                );
                              })}
                            </div>
                          )}
                        </div>

                        {/* Contras Preview Categorizados */}
                        <div className="space-y-2.5">
                          <div className="flex items-center justify-between pb-1.5 border-b border-rose-500/20">
                            <span className="text-xs uppercase font-bold text-rose-400 font-mono flex items-center gap-1.5">
                              <ThumbsDown size={13} className="text-rose-400" />
                              <span>- Contras Cadastrados</span>
                              <span className="text-[10px] text-rose-400/70 font-normal">
                                ({splitEntities(cons).filter(Boolean).length})
                              </span>
                            </span>
                            <button
                              type="button"
                              onClick={() => setShowProsConsModal(true)}
                              className="text-[11px] text-rose-400 hover:text-rose-300 font-medium flex items-center gap-1 cursor-pointer"
                            >
                              <Edit3 size={11} />
                              <span>Gerenciar</span>
                            </button>
                          </div>

                          {splitEntities(cons).filter(Boolean).length === 0 ? (
                            <p className="text-[11px] text-zinc-500 italic py-1">Nenhum contra cadastrado.</p>
                          ) : (
                            <div className="space-y-2">
                              {splitEntities(cons).filter(Boolean).map((item, idx) => {
                                const { topic, note } = parseProConTopic(item);
                                const cat = detectProConCategory(topic, note);
                                return (
                                  <div
                                    key={idx}
                                    className="p-2.5 rounded-xl bg-rose-950/20 hover:bg-rose-950/35 border border-rose-500/25 transition-all text-xs space-y-1 group"
                                  >
                                    <div className="flex items-center justify-between gap-2">
                                      <div className="flex items-center gap-1.5 min-w-0 flex-wrap">
                                        <span className="text-rose-400 font-bold shrink-0">-</span>
                                        <span className={`px-1.5 py-0.2 rounded text-[9px] font-mono font-bold border ${cat.bgClass} ${cat.borderClass} ${cat.textClass} shrink-0`}>
                                          {cat.shortName}
                                        </span>
                                        <span className="font-bold text-rose-200 break-words">{topic}</span>
                                      </div>
                                      <button
                                        type="button"
                                        onClick={() => setShowProsConsModal(true)}
                                        className="opacity-0 group-hover:opacity-100 transition-opacity text-zinc-500 hover:text-rose-400 p-0.5 cursor-pointer shrink-0"
                                        title="Editar este ponto no modal amplo"
                                      >
                                        <Edit3 size={12} />
                                      </button>
                                    </div>
                                    {note && (
                                      <div
                                        className="flex items-start gap-1 pl-2 text-[11px] text-zinc-400 cursor-help"
                                        data-tooltip={note}
                                        data-tooltip-title={`Contra: ${topic}`}
                                        data-tooltip-theme="rose"
                                      >
                                        <span className="text-rose-500/70 font-mono text-[10px] shrink-0 font-bold">↳ tooltip:</span>
                                        <span className="text-zinc-300 italic">{note}</span>
                                      </div>
                                    )}
                                  </div>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      </div>
                    )}

                    {/* Inline Quick Textareas */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="bg-emerald-950/30 border border-emerald-500/40 rounded-2xl p-4 space-y-2 flex flex-col">
                        <div className="flex items-center justify-between">
                          <label className="text-xs font-bold text-emerald-400 uppercase tracking-widest flex items-center gap-1.5 font-mono">
                            <ThumbsUp size={14} className="text-emerald-400 shrink-0" />
                            <span>+ Prós (Enter ou ';')</span>
                          </label>
                          <button
                            type="button"
                            onClick={() => setShowProsConsModal(true)}
                            className="text-[11px] text-emerald-400 hover:text-emerald-300 font-semibold flex items-center gap-1 cursor-pointer"
                          >
                            <Maximize2 size={11} />
                            <span>Expandir 90%</span>
                          </button>
                        </div>
                        <textarea
                          rows={4}
                          value={pros}
                          onChange={(e) => setPros(e.target.value)}
                          placeholder="Ex: Gráficos [Rodou a 60 FPS com Ray Tracing]&#10;Trilha sonora [Música do chefe épica e marcante]&#10;Jogabilidade [Controles responsivos]"
                          className="w-full flex-1 bg-zinc-900/90 border border-emerald-900/40 rounded-xl px-3.5 py-2.5 text-xs sm:text-sm text-white placeholder:text-zinc-600 focus:outline-none focus:ring-2 focus:ring-emerald-500/60 leading-relaxed font-sans resize-y min-h-[110px]"
                        />
                        <p className="text-[11px] text-zinc-400 leading-tight">
                          Pressione <code className="text-emerald-400 font-mono font-bold bg-emerald-950/60 px-1 py-0.5 rounded border border-emerald-800/40">Enter</code> ou separe por <code className="text-emerald-400 font-mono font-bold bg-emerald-950/60 px-1 py-0.5 rounded border border-emerald-800/40">;</code>. O texto em colchetes <code className="text-emerald-400 font-mono font-bold bg-emerald-950/60 px-1 py-0.5 rounded border border-emerald-800/40">[ ]</code> vira tooltip no mouseover!
                        </p>
                      </div>

                      <div className="bg-rose-950/30 border border-rose-500/40 rounded-2xl p-4 space-y-2 flex flex-col">
                        <div className="flex items-center justify-between">
                          <label className="text-xs font-bold text-rose-400 uppercase tracking-widest flex items-center gap-1.5 font-mono">
                            <ThumbsDown size={14} className="text-rose-400 shrink-0" />
                            <span>- Contras (Enter ou ';')</span>
                          </label>
                          <button
                            type="button"
                            onClick={() => setShowProsConsModal(true)}
                            className="text-[11px] text-rose-400 hover:text-rose-300 font-semibold flex items-center gap-1 cursor-pointer"
                          >
                            <Maximize2 size={11} />
                            <span>Expandir 90%</span>
                          </button>
                        </div>
                        <textarea
                          rows={4}
                          value={cons}
                          onChange={(e) => setCons(e.target.value)}
                          placeholder="Ex: Bugs [Apenas no lançamento antes do patch 1.2]&#10;História curta [Zerado em apenas 8 horas de campanha]"
                          className="w-full flex-1 bg-zinc-900/90 border border-rose-900/40 rounded-xl px-3.5 py-2.5 text-xs sm:text-sm text-white placeholder:text-zinc-600 focus:outline-none focus:ring-2 focus:ring-rose-500/60 leading-relaxed font-sans resize-y min-h-[110px]"
                        />
                        <p className="text-[11px] text-zinc-400 leading-tight">
                          Pressione <code className="text-rose-400 font-mono font-bold bg-rose-950/60 px-1 py-0.5 rounded border border-rose-800/40">Enter</code> ou separe por <code className="text-rose-400 font-mono font-bold bg-rose-950/60 px-1 py-0.5 rounded border border-rose-800/40">;</code>. O texto em colchetes <code className="text-rose-400 font-mono font-bold bg-rose-950/60 px-1 py-0.5 rounded border border-rose-800/40">[ ]</code> vira tooltip no mouseover!
                        </p>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Gêneros */}
              <div id="block-genres" className={`scroll-mt-28 bg-zinc-950/80 p-4.5 rounded-2xl transition-all ${getCategoryBorderClass("genres", !!openBlocks["genres"])}`}>
                <div
                  onClick={() => toggleBlock("genres")}
                  className="flex items-center justify-between cursor-pointer select-none pb-2 border-b border-fuchsia-500/30"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <Gamepad2 size={16} className="text-fuchsia-400 shrink-0" />
                    <h4 className="text-xs font-bold text-fuchsia-300 uppercase tracking-wider font-mono shrink-0">
                      Gêneros *
                    </h4>
                    {!openBlocks["genres"] && selectedGenres.length > 0 && (
                      <span className="text-xs text-fuchsia-400 font-mono font-bold truncate">
                        — {selectedGenres.join(", ")}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      type="button"
                      onClick={() => toggleBlock("genres")}
                      className="p-1 rounded-lg text-fuchsia-400 hover:text-white transition-colors cursor-pointer"
                    >
                      {openBlocks["genres"] ? <ChevronDown size={18} /> : <ChevronRight size={18} />}
                    </button>
                  </div>
                </div>

                {openBlocks["genres"] && (
                  <div className="pt-4 space-y-3">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs font-bold text-fuchsia-300 uppercase tracking-widest font-mono">
                        Selecione os gêneros do jogo
                      </span>
                      <button
                        type="button"
                        onClick={() => setShowNewGenre(!showNewGenre)}
                        className="text-[10px] uppercase tracking-[0.25em] text-fuchsia-400 font-extrabold hover:underline cursor-pointer"
                      >
                        Criar Gênero
                      </button>
                    </div>

                    {showNewGenre && (
                      <div className="mb-3 flex gap-2 p-3 rounded-2xl bg-zinc-900 border border-zinc-800">
                        <input
                          type="text"
                          value={newGenreVal}
                          onChange={(e) => setNewGenreVal(e.target.value)}
                          placeholder="Nome do gênero..."
                          className="flex-1 px-3 py-2 rounded-xl bg-zinc-950 border border-zinc-800 text-white outline-none focus:ring-2 focus:ring-cyan-500 text-sm"
                        />
                        <button
                          type="button"
                          onClick={submitCustomGenre}
                          className="px-4 py-2 rounded-xl bg-cyan-600 text-white font-bold text-xs"
                        >
                          Confirmar
                        </button>
                      </div>
                    )}

                    <div className="flex flex-wrap gap-1.5 p-3 rounded-2xl bg-zinc-900 border border-zinc-800 max-h-32 overflow-y-auto">
                      {globalGenres.map((genre, idx) => {
                        const isSelected = selectedGenres.includes(genre);
                        const isEditing = editingGenre === genre;
                        return isEditing ? (
                          <div
                            key={`genre-edit-${genre}-${idx}`}
                            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl border border-zinc-800 bg-zinc-950 text-xs font-semibold"
                          >
                            <input
                              type="text"
                              value={editingGenreValue}
                              onChange={(e) => setEditingGenreValue(e.target.value)}
                              onKeyDown={(e) => {
                                if (e.key === "Enter") {
                                  e.preventDefault();
                                  if (onEditGlobalGenre && editingGenreValue.trim()) {
                                    onEditGlobalGenre(genre, editingGenreValue.trim());
                                  }
                                  setEditingGenre(null);
                                } else if (e.key === "Escape") {
                                  setEditingGenre(null);
                                }
                              }}
                              className="w-20 bg-transparent text-white outline-none border-b border-cyan-500 text-xs py-0.5"
                              autoFocus
                            />
                            <button
                              type="button"
                              onClick={() => {
                                if (onEditGlobalGenre && editingGenreValue.trim()) {
                                  onEditGlobalGenre(genre, editingGenreValue.trim());
                                }
                                setEditingGenre(null);
                              }}
                              className="text-green-400 hover:text-green-300 text-xs font-bold px-1 cursor-pointer"
                            >
                              ✓
                            </button>
                            <button
                              type="button"
                              onClick={() => setEditingGenre(null)}
                              className="text-zinc-400 hover:text-zinc-200 text-xs font-bold px-1 cursor-pointer"
                            >
                              ×
                            </button>
                          </div>
                        ) : (
                          <div
                            key={`genre-view-${genre}-${idx}`}
                            className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-xl border text-xs font-semibold transition-all ${
                              isSelected
                                ? "bg-purple-600/25 text-purple-300 border-purple-500/40"
                                : "bg-zinc-950 text-zinc-400 border-zinc-800"
                            }`}
                          >
                            <button
                              type="button"
                              onClick={() => toggleGenre(genre)}
                              className="hover:text-white transition-colors cursor-pointer"
                            >
                              {genre}
                            </button>
                            {onEditGlobalGenre && (
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setEditingGenre(genre);
                                  setEditingGenreValue(genre);
                                }}
                                className="text-zinc-500 hover:text-cyan-400 hover:bg-zinc-800 p-0.5 rounded transition-all cursor-pointer flex items-center justify-center w-4 h-4 text-xs font-bold ml-1"
                                title="Editar gênero"
                              >
                                ✎
                              </button>
                            )}
                            {onDeleteGlobalGenre && (
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  onDeleteGlobalGenre(genre);
                                }}
                                className="text-zinc-500 hover:text-red-400 hover:bg-zinc-850 p-0.5 rounded transition-all cursor-pointer flex items-center justify-center w-4 h-4 text-xs font-bold ml-0.5"
                                title="Excluir gênero"
                              >
                                ×
                              </button>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>

              {/* Etiquetas / Tags */}
              <div id="block-tags" className={`scroll-mt-28 bg-zinc-950/80 p-4.5 rounded-2xl transition-all ${getCategoryBorderClass("tags", !!openBlocks["tags"])}`}>
                <div
                  onClick={() => toggleBlock("tags")}
                  className="flex items-center justify-between cursor-pointer select-none pb-2 border-b border-cyan-500/30"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <Tag size={16} className="text-cyan-400 shrink-0" />
                    <h4 className="text-xs font-bold text-cyan-300 uppercase tracking-wider font-mono shrink-0">
                      Etiquetas / Tags
                    </h4>
                    {!openBlocks["tags"] && selectedTags.length > 0 && (
                      <span className="text-xs text-cyan-400 font-mono font-bold truncate">
                        — {selectedTags.join(", ")}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      type="button"
                      onClick={() => toggleBlock("tags")}
                      className="p-1 rounded-lg text-cyan-400 hover:text-white transition-colors cursor-pointer"
                    >
                      {openBlocks["tags"] ? <ChevronDown size={18} /> : <ChevronRight size={18} />}
                    </button>
                  </div>
                </div>

                {openBlocks["tags"] && (
                  <div className="pt-4 space-y-3">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs font-bold text-cyan-300 uppercase tracking-widest font-mono">
                        Selecione as tags
                      </span>
                      <button
                        type="button"
                        onClick={() => setShowNewTag(!showNewTag)}
                        className="text-[10px] uppercase tracking-[0.25em] text-cyan-400 font-extrabold hover:underline cursor-pointer"
                      >
                        Criar Tag
                      </button>
                    </div>

                    {showNewTag && (
                      <div className="mb-3 flex gap-2 p-3 rounded-2xl bg-zinc-900 border border-zinc-800">
                        <input
                          type="text"
                          value={newTagVal}
                          onChange={(e) => setNewTagVal(e.target.value)}
                          placeholder="Tag customizada..."
                          className="flex-1 px-3 py-2 rounded-xl bg-zinc-950 border border-zinc-800 text-white outline-none focus:ring-2 focus:ring-cyan-500 text-sm"
                        />
                        <button
                          type="button"
                          onClick={submitCustomTag}
                          className="px-4 py-2 rounded-xl bg-cyan-600 text-white font-bold text-xs cursor-pointer"
                        >
                          Confirmar
                        </button>
                      </div>
                    )}

                    <div className="flex flex-wrap gap-1.5 p-3 rounded-2xl bg-zinc-900 border border-zinc-800 max-h-36 overflow-y-auto">
                      {globalTags.map((tag, idx) => {
                        const isSelected = selectedTags.includes(tag);
                        const isEditing = editingTag === tag;
                        return isEditing ? (
                          <div
                            key={`tag-edit-${tag}-${idx}`}
                            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl border border-zinc-800 bg-zinc-950 text-xs font-semibold"
                          >
                            <input
                              type="text"
                              value={editingTagValue}
                              onChange={(e) => setEditingTagValue(e.target.value)}
                              onKeyDown={(e) => {
                                if (e.key === "Enter") {
                                  e.preventDefault();
                                  if (onEditGlobalTag && editingTagValue.trim()) {
                                    onEditGlobalTag(tag, editingTagValue.trim());
                                  }
                                  setEditingTag(null);
                                } else if (e.key === "Escape") {
                                  setEditingTag(null);
                                }
                              }}
                              className="w-20 bg-transparent text-white outline-none border-b border-cyan-500 text-xs py-0.5"
                              autoFocus
                            />
                            <button
                              type="button"
                              onClick={() => {
                                if (onEditGlobalTag && editingTagValue.trim()) {
                                  onEditGlobalTag(tag, editingTagValue.trim());
                                }
                                setEditingTag(null);
                              }}
                              className="text-green-400 hover:text-green-300 text-xs font-bold px-1 cursor-pointer"
                            >
                              ✓
                            </button>
                            <button
                              type="button"
                              onClick={() => setEditingTag(null)}
                              className="text-zinc-400 hover:text-zinc-200 text-xs font-bold px-1 cursor-pointer"
                            >
                              ×
                            </button>
                          </div>
                        ) : (
                          <div
                            key={`tag-view-${tag}-${idx}`}
                            className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-xl border text-xs font-semibold transition-all ${
                              isSelected
                                ? "bg-cyan-600/25 text-cyan-300 border-cyan-500/40"
                                : "bg-zinc-950 text-zinc-400 border-zinc-800"
                            }`}
                          >
                            <button
                              type="button"
                              onClick={() => toggleTag(tag)}
                              className="hover:text-white transition-colors cursor-pointer"
                            >
                              {tag}
                            </button>
                            {onEditGlobalTag && (
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setEditingTag(tag);
                                  setEditingTagValue(tag);
                                }}
                                className="text-zinc-500 hover:text-cyan-400 hover:bg-zinc-800 p-0.5 rounded transition-all cursor-pointer flex items-center justify-center w-4 h-4 text-xs font-bold ml-1"
                                title="Editar tag"
                              >
                                ✎
                              </button>
                            )}
                            {onDeleteGlobalTag && (
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  onDeleteGlobalTag(tag);
                                }}
                                className="text-zinc-500 hover:text-red-400 hover:bg-zinc-850 p-0.5 rounded transition-all cursor-pointer flex items-center justify-center w-4 h-4 text-xs font-bold ml-0.5"
                                title="Excluir tag"
                              >
                                ×
                              </button>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>

              {/* HowLongToBeat (HLTB) Integration Section - Borda Roxa */}
              <div id="block-hltb" className="scroll-mt-28 bg-zinc-950/80 border-2 border-purple-500/70 bg-purple-950/20 shadow-md shadow-purple-500/10 rounded-2xl p-4.5 space-y-4">
                <div className="flex items-center justify-between border-b border-purple-500/30 pb-2">
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-purple-400 animate-pulse" />
                    <h4 className="text-xs font-black uppercase tracking-widest text-purple-300 font-mono">
                      Métricas HowLongToBeat (HLTB)
                    </h4>
                  </div>
                  <div className="flex gap-2">
                    {hltbId && (
                      <button
                        type="button"
                        onClick={handleRefreshHltb}
                        disabled={isFetchingHltb}
                        className="text-xs font-bold text-amber-400 hover:text-amber-300 flex items-center gap-1 transition-colors px-2.5 py-1.5 bg-amber-950/20 border border-amber-800/30 rounded-xl hover:bg-amber-950/40 font-semibold cursor-pointer disabled:opacity-50"
                        title="Atualizar dados direto do HowLongToBeat"
                      >
                        {isFetchingHltb ? (
                          <Loader2 size={12} className="animate-spin text-amber-500" />
                        ) : (
                          <RefreshCw size={12} />
                        )}
                        <span>Sincronizar</span>
                      </button>
                    )}
                    {!showHltbImport && (
                      <button
                        type="button"
                        onClick={() => {
                          setShowHltbImport(true);
                        }}
                        className="text-xs font-bold text-purple-300 hover:text-purple-200 flex items-center gap-1.5 transition-colors px-2.5 py-1.5 bg-purple-950/50 border border-purple-500/40 rounded-xl hover:bg-purple-900/60 font-semibold cursor-pointer"
                      >
                        <Globe size={12} />
                        {hltbMain ? "Vincular Outro Link" : "Importar via Link"}
                      </button>
                    )}
                  </div>
                </div>

                {showHltbImport ? (
                  <div className="space-y-3">
                    <p className="text-[10px] text-zinc-400">
                      Cole o link da página do jogo no HowLongToBeat (ex: <code className="text-purple-300 bg-zinc-950 px-1 py-0.5 rounded">https://howlongtobeat.com/game/10270</code>) ou apenas o ID numérico:
                    </p>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={hltbUrlInput}
                        onChange={(e) => setHltbUrlInput(e.target.value)}
                        placeholder="Cole o link ou ID do HLTB..."
                        className="flex-1 bg-zinc-950 border border-purple-900/40 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:ring-1 focus:ring-purple-500"
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            e.preventDefault();
                            handleLoadHltbUrl();
                          }
                        }}
                      />
                      <button
                        type="button"
                        onClick={handleLoadHltbUrl}
                        disabled={isFetchingHltb}
                        className="px-3 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 disabled:opacity-50 text-white text-xs font-bold transition-colors flex items-center gap-1 cursor-pointer"
                      >
                        {isFetchingHltb ? (
                          <Loader2 size={12} className="animate-spin" />
                        ) : (
                          <Check size={12} />
                        )}
                        <span>Carregar</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setShowHltbImport(false)}
                        className="px-3 py-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-xs font-bold transition-colors cursor-pointer"
                      >
                        Cancelar
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {hltbMain || hltbExtra || hltbCompletionist ? (
                      <div className="space-y-2">
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                          {hltbMain && (
                            <button
                              type="button"
                              onClick={() => setPlaytime(hltbMain)}
                              className="p-2.5 rounded-xl bg-zinc-950 border border-purple-500/30 hover:border-purple-500/60 hover:bg-purple-950/30 text-left transition-all group/metric cursor-pointer"
                              title="Clique para aplicar este tempo como Tempo de Jogo"
                            >
                              <span className="block text-[9px] font-black uppercase text-zinc-400 tracking-wider">História Principal</span>
                              <span className="text-sm font-black text-purple-300 font-mono mt-0.5 block flex items-center justify-between">
                                <span>{hltbMain}</span>
                                <span className="text-[9px] opacity-0 group-hover/metric:opacity-100 transition-opacity text-purple-400 font-sans">Usar →</span>
                              </span>
                            </button>
                          )}
                          {hltbExtra && (
                            <button
                              type="button"
                              onClick={() => setPlaytime(hltbExtra)}
                              className="p-2.5 rounded-xl bg-zinc-950 border border-purple-500/30 hover:border-cyan-500/60 hover:bg-cyan-950/30 text-left transition-all group/metric cursor-pointer"
                              title="Clique para aplicar este tempo como Tempo de Jogo"
                            >
                              <span className="block text-[9px] font-black uppercase text-zinc-400 tracking-wider">História + Extras</span>
                              <span className="text-sm font-black text-cyan-300 font-mono mt-0.5 block flex items-center justify-between">
                                <span>{hltbExtra}</span>
                                <span className="text-[9px] opacity-0 group-hover/metric:opacity-100 transition-opacity text-cyan-400 font-sans">Usar →</span>
                              </span>
                            </button>
                          )}
                          {hltbCompletionist && (
                            <button
                              type="button"
                              onClick={() => setPlaytime(hltbCompletionist)}
                              className="p-2.5 rounded-xl bg-zinc-950 border border-purple-500/30 hover:border-pink-500/60 hover:bg-pink-950/30 text-left transition-all group/metric cursor-pointer"
                              title="Clique para aplicar este tempo como Tempo de Jogo"
                            >
                              <span className="block text-[9px] font-black uppercase text-zinc-400 tracking-wider">Complecionista (100%)</span>
                              <span className="text-sm font-black text-pink-300 font-mono mt-0.5 block flex items-center justify-between">
                                <span>{hltbCompletionist}</span>
                                <span className="text-[9px] opacity-0 group-hover/metric:opacity-100 transition-opacity text-pink-400 font-sans">Usar →</span>
                              </span>
                            </button>
                          )}
                        </div>
                        <p className="text-[10px] text-zinc-400 text-center flex items-center justify-center gap-1">
                          <Clock size={10} className="text-purple-400" />
                          <span>Dica: Clique em qualquer card de tempo acima para preencher o "Tempo de Jogo"!</span>
                        </p>
                      </div>
                    ) : (
                      <div className="text-center py-3 text-xs text-zinc-400 italic">
                        Nenhuma métrica vinculada a este jogo ainda. Clique em "Importar via Link" para colar a página do HowLongToBeat!
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Metacritic Integration Section - Borda Laranja / Amber */}
              <div id="block-metacritic" className="scroll-mt-28 bg-zinc-950/80 border-2 border-amber-500/70 bg-amber-950/20 shadow-md shadow-amber-500/10 rounded-2xl p-4.5 space-y-4">
                <div className="flex items-center justify-between border-b border-amber-500/30 pb-2">
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-amber-400 animate-pulse" />
                    <h4 className="text-xs font-black uppercase tracking-widest text-amber-300 font-mono">
                      Notas do Metacritic
                    </h4>
                  </div>
                  <div className="flex gap-2">
                    {metacriticUrl && (
                      <button
                        type="button"
                        onClick={handleRefreshMetacritic}
                        disabled={isFetchingMetacritic}
                        className="text-xs font-bold text-amber-400 hover:text-amber-300 flex items-center gap-1 transition-colors px-2.5 py-1.5 bg-amber-950/30 border border-amber-500/40 rounded-xl hover:bg-amber-950/50 font-semibold cursor-pointer disabled:opacity-50"
                        title="Atualizar notas direto do Metacritic"
                      >
                        {isFetchingMetacritic ? (
                          <Loader2 size={12} className="animate-spin text-amber-500" />
                        ) : (
                          <RefreshCw size={12} />
                        )}
                        <span>Sincronizar</span>
                      </button>
                    )}
                    {!showMetacriticImport && (
                      <button
                        type="button"
                        onClick={() => {
                          setShowMetacriticImport(true);
                        }}
                        className="text-xs font-bold text-amber-300 hover:text-amber-200 flex items-center gap-1.5 transition-colors px-2.5 py-1.5 bg-amber-950/50 border border-amber-500/40 rounded-xl hover:bg-amber-900/60 font-semibold cursor-pointer"
                      >
                        <Globe size={12} />
                        {metacriticUrl ? "Vincular Outro Link" : "Importar via Link"}
                      </button>
                    )}
                  </div>
                </div>

                {showMetacriticImport ? (
                  <div className="space-y-3">
                    <p className="text-[10px] text-zinc-400">
                      Cole o link da página do jogo no Metacritic (ex: <code className="text-amber-300 bg-zinc-950 px-1 py-0.5 rounded">https://www.metacritic.com/game/metroid-dread/</code>):
                    </p>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={metacriticUrlInput}
                        onChange={(e) => setMetacriticUrlInput(e.target.value)}
                        placeholder="Cole o link do Metacritic..."
                        className="flex-1 bg-zinc-950 border border-amber-900/40 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:ring-1 focus:ring-amber-500"
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            e.preventDefault();
                            handleLoadMetacriticUrl();
                          }
                        }}
                      />
                      <button
                        type="button"
                        onClick={handleLoadMetacriticUrl}
                        disabled={isFetchingMetacritic}
                        className="px-3 py-2 rounded-xl bg-amber-600 hover:bg-amber-500 disabled:opacity-50 text-white text-xs font-bold transition-colors flex items-center gap-1 cursor-pointer"
                      >
                        {isFetchingMetacritic ? (
                          <Loader2 size={12} className="animate-spin" />
                        ) : (
                          <Check size={12} />
                        )}
                        <span>Carregar</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setShowMetacriticImport(false)}
                        className="px-3 py-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-xs font-bold transition-colors cursor-pointer"
                      >
                        Cancelar
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {metacriticCritScore !== undefined || metacriticUserScore !== undefined ? (
                      <div className="space-y-2">
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                          {metacriticCritScore !== undefined && (
                            <div className="p-2.5 rounded-xl bg-zinc-950 border border-amber-500/30 text-left">
                              <span className="block text-[9px] font-black uppercase text-zinc-400 tracking-wider">Média da Crítica (Metascore)</span>
                              <span className="text-sm font-black text-amber-300 font-mono mt-0.5 block flex items-center justify-between">
                                <span>{metacriticCritScore}</span>
                              </span>
                            </div>
                          )}
                          {metacriticUserScore !== undefined && !isNaN(Number(metacriticUserScore)) && (
                            <div className="p-2.5 rounded-xl bg-zinc-950 border border-amber-500/30 text-left">
                              <span className="block text-[9px] font-black uppercase text-zinc-400 tracking-wider">Média dos Usuários</span>
                              <span className="text-sm font-black text-cyan-300 font-mono mt-0.5 block flex items-center justify-between">
                                <span>{Number(metacriticUserScore).toFixed(1)}</span>
                              </span>
                            </div>
                          )}
                        </div>

                        {metacriticUrl && metacriticPlatforms.length > 0 && (
                          <div className="pt-2 border-t border-amber-500/20">
                            <label className="block text-[10px] font-bold text-amber-300 uppercase tracking-wider mb-1 text-left font-mono">
                              Extrair dados da plataforma:
                            </label>
                            <select
                              value={selectedMetacriticPlatform}
                              onChange={(e) => handleSelectFormPlatform(e.target.value)}
                              disabled={isFetchingMetacritic}
                              className="w-full bg-zinc-950 border border-amber-900/40 rounded-xl px-3 py-2 text-xs text-zinc-200 focus:outline-none focus:ring-1 focus:ring-amber-500 disabled:opacity-50 cursor-pointer"
                            >
                              <option value="">Geral (Média Principal)</option>
                              {metacriticPlatforms.map((p) => (
                                <option key={p.code} value={p.code}>
                                  {p.name}
                                </option>
                              ))}
                            </select>
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="text-center py-3 text-xs text-zinc-400 italic">
                        Nenhuma nota do Metacritic vinculada a este jogo ainda. Clique em "Importar via Link"!
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Integração de Plataforma / Loja (Steam vs GOG) */}
              <div id="block-steam" className="bg-zinc-950/80 border-2 border-cyan-500/70 bg-cyan-950/20 shadow-md shadow-cyan-500/10 rounded-2xl p-4.5 space-y-4">
                <div className="flex items-center justify-between border-b border-zinc-800 pb-3 flex-wrap gap-2">
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-cyan-400 animate-pulse" />
                    <h4 className="text-xs font-black uppercase tracking-widest text-cyan-300 flex items-center gap-1.5 font-mono">
                      <Gamepad2 size={14} className="text-cyan-400" />
                      Plataforma & Integração de Estatísticas
                    </h4>
                  </div>

                  {/* Tabs para alternar entre Steam e GOG */}
                  <div className="flex items-center gap-1 bg-zinc-900/90 p-1 rounded-xl border border-zinc-800">
                    <button
                      type="button"
                      onClick={() => setIntegrationPlatform("steam")}
                      className={`px-3 py-1 rounded-lg text-xs font-extrabold transition-all flex items-center gap-1.5 cursor-pointer ${
                        integrationPlatform === "steam"
                          ? "bg-blue-600 text-white shadow-sm shadow-blue-500/30 ring-1 ring-blue-400/50"
                          : "text-zinc-400 hover:text-white"
                      }`}
                    >
                      <span className="w-2 h-2 rounded-full bg-blue-400" />
                      <span>Steam</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        setIntegrationPlatform("gog");
                        handleFetchUserGogGames();
                      }}
                      className={`px-3 py-1 rounded-lg text-xs font-extrabold transition-all flex items-center gap-1.5 cursor-pointer ${
                        integrationPlatform === "gog"
                          ? "bg-purple-600 text-white shadow-sm shadow-purple-500/30 ring-1 ring-purple-400/50"
                          : "text-zinc-400 hover:text-white"
                      }`}
                    >
                      <span className="w-2 h-2 rounded-full bg-purple-400" />
                      <span>GOG Galaxy</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        setIntegrationPlatform("battlenet");
                        if (isBlizzardAuthenticated() && blizzardGameId) {
                          handleFetchBlizzardCharacters(blizzardGameId);
                        }
                      }}
                      className={`px-3 py-1 rounded-lg text-xs font-extrabold transition-all flex items-center gap-1.5 cursor-pointer ${
                        integrationPlatform === "battlenet"
                          ? "bg-cyan-600 text-white shadow-sm shadow-cyan-500/30 ring-1 ring-cyan-400/50"
                          : "text-zinc-400 hover:text-white"
                      }`}
                    >
                      <span className="w-2 h-2 rounded-full bg-cyan-400" />
                      <span>Battle.net</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setIntegrationPlatform("none")}
                      className={`px-3 py-1 rounded-lg text-xs font-medium transition-all cursor-pointer ${
                        integrationPlatform === "none"
                          ? "bg-zinc-800 text-zinc-200"
                          : "text-zinc-500 hover:text-zinc-300"
                      }`}
                    >
                      <span>Desativado</span>
                    </button>
                  </div>
                </div>

                {/* STEAM INTEGRATION PANEL */}
                {integrationPlatform === "steam" && (
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <div className="text-[11px] text-blue-300/80 font-medium flex items-center gap-1.5">
                        <Globe size={13} className="text-blue-400" />
                        <span>Sincronia oficial via Steam Web API</span>
                      </div>
                      <div className="flex gap-2">
                        {steamAppId && (
                          <>
                            <button
                              type="button"
                              onClick={handleSyncSteamData}
                              disabled={isFetchingSteam}
                              className="text-xs font-bold text-blue-300 hover:text-blue-200 flex items-center gap-1 transition-colors px-2.5 py-1.5 bg-blue-950/40 border border-blue-500/40 rounded-xl hover:bg-blue-900/60 font-semibold cursor-pointer disabled:opacity-50"
                              title="Atualizar dados e horas de jogo da Steam"
                            >
                              {isFetchingSteam ? (
                                <Loader2 size={12} className="animate-spin text-blue-400" />
                              ) : (
                                <RefreshCw size={12} />
                              )}
                              <span>Sincronizar</span>
                            </button>
                            <button
                              type="button"
                              onClick={handleUnlinkSteam}
                              className="text-xs font-bold text-red-400 hover:text-red-300 transition-colors px-2.5 py-1.5 bg-red-950/20 border border-red-800/30 rounded-xl hover:bg-red-950/40 cursor-pointer"
                              title="Desvincular da Steam"
                            >
                              Desvincular
                            </button>
                          </>
                        )}
                        {!showSteamImport && !steamAppId && (
                          <button
                            type="button"
                            onClick={() => {
                              setShowSteamImport(true);
                              handleFetchUserSteamGames();
                            }}
                            className="text-xs font-bold text-blue-300 hover:text-blue-200 flex items-center gap-1.5 transition-colors px-2.5 py-1.5 bg-blue-950/50 border border-blue-500/40 rounded-xl hover:bg-blue-900/60 font-semibold cursor-pointer"
                          >
                            <Globe size={12} />
                            <span>Vincular Jogo da Steam</span>
                          </button>
                        )}
                      </div>
                    </div>

                    {showSteamImport ? (
                      <div className="space-y-3 bg-zinc-950 p-3.5 border border-blue-900/40 rounded-xl">
                        <p className="text-[10px] text-zinc-400">
                          Selecione o jogo correspondente da sua biblioteca Steam ou informe o App ID/link da Steam:
                        </p>

                        <div className="flex gap-2">
                          <input
                            type="text"
                            value={steamUrlInput}
                            onChange={(e) => setSteamUrlInput(e.target.value)}
                            placeholder="App ID (ex: 1091500) ou link da loja Steam..."
                            className="flex-1 bg-zinc-900 border border-blue-900/40 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:ring-1 focus:ring-blue-500"
                            onKeyDown={(e) => {
                              if (e.key === "Enter") {
                                e.preventDefault();
                                handleLoadSteamInput();
                              }
                            }}
                          />
                          <button
                            type="button"
                            onClick={handleLoadSteamInput}
                            disabled={isFetchingSteam}
                            className="px-3 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white text-xs font-bold transition-colors flex items-center gap-1 cursor-pointer"
                          >
                            {isFetchingSteam ? <Loader2 size={12} className="animate-spin" /> : <Check size={12} />}
                            <span>Vincular</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => setShowSteamImport(false)}
                            className="px-3 py-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-xs font-bold transition-colors cursor-pointer"
                          >
                            Cancelar
                          </button>
                        </div>

                        {isLoadingSteamGames ? (
                          <div className="py-2 text-center text-xs text-zinc-400 flex items-center justify-center gap-2">
                            <Loader2 size={14} className="animate-spin text-blue-400" />
                            <span>Buscando jogos da sua conta Steam...</span>
                          </div>
                        ) : steamUserGamesList.length > 0 ? (
                          <div className="space-y-1.5 pt-2 border-t border-zinc-800/80">
                            <label className="block text-[10px] font-bold text-zinc-400 uppercase tracking-wider font-mono">
                              Escolha um jogo da sua biblioteca Steam ({steamUserGamesList.length} jogos):
                            </label>
                            <div className="max-h-44 overflow-y-auto space-y-1 pr-1 custom-scrollbar">
                              {steamUserGamesList
                                .filter((sg) => !name || sg.name.toLowerCase().includes(name.toLowerCase()) || name.toLowerCase().includes(sg.name.toLowerCase()) || !steamUrlInput || sg.name.toLowerCase().includes(steamUrlInput.toLowerCase()))
                                .slice(0, 20)
                                .map((sg) => (
                                  <div
                                    key={sg.appid}
                                    onClick={() => handleLinkSteamGame(sg)}
                                    className="p-2 bg-zinc-900 hover:bg-blue-950/40 border border-zinc-800 hover:border-blue-500/40 rounded-xl transition-all cursor-pointer flex items-center justify-between gap-2 group"
                                  >
                                    <div className="flex items-center gap-2 min-w-0">
                                      <img
                                        src={getSteamHeaderImageUrl(sg.appid)}
                                        alt={sg.name}
                                        className="w-12 h-6 object-cover rounded border border-zinc-800 shrink-0"
                                        onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                                      />
                                      <span className="text-xs font-bold text-zinc-200 group-hover:text-blue-300 truncate">
                                        {sg.name}
                                      </span>
                                    </div>
                                    <div className="flex items-center gap-2 shrink-0">
                                      <span className="text-[11px] font-mono font-bold text-cyan-400">
                                        {formatSteamPlaytime(sg.playtime_forever)}
                                      </span>
                                      <span className="text-[10px] font-bold bg-blue-600 hover:bg-blue-500 text-white px-2 py-0.5 rounded-lg">
                                        Vincular
                                      </span>
                                    </div>
                                  </div>
                                ))}
                            </div>
                          </div>
                        ) : null}
                      </div>
                    ) : steamAppId ? (
                      <div className="space-y-3">
                        <div className="p-3 rounded-xl bg-zinc-950 border border-blue-500/30 flex items-center justify-between gap-3">
                          <div className="flex items-center gap-3 min-w-0">
                            <img
                              src={getSteamHeaderImageUrl(steamAppId)}
                              alt={`Steam App ${steamAppId}`}
                              className="w-16 h-8 object-cover rounded-lg border border-zinc-800 shrink-0"
                              onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                            />
                            <div className="min-w-0">
                              <div className="flex items-center gap-2">
                                <span className="text-xs font-bold text-white truncate">App ID: {steamAppId}</span>
                                <a
                                  href={`https://store.steampowered.com/app/${steamAppId}`}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="text-[10px] text-blue-400 hover:underline"
                                >
                                  Ver na Loja ↗
                                </a>
                              </div>
                              {steamPlaytimeMinutes !== undefined && steamPlaytimeMinutes > 0 && (
                                <p className="text-xs font-mono font-bold text-cyan-400 mt-0.5">
                                  Tempo na Steam: {formatSteamPlaytime(steamPlaytimeMinutes)}
                                </p>
                              )}
                            </div>
                          </div>

                          {steamPlaytimeMinutes !== undefined && steamPlaytimeMinutes > 0 && (
                            <button
                              type="button"
                              onClick={() => setPlaytime(formatSteamPlaytime(steamPlaytimeMinutes))}
                              className="px-2.5 py-1.5 bg-blue-950/60 hover:bg-blue-900 border border-blue-500/40 text-blue-200 rounded-xl text-xs font-bold transition-all cursor-pointer shrink-0"
                              title="Copiar tempo registrado na Steam para o campo Tempo de Jogo"
                            >
                              Usar Horas →
                            </button>
                          )}
                        </div>

                        {steamAchieveData && steamAchieveData.totalCount > 0 && (
                          <div className="p-2.5 rounded-xl bg-zinc-950 border border-amber-500/30 flex items-center justify-between gap-2">
                            <div className="flex items-center gap-2">
                              <Trophy size={14} className="text-amber-400" />
                              <span className="text-xs font-bold text-zinc-300">
                                Conquistas Desbloqueadas:
                              </span>
                              <span className="text-xs font-mono font-extrabold text-amber-400">
                                {steamAchieveData.unlockedCount} / {steamAchieveData.totalCount} ({steamAchieveData.percentage}%)
                              </span>
                            </div>
                            <div className="w-24 h-2 bg-zinc-900 rounded-full overflow-hidden border border-zinc-800">
                              <div
                                className="h-full bg-gradient-to-r from-amber-500 to-yellow-400"
                                style={{ width: `${steamAchieveData.percentage}%` }}
                              />
                            </div>
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="text-center py-3 text-xs text-zinc-400 italic">
                        Nenhum jogo da Steam vinculado. Clique em "Vincular Jogo da Steam" para sincronizar horas e conquistas!
                      </div>
                    )}
                  </div>
                )}

                {/* GOG GALAXY INTEGRATION PANEL */}
                {integrationPlatform === "gog" && (
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <div className="text-[11px] text-purple-300/80 font-medium flex items-center gap-1.5">
                        <Globe size={13} className="text-purple-400" />
                        <span>Sincronia oficial via GOG Galaxy API</span>
                      </div>
                      <div className="flex gap-2">
                        {gogGameId && (
                          <>
                            <button
                              type="button"
                              onClick={handleSyncGogData}
                              disabled={isFetchingGog}
                              className="text-xs font-bold text-purple-300 hover:text-purple-200 flex items-center gap-1 transition-colors px-2.5 py-1.5 bg-purple-950/40 border border-purple-500/40 rounded-xl hover:bg-purple-900/60 font-semibold cursor-pointer disabled:opacity-50"
                              title="Atualizar dados e horas de jogo da GOG"
                            >
                              {isFetchingGog ? (
                                <Loader2 size={12} className="animate-spin text-purple-400" />
                              ) : (
                                <RefreshCw size={12} />
                              )}
                              <span>Sincronizar</span>
                            </button>
                            <button
                              type="button"
                              onClick={handleUnlinkGog}
                              className="text-xs font-bold text-red-400 hover:text-red-300 transition-colors px-2.5 py-1.5 bg-red-950/20 border border-red-800/30 rounded-xl hover:bg-red-950/40 cursor-pointer"
                              title="Desvincular da GOG"
                            >
                              Desvincular
                            </button>
                          </>
                        )}
                        {!showGogImport && !gogGameId && (
                          <button
                            type="button"
                            onClick={() => {
                              setShowGogImport(true);
                              handleFetchUserGogGames();
                            }}
                            className="text-xs font-bold text-purple-300 hover:text-purple-200 flex items-center gap-1.5 transition-colors px-2.5 py-1.5 bg-purple-950/50 border border-purple-500/40 rounded-xl hover:bg-purple-900/60 font-semibold cursor-pointer"
                          >
                            <Globe size={12} />
                            <span>Vincular Jogo da GOG</span>
                          </button>
                        )}
                      </div>
                    </div>

                    {showGogImport ? (
                      <div className="space-y-3 bg-zinc-950 p-3.5 border border-purple-900/40 rounded-xl">
                        <div className="space-y-1">
                          <p className="text-[11px] font-medium text-zinc-300">
                            Pesquise na sua biblioteca GOG ou cole a URL do jogo na loja GOG:
                          </p>
                          <p className="text-[10px] text-zinc-500 font-mono">
                            Ex: https://www.gog.com/en/game/the_witcher_3_wild_hunt ou Cyberpunk 2077
                          </p>
                        </div>

                        <div className="flex gap-2">
                          <input
                            type="text"
                            value={gogUrlInput}
                            onChange={(e) => setGogUrlInput(e.target.value)}
                            placeholder="URL da GOG, título do jogo ou ID..."
                            className="flex-1 bg-zinc-900 border border-purple-900/40 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:ring-1 focus:ring-purple-500"
                            onKeyDown={(e) => {
                              if (e.key === "Enter") {
                                e.preventDefault();
                                handleLoadGogInput();
                              }
                            }}
                          />
                          <button
                            type="button"
                            onClick={handleLoadGogInput}
                            disabled={isFetchingGog}
                            className="px-3.5 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 disabled:opacity-50 text-white text-xs font-bold transition-colors flex items-center gap-1.5 cursor-pointer shrink-0 shadow-sm"
                          >
                            {isFetchingGog ? <Loader2 size={13} className="animate-spin" /> : <Search size={13} />}
                            <span>Buscar & Vincular</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => setShowGogImport(false)}
                            className="px-3 py-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-xs font-bold transition-colors cursor-pointer shrink-0"
                          >
                            Cancelar
                          </button>
                        </div>

                        {isLoadingGogGames ? (
                          <div className="py-3 text-center text-xs text-zinc-400 flex items-center justify-center gap-2">
                            <Loader2 size={14} className="animate-spin text-purple-400" />
                            <span>Buscando jogos da sua conta GOG conectada...</span>
                          </div>
                        ) : gogUserGamesList.length > 0 ? (
                          <div className="space-y-1.5 pt-2 border-t border-zinc-800/80">
                            <div className="flex items-center justify-between">
                              <label className="block text-[10px] font-bold text-purple-300 uppercase tracking-wider font-mono">
                                Jogos na sua conta GOG ({gogUserGamesList.length}):
                              </label>
                              <span className="text-[10px] text-zinc-500">Clique para vincular</span>
                            </div>
                            <div className="max-h-52 overflow-y-auto space-y-1.5 pr-1 custom-scrollbar">
                              {gogUserGamesList
                                .filter((gg) => {
                                  const searchFilter = (gogUrlInput || name || "").toLowerCase().trim();
                                  if (!searchFilter) return true;
                                  return (
                                    gg.title.toLowerCase().includes(searchFilter) ||
                                    (gg.slug && gg.slug.toLowerCase().includes(searchFilter)) ||
                                    String(gg.id) === searchFilter
                                  );
                                })
                                .slice(0, 30)
                                .map((gg) => (
                                  <div
                                    key={gg.id}
                                    onClick={() => handleLinkGogGame(gg)}
                                    className="p-2 bg-zinc-900 hover:bg-purple-950/50 border border-zinc-800 hover:border-purple-500/50 rounded-xl transition-all cursor-pointer flex items-center justify-between gap-2 group"
                                  >
                                    <div className="flex items-center gap-2 min-w-0">
                                      {gg.img_icon_url && (
                                        <img
                                          src={gg.img_icon_url}
                                          alt={gg.title}
                                          className="w-8 h-8 rounded-lg object-cover border border-zinc-700/50 shrink-0"
                                          referrerPolicy="no-referrer"
                                        />
                                      )}
                                      <div className="min-w-0">
                                        <span className="text-xs font-bold text-zinc-200 group-hover:text-purple-300 truncate block">
                                          {gg.title}
                                        </span>
                                        <span className="text-[10px] font-mono text-zinc-500">
                                          ID: {gg.id}
                                        </span>
                                      </div>
                                    </div>
                                    <div className="flex items-center gap-2 shrink-0">
                                      <span className="text-[11px] font-mono font-bold text-fuchsia-400 bg-fuchsia-950/30 px-2 py-0.5 rounded border border-fuchsia-800/30">
                                        {formatGogPlaytime(gg.playtime_minutes)}
                                      </span>
                                      <span className="text-[10px] font-bold bg-purple-600 hover:bg-purple-500 text-white px-2.5 py-1 rounded-lg shadow-sm">
                                        Vincular
                                      </span>
                                    </div>
                                  </div>
                                ))}
                            </div>
                          </div>
                        ) : null}
                      </div>
                    ) : gogGameId ? (
                      <div className="space-y-3">
                        <div className="p-3 rounded-xl bg-zinc-950 border border-purple-500/30 flex items-center justify-between gap-3">
                          <div className="flex items-center gap-3 min-w-0">
                            <div className="min-w-0">
                              <div className="flex items-center gap-2">
                                <span className="text-xs font-bold text-white truncate">GOG Game ID: {gogGameId}</span>
                                <a
                                  href={`https://www.gog.com/en/game/${gogGameId}`}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="text-[10px] text-purple-400 hover:underline"
                                >
                                  Ver na GOG / Galaxy ↗
                                </a>
                              </div>
                              {gogPlaytimeMinutes !== undefined && gogPlaytimeMinutes > 0 && (
                                <p className="text-xs font-mono font-bold text-fuchsia-400 mt-0.5">
                                  Tempo na GOG: {formatGogPlaytime(gogPlaytimeMinutes)}
                                </p>
                              )}
                            </div>
                          </div>

                          {gogPlaytimeMinutes !== undefined && gogPlaytimeMinutes > 0 && (
                            <button
                              type="button"
                              onClick={() => setPlaytime(formatGogPlaytime(gogPlaytimeMinutes))}
                              className="px-2.5 py-1.5 bg-purple-950/60 hover:bg-purple-900 border border-purple-500/40 text-purple-200 rounded-xl text-xs font-bold transition-all cursor-pointer shrink-0"
                              title="Copiar tempo registrado na GOG para o campo Tempo de Jogo"
                            >
                              Usar Horas →
                            </button>
                          )}
                        </div>

                        {gogAchieveData && gogAchieveData.totalCount > 0 && (
                          <div className="p-2.5 rounded-xl bg-zinc-950 border border-purple-500/30 flex items-center justify-between gap-2">
                            <div className="flex items-center gap-2">
                              <Trophy size={14} className="text-fuchsia-400" />
                              <span className="text-xs font-bold text-zinc-300">
                                Conquistas Desbloqueadas:
                              </span>
                              <span className="text-xs font-mono font-extrabold text-fuchsia-400">
                                {gogAchieveData.unlockedCount} / {gogAchieveData.totalCount} ({gogAchieveData.percentage}%)
                              </span>
                            </div>
                            <div className="w-24 h-2 bg-zinc-900 rounded-full overflow-hidden border border-zinc-800">
                              <div
                                className="h-full bg-gradient-to-r from-purple-500 to-fuchsia-400"
                                style={{ width: `${gogAchieveData.percentage}%` }}
                              />
                            </div>
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="text-center py-3 text-xs text-zinc-400 italic">
                        Nenhum jogo da GOG vinculado. Clique em "Vincular Jogo da GOG" para sincronizar horas e conquistas!
                      </div>
                    )}
                  </div>
                )}

                {/* BATTLENET INTEGRATION PANEL */}
                {integrationPlatform === "battlenet" && (
                  <div className="space-y-4">
                    {/* Header bar / Auth Status */}
                    <div className="flex items-center justify-between flex-wrap gap-2 pb-2 border-b border-zinc-800">
                      <div className="text-[11px] text-cyan-300 font-medium flex items-center gap-1.5">
                        <Globe size={13} className="text-cyan-400" />
                        <span>Blizzard Battle.net API Oficial</span>
                      </div>

                      <div className="flex items-center gap-2">
                        {isBlizzardLoggedIn ? (
                          <div className="flex items-center gap-2 bg-cyan-950/60 border border-cyan-500/40 px-3 py-1.5 rounded-xl">
                            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                            <span className="text-xs font-mono font-bold text-cyan-200">
                              {blizzardBattleTag || "BattleTag Conectada"}
                            </span>
                            <button
                              type="button"
                              onClick={handleDisconnectBlizzard}
                              className="text-[10px] text-zinc-400 hover:text-red-400 transition-colors ml-1 cursor-pointer font-semibold underline"
                              title="Desconectar sessão da Battle.net"
                            >
                              Sair
                            </button>
                          </div>
                        ) : (
                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              onClick={handleBlizzardLogin}
                              className="px-3 py-1.5 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-bold transition-all shadow-md shadow-cyan-600/30 flex items-center gap-1.5 cursor-pointer"
                              title="Conectar com sua conta da Battle.net via OAuth Blizzard oficial"
                            >
                              <Shield size={13} />
                              <span>Login com Battle.net</span>
                            </button>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* If not logged in, prompt OAuth or BattleTag fallback */}
                    {!isBlizzardLoggedIn && (
                      <div className="p-4 rounded-xl bg-zinc-900/90 border border-cyan-500/30 text-left space-y-3.5">
                        <div className="flex items-start gap-3">
                          <div className="w-9 h-9 rounded-xl bg-cyan-500/20 border border-cyan-400/40 flex items-center justify-center shrink-0 text-cyan-300 font-black text-sm">
                            B.net
                          </div>
                          <div className="space-y-1">
                            <h5 className="text-xs font-bold text-white">Autenticação Blizzard Battle.net</h5>
                            <p className="text-[11px] text-zinc-400 leading-relaxed">
                              Conecte sua conta da Battle.net para importar personagens do World of Warcraft (Retail, Classic, TBC, Forever), gear, conquistas e talentos diretamente da API Blizzard oficial.
                            </p>
                          </div>
                        </div>

                        {/* Erro 400 Redirect URI Info Box */}
                        <div className="p-3 bg-cyan-950/40 border border-cyan-500/30 rounded-xl space-y-2">
                          <div className="flex items-start gap-2">
                            <AlertCircle size={15} className="text-amber-400 shrink-0 mt-0.5" />
                            <div className="space-y-1">
                              <div className="text-[11px] font-bold text-amber-200">
                                Aviso sobre o Erro 400 ("Invalid grant type or callback URL is not valid"):
                              </div>
                              <p className="text-[11px] text-zinc-300 leading-relaxed">
                                A Blizzard exige que a URL de retorno deste app esteja cadastrada no campo <span className="text-amber-200 font-mono font-bold">Redirect URLs</span> do seu Client ID no portal de desenvolvedores.
                              </p>
                            </div>
                          </div>

                          {/* Copyable URL box */}
                          <div className="flex items-center gap-1.5 pt-1">
                            <span className="text-[10px] text-zinc-400 font-mono shrink-0">Redirect URL:</span>
                            <div className="flex-1 bg-zinc-950 border border-zinc-800 rounded-lg px-2.5 py-1 text-[11px] font-mono text-cyan-300 select-all truncate">
                              {customRedirectUriInput.trim() || getEffectiveBlizzardRedirectUri()}
                            </div>
                            <button
                              type="button"
                              onClick={handleCopyCallbackUrl}
                              className="px-2.5 py-1 bg-cyan-950 hover:bg-cyan-900 text-cyan-300 rounded-lg text-[11px] font-bold cursor-pointer transition-colors border border-cyan-500/40 flex items-center gap-1 shrink-0 shadow-sm"
                              title="Copiar URL para colar no develop.battle.net"
                            >
                              {copiedRedirectUri ? <Check size={12} className="text-emerald-400" /> : <Copy size={12} />}
                              <span>{copiedRedirectUri ? "Copiado!" : "Copiar URL"}</span>
                            </button>
                          </div>

                          <div className="flex items-center justify-between flex-wrap gap-2 pt-1 border-t border-zinc-800/80 text-[10px]">
                            <a
                              href="https://develop.battle.net/access/clients"
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-cyan-400 hover:text-cyan-300 inline-flex items-center gap-1 underline font-medium"
                            >
                              <ExternalLink size={10} />
                              <span>Abrir develop.battle.net/access/clients</span>
                            </a>
                            <button
                              type="button"
                              onClick={() => setShowBlizzardAdvancedConfig(!showBlizzardAdvancedConfig)}
                              className="text-zinc-400 hover:text-zinc-200 cursor-pointer flex items-center gap-1"
                            >
                              <SlidersHorizontal size={11} />
                              <span>{showBlizzardAdvancedConfig ? "Ocultar Opções Avançadas" : "Opções Avançadas (Token Manual / URL Custom)"}</span>
                              <ChevronDown size={11} className={`transform transition-transform ${showBlizzardAdvancedConfig ? "rotate-180" : ""}`} />
                            </button>
                          </div>
                        </div>

                        {/* Collapsible Advanced Config */}
                        {showBlizzardAdvancedConfig && (
                          <motion.div
                            initial={{ opacity: 0, height: 0 }}
                            animate={{ opacity: 1, height: "auto" }}
                            exit={{ opacity: 0, height: 0 }}
                            className="p-3 bg-zinc-950/80 border border-zinc-800 rounded-xl space-y-3"
                          >
                            {/* Option A: Custom Redirect URI */}
                            <div className="space-y-1.5">
                              <label className="text-[10px] font-bold text-zinc-300 uppercase tracking-wider font-mono">
                                1. Personalizar URL de Retorno (se cadastrou outra na Blizzard):
                              </label>
                              <div className="flex items-center gap-2">
                                <input
                                  type="text"
                                  value={customRedirectUriInput}
                                  onChange={(e) => setCustomRedirectUriInput(e.target.value)}
                                  placeholder="https://sua-url.com/api/blizzard/callback"
                                  className="flex-1 bg-zinc-900 border border-zinc-700 rounded-lg px-2.5 py-1 text-xs text-zinc-200 font-mono focus:outline-none focus:border-cyan-500"
                                />
                                <button
                                  type="button"
                                  onClick={handleSaveCustomRedirectUri}
                                  className="px-2.5 py-1 bg-zinc-800 hover:bg-zinc-700 text-cyan-300 rounded-lg text-xs font-bold cursor-pointer transition-colors border border-cyan-500/30 shrink-0"
                                >
                                  Salvar URL
                                </button>
                                {customRedirectUriInput && (
                                  <button
                                    type="button"
                                    onClick={handleResetDefaultRedirectUri}
                                    className="px-2 py-1 text-zinc-400 hover:text-zinc-200 text-xs underline cursor-pointer"
                                  >
                                    Padrão
                                  </button>
                                )}
                              </div>
                            </div>

                            {/* Option B: Manual Access Token */}
                            <div className="pt-2 border-t border-zinc-800/80 space-y-1.5">
                              <label className="text-[10px] font-bold text-zinc-300 uppercase tracking-wider font-mono flex items-center gap-1">
                                <Key size={11} className="text-amber-400" />
                                <span>2. Conectar com Access Token Manual (dispensa callback):</span>
                              </label>
                              <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap">
                                <input
                                  type="password"
                                  value={manualTokenInput}
                                  onChange={(e) => setManualTokenInput(e.target.value)}
                                  placeholder="Cole seu token OAuth da Blizzard..."
                                  className="flex-1 min-w-[200px] bg-zinc-900 border border-zinc-700 rounded-lg px-2.5 py-1 text-xs text-zinc-200 font-mono focus:outline-none focus:border-cyan-500"
                                />
                                <input
                                  type="text"
                                  value={manualTokenTagInput}
                                  onChange={(e) => setManualTokenTagInput(e.target.value)}
                                  placeholder="BattleTag (ex: Hero#1234)"
                                  className="w-32 bg-zinc-900 border border-zinc-700 rounded-lg px-2.5 py-1 text-xs text-zinc-200 font-mono focus:outline-none focus:border-cyan-500"
                                />
                                <button
                                  type="button"
                                  onClick={handleSaveManualToken}
                                  className="px-2.5 py-1 bg-cyan-700 hover:bg-cyan-600 text-white rounded-lg text-xs font-bold cursor-pointer transition-colors border border-cyan-500/40 shrink-0"
                                >
                                  Salvar Token
                                </button>
                              </div>
                            </div>
                          </motion.div>
                        )}

                        {/* Direct BattleTag entry fallback */}
                        <div className="pt-2 border-t border-zinc-800/80 flex flex-wrap items-center gap-2">
                          <span className="text-[11px] text-zinc-400 font-medium">Ou vincular BattleTag diretamente:</span>
                          <input
                            type="text"
                            value={manualBattleTagInput}
                            onChange={(e) => setManualBattleTagInput(e.target.value)}
                            placeholder="Ex: Arthas#1234"
                            className="bg-zinc-950 border border-zinc-700 rounded-lg px-2.5 py-1 text-xs text-zinc-200 focus:outline-none focus:border-cyan-500 w-36 font-mono"
                          />
                          <button
                            type="button"
                            onClick={handleManualBattleTagConnect}
                            className="px-2.5 py-1 bg-zinc-800 hover:bg-zinc-700 text-cyan-300 rounded-lg text-xs font-bold cursor-pointer transition-colors border border-cyan-500/30"
                          >
                            Vincular Tag
                          </button>
                        </div>
                      </div>
                    )}

                    {/* Game Selection Grid & Region */}
                    <div className="space-y-2 text-left">
                      <div className="flex items-center justify-between flex-wrap gap-2">
                        <label className="text-xs font-bold text-zinc-300 uppercase tracking-wider font-mono">
                          1. Selecione o Jogo Oficial da Blizzard:
                        </label>
                        <div className="flex items-center gap-2">
                          <span className="text-[11px] text-zinc-400 font-mono">Região:</span>
                          <select
                            value={blizzardRegion}
                            onChange={(e) => {
                              const r = e.target.value as any;
                              setBlizzardRegion(r);
                              setStoredBlizzardRegion(r);
                              if (blizzardGameId?.startsWith("wow")) {
                                handleFetchBlizzardCharacters(blizzardGameId, true);
                              }
                            }}
                            className="bg-zinc-900 border border-zinc-700 rounded-lg px-2 py-1 text-xs text-cyan-300 font-mono focus:outline-none focus:border-cyan-500 cursor-pointer"
                          >
                            <option value="us">Américas (US / BR)</option>
                            <option value="eu">Europa (EU)</option>
                            <option value="kr">Coréia (KR)</option>
                            <option value="tw">Taiwan (TW)</option>
                          </select>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
                        {BLIZZARD_OFFICIAL_GAMES.map((bGame) => {
                          const isSelected = blizzardGameId === bGame.id;
                          return (
                            <button
                              key={bGame.id}
                              type="button"
                              onClick={() => handleSelectBlizzardGame(bGame)}
                              className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer flex flex-col justify-between gap-1.5 ${
                                isSelected
                                  ? "bg-cyan-950/80 border-cyan-400 text-white shadow-md shadow-cyan-500/20 ring-1 ring-cyan-400/50"
                                  : "bg-zinc-900/80 border-zinc-800 text-zinc-300 hover:border-zinc-700 hover:bg-zinc-850"
                              }`}
                            >
                              <div className="flex items-center justify-between w-full">
                                <span className="text-[10px] font-mono uppercase px-1.5 py-0.5 rounded bg-zinc-800/80 text-cyan-400 font-bold">
                                  {bGame.category}
                                </span>
                                {bGame.isWow && (
                                  <span className="text-[9px] px-1 py-0.2 rounded bg-amber-500/20 text-amber-300 font-bold border border-amber-500/30">
                                    WoW API
                                  </span>
                                )}
                              </div>
                              <span className="text-xs font-bold truncate leading-tight mt-1">{bGame.name}</span>
                              <span className="text-[10px] text-zinc-500 line-clamp-1">{bGame.description}</span>
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    {/* WoW Character & Armory Importer if WoW game is chosen */}
                    {blizzardGameId && (blizzardGameId.startsWith("wow") || blizzardGameId === "warcraft-3-reforged") && (
                      <div className="p-4 rounded-xl bg-zinc-900/90 border border-amber-500/30 text-left space-y-4">
                        {/* 2.1. Dedicated WoW Version Selector */}
                        <div className="space-y-2 pb-3 border-b border-zinc-800">
                          <div className="flex items-center justify-between flex-wrap gap-1.5">
                            <label className="text-xs font-bold text-amber-300 uppercase tracking-wider font-mono flex items-center gap-1.5">
                              <Layers size={13} className="text-amber-400" />
                              <span>2. Versão do World of Warcraft (Reflete Armory, Addon e Banco):</span>
                            </label>
                            <span className="text-[10px] text-zinc-400 font-mono">
                              Versão Ativa: <strong className="text-cyan-300 font-bold uppercase">{selectedWowVersion}</strong>
                            </span>
                          </div>

                          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                            {[
                              {
                                id: "forever" as const,
                                name: "WoW Forever (Vanilla+)",
                                sub: "Lançamento Oficial 04/Nov • Principal",
                                desc: "Rulesets customizados, World Boss Timers e Banco Clássico (Sem Warband/M+)",
                                badge: "⭐ Principal",
                                color: "border-cyan-500/70 text-cyan-300 bg-cyan-950/60 ring-1 ring-cyan-400/40",
                                defaultGameId: "wow-forever",
                              },
                              {
                                id: "forever_beta" as const,
                                name: "WoW Forever Beta",
                                sub: "Build 16001 em Testes",
                                desc: "Ambiente do beta com proteção a Secret Health Values e Dead Secure SNI",
                                badge: "Beta 16001",
                                color: "border-rose-500/60 text-rose-300 bg-rose-950/40",
                                defaultGameId: "wow-forever",
                              },
                              {
                                id: "classic" as const,
                                name: "WoW Classic Era",
                                sub: "Vanilla 1.15.x Histórico",
                                desc: "Level 60, talentos clássicos de 51 pontos e World Bosses (Kazzak/Azuregos)",
                                badge: "1.15 Era",
                                color: "border-amber-500/60 text-amber-300 bg-amber-950/40",
                                defaultGameId: "wow-classic",
                              },
                              {
                                id: "retail" as const,
                                name: "WoW Retail",
                                sub: "The War Within / Midnight",
                                desc: "Cofre de Guerra (Warband), Mítico+ Keystone e The Great Vault",
                                badge: "11.x Modern",
                                color: "border-purple-500/60 text-purple-300 bg-purple-950/40",
                                defaultGameId: "wow-retail",
                              },
                              {
                                id: "mop" as const,
                                name: "Classic MoP",
                                sub: "Pandaria Progression",
                                desc: "Level 90, talentos de Mists of Pandaria e coleções",
                                badge: "Level 90",
                                color: "border-emerald-500/60 text-emerald-300 bg-emerald-950/40",
                                defaultGameId: "wow-mop",
                              },
                              {
                                id: "tbc" as const,
                                name: "Classic TBC",
                                sub: "The Burning Crusade",
                                desc: "Level 70 e Terralém",
                                badge: "Level 70",
                                color: "border-teal-500/60 text-teal-300 bg-teal-950/40",
                                defaultGameId: "wow-tbc",
                              },
                            ].map((ver) => {
                              const isSelected = selectedWowVersion === ver.id;
                              return (
                                <button
                                  key={ver.id}
                                  type="button"
                                  onClick={() => {
                                    setSelectedWowVersion(ver.id);
                                    setBlizzardGameId(ver.defaultGameId);
                                    handleFetchBlizzardCharacters(ver.defaultGameId, false);
                                  }}
                                  className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer flex flex-col justify-between ${
                                    isSelected
                                      ? ver.color + " shadow-md"
                                      : "bg-zinc-950/50 border-zinc-800 text-zinc-400 hover:border-zinc-700 hover:text-zinc-200"
                                  }`}
                                >
                                  <div className="flex items-center justify-between gap-1 w-full">
                                    <span className="text-xs font-bold truncate">{ver.name}</span>
                                    <span className="text-[9px] font-mono px-1.5 py-0.2 rounded bg-black/40 border border-white/10 shrink-0">
                                      {ver.badge}
                                    </span>
                                  </div>
                                  <span className="text-[10px] text-zinc-400 font-medium mt-0.5">{ver.sub}</span>
                                  <span className="text-[9px] text-zinc-500 line-clamp-1 mt-0.5">{ver.desc}</span>
                                </button>
                              );
                            })}
                          </div>
                        </div>

                        <div className="flex items-center justify-between flex-wrap gap-2">
                          <div className="flex items-center gap-2">
                            <Trophy size={14} className="text-amber-400" />
                            <h5 className="text-xs font-bold text-amber-300 uppercase tracking-wider font-mono">
                              3. Sincronização de Personagem & Armory ({blizzardGameName || "World of Warcraft"})
                            </h5>
                          </div>

                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              onClick={() => handleFetchBlizzardCharacters(blizzardGameId, true)}
                              disabled={isLoadingBlizzardChars}
                              className="px-2.5 py-1 rounded-lg bg-amber-950/60 border border-amber-500/40 text-amber-300 hover:bg-amber-900/60 text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                            >
                              {isLoadingBlizzardChars ? (
                                <Loader2 size={12} className="animate-spin text-amber-400" />
                              ) : (
                                <RefreshCw size={12} />
                              )}
                              <span>Sincronizar Personagens</span>
                            </button>
                          </div>
                        </div>

                        {/* Character selector dropdown */}
                        {blizzardCharacters.length > 0 ? (
                          <div className="space-y-2">
                            <label className="text-[11px] text-zinc-400 font-medium block">
                              Selecione seu personagem principal ({blizzardCharacters.length} personagem{blizzardCharacters.length > 1 ? "s" : ""} disponível{blizzardCharacters.length > 1 ? "is" : ""}):
                            </label>
                            <div className="flex flex-wrap gap-2 items-center">
                              {(() => {
                                const matchedOption = blizzardCharacters.find(
                                  (c) =>
                                    `${c.name}-${c.realmSlug || c.realm}`.toLowerCase() === (blizzardSelectedCharacter || "").toLowerCase() ||
                                    c.name.toLowerCase() === (blizzardSelectedCharacter || "").split("-")[0]?.toLowerCase()
                                );
                                const effectiveSelectVal = matchedOption
                                  ? `${matchedOption.name}-${matchedOption.realmSlug || matchedOption.realm}`
                                  : blizzardSelectedCharacter;

                                return (
                                  <select
                                    value={effectiveSelectVal}
                                    onChange={(e) => {
                                      const val = e.target.value;
                                      setBlizzardSelectedCharacter(val);
                                      const match = blizzardCharacters.find(
                                        (c) => `${c.name}-${c.realmSlug || c.realm}`.toLowerCase() === val.toLowerCase()
                                      );
                                      if (match) {
                                        try {
                                          if (game?.id) {
                                            localStorage.setItem(`halo_blizzard_selected_char_${game.id}`, val);
                                            localStorage.setItem(`halo_blizzard_selected_name_${game.id}`, match.name);
                                          }
                                          if (blizzardGameId) {
                                            localStorage.setItem(`halo_blizzard_selected_char_${blizzardGameId}`, val);
                                            localStorage.setItem(`halo_blizzard_selected_name_${blizzardGameId}`, match.name);
                                          }
                                          localStorage.setItem("halo_blizzard_selected_char_global", val);
                                          localStorage.setItem("halo_blizzard_selected_name_global", match.name);
                                        } catch {}
                                        handleFetchBlizzardProfile(match.name, match.realmSlug || match.realm, blizzardGameId, match);
                                      }
                                    }}
                                    className="bg-zinc-950 border border-amber-500/40 rounded-xl px-3 py-2 text-xs text-white font-mono focus:outline-none focus:border-amber-400 cursor-pointer flex-1 min-w-[200px]"
                                  >
                                    {blizzardCharacters.map((char) => {
                                      const verLabel = char.wow_version === "retail" ? "Retail" : (char.wow_version === "mop" ? "Progression (MoP)" : (char.wow_version === "tbc" ? "TBC" : "Classic Era"));
                                      return (
                                        <option key={`${char.name}-${char.realmSlug || char.realm}`} value={`${char.name}-${char.realmSlug || char.realm}`}>
                                          {char.name} — Nvl {char.level} {char.characterClass || ""} ({char.realm}) {char.faction === "HORDE" ? "🔴 Horda" : "🔵 Aliança"} • [{verLabel}]
                                        </option>
                                      );
                                    })}
                                  </select>
                                );
                              })()}
                            </div>
                          </div>
                        ) : (
                          <div className="text-xs text-zinc-400 italic bg-zinc-950/60 p-3 rounded-lg border border-zinc-800 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                            <span>
                              {isBlizzardLoggedIn
                                ? "Nenhum personagem carregado no momento. Clique para sincronizar ou busque diretamente no Armory abaixo."
                                : "Faça login com a Battle.net acima ou busque qualquer personagem diretamente pelo Armory oficial abaixo."}
                            </span>
                            <button
                              type="button"
                              onClick={() => handleFetchBlizzardCharacters(blizzardGameId, true)}
                              className="text-xs text-amber-400 hover:text-amber-300 underline font-semibold cursor-pointer shrink-0"
                            >
                              Carregar Personagens
                            </button>
                          </div>
                        )}

                        {/* Direct Blizzard Armory Character Search */}
                        <div className="pt-2 border-t border-zinc-800/80 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
                          <div className="flex items-center gap-1.5 text-[11px] text-zinc-400 font-medium">
                            <Search size={12} className="text-cyan-400" />
                            <span>Buscar no Armory Oficial:</span>
                          </div>
                          <div className="flex items-center gap-1.5 w-full sm:w-auto">
                            <input
                              type="text"
                              placeholder="Reino (ex: Azralon)"
                              value={manualRealmInput}
                              onChange={(e) => setManualRealmInput(e.target.value)}
                              className="bg-zinc-950 border border-zinc-700/80 rounded-lg px-2.5 py-1 text-xs text-white w-28 focus:border-cyan-400 focus:outline-none"
                            />
                            <input
                              type="text"
                              placeholder="Nome do Personagem"
                              value={manualCharNameInput}
                              onChange={(e) => setManualCharNameInput(e.target.value)}
                              onKeyDown={(e) => {
                                if (e.key === "Enter") {
                                  e.preventDefault();
                                  handleDirectArmorySearch();
                                }
                              }}
                              className="bg-zinc-950 border border-zinc-700/80 rounded-lg px-2.5 py-1 text-xs text-white w-36 focus:border-cyan-400 focus:outline-none"
                            />
                            <button
                              type="button"
                              onClick={handleDirectArmorySearch}
                              disabled={isSearchingArmory}
                              className="px-2.5 py-1 rounded-lg bg-cyan-950/80 border border-cyan-500/50 text-cyan-300 hover:bg-cyan-900/80 text-xs font-bold transition-all flex items-center gap-1 cursor-pointer disabled:opacity-50 shrink-0"
                            >
                              {isSearchingArmory ? <Loader2 size={12} className="animate-spin text-cyan-400" /> : <Search size={12} />}
                              <span>Buscar</span>
                            </button>
                          </div>
                        </div>

                        {/* Active Character Preview Card */}
                        {blizzardProfileData && (
                          <div className="p-3 bg-zinc-950 rounded-xl border border-amber-500/40 flex items-center justify-between flex-wrap gap-3">
                            <div className="flex items-center gap-3">
                              <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-black text-sm border ${
                                blizzardProfileData.faction === "HORDE" 
                                  ? "bg-red-950/60 border-red-500 text-red-400" 
                                  : "bg-blue-950/60 border-blue-500 text-blue-400"
                              }`}>
                                {blizzardProfileData.faction === "HORDE" ? "H" : "A"}
                              </div>
                              <div>
                                <div className="flex items-center gap-2">
                                  <span className="text-sm font-bold text-white">{blizzardProfileData.name}</span>
                                  <span className="text-xs text-amber-400 font-mono">Nvl {blizzardProfileData.level}</span>
                                  <span className="text-[10px] px-1.5 py-0.2 rounded bg-zinc-800 text-zinc-300 font-mono">
                                    {blizzardProfileData.realm}
                                  </span>
                                </div>
                                <p className="text-[11px] text-zinc-400">
                                  {blizzardProfileData.race} {blizzardProfileData.characterClass} • {blizzardProfileData.activeSpec || "Ativo"}
                                </p>
                              </div>
                            </div>

                            <div className="flex items-center gap-3">
                              {blizzardProfileData.equippedItemLevel && (
                                <div className="text-right">
                                  <span className="text-[10px] uppercase text-zinc-500 font-bold block">iLvl</span>
                                  <span className="text-sm font-mono font-black text-purple-400">
                                    {blizzardProfileData.equippedItemLevel}
                                  </span>
                                </div>
                              )}
                              {blizzardProfileData.achievementPoints !== undefined && (
                                <div className="text-right">
                                  <span className="text-[10px] uppercase text-zinc-500 font-bold block">Conquistas</span>
                                  <span className="text-sm font-mono font-black text-amber-400">
                                    {blizzardProfileData.achievementPoints} pts
                                  </span>
                                </div>
                              )}
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}

                {/* NONE PANEL */}
                {integrationPlatform === "none" && (
                  <div className="text-center py-3 text-xs text-zinc-500 italic">
                    Nenhuma integração de loja ativa para este jogo. Serão exibidos apenas dados e tempos manuais.
                  </div>
                )}
              </div>

                  </div>
                </div>

                {/* Form Bottom Actions Footer */}
                <div className="pt-5 flex flex-wrap items-center justify-between gap-3 border-t border-zinc-800">
                  <button
                    type="button"
                    onClick={() => handleOpenIgdbSearch(name)}
                    disabled={isFetchingIgdb}
                    className="px-5 py-3 rounded-2xl bg-emerald-950/80 hover:bg-emerald-900 border border-emerald-500/50 text-emerald-300 hover:text-emerald-200 font-bold text-sm transition-all flex items-center gap-2 cursor-pointer shadow-lg shadow-emerald-950/40 active:scale-95 disabled:opacity-50"
                    title="Pesquisar qualquer jogo no IGDB para comparar e importar dados seletivamente"
                  >
                    {isFetchingIgdb ? (
                      <>
                        <Loader2 size={16} className="animate-spin text-emerald-400" />
                        <span>Buscando no IGDB...</span>
                      </>
                    ) : (
                      <>
                        <Search size={16} className="text-emerald-400" />
                        <span>Procurar no IGDB</span>
                      </>
                    )}
                  </button>

                  <div className="flex items-center gap-3">
                    <button
                      type="button"
                      onClick={onClose}
                      className="px-5 py-3 rounded-2xl bg-zinc-900 border border-zinc-800 text-zinc-300 font-semibold hover:bg-zinc-800 transition-all text-sm cursor-pointer"
                    >
                      Cancelar
                    </button>
                    <button
                      type="submit"
                      className="btn-neon px-5 py-3 rounded-2xl bg-gradient-to-r from-purple-600 to-cyan-500 text-white font-bold text-sm cursor-pointer"
                    >
                      Salvar Ficha
                    </button>
                  </div>
                </div>
              </form>
            </div>

            {/* Modal de confirmação inteligente de Replay */}
            {showReplayPromptModal && (
              <AnimatePresence>
                <div className="fixed inset-0 z-[100000] flex items-center justify-center p-4">
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="absolute inset-0 bg-black/85 backdrop-blur-md"
                    onClick={() => setShowReplayPromptModal(false)}
                  />
                  <motion.div
                    initial={{ opacity: 0, scale: 0.9, y: 20 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.9, y: 20 }}
                    className="w-full max-w-md bg-zinc-950 border-2 border-purple-500/60 rounded-3xl p-6 shadow-[0_0_50px_rgba(168,85,247,0.3)] relative z-10 space-y-5 text-white"
                  >
                    <div className="flex items-start gap-3.5">
                      <div className="w-12 h-12 rounded-2xl bg-purple-950/80 border border-purple-500/50 text-purple-300 flex items-center justify-center shrink-0 shadow-lg shadow-purple-500/20">
                        <RotateCcw size={24} className="stroke-[2.5]" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <span className="text-[10px] font-black uppercase tracking-widest text-purple-400 font-mono">
                          Replay Inteligente Detectado
                        </span>
                        <h3 className="text-lg font-black text-white leading-tight mt-0.5">
                          Adicionar +1 Marcador de Replay?
                        </h3>
                        <p className="text-xs text-zinc-400 mt-1 leading-relaxed">
                          Identificamos que você está alterando o status de <strong className="text-purple-200">{name || game?.name || "este jogo"}</strong> de <span className="text-zinc-300 italic font-semibold">{pendingReplayPreviousStatus.join(", ") || "Inativo/Concluído"}</span> para <span className="text-emerald-400 font-bold">Jogando</span>.
                        </p>
                      </div>
                    </div>

                    {/* Visual Transição de Replays */}
                    <div className="p-3.5 rounded-2xl bg-zinc-900/90 border border-purple-500/30 flex items-center justify-between gap-3 font-mono">
                      <div className="flex flex-col gap-0.5">
                        <span className="text-[10px] uppercase tracking-wider text-zinc-400 font-bold font-sans">Contagem Atual:</span>
                        <span className="text-xs font-bold text-zinc-300 bg-zinc-950 px-2.5 py-1 rounded-lg border border-zinc-800">
                          {replayed ? (replayCount || 1) : 0}x Replays
                        </span>
                      </div>

                      <div className="text-purple-400 font-black text-xl">➔</div>

                      <div className="flex flex-col gap-0.5 text-right">
                        <span className="text-[10px] uppercase tracking-wider text-purple-300 font-bold font-sans">Nova Contagem:</span>
                        <span className="text-sm font-black text-purple-200 bg-purple-950 px-3 py-1 rounded-lg border border-purple-500/60 shadow-md">
                          {(replayed ? (replayCount || 1) : 0) + 1}x Replay
                        </span>
                      </div>
                    </div>

                    {/* Opção para arquivar tempo da campanha em Tempo Extra */}
                    {parsePlaytimeHours(playtime) > 0 && (
                      <label className="flex items-start gap-2.5 p-3 rounded-2xl bg-zinc-900/60 border border-purple-900/40 cursor-pointer select-none">
                        <input
                          type="checkbox"
                          checked={autoArchivePlaytime}
                          onChange={(e) => setAutoArchivePlaytime(e.target.checked)}
                          className="mt-0.5 rounded border-zinc-800 bg-zinc-950 text-purple-500 focus:ring-purple-500 h-4 w-4 accent-purple-500 shrink-0"
                        />
                        <div className="text-xs leading-relaxed">
                          <span className="font-bold text-purple-200 block">
                            Mover {formatHoursAndMinutes(parsePlaytimeHours(playtime))} para Tempo Extra
                          </span>
                          <span className="text-[11px] text-zinc-400 font-sans">
                            Preserva as horas da jogatina anterior em Tempo Extra e reseta o Tempo Atual para sua nova campanha.
                          </span>
                        </div>
                      </label>
                    )}

                    <div className="flex flex-col sm:flex-row gap-2 pt-1">
                      <button
                        type="button"
                        onClick={() => handleConfirmReplayPrompt(true)}
                        className="flex-1 px-4 py-3 rounded-2xl bg-gradient-to-r from-purple-600 to-cyan-600 hover:from-purple-500 hover:to-cyan-500 transition-all text-white font-extrabold text-xs sm:text-sm shadow-lg shadow-purple-500/25 flex items-center justify-center gap-2 cursor-pointer active:scale-95"
                      >
                        <RotateCcw size={16} />
                        <span>Sim, Adicionar +1 Replay</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => handleConfirmReplayPrompt(false)}
                        className="px-4 py-3 rounded-2xl bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 transition-all text-zinc-300 font-bold text-xs cursor-pointer active:scale-95"
                      >
                        Apenas Mudar Status
                      </button>
                    </div>
                  </motion.div>
                </div>
              </AnimatePresence>
            )}

            {/* Modal de Galeria de Mídias SteamGridDB */}
            {showSteamGridModal && (
              <AnimatePresence>
                <div className="fixed inset-0 z-[100000] flex items-center justify-center p-2 sm:p-4">
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="absolute inset-0 bg-black/85 backdrop-blur-md"
                    onClick={() => {
                      if (!previewMediaItem) setShowSteamGridModal(false);
                    }}
                  />
                  <motion.div
                    initial={{ opacity: 0, scale: 0.95, y: 16 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.95, y: 16 }}
                    className="w-[94vw] max-w-[96vw] h-[88vh] max-h-[92vh] bg-zinc-950 border-2 border-cyan-500/60 rounded-3xl p-3.5 sm:p-6 shadow-[0_0_60px_rgba(6,182,212,0.3)] relative z-10 flex flex-col space-y-3.5 text-white overflow-hidden"
                  >
                    {/* Header da Galeria */}
                    <div className="flex items-center justify-between border-b border-zinc-800 pb-3 shrink-0">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-2xl bg-cyan-950/80 border border-cyan-500/50 text-cyan-400 flex items-center justify-center shrink-0 shadow-inner">
                          <ImageIcon size={20} />
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <h3 className="text-base font-black text-white flex items-center gap-2">
                              Galeria de Mídias SteamGridDB
                            </h3>
                            <span className="text-[10px] font-bold text-cyan-400 bg-cyan-950/80 border border-cyan-500/40 px-2 py-0.5 rounded-full font-mono">
                              Alta Definição
                            </span>
                            {selectedSteamGridGame && (
                              <span className="hidden sm:inline-flex text-[11px] text-zinc-400 font-mono">
                                • {selectedSteamGridGame.name} (ID: {selectedSteamGridGame.id})
                              </span>
                            )}
                          </div>
                          <p className="text-xs text-zinc-400">
                            Capas (Grids), Banners Panorâmicos (Heroes), Logotipos PNG e Ícones de Perfil para <strong className="text-cyan-300">{name || "este jogo"}</strong>.
                          </p>
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={() => setShowSteamGridModal(false)}
                        className="p-2 rounded-xl text-zinc-400 hover:text-white hover:bg-zinc-900 border border-zinc-800 transition-colors cursor-pointer"
                      >
                        <X size={18} />
                      </button>
                    </div>

                    {/* Barra de Pesquisa e Troca de Jogo */}
                    <div className="flex flex-col sm:flex-row gap-2 shrink-0">
                      <div className="flex-1 flex gap-2">
                        <div className="relative flex-1">
                          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" />
                          <input
                            type="text"
                            value={steamGridSearchTerm}
                            onChange={(e) => setSteamGridSearchTerm(e.target.value)}
                            placeholder="Buscar jogo no SteamGridDB (ex: God of War, Half-Life 2)..."
                            className="w-full pl-9 pr-3 py-2 rounded-xl bg-zinc-900 border border-zinc-800 focus:outline-none focus:border-cyan-500 text-white text-xs font-medium"
                            onKeyDown={(e) => {
                              if (e.key === "Enter") {
                                e.preventDefault();
                                handleOpenSteamGridGallery(steamGridSearchTerm, steamGridTargetMode);
                              }
                            }}
                          />
                        </div>
                        <button
                          type="button"
                          onClick={() => handleOpenSteamGridGallery(steamGridSearchTerm, steamGridTargetMode)}
                          disabled={isLoadingSteamGridMedia}
                          className="px-3.5 py-2 rounded-xl bg-cyan-600 hover:bg-cyan-500 disabled:opacity-50 text-white text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer shrink-0 shadow-sm"
                        >
                          {isLoadingSteamGridMedia ? <Loader2 size={13} className="animate-spin" /> : <Search size={13} />}
                          <span>Pesquisar</span>
                        </button>
                      </div>

                      {/* Dropdown de Variações/Edições encontradas no SteamGridDB */}
                      {steamGridCandidates.length > 1 && (
                        <div className="flex items-center gap-1.5">
                          <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider shrink-0 hidden md:inline">
                            Edições:
                          </label>
                          <select
                            value={selectedSteamGridGame?.id || ""}
                            onChange={(e) => {
                              const gameId = Number(e.target.value);
                              const found = steamGridCandidates.find(c => c.id === gameId);
                              if (found) {
                                handleOpenSteamGridGallery(found.name, steamGridTargetMode, found.id);
                              }
                            }}
                            className="px-2.5 py-2 rounded-xl bg-zinc-900 border border-zinc-800 text-xs text-cyan-300 font-medium focus:outline-none focus:border-cyan-500 cursor-pointer"
                          >
                            {steamGridCandidates.map((cand) => (
                              <option key={cand.id} value={cand.id}>
                                {cand.name} {cand.release_date ? `(${new Date(cand.release_date * 1000).getFullYear()})` : ""}
                              </option>
                            ))}
                          </select>
                        </div>
                      )}
                    </div>

                    {/* Filtros de Tipo de Mídia */}
                    <div className="flex flex-wrap items-center justify-between gap-2 shrink-0">
                      <div className="flex flex-wrap items-center gap-1.5 p-1 bg-zinc-900/90 rounded-xl border border-zinc-800">
                        <button
                          type="button"
                          onClick={() => setActiveSteamGridFilter("all")}
                          className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                            activeSteamGridFilter === "all"
                              ? "bg-cyan-500 text-zinc-950 shadow-md shadow-cyan-500/30"
                              : "text-zinc-400 hover:text-zinc-200"
                          }`}
                        >
                          Todas ({steamGridMediaList.length})
                        </button>
                        <button
                          type="button"
                          onClick={() => setActiveSteamGridFilter("grid")}
                          className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                            activeSteamGridFilter === "grid"
                              ? "bg-cyan-500 text-zinc-950 shadow-md shadow-cyan-500/30"
                              : "text-zinc-400 hover:text-zinc-200"
                          }`}
                        >
                          Capas / Grids ({steamGridMediaList.filter(m => m.type === "grid").length})
                        </button>
                        <button
                          type="button"
                          onClick={() => setActiveSteamGridFilter("hero")}
                          className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                            activeSteamGridFilter === "hero"
                              ? "bg-cyan-500 text-zinc-950 shadow-md shadow-cyan-500/30"
                              : "text-zinc-400 hover:text-zinc-200"
                          }`}
                        >
                          Heroes / Banners ({steamGridMediaList.filter(m => m.type === "hero").length})
                        </button>
                        <button
                          type="button"
                          onClick={() => setActiveSteamGridFilter("logo")}
                          className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                            activeSteamGridFilter === "logo"
                              ? "bg-cyan-500 text-zinc-950 shadow-md shadow-cyan-500/30"
                              : "text-zinc-400 hover:text-zinc-200"
                          }`}
                        >
                          Logos Transparentes ({steamGridMediaList.filter(m => m.type === "logo").length})
                        </button>
                        <button
                          type="button"
                          onClick={() => setActiveSteamGridFilter("icon")}
                          className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                            activeSteamGridFilter === "icon"
                              ? "bg-cyan-500 text-zinc-950 shadow-md shadow-cyan-500/30"
                              : "text-zinc-400 hover:text-zinc-200"
                          }`}
                        >
                          Ícones ({steamGridMediaList.filter(m => m.type === "icon").length})
                        </button>
                      </div>

                      {/* Sub-filtro de orientação para Grids */}
                      {activeSteamGridFilter === "grid" && (
                        <div className="flex items-center gap-1 text-xs">
                          <span className="text-zinc-400 text-[10px] uppercase font-bold mr-1">Formato:</span>
                          <button
                            type="button"
                            onClick={() => setSteamGridGridOrientation("all")}
                            className={`px-2 py-1 rounded-md text-[11px] font-semibold transition-all ${
                              steamGridGridOrientation === "all" ? "bg-zinc-800 text-cyan-400 border border-cyan-500/30" : "text-zinc-400 hover:text-zinc-200"
                            }`}
                          >
                            Todos
                          </button>
                          <button
                            type="button"
                            onClick={() => setSteamGridGridOrientation("vertical")}
                            className={`px-2 py-1 rounded-md text-[11px] font-semibold transition-all ${
                              steamGridGridOrientation === "vertical" ? "bg-zinc-800 text-cyan-400 border border-cyan-500/30" : "text-zinc-400 hover:text-zinc-200"
                            }`}
                          >
                            Verticais (600x900)
                          </button>
                          <button
                            type="button"
                            onClick={() => setSteamGridGridOrientation("horizontal")}
                            className={`px-2 py-1 rounded-md text-[11px] font-semibold transition-all ${
                              steamGridGridOrientation === "horizontal" ? "bg-zinc-800 text-cyan-400 border border-cyan-500/30" : "text-zinc-400 hover:text-zinc-200"
                            }`}
                          >
                            Horizontais (920x430)
                          </button>
                        </div>
                      )}
                    </div>

                    {/* Conteúdo da Galeria */}
                    <div className="flex-1 overflow-y-auto pr-1">
                      {isLoadingSteamGridMedia ? (
                        <div className="flex flex-col items-center justify-center py-20 text-center space-y-3">
                          <Loader2 size={36} className="animate-spin text-cyan-400" />
                          <p className="text-sm font-semibold text-zinc-300">
                            Buscando mídias em alta resolução no SteamGridDB...
                          </p>
                        </div>
                      ) : steamGridMediaList.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-16 text-center space-y-3 bg-zinc-900/30 rounded-2xl border border-zinc-850">
                          <ImageIcon size={40} className="text-zinc-600" />
                          <p className="text-sm font-semibold text-zinc-300">
                            Nenhuma mídia encontrada no SteamGridDB para "{steamGridSearchTerm}".
                          </p>
                          <p className="text-xs text-zinc-500 max-w-md">
                            Tente pesquisar pelo título em inglês do jogo ou verifique a conexão da API nas Configurações do Sistema.
                          </p>
                        </div>
                      ) : (
                        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 2xl:grid-cols-7 gap-3 sm:gap-4">
                          {steamGridMediaList
                            .filter(m => {
                              if (activeSteamGridFilter !== "all" && m.type !== activeSteamGridFilter) return false;
                              if (activeSteamGridFilter === "grid" && steamGridGridOrientation !== "all") {
                                if (steamGridGridOrientation === "vertical" && m.width > m.height) return false;
                                if (steamGridGridOrientation === "horizontal" && m.height >= m.width) return false;
                              }
                              return true;
                            })
                            .map((item) => {
                              const isVerticalGrid = item.type === "grid" && item.height >= item.width;
                              const isHorizontalHero = item.type === "hero" || (item.type === "grid" && item.width > item.height);
                              const isSquareLike = item.type === "icon" || item.type === "logo";

                              return (
                                <div
                                  key={item.id}
                                  className="group relative rounded-2xl overflow-hidden bg-zinc-900/90 border border-zinc-800 hover:border-cyan-500/70 transition-all flex flex-col shadow-md"
                                >
                                  {/* Thumbnail Container */}
                                  <div
                                    className={`w-full overflow-hidden bg-black/60 relative flex items-center justify-center cursor-pointer ${
                                      isVerticalGrid
                                        ? "aspect-[2/3]"
                                        : isHorizontalHero
                                        ? "aspect-[16/8]"
                                        : isSquareLike
                                        ? "aspect-[1/1] p-3"
                                        : "aspect-[16/10]"
                                    }`}
                                    onClick={() => setPreviewMediaItem(item)}
                                    title="Clique para abrir Pré-visualização em Alta Resolução"
                                  >
                                    {/* Checkerboard Pattern for transparent PNGs */}
                                    {(item.type === "logo" || item.type === "icon") && (
                                      <div
                                        className="absolute inset-0 opacity-15"
                                        style={{
                                          backgroundImage:
                                            "linear-gradient(45deg, #404040 25%, transparent 25%), linear-gradient(-45deg, #404040 25%, transparent 25%), linear-gradient(45deg, transparent 75%, #404040 75%), linear-gradient(-45deg, transparent 75%, #404040 75%)",
                                          backgroundSize: "16px 16px",
                                          backgroundPosition: "0 0, 0 8px, 8px -8px, -8px 0px",
                                        }}
                                      />
                                    )}

                                    <img
                                      src={item.thumb || item.url}
                                      alt={item.title || "SteamGridDB Media"}
                                      className={`w-full h-full group-hover:scale-105 transition-transform duration-300 ${
                                        item.type === "logo" || item.type === "icon" ? "object-contain relative z-10" : "object-cover"
                                      }`}
                                      loading="lazy"
                                      referrerPolicy="no-referrer"
                                      onError={(e) => {
                                        (e.target as HTMLImageElement).src = "https://placehold.co/300x300/0c0a0f/ffffff?text=SteamGridDB";
                                      }}
                                    />

                                    {/* Top Badges */}
                                    <div className="absolute top-2 left-2 right-2 flex items-center justify-between pointer-events-none z-20">
                                      <span
                                        className={`text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded-md backdrop-blur-md shadow-sm ${
                                          item.type === "grid"
                                            ? "bg-rose-950/80 text-rose-300 border border-rose-500/40"
                                            : item.type === "hero"
                                            ? "bg-purple-950/80 text-purple-300 border border-purple-500/40"
                                            : item.type === "logo"
                                            ? "bg-emerald-950/80 text-emerald-300 border border-emerald-500/40"
                                            : "bg-sky-950/80 text-sky-300 border border-sky-500/40"
                                        }`}
                                      >
                                        {item.type === "grid" ? "Grid" : item.type === "hero" ? "Hero" : item.type === "logo" ? "Logo" : "Ícone"}
                                      </span>

                                      <span className="text-[9px] font-mono font-bold text-zinc-300 bg-black/70 border border-white/10 px-1.5 py-0.5 rounded backdrop-blur-md">
                                        {item.width}x{item.height}
                                      </span>
                                    </div>

                                    {/* Center Preview Button Overlay on Hover */}
                                    <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2 z-20">
                                      <button
                                        type="button"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          setPreviewMediaItem(item);
                                        }}
                                        className="p-2 rounded-xl bg-zinc-900/90 hover:bg-cyan-600 text-white border border-white/20 transition-all cursor-pointer shadow-lg flex items-center gap-1 text-xs font-bold"
                                        title="Pré-visualizar em tamanho original"
                                      >
                                        <Eye size={14} />
                                        <span>Prévia</span>
                                      </button>
                                    </div>
                                  </div>

                                  {/* Card Bottom / Action Buttons */}
                                  <div className="p-2.5 bg-zinc-950/95 border-t border-zinc-850 flex flex-col gap-2">
                                    <div className="flex items-center justify-between text-[10px] text-zinc-400 font-mono">
                                      <span className="truncate" title={item.author?.name ? `Autor: ${item.author.name}` : ""}>
                                        {item.author?.name || item.style || "Comunidade"}
                                      </span>
                                      {item.score !== undefined && item.score > 0 && (
                                        <span className="text-amber-400 flex items-center gap-0.5 font-bold">
                                          ★ {item.score}
                                        </span>
                                      )}
                                    </div>

                                    <div className="grid grid-cols-2 gap-1.5">
                                      <button
                                        type="button"
                                        onClick={() => handleSelectSteamGridMediaAsCover(item)}
                                        className="px-2 py-1.5 rounded-xl bg-rose-950/80 hover:bg-rose-900 text-rose-300 border border-rose-500/40 text-[10px] font-bold transition-all flex items-center justify-center gap-1 cursor-pointer active:scale-95 shadow-sm"
                                        title="Aplicar como Capa Principal do Jogo"
                                      >
                                        <Check size={11} />
                                        <span>Capa</span>
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => handleSelectSteamGridMediaAsIcon(item)}
                                        className="px-2 py-1.5 rounded-xl bg-sky-950/80 hover:bg-sky-900 text-sky-300 border border-sky-500/40 text-[10px] font-bold transition-all flex items-center justify-center gap-1 cursor-pointer active:scale-95 shadow-sm"
                                        title="Aplicar como Ícone do Jogo"
                                      >
                                        <Sparkles size={11} className="text-sky-400" />
                                        <span>Ícone</span>
                                      </button>
                                    </div>
                                  </div>
                                </div>
                              );
                            })}
                        </div>
                      )}
                    </div>

                    {/* Rodapé da Galeria */}
                    <div className="flex flex-col sm:flex-row justify-between items-center gap-2 pt-3 border-t border-zinc-800 shrink-0">
                      <p className="text-[11px] text-zinc-500 text-center sm:text-left">
                        💡 Dica: Você pode aplicar Grids/Heroes como Capa ou Logos/Ícones como Ícone da Ficha. Clique em qualquer imagem para abrir a Pré-visualização.
                      </p>
                      <button
                        type="button"
                        onClick={() => setShowSteamGridModal(false)}
                        className="px-4 py-2 rounded-xl bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-xs font-bold text-zinc-300 transition-all cursor-pointer"
                      >
                        Fechar
                      </button>
                    </div>
                  </motion.div>
                </div>
              </AnimatePresence>
            )}

            {/* Modal de Pré-visualização Ampliada (Lightbox / Preview) do SteamGridDB */}
            {previewMediaItem && (
              <AnimatePresence>
                <div className="fixed inset-0 z-[100010] flex items-center justify-center p-4">
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="absolute inset-0 bg-black/90 backdrop-blur-lg"
                    onClick={() => setPreviewMediaItem(null)}
                  />
                  <motion.div
                    initial={{ opacity: 0, scale: 0.9, y: 20 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.9, y: 20 }}
                    className="w-[90vw] max-w-5xl max-h-[92vh] bg-zinc-950 border-2 border-cyan-500/70 rounded-3xl overflow-hidden relative z-20 flex flex-col shadow-[0_0_60px_rgba(6,182,212,0.3)] text-white"
                  >
                    {/* Lightbox Header */}
                    <div className="p-4 border-b border-zinc-800 flex items-center justify-between bg-zinc-950/90 shrink-0">
                      <div className="flex items-center gap-3">
                        <span
                          className={`text-[10px] font-black uppercase tracking-wider px-2.5 py-1 rounded-lg ${
                            previewMediaItem.type === "grid"
                              ? "bg-rose-950 text-rose-300 border border-rose-500/40"
                              : previewMediaItem.type === "hero"
                              ? "bg-purple-950 text-purple-300 border border-purple-500/40"
                              : previewMediaItem.type === "logo"
                              ? "bg-emerald-950 text-emerald-300 border border-emerald-500/40"
                              : "bg-sky-950 text-sky-300 border border-sky-500/40"
                          }`}
                        >
                          {previewMediaItem.type === "grid" ? "Grid / Capa" : previewMediaItem.type === "hero" ? "Hero / Banner" : previewMediaItem.type === "logo" ? "Logo Transparente" : "Ícone de Perfil"}
                        </span>
                        <div>
                          <h4 className="text-sm font-bold text-white">
                            {previewMediaItem.title || name || "Mídia SteamGridDB"}
                          </h4>
                          <p className="text-[11px] text-zinc-400 font-mono">
                            Resolução: <strong className="text-cyan-400">{previewMediaItem.width} × {previewMediaItem.height}</strong>
                            {previewMediaItem.author?.name && ` • Autor: ${previewMediaItem.author.name}`}
                            {previewMediaItem.style && ` • Estilo: ${previewMediaItem.style}`}
                          </p>
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={() => setPreviewMediaItem(null)}
                        className="p-2 rounded-xl text-zinc-400 hover:text-white hover:bg-zinc-900 border border-zinc-800 transition-colors cursor-pointer"
                      >
                        <X size={18} />
                      </button>
                    </div>

                    {/* Image Viewer Area */}
                    <div className="flex-1 overflow-auto p-4 sm:p-6 flex items-center justify-center bg-zinc-900/60 relative min-h-[300px]">
                      {/* Checkerboard Pattern for transparent PNGs */}
                      {(previewMediaItem.type === "logo" || previewMediaItem.type === "icon") && (
                        <div
                          className="absolute inset-0 opacity-20"
                          style={{
                            backgroundImage:
                              "linear-gradient(45deg, #505050 25%, transparent 25%), linear-gradient(-45deg, #505050 25%, transparent 25%), linear-gradient(45deg, transparent 75%, #505050 75%), linear-gradient(-45deg, transparent 75%, #505050 75%)",
                            backgroundSize: "20px 20px",
                            backgroundPosition: "0 0, 0 10px, 10px -10px, -10px 0px",
                          }}
                        />
                      )}

                      <img
                        src={previewMediaItem.url || previewMediaItem.thumb}
                        alt={previewMediaItem.title || "Preview"}
                        className="max-h-[60vh] max-w-full object-contain rounded-xl shadow-2xl relative z-10 border border-white/10"
                        referrerPolicy="no-referrer"
                      />
                    </div>

                    {/* Lightbox Footer Actions */}
                    <div className="p-4 border-t border-zinc-800 bg-zinc-950/95 flex flex-wrap items-center justify-between gap-3 shrink-0">
                      <a
                        href={previewMediaItem.url}
                        target="_blank"
                        rel="noreferrer"
                        className="text-xs text-cyan-400 hover:text-cyan-300 font-mono underline flex items-center gap-1"
                      >
                        <Globe size={13} />
                        <span>Abrir Link Original em Alta Resolução</span>
                      </a>

                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => handleSelectSteamGridMediaAsCover(previewMediaItem)}
                          className="px-4 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs transition-all flex items-center gap-1.5 cursor-pointer shadow-lg shadow-rose-600/25 active:scale-95"
                        >
                          <Check size={14} />
                          <span>Definir como Capa</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => handleSelectSteamGridMediaAsIcon(previewMediaItem)}
                          className="px-4 py-2.5 rounded-xl bg-sky-600 hover:bg-sky-500 text-white font-bold text-xs transition-all flex items-center gap-1.5 cursor-pointer shadow-lg shadow-sky-600/25 active:scale-95"
                        >
                          <Sparkles size={14} />
                          <span>Definir como Ícone</span>
                        </button>
                      </div>
                    </div>
                  </motion.div>
                </div>
              </AnimatePresence>
            )}

            {/* Modal de Pré-visualização e Comparação de Metadados IGDB */}
            {showMetadataPreviewModal && previewCandidateData && (
              <AnimatePresence>
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md">
                  <motion.div
                    initial={{ opacity: 0, scale: 0.95, y: 15 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.95, y: 15 }}
                    className="bg-zinc-950 rounded-2xl max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col border border-cyan-500/50 shadow-2xl shadow-cyan-950/50"
                  >
                    {/* Header */}
                    <div className="p-4 sm:p-5 border-b border-zinc-800 flex justify-between items-center bg-zinc-950/95 shrink-0">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-xl bg-cyan-950/80 border border-cyan-500/40 flex items-center justify-center text-cyan-400">
                          <Eye size={18} />
                        </div>
                        <div>
                          <h4 className="text-base font-bold text-white flex items-center gap-2">
                            <span>Comparação de Metadados:</span>
                            <span className="text-cyan-400 font-extrabold truncate max-w-xs sm:max-w-md">
                              {previewCandidateData.name}
                            </span>
                          </h4>
                          <p className="text-xs text-zinc-400">
                            Revise os dados antes de aplicar. Marque ou desmarque os campos que deseja atualizar na ficha.
                          </p>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => setShowMetadataPreviewModal(false)}
                        className="text-zinc-400 hover:text-white p-1.5 hover:bg-zinc-800 rounded-lg transition-colors cursor-pointer"
                      >
                        <X size={18} />
                      </button>
                    </div>

                    {/* Quick Selection Toolbar */}
                    <div className="bg-zinc-900/60 border-b border-zinc-800/80 px-5 py-2.5 flex items-center justify-between gap-3 text-xs shrink-0">
                      <span className="text-zinc-400 font-medium">
                        Campos selecionados: <strong className="text-cyan-400">{Object.values(selectedPreviewFields).filter(Boolean).length}</strong> de {Object.keys(selectedPreviewFields).length}
                      </span>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => toggleAllPreviewFields(true)}
                          className="text-[11px] font-bold text-cyan-400 hover:text-cyan-300 px-2.5 py-1 rounded-lg bg-cyan-950/50 border border-cyan-500/30 hover:bg-cyan-900/40 transition-colors cursor-pointer"
                        >
                          Marcar Todos
                        </button>
                        <button
                          type="button"
                          onClick={() => toggleAllPreviewFields(false)}
                          className="text-[11px] font-bold text-zinc-400 hover:text-zinc-200 px-2.5 py-1 rounded-lg bg-zinc-900 border border-zinc-800 hover:bg-zinc-800 transition-colors cursor-pointer"
                        >
                          Desmarcar Todos
                        </button>
                      </div>
                    </div>

                    {/* Comparison Table / List */}
                    <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-3">
                      {/* Comparison Row: Capa */}
                      <div
                        onClick={() => togglePreviewField("cover")}
                        className={`p-3.5 rounded-2xl border transition-all cursor-pointer flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between ${
                          selectedPreviewFields.cover
                            ? "bg-cyan-950/20 border-cyan-500/50 shadow-sm"
                            : "bg-zinc-900/30 border-zinc-850 opacity-60 hover:opacity-100"
                        }`}
                      >
                        <div className="flex items-center gap-3 shrink-0">
                          {selectedPreviewFields.cover ? (
                            <CheckSquare size={18} className="text-cyan-400 shrink-0" />
                          ) : (
                            <Square size={18} className="text-zinc-600 shrink-0" />
                          )}
                          <div>
                            <span className="text-xs font-bold text-white uppercase tracking-wider block">
                              Capa HD Oficial
                            </span>
                            <span className="text-[10px] text-zinc-400">Arte e box art em alta resolução</span>
                          </div>
                        </div>

                        <div className="flex items-center gap-4 w-full sm:w-auto justify-between sm:justify-end">
                          <div className="flex items-center gap-2">
                            <span className="text-[10px] font-mono text-zinc-500">Atual:</span>
                            <div className="w-12 h-16 bg-black rounded-lg overflow-hidden border border-zinc-800 shrink-0">
                              {coverUrl ? (
                                <img src={coverUrl} alt="Atual" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                              ) : (
                                <div className="w-full h-full flex items-center justify-center text-[9px] text-zinc-600">Sem Capa</div>
                              )}
                            </div>
                          </div>

                          <ArrowRight size={14} className="text-cyan-500 shrink-0" />

                          <div className="flex items-center gap-2">
                            <span className="text-[10px] font-mono text-emerald-400 font-bold">IGDB:</span>
                            <div className="w-12 h-16 bg-black rounded-lg overflow-hidden border border-cyan-500/40 shrink-0 shadow-md">
                              <img
                                src={previewCandidateData.coverHdUrl || previewCandidateData.coverUrl}
                                alt="IGDB"
                                className="w-full h-full object-cover"
                                referrerPolicy="no-referrer"
                              />
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Comparison Row: Título */}
                      <div
                        onClick={() => togglePreviewField("title")}
                        className={`p-3 rounded-xl border transition-all cursor-pointer flex items-center justify-between gap-4 ${
                          selectedPreviewFields.title
                            ? "bg-cyan-950/20 border-cyan-500/50"
                            : "bg-zinc-900/30 border-zinc-850 opacity-80 hover:opacity-100"
                        }`}
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          {selectedPreviewFields.title ? (
                            <CheckSquare size={17} className="text-cyan-400 shrink-0" />
                          ) : (
                            <Square size={17} className="text-zinc-600 shrink-0" />
                          )}
                          <div>
                            <span className="text-xs font-bold text-zinc-300 uppercase tracking-wider block">
                              Título
                            </span>
                            {!selectedPreviewFields.title && name.trim() && (
                              <span className="text-[10px] text-amber-400 font-mono">
                                Mantendo nome personalizado do seu site
                              </span>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-3 text-xs min-w-0 text-right">
                          <span className="text-zinc-400 truncate max-w-[140px] sm:max-w-[200px]" title={name || "Vazio"}>
                            {name || "(Vazio)"}
                          </span>
                          <ArrowRight size={12} className="text-cyan-500 shrink-0" />
                          <span className="text-cyan-300 font-bold truncate max-w-[160px] sm:max-w-[240px]" title={previewCandidateData.name}>
                            {previewCandidateData.name}
                          </span>
                        </div>
                      </div>

                      {/* Comparison Row: Desenvolvedora */}
                      <div
                        onClick={() => togglePreviewField("developer")}
                        className={`p-3 rounded-xl border transition-all cursor-pointer flex items-center justify-between gap-4 ${
                          selectedPreviewFields.developer
                            ? "bg-cyan-950/20 border-cyan-500/50"
                            : "bg-zinc-900/30 border-zinc-850 opacity-60 hover:opacity-100"
                        }`}
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          {selectedPreviewFields.developer ? (
                            <CheckSquare size={17} className="text-cyan-400 shrink-0" />
                          ) : (
                            <Square size={17} className="text-zinc-600 shrink-0" />
                          )}
                          <span className="text-xs font-bold text-zinc-300 uppercase tracking-wider shrink-0">
                            Desenvolvedor
                          </span>
                        </div>
                        <div className="flex items-center gap-3 text-xs min-w-0 text-right">
                          <span className="text-zinc-400 truncate max-w-[140px]" title={studio || "Vazio"}>
                            {studio || "(Vazio)"}
                          </span>
                          <ArrowRight size={12} className="text-cyan-500 shrink-0" />
                          <span className="text-cyan-300 font-bold truncate max-w-[180px]" title={previewCandidateData.developer || "(Não inf.)"}>
                            {previewCandidateData.developer || "(Não inf.)"}
                          </span>
                        </div>
                      </div>

                      {/* Comparison Row: Publicadora */}
                      <div
                        onClick={() => togglePreviewField("publisher")}
                        className={`p-3 rounded-xl border transition-all cursor-pointer flex items-center justify-between gap-4 ${
                          selectedPreviewFields.publisher
                            ? "bg-cyan-950/20 border-cyan-500/50"
                            : "bg-zinc-900/30 border-zinc-850 opacity-60 hover:opacity-100"
                        }`}
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          {selectedPreviewFields.publisher ? (
                            <CheckSquare size={17} className="text-cyan-400 shrink-0" />
                          ) : (
                            <Square size={17} className="text-zinc-600 shrink-0" />
                          )}
                          <span className="text-xs font-bold text-zinc-300 uppercase tracking-wider shrink-0">
                            Publicadora
                          </span>
                        </div>
                        <div className="flex items-center gap-3 text-xs min-w-0 text-right">
                          <span className="text-zinc-400 truncate max-w-[140px]" title={publisher || "Vazio"}>
                            {publisher || "(Vazio)"}
                          </span>
                          <ArrowRight size={12} className="text-cyan-500 shrink-0" />
                          <span className="text-cyan-300 font-bold truncate max-w-[180px]" title={previewCandidateData.publisher || "(Não inf.)"}>
                            {previewCandidateData.publisher || "(Não inf.)"}
                          </span>
                        </div>
                      </div>

                      {/* Comparison Row: Data de Lançamento */}
                      <div
                        onClick={() => togglePreviewField("releaseDate")}
                        className={`p-3 rounded-xl border transition-all cursor-pointer flex items-center justify-between gap-4 ${
                          selectedPreviewFields.releaseDate
                            ? "bg-cyan-950/20 border-cyan-500/50"
                            : "bg-zinc-900/30 border-zinc-850 opacity-60 hover:opacity-100"
                        }`}
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          {selectedPreviewFields.releaseDate ? (
                            <CheckSquare size={17} className="text-cyan-400 shrink-0" />
                          ) : (
                            <Square size={17} className="text-zinc-600 shrink-0" />
                          )}
                          <span className="text-xs font-bold text-zinc-300 uppercase tracking-wider shrink-0">
                            Lançamento
                          </span>
                        </div>
                        <div className="flex items-center gap-3 text-xs min-w-0 text-right font-mono">
                          <span className="text-zinc-400">
                            {releaseDate || "(Vazio)"}
                          </span>
                          <ArrowRight size={12} className="text-cyan-500 shrink-0" />
                          <span className="text-cyan-300 font-bold">
                            {previewCandidateData.releaseDate || "(Não inf.)"}
                          </span>
                        </div>
                      </div>

                      {/* Comparison Row: Plataformas Disponíveis */}
                      <div
                        onClick={() => togglePreviewField("platforms")}
                        className={`p-3 rounded-xl border transition-all cursor-pointer flex items-center justify-between gap-4 ${
                          selectedPreviewFields.platforms
                            ? "bg-cyan-950/20 border-cyan-500/50"
                            : "bg-zinc-900/30 border-zinc-850 opacity-60 hover:opacity-100"
                        }`}
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          {selectedPreviewFields.platforms ? (
                            <CheckSquare size={17} className="text-cyan-400 shrink-0" />
                          ) : (
                            <Square size={17} className="text-zinc-600 shrink-0" />
                          )}
                          <span className="text-xs font-bold text-zinc-300 uppercase tracking-wider shrink-0">
                            Plataformas Disponíveis
                          </span>
                        </div>
                        <div className="flex items-center gap-3 text-xs min-w-0 text-right">
                          <span className="text-zinc-400 truncate max-w-[120px] sm:max-w-[180px]">
                            {availablePlatforms.join(", ") || "(Nenhuma)"}
                          </span>
                          <ArrowRight size={12} className="text-cyan-500 shrink-0" />
                          <span className="text-cyan-300 font-bold truncate max-w-[160px] sm:max-w-[240px]">
                            {previewCandidateData.platforms?.join(", ") || "(Não inf.)"}
                          </span>
                        </div>
                      </div>

                      {/* Comparison Row: Gêneros */}
                      <div
                        onClick={() => togglePreviewField("genres")}
                        className={`p-3 rounded-xl border transition-all cursor-pointer flex items-center justify-between gap-4 ${
                          selectedPreviewFields.genres
                            ? "bg-cyan-950/20 border-cyan-500/50"
                            : "bg-zinc-900/30 border-zinc-850 opacity-60 hover:opacity-100"
                        }`}
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          {selectedPreviewFields.genres ? (
                            <CheckSquare size={17} className="text-cyan-400 shrink-0" />
                          ) : (
                            <Square size={17} className="text-zinc-600 shrink-0" />
                          )}
                          <span className="text-xs font-bold text-zinc-300 uppercase tracking-wider shrink-0">
                            Gêneros
                          </span>
                        </div>
                        <div className="flex items-center gap-3 text-xs min-w-0 text-right">
                          <span className="text-zinc-400 truncate max-w-[120px] sm:max-w-[180px]">
                            {selectedGenres.join(", ") || "(Vazio)"}
                          </span>
                          <ArrowRight size={12} className="text-cyan-500 shrink-0" />
                          <span className="text-cyan-300 font-bold truncate max-w-[160px] sm:max-w-[240px]">
                            {previewCandidateData.genres?.join(", ") || "(Não inf.)"}
                          </span>
                        </div>
                      </div>

                      {/* Comparison Row: HLTB Times */}
                      <div
                        onClick={() => togglePreviewField("hltb")}
                        className={`p-3 rounded-xl border transition-all cursor-pointer flex items-center justify-between gap-4 ${
                          selectedPreviewFields.hltb
                            ? "bg-cyan-950/20 border-cyan-500/50"
                            : "bg-zinc-900/30 border-zinc-850 opacity-60 hover:opacity-100"
                        }`}
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          {selectedPreviewFields.hltb ? (
                            <CheckSquare size={17} className="text-cyan-400 shrink-0" />
                          ) : (
                            <Square size={17} className="text-zinc-600 shrink-0" />
                          )}
                          <span className="text-xs font-bold text-zinc-300 uppercase tracking-wider shrink-0">
                            HowLongToBeat
                          </span>
                        </div>
                        <div className="flex items-center gap-3 text-xs min-w-0 text-right font-mono">
                          <span className="text-zinc-400">
                            {hltbMain ? `${hltbMain}` : "(Vazio)"}
                          </span>
                          <ArrowRight size={12} className="text-cyan-500 shrink-0" />
                          <span className="text-cyan-300 font-bold">
                            {previewCandidateData.hltbMain ? formatHltbTime(previewCandidateData.hltbMain) : "(Não inf.)"}
                          </span>
                        </div>
                      </div>

                      {/* Comparison Row: IGDB Rating / Metacritic */}
                      <div
                        onClick={() => togglePreviewField("metacritic")}
                        className={`p-3 rounded-xl border transition-all cursor-pointer flex items-center justify-between gap-4 ${
                          selectedPreviewFields.metacritic
                            ? "bg-cyan-950/20 border-cyan-500/50"
                            : "bg-zinc-900/30 border-zinc-850 opacity-60 hover:opacity-100"
                        }`}
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          {selectedPreviewFields.metacritic ? (
                            <CheckSquare size={17} className="text-cyan-400 shrink-0" />
                          ) : (
                            <Square size={17} className="text-zinc-600 shrink-0" />
                          )}
                          <span className="text-xs font-bold text-zinc-300 uppercase tracking-wider shrink-0">
                            Notas & Crítica
                          </span>
                        </div>
                        <div className="flex items-center gap-3 text-xs min-w-0 text-right font-mono">
                          <span className="text-zinc-400">
                            {metacriticCritScore ? `${metacriticCritScore}%` : "(Sem nota)"}
                          </span>
                          <ArrowRight size={12} className="text-cyan-500 shrink-0" />
                          <span className="text-amber-400 font-bold">
                            {previewCandidateData.aggregatedRating || previewCandidateData.rating
                              ? `${Math.round(previewCandidateData.aggregatedRating || previewCandidateData.rating)}%`
                              : "(Sem nota)"}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Footer Actions */}
                    <div className="p-4 sm:p-5 border-t border-zinc-800 bg-zinc-950/95 flex flex-col sm:flex-row items-center justify-between gap-3 shrink-0">
                      <span className="text-xs text-zinc-500 text-center sm:text-left">
                        Os campos selecionados serão mesclados diretamente na ficha técnica atual.
                      </span>
                      <div className="flex items-center gap-2.5 w-full sm:w-auto justify-end">
                        <button
                          type="button"
                          onClick={() => setShowMetadataPreviewModal(false)}
                          className="flex-1 sm:flex-none px-4 py-2 rounded-xl bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-xs font-semibold text-zinc-300 transition-colors cursor-pointer"
                        >
                          Cancelar
                        </button>
                        <button
                          type="button"
                          onClick={applySelectedMetadataFields}
                          className="flex-1 sm:flex-none px-5 py-2 rounded-xl bg-gradient-to-r from-cyan-600 to-teal-600 hover:from-cyan-500 hover:to-teal-500 text-white font-bold text-xs shadow-lg shadow-cyan-900/30 transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                        >
                          <Check size={14} />
                          <span>Aplicar Metadados Selecionados</span>
                        </button>
                      </div>
                    </div>
                  </motion.div>
                </div>
              </AnimatePresence>
            )}
            {/* Modal Amplo de Prós e Contras (90% da Tela) */}
            <ProsConsModal
              isOpen={showProsConsModal}
              onClose={() => setShowProsConsModal(false)}
              initialPros={pros}
              initialCons={cons}
              gameTitle={name || game?.name || "Ficha do Jogo"}
              onSave={(newPros, newCons) => {
                setPros(newPros);
                setCons(newCons);
              }}
            />
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
