/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export interface WoWTalentNode {
  id: string;
  name: string;
  icon: string;
  row: number; // 0 to 6 for classic, 0 to 9 for retail
  col: number; // 0 to 3 for classic, 0 to 4 for retail
  rank: number;
  maxRank: number;
  description: string;
  nextRankDescription?: string;
  type?: "passive" | "active" | "choice";
  spellCost?: string;
  castTime?: string;
  cooldown?: string;
  prerequisiteId?: string;
  selected?: boolean; // For MoP 1-of-3 tier choice
}

export interface WoWTalentTreeData {
  id: string;
  name: string;
  icon: string;
  pointsSpent: number;
  nodes: WoWTalentNode[];
}

export interface RetailDualTalents {
  classTree: {
    title: string;
    pointsSpent: number;
    maxPoints: number;
    nodes: WoWTalentNode[];
  };
  specTree: {
    title: string;
    specName: string;
    pointsSpent: number;
    maxPoints: number;
    nodes: WoWTalentNode[];
  };
  heroTree?: {
    heroTreeName: string;
    pointsSpent: number;
    maxPoints: number;
    nodes: WoWTalentNode[];
  };
}

export interface MoPTierRow {
  level: number;
  talents: WoWTalentNode[];
}

// Check if a tier (row) is unlocked based on total points spent in that tree
export function isTalentTierUnlocked(pointsSpentInTree: number, row: number): boolean {
  return pointsSpentInTree >= row * 5;
}

