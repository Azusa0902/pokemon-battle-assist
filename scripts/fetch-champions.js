// scripts/fetch-champions.js
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// 🟢 ES Modules環境で __dirname を使えるようにするおまじない
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function buildChampionsData() {
  console.log('🔄 チャンピオンズ専用データを取得・構築中...');

  try {
    // ---------------------------------------------------------
    // 📥 1. コアエンジンのデータ取得 (Showdown GitHub)
    // ---------------------------------------------------------
    console.log('📥 1/2: Showdownからベース種族値・タイプの取得...');
    // ※Showdownのフォーマット済みJSONを直接取得するURL（本番環境ではChampions専用ブランチのURL等に調整してください）
    const pokedexRes = await fetch('https://play.pokemonshowdown.com/data/pokedex.json');
    const pokedexRaw = await pokedexRes.json();

    // ---------------------------------------------------------
    // 📥 2. 環境メタデータの取得 (championsbattledata.com)
    // ---------------------------------------------------------
    console.log('📥 2/2: 環境メタデータ(使用率・採用技)の取得...');
    // ※以下はエンドポイントの例です。実際のAPIドキュメントに合わせてURLを変更してください。
    /* const metaRes = await fetch('https://api.championsbattledata.com/v1/stats');
    const metaRaw = await metaRes.json();
    */
    
    // --- データ統合と成形 ---
    console.log('⚙️ データのマージとアプリ用最適化を実行中...');
    
    // Showdownのデータ(オブジェクト)を配列に変換し、必要な情報だけを抽出
    const mergedData = Object.values(pokedexRaw)
      .filter(p => p.num > 0) // 不正なデータやダミーを弾く
      .map(p => {
        // ※ 英語名がベースになるため、日本語化したい場合はここで翻訳辞書をかませます
        return {
          id: p.num,
          name: p.name,
          type1: p.types[0],
          type2: p.types[1] || '',
          baseStats: {
            h: p.baseStats.hp,
            a: p.baseStats.atk,
            b: p.baseStats.def,
            c: p.baseStats.spa,
            d: p.baseStats.spd,
            s: p.baseStats.spe
          },
          // 🟢 APIと繋がったら、ここにメタデータ（よく使われる技など）を結合します
          // topMoves: metaRaw[p.name]?.top_moves || [],
        };
      });

    // ---------------------------------------------------------
    // 💾 3. アプリケーション用にJSONとして保存
    // ---------------------------------------------------------
    const targetPath = path.join(__dirname, '..', 'public', 'champions-data.json');
    fs.writeFileSync(targetPath, JSON.stringify(mergedData, null, 2));
    
    console.log(`✅ 構築完了！ 計 ${mergedData.length} 匹の実戦データを public/champions-data.json に保存しました。`);

  } catch (error) {
    console.error('❌ データの取得・構築に失敗しました:', error);
  }
}

buildChampionsData();