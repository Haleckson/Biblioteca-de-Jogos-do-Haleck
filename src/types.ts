/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export interface ActiveLiveSession {
  gameId: string;
  startTimestamp: number; // Date.now() when started
  accumulatedMs: number; // Elapsed ms prior to last pause
  isPaused: boolean;
  pausedTimestamp?: number;
  sessionNotes?: string;
}

export interface MediaItem {
  id?: string;
  src: string;
  isVideo: boolean;
  deleteUrl?: string;
}

export interface DiaryEntry {
  id: string;
  period: string; // e.g. "10/05/2026 ~ 18/05/2026"
  medias: MediaItem[];
  text: string;
  keyMoments?: string[]; // e.g. ["Boss Fight", "Platina", "Plot Twist", "Review Final", "Momento Épico"]
}

export interface TrashItem {
  id: string;
  deletedAt: number; // Date.now()
  type: "game" | "diary_entry" | "media";
  title: string;
  gameId?: string;
  gameTitle?: string;
  diaryEntryId?: string;
  data: any; // Original deleted payload
}

export interface TrophyItem {
  type: "bronze" | "silver" | "gold" | "platinum";
  note?: string;
}

export interface DictionaryFormat {
  textColor?: string;
  bgColor?: string;
  bold?: boolean;
  italic?: boolean;
  underline?: boolean;
  strikethrough?: boolean;
}

export interface DictionaryItem {
  id: string;
  term: string; // Word or phrase, e.g. "Korok Seed" or "Term 1, Term 2"
  variants?: string[]; // Optional variations, plurals, or synonyms, e.g. ["Korok Seeds", "Sementes Korok"] or ["Kakariko Village"]
  group?: string; // Optional group/conjunto name, e.g. "Itens", "Personagens"
  format: DictionaryFormat;
}

export interface Game {
  id: string;
  name: string;
  icon: string;
  iconType: "emoji" | "upload" | "url";
  series: string;
  cover: string;
  status: string[]; // e.g. ["Jogando", "Terminado"]
  platform: string; // Plataforma de Escolha (onde joguei / exibida no card)
  availablePlatforms?: string[] | string; // Plataformas Disponíveis (onde o jogo foi lançado)
  genre: string[];
  tags: string[];
  publisher: string;
  developer?: string;
  studio?: string;
  playtime: string;
  additionalPlaytime?: string;
  rating: number; // 0 to 5, step 0.5
  startDate: string; // YYYY-MM-DD
  endDate: string; // YYYY-MM-DD or empty
  releaseDate: string; // YYYY-MM-DD
  diary: DiaryEntry[];
  dictionary?: DictionaryItem[];
  coverPosition?: number;
  coverPositionX?: number;
  coverZoom?: number;
  replayed?: boolean;
  replayCount?: number;
  replayNote?: string;
  isDlc?: boolean;
  dlcMode?: "none" | "dlc" | "plus_dlc";
  dlcNames?: string;
  difficulty?: string;
  hltbMain?: string;
  hltbExtra?: string;
  hltbCompletionist?: string;
  hltbId?: string;
  metacriticUrl?: string;
  metacriticCritScore?: number;
  metacriticUserScore?: number;
  trophy?: "none" | "bronze" | "silver" | "gold" | "platinum";
  trophies?: (("bronze" | "silver" | "gold" | "platinum") | TrophyItem)[];
  pros?: string;
  cons?: string;
  isGaaS?: boolean;
  pricePaid?: number;
  integrationPlatform?: "steam" | "gog" | "battlenet" | "none";
  steamAppId?: number | string;
  steamPlaytimeMinutes?: number;
  steamLastPlayedTimestamp?: number;
  steamAchievementsCount?: number;
  steamAchievementsTotal?: number;
  gogGameId?: number | string;
  gogPlaytimeMinutes?: number;
  gogLastPlayedTimestamp?: number;
  gogAchievementsCount?: number;
  gogAchievementsTotal?: number;
  // Battle.net / Blizzard specific fields
  blizzardGameId?: string; // e.g. "wow-retail", "wow-classic", "wow-forever", "warcraft3", "diablo4", "overwatch2", "hearthstone", "starcraft2"
  blizzardGameName?: string;
  blizzardRegion?: "us" | "eu" | "kr" | "tw";
  blizzardSelectedCharacter?: string; // e.g. "CharacterName-RealmName"
  blizzardCharacterName?: string;
  blizzardRealm?: string;
  blizzardCharacters?: BlizzardCharacterSummary[];
  blizzardProfileData?: BlizzardProfileData;
  wowVersion?: "retail" | "classic" | "forever" | "tbc" | "mop" | string;
  igdbId?: number;
  igdbRating?: number;
  igdbSlug?: string;
  igdbUrl?: string;
  steamGridDbId?: number;
}

