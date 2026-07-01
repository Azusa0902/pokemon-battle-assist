import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function buildChampionsData() {
  console.log('🔄 チャンピオンズ専用データを取得・構築中...');
  try {
    // 1. Showdownのベースデータ（英語）
    const pokedexRes = await fetch('https://play.pokemonshowdown.com/data/pokedex.json');
    const pokedexRaw = await pokedexRes.json();

    // 2. 日本語翻訳用データの取得
    const jpRes = await fetch('https://raw.githubusercontent.com/Purukitto/pokemon-data.json/master/pokedex.json');
    const jpRaw = await jpRes.json();
    
    // 英語名 -> 日本語名の辞書を作成
    const nameMap = {};
    jpRaw.forEach(p => {
      nameMap[p.name.english.toLowerCase()] = p.name.japanese;
    });

    // タイプの翻訳辞書
    const typeMap = {
      'Normal': 'ノーマル', 'Fire': 'ほのお', 'Water': 'みず', 'Grass': 'くさ',
      'Electric': 'でんき', 'Ice': 'こおり', 'Fighting': 'かくとう', 'Poison': 'どく',
      'Ground': 'じめん', 'Flying': 'ひこう', 'Psychic': 'エスパー', 'Bug': 'むし',
      'Rock': 'いわ', 'Ghost': 'ゴースト', 'Dragon': 'ドラゴン', 'Dark': 'あく',
      'Steel': 'はがね', 'Fairy': 'フェアリー'
    };

    const mergedData = Object.values(pokedexRaw)
      .filter(p => p.num > 0)
      .map(p => {
        // 辞書にあれば日本語、なければ英語をそのまま使う
        const engNameLower = p.name.toLowerCase();
        const jpName = nameMap[engNameLower] || p.name; 
        
        return {
          id: p.num,
          name: jpName,
          type1: typeMap[p.types[0]] || p.types[0],
          type2: p.types[1] ? (typeMap[p.types[1]] || p.types[1]) : '',
          baseStats: {
            h: p.baseStats.hp,
            a: p.baseStats.atk,
            b: p.baseStats.def,
            c: p.baseStats.spa,
            d: p.baseStats.spd,
            s: p.baseStats.spe
          }
        };
      });

    const targetPath = path.join(__dirname, '..', 'public', 'champions-data.json');
    fs.writeFileSync(targetPath, JSON.stringify(mergedData, null, 2));
    console.log(`✅ 構築完了！ 日本語化されたデータを保存しました。`);
  } catch (error) {
    console.error('❌ エラー:', error);
  }
}

buildChampionsData();