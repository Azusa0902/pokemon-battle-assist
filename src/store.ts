import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type Pokemon = {
  id: string;
  name: string;
};

export type Party = {
  id: string;
  name: string;
  pokemons: Pokemon[];
};

// 🟢 メタデータの型定義を追加
export type MetaData = {
  lastUpdated: string;
  pokemon: Record<string, { topMoves: string[], moveTypes: string[] }>;
};

type AppState = {
  parties: Party[];
  metaData: MetaData | null; // 🟢 メタデータを保存する場所
  addParty: (party: Party) => void;
  deleteParty: (id: string) => void;
  fetchMetaData: () => Promise<void>; // 🟢 メタデータを取得する関数
};

export const useStore = create<AppState>()(
  persist(
    (set) => ({
      parties: [
        { id: 'default-1', name: '最初のパーティ', pokemons: [] }
      ],
      metaData: null,
      addParty: (party) => set((state) => ({ parties: [...state.parties, party] })),
      deleteParty: (id) => set((state) => ({ parties: state.parties.filter(p => p.id !== id) })),
      
      // 🟢 publicフォルダの meta.json を読み込む処理
      fetchMetaData: async () => {
        try {
          const response = await fetch('/meta.json');
          const data = await response.json();
          set({ metaData: data });
        } catch (error) {
          console.error('環境データの読み込みに失敗しました', error);
        }
      }
    }),
    {
      name: 'pokemon-assist-storage',
      // metaDataは毎回最新を取るため、LocalStorageには保存しない（除外する）設定
      partialize: (state) => ({ parties: state.parties }),
    }
  )
);