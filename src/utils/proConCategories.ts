export interface ProConCategoryMeta {
  id: string;
  name: string;
  shortName: string;
  iconName: string;
  colorClass: string;
  bgClass: string;
  borderClass: string;
  textClass: string;
  keywords: string[];
}

export const PRO_CON_CATEGORIES: ProConCategoryMeta[] = [
  {
    id: "jogabilidade",
    name: "Jogabilidade & Mecânicas",
    shortName: "Jogabilidade",
    iconName: "Gamepad2",
    colorClass: "emerald",
    bgClass: "bg-emerald-950/40",
    borderClass: "border-emerald-500/40",
    textClass: "text-emerald-400",
    keywords: [
      "jogabilidade", "gameplay", "combate", "controle", "movimentação", "esquiva",
      "tiro", "mira", "gunplay", "física", "mecânica", "puzzles", "quebra-cabeça",
      "plataforma", "stealth", "furtividade", "boss", "chefe", "ação", "sistema"
    ],
  },
  {
    id: "graficos",
    name: "Gráficos & Arte Visual",
    shortName: "Gráficos",
    iconName: "Palette",
    colorClass: "fuchsia",
    bgClass: "bg-fuchsia-950/40",
    borderClass: "border-fuchsia-500/40",
    textClass: "text-fuchsia-400",
    keywords: [
      "gráfico", "visuais", "visual", "textura", "iluminação", "ray tracing", "hdr",
      "arte", "direção de arte", "animação", "resolução", "design", "estética",
      "cenário", "modelagem", "cinematográfica", "cutscene"
    ],
  },
  {
    id: "audio",
    name: "Trilha Sonora & Áudio",
    shortName: "Áudio & OST",
    iconName: "Music",
    colorClass: "cyan",
    bgClass: "bg-cyan-950/40",
    borderClass: "border-cyan-500/40",
    textClass: "text-cyan-400",
    keywords: [
      "trilha", "música", "ost", "soundtrack", "som", "áudio", "dublagem",
      "efeitos sonoros", "voz", "orquestra", "tema", "sonoplastia"
    ],
  },
  {
    id: "historia",
    name: "História & Narrativa",
    shortName: "História",
    iconName: "BookOpen",
    colorClass: "amber",
    bgClass: "bg-amber-950/40",
    borderClass: "border-amber-500/40",
    textClass: "text-amber-400",
    keywords: [
      "história", "enredo", "narrativa", "lore", "roteiro", "personagem", "protagonista",
      "antagonista", "diálogo", "trama", "campanha", "final", "reviravolta", "universo"
    ],
  },
  {
    id: "desempenho",
    name: "Desempenho & Otimização",
    shortName: "Desempenho",
    iconName: "Zap",
    colorClass: "rose",
    bgClass: "bg-rose-950/40",
    borderClass: "border-rose-500/40",
    textClass: "text-rose-400",
    keywords: [
      "desempenho", "fps", "performance", "otimização", "bug", "glitch", "crash",
      "travamento", "queda de quadro", "frame rate", "stutter", "loading",
      "carregamento", "patch", "estabilidade", "resolução dinâmica"
    ],
  },
  {
    id: "conteudo",
    name: "Conteúdo & Duração",
    shortName: "Duração & Replay",
    iconName: "Clock",
    colorClass: "teal",
    bgClass: "bg-teal-950/40",
    borderClass: "border-teal-500/40",
    textClass: "text-teal-400",
    keywords: [
      "duração", "conteúdo", "replay", "fator replay", "horas", "tamanho", "mapa",
      "mundo aberto", "secundária", "side quest", "colecionável", "exploração",
      "endgame", "new game+", "dlc", "expansão"
    ],
  },
  {
    id: "multiplayer",
    name: "Multiplayer & Online",
    shortName: "Multiplayer",
    iconName: "Users",
    colorClass: "sky",
    bgClass: "bg-sky-950/40",
    borderClass: "border-sky-500/40",
    textClass: "text-sky-400",
    keywords: [
      "multiplayer", "online", "coop", "cooperativo", "pvp", "servidor", "netcode",
      "matchmaking", "lobby", "comunidade", "crossplay"
    ],
  },
  {
    id: "dificuldade",
    name: "Dificuldade & Balanceamento",
    shortName: "Balanceamento",
    iconName: "Swords",
    colorClass: "violet",
    bgClass: "bg-violet-950/40",
    borderClass: "border-violet-500/40",
    textClass: "text-violet-400",
    keywords: [
      "dificuldade", "balanceamento", "curva", "desafio", "punição", "ia", "inteligência",
      "grind", "progresso", "rng", "injusto"
    ],
  },
  {
    id: "geral",
    name: "Geral & Outros",
    shortName: "Geral",
    iconName: "Sparkles",
    colorClass: "zinc",
    bgClass: "bg-zinc-800/40",
    borderClass: "border-zinc-700/40",
    textClass: "text-zinc-400",
    keywords: [
      "preço", "custo", "valor", "interface", "menu", "hud", "acessibilidade",
      "microtransação", "passe de batalha"
    ],
  },
];

/**
 * Detecta automaticamente a categoria com base nas palavras do tópico ou nota.
 */
export function detectProConCategory(topic: string, note?: string): ProConCategoryMeta {
  const normalized = `${topic} ${note || ""}`
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");

  for (const cat of PRO_CON_CATEGORIES) {
    if (cat.id === "geral") continue;
    for (const kw of cat.keywords) {
      const kwNorm = kw
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "");
      // Busca por palavra inteira ou início de palavra
      const regex = new RegExp(`\\b${kwNorm}`, "i");
      if (regex.test(normalized)) {
        return cat;
      }
    }
  }

  return PRO_CON_CATEGORIES.find((c) => c.id === "geral") || PRO_CON_CATEGORIES[0];
}

export interface ProConStructuredItem {
  id: string;
  topic: string;
  note: string;
  category: string;
  type: "pro" | "con";
}

/**
 * Converte string bruta de prós ou contras em itens estruturados
 */
export function parseRawToStructuredItems(
  raw: string,
  type: "pro" | "con",
  splitEntitiesFn: (text: string) => string[],
  parseTopicFn: (text: string) => { topic: string; note?: string }
): ProConStructuredItem[] {
  if (!raw || !raw.trim()) return [];

  const rawList = splitEntitiesFn(raw).filter(Boolean);
  return rawList.map((itemStr, index) => {
    const { topic, note } = parseTopicFn(itemStr);
    const cat = detectProConCategory(topic, note);
    return {
      id: `${type}-${index}-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      topic: topic.trim(),
      note: (note || "").trim(),
      category: cat.id,
      type,
    };
  });
}

/**
 * Converte itens estruturados de volta na string formatada com quebras de linha e colchetes
 */
export function stringifyStructuredItems(items: ProConStructuredItem[]): string {
  return items
    .filter((it) => it.topic.trim().length > 0)
    .map((it) => {
      const topic = it.topic.trim();
      const note = it.note.trim();
      return note ? `${topic} [${note}]` : topic;
    })
    .join("\n");
}