export type WoWVersion = "retail" | "forever" | "classic" | "tbc" | "mop";

export interface BlizzardCharacterSummary {
  id?: number | string;
  name: string;
  realm: string;
  realmSlug?: string;
  level: number;
  characterClass: string;
  race: string;
  gender?: string;
  faction?: "HORDE" | "ALLIANCE" | string;
  averageItemLevel?: number;
  equippedItemLevel?: number;
  avatarUrl?: string;
  renderUrl?: string;
  activeSpec?: string;
  achievementPoints?: number;
  lastLoginTimestamp?: number;
  gameMode?: "retail" | "forever" | "classic" | "tbc" | "mop" | string;
  wow_version?: "retail" | "forever" | "classic" | "tbc" | "mop" | string;
  classIconUrl?: string;
  raceIconUrl?: string;
  factionIconUrl?: string;
}

export interface BlizzardGearItem {
  slot: string; // e.g. "HEAD", "NECK", "SHOULDER", "BACK", "CHEST", "SHIRT", "TABARD", "WRIST", "HANDS", "WAIST", "LEGS", "FEET", "RING_1", "RING_2", "TRINKET_1", "TRINKET_2", "MAIN_HAND", "OFF_HAND", "RANGED"
  name: string;
  id?: number;
  displayId?: number;
  slotId?: number;
  itemLevel?: number;
  quality?: "POOR" | "COMMON" | "UNCOMMON" | "RARE" | "EPIC" | "LEGENDARY" | "ARTIFACT" | "HEIRLOOM" | string;
  iconUrl?: string;
  armor?: number;
  armorType?: string; // e.g. "Plate", "Mail", "Leather", "Cloth", "Shield"
  weaponType?: string; // e.g. "Staff", "One-Handed Sword", "Two-Handed Axe", "Dagger", "Bow", "Wand"
  damageRange?: string; // e.g. "28 - 42 Damage"
  attackSpeed?: string; // e.g. "2.60"
  dps?: string; // e.g. "13.5 damage per sec"
  stats?: string[];
  enchantment?: string;
  binding?: string; // e.g. "Binds when picked up", "Binds when equipped"
  durability?: string; // e.g. "85 / 85"
  requiredLevel?: number;
  useEffect?: string;
  equipEffect?: string;
  sockets?: { color: string; gem?: string }[];
  sellPrice?: { gold: number; silver: number; copper: number };
}

export interface BlizzardReputation {
  id: number;
  name: string;
  standing: string; // "Hated" | "Hostile" | "Unfriendly" | "Neutral" | "Friendly" | "Honored" | "Revered" | "Exalted"
  standingPtBR?: string;
  current: number;
  max: number;
  percent: number;
  tierColor?: string;
  category?: string;
}

export interface BlizzardInventoryItem {
  id: number;
  name: string;
  quality: "POOR" | "COMMON" | "UNCOMMON" | "RARE" | "EPIC" | "LEGENDARY" | "ARTIFACT" | "HEIRLOOM" | string;
  iconUrl: string;
  itemLevel?: number;
  stackCount: number;
  maxStack?: number;
  bagIndex: number; // 0 = Backpack, 1-4 = Bag slots
  slotIndex: number; // 0-based index inside the bag
  itemType: "consumable" | "equipment" | "tradegoods" | "quest" | "junk" | "misc";
  itemSubType?: string;
  description?: string;
  stats?: string[];
  useEffect?: string;
  binding?: string;
  sellPrice?: { gold: number; silver: number; copper: number };
}

export interface BlizzardBagContainer {
  id: number;
  name: string;
  iconUrl: string;
  slotCount: number;
  bagSlotIndex: number; // 0: Backpack (16 slots), 1-4: Equipped bags
  items: (BlizzardInventoryItem | null)[];
}

export interface BlizzardCollectionMount {
  id: number;
  name: string;
  iconUrl: string;
  creatureDisplayId?: number;
  mountType: "ground" | "flying" | "aquatic" | "dragonriding";
  source: string;
  description: string;
  isCollected?: boolean;
  isFavorite?: boolean;
  speedBonus?: string;
  factionRequirement?: "ALLIANCE" | "HORDE" | "ANY";
}

export interface BlizzardCollectionToy {
  id: number;
  name: string;
  iconUrl: string;
  source: string;
  description: string;
  cooldown?: string;
  isCollected?: boolean;
  isFavorite?: boolean;
}

export interface BlizzardCollectionPet {
  id: number;
  name: string;
  iconUrl: string;
  family: "Beast" | "Dragonkin" | "Flying" | "Humanoid" | "Magical" | "Mechanical" | "Undead" | "Water" | "Elemental";
  level: number;
  quality: string;
  source: string;
  abilities?: string[];
  isCollected?: boolean;
  isFavorite?: boolean;
  creatureDisplayId?: number;
}

