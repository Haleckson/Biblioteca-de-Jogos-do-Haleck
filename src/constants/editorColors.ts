export interface ColorOption {
  name: string;
  color: string;
  shortcut?: string;
}

export const TEXT_COLOR_OPTIONS: ColorOption[] = [
  { name: "Branco", color: "#ffffff", shortcut: "Alt+1" },
  { name: "Ciano elétrico", color: "#22d3ee", shortcut: "Alt+2" },
  { name: "Verde Esmeralda", color: "#34d399", shortcut: "Alt+3" },
  { name: "Âmbar Dourado", color: "#fbbf24", shortcut: "Alt+4" },
  { name: "Vermelho Coral", color: "#f43f5e", shortcut: "Alt+5" },
  { name: "Roxo Violeta", color: "#c084fc", shortcut: "Alt+6" },
  { name: "Azul Neon", color: "#3b82f6", shortcut: "Alt+7" },
  { name: "Rosa Magenta", color: "#ec4899", shortcut: "Alt+8" },
  { name: "Verde Lima", color: "#84cc16", shortcut: "Alt+9" },
  { name: "Cinza Suave", color: "#9ca3af" },
];

export const BG_COLOR_OPTIONS: ColorOption[] = [
  { name: "Sem fundo", color: "", shortcut: "Alt+0" },
  { name: "Destaque Amarelo", color: "#78350f", shortcut: "Alt+H" },
  { name: "Destaque Vermelho", color: "#7f1d1d" },
  { name: "Destaque Verde", color: "#064e3b" },
  { name: "Destaque Azul", color: "#1e3a8a" },
  { name: "Destaque Roxo", color: "#581c87" },
  { name: "Destaque Ciano", color: "#164e63" },
  { name: "Destaque Rosa", color: "#831843" },
];

