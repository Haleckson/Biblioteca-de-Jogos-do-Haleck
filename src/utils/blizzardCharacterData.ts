/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { BlizzardGearItem, BlizzardReputation, BlizzardProfileData } from "../types";
import { getWoWClassInfo, getWoWRaceInfo } from "./blizzardIcons";

export interface GenerateProfileOptions {
  name: string;
  realm: string;
  realmSlug?: string;
  characterClass?: string;
  race?: string;
  level?: number;
  gender?: string;
  faction?: string;
  activeSpec?: string;
  equippedItemLevel?: number;
  gameMode?: string;
  battleTag?: string;
  avatarUrl?: string;
  renderUrl?: string;
  characterSummary?: any;
}

// Generates an authentic, class-tailored, level-tailored character profile with full gear, talents, reputations, and stats
export function generateWoWCharacterProfile(options: GenerateProfileOptions): BlizzardProfileData {
  const name = options.name || "Personagem";
  const realm = options.realm || "Azralon";
  const realmSlug = options.realmSlug || realm.toLowerCase().replace(/['\s]+/g, "-");
  const rawClass = (options.characterClass || "Druid").toLowerCase();
  const rawRace = (options.race || "Night Elf").toLowerCase();
  const rawFaction = (options.faction || (rawRace.includes("night") || rawRace.includes("human") || rawRace.includes("dwarf") || rawRace.includes("gnome") || rawRace.includes("draenei") || rawRace.includes("worgen") ? "ALLIANCE" : "HORDE")).toUpperCase();
  const level = Math.max(1, options.level !== undefined ? options.level : 18);
  const gender = (options.gender || "MALE").toUpperCase() as "MALE" | "FEMALE";
  const gameMode = options.gameMode || (level <= 60 && (realm.toLowerCase().includes("whitemane") || realm.toLowerCase().includes("mankrik")) ? "classic" : level <= 60 && realm.toLowerCase().includes("forever") ? "forever" : level <= 70 && realm.toLowerCase().includes("tbc") ? "tbc" : "retail");

  // Determine Class Family
  let normalizedClass = "Druid";
  let classPtBR = "Druida";
  let armorType = "Couro";
  let primaryStat = "Agilidade";
  let resourceType: "MANA" | "ENERGY" | "RAGE" = "MANA";

  if (rawClass.includes("druid") || rawClass.includes("druida")) {
    normalizedClass = "Druid";
    classPtBR = "Druida";
    armorType = "Couro";
    primaryStat = "Agilidade";
    resourceType = "MANA";
  } else if (rawClass.includes("paladin") || rawClass.includes("paladino")) {
    normalizedClass = "Paladin";
    classPtBR = "Paladino";
    armorType = "Placas";
    primaryStat = "Força";
    resourceType = "MANA";
  } else if (rawClass.includes("warrior") || rawClass.includes("guerreiro")) {
    normalizedClass = "Warrior";
    classPtBR = "Guerreiro";
    armorType = "Placas";
    primaryStat = "Força";
    resourceType = "RAGE";
  } else if (rawClass.includes("rogue") || rawClass.includes("ladino")) {
    normalizedClass = "Rogue";
    classPtBR = "Ladino";
    armorType = "Couro";
    primaryStat = "Agilidade";
    resourceType = "ENERGY";
  } else if (rawClass.includes("mage") || rawClass.includes("mago")) {
    normalizedClass = "Mage";
    classPtBR = "Mago";
    armorType = "Tecido";
    primaryStat = "Intelecto";
    resourceType = "MANA";
  } else if (rawClass.includes("priest") || rawClass.includes("sacerdote")) {
    normalizedClass = "Priest";
    classPtBR = "Sacerdote";
    armorType = "Tecido";
    primaryStat = "Intelecto";
    resourceType = "MANA";
  } else if (rawClass.includes("warlock") || rawClass.includes("bruxo")) {
    normalizedClass = "Warlock";
    classPtBR = "Bruxo";
    armorType = "Tecido";
    primaryStat = "Intelecto";
    resourceType = "MANA";
  } else if (rawClass.includes("hunter") || rawClass.includes("caçador")) {
    normalizedClass = "Hunter";
    classPtBR = "Caçador";
    armorType = level >= 40 ? "Malha" : "Couro";
    primaryStat = "Agilidade";
    resourceType = "MANA";
  } else if (rawClass.includes("shaman") || rawClass.includes("xamã")) {
    normalizedClass = "Shaman";
    classPtBR = "Xamã";
    armorType = level >= 40 ? "Malha" : "Couro";
    primaryStat = "Intelecto";
    resourceType = "MANA";
  } else if (rawClass.includes("deathknight") || rawClass.includes("cavaleiro")) {
    normalizedClass = "Death Knight";
    classPtBR = "Cavaleiro da Morte";
    armorType = "Placas";
    primaryStat = "Força";
    resourceType = "RAGE";
  } else if (rawClass.includes("monk") || rawClass.includes("monge")) {
    normalizedClass = "Monk";
    classPtBR = "Monge";
    armorType = "Couro";
    primaryStat = "Agilidade";
    resourceType = "ENERGY";
  } else if (rawClass.includes("demonhunter") || rawClass.includes("demônio")) {
    normalizedClass = "Demon Hunter";
    classPtBR = "Caçador de Demônios";
    armorType = "Couro";
    primaryStat = "Agilidade";
    resourceType = "ENERGY";
  } else if (rawClass.includes("evoker") || rawClass.includes("conjurador")) {
    normalizedClass = "Evoker";
    classPtBR = "Conjurador";
    armorType = "Malha";
    primaryStat = "Intelecto";
    resourceType = "MANA";
  }

  // Active Spec
  let spec = options.activeSpec;
  if (!spec) {
    if (normalizedClass === "Druid") spec = "Feral";
    else if (normalizedClass === "Paladin") spec = "Retribuição";
    else if (normalizedClass === "Warrior") spec = "Armas";
    else if (normalizedClass === "Mage") spec = "Gelo";
    else if (normalizedClass === "Rogue") spec = "Combate";
    else if (normalizedClass === "Priest") spec = "Sombra";
    else if (normalizedClass === "Warlock") spec = "Destruição";
    else if (normalizedClass === "Hunter") spec = "Precisão";
    else if (normalizedClass === "Shaman") spec = "Elemental";
    else spec = "Primária";
  }

  // Calculate realistic item level base
  let itemLevelBase = options.equippedItemLevel;
  if (!itemLevelBase) {
    if (level <= 20) itemLevelBase = Math.max(12, level + 4);
    else if (level <= 60) itemLevelBase = Math.floor(level * 1.3);
    else if (level <= 70) itemLevelBase = 135;
    else itemLevelBase = 625;
  }

  // Calculate realistic stats based on level
  let health = 0;
  let power = 0;
  let statMain = 0;
  let statStamina = 0;
  let armorVal = 0;
  let critVal = 14.5;
  let hasteVal = 6.2;
  let masteryVal = 18.0;

  if (level <= 20) {
    health = Math.round(level * 28 + 40);
    power = resourceType === "ENERGY" || resourceType === "RAGE" ? 100 : Math.round(level * 18 + 50);
    statMain = Math.round(level * 2.8);
    statStamina = Math.round(level * 2.5);
    armorVal = armorType === "Placas" ? Math.round(level * 25) : armorType === "Couro" ? Math.round(level * 12) : Math.round(level * 7);
  } else if (level <= 60) {
    health = Math.round(level * 85 + 200);
    power = resourceType === "ENERGY" || resourceType === "RAGE" ? 100 : Math.round(level * 60 + 1000);
    statMain = Math.round(level * 6.5);
    statStamina = Math.round(level * 7.2);
    armorVal = armorType === "Placas" ? 4800 : armorType === "Couro" ? 2200 : 950;
    critVal = 22.4;
    hasteVal = 0;
  } else if (level <= 70) {
    health = 16500;
    power = resourceType === "ENERGY" || resourceType === "RAGE" ? 100 : 7800;
    statMain = 680;
    statStamina = 720;
    armorVal = armorType === "Placas" ? 14500 : armorType === "Couro" ? 4200 : 1800;
    critVal = 26.5;
    hasteVal = 8.5;
  } else {
    // Level 80 (Retail)
    health = 6450000;
    power = resourceType === "ENERGY" || resourceType === "RAGE" ? 100 : 250000;
    statMain = 24500;
    statStamina = 38500;
    armorVal = armorType === "Placas" ? 38500 : armorType === "Couro" ? 18500 : 9200;
    critVal = 32.5;
    hasteVal = 18.2;
    masteryVal = 44.0;
  }

  // Build authentic Equipment tailored for Class and Level
  const gear: BlizzardGearItem[] = [];

  const statBonus = (mult: number) => {
    if (level <= 20) return Math.max(1, Math.round(level * 0.3 * mult));
    if (level <= 60) return Math.max(5, Math.round(level * 0.45 * mult));
    if (level <= 70) return Math.max(20, Math.round(35 * mult));
    return Math.round(1450 * mult);
  };

  const isLowLevel = level <= 25;
  const isHighLevel = level >= 75;
  const qualityDefault = isLowLevel ? "UNCOMMON" : isHighLevel ? "EPIC" : "RARE";
  const weaponType = normalizedClass === "Druid" ? "Cajado" : normalizedClass === "Paladin" ? (spec.includes("Prote") ? "Espada de Uma Mão" : "Martelo de Duas Mãos") : normalizedClass === "Warrior" ? "Machado de Duas Mãos" : normalizedClass === "Mage" || normalizedClass === "Priest" || normalizedClass === "Warlock" ? "Cajado" : normalizedClass === "Hunter" ? "Arco" : "Adaga";

  const classItemNamePrefix = normalizedClass === "Druid" ? "da Floresta" : normalizedClass === "Paladin" ? "da Luz Sagrada" : normalizedClass === "Warrior" ? "do Gladiador" : normalizedClass === "Mage" ? "do Arcano" : normalizedClass === "Rogue" ? "do Rastejador" : "do Campeão";

  gear.push({
    slot: "HEAD",
    name: isLowLevel ? `Bandana ${classItemNamePrefix}` : isHighLevel ? `Coroa ${classItemNamePrefix} Radiante` : `Elmo ${classItemNamePrefix}`,
    itemLevel: itemLevelBase,
    quality: isLowLevel ? "RARE" : qualityDefault,
    armor: Math.round(armorVal * 0.12),
    armorType,
    stats: [`+${statBonus(1.2)} ${primaryStat}`, `+${statBonus(1.4)} Vigor`],
    binding: "Vinculado ao recolher",
    durability: `${isLowLevel ? "60 / 60" : "100 / 100"}`,
    requiredLevel: level,
    iconUrl: "https://wow.zamimg.com/images/wow/icons/large/inv_helmet_09.jpg",
  });

  gear.push({
    slot: "NECK",
    name: isLowLevel ? `Amuleto de Eluna ${classItemNamePrefix}` : `Colar de Gemas ${classItemNamePrefix}`,
    itemLevel: Math.max(1, itemLevelBase - 1),
    quality: isLowLevel ? "UNCOMMON" : qualityDefault,
    stats: [`+${statBonus(1.0)} ${primaryStat}`, `+${statBonus(1.1)} Vigor`],
    binding: "Vinculado ao recolher",
    requiredLevel: level,
    iconUrl: "https://wow.zamimg.com/images/wow/icons/large/inv_jewelry_necklace_07.jpg",
  });

  gear.push({
    slot: "SHOULDER",
    name: isLowLevel ? `Manto de Folhas ${classItemNamePrefix}` : `Ombreiras de Batalha ${classItemNamePrefix}`,
    itemLevel: itemLevelBase,
    quality: qualityDefault,
    armor: Math.round(armorVal * 0.11),
    armorType,
    stats: [`+${statBonus(1.1)} ${primaryStat}`, `+${statBonus(1.2)} Vigor`],
    binding: "Vinculado ao recolher",
    durability: `${isLowLevel ? "55 / 55" : "90 / 90"}`,
    requiredLevel: level,
    iconUrl: "https://wow.zamimg.com/images/wow/icons/large/inv_shoulder_02.jpg",
  });

  gear.push({
    slot: "BACK",
    name: isLowLevel ? `Capa de Ashenvale ${classItemNamePrefix}` : `Manto do Crepúsculo ${classItemNamePrefix}`,
    itemLevel: Math.max(1, itemLevelBase - 2),
    quality: "UNCOMMON",
    armor: Math.round(armorVal * 0.05),
    armorType: "Costas",
    stats: [`+${statBonus(0.9)} ${primaryStat}`, `+${statBonus(1.0)} Vigor`],
    binding: "Vinculado ao ser equipado",
    durability: "45 / 45",
    requiredLevel: level,
    iconUrl: "https://wow.zamimg.com/images/wow/icons/large/inv_misc_cape_16.jpg",
  });

  gear.push({
    slot: "CHEST",
    name: isLowLevel ? `Túnica Reforçada ${classItemNamePrefix}` : `Couraça da Conquista ${classItemNamePrefix}`,
    itemLevel: itemLevelBase + 1,
    quality: isLowLevel ? "RARE" : qualityDefault,
    armor: Math.round(armorVal * 0.22),
    armorType,
    stats: [`+${statBonus(1.5)} ${primaryStat}`, `+${statBonus(1.6)} Vigor`, `+${statBonus(0.6)} Acerto Crítico`],
    enchantment: isLowLevel ? "+3 Todos os Atributos" : isHighLevel ? "+300 Atributo Primário" : "+100 Pontos de Vida",
    binding: "Vinculado ao recolher",
    durability: `${isLowLevel ? "85 / 85" : "140 / 140"}`,
    requiredLevel: level,
    iconUrl: "https://wow.zamimg.com/images/wow/icons/large/inv_chest_plate06.jpg",
  });

  gear.push({
    slot: "SHIRT",
    name: "Camisa de Linho Simples",
    itemLevel: 1,
    quality: "COMMON",
    binding: "Vinculado ao ser equipado",
    iconUrl: "https://wow.zamimg.com/images/wow/icons/large/inv_shirt_white_01.jpg",
  });

  gear.push({
    slot: "TABARD",
    name: rawFaction === "ALLIANCE" ? "Tabardo de Darnassus" : "Tabardo de Orgrimmar",
    itemLevel: 1,
    quality: "UNCOMMON",
    binding: "Vinculado ao recolher",
    iconUrl: "https://wow.zamimg.com/images/wow/icons/large/inv_misc_tabard_01.jpg",
  });

  gear.push({
    slot: "WRIST",
    name: isLowLevel ? `Braçadeiras da Trilha ${classItemNamePrefix}` : `Manoplas de Pulso ${classItemNamePrefix}`,
    itemLevel: Math.max(1, itemLevelBase - 2),
    quality: "UNCOMMON",
    armor: Math.round(armorVal * 0.08),
    armorType,
    stats: [`+${statBonus(0.8)} ${primaryStat}`, `+${statBonus(0.9)} Vigor`],
    binding: "Vinculado ao recolher",
    durability: "40 / 40",
    requiredLevel: level,
    iconUrl: "https://wow.zamimg.com/images/wow/icons/large/inv_bracer_07.jpg",
  });

  gear.push({
    slot: "HANDS",
    name: isLowLevel ? `Luvas de Pata ${classItemNamePrefix}` : `Manoplas de Aço ${classItemNamePrefix}`,
    itemLevel: itemLevelBase,
    quality: qualityDefault,
    armor: Math.round(armorVal * 0.12),
    armorType,
    stats: [`+${statBonus(1.1)} ${primaryStat}`, `+${statBonus(1.2)} Vigor`],
    binding: "Vinculado ao recolher",
    durability: "50 / 50",
    requiredLevel: level,
    iconUrl: "https://wow.zamimg.com/images/wow/icons/large/inv_gauntlets_04.jpg",
  });

  gear.push({
    slot: "WAIST",
    name: isLowLevel ? `Cinto de Raiz ${classItemNamePrefix}` : `Cinturão de Guerra ${classItemNamePrefix}`,
    itemLevel: itemLevelBase,
    quality: qualityDefault,
    armor: Math.round(armorVal * 0.1),
    armorType,
    stats: [`+${statBonus(1.0)} ${primaryStat}`, `+${statBonus(1.1)} Vigor`],
    binding: "Vinculado ao recolher",
    durability: "45 / 45",
    requiredLevel: level,
    iconUrl: "https://wow.zamimg.com/images/wow/icons/large/inv_belt_12.jpg",
  });

  gear.push({
    slot: "LEGS",
    name: isLowLevel ? `Calças Silvestres ${classItemNamePrefix}` : `Perneiras de Ferro ${classItemNamePrefix}`,
    itemLevel: itemLevelBase + 1,
    quality: isLowLevel ? "RARE" : qualityDefault,
    armor: Math.round(armorVal * 0.18),
    armorType,
    stats: [`+${statBonus(1.4)} ${primaryStat}`, `+${statBonus(1.5)} Vigor`, `+${statBonus(0.5)} Acerto Crítico`],
    binding: "Vinculado ao recolher",
    durability: "75 / 75",
    requiredLevel: level,
    iconUrl: "https://wow.zamimg.com/images/wow/icons/large/inv_pants_03.jpg",
  });

  gear.push({
    slot: "FEET",
    name: isLowLevel ? `Botas de Trilha ${classItemNamePrefix}` : `Escarpes de Batalha ${classItemNamePrefix}`,
    itemLevel: itemLevelBase,
    quality: qualityDefault,
    armor: Math.round(armorVal * 0.11),
    armorType,
    stats: [`+${statBonus(1.0)} ${primaryStat}`, `+${statBonus(1.2)} Vigor`],
    binding: "Vinculado ao recolher",
    durability: "55 / 55",
    requiredLevel: level,
    iconUrl: "https://wow.zamimg.com/images/wow/icons/large/inv_boots_01.jpg",
  });

  gear.push({
    slot: "RING_1",
    name: isLowLevel ? `Anel de Prata ${classItemNamePrefix}` : `Selo da Eternidade ${classItemNamePrefix}`,
    itemLevel: itemLevelBase,
    quality: isLowLevel ? "RARE" : qualityDefault,
    stats: [`+${statBonus(0.9)} ${primaryStat}`, `+${statBonus(1.0)} Vigor`],
    binding: "Vinculado ao recolher",
    requiredLevel: level,
    iconUrl: "https://wow.zamimg.com/images/wow/icons/large/inv_jewelry_ring_03.jpg",
  });

  gear.push({
    slot: "RING_2",
    name: isLowLevel ? `Selo do Lago Silvestre` : `Aro de Batalha ${classItemNamePrefix}`,
    itemLevel: Math.max(1, itemLevelBase - 2),
    quality: "UNCOMMON",
    stats: [`+${statBonus(0.8)} ${primaryStat}`, `+${statBonus(0.9)} Vigor`],
    binding: "Vinculado ao recolher",
    requiredLevel: level,
    iconUrl: "https://wow.zamimg.com/images/wow/icons/large/inv_jewelry_ring_07.jpg",
  });

  gear.push({
    slot: "TRINKET_1",
    name: isLowLevel ? `Talismã da Garra Ágil` : `Coração do Vulcão`,
    itemLevel: itemLevelBase,
    quality: isLowLevel ? "RARE" : qualityDefault,
    stats: [`+${statBonus(1.2)} Poder de Ataque e Feitiços`],
    useEffect: isLowLevel ? "Uso: Aumenta a velocidade de ataque em 10% por 15s." : "Proc: Concede 1.500 de Maestria por 12s.",
    binding: "Vinculado ao recolher",
    requiredLevel: level,
    iconUrl: "https://wow.zamimg.com/images/wow/icons/large/inv_jewelry_talisman_01.jpg",
  });

  gear.push({
    slot: "TRINKET_2",
    name: isLowLevel ? `Broche da Folha de Eluna` : `Estilhaço do Destino`,
    itemLevel: Math.max(1, itemLevelBase - 3),
    quality: "UNCOMMON",
    stats: [`+${statBonus(0.8)} Vigor`],
    equipEffect: "Equipar: Aumenta sua regeneração de recurso em 5%.",
    binding: "Vinculado ao recolher",
    requiredLevel: level,
    iconUrl: "https://wow.zamimg.com/images/wow/icons/large/inv_misc_gem_bloodstone_01.jpg",
  });

  // Weapon
  const dmgMin = isLowLevel ? Math.round(level * 1.4) : isHighLevel ? 1850 : 85;
  const dmgMax = isLowLevel ? Math.round(level * 2.2 + 8) : isHighLevel ? 3200 : 160;
  const dpsVal = (dmgMin + dmgMax) / 2 / 2.6;

  gear.push({
    slot: "MAIN_HAND",
    name: isLowLevel ? `Báculo da Harmonia Silvestre` : `Lâmina da Glória Eterna`,
    itemLevel: itemLevelBase + 2,
    quality: isLowLevel ? "RARE" : qualityDefault,
    weaponType,
    damageRange: `${dmgMin} - ${dmgMax} Dano`,
    attackSpeed: "2.60",
    dps: `${dpsVal.toFixed(1)} dano por seg.`,
    stats: [`+${statBonus(2.2)} ${primaryStat}`, `+${statBonus(2.5)} Vigor`, `+${statBonus(1.0)} Acerto Crítico`],
    enchantment: isLowLevel ? "+3 Dano de Arma" : isHighLevel ? "Autoridade da Tempestade" : "Cruzado Sagrado",
    binding: "Vinculado ao recolher",
    durability: `${isLowLevel ? "80 / 80" : "120 / 120"}`,
    requiredLevel: level,
    iconUrl: normalizedClass === "Druid" ? "https://wow.zamimg.com/images/wow/icons/large/inv_staff_08.jpg" : "https://wow.zamimg.com/images/wow/icons/large/inv_sword_39.jpg",
  });

  // Talents tailored to Class
  const talentsObj: any[] = [];
  if (normalizedClass === "Druid") {
    talentsObj.push(
      { tierName: "Habilidade Passiva Básica", spellName: "Forma Felina (Nível 10)", description: "Permite assumir a forma de um grande felino, aumentando a velocidade de movimento em 30%." },
      { tierName: "Talento de Combate Ativo", spellName: "Carga Feral (Feral Charge)", description: "Investe contra o alvo instantaneamente, imobilizando-o por 4 segundos." },
      { tierName: "Ataques de Sangramento", spellName: "Estraçalhar & Rasgar Aprimorado", description: "Causa dano direto e aplica sangramento contínuo que enfraquece a armadura inimiga." },
      { tierName: "Proteção da Natureza", spellName: "Pele Grossa (5/5)", description: "Aumenta a contribuição de armadura de itens de couro em 10%." }
    );
  } else if (normalizedClass === "Paladin") {
    talentsObj.push(
      { tierName: "Aura Sagrada", spellName: "Aura de Devoção Aprimorada", description: "Concede bônus adicional de armadura a todo o grupo." },
      { tierName: "Julgamento", spellName: "Julgamento da Luz", description: "Atinge o inimigo com energia divina e cura aliados ao atacarem o alvo." },
      { tierName: "Golpe Principal", spellName: "Golpe do Cruzado", description: "Ataque instantâneo com arma que gera Poder Sagrado." },
      { tierName: "Talento de Proteção", spellName: "Fervor Inabalável", description: "Aumenta a chance de acerto crítico e resistência a atordoamentos." }
    );
  } else {
    talentsObj.push(
      { tierName: "Especialização Primária", spellName: `${spec} - Habilidade Central`, description: `Fundamento de combate para ${classPtBR}.` },
      { tierName: "Controle & Utilidade", spellName: "Bônus de Especialidade de Combate", description: "Aumenta o dano crítico e a recuperação de recursos." }
    );
  }

  // Reputations tailored to Faction & Level
  const reputations: BlizzardReputation[] = [];
  if (rawFaction === "ALLIANCE") {
    reputations.push(
      { id: 69, name: "Darnassus (Elfos Noturnos)", standing: "Honored", standingPtBR: "Honrado", current: 6420, max: 12000, percent: 53, category: "Cidades Capitais" },
      { id: 609, name: "Círculo Cenariano", standing: "Friendly", standingPtBR: "Amistoso", current: 3200, max: 6000, percent: 53, category: "Clássico / Natureza" },
      { id: 890, name: "Sentinelas de Pratavento", standing: "Friendly", standingPtBR: "Amistoso", current: 1850, max: 6000, percent: 30, category: "Campos de Batalha" },
      { id: 72, name: "Ventobravo (Humanos)", standing: "Friendly", standingPtBR: "Amistoso", current: 2400, max: 6000, percent: 40, category: "Cidades Capitais" },
      { id: 47, name: "Altaforja (Anões)", standing: "Friendly", standingPtBR: "Amistoso", current: 1550, max: 6000, percent: 25, category: "Cidades Capitais" }
    );
  } else {
    reputations.push(
      { id: 76, name: "Orgrimmar (Orcs)", standing: "Honored", standingPtBR: "Honrado", current: 7200, max: 12000, percent: 60, category: "Cidades Capitais" },
      { id: 81, name: "Penhasco do Trovão (Taurens)", standing: "Honored", standingPtBR: "Honrado", current: 6100, max: 12000, percent: 50, category: "Cidades Capitais" },
      { id: 609, name: "Círculo Cenariano", standing: "Friendly", standingPtBR: "Amistoso", current: 3200, max: 6000, percent: 53, category: "Clássico / Natureza" },
      { id: 530, name: "Lançanegra (Trolls)", standing: "Friendly", standingPtBR: "Amistoso", current: 2150, max: 6000, percent: 35, category: "Cidades Capitais" },
      { id: 68, name: "Cidade Baixa (Renegados)", standing: "Friendly", standingPtBR: "Amistoso", current: 1400, max: 6000, percent: 23, category: "Cidades Capitais" }
    );
  }

  // Achievements tailored to Level
  const achievements: any[] = [];
  const nowSec = Math.floor(Date.now() / 1000);

  if (level >= 10) {
    achievements.push({
      id: 6,
      title: "Nível 10",
      description: "Alcançou o nível 10 com determinação.",
      points: 10,
      completedTimestamp: nowSec - 86400 * 12,
      iconUrl: "https://wow.zamimg.com/images/wow/icons/large/achievement_level_10.jpg",
    });
  }

  if (level >= 15) {
    achievements.push({
      id: 628,
      title: "Mestre das Masmorras Clássicas",
      description: "Completou uma expedição em masmorras heroicas de Azeroth.",
      points: 10,
      completedTimestamp: nowSec - 86400 * 5,
      iconUrl: "https://wow.zamimg.com/images/wow/icons/large/achievement_dungeon_classicdungeonmaster.jpg",
    });
  }

  achievements.push({
    id: 844,
    title: rawFaction === "ALLIANCE" ? "Explorar Kalimdor & Teldrassil" : "Explorar Kalimdor & Durotar",
    description: "Explorou todas as áreas e postos do ponto de partida da sua raça.",
    points: 10,
    completedTimestamp: nowSec - 86400 * 20,
    iconUrl: "https://wow.zamimg.com/images/wow/icons/large/achievement_zone_kalimdor_01.jpg",
  });

  achievements.push({
    id: 504,
    title: "50 Missões Concluídas",
    description: "Completou 50 missões ajudando o povo de Azeroth.",
    points: 10,
    completedTimestamp: nowSec - 86400 * 3,
    iconUrl: "https://wow.zamimg.com/images/wow/icons/large/achievement_quests_completed_01.jpg",
  });

  const totalAchievePts = achievements.reduce((sum, a) => sum + (a.points || 0), 0) + (level <= 20 ? 120 : level <= 60 ? 2450 : 18500);

  const raceInfo = getWoWRaceInfo(options.race || (rawFaction === "ALLIANCE" ? "Night Elf" : "Orc"), gender);
  const classInfo = getWoWClassInfo(normalizedClass);
  const finalAvatar = options.avatarUrl || options.characterSummary?.avatarUrl || raceInfo.iconUrl || classInfo.iconUrl;
  const finalRender = options.renderUrl || options.characterSummary?.renderUrl || "";

  return {
    battleTag: options.battleTag || "Jogador#1234",
    name,
    realm,
    realmSlug,
    level,
    characterClass: normalizedClass,
    race: options.race || (rawFaction === "ALLIANCE" ? "Night Elf" : "Orc"),
    gender,
    faction: rawFaction,
    equippedItemLevel: itemLevelBase,
    averageItemLevel: itemLevelBase,
    activeSpec: spec,
    achievementPoints: totalAchievePts,
    achievementPointsTotal: totalAchievePts,
    guild: rawFaction === "ALLIANCE" ? "Guardiões de Teldrassil" : "Irmandade de Orgrimmar",
    avatarUrl: finalAvatar,
    renderUrl: finalRender,
    gameMode,
    stats: {
      health,
      power,
      powerType: resourceType,
      strength: normalizedClass === "Warrior" || normalizedClass === "Paladin" ? statMain : Math.round(statMain * 0.4),
      agility: normalizedClass === "Druid" || normalizedClass === "Rogue" || normalizedClass === "Hunter" ? statMain : Math.round(statMain * 0.4),
      intellect: normalizedClass === "Mage" || normalizedClass === "Priest" || normalizedClass === "Warlock" ? statMain : Math.round(statMain * 0.5),
      stamina: statStamina,
      armor: armorVal,
      crit: critVal,
      haste: hasteVal,
      mastery: masteryVal,
      versatility: 6.5,
      dodge: 5.4,
      parry: 3.2,
      block: 0,
    },
    equippedItems: gear,
    gear,
    talents: talentsObj,
    reputations,
    achievements,
    recentAchievements: achievements.map((a) => ({
      id: a.id,
      name: a.title,
      points: a.points,
      description: a.description,
      completedTimestamp: a.completedTimestamp,
    })),
    lastSyncedAt: new Date().toISOString(),
  };
}