export interface BlizzardCollectionTitle {
  id: number;
  name: string;
  titleFormat: string; // e.g. "%s the Kingslayer" or "Champion %s"
  source: string;
  isCurrent?: boolean;
  isCollected?: boolean;
}

export interface BlizzardCharacterInventory {
  backpack: BlizzardBagContainer;
  bags: BlizzardBagContainer[];
  currencies: {
    id: number;
    name: string;
    count: number;
    max?: number;
    iconUrl: string;
    category?: string;
  }[];
  gold: number;
  silver: number;
  copper: number;
}

export interface BlizzardCharacterCollections {
  mounts: BlizzardCollectionMount[];
  toys: BlizzardCollectionToy[];
  pets: BlizzardCollectionPet[];
  titles: BlizzardCollectionTitle[];
  totalMountsCount?: number;
  totalToysCount?: number;
  totalPetsCount?: number;
}

export type BlizzardEquipmentItem = BlizzardGearItem;

export interface BlizzardProfileData {
  battleTag?: string;
  name?: string;
  realm?: string;
  realmSlug?: string;
  level?: number;
  characterClass?: string;
  race?: string;
  gender?: "MALE" | "FEMALE" | string;
  faction?: "HORDE" | "ALLIANCE" | string;
  equippedItemLevel?: number;
  averageItemLevel?: number;
  activeSpec?: string;
  achievementPoints?: number;
  achievementPointsTotal?: number;
  guild?: string;
  avatarUrl?: string;
  renderUrl?: string;
  gameMode?: string;
  classIconUrl?: string;
  raceIconUrl?: string;
  factionIconUrl?: string;
  characterMedia?: {
    avatarUrl?: string;
    renderUrl?: string;
    mainUrl?: string;
  };
  stats?: {
    health?: number;
    power?: number;
    powerType?: "MANA" | "ENERGY" | "RAGE" | "FURY" | "RUNIC_POWER" | "FOCUS" | string;
    strength?: number;
    agility?: number;
    intellect?: number;
    stamina?: number;
    armor?: number;
    crit?: number;
    haste?: number;
    mastery?: number;
    versatility?: number;
    dodge?: number;
    parry?: number;
    block?: number;
  };
  equippedItems?: BlizzardGearItem[];
  recentAchievements?: {
    id: number;
    name: string;
    points: number;
    description: string;
    completedTimestamp?: number;
  }[];
  selectedCharacter?: BlizzardCharacterSummary;
  gear?: BlizzardGearItem[];
  achievements?: {
    id: number;
    title: string;
    description?: string;
    points?: number;
    iconUrl?: string;
    category?: string;
    completedTimestamp?: number;
  }[];
  talents?: any;
  reputations?: BlizzardReputation[];
  mainRawUrl?: string;
  insetImageUrl?: string;
  appearance?: {
    customizations?: {
      option: { id: number; name?: string };
      choice: { id: number; name?: string };
    }[];
    items?: {
      slot: { type: string };
      item: { id: number };
      display_id?: number;
      item_appearance_modifier_id?: number;
    }[];
  };
  inventory?: BlizzardCharacterInventory;
  collections?: BlizzardCharacterCollections;
  lastSyncedAt?: string;
}

export interface BlizzardOfficialGame {
  id: string;
  name: string;
  category: "warcraft" | "diablo" | "starcraft" | "overwatch" | "hearthstone" | "other";
  icon: string;
  hasCharacterArmory: boolean;
  isWow: boolean;
  wowVersion?: WoWVersion;
  description?: string;
}

export interface SteamGridGameCandidate {
  id: number;
  name: string;
  types?: string[];
  verified?: boolean;
}

export interface SteamGridAuthor {
  name?: string;
  steam64?: string;
  avatar?: string;
}

export type SteamGridAssetType = "grid" | "hero" | "logo" | "icon";

export interface SteamGridMediaItem {
  id: string | number;
  rawId?: number;
  type: SteamGridAssetType;
  title?: string;
  style?: string; // "alternate" | "blurred" | "material" | "white_logo" | "official" | "custom"
  width?: number;
  height?: number;
  orientation?: "vertical" | "horizontal" | "square" | "panoramic";
  url: string;
  thumb?: string;
  thumbUrl: string;
  mime?: string;
  score?: number;
  nsfw?: boolean;
  humor?: boolean;
  notes?: string;
  language?: string;
  author?: SteamGridAuthor;
  gameId?: number;
  gameName?: string;
}

export interface SteamGridStatusResult {
  connected: boolean;
  isCustomKey: boolean;
  message?: string;
  keyMasked?: string;
}