// -------------------------------------------------------------
// CLASSIC ERA & FOREVER (Vanilla 1.12 - 51 Points, 3 Specs)
// -------------------------------------------------------------
export function getClassicTalentTrees(
  className: string,
  specName: string,
  level: number = 60
): WoWTalentTreeData[] {
  const normClass = (className || "Druid").toLowerCase();
  const normSpec = (specName || "Feral").toLowerCase();
  const totalTalentPoints = Math.max(0, Math.min(51, level - 9));

  if (normClass.includes("druid")) {
    const isFeral = normSpec.includes("feral") || normSpec.includes("guardian");
    const isBalance = normSpec.includes("balance") || normSpec.includes("boomkin");
    const isResto = normSpec.includes("resto");

    const feralSpent = isFeral ? totalTalentPoints : 0;
    const balanceSpent = isBalance ? totalTalentPoints : 0;
    const restoSpent = isResto ? totalTalentPoints : 0;

    return [
      {
        id: "balance",
        name: "Balance",
        icon: "https://render.worldofwarcraft.com/us/icons/56/spell_nature_starfall.jpg",
        pointsSpent: balanceSpent,
        nodes: [
          { id: "b1", name: "Starlight Wrath", icon: "https://render.worldofwarcraft.com/us/icons/56/spell_nature_abolishmagic.jpg", row: 0, col: 1, rank: balanceSpent >= 5 ? 5 : Math.min(balanceSpent, 5), maxRank: 5, description: "Reduces the cast time of your Wrath and Starfire spells by 0.5 sec." },
          { id: "b2", name: "Nature's Grasp", icon: "https://render.worldofwarcraft.com/us/icons/56/spell_nature_natureswrath.jpg", row: 0, col: 2, rank: 0, maxRank: 1, description: "While active, any time an enemy strikes the caster they have a 35% chance to become afflicted by Entangling Roots.", type: "active" },
          { id: "b3", name: "Nature's Reach", icon: "https://render.worldofwarcraft.com/us/icons/56/spell_nature_naturetouchgrow.jpg", row: 1, col: 0, rank: balanceSpent >= 7 ? 2 : 0, maxRank: 2, description: "Increases the range of your Balance spells and Faerie Fire by 20%." },
          { id: "b4", name: "Improved Moonfire", icon: "https://render.worldofwarcraft.com/us/icons/56/spell_nature_starfall.jpg", row: 1, col: 1, rank: balanceSpent >= 10 ? 5 : 0, maxRank: 5, description: "Increases the damage and critical strike chance of Moonfire by 10%." },
          { id: "b5", name: "Insect Swarm", icon: "https://render.worldofwarcraft.com/us/icons/56/spell_nature_insectswarm.jpg", row: 2, col: 2, rank: balanceSpent >= 11 ? 1 : 0, maxRank: 1, description: "The enemy target is swarmed by insects, decreasing their chance to hit by 2% and causing 66 Nature damage over 12 sec.", type: "active", spellCost: "120 Mana" },
          { id: "b6", name: "Vengeance", icon: "https://render.worldofwarcraft.com/us/icons/56/spell_nature_purge.jpg", row: 3, col: 1, rank: balanceSpent >= 16 ? 5 : 0, maxRank: 5, description: "Increases the critical strike damage bonus of your Starfire, Moonfire, and Wrath spells by 100%." },
          { id: "b7", name: "Moonkin Form", icon: "https://render.worldofwarcraft.com/us/icons/56/spell_nature_forceofnature.jpg", row: 6, col: 1, rank: balanceSpent >= 31 ? 1 : 0, maxRank: 1, description: "Transforms into Moonkin Form, increasing armor contribution by 360% and group spell critical strike chance by 3%.", type: "active" },
        ],
      },
      {
        id: "feral",
        name: "Feral Combat",
        icon: "https://render.worldofwarcraft.com/us/icons/56/ability_racial_bearform.jpg",
        pointsSpent: feralSpent,
        nodes: [
          { id: "f1", name: "Ferocity", icon: "https://render.worldofwarcraft.com/us/icons/56/ability_hunter_pet_hyena.jpg", row: 0, col: 1, rank: feralSpent >= 5 ? 5 : Math.min(feralSpent, 5), maxRank: 5, description: "Reduces the Rage or Energy cost of your Maul, Swipe, Claw, and Rake abilities by 5." },
          { id: "f2", name: "Feral Aggression", icon: "https://render.worldofwarcraft.com/us/icons/56/ability_druid_demoralizingroar.jpg", row: 0, col: 2, rank: 0, maxRank: 5, description: "Increases the Attack Power reduction of Demoralizing Roar by 40% and Ferocious Bite damage by 15%." },
          { id: "f3", name: "Sharpened Claws", icon: "https://render.worldofwarcraft.com/us/icons/56/inv_misc_monsterclaw_04.jpg", row: 1, col: 1, rank: feralSpent >= 8 ? 3 : Math.max(0, Math.min(3, feralSpent - 5)), maxRank: 3, description: "Increases your critical strike chance while in Bear, Dire Bear or Cat Form by 6%." },
          { id: "f4", name: "Feral Charge", icon: "https://render.worldofwarcraft.com/us/icons/56/ability_hunter_pet_bear.jpg", row: 2, col: 1, rank: feralSpent >= 9 ? 1 : 0, maxRank: 1, description: "Causes you to charge an enemy, immobilizing them for 4 sec and interrupting spellcasting.", type: "active", spellCost: "5 Rage" },
          { id: "f5", name: "Predatory Strikes", icon: "https://render.worldofwarcraft.com/us/icons/56/ability_hunter_pet_cat.jpg", row: 2, col: 2, rank: feralSpent >= 12 ? 3 : 0, maxRank: 3, description: "Increases your melee attack power in Cat, Bear and Dire Bear Forms by 150% of your level." },
          { id: "f6", name: "Primal Fury", icon: "https://render.worldofwarcraft.com/us/icons/56/ability_racial_cannibalize.jpg", row: 3, col: 0, rank: feralSpent >= 14 ? 2 : 0, maxRank: 2, description: "Gives you a 100% chance to gain an additional 5 Rage when scoring a critical strike in Bear Form or 1 combo point in Cat Form." },
          { id: "f7", name: "Heart of the Wild", icon: "https://render.worldofwarcraft.com/us/icons/56/spell_holy_blessingofagility.jpg", row: 5, col: 1, rank: feralSpent >= 25 ? 5 : 0, maxRank: 5, description: "Increases your Intellect by 20%. In Dire Bear Form your Stamina is increased by 20% and in Cat Form Strength is increased by 20%." },
          { id: "f8", name: "Leader of the Pack", icon: "https://render.worldofwarcraft.com/us/icons/56/spell_nature_unyeildingstamina.jpg", row: 6, col: 1, rank: feralSpent >= 31 ? 1 : 0, maxRank: 1, description: "While in Cat, Bear, or Dire Bear Form, increases ranged and melee critical chance of all party members within 45 yards by 3%.", type: "passive" },
        ],
      },
      {
        id: "restoration",
        name: "Restoration",
        icon: "https://render.worldofwarcraft.com/us/icons/56/spell_nature_healingtouch.jpg",
        pointsSpent: restoSpent,
        nodes: [
          { id: "r1", name: "Improved Mark of the Wild", icon: "https://render.worldofwarcraft.com/us/icons/56/spell_nature_regeneration.jpg", row: 0, col: 1, rank: restoSpent >= 5 ? 5 : Math.min(restoSpent, 5), maxRank: 5, description: "Increases the effects of your Mark of the Wild and Gift of the Wild spells by 35%." },
          { id: "r2", name: "Furor", icon: "https://render.worldofwarcraft.com/us/icons/56/spell_nature_stoneclawtotem.jpg", row: 0, col: 2, rank: 0, maxRank: 5, description: "Gives you 100% chance to gain 10 Rage upon shifting into Bear and Dire Bear Form, or 40 Energy in Cat Form." },
          { id: "r3", name: "Improved Healing Touch", icon: "https://render.worldofwarcraft.com/us/icons/56/spell_nature_healingtouch.jpg", row: 1, col: 1, rank: restoSpent >= 10 ? 5 : 0, maxRank: 5, description: "Reduces the cast time of your Healing Touch spell by 0.5 sec." },
          { id: "r4", name: "Nature's Swiftness", icon: "https://render.worldofwarcraft.com/us/icons/56/spell_nature_ravenform.jpg", row: 4, col: 0, rank: restoSpent >= 21 ? 1 : 0, maxRank: 1, description: "When activated, your next Nature spell with a base casting time less than 10 sec becomes an instant cast spell.", type: "active" },
          { id: "r5", name: "Swiftmend", icon: "https://render.worldofwarcraft.com/us/icons/56/inv_relics_idolofrejuvenation.jpg", row: 6, col: 1, rank: restoSpent >= 31 ? 1 : 0, maxRank: 1, description: "Consumes a Rejuvenation or Regrowth effect on a friendly target to instantly heal them.", type: "active" },
        ],
      },
    ];
  }

  if (normClass.includes("paladin")) {
    const isRet = normSpec.includes("retri");
    const isProt = normSpec.includes("prot");
    const isHoly = normSpec.includes("holy");

    const retSpent = isRet ? totalTalentPoints : 0;
    const protSpent = isProt ? totalTalentPoints : 0;
    const holySpent = isHoly ? totalTalentPoints : 0;

    return [
      {
        id: "holy",
        name: "Holy",
        icon: "https://render.worldofwarcraft.com/us/icons/56/spell_holy_holybolt.jpg",
        pointsSpent: holySpent,
        nodes: [
          { id: "h1", name: "Spiritual Focus", icon: "https://render.worldofwarcraft.com/us/icons/56/spell_holy_healingfocus.jpg", row: 0, col: 1, rank: holySpent >= 5 ? 5 : Math.min(holySpent, 5), maxRank: 5, description: "Gives your Flash of Light and Holy Light spells a 70% chance to not lose casting time when taking damage." },
          { id: "h2", name: "Divine Intellect", icon: "https://render.worldofwarcraft.com/us/icons/56/spell_nature_sleep.jpg", row: 0, col: 2, rank: 0, maxRank: 5, description: "Increases your total Intellect by 10%." },
          { id: "h3", name: "Illumination", icon: "https://render.worldofwarcraft.com/us/icons/56/spell_holy_greaterheal.jpg", row: 2, col: 1, rank: holySpent >= 11 ? 5 : 0, maxRank: 5, description: "After getting a critical effect from your Flash of Light, Holy Light, or Holy Shock, you have 100% chance to refund the base mana cost." },
          { id: "h4", name: "Divine Favor", icon: "https://render.worldofwarcraft.com/us/icons/56/spell_holy_heal.jpg", row: 4, col: 1, rank: holySpent >= 21 ? 1 : 0, maxRank: 1, description: "When activated, gives your next Flash of Light, Holy Light, or Holy Shock a 100% critical strike chance.", type: "active" },
          { id: "h5", name: "Holy Shock", icon: "https://render.worldofwarcraft.com/us/icons/56/spell_holy_searinglight.jpg", row: 6, col: 1, rank: holySpent >= 31 ? 1 : 0, maxRank: 1, description: "Blasts the target with Holy energy, causing Holy damage to an enemy, or healing to an ally.", type: "active" },
        ],
      },
      {
        id: "protection",
        name: "Protection",
        icon: "https://render.worldofwarcraft.com/us/icons/56/spell_holy_devotionaura.jpg",
        pointsSpent: protSpent,
        nodes: [
          { id: "p1", name: "Redoubt", icon: "https://render.worldofwarcraft.com/us/icons/56/spell_holy_purifyingaura.jpg", row: 0, col: 1, rank: protSpent >= 5 ? 5 : Math.min(protSpent, 5), maxRank: 5, description: "Increases your chance to block attacks with a shield by 30% for 10 sec after taking a critical strike." },
          { id: "p2", name: "Toughness", icon: "https://render.worldofwarcraft.com/us/icons/56/spell_holy_blessingofprotection.jpg", row: 1, col: 1, rank: protSpent >= 10 ? 5 : 0, maxRank: 5, description: "Increases your armor value from items by 10%." },
          { id: "p3", name: "Blessing of Kings", icon: "https://render.worldofwarcraft.com/us/icons/56/spell_magic_magearmor.jpg", row: 2, col: 1, rank: protSpent >= 11 ? 1 : 0, maxRank: 1, description: "Blesses a friendly target, increasing total stats by 10% for 5 min.", type: "active" },
          { id: "p4", name: "Holy Shield", icon: "https://render.worldofwarcraft.com/us/icons/56/spell_holy_blessingofprotection.jpg", row: 6, col: 1, rank: protSpent >= 31 ? 1 : 0, maxRank: 1, description: "Increases chance to block by 30% and deals Holy damage to attackers on block.", type: "active" },
        ],
      },
      {
        id: "retribution",
        name: "Retribution",
        icon: "https://render.worldofwarcraft.com/us/icons/56/spell_holy_auraoflight.jpg",
        pointsSpent: retSpent,
        nodes: [
          { id: "rt1", name: "Benediction", icon: "https://render.worldofwarcraft.com/us/icons/56/spell_frost_windwalkon.jpg", row: 0, col: 1, rank: retSpent >= 5 ? 5 : Math.min(retSpent, 5), maxRank: 5, description: "Reduces the mana cost of your Judgement and Seal spells by 15%." },
          { id: "rt2", name: "Conviction", icon: "https://render.worldofwarcraft.com/us/icons/56/spell_holy_retributionaura.jpg", row: 1, col: 1, rank: retSpent >= 10 ? 5 : Math.max(0, Math.min(5, retSpent - 5)), maxRank: 5, description: "Increases your chance to get a critical strike with melee weapons by 5%." },
          { id: "rt3", name: "Seal of Command", icon: "https://render.worldofwarcraft.com/us/icons/56/ability_warrior_innerrage.jpg", row: 2, col: 1, rank: retSpent >= 11 ? 1 : 0, maxRank: 1, description: "Gives the Paladin a chance to deal additional Holy damage equal to 70% of normal weapon damage.", type: "active" },
          { id: "rt4", name: "Sanctity Aura", icon: "https://render.worldofwarcraft.com/us/icons/56/spell_holy_mindvision.jpg", row: 4, col: 1, rank: retSpent >= 21 ? 1 : 0, maxRank: 1, description: "Increases Holy damage dealt by party members within 30 yards by 10%.", type: "active" },
          { id: "rt5", name: "Repentance", icon: "https://render.worldofwarcraft.com/us/icons/56/spell_holy_prayerofhealing.jpg", row: 6, col: 1, rank: retSpent >= 31 ? 1 : 0, maxRank: 1, description: "Puts the enemy target into a state of meditation, incapacitating them for up to 6 sec.", type: "active" },
        ],
      },
    ];
  }

  // Fallback Warrior / Standard 3 specs
  return [
    {
      id: "arms",
      name: "Arms",
      icon: "https://render.worldofwarcraft.com/us/icons/56/ability_rogue_eviscerate.jpg",
      pointsSpent: totalTalentPoints,
      nodes: [
        { id: "w1", name: "Improved Heroic Strike", icon: "https://render.worldofwarcraft.com/us/icons/56/ability_rogue_ambush.jpg", row: 0, col: 0, rank: 3, maxRank: 3, description: "Reduces the Rage cost of your Heroic Strike ability by 3." },
        { id: "w2", name: "Deflection", icon: "https://render.worldofwarcraft.com/us/icons/56/ability_parry.jpg", row: 0, col: 1, rank: 2, maxRank: 5, description: "Increases your Parry chance by 5%." },
        { id: "w3", name: "Improved Charge", icon: "https://render.worldofwarcraft.com/us/icons/56/ability_warrior_charge.jpg", row: 1, col: 0, rank: 2, maxRank: 2, description: "Increases the Rage generated by your Charge ability by 6." },
        { id: "w4", name: "Deep Wounds", icon: "https://render.worldofwarcraft.com/us/icons/56/ability_backstab.jpg", row: 2, col: 1, rank: 3, maxRank: 3, description: "Your critical strikes cause the opponent to bleed for 60% of your melee weapon's average damage over 12 sec." },
        { id: "w5", name: "Mortal Strike", icon: "https://render.worldofwarcraft.com/us/icons/56/ability_warrior_savageblow.jpg", row: 6, col: 1, rank: 1, maxRank: 1, description: "A vicious weapon strike that deals weapon damage plus 85 and reduces healing received by 50%.", type: "active", spellCost: "30 Rage" },
      ],
    },
    {
      id: "fury",
      name: "Fury",
      icon: "https://render.worldofwarcraft.com/us/icons/56/ability_warrior_innerrage.jpg",
      pointsSpent: 0,
      nodes: [
        { id: "wf1", name: "Cruelty", icon: "https://render.worldofwarcraft.com/us/icons/56/ability_rogue_eviscerate.jpg", row: 0, col: 1, rank: 0, maxRank: 5, description: "Increases your chance to get a critical strike with melee weapons by 5%." },
        { id: "wf2", name: "Enrage", icon: "https://render.worldofwarcraft.com/us/icons/56/spell_shadow_unholyfrenzy.jpg", row: 2, col: 1, rank: 0, maxRank: 5, description: "Gives you a 25% melee damage bonus for 12 sec after being the victim of a critical strike." },
        { id: "wf3", name: "Bloodthirst", icon: "https://render.worldofwarcraft.com/us/icons/56/spell_nature_bloodlust.jpg", row: 6, col: 1, rank: 0, maxRank: 1, description: "Instantly attack the target causing damage equal to 45% of your attack power and healing.", type: "active" },
      ],
    },
    {
      id: "protection",
      name: "Protection",
      icon: "https://render.worldofwarcraft.com/us/icons/56/inv_shield_06.jpg",
      pointsSpent: 0,
      nodes: [
        { id: "wp1", name: "Shield Specialization", icon: "https://render.worldofwarcraft.com/us/icons/56/inv_shield_06.jpg", row: 0, col: 1, rank: 0, maxRank: 5, description: "Increases your chance to block attacks with a shield by 5% and generates 1 Rage on block." },
        { id: "wp2", name: "Shield Slam", icon: "https://render.worldofwarcraft.com/us/icons/56/inv_shield_05.jpg", row: 6, col: 1, rank: 0, maxRank: 1, description: "Slams the target with your shield, causing high damage and dispelling 1 magic effect.", type: "active" },
      ],
    },
  ];
}

