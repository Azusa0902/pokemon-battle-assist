import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import puppeteer from 'puppeteer';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

async function scrapeMoves() {
  const pokeJsonPath = path.join(__dirname, '..', 'public', 'champions-data.json');
  const moveJsonPath = path.join(__dirname, '..', 'public', 'moves-data.json'); // 🟢 新設：全技辞典
  
  const pokedex = JSON.parse(fs.readFileSync(pokeJsonPath, 'utf8'));
  const allMovesDictionary = {}; // 🟢 ここに全ポケモンの技データを蓄積していく
  
  console.log(`🚀 全 ${pokedex.length} 匹の技データ ＆ 【全技辞典】の自動生成を開始します...`);
  
  const browser = await puppeteer.launch({ headless: false }); 

  try {
    const page = await browser.newPage();

    for (let i = 0; i < pokedex.length; i++) {
      const pokemon = pokedex[i];
      process.stdout.write(`[${i + 1}/${pokedex.length}] ${pokemon.name} を解析中... `);

      if (!pokemon.url) {
        console.log('⚠️ URLなし');
        continue;
      }

      try {
        await page.goto(pokemon.url, { waitUntil: 'domcontentloaded', timeout: 30000 });
        await sleep(3000); // サーバー負荷軽減の3秒待機

        // 🟢 技名だけでなく、「威力」「タイプ」「物理/特殊」も一緒に引っこ抜く！
        const extractedData = await page.evaluate(() => {
          const moveNames = [];
          const moveDetails = {};
          
          const mainRows = document.querySelectorAll('tr.move_main_row:not(.past_move)');
          
          mainRows.forEach(row => {
            const nameEl = row.querySelector('.move_name a');
            if (!nameEl) return;
            const moveName = nameEl.innerText.trim();
            
            if (!moveName) return;
            moveNames.push(moveName);

            // ヤックンのHTML構造：名前の次の行（nextElementSibling）が詳細データになっている
            const detailRow = row.nextElementSibling;
            if (detailRow && detailRow.classList.contains('move_detail_row')) {
              const tds = detailRow.querySelectorAll('td');
              
              // タイプ
              const typeStr = tds[0]?.innerText.trim() || 'ノーマル';
              // 物理/特殊/変化
              const categoryStr = tds[1]?.innerText.trim() || '変化';
              // 威力（「-」の場合は0にする）
              const powerStr = tds[2]?.innerText.trim() || '0';
              const power = powerStr === '-' ? 0 : parseInt(powerStr, 10);
              // 命中（「-」の場合は0にする）
              const accStr = tds[3]?.innerText.trim() || '0';
              const accuracy = accStr === '-' ? 0 : parseInt(accStr, 10);

              moveDetails[moveName] = {
                name: moveName,
                type: typeStr,
                category: categoryStr, // "物理", "特殊", "変化"
                power: power,
                accuracy: accuracy
              };
            }
          });

          return { 
            names: [...new Set(moveNames)], 
            details: moveDetails 
          };
        });

        // ポケモンには「技の名前のリスト」だけを記憶させる
        pokemon.moves = extractedData.names || [];
        
        // 全技辞典（allMovesDictionary）に、新しく見つけた技の「詳細データ」を合体（マージ）する
        Object.assign(allMovesDictionary, extractedData.details);

        console.log(`✨ 技${pokemon.moves.length}個 取得`);

        // 10匹ごとにこまめにセーブ
        if ((i + 1) % 10 === 0) {
          fs.writeFileSync(pokeJsonPath, JSON.stringify(pokedex, null, 2));
          fs.writeFileSync(moveJsonPath, JSON.stringify(allMovesDictionary, null, 2));
        }

      } catch (err) {
        console.log(`❌ 取得失敗 (${err.message})`);
      }
    }

    // すべて完了したら最終セーブ
    fs.writeFileSync(pokeJsonPath, JSON.stringify(pokedex, null, 2));
    fs.writeFileSync(moveJsonPath, JSON.stringify(allMovesDictionary, null, 2));
    
    console.log('\n✅🎉 ポケモン図鑑 と 最強の【全技辞典】の錬成に成功しました！！');
    console.log(`➡️ 収録された総技数: ${Object.keys(allMovesDictionary).length} 種類`);

  } catch (error) {
    console.error('\n❌ 重大なエラーが発生しました:', error);
  } finally {
    await browser.close();
  }
}

scrapeMoves();