export interface IgdbGameCandidate {
  id: number;
  name: string;
  slug?: string;
  series?: string;
  summary?: string;
  storyline?: string;
  releaseDate?: string; // YYYY-MM-DD
  developer?: string;
  publisher?: string;
  genres: string[];
  platforms: string[];
  rating?: number; // 0-100 (user)
  aggregatedRating?: number; // 0-100 (critic)
  totalRating?: number; // 0-100 (combined)
  coverUrl?: string;
  coverHdUrl?: string;
  iconUrl?: string;
  artworks?: { id: number; url: string; hdUrl: string }[];
  screenshots?: { id: number; url: string; hdUrl: string }[];
  videos?: { id: number; videoId: string; title?: string; youtubeUrl: string }[];
  igdbUrl?: string;
  source?: "igdb" | "ai" | "steam";
}

export interface IgdbMediaItem {
  id: string | number;
  type: "cover" | "artwork" | "screenshot";
  title: string;
  thumbnailUrl: string;
  fullUrl: string;
  width?: number;
  height?: number;
}

export function getGameTrophyItems(game: Partial<Game>): TrophyItem[] {
  if (Array.isArray(game.trophies) && game.trophies.length > 0) {
    return game.trophies.map((item) => {
      if (typeof item === "string") {
        return { type: item as "bronze" | "silver" | "gold" | "platinum", note: "" };
      }
      if (item && typeof item === "object" && item.type) {
        return { type: item.type as "bronze" | "silver" | "gold" | "platinum", note: item.note || "" };
      }
      return { type: "silver", note: "" };
    });
  }
  if (game.trophy && game.trophy !== "none") {
    return [{ type: game.trophy as "bronze" | "silver" | "gold" | "platinum", note: "" }];
  }
  return [];
}

export function getGameTrophies(game: Partial<Game>): ("bronze" | "silver" | "gold" | "platinum")[] {
  return getGameTrophyItems(game).map((item) => item.type);
}

export function getGameHighestTrophy(game: Partial<Game>): "none" | "bronze" | "silver" | "gold" | "platinum" {
  const trophyTypes = getGameTrophies(game);
  if (trophyTypes.includes("platinum")) return "platinum";
  if (trophyTypes.includes("gold")) return "gold";
  if (trophyTypes.includes("silver")) return "silver";
  if (trophyTypes.includes("bronze")) return "bronze";
  return "none";
}

export function splitEntities(val: string | undefined | null): string[] {
  if (!val) return [];
  return val.split(/[;\n\r]+/).map((s) => s.trim()).filter(Boolean);
}

export interface ContextParsed {
  main: string;
  note?: string;
}

export function parseContextNote(raw: string | undefined | null): ContextParsed {
  if (!raw) return { main: "" };
  const trimmed = raw.trim();
  if (!trimmed) return { main: "" };

  // Prioritize bracket match: "Topic [Note]"
  const bracketMatch = trimmed.match(/^([^[]+)\[([^\]]+)\]$/);
  if (bracketMatch) {
    return {
      main: bracketMatch[1].trim(),
      note: bracketMatch[2].trim(),
    };
  }

  // Fallback check for parenthesis match: "Topic (Note)"
  const parenMatch = trimmed.match(/^([^(]+)\(([^)]+)\)$/);
  if (parenMatch) {
    return {
      main: parenMatch[1].trim(),
      note: parenMatch[2].trim(),
    };
  }

  return { main: trimmed };
}

export interface ProConParsed {
  topic: string;
  note?: string;
}

export function parseProConTopic(raw: string): ProConParsed {
  const parsed = parseContextNote(raw);
  return {
    topic: parsed.main,
    note: parsed.note,
  };
}

export function getDlcMode(game: { dlcMode?: "none" | "dlc" | "plus_dlc" | string; isDlc?: boolean | string }): "none" | "dlc" | "plus_dlc" {
  if (game.dlcMode === "plus_dlc" || game.isDlc === ("plus_dlc" as any)) return "plus_dlc";
  if (game.dlcMode === "dlc" || game.isDlc === ("dlc" as any) || game.isDlc === true) return "dlc";
  return "none";
}

export function formatDateDisplay(dateStr: string | undefined | null): string {
  if (!dateStr || !dateStr.trim()) return "";
  const clean = dateStr.trim();
  if (/^\d{2}\/\d{2}\/\d{4}$/.test(clean)) return clean;
  const match = clean.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})/);
  if (match) {
    const [, yyyy, mm, dd] = match;
    const formattedDd = dd.padStart(2, "0");
    const formattedMm = mm.padStart(2, "0");
    return `${formattedDd}/${formattedMm}/${yyyy}`;
  }
  const matchReverse = clean.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})/);
  if (matchReverse) {
    const [, dd, mm, yyyy] = matchReverse;
    const formattedDd = dd.padStart(2, "0");
    const formattedMm = mm.padStart(2, "0");
    return `${formattedDd}/${formattedMm}/${yyyy}`;
  }
  return clean;
}