// -------------------------------------------------------------
// CLASSIC TBC (Burning Crusade 2.4.3 - Level 70, 61 Points & 41-pt Capstones)
// -------------------------------------------------------------
export function getTBCTalentTrees(
  className: string,
  specName: string,
  level: number = 70
): WoWTalentTreeData[] {
  const normClass = (className || "Druid").toLowerCase();
  const normSpec = (specName || "Feral").toLowerCase();
  const trees = getClassicTalentTrees(className, specName, level);

  // Add iconic TBC 41-point capstones for each tree!
  trees.forEach((tree) => {
    if (tree.id === "feral") {
      tree.nodes.push({
        id: "tbc_mangle",
        name: "Mangle",
        icon: "https://render.worldofwarcraft.com/us/icons/56/ability_druid_mangle2.jpg",
        row: 8,
        col: 1,
        rank: 1,
        maxRank: 1,
        description: "Mangles the target for 115% weapon damage and causes the target to take 30% additional damage from Bleed effects and Shred.",
        type: "active",
      });
      tree.pointsSpent = 41;
    } else if (tree.id === "restoration") {
      tree.nodes.push({
        id: "tbc_treeoflife",
        name: "Tree of Life",
        icon: "https://render.worldofwarcraft.com/us/icons/56/ability_druid_treeoflife.jpg",
        row: 8,
        col: 1,
        rank: 0,
        maxRank: 1,
        description: "Shapeshift into the Tree of Life. While in this form your healing aura increases healing received by 9% of your Spirit.",
        type: "active",
      });
    } else if (tree.id === "balance") {
      tree.nodes.push({
        id: "tbc_forceofnature",
        name: "Force of Nature",
        icon: "https://render.worldofwarcraft.com/us/icons/56/ability_druid_forceofnature.jpg",
        row: 8,
        col: 1,
        rank: 0,
        maxRank: 1,
        description: "Summons 3 treants to attack target for 30 sec.",
        type: "active",
      });
    } else if (tree.id === "retribution") {
      tree.nodes.push({
        id: "tbc_crusaderstrike",
        name: "Crusader Strike",
        icon: "https://render.worldofwarcraft.com/us/icons/56/spell_holy_crusaderstrike.jpg",
        row: 8,
        col: 1,
        rank: 1,
        maxRank: 1,
        description: "An instant weapon strike that causes 110% weapon damage and refreshes all Judgements on the target.",
        type: "active",
      });
      tree.pointsSpent = 41;
    } else if (tree.id === "protection" && normClass.includes("paladin")) {
      tree.nodes.push({
        id: "tbc_avengersshield",
        name: "Avenger's Shield",
        icon: "https://render.worldofwarcraft.com/us/icons/56/spell_holy_avengersshield.jpg",
        row: 8,
        col: 1,
        rank: 0,
        maxRank: 1,
        description: "Hurls a holy shield at the enemy, dealing Holy damage and dazing them, bouncing to up to 3 targets.",
        type: "active",
      });
    } else if (tree.id === "arms") {
      tree.nodes.push({
        id: "tbc_endlessrage",
        name: "Endless Rage",
        icon: "https://render.worldofwarcraft.com/us/icons/56/ability_warrior_endlessrage.jpg",
        row: 8,
        col: 1,
        rank: 1,
        maxRank: 1,
        description: "You generate 25% more Rage from damage dealt.",
        type: "passive",
      });
      tree.pointsSpent = 41;
    } else if (tree.id === "fury") {
      tree.nodes.push({
        id: "tbc_rampage",
        name: "Rampage",
        icon: "https://render.worldofwarcraft.com/us/icons/56/ability_warrior_rampage.jpg",
        row: 8,
        col: 1,
        rank: 0,
        maxRank: 1,
        description: "Goes on a rampage, increasing melee attack power by 50 and causing most successful melee hits to increase attack power further.",
        type: "active",
      });
    }
  });

  return trees;
}

