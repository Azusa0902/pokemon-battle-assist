import { create } from 'zustand';
import { persist } from 'zustand/middleware';

// 🟢 育成済みポケモンのデータ構造（チャンピオンズ仕様: 個体値なし、努力値あり）
export type TrainedPokemon = {
  uid: string; // アプリ内での一意のID
  pokemonId: number; // 図鑑No
  name: string;
  type1: string;
  type2: string;
  evs: { h: number; a: number; b: number; c: number; d: number; s: number }; // 努力値
  nature: string; // 性格補正（例: "A↑ C↓" など。後でロジック化します）
  moves: string[]; // 技4つ
  ability: string; // 特性
  item: string; // 持ち物
};

export type Party = {
  id: string;
  name: string;
  pokemons: TrainedPokemon[];
};

type AppState = {
  parties: Party[];
  addParty: (party: Party) => void;
  updateParty: (id: string, updatedParty: Party) => void;
  deleteParty: (id: string) => void;
};

export const useStore = create<AppState>()(
  persist(
    (set) => ({
      parties: [],
      addParty: (party) => set((state) => ({ parties: [...state.parties, party] })),
      updateParty: (id, updatedParty) => set((state) => ({
        parties: state.parties.map(p => p.id === id ? updatedParty : p)
      })),
      deleteParty: (id) => set((state) => ({ 
        parties: state.parties.filter(p => p.id !== id) 
      })),
    }),
    {
      name: 'champions-assist-storage',
    }
  )
);