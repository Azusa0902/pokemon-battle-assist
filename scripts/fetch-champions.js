import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import puppeteer from 'puppeteer';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function scrapeWithPuppeteer() {
  // 🟢 変更点1: headless: false にして、実際のブラウザ画面を表示する！
  console.log('🚀 Puppeteer起動！実際のブラウザ画面を表示しながら抽出します...');
  const browser = await puppeteer.launch({ 
    headless: false, // 画面を表示する
    defaultViewport: null // ウィンドウサイズを自動調整
  });
  
  const page = await browser.newPage();

  try {
    const targetUrl = 'https://yakkun.com/ch/zukan/#mode=has_data';
    console.log(`📡 ${targetUrl} にアクセス中...`);

    await page.goto(targetUrl, { waitUntil: 'networkidle2' });
    
    // 🟢 変更点2: 曖昧な3秒待機ではなく、「リストが出現するまで」確実に待つ
    console.log('⏳ サイトのJavaScriptがリストを生成するのを待機しています...');
    await page.waitForSelector('ul.pokemon_list > li', { timeout: 15000 });
    
    // 念のため、DOMが完全に構築されるまでさらに少し待つ
    await new Promise(r => setTimeout(r, 2000));

    console.log('🔍 画面の描画完了。HTMLからデータを抽出します...');

    const scrapedPokemon = await page.evaluate(() => {
      const data = [];
      const items = document.querySelectorAll('ul.pokemon_list > li'); 

      items.forEach((item) => {
        // 🟢 変更点3: classに "nodata" が含まれている（＝未実装の）ポケモンはスキップする！
        if (item.classList.contains('nodata')) return;

        const nameEl = item.querySelector('.name a');
        if (!nameEl) return;
        const name = nameEl.innerText.trim();

        const relativeUrl = nameEl.getAttribute('href');
        
        if (!name) return;

        const indexEl = item.querySelector('.index');
        let id = 0;
        if (indexEl) id = parseInt(indexEl.innerText.replace(':', ''), 10);

        const typeEls = item.querySelectorAll('.type img');
        const types = Array.from(typeEls).map(img => img.alt.replace('タイプ', ''));
        const type1 = types[0] || '';
        const type2 = types[1] || '';

        const statEls = item.querySelectorAll('.stats span');
        let h = 0, a = 0, b = 0, c = 0, d = 0, s = 0;
        if (statEls.length === 6) {
          h = parseInt(statEls[0].innerText, 10);
          a = parseInt(statEls[1].innerText, 10);
          b = parseInt(statEls[2].innerText, 10);
          c = parseInt(statEls[3].innerText, 10);
          d = parseInt(statEls[4].innerText, 10);
          s = parseInt(statEls[5].innerText, 10);
        }

        data.push({
          id: id,
          name: name,
          url: `https://yakkun.com${relativeUrl}`,
          type1: type1,
          type2: type2,
          baseStats: { h, a, b, c, d, s },
          moves: [] 
        });
      });
      return data;
    });

    console.log(`✨ 抽出完了！ ${scrapedPokemon.length} 匹の正確なデータを取得しました。`);

    if (scrapedPokemon.length > 0) {
      const targetPath = path.join(__dirname, '..', 'public', 'champions-data.json');
      fs.writeFileSync(targetPath, JSON.stringify(scrapedPokemon, null, 2));
      console.log('✅ アプリ用のデータベース (champions-data.json) を上書き保存しました！');
    } else {
      console.log('⚠️ データが0件です。画面にちゃんとポケモン一覧が表示されていましたか？');
    }

  } catch (error) {
    console.error('❌ エラーが発生しました:', error);
  } finally {
    // 抽出が終わったらブラウザを閉じる（確認したい場合はここをコメントアウトしてください）
    await browser.close();
  }
}

scrapeWithPuppeteer();