// -------------------------------------------------------------
// CLASSIC MOP (Mists of Pandaria 5.4 - 6 Tier Matrix: Lv 15, 30, 45, 60, 75, 90)
// -------------------------------------------------------------
export function getMoPTalentMatrix(className: string, specName: string): MoPTierRow[] {
  const normClass = (className || "Druid").toLowerCase();

  if (normClass.includes("druid")) {
    return [
      {
        level: 15,
        talents: [
          { id: "mop_d1", name: "Feline Swiftness", icon: "https://render.worldofwarcraft.com/us/icons/56/spell_druid_tirelesspursuit.jpg", row: 0, col: 0, rank: 1, maxRank: 1, selected: true, description: "Increases your movement speed by 15% at all times." },
          { id: "mop_d2", name: "Displacer Beast", icon: "https://render.worldofwarcraft.com/us/icons/56/spell_druid_displacement.jpg", row: 0, col: 1, rank: 0, maxRank: 1, selected: false, description: "Teleports the Druid up to 20 yards forward, activates Cat Form, and grants 50% movement speed for 4 sec.", type: "active", cooldown: "30s" },
          { id: "mop_d3", name: "Wild Charge", icon: "https://render.worldofwarcraft.com/us/icons/56/spell_druid_wildcharge.jpg", row: 0, col: 2, rank: 0, maxRank: 1, selected: false, description: "Grants a movement ability that varies by shapeshift form.", type: "active", cooldown: "15s" },
        ],
      },
      {
        level: 30,
        talents: [
          { id: "mop_d4", name: "Ysera's Gift", icon: "https://render.worldofwarcraft.com/us/icons/56/spell_nature_healingtouch.jpg", row: 1, col: 0, rank: 1, maxRank: 1, selected: true, description: "Heals you for 5% of your maximum health every 5 sec. If at full health, heals a nearby injured party member." },
          { id: "mop_d5", name: "Renewal", icon: "https://render.worldofwarcraft.com/us/icons/56/spell_nature_naturestouch.jpg", row: 1, col: 1, rank: 0, maxRank: 1, selected: false, description: "Instantly heals you for 30% of your maximum health. Usable in all shapeshift forms.", type: "active", cooldown: "2 min" },
          { id: "mop_d6", name: "Cenarion Ward", icon: "https://render.worldofwarcraft.com/us/icons/56/ability_druid_naturalperfection.jpg", row: 1, col: 2, rank: 0, maxRank: 1, selected: false, description: "Protects a friendly target, healing them for periodic Nature healing every 2 sec for 6 sec when taking damage.", type: "active", cooldown: "30s" },
        ],
      },
      {
        level: 45,
        talents: [
          { id: "mop_d7", name: "Faerie Swarm", icon: "https://render.worldofwarcraft.com/us/icons/56/spell_nature_starfall.jpg", row: 2, col: 0, rank: 0, maxRank: 1, selected: false, description: "Upgrades Faerie Fire, also reducing movement speed by 50% for 15 sec." },
          { id: "mop_d8", name: "Mass Entanglement", icon: "https://render.worldofwarcraft.com/us/icons/56/spell_nature_stranglevines.jpg", row: 2, col: 1, rank: 0, maxRank: 1, selected: false, description: "Roots target and all enemies within 15 yards in place for up to 20 sec.", type: "active", cooldown: "30s" },
          { id: "mop_d9", name: "Typhoon", icon: "https://render.worldofwarcraft.com/us/icons/56/ability_druid_typhoon.jpg", row: 2, col: 2, rank: 1, maxRank: 1, selected: true, description: "Summons a violent Typhoon that knocks back enemies within 30 yards and dazes them for 6 sec.", type: "active", cooldown: "30s" },
        ],
      },
      {
        level: 60,
        talents: [
          { id: "mop_d10", name: "Soul of the Forest", icon: "https://render.worldofwarcraft.com/us/icons/56/ability_druid_manatree.jpg", row: 3, col: 0, rank: 0, maxRank: 1, selected: false, description: "Grants powerful bonuses after casting your spec's signature core abilities." },
          { id: "mop_d11", name: "Incarnation: King of the Jungle", icon: "https://render.worldofwarcraft.com/us/icons/56/spell_druid_incarnation.jpg", row: 3, col: 1, rank: 1, maxRank: 1, selected: true, description: "An improved Cat Form that allows Prowl in combat and reduces Energy costs by 50%.", type: "active", cooldown: "3 min" },
          { id: "mop_d12", name: "Force of Nature", icon: "https://render.worldofwarcraft.com/us/icons/56/ability_druid_forceofnature.jpg", row: 3, col: 2, rank: 0, maxRank: 1, selected: false, description: "Summons a Treant which immediately assists you in battle for 15 sec.", type: "active" },
        ],
      },
      {
        level: 75,
        talents: [
          { id: "mop_d13", name: "Disorienting Roar", icon: "https://render.worldofwarcraft.com/us/icons/56/ability_druid_demoralizingroar.jpg", row: 4, col: 0, rank: 0, maxRank: 1, selected: false, description: "Invokes the roar of Ursoc, disorienting all enemies within 10 yards for 3 sec.", type: "active", cooldown: "30s" },
          { id: "mop_d14", name: "Ursol's Vortex", icon: "https://render.worldofwarcraft.com/us/icons/56/spell_druid_ursolsvortex.jpg", row: 4, col: 1, rank: 1, maxRank: 1, selected: true, description: "Creates a vortex of wind at target location. Enemies who try to leave are pulled back into the center.", type: "active", cooldown: "1 min" },
          { id: "mop_d15", name: "Mighty Bash", icon: "https://render.worldofwarcraft.com/us/icons/56/ability_druid_bash.jpg", row: 4, col: 2, rank: 0, maxRank: 1, selected: false, description: "Invokes the spirit of Ursoc to stun the target for 5 sec. Usable in all forms.", type: "active", cooldown: "50s" },
        ],
      },
      {
        level: 90,
        talents: [
          { id: "mop_d16", name: "Heart of the Wild", icon: "https://render.worldofwarcraft.com/us/icons/56/spell_holy_blessingofagility.jpg", row: 5, col: 0, rank: 1, maxRank: 1, selected: true, description: "Dramatically increases the Druid's ability to heal, tank, or cast damage spells outside their normal role for 45 sec.", type: "active", cooldown: "6 min" },
          { id: "mop_d17", name: "Dream of Cenarius", icon: "https://render.worldofwarcraft.com/us/icons/56/ability_druid_dreamstate.jpg", row: 5, col: 1, rank: 0, maxRank: 1, selected: false, description: "Casting Healing Touch increases the damage of your next 2 melee abilities by 30%." },
          { id: "mop_d18", name: "Nature's Vigil", icon: "https://render.worldofwarcraft.com/us/icons/56/achievement_zone_feralas.jpg", row: 5, col: 2, rank: 0, maxRank: 1, selected: false, description: "While active, all single-target damage and healing spells also heal a nearby friendly target for 25% of the amount.", type: "active", cooldown: "1.5 min" },
        ],
      },
    ];
  }

  // Paladin MoP Matrix
  if (normClass.includes("paladin")) {
    return [
      {
        level: 15,
        talents: [
          { id: "mop_p1", name: "Speed of Light", icon: "https://render.worldofwarcraft.com/us/icons/56/ability_paladin_speedoflight.jpg", row: 0, col: 0, rank: 1, maxRank: 1, selected: true, description: "Increases your movement speed by 70% for 8 sec.", type: "active", cooldown: "45s" },
          { id: "mop_p2", name: "Long Arm of the Law", icon: "https://render.worldofwarcraft.com/us/icons/56/ability_paladin_longarmofthelaw.jpg", row: 0, col: 1, rank: 0, maxRank: 1, selected: false, description: "A successful Judgement increases your movement speed by 45% for 3 sec." },
          { id: "mop_p3", name: "Pursuit of Justice", icon: "https://render.worldofwarcraft.com/us/icons/56/ability_paladin_vindicatingstrike.jpg", row: 0, col: 2, rank: 0, maxRank: 1, selected: false, description: "Increases movement speed by 15% plus 5% for each charge of Holy Power up to 3." },
        ],
      },
      {
        level: 30,
        talents: [
          { id: "mop_p4", name: "Fist of Justice", icon: "https://render.worldofwarcraft.com/us/icons/56/spell_holy_fistofjustice.jpg", row: 1, col: 0, rank: 1, maxRank: 1, selected: true, description: "Stuns the target for 6 sec. 20 yd range.", type: "active", cooldown: "30s" },
          { id: "mop_p5", name: "Repentance", icon: "https://render.worldofwarcraft.com/us/icons/56/spell_holy_prayerofhealing.jpg", row: 1, col: 1, rank: 0, maxRank: 1, selected: false, description: "Incapacitates an enemy target for up to 1 min.", type: "active", cooldown: "15s" },
          { id: "mop_p6", name: "Evil is a Point of View", icon: "https://render.worldofwarcraft.com/us/icons/56/spell_holy_turnundead.jpg", row: 1, col: 2, rank: 0, maxRank: 1, selected: false, description: "Your Turn Evil spell now also affects Humanoids and Beasts." },
        ],
      },
      {
        level: 45,
        talents: [
          { id: "mop_p7", name: "Selfless Healer", icon: "https://render.worldofwarcraft.com/us/icons/56/ability_paladin_selflesshealer.jpg", row: 2, col: 0, rank: 1, maxRank: 1, selected: true, description: "Your successful Judgements reduce cast time and mana cost of your next Flash of Light by 35%." },
          { id: "mop_p8", name: "Eternal Flame", icon: "https://render.worldofwarcraft.com/us/icons/56/inv_torch_lit.jpg", row: 2, col: 1, rank: 0, maxRank: 1, selected: false, description: "Replaces Word of Glory, providing periodic healing over 30 sec.", type: "active" },
          { id: "mop_p9", name: "Sacred Shield", icon: "https://render.worldofwarcraft.com/us/icons/56/ability_paladin_blessedmending.jpg", row: 2, col: 2, rank: 0, maxRank: 1, selected: false, description: "Protects target with a holy shield that absorbs damage every 6 sec.", type: "active" },
        ],
      },
      {
        level: 60,
        talents: [
          { id: "mop_p10", name: "Hand of Purity", icon: "https://render.worldofwarcraft.com/us/icons/56/spell_holy_sealofwisdom.jpg", row: 3, col: 0, rank: 0, maxRank: 1, selected: false, description: "Places a Hand on an ally, reducing damage from periodic effects by 80% for 6 sec.", type: "active", cooldown: "30s" },
          { id: "mop_p11", name: "Unbreakable Spirit", icon: "https://render.worldofwarcraft.com/us/icons/56/spell_holy_unbreakablespirit.jpg", row: 3, col: 1, rank: 1, maxRank: 1, selected: true, description: "Reduces the cooldown of your Divine Shield, Divine Protection, and Lay on Hands by 50%." },
          { id: "mop_p12", name: "Clemency", icon: "https://render.worldofwarcraft.com/us/icons/56/ability_paladin_clemency.jpg", row: 3, col: 2, rank: 0, maxRank: 1, selected: false, description: "You can use Hand of Freedom, Hand of Protection, and Hand of Sacrifice twice before incurring cooldown." },
        ],
      },
      {
        level: 75,
        talents: [
          { id: "mop_p13", name: "Holy Avenger", icon: "https://render.worldofwarcraft.com/us/icons/56/ability_paladin_holyavenger.jpg", row: 4, col: 0, rank: 1, maxRank: 1, selected: true, description: "Abilities that generate Holy Power generate 3 charges of Holy Power for 18 sec.", type: "active", cooldown: "2 min" },
          { id: "mop_p14", name: "Sanctified Wrath", icon: "https://render.worldofwarcraft.com/us/icons/56/ability_paladin_sanctifiedwrath.jpg", row: 4, col: 1, rank: 0, maxRank: 1, selected: false, description: "Avenging Wrath lasts 50% longer and grants enhanced rotational ability cooldowns." },
          { id: "mop_p15", name: "Divine Purpose", icon: "https://render.worldofwarcraft.com/us/icons/56/spell_holy_divinepurpose.jpg", row: 4, col: 2, rank: 0, maxRank: 1, selected: false, description: "Abilities that cost Holy Power have a 25% chance to cause your next Holy Power ability to cost no Holy Power." },
        ],
      },
      {
        level: 90,
        talents: [
          { id: "mop_p16", name: "Holy Prism", icon: "https://render.worldofwarcraft.com/us/icons/56/spell_paladin_holyprism.jpg", row: 5, col: 0, rank: 0, maxRank: 1, selected: false, description: "Sends a beam of holy light into a target, bursting into radiant energy.", type: "active", cooldown: "20s" },
          { id: "mop_p17", name: "Light's Hammer", icon: "https://render.worldofwarcraft.com/us/icons/56/spell_paladin_lightshammer.jpg", row: 5, col: 1, rank: 0, maxRank: 1, selected: false, description: "Hurls a Light-infused hammer into the ground, blasting holy arcs at enemies and healing allies.", type: "active", cooldown: "1 min" },
          { id: "mop_p18", name: "Execution Sentence", icon: "https://render.worldofwarcraft.com/us/icons/56/spell_paladin_executionsentence.jpg", row: 5, col: 2, rank: 1, maxRank: 1, selected: true, description: "A hammer slowly falls from the sky, dealing increasing Holy damage over 10 sec, culminating in a burst.", type: "active", cooldown: "1 min" },
        ],
      },
    ];
  }

  // Generic Warrior / Generic MoP Matrix
  return [
    {
      level: 15,
      talents: [
        { id: "mop_w1", name: "Juggernaut", icon: "https://render.worldofwarcraft.com/us/icons/56/ability_warrior_charge.jpg", row: 0, col: 0, rank: 1, maxRank: 1, selected: true, description: "Reduces the cooldown of Charge to 12 sec." },
        { id: "mop_w2", name: "Double Time", icon: "https://render.worldofwarcraft.com/us/icons/56/inv_misc_horn_04.jpg", row: 0, col: 1, rank: 0, maxRank: 1, selected: false, description: "You may use Charge twice in a row with a 20 sec recharge." },
        { id: "mop_w3", name: "Warbringer", icon: "https://render.worldofwarcraft.com/us/icons/56/ability_warrior_warbringer.jpg", row: 0, col: 2, rank: 0, maxRank: 1, selected: false, description: "Your Charge stuns target for 4 sec." },
      ],
    },
    {
      level: 30,
      talents: [
        { id: "mop_w4", name: "Enraged Regeneration", icon: "https://render.worldofwarcraft.com/us/icons/56/ability_warrior_focusedrage.jpg", row: 1, col: 0, rank: 1, maxRank: 1, selected: true, description: "Instantly heals you for 10% of total health, and an additional 20% over 5 sec.", type: "active", cooldown: "1 min" },
        { id: "mop_w5", name: "Second Wind", icon: "https://render.worldofwarcraft.com/us/icons/56/ability_hunter_harass.jpg", row: 1, col: 1, rank: 0, maxRank: 1, selected: false, description: "Whenever you are below 35% health, you regenerate 3% health per second." },
        { id: "mop_w6", name: "Impending Victory", icon: "https://render.worldofwarcraft.com/us/icons/56/spell_nature_healingtouch.jpg", row: 1, col: 2, rank: 0, maxRank: 1, selected: false, description: "Instantly attack the target for weapon damage and heal for 15% health.", type: "active", cooldown: "30s" },
      ],
    },
    {
      level: 45,
      talents: [
        { id: "mop_w7", name: "Staggering Shout", icon: "https://render.worldofwarcraft.com/us/icons/56/ability_warrior_warcry.jpg", row: 2, col: 0, rank: 0, maxRank: 1, selected: false, description: "Roots all snared enemies within 20 yards for 5 sec." },
        { id: "mop_w8", name: "Piercing Howl", icon: "https://render.worldofwarcraft.com/us/icons/56/spell_shadow_deathscream.jpg", row: 2, col: 1, rank: 1, maxRank: 1, selected: true, description: "Causes all enemies within 15 yards to be snared by 50% for 15 sec.", type: "active" },
        { id: "mop_w9", name: "Disrupting Shout", icon: "https://render.worldofwarcraft.com/us/icons/56/ability_warrior_shieldbash.jpg", row: 2, col: 2, rank: 0, maxRank: 1, selected: false, description: "Interrupts all spellcasting within 10 yards and locks school for 4 sec.", type: "active", cooldown: "40s" },
      ],
    },
    {
      level: 60,
      talents: [
        { id: "mop_w10", name: "Bladestorm", icon: "https://render.worldofwarcraft.com/us/icons/56/ability_warrior_bladestorm.jpg", row: 3, col: 0, rank: 1, maxRank: 1, selected: true, description: "Become an unstoppable storm of destructive force, spinning for 6 sec.", type: "active", cooldown: "1 min" },
        { id: "mop_w11", name: "Shockwave", icon: "https://render.worldofwarcraft.com/us/icons/56/ability_warrior_shockwave.jpg", row: 3, col: 1, rank: 0, maxRank: 1, selected: false, description: "Sends a wave of force in a frontal cone, stunning enemies for 4 sec.", type: "active", cooldown: "40s" },
        { id: "mop_w12", name: "Dragon Roar", icon: "https://render.worldofwarcraft.com/us/icons/56/ability_warrior_dragonroar.jpg", row: 3, col: 2, rank: 0, maxRank: 1, selected: false, description: "Roars ferociously, dealing damage that ignores armor and knocks back enemies.", type: "active", cooldown: "1 min" },
      ],
    },
    {
      level: 75,
      talents: [
        { id: "mop_w13", name: "Mass Spell Reflection", icon: "https://render.worldofwarcraft.com/us/icons/56/ability_warrior_shieldreflection.jpg", row: 4, col: 0, rank: 1, maxRank: 1, selected: true, description: "Reflects the next spell cast on you and all party members within 20 yards.", type: "active", cooldown: "1 min" },
        { id: "mop_w14", name: "Safeguard", icon: "https://render.worldofwarcraft.com/us/icons/56/ability_warrior_safeguard.jpg", row: 4, col: 1, rank: 0, maxRank: 1, selected: false, description: "Run at top speed to an ally, intercepting next attack and reducing damage taken by 20%." },
        { id: "mop_w15", name: "Vigilance", icon: "https://render.worldofwarcraft.com/us/icons/56/ability_warrior_vigilance.jpg", row: 4, col: 2, rank: 0, maxRank: 1, selected: false, description: "Focus your protective gaze on an ally, reducing damage they take by 30% for 12 sec.", type: "active", cooldown: "2 min" },
      ],
    },
    {
      level: 90,
      talents: [
        { id: "mop_w16", name: "Avatar", icon: "https://render.worldofwarcraft.com/us/icons/56/warrior_talent_icon_avatar.jpg", row: 5, col: 0, rank: 1, maxRank: 1, selected: true, description: "Transform into an unstoppable colossus for 20 sec, increasing damage dealt by 20%.", type: "active", cooldown: "3 min" },
        { id: "mop_w17", name: "Bloodbath", icon: "https://render.worldofwarcraft.com/us/icons/56/ability_warrior_bloodspurt.jpg", row: 5, col: 1, rank: 0, maxRank: 1, selected: false, description: "For 12 sec, your melee attacks cause an additional 30% bleed damage and slow enemies.", type: "active", cooldown: "1 min" },
        { id: "mop_w18", name: "Storm Bolt", icon: "https://render.worldofwarcraft.com/us/icons/56/warrior_talent_icon_stormbolt.jpg", row: 5, col: 2, rank: 0, maxRank: 1, selected: false, description: "Hurl your weapon at an enemy, dealing high damage and stunning them for 4 sec.", type: "active", cooldown: "30s" },
      ],
    },
  ];
}

