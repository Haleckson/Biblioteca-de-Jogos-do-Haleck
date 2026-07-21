/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Game } from "./types";

export const DEFAULT_TAGS = [
  "Mundo Aberto",
  "Pixel Art",
  "Dificuldade Elevada",
  "História Rica",
  "Ação",
  "Exploração",
  "Ficção Científica",
  "JRPG",
  "Turnos",
  "Indie",
  "Atmosférico",
  "Precisão",
  "Co-op",
  "Hack and Slash"
];

export const DEFAULT_GENRES = [
  "Ação",
  "Aventura",
  "RPG",
  "Metroidvania",
  "Plataforma",
  "Estratégia",
  "Simulação",
  "Terror",
  "Puzzle",
  "Roguelike",
  "FPS",
  "Corrida",
  "Desporto",
  "Luta"
];

export const COVER_BANK = [
  "https://images.unsplash.com/photo-1542751371-adc38448a05e?q=80&w=1200",
  "https://images.unsplash.com/photo-1550745165-9bc0b252726f?q=80&w=1200",
  "https://images.unsplash.com/photo-1511512578047-dfb367046420?q=80&w=1200",
  "https://images.unsplash.com/photo-1501854140801-50d01698950b?q=80&w=1200",
  "https://images.unsplash.com/photo-1518709268805-4e9042af9f23?q=80&w=1200",
  "https://images.unsplash.com/photo-1538481199705-c710c4e965fc?q=80&w=1200"
];

export const SAMPLE_GAMES: Game[] = [
  {
    id: "metroid-dread",
    name: "Metroid Dread",
    icon: "👾",
    iconType: "emoji",
    series: "Metroid",
    cover: "https://images.unsplash.com/photo-1550745165-9bc0b252726f?q=80&w=800",
    status: ["Jogando"],
    platform: "Nintendo Switch",
    genre: ["Metroidvania", "Plataforma", "Ação"],
    tags: ["Ação", "Exploração", "Ficção Científica", "Dificuldade Elevada"],
    publisher: "Nintendo",
    playtime: "14h 30m",
    rating: 4.5,
    startDate: "2026-06-20",
    endDate: "",
    releaseDate: "2021-10-08",
    diary: [
      {
        id: "md-1",
        period: "20/06/2026 ~ 25/06/2026",
        medias: [
          {
            src: "https://images.unsplash.com/photo-1542751371-adc38448a05e?q=80&w=600",
            isVideo: false
          }
        ],
        text: "Iniciamos a exploração no misterioso planeta ZDR. A jogabilidade de Samus está extremamente rápida e satisfatória. Derrotei o Corpius após algumas tentativas!"
      }
    ]
  },
  {
    id: "ff7-classic-1997",
    name: "Final Fantasy VII",
    icon: "☄️",
    iconType: "emoji",
    series: "Final Fantasy",
    cover: "https://images.unsplash.com/photo-1607604276583-eef5d076aa5f?q=80&w=800",
    status: ["Terminado"],
    platform: "PC",
    genre: ["RPG", "Turnos"],
    tags: ["História Rica", "Turnos"],
    publisher: "Square Enix",
    playtime: "48h 00m",
    rating: 5.0,
    startDate: "2026-05-10",
    endDate: "2026-06-15",
    releaseDate: "1997-01-31",
    diary: [
      {
        id: "d1",
        period: "10/05/2026 ~ 18/05/2026",
        medias: [],
        text: "Cloud Strife se junta à Avalanche para invadir e explodir o Mako Reactor 1 de Midgar."
      }
    ]
  },
  {
    id: "elden-ring-er",
    name: "Elden Ring",
    icon: "👑",
    iconType: "emoji",
    series: "Soulsborne",
    cover: "https://images.unsplash.com/photo-1511512578047-dfb367046420?q=80&w=800",
    status: ["Em Hiatus"],
    platform: "PS5",
    genre: ["RPG", "Aventura"],
    tags: ["Mundo Aberto", "Dificuldade Elevada", "Atmosférico"],
    publisher: "Bandai Namco",
    playtime: "115h 00m",
    rating: 4.5,
    startDate: "2025-11-12",
    endDate: "",
    releaseDate: "2022-02-25",
    diary: []
  }
];
