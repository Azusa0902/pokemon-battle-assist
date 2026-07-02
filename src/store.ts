import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type PokemonData = {
  id: number;
  name: string;
  type1: string;
  type2: string;
  baseStats: { h: number; a: number; b: number; c: number; d: number; s: number };
  moves: string[];
};

export type TrainedPokemon = {
  uid: string;
  pokemonId: number;
  name: string;
  type1: string;
  type2: string;
  evs: { h: number; a: number; b: number; c: number; d: number; s: number };
  nature: string;
  moves: string[];
  ability: string;
  item: string;
};

export type Party = {
  id: string;
  name: string;
  pokemons: (TrainedPokemon | null)[];
};

// 🟢 新設：技データの型
export type MoveData = {
  name: string;
  type: string;
  category: string;
  power: number;
  accuracy: number;
};

type AppState = {
  parties: Party[];
  fullPokedex: PokemonData[];
  movesDict: Record<string, MoveData>; // 🟢 新設：全技辞典
  fetchPokedex: () => Promise<void>;
  fetchMovesDict: () => Promise<void>; // 🟢 新設：技読み込み関数
  addParty: (party: Party) => void;
  updateParty: (id: string, party: Party) => void;
  deleteParty: (id: string) => void;
};

export const useStore = create<AppState>()(
  persist(
    (set) => ({
      parties: [],
      fullPokedex: [],
      movesDict: {},
      
      fetchPokedex: async () => {
        try {
          const res = await fetch(`./champions-data.json?t=${new Date().getTime()}`);
          const data = await res.json();
          set({ fullPokedex: data });
        } catch (error) {
          console.error('図鑑データの読み込みに失敗', error);
        }
      },

      // 🟢 起動時に moves-data.json を読み込んで辞書化する
      fetchMovesDict: async () => {
        try {
          const res = await fetch(`./moves-data.json?t=${new Date().getTime()}`);
          const data = await res.json();
          set({ movesDict: data });
        } catch (error) {
          console.error('技データの読み込みに失敗', error);
        }
      },

      addParty: (party) => set((state) => ({ parties: [...state.parties, party] })),
      updateParty: (id, party) => set((state) => ({
        parties: state.parties.map(p => p.id === id ? party : p)
      })),
      deleteParty: (id) => set((state) => ({
        parties: state.parties.filter(p => p.id !== id)
      }))
    }),
    { name: 'pokemon-assist-storage' } // ブラウザにデータを保存
  )
);