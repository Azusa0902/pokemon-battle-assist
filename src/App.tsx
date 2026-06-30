import { useState } from 'react';
import { Search, X } from 'lucide-react';
import { useStore } from './store';
import { POKEMON_LIST } from './data';
import { getEffectiveness } from './typeChart'; // 🟢 相性計算エンジンを読み込み
import { useEffect } from 'react';

type Screen = 'home' | 'party-select' | 'opponent-input' | 'analysis' | 'battle';

export default function App() {
  const [currentScreen, setCurrentScreen] = useState<Screen>('home');
  const { parties, addParty, deleteParty, fetchMetaData } = useStore();
  const [searchQuery, setSearchQuery] = useState('');
  const [opponentParty, setOpponentParty] = useState<typeof POKEMON_LIST>([]);

  // 🟢 （テスト用）自分の選出候補ポケモン。本来は選んだパーティから取得します。
  const myParty = POKEMON_LIST.slice(0, 3); // フシギバナ、リザードン、カメックス

  useEffect(() => {
    fetchMetaData(); // アプリ起動時に一回だけメタデータを取得
  }, []);

  const filteredPokemon = POKEMON_LIST.filter(pokemon => 
    pokemon.name.includes(searchQuery) ||
    pokemon.type1.includes(searchQuery) ||
    pokemon.type2.includes(searchQuery)
  );

  const handleAddOpponent = (pokemon: typeof POKEMON_LIST[0]) => {
    if (opponentParty.length < 6 && !opponentParty.find(p => p.id === pokemon.id)) {
      setOpponentParty([...opponentParty, pokemon]);
      setSearchQuery('');
    }
  };

  const handleRemoveOpponent = (id: number) => {
    setOpponentParty(opponentParty.filter(p => p.id !== id));
  };

  const handleAddParty = () => {
    addParty({
      id: crypto.randomUUID(),
      name: `新規編成 ${parties.length + 1}`,
      pokemons: []
    });
  };

  // 🟢 自分のポケモン vs 相手のポケモンの「総合有利度」を計算する関数（実戦メタ仕様）
  const calculateMatchup = (myPoke: typeof POKEMON_LIST[0], oppPoke: typeof POKEMON_LIST[0]) => {
    // 1. 基本的なタイプ相性（自分が相手に与えるダメージ倍率）
    const myAttack1 = getEffectiveness(myPoke.type1, oppPoke.type1, oppPoke.type2);
    const myAttack2 = myPoke.type2 ? getEffectiveness(myPoke.type2, oppPoke.type1, oppPoke.type2) : 0;
    const maxOffense = Math.max(myAttack1, myAttack2);

    // 2. 相手からの攻撃（環境データを読み込んで、相手が持っていそうな技タイプをすべてチェック！）
    let maxDefense = 0; // 相手から受ける最大のダメージ倍率
    
    // まずは相手の一致技（タイプ1とタイプ2）の危険度をチェック
    maxDefense = Math.max(maxDefense, getEffectiveness(oppPoke.type1, myPoke.type1, myPoke.type2));
    if (oppPoke.type2) {
      maxDefense = Math.max(maxDefense, getEffectiveness(oppPoke.type2, myPoke.type1, myPoke.type2));
    }

    // 🌟 【ここがAIの頭脳】環境データに「サブウェポン」があれば、それも危険度としてチェック！
    const oppMeta = useStore.getState().metaData?.pokemon[oppPoke.name];
    if (oppMeta && oppMeta.moveTypes) {
      oppMeta.moveTypes.forEach(moveType => {
        const damageMultiplier = getEffectiveness(moveType, myPoke.type1, myPoke.type2);
        maxDefense = Math.max(maxDefense, damageMultiplier);
      });
    }

    // 3. 最終判定
    if (maxOffense > maxDefense || (maxOffense >= 2 && maxDefense <= 1)) return { text: '〇', color: 'text-cyan-400 bg-cyan-950/40 border-cyan-800' };
    // 相手のサブウェポンも含めて弱点を突かれるなら「不利」と判定する！
    if (maxOffense < maxDefense || (maxDefense >= 2 && maxOffense <= 1)) return { text: '✕', color: 'text-red-400 bg-red-950/40 border-red-800' };
    
    return { text: 'ー', color: 'text-slate-400 bg-slate-800/40 border-slate-700' };
  };

  // 🟢 （追加）マトリクスの結果を元に、総合的に一番有利な上位3匹を計算するアルゴリズム
  const getRecommendedPicks = () => {
    if (opponentParty.length === 0) return [];

    // 自分のパーティ全員のスコアを計算する
    const scoredParty = myParty.map(myPoke => {
      let score = 0;

      // 相手のパーティ全員との相性をチェック
      opponentParty.forEach(oppPoke => {
        const matchup = calculateMatchup(myPoke, oppPoke);
        if (matchup.text === '〇') score += 2;   // 有利を取れる相手がいれば +2点
        else if (matchup.text === '✕') score -= 3; // 💥 弱点を突かれる相手がいる場合は激減（-3点）
      });

      return { pokemon: myPoke, score };
    });

    // スコアが高い順（降順）に並び替えて、上位3匹を抽出
    return scoredParty.sort((a, b) => b.score - a.score).slice(0, 3).map(s => s.pokemon);
  };

  // おすすめの3匹を変数に格納
  const recommendedPicks = getRecommendedPicks();

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 font-sans selection:bg-cyan-500/30 pb-20">
      <header className="bg-slate-900 border-b border-slate-800 p-4 sticky top-0 z-10 flex justify-between items-center shadow-lg">
        <h1 className="text-lg font-bold text-cyan-400 tracking-widest">
          BATTLE <span className="text-lime-400">ASSIST</span>
        </h1>
        {currentScreen !== 'home' && (
          <button 
            onClick={() => {
              setCurrentScreen('home');
              setOpponentParty([]);
            }}
            className="text-xs bg-slate-800 hover:bg-slate-700 text-slate-300 px-3 py-1.5 rounded-md transition-colors border border-slate-700"
          >
            終了して戻る
          </button>
        )}
      </header>

      <main className="max-w-md mx-auto p-4 w-full">
        {/* ホーム、選択、入力画面は変更なしなのでそのまま */}
        {currentScreen === 'home' && (
          <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-sm">
              <h2 className="text-slate-400 text-sm font-semibold mb-4">登録済みの編成（マイパーティ）</h2>
              <div className="space-y-3 mb-6">
                {parties.map((party) => (
                  <div key={party.id} className="bg-slate-800/50 border border-slate-700 p-4 rounded-lg flex justify-between items-center">
                    <div>
                      <h3 className="font-medium text-slate-200">{party.name}</h3>
                      <p className="text-xs text-slate-500 mt-1">{party.pokemons.length}匹登録済み</p>
                    </div>
                    <div className="flex gap-2">
                      <button onClick={() => deleteParty(party.id)} className="text-slate-500 hover:text-red-400 p-2 text-sm">削除</button>
                    </div>
                  </div>
                ))}
              </div>
              <button onClick={handleAddParty} className="w-full py-3 rounded-lg border border-dashed border-slate-700 text-slate-400 hover:text-cyan-400 hover:bg-cyan-950/30 transition-all font-medium text-sm">
                + 新しい編成を登録
              </button>
            </div>
            <button onClick={() => setCurrentScreen('party-select')} className="w-full bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white font-bold py-5 rounded-xl shadow-[0_0_20px_rgba(8,145,178,0.3)] transition-all active:scale-95 text-lg tracking-wider">
              BATTLE START
            </button>
          </div>
        )}

        {currentScreen === 'party-select' && (
          <div className="space-y-4 animate-in fade-in slide-in-from-right-4 duration-300">
            <h2 className="text-xl font-bold border-l-4 border-cyan-400 pl-3">使う編成を選ぶ</h2>
            {parties.map((party) => (
              <button key={party.id} onClick={() => setCurrentScreen('opponent-input')} className="w-full bg-slate-800 hover:bg-slate-700 border border-slate-700 p-5 rounded-xl text-left transition-colors mb-3">
                <h3 className="font-bold text-cyan-400 mb-1">{party.name}</h3>
                <p className="text-xs text-slate-500">タップして次へ ➔</p>
              </button>
            ))}
          </div>
        )}

        {currentScreen === 'opponent-input' && (
          <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-300">
            <h2 className="text-xl font-bold border-l-4 border-lime-400 pl-3 text-lime-400">相手の編成を入力</h2>
            
            <div className="grid grid-cols-3 gap-2">
              {[...Array(6)].map((_, index) => {
                const p = opponentParty[index];
                return (
                  <div key={index} className="aspect-square bg-slate-900 border border-slate-700 rounded-lg flex items-center justify-center relative overflow-hidden">
                    {p ? (
                      <>
                        <div className="text-center">
                          <span className="text-sm font-bold text-slate-200">{p.name}</span>
                        </div>
                        <button onClick={() => handleRemoveOpponent(p.id)} className="absolute top-1 right-1 bg-red-500/20 text-red-400 rounded-full p-1 hover:bg-red-500 hover:text-white transition-colors">
                          <X size={14} />
                        </button>
                      </>
                    ) : (
                      <span className="text-slate-700 text-xs font-medium">空き枠</span>
                    )}
                  </div>
                );
              })}
            </div>

            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={20} />
              <input
                type="text"
                placeholder="名前やタイプで検索..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-slate-900 border border-slate-700 rounded-xl py-4 pl-10 pr-4 text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-lime-500 focus:ring-1 focus:ring-lime-500 transition-all"
                disabled={opponentParty.length >= 6}
              />
            </div>

            {searchQuery && (
              <div className="bg-slate-900 border border-slate-700 rounded-xl overflow-hidden max-h-60 overflow-y-auto shadow-xl">
                {filteredPokemon.length > 0 ? (
                  filteredPokemon.map(p => (
                    <button key={p.id} onClick={() => handleAddOpponent(p)} className="w-full text-left px-4 py-3 border-b border-slate-800 hover:bg-slate-800 transition-colors flex justify-between items-center">
                      <span className="font-medium">{p.name}</span>
                      <span className="text-xs text-slate-500">{p.type1} / {p.type2}</span>
                    </button>
                  ))
                ) : (
                  <div className="px-4 py-4 text-center text-slate-500 text-sm">見つかりませんでした</div>
                )}
              </div>
            )}

            <button 
              onClick={() => setCurrentScreen('analysis')}
              disabled={opponentParty.length === 0}
              className="w-full bg-lime-600 hover:bg-lime-500 disabled:bg-slate-800 disabled:text-slate-600 text-white font-bold py-4 rounded-xl transition-all active:scale-95 mt-4"
            >
              入力を完了して分析へ
            </button>
          </div>
        )}

        {/* 🟢 4. 分析画面（アップデート！） */}
        {currentScreen === 'analysis' && (
          <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-300">
            <div>
              <h2 className="text-xl font-bold border-l-4 border-purple-400 pl-3 text-purple-400 mb-2">相性マトリクス</h2>
              <p className="text-xs text-slate-400">青(〇)は有利、赤(✕)は不利を示します。</p>
            </div>
            
            <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-lg overflow-x-auto">
              <table className="w-full text-center text-sm">
                <thead>
                  <tr className="bg-slate-800 text-slate-300 border-b border-slate-700">
                    <th className="p-3 text-left font-normal text-xs">自 \ 敵</th>
                    {/* 相手のポケモンを列に並べる */}
                    {opponentParty.map(opp => (
                      <th key={opp.id} className="p-2 font-bold w-14">
                        <div className="truncate text-xs">{opp.name}</div>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {/* 自分のポケモン（今回はテスト用の3匹）を行に並べる */}
                  {myParty.map(myPoke => (
                    <tr key={myPoke.id} className="border-b border-slate-800/50 last:border-0">
                      <td className="p-3 text-left font-bold text-slate-200 border-r border-slate-800/50 bg-slate-800/20">
                        {myPoke.name}
                      </td>
                      {/* マトリクスのセル（有利不利の判定） */}
                      {opponentParty.map(oppPoke => {
                        const matchup = calculateMatchup(myPoke, oppPoke);
                        return (
                          <td key={oppPoke.id} className="p-2">
                            <div className={`w-8 h-8 mx-auto rounded flex items-center justify-center font-bold border ${matchup.color}`}>
                              {matchup.text}
                            </div>
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* 🟢 おすすめ選出（ガチ計算版） */}
            <div className="bg-slate-900 border border-slate-800 p-5 rounded-xl">
              <h3 className="text-sm font-bold text-slate-300 mb-3 flex items-center gap-2">
                ✨ おすすめの選出（上位3匹）
              </h3>
              <p className="text-xs text-slate-400 mb-2">一貫して弱点を突かれにくく、有利を取りやすい構成</p>
              <div className="flex flex-wrap gap-2">
                {recommendedPicks.map(p => (
                  <span key={p.id} className="bg-purple-900/30 text-purple-400 border border-purple-800/50 px-3 py-1 rounded font-medium text-sm shadow-sm">
                    {p.name}
                  </span>
                ))}
              </div>
            </div>

            <button onClick={() => setCurrentScreen('battle')} className="w-full bg-purple-600 hover:bg-purple-500 text-white font-bold py-4 rounded-xl transition-all shadow-[0_0_15px_rgba(147,51,234,0.3)]">
              選出決定！対戦画面へ
            </button>
          </div>
        )}

        {/* 5. バトル画面 */}
        {currentScreen === 'battle' && (
          <div className="space-y-4 animate-in fade-in zoom-in-95 duration-300">
            <h2 className="text-xl font-bold border-l-4 border-red-500 pl-3 text-red-500">ダメージ計算</h2>
            <div className="bg-slate-900 border border-slate-800 h-64 rounded-xl flex items-center justify-center text-slate-500">ダメージ計算機</div>
            <button onClick={() => { setCurrentScreen('home'); setOpponentParty([]); }} className="w-full bg-slate-800 text-slate-300 border border-slate-700 font-bold py-4 rounded-xl hover:bg-slate-700 transition-all">
              対戦終了（ホームへ戻る）
            </button>
          </div>
        )}

      </main>
    </div>
  );
}