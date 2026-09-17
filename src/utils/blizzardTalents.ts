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
}

// -------------------------------------------------------------
// CLASSIC / FOREVER / TBC TALENT TREES (3 Trees per Class, 7 Tiers)
// -------------------------------------------------------------

export function getClassicTalentTrees(className: string, specName: string, level: number): WoWTalentTreeData[] {
  const normClass = (className || "Druid").toLowerCase();
  const normSpec = (specName || "Feral").toLowerCase();
  const totalTalentPoints = Math.max(0, Math.min(51, level - 9));

  // 1. DRUID (Equilíbrio / Combate Feral / Restauração)
  if (normClass.includes("druid") || normClass.includes("druida")) {
    const isFeral = normSpec.includes("feral") || normSpec.includes("combate");
    const isBalance = normSpec.includes("equil") || normSpec.includes("balance");
    const isResto = normSpec.includes("restor") || normSpec.includes("restau");

    const feralSpent = isFeral ? totalTalentPoints : isResto ? 0 : 0;
    const balanceSpent = isBalance ? totalTalentPoints : 0;
    const restoSpent = isResto ? totalTalentPoints : 0;

    return [
      {
        id: "balance",
        name: "Equilíbrio",
        icon: "https://wow.zamimg.com/images/wow/icons/large/spell_nature_starfall.jpg",
        pointsSpent: balanceSpent,
        nodes: [
          { id: "b1", name: "Ira da Natureza", icon: "https://wow.zamimg.com/images/wow/icons/large/spell_nature_abolishmagic.jpg", row: 0, col: 1, rank: balanceSpent >= 5 ? 5 : Math.min(balanceSpent, 5), maxRank: 5, description: "Reduz o tempo de lançamento dos feitiços Ira e Fogo Estelar em 0.5s." },
          { id: "b2", name: "Foco da Natureza", icon: "https://wow.zamimg.com/images/wow/icons/large/spell_nature_healingtouch.jpg", row: 0, col: 2, rank: 0, maxRank: 5, description: "Dá a você 70% de chance de evitar interrupção por dano ao lançar feitiços de cura." },
          { id: "b3", name: "Alcance da Natureza", icon: "https://wow.zamimg.com/images/wow/icons/large/spell_nature_naturetouchgrow.jpg", row: 1, col: 0, rank: balanceSpent >= 7 ? 2 : 0, maxRank: 2, description: "Aumenta o alcance dos feitiços de dano de Natureza em 20%." },
          { id: "b4", name: "Fogo Lunar Aprimorado", icon: "https://wow.zamimg.com/images/wow/icons/large/spell_nature_starfall.jpg", row: 1, col: 1, rank: balanceSpent >= 10 ? 5 : 0, maxRank: 5, description: "Aumenta o dano e a chance de acerto crítico do Fogo Lunar em 10%." },
          { id: "b5", name: "Enxame de Insetos", icon: "https://wow.zamimg.com/images/wow/icons/large/spell_nature_insectswarm.jpg", row: 2, col: 2, rank: balanceSpent >= 11 ? 1 : 0, maxRank: 1, description: "O alvo é atacado por um enxame de insetos, causando 66 de dano de Natureza ao longo de 12s.", type: "active", spellCost: "120 Mana" },
          { id: "b6", name: "Raízes Entrelaçadas Aprimoradas", icon: "https://wow.zamimg.com/images/wow/icons/large/spell_nature_stranglevines.jpg", row: 3, col: 1, rank: balanceSpent >= 14 ? 3 : 0, maxRank: 3, description: "Dá às suas Raízes Entrelaçadas 100% de chance de resistir a remoção." },
          { id: "b7", name: "Fogo Estelar Aprimorado", icon: "https://wow.zamimg.com/images/wow/icons/large/spell_arcane_starfire.jpg", row: 4, col: 2, rank: balanceSpent >= 20 ? 5 : 0, maxRank: 5, description: "Reduz o tempo de lançamento do Fogo Estelar em 0.5s e dá 15% de chance de atordoar o alvo por 3s." },
          { id: "b8", name: "Forma de Luniscante", icon: "https://wow.zamimg.com/images/wow/icons/large/spell_nature_forceofnature.jpg", row: 6, col: 1, rank: balanceSpent >= 31 ? 1 : 0, maxRank: 1, description: "Transforma o druida em Luniscante, aumentando a armadura em 360% e concedendo 3% de acerto crítico com feitiços ao grupo.", type: "active" },
        ],
      },
      {
        id: "feral",
        name: "Combate Feral",
        icon: "https://wow.zamimg.com/images/wow/icons/large/ability_racial_bearform.jpg",
        pointsSpent: feralSpent,
        nodes: [
          { id: "f1", name: "Ferocidade", icon: "https://wow.zamimg.com/images/wow/icons/large/ability_hunter_pet_hyena.jpg", row: 0, col: 1, rank: feralSpent >= 5 ? 5 : Math.min(feralSpent, 5), maxRank: 5, description: "Reduz o custo em Fúria ou Energia de Golpe Esmagador, Rasgar e Mordida Feroz em 5." },
          { id: "f2", name: "Agressão Feral", icon: "https://wow.zamimg.com/images/wow/icons/large/ability_druid_demoralizingroar.jpg", row: 0, col: 2, rank: 0, maxRank: 5, description: "Aumenta a redução de Poder de Ataque do Rugido Desmoralizador em 40% e o dano de Mordida Feroz em 15%." },
          { id: "f3", name: "Instinto Brutal", icon: "https://wow.zamimg.com/images/wow/icons/large/ability_druid_bash.jpg", row: 1, col: 0, rank: 0, maxRank: 3, description: "Aumenta o dano de Patada em 15% e a detecção de Furtividade." },
          { id: "f4", name: "Garras Afiadas", icon: "https://wow.zamimg.com/images/wow/icons/large/inv_misc_monsterclaw_04.jpg", row: 1, col: 1, rank: feralSpent >= 8 ? 3 : Math.max(0, Math.min(3, feralSpent - 5)), maxRank: 3, description: "Aumenta a chance de acerto crítico nas Formas de Urso e Felino em 6%." },
          { id: "f5", name: "Investida Feral", icon: "https://wow.zamimg.com/images/wow/icons/large/ability_hunter_pet_bear.jpg", row: 2, col: 1, rank: feralSpent >= 9 ? 1 : 0, maxRank: 1, description: "Investe contra um inimigo, imobilizando-o por 4s e interrompendo qualquer feitiço.", type: "active", spellCost: "5 Fúria" },
          { id: "f6", name: "Golpes Predatórios", icon: "https://wow.zamimg.com/images/wow/icons/large/ability_hunter_pet_cat.jpg", row: 2, col: 2, rank: feralSpent >= 12 ? 3 : 0, maxRank: 3, description: "Aumenta o Poder de Ataque em Urso e Felino em 150% do seu nível." },
          { id: "f7", name: "Fúria Primitiva", icon: "https://wow.zamimg.com/images/wow/icons/large/ability_racial_cannibalize.jpg", row: 3, col: 0, rank: feralSpent >= 14 ? 2 : 0, maxRank: 2, description: "Dá a você 100% de chance de ganhar 5 de Fúria extra no crítico em Urso ou 1 ponto de combo em Felino." },
          { id: "f8", name: "Coração do Selvagem", icon: "https://wow.zamimg.com/images/wow/icons/large/spell_holy_blessingofagility.jpg", row: 5, col: 1, rank: feralSpent >= 25 ? 5 : 0, maxRank: 5, description: "Aumenta o Intelecto em 20%. Na Forma de Urso aumenta o Vigor em 20%, e em Felino aumenta a Força em 20%." },
          { id: "f9", name: "Líder da Matilha", icon: "https://wow.zamimg.com/images/wow/icons/large/spell_nature_unyeildingstamina.jpg", row: 6, col: 1, rank: feralSpent >= 31 ? 1 : 0, maxRank: 1, description: "Aumenta a chance de acerto crítico corpo a corpo de todos os membros do grupo em 3% enquanto você estiver na Forma Felina ou de Urso.", type: "passive" },
        ],
      },
      {
        id: "restoration",
        name: "Restauração",
        icon: "https://wow.zamimg.com/images/wow/icons/large/spell_nature_healingtouch.jpg",
        pointsSpent: restoSpent,
        nodes: [
          { id: "r1", name: "Marca do Ermo Aprimorada", icon: "https://wow.zamimg.com/images/wow/icons/large/spell_nature_regeneration.jpg", row: 0, col: 1, rank: restoSpent >= 5 ? 5 : Math.min(restoSpent, 5), maxRank: 5, description: "Aumenta os efeitos dos feitiços Marca do Ermo e Dádiva do Ermo em 35%." },
          { id: "r2", name: "Furor", icon: "https://wow.zamimg.com/images/wow/icons/large/spell_nature_stoneclawtotem.jpg", row: 0, col: 2, rank: 0, maxRank: 5, description: "Dá a você 100% de chance de ganhar 10 de Fúria ao assumir a Forma de Urso, ou 40 de Energia na Forma Felina." },
          { id: "r3", name: "Toque de Cura Aprimorado", icon: "https://wow.zamimg.com/images/wow/icons/large/spell_nature_healingtouch.jpg", row: 1, col: 1, rank: restoSpent >= 10 ? 5 : 0, maxRank: 5, description: "Reduz o tempo de lançamento do feitiço Toque de Cura em 0.5s." },
          { id: "r4", name: "Rejuvenescimento Aprimorado", icon: "https://wow.zamimg.com/images/wow/icons/large/spell_nature_rejuvenation.jpg", row: 2, col: 1, rank: restoSpent >= 13 ? 3 : 0, maxRank: 3, description: "Aumenta a eficácia do feitiço Rejuvenescimento em 15%." },
          { id: "r5", name: "Rapidez da Natureza", icon: "https://wow.zamimg.com/images/wow/icons/large/spell_nature_ravenform.jpg", row: 4, col: 0, rank: restoSpent >= 21 ? 1 : 0, maxRank: 1, description: "Quando ativado, seu próximo feitiço de Natureza com lançamento inferior a 10s torna-se instantâneo.", type: "active" },
          { id: "r6", name: "Alívio Rápido", icon: "https://wow.zamimg.com/images/wow/icons/large/inv_relics_idolofrejuvenation.jpg", row: 6, col: 1, rank: restoSpent >= 31 ? 1 : 0, maxRank: 1, description: "Consome um efeito de Rejuvenescimento ou Recrescimento no aliado para curá-lo instantaneamente.", type: "active" },
        ],
      },
    ];
  }

  // 2. PALADIN (Sagrado / Proteção / Retribuição)
  if (normClass.includes("paladin") || normClass.includes("paladino")) {
    const isRet = normSpec.includes("retribu") || normSpec.includes("retri");
    const isProt = normSpec.includes("prote");
    const isHoly = normSpec.includes("sagr") || normSpec.includes("holy");

    const retSpent = isRet ? totalTalentPoints : 0;
    const protSpent = isProt ? totalTalentPoints : 0;
    const holySpent = isHoly ? totalTalentPoints : 0;

    return [
      {
        id: "holy",
        name: "Sagrado",
        icon: "https://wow.zamimg.com/images/wow/icons/large/spell_holy_holybolt.jpg",
        pointsSpent: holySpent,
        nodes: [
          { id: "h1", name: "Força Espiritual", icon: "https://wow.zamimg.com/images/wow/icons/large/spell_holy_magicalsentry.jpg", row: 0, col: 1, rank: holySpent >= 5 ? 5 : Math.min(holySpent, 5), maxRank: 5, description: "Aumenta o total de Mana em 10%." },
          { id: "h2", name: "Foco Espiritual", icon: "https://wow.zamimg.com/images/wow/icons/large/spell_holy_healingfocus.jpg", row: 0, col: 2, rank: 0, maxRank: 5, description: "Dá a você 70% de chance de evitar interrupções por dano ao lançar Luz Sagrada ou Lampejo de Luz." },
          { id: "h3", name: "Imposição de Mãos Aprimorada", icon: "https://wow.zamimg.com/images/wow/icons/large/spell_holy_layonhands.jpg", row: 1, col: 2, rank: holySpent >= 7 ? 2 : 0, maxRank: 2, description: "O alvo da Imposição de Mãos ganha 30% a mais de armadura por 2 min." },
          { id: "h4", name: "Iluminação", icon: "https://wow.zamimg.com/images/wow/icons/large/spell_holy_greaterheal.jpg", row: 2, col: 1, rank: holySpent >= 11 ? 5 : 0, maxRank: 5, description: "Após desferir um acerto crítico com Luz Sagrada ou Lampejo, você recupera 100% do custo em Mana." },
          { id: "h5", name: "Favor Divino", icon: "https://wow.zamimg.com/images/wow/icons/large/spell_holy_heal.jpg", row: 4, col: 1, rank: holySpent >= 21 ? 1 : 0, maxRank: 1, description: "Quando ativado, seu próximo feitiço de Luz Sagrada ou Lampejo tem 100% de chance de crítico.", type: "active" },
          { id: "h6", name: "Choque Sagrado", icon: "https://wow.zamimg.com/images/wow/icons/large/spell_holy_searinglight.jpg", row: 6, col: 1, rank: holySpent >= 31 ? 1 : 0, maxRank: 1, description: "Dispara um raio de luz sagrada no alvo, curando um aliado ou causando dano sagrado a um inimigo.", type: "active" },
        ],
      },
      {
        id: "protection",
        name: "Proteção",
        icon: "https://wow.zamimg.com/images/wow/icons/large/spell_holy_devotionaura.jpg",
        pointsSpent: protSpent,
        nodes: [
          { id: "p1", name: "Anteparo", icon: "https://wow.zamimg.com/images/wow/icons/large/spell_holy_purifyingaura.jpg", row: 0, col: 1, rank: protSpent >= 5 ? 5 : Math.min(protSpent, 5), maxRank: 5, description: "Aumenta sua chance de bloquear ataques em 5%." },
          { id: "p2", name: "Aura de Devoção Aprimorada", icon: "https://wow.zamimg.com/images/wow/icons/large/spell_holy_devotionaura.jpg", row: 0, col: 2, rank: 0, maxRank: 5, description: "Aumenta o bônus de armadura da Aura de Devoção em 25%." },
          { id: "p3", name: "Resistência Física", icon: "https://wow.zamimg.com/images/wow/icons/large/spell_holy_blessingofprotection.jpg", row: 1, col: 1, rank: protSpent >= 10 ? 5 : 0, maxRank: 5, description: "Aumenta o bônus de armadura de itens em 10%." },
          { id: "p4", name: "Bênção dos Reis", icon: "https://wow.zamimg.com/images/wow/icons/large/spell_magic_magearmor.jpg", row: 2, col: 1, rank: protSpent >= 11 ? 1 : 0, maxRank: 1, description: "Aumenta todos os atributos do alvo em 10% por 5 min.", type: "active" },
          { id: "p5", name: "Escudo Sagrado", icon: "https://wow.zamimg.com/images/wow/icons/large/spell_holy_blessingofprotection.jpg", row: 6, col: 1, rank: protSpent >= 31 ? 1 : 0, maxRank: 1, description: "Aumenta a chance de bloqueio em 30% e causa dano Sagrado ao atacante ao bloquear.", type: "active" },
        ],
      },
      {
        id: "retribution",
        name: "Retribuição",
        icon: "https://wow.zamimg.com/images/wow/icons/large/spell_holy_auraoflight.jpg",
        pointsSpent: retSpent,
        nodes: [
          { id: "rt1", name: "Bênção do Poder Aprimorada", icon: "https://wow.zamimg.com/images/wow/icons/large/spell_holy_fistofjustice.jpg", row: 0, col: 1, rank: retSpent >= 5 ? 5 : Math.min(retSpent, 5), maxRank: 5, description: "Aumenta o bônus de Poder de Ataque da Bênção do Poder em 20%." },
          { id: "rt2", name: "Julgamento Aprimorado", icon: "https://wow.zamimg.com/images/wow/icons/large/spell_holy_righteousfury.jpg", row: 0, col: 2, rank: 0, maxRank: 2, description: "Reduz a recarga do seu Julgamento em 2s." },
          { id: "rt3", name: "Convicção", icon: "https://wow.zamimg.com/images/wow/icons/large/spell_holy_retributionaura.jpg", row: 1, col: 1, rank: retSpent >= 10 ? 5 : Math.max(0, Math.min(5, retSpent - 5)), maxRank: 5, description: "Aumenta sua chance de acerto crítico com ataques corpo a corpo em 5%." },
          { id: "rt4", name: "Selo de Comando", icon: "https://wow.zamimg.com/images/wow/icons/large/ability_warrior_innerrage.jpg", row: 2, col: 1, rank: retSpent >= 11 ? 1 : 0, maxRank: 1, description: "Concede aos seus ataques a chance de desferir dano Sagrado adicional equivalente a 70% do dano da arma.", type: "active" },
          { id: "rt5", name: "Sanctidade Aprimorada", icon: "https://wow.zamimg.com/images/wow/icons/large/spell_holy_holysmite.jpg", row: 3, col: 1, rank: retSpent >= 16 ? 5 : 0, maxRank: 5, description: "Aumenta todo o dano Sagrado causado pelo paladino em 10%." },
          { id: "rt6", name: "Reprimenda / Arrependimento", icon: "https://wow.zamimg.com/images/wow/icons/large/spell_holy_prayerofhealing.jpg", row: 6, col: 1, rank: retSpent >= 31 ? 1 : 0, maxRank: 1, description: "Coloca o alvo inimigo em estado meditativo, incapacitando-o por até 6s.", type: "active" },
        ],
      },
    ];
  }

  // 3. WARRIOR (Armas / Fúria / Proteção)
  if (normClass.includes("warrior") || normClass.includes("guerreiro")) {
    const isArms = normSpec.includes("armas") || normSpec.includes("arms");
    const isFury = normSpec.includes("furia") || normSpec.includes("fury");
    const isProt = normSpec.includes("prot");

    const armsSpent = isArms ? totalTalentPoints : 0;
    const furySpent = isFury ? totalTalentPoints : 0;
    const protSpent = isProt ? totalTalentPoints : 0;

    return [
      {
        id: "arms",
        name: "Armas",
        icon: "https://wow.zamimg.com/images/wow/icons/large/ability_rogue_eviscerate.jpg",
        pointsSpent: armsSpent,
        nodes: [
          { id: "w1", name: "Golpe Heroico Aprimorado", icon: "https://wow.zamimg.com/images/wow/icons/large/ability_rogue_ambush.jpg", row: 0, col: 0, rank: armsSpent >= 3 ? 3 : Math.min(armsSpent, 3), maxRank: 3, description: "Reduz o custo em Fúria do Golpe Heroico em 3." },
          { id: "w2", name: "Deflexão", icon: "https://wow.zamimg.com/images/wow/icons/large/ability_parry.jpg", row: 0, col: 1, rank: armsSpent >= 5 ? 2 : Math.max(0, Math.min(armsSpent - 3, 5)), maxRank: 5, description: "Aumenta sua chance de aparar em 5%." },
          { id: "w3", name: "Rend Aprimorado", icon: "https://wow.zamimg.com/images/wow/icons/large/ability_gouge.jpg", row: 0, col: 2, rank: 0, maxRank: 3, description: "Aumenta o dano de sangramento em 35%." },
          { id: "w4", name: "Carga Aprimorada", icon: "https://wow.zamimg.com/images/wow/icons/large/ability_warrior_charge.jpg", row: 1, col: 0, rank: armsSpent >= 7 ? 2 : 0, maxRank: 2, description: "Aumenta a quantidade de Fúria gerada pela sua Carga em 6." },
          { id: "w5", name: "Feridas Profundas", icon: "https://wow.zamimg.com/images/wow/icons/large/ability_backstab.jpg", row: 2, col: 1, rank: armsSpent >= 11 ? 3 : 0, maxRank: 3, description: "Seus acertos críticos causam sangramento de 60% do dano médio da arma ao longo de 12s." },
          { id: "w6", name: "Golpe Mortal (Mortal Strike)", icon: "https://wow.zamimg.com/images/wow/icons/large/ability_warrior_savageblow.jpg", row: 6, col: 1, rank: armsSpent >= 31 ? 1 : 0, maxRank: 1, description: "Golpe feroz com a arma que causa dano de arma + 85 e reduz a cura recebida pelo alvo em 50% por 10s.", type: "active", spellCost: "30 Fúria" },
        ],
      },
      {
        id: "fury",
        name: "Fúria",
        icon: "https://wow.zamimg.com/images/wow/icons/large/ability_warrior_innerrage.jpg",
        pointsSpent: furySpent,
        nodes: [
          { id: "wf1", name: "Crueldade", icon: "https://wow.zamimg.com/images/wow/icons/large/ability_rogue_eviscerate.jpg", row: 0, col: 1, rank: furySpent >= 5 ? 5 : Math.min(furySpent, 5), maxRank: 5, description: "Aumenta sua chance de acerto crítico corpo a corpo em 5%." },
          { id: "wf2", name: "Fúria Desenfreada", icon: "https://wow.zamimg.com/images/wow/icons/large/ability_bullrush.jpg", row: 0, col: 2, rank: 0, maxRank: 5, description: "Dá a você a chance de gerar 1 ponto de Fúria adicional após causar dano corpo a corpo." },
          { id: "wf3", name: "Clivagem Aprimorada", icon: "https://wow.zamimg.com/images/wow/icons/large/ability_warrior_cleave.jpg", row: 1, col: 0, rank: furySpent >= 8 ? 3 : 0, maxRank: 3, description: "Aumenta o dano causado pela Clivagem em 120%." },
          { id: "wf4", name: "Enfurecer (Enrage)", icon: "https://wow.zamimg.com/images/wow/icons/large/spell_shadow_unholyfrenzy.jpg", row: 2, col: 1, rank: furySpent >= 12 ? 5 : 0, maxRank: 5, description: "Garante 25% de bônus de dano corpo a corpo por 12s após sofrer um golpe crítico." },
          { id: "wf5", name: "Sede de Sangue (Bloodthirst)", icon: "https://wow.zamimg.com/images/wow/icons/large/spell_nature_bloodlust.jpg", row: 6, col: 1, rank: furySpent >= 31 ? 1 : 0, maxRank: 1, description: "Ataca instantaneamente o alvo causando dano baseado em 45% do seu Poder de Ataque e regenerando vida nos próximos 5 ataques.", type: "active", spellCost: "30 Fúria" },
        ],
      },
      {
        id: "protection",
        name: "Proteção",
        icon: "https://wow.zamimg.com/images/wow/icons/large/inv_shield_06.jpg",
        pointsSpent: protSpent,
        nodes: [
          { id: "wp1", name: "Bloqueio com Escudo Aprimorado", icon: "https://wow.zamimg.com/images/wow/icons/large/ability_defensivestance.jpg", row: 0, col: 1, rank: protSpent >= 5 ? 5 : Math.min(protSpent, 5), maxRank: 5, description: "Aumenta a chance de bloqueio em 5%." },
          { id: "wp2", name: "Especialização em Escudo", icon: "https://wow.zamimg.com/images/wow/icons/large/inv_shield_06.jpg", row: 1, col: 1, rank: protSpent >= 10 ? 5 : 0, maxRank: 5, description: "Gera 1 ponto de Fúria adicional toda vez que você bloqueia um ataque." },
          { id: "wp3", name: "Escudo Batido (Shield Slam)", icon: "https://wow.zamimg.com/images/wow/icons/large/inv_shield_05.jpg", row: 6, col: 1, rank: protSpent >= 31 ? 1 : 0, maxRank: 1, description: "Golpeia o alvo com o escudo, causando alto dano baseado no seu valor de bloqueio e dissipando 1 efeito mágico.", type: "active", spellCost: "20 Fúria" },
        ],
      },
    ];
  }

  // 4. MAGE, ROGUE & GENERIC CLASSIC FALLBACK
  return [
    {
      id: "tree1",
      name: "Especialização Primária",
      icon: "https://wow.zamimg.com/images/wow/icons/large/spell_holy_magicalsentry.jpg",
      pointsSpent: totalTalentPoints,
      nodes: [
        { id: "g1", name: "Poder Arcano Concentrado", icon: "https://wow.zamimg.com/images/wow/icons/large/spell_nature_wispheal.jpg", row: 0, col: 1, rank: Math.min(totalTalentPoints, 5), maxRank: 5, description: "Aumenta a eficácia de combate e reduz tempos de lançamento em 10%." },
        { id: "g2", name: "Mestria Elemental", icon: "https://wow.zamimg.com/images/wow/icons/large/spell_fire_firebolt02.jpg", row: 1, col: 1, rank: Math.max(0, Math.min(totalTalentPoints - 5, 3)), maxRank: 3, description: "Aumenta a chance de acerto crítico de habilidades ofensivas em 6%." },
        { id: "g3", name: "Sobrecarga de Energia", icon: "https://wow.zamimg.com/images/wow/icons/large/spell_nature_lightning.jpg", row: 2, col: 1, rank: totalTalentPoints >= 9 ? 1 : 0, maxRank: 1, description: "Garante regeneração contínua de recursos e bônus de dano de pico.", type: "active" },
        { id: "g4", name: "Barreira Protetora", icon: "https://wow.zamimg.com/images/wow/icons/large/spell_shadow_detectlesserinvisibility.jpg", row: 3, col: 2, rank: totalTalentPoints >= 15 ? 2 : 0, maxRank: 2, description: "Absorve dano sofrido quando a vida cai abaixo de 35%." },
      ],
    },
    {
      id: "tree2",
      name: "Especialização Secundária",
      icon: "https://wow.zamimg.com/images/wow/icons/large/spell_fire_flameshock.jpg",
      pointsSpent: 0,
      nodes: [
        { id: "g5", name: "Impacto Crítico Devastador", icon: "https://wow.zamimg.com/images/wow/icons/large/spell_fire_immolation.jpg", row: 0, col: 1, rank: 0, maxRank: 5, description: "Aumenta o multiplicador de dano crítico em 25%." },
        { id: "g6", name: "Velocidade de Conjuração", icon: "https://wow.zamimg.com/images/wow/icons/large/ability_hunter_quickshot.jpg", row: 1, col: 1, rank: 0, maxRank: 3, description: "Aumenta a velocidade de ataque e conjuração em 9%." },
      ],
    },
    {
      id: "tree3",
      name: "Especialização de Suporte / Defesa",
      icon: "https://wow.zamimg.com/images/wow/icons/large/spell_frost_frostarmor02.jpg",
      pointsSpent: 0,
      nodes: [
        { id: "g7", name: "Reserva Arcana", icon: "https://wow.zamimg.com/images/wow/icons/large/spell_arcane_arcane01.jpg", row: 0, col: 1, rank: 0, maxRank: 5, description: "Reduz o consumo de energia ou mana em 10%." },
      ],
    },
  ];
}