// -------------------------------------------------------------
// RETAIL (Midnight - Class Tree + Spec Tree + Hero Talents)
// -------------------------------------------------------------
export function getRetailDualTalentTrees(className: string, specName: string): RetailDualTalents {
  const normClass = (className || "Druid").toLowerCase();
  const normSpec = (specName || "Feral").toLowerCase();

  const heroTreeName = normClass.includes("druid")
    ? "Elune's Chosen"
    : normClass.includes("paladin")
    ? "Herald of the Sun"
    : normClass.includes("warrior")
    ? "Mountain Thane"
    : "Midnight Paragon";

  return {
    classTree: {
      title: `Class Tree: ${className}`,
      pointsSpent: 31,
      maxPoints: 31,
      nodes: [
        { id: "rc_1", name: "Rejuvenation / Vitality", icon: "https://render.worldofwarcraft.com/us/icons/56/spell_nature_rejuvenation.jpg", row: 0, col: 1, rank: 1, maxRank: 1, type: "active", spellCost: "2.2% Mana", castTime: "Instant", description: "Heals target for Nature healing over 12 sec." },
        { id: "rc_2", name: "Moonfire / Arcane Blast", icon: "https://render.worldofwarcraft.com/us/icons/56/spell_nature_starfall.jpg", row: 0, col: 2, rank: 1, maxRank: 1, type: "active", spellCost: "1.2% Mana", castTime: "Instant", description: "Burns enemy with swift lunar rays for Arcane damage over 18 sec." },
        { id: "rc_3", name: "Mark of the Wild", icon: "https://render.worldofwarcraft.com/us/icons/56/spell_nature_regeneration.jpg", row: 1, col: 1, rank: 1, maxRank: 1, type: "active", description: "Increases Versatility of all party and raid members by 3%." },
        { id: "rc_4", name: "Barkskin / Iron Skin", icon: "https://render.worldofwarcraft.com/us/icons/56/spell_nature_stoneclawtotem.jpg", row: 3, col: 1, rank: 1, maxRank: 1, type: "active", cooldown: "1 min", description: "Reduces all damage taken by 20% for 12 sec." },
        { id: "rc_5", name: "Heart of the Wild", icon: "https://render.worldofwarcraft.com/us/icons/56/spell_holy_blessingofagility.jpg", row: 6, col: 1, rank: 1, maxRank: 1, type: "active", cooldown: "5 min", description: "Dramatically enhances off-spec capabilities for 45 sec." },
      ],
    },
    specTree: {
      title: `Spec Tree: ${specName}`,
      specName,
      pointsSpent: 30,
      maxPoints: 30,
      nodes: [
        { id: "rs_1", name: "Rip / Mortal Strike", icon: "https://render.worldofwarcraft.com/us/icons/56/ability_ghoulfrenzy.jpg", row: 0, col: 1, rank: 1, maxRank: 1, type: "active", spellCost: "30 Energy", description: "Signature rotational finisher that causes heavy bleeding damage." },
        { id: "rs_2", name: "Ferocious Bite / Bloodthirst", icon: "https://render.worldofwarcraft.com/us/icons/56/ability_druid_ferociousbite.jpg", row: 0, col: 2, rank: 1, maxRank: 1, type: "active", spellCost: "25 Energy", description: "Devastating burst damage strike consuming excess resources." },
        { id: "rs_3", name: "Tiger's Fury / Recklessness", icon: "https://render.worldofwarcraft.com/us/icons/56/ability_mount_jungletiger.jpg", row: 1, col: 1, rank: 1, maxRank: 1, type: "active", cooldown: "30s", description: "Instantly restores resources and increases physical damage by 15%." },
        { id: "rs_4", name: "Incarnation / Avatar", icon: "https://render.worldofwarcraft.com/us/icons/56/spell_druid_incarnation.jpg", row: 4, col: 1, rank: 1, maxRank: 1, type: "choice", cooldown: "3 min", description: "Ascend into a supreme combat form with halved costs and empowered procs." },
        { id: "rs_5", name: "Apex Capstone", icon: "https://render.worldofwarcraft.com/us/icons/56/ability_druid_primaltenacity.jpg", row: 6, col: 1, rank: 1, maxRank: 1, type: "active", cooldown: "45s", description: "Unleash devastating apex burst dealing severe physical damage and generating combo points." },
      ],
    },
    heroTree: {
      heroTreeName,
      pointsSpent: 10,
      maxPoints: 10,
      nodes: [
        { id: "hero_keystone", name: `${heroTreeName} Keystone`, icon: "https://render.worldofwarcraft.com/us/icons/56/spell_holy_auramastery.jpg", row: 0, col: 1, rank: 1, maxRank: 1, type: "passive", description: "Signature hero mastery enabling lunar arcane strikes and ambient shielding." },
        { id: "hero_minor1", name: "Astral Attunement", icon: "https://render.worldofwarcraft.com/us/icons/56/spell_nature_starfall.jpg", row: 1, col: 0, rank: 1, maxRank: 1, type: "passive", description: "Increases Arcane and Astral damage dealt by 10%." },
        { id: "hero_minor2", name: "Lunar Ward", icon: "https://render.worldofwarcraft.com/us/icons/56/spell_holy_devotionaura.jpg", row: 1, col: 2, rank: 1, maxRank: 1, type: "passive", description: "Converts 15% of critical damage dealt into an ambient shield." },
        { id: "hero_capstone", name: `${heroTreeName} Capstone`, icon: "https://render.worldofwarcraft.com/us/icons/56/spell_nature_forceofnature.jpg", row: 3, col: 1, rank: 1, maxRank: 1, type: "passive", description: "Pinnacle Hero Talent that unleashes an apocalyptic celestial barrage on critical hits." },
      ],
    },
  };
}
