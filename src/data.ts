// src/data.ts

export type PokemonData = {
  id: number;
  name: string;
  type1: string;
  type2: string;
  baseStats: { h: number; a: number; b: number; c: number; d: number; s: number };
  megaStats?: { h: number; a: number; b: number; c: number; d: number; s: number }; // メガシンカ後の種族値
};

export const POKEMON_LIST: PokemonData[] = [
  { 
    id: 6, name: 'リザードン', type1: 'ほのお', type2: 'ひこう', 
    baseStats: { h: 78, a: 84, b: 78, c: 109, d: 85, s: 100 },
    megaStats: { h: 78, a: 130, b: 111, c: 130, d: 85, s: 100 } // メガリザードンXを想定
  },
  { 
    id: 94, name: 'ゲンガー', type1: 'ゴースト', type2: 'どく', 
    baseStats: { h: 60, a: 65, b: 60, c: 130, d: 75, s: 110 },
    megaStats: { h: 60, a: 65, b: 80, c: 170, d: 95, s: 130 }
  },
  { 
    id: 448, name: 'ルカリオ', type1: 'かくとう', type2: 'はがね', 
    baseStats: { h: 70, a: 110, b: 70, c: 115, d: 70, s: 90 },
    megaStats: { h: 70, a: 145, b: 88, c: 140, d: 70, s: 112 }
  },
  { 
    id: 130, name: 'ギャラドス', type1: 'みず', type2: 'ひこう', 
    baseStats: { h: 95, a: 125, b: 79, c: 60, d: 100, s: 81 }
  },
];