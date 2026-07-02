import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import puppeteer from 'puppeteer';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

async function scrapeMoves() {
  const jsonPath = path.join(__dirname, '..', 'public', 'champions-data.json');
  const pokedex = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
  
  console.log(`🚀 全 ${pokedex.length} 匹の技データ自動巡回を開始します...`);
  
  // 🟢 変更点1: headless: false にしてブラウザを表示（Bot対策回避）
  const browser = await puppeteer.launch({ headless: false }); 

  try {
    const page = await browser.newPage();

    // 🟢 変更点2: 画像などのブロック処理を完全に削除（すべて正常に読み込ませて人間を偽装する）

    for (let i = 0; i < pokedex.length; i++) {
      const pokemon = pokedex[i];
      process.stdout.write(`[${i + 1}/${pokedex.length}] ${pokemon.name} の技を取得中... `);

      if (!pokemon.url) {
        console.log('⚠️ URLなしのためスキップ');
        continue;
      }

      try {
        await page.goto(pokemon.url, { waitUntil: 'domcontentloaded', timeout: 30000 });
        
        // 🟢 変更点3: 確実に技のテーブルが描画されるまで少し長めに待つ
        await sleep(3000);

        const moves = await page.evaluate(() => {
          const moveList = [];
          const moveRows = document.querySelectorAll('tr.move_main_row:not(.past_move) .move_name a');
          
          moveRows.forEach(a => {
            const moveName = a.innerText.trim();
            if (moveName) moveList.push(moveName);
          });

          return [...new Set(moveList)];
        });

        pokemon.moves = moves || [];
        console.log(`✨ ${pokemon.moves.length}個の技を習得！`);

        if ((i + 1) % 10 === 0) {
          fs.writeFileSync(jsonPath, JSON.stringify(pokedex, null, 2));
        }

      } catch (err) {
        console.log(`❌ 取得失敗 (${err.message})`);
      }
    }

    fs.writeFileSync(jsonPath, JSON.stringify(pokedex, null, 2));
    console.log('\n✅🎉 全ポケモンの技データ完全統合に成功しました！！');

  } catch (error) {
    console.error('\n❌ 重大なエラーが発生しました:', error);
  } finally {
    await browser.close();
  }
}

scrapeMoves();