// -------------------------------------------------------------
// RETAIL TALENT DUAL TREE (Class Tree + Spec Tree)
// -------------------------------------------------------------

export function getRetailDualTalentTrees(className: string, specName: string): RetailDualTalents {
  const normClass = (className || "Druid").toLowerCase();
  const normSpec = (specName || "Feral").toLowerCase();

  // DRUID
  if (normClass.includes("druid") || normClass.includes("druida")) {
    return {
      classTree: {
        title: "Árvore de Classe: Druida",
        pointsSpent: 31,
        maxPoints: 31,
        nodes: [
          { id: "rc_d1", name: "Rejuvenescimento", icon: "https://wow.zamimg.com/images/wow/icons/large/spell_nature_rejuvenation.jpg", row: 0, col: 1, rank: 1, maxRank: 1, type: "active", spellCost: "2.2% Mana", castTime: "Instantâneo", description: "Cura o alvo aliado ao longo de 12s." },
          { id: "rc_d2", name: "Fogo Lunar", icon: "https://wow.zamimg.com/images/wow/icons/large/spell_nature_starfall.jpg", row: 0, col: 2, rank: 1, maxRank: 1, type: "active", spellCost: "1.2% Mana", castTime: "Instantâneo", description: "Um feitiço rápido que causa dano Arcano e dano adicional ao longo de 18s." },
          { id: "rc_d3", name: "Forma de Felino", icon: "https://wow.zamimg.com/images/wow/icons/large/ability_druid_catform.jpg", row: 1, col: 0, rank: 1, maxRank: 1, type: "active", description: "Transforma o druida em felino, aumentando a velocidade de movimento em 30%." },
          { id: "rc_d4", name: "Marca do Ermo", icon: "https://wow.zamimg.com/images/wow/icons/large/spell_nature_regeneration.jpg", row: 1, col: 1, rank: 1, maxRank: 1, type: "active", description: "Aumenta a Versatilidade de todos os membros do grupo ou raide em 3%." },
          { id: "rc_d5", name: "Forma de Urso", icon: "https://wow.zamimg.com/images/wow/icons/large/ability_racial_bearform.jpg", row: 1, col: 2, rank: 1, maxRank: 1, type: "active", description: "Transforma o druida em urso, aumentando a armadura em 220% e o vigor em 45%." },
          { id: "rc_d6", name: "Investida Selvagem", icon: "https://wow.zamimg.com/images/wow/icons/large/ability_hunter_pet_bear.jpg", row: 2, col: 1, rank: 1, maxRank: 1, type: "choice", cooldown: "15s", description: "Garante uma mobilidade situacional conforme a forma atual (salto em felino, investida em urso)." },
          { id: "rc_d7", name: "Pele de Carvalho", icon: "https://wow.zamimg.com/images/wow/icons/large/spell_nature_stoneclawtotem.jpg", row: 3, col: 1, rank: 1, maxRank: 1, type: "active", cooldown: "1 min", description: "Reduz todo o dano sofrido em 20% por 12s." },
          { id: "rc_d8", name: "Ciclone", icon: "https://wow.zamimg.com/images/wow/icons/large/spell_nature_earthbindtotem.jpg", row: 4, col: 0, rank: 1, maxRank: 1, type: "active", castTime: "1.7s", description: "Ergue o alvo no ar, tornando-o invulnerável mas incapaz de agir por 6s." },
          { id: "rc_d9", name: "Coração do Ermo", icon: "https://wow.zamimg.com/images/wow/icons/large/spell_holy_blessingofagility.jpg", row: 6, col: 1, rank: 1, maxRank: 1, type: "active", cooldown: "5 min", description: "Aprimora massivamente as habilidades fora da sua especialização primária por 45s." },
        ],
      },
      specTree: {
        title: "Árvore de Especialização: Combate Feral",
        specName: "Feral",
        pointsSpent: 30,
        maxPoints: 30,
        nodes: [
          { id: "rs_f1", name: "Rasgar", icon: "https://wow.zamimg.com/images/wow/icons/large/ability_ghoulfrenzy.jpg", row: 0, col: 1, rank: 1, maxRank: 1, type: "active", spellCost: "30 Energia", description: "Golpe finalizador que estraçalha o alvo, causando sangramento contínuo que escala com pontos de combo." },
          { id: "rs_f2", name: "Mordida Feroz", icon: "https://wow.zamimg.com/images/wow/icons/large/ability_druid_ferociousbite.jpg", row: 0, col: 2, rank: 1, maxRank: 1, type: "active", spellCost: "25 Energia", description: "Golpe finalizador devastador que consome até 25 de energia extra para dobrar o dano." },
          { id: "rs_f3", name: "Fúria do Tigre", icon: "https://wow.zamimg.com/images/wow/icons/large/ability_mount_jungletiger.jpg", row: 1, col: 1, rank: 1, maxRank: 1, type: "active", cooldown: "30s", description: "Restaura 50 de Energia instantaneamente e aumenta seu dano físico em 15% por 10s." },
          { id: "rs_f4", name: "Patada Furiosa", icon: "https://wow.zamimg.com/images/wow/icons/large/ability_druid_swipe.jpg", row: 2, col: 0, rank: 1, maxRank: 1, type: "active", spellCost: "35 Energia", description: "Ataca todos os inimigos próximos causando dano físico." },
          { id: "rs_f5", name: "Fartura Predatória", icon: "https://wow.zamimg.com/images/wow/icons/large/ability_druid_predatoryinstincts.jpg", row: 2, col: 1, rank: 2, maxRank: 2, type: "passive", description: "Seus finalizadores têm 20% de chance por ponto de combo de tornar seu próximo feitiço de cura instantâneo." },
          { id: "rs_f6", name: "Berserk / Encarnação", icon: "https://wow.zamimg.com/images/wow/icons/large/spell_druid_incarnation.jpg", row: 4, col: 1, rank: 1, maxRank: 1, type: "choice", cooldown: "3 min", description: "Assume a forma de Avatar de Ashamane, reduzindo o custo de Energia de todas as habilidades em 50%." },
          { id: "rs_f7", name: "Frenesi Feral", icon: "https://wow.zamimg.com/images/wow/icons/large/ability_druid_primaltenacity.jpg", row: 6, col: 1, rank: 1, maxRank: 1, type: "active", cooldown: "45s", description: "Desfere um frenesi de 5 garras no alvo causando dano massivo de sangramento e concedendo 5 pontos de combo." },
        ],
      },
    };
  }

  // PALADIN
  if (normClass.includes("paladin") || normClass.includes("paladino")) {
    return {
      classTree: {
        title: "Árvore de Classe: Paladino",
        pointsSpent: 31,
        maxPoints: 31,
        nodes: [
          { id: "rc_p1", name: "Imposição de Mãos", icon: "https://wow.zamimg.com/images/wow/icons/large/spell_holy_layonhands.jpg", row: 0, col: 1, rank: 1, maxRank: 1, type: "active", cooldown: "7 min", description: "Cura um alvo aliado instantaneamente no valor da vida máxima do paladino." },
          { id: "rc_p2", name: "Julgamento", icon: "https://wow.zamimg.com/images/wow/icons/large/spell_holy_righteousfury.jpg", row: 0, col: 2, rank: 1, maxRank: 1, type: "active", cooldown: "6s", description: "Julga o alvo com luz sagrada, fazendo com que receba 20% a mais de dano do seu próximo gastador de Poder Sagrado." },
          { id: "rc_p3", name: "Bênção da Liberdade", icon: "https://wow.zamimg.com/images/wow/icons/large/spell_holy_sealofvalor.jpg", row: 1, col: 0, rank: 1, maxRank: 1, type: "active", cooldown: "25s", description: "Concede imunidade a efeitos redutores de movimento por 8s." },
          { id: "rc_p4", name: "Martelo da Justiça", icon: "https://wow.zamimg.com/images/wow/icons/large/spell_holy_sealofmight.jpg", row: 1, col: 1, rank: 1, maxRank: 1, type: "active", cooldown: "45s", description: "Atordoa o alvo por 6s." },
          { id: "rc_p5", name: "Escudo Divino", icon: "https://wow.zamimg.com/images/wow/icons/large/spell_holy_divineintervention.jpg", row: 3, col: 1, rank: 1, maxRank: 1, type: "active", cooldown: "5 min", description: "Protege o paladino com uma bolha divina imune a todo tipo de dano e feitiços por 8s." },
          { id: "rc_p6", name: "Cavalgar Divino", icon: "https://wow.zamimg.com/images/wow/icons/large/ability_mount_charger.jpg", row: 4, col: 2, rank: 2, maxRank: 2, type: "active", cooldown: "45s", description: "Monta na sua montaria de batalha por 3s, aumentando a velocidade em 100%." },
          { id: "rc_p7", name: "Proteção da Luz", icon: "https://wow.zamimg.com/images/wow/icons/large/spell_holy_restoration.jpg", row: 6, col: 1, rank: 1, maxRank: 1, type: "active", description: "Garante resistência mágica e regeneração de Poder Sagrado contínua." },
        ],
      },
      specTree: {
        title: "Árvore de Especialização: Retribuição",
        specName: "Retribution",
        pointsSpent: 30,
        maxPoints: 30,
        nodes: [
          { id: "rs_p1", name: "Veredito do Templário", icon: "https://wow.zamimg.com/images/wow/icons/large/spell_paladin_templarsverdict.jpg", row: 0, col: 1, rank: 1, maxRank: 1, type: "active", spellCost: "3 Poder Sagrado", description: "Golpe devastador com arma que causa alto dano Sagrado no alvo." },
          { id: "rs_p2", name: "Lâmina da Justiça", icon: "https://wow.zamimg.com/images/wow/icons/large/ability_paladin_bladeofjustice.jpg", row: 1, col: 1, rank: 1, maxRank: 1, type: "active", cooldown: "10.5s", description: "Perfura o alvo com lâminas de luz, gerando 2 de Poder Sagrado." },
          { id: "rs_f3", name: "Tempestade Divina", icon: "https://wow.zamimg.com/images/wow/icons/large/ability_paladin_divinestorm.jpg", row: 2, col: 0, rank: 1, maxRank: 1, type: "active", spellCost: "3 Poder Sagrado", description: "Vórtice giratório de armas de luz que atinge até 5 inimigos ao redor." },
          { id: "rs_p4", name: "Ira Vingativa (Asas)", icon: "https://wow.zamimg.com/images/wow/icons/large/spell_holy_avenginewrath.jpg", row: 3, col: 1, rank: 1, maxRank: 1, type: "active", cooldown: "2 min", description: "Invoca as asas sagradas da ira, aumentando o dano e a chance de acerto crítico em 20% por 20s." },
          { id: "rs_p5", name: "Rastro de Cinzas", icon: "https://wow.zamimg.com/images/wow/icons/large/spell_holy_weaponmastery.jpg", row: 5, col: 1, rank: 1, maxRank: 1, type: "active", cooldown: "45s", description: "Corta os inimigos à frente com Cinzária, causando dano radiante massivo, atordoando demônios/mortos-vivos e gerando 3 de Poder Sagrado." },
        ],
      },
    };
  }

  // DEFAULT / OTHER RETAIL CLASSES (Warrior, Mage, etc.)
  return {
    classTree: {
      title: `Árvore de Classe: ${className}`,
      pointsSpent: 31,
      maxPoints: 31,
      nodes: [
        { id: "rc_g1", name: "Fortitude & Vigor", icon: "https://wow.zamimg.com/images/wow/icons/large/spell_holy_wordfortitude.jpg", row: 0, col: 1, rank: 1, maxRank: 1, type: "passive", description: "Aumenta o Vigor e atributos vitais básicos em 6%." },
        { id: "rc_g2", name: "Ímpeto de Combate", icon: "https://wow.zamimg.com/images/wow/icons/large/ability_warrior_charge.jpg", row: 1, col: 1, rank: 1, maxRank: 1, type: "active", cooldown: "20s", description: "Concede mobilidade rápida para engajar ou reposicionar no combate." },
        { id: "rc_g3", name: "Bastião Protetor", icon: "https://wow.zamimg.com/images/wow/icons/large/inv_shield_06.jpg", row: 2, col: 1, rank: 1, maxRank: 1, type: "active", cooldown: "1.5 min", description: "Reduz o dano sofrido em 20% por 8s." },
        { id: "rc_g4", name: "Controle de Grupo & Interrupção", icon: "https://wow.zamimg.com/images/wow/icons/large/ability_kick.jpg", row: 3, col: 0, rank: 1, maxRank: 1, type: "active", cooldown: "15s", description: "Interrompe a conjuração do feitiço inimigo e impede lançamentos daquela escola por 3s." },
      ],
    },
    specTree: {
      title: `Árvore de Especialização: ${specName}`,
      specName,
      pointsSpent: 30,
      maxPoints: 30,
      nodes: [
        { id: "rs_g1", name: "Habilidade Primária de Rotação", icon: "https://wow.zamimg.com/images/wow/icons/large/ability_criticalstrike.jpg", row: 0, col: 1, rank: 1, maxRank: 1, type: "active", description: "Ataque ou feitiço definidor da rotação que acumula recursos ou desencadeia procs." },
        { id: "rs_g2", name: "Explosão de Dano Concentrada", icon: "https://wow.zamimg.com/images/wow/icons/large/spell_nature_bloodlust.jpg", row: 1, col: 1, rank: 1, maxRank: 1, type: "active", cooldown: "45s", description: "Aumenta o poder destrutivo da especialização por um breve período." },
        { id: "rs_g3", name: "Poder de Capstone", icon: "https://wow.zamimg.com/images/wow/icons/large/spell_holy_magicalsentry.jpg", row: 3, col: 1, rank: 1, maxRank: 1, type: "passive", description: "Habilidade de topo de árvore que amplifica permanentemente o pico da especialização." },
      ],
    },
  };
}
