// scripts/fetch-meta.js
const fs = require('fs');
const path = require('path');

async function fetchMetaData() {
  console.log('🔄 環境データを取得・更新中...');

  // 🔴 【将来の改造ポイント】
  // ここで fetch('非公式APIのURL') などを実行し、最新データを取得するコードを書きます。
  
  // 今回はモックデータ（仮のデータ）を生成します
  const today = new Date().toISOString().split('T')[0];
  const newData = {
    lastUpdated: today,
    pokemon: {
      "ゲンガー": {
        "topMoves": ["シャドーボール", "ヘドロばくだん", "きあいだま", "みちづれ"],
        "moveTypes": ["ゴースト", "どく", "かくとう", "ノーマル"]
      },
      "ルカリオ": {
        "topMoves": ["インファイト", "コメットパンチ", "しんそく", "れいとうパンチ"],
        "moveTypes": ["かくとう", "はがね", "ノーマル", "こおり"]
      },
      "カメックス": {
        "topMoves": ["ハイドロポンプ", "れいとうビーム", "あくのはどう", "からをやぶる"],
        "moveTypes": ["みず", "こおり", "あく", "ノーマル"]
      }
    }
  };

  // public/meta.json に上書き保存する
  const targetPath = path.join(__dirname, '..', 'public', 'meta.json');
  fs.writeFileSync(targetPath, JSON.stringify(newData, null, 2));

  console.log(`✅ 環境データを更新しました！ (更新日: ${today})`);
}

fetchMetaData();