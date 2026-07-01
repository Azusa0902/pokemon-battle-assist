import { useState } from 'react';
import { Search, X } from 'lucide-react';
import { useStore} from './store'; // 🟢 PartyとTrainedPokemonを追加
import type { Party, TrainedPokemon } from './store';
import { POKEMON_LIST } from './data';
import { getEffectiveness } from './typeChart'; // 🟢 相性計算エンジンを読み込み
import { calculateStat, calculateDamage, getDamageText } from './calc';

type Screen = 'home' | 'party-edit' | 'party-select' | 'opponent-input' | 'analysis' | 'battle';


export default function App() {
  const [currentScreen, setCurrentScreen] = useState<Screen>('home');
  const { parties, addParty, updateParty, deleteParty } = useStore();
  const [editingParty, setEditingParty] = useState<Party | null>(null);
  const [editingSlot, setEditingSlot] = useState<number | null>(null); // 何匹目を編集しているか
  const [tempPokemon, setTempPokemon] = useState<TrainedPokemon | null>(null); // 編集中のポケモンデータ
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTypes, setSelectedTypes] = useState<string[]>([]); // 🟢 複数選択用に配列に変更！
  const [opponentParty, setOpponentParty] = useState<typeof POKEMON_LIST>([]);
  
  // 🟢 ここから追加：最終選出する3匹を保存するステート
  const [myPicks, setMyPicks] = useState<typeof POKEMON_LIST>([]);
  const [oppPicks, setOppPicks] = useState<typeof POKEMON_LIST>([]);
  // const [isMega, setIsMega] = useState(false); // メガシンカのトグル状態
  // 🟢 ここまで追加  
  // 🟢 ここから追加：バトル画面で「現在対面しているポケモン」のインデックス（0〜2）
  const [myActiveIdx, setMyActiveIdx] = useState(0);
  const [oppActiveIdx, setOppActiveIdx] = useState(0);

  // 🟢 （テスト用）自分の選出候補ポケモン。本来は選んだパーティから取得します。
  const myParty = POKEMON_LIST.slice(0, 3); // フシギバナ、リザードン、カメックス

  // 🟢 タイプ絞り込み ＋ 名前検索のハイブリッド
  const filteredPokemon = POKEMON_LIST.filter(p => {
    const matchName = p.name.includes(searchQuery);
    // 🟢 選んだタイプ(最大2つ)を「すべて」持っているか判定する（AND検索）
    const matchType = selectedTypes.length === 0 || selectedTypes.every(t => p.type1 === t || p.type2 === t);
    return matchName && matchType;
  });

  // 🟢 全18タイプのリスト（UI表示用）
  const POKEMON_TYPES = [
    'ノーマル', 'ほのお', 'みず', 'くさ', 'でんき', 'こおり', 
    'かくとう', 'どく', 'じめん', 'ひこう', 'エスパー', 'むし', 
    'いわ', 'ゴースト', 'ドラゴン', 'あく', 'はがね', 'フェアリー'
  ];

  const handleAddOpponent = (pokemon: typeof POKEMON_LIST[0]) => {
    if (opponentParty.length < 6 && !opponentParty.find(p => p.id === pokemon.id)) {
      setOpponentParty([...opponentParty, pokemon]);
      setSearchQuery('');
    }
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
                {parties.map(party => (
                  <div key={party.id} className="bg-slate-900 border border-slate-800 p-4 rounded-xl flex justify-between items-center mb-3">
                    <div>
                      <h3 className="font-bold text-slate-200">{party.name}</h3>
                      <p className="text-xs text-slate-500">{party.pokemons.length}匹編成</p>
                    </div>
                    
                    {/* 🟢 追加：編集・削除ボタンのグループ */}
                    <div className="flex gap-2">
                      <button 
                        onClick={() => {
                          setEditingParty(party);
                          setEditingSlot(null);
                          setTempPokemon(null);
                          setCurrentScreen('party-edit');
                        }}
                        className="bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 px-4 py-2 rounded-lg text-sm font-medium transition-colors"
                      >
                        編集
                      </button>
                      <button 
                        onClick={() => {
                          if (window.confirm('この編成を削除しますか？')) deleteParty(party.id);
                        }}
                        className="bg-slate-800 hover:bg-red-950 text-slate-500 hover:text-red-400 border border-slate-700 hover:border-red-900 px-3 py-2 rounded-lg text-sm transition-colors"
                      >
                        削除
                      </button>
                    </div>
                  </div>
                ))}
              </div>
              <button 
                onClick={() => {
                  const newParty = { id: crypto.randomUUID(), name: `新規編成 ${parties.length + 1}`, pokemons: [] };
                  addParty(newParty);
                  setEditingParty(newParty);
                  setCurrentScreen('party-edit');
                }} 
                className="w-full py-3 rounded-lg border border-dashed border-slate-700 text-slate-400 hover:text-cyan-400 hover:bg-cyan-950/30 transition-all font-medium text-sm"
              >
                + 新しい編成を登録
              </button>
            </div>
            <button onClick={() => setCurrentScreen('party-select')} className="w-full bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white font-bold py-5 rounded-xl shadow-[0_0_20px_rgba(8,145,178,0.3)] transition-all active:scale-95 text-lg tracking-wider">
              BATTLE START
            </button>
          </div>
        )}

        {/* 🟢 マイパーティ編集画面 */}
        {currentScreen === 'party-edit' && editingParty && (
          <div className="space-y-6 animate-in fade-in duration-300">
            <div className="flex justify-between items-center mb-4">
              <input 
                type="text" 
                value={editingParty.name}
                onChange={(e) => setEditingParty({...editingParty, name: e.target.value})}
                className="bg-transparent border-b border-cyan-500 text-xl font-bold text-cyan-400 focus:outline-none focus:border-cyan-300 w-2/3 pb-1"
                placeholder="パーティ名を入力"
              />
              <button 
                onClick={() => {
                  updateParty(editingParty.id, editingParty);
                  setCurrentScreen('home');
                  setTempPokemon(null);
                  setEditingSlot(null);
                }}
                className="bg-lime-600 hover:bg-lime-500 text-white px-4 py-2 rounded-lg text-sm font-bold transition-colors"
              >
                保存して戻る
              </button>
            </div>

            {/* 6匹の枠 */}
            <div className="grid grid-cols-2 gap-3">
              {[...Array(6)].map((_, index) => {
                const poke = editingParty.pokemons[index];
                const isSelected = editingSlot === index;
                return (
                  <div key={index} className={`bg-slate-900 border ${isSelected ? 'border-cyan-400 ring-1 ring-cyan-400' : 'border-slate-700'} rounded-xl p-3 relative h-24 flex flex-col justify-center items-center cursor-pointer hover:border-cyan-700 transition-all`}
                       onClick={() => {
                         setEditingSlot(index);
                         // 既にポケモンがいればそのデータを、空なら新規データを用意してフォームにセット
                         setTempPokemon(poke || {
                           uid: crypto.randomUUID(), pokemonId: 0, name: '', type1: 'ノーマル', type2: '',
                           evs: { h: 0, a: 0, b: 0, c: 0, d: 0, s: 0 }, nature: '', moves: ['', '', '', ''], ability: '', item: ''
                         });
                       }}>
                    {poke ? (
                      <>
                        <span className="font-bold text-slate-200">{poke.name || '名前未設定'}</span>
                        <div className="text-xs text-slate-500 mt-1 truncate w-full text-center">
                          {poke.moves.filter(Boolean).join(' / ') || '技未設定'}
                        </div>
                        <button 
                          onClick={(e) => {
                            e.stopPropagation(); // 枠のクリックイベントを打ち消す
                            const newPokemons = [...editingParty.pokemons];
                            newPokemons.splice(index, 1);
                            setEditingParty({...editingParty, pokemons: newPokemons});
                            if (editingSlot === index) { setTempPokemon(null); setEditingSlot(null); }
                          }}
                          className="absolute top-1 right-1 text-slate-500 hover:text-red-400 p-1 bg-slate-800 rounded-full"
                        >
                          <X size={14} />
                        </button>
                      </>
                    ) : (
                      <div className="text-slate-500 flex flex-col items-center gap-1">
                        <span className="text-2xl">+</span>
                        <span className="text-xs">タップして編集</span>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
            
            {/* 🟢 育成データ入力フォーム（スロットを選択している時だけ表示） */}
            {tempPokemon && editingSlot !== null && (
              <div className="bg-slate-900 border border-cyan-800/50 shadow-[0_0_15px_rgba(8,145,178,0.1)] p-5 rounded-xl animate-in slide-in-from-bottom-4 duration-300">
                <h3 className="text-sm font-bold text-cyan-400 border-b border-slate-700 pb-2 mb-4">スロット {editingSlot + 1} の編集</h3>
                
                <div className="space-y-4">
                  {/* 名前・特性・持ち物 */}
                  <div className="grid grid-cols-1 gap-3">
                    <div>
                      <label className="text-xs text-slate-400 block mb-1">ポケモン名</label>
                      <input type="text" value={tempPokemon.name} onChange={e => setTempPokemon({...tempPokemon, name: e.target.value})} className="w-full bg-slate-800 border border-slate-700 rounded p-2 text-sm text-white focus:border-cyan-500 focus:outline-none" placeholder="例: ガブリアス" />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="text-xs text-slate-400 block mb-1">特性</label>
                        <input type="text" value={tempPokemon.ability} onChange={e => setTempPokemon({...tempPokemon, ability: e.target.value})} className="w-full bg-slate-800 border border-slate-700 rounded p-2 text-sm text-white focus:border-cyan-500 focus:outline-none" />
                      </div>
                      <div>
                        <label className="text-xs text-slate-400 block mb-1">持ち物</label>
                        <input type="text" value={tempPokemon.item} onChange={e => setTempPokemon({...tempPokemon, item: e.target.value})} className="w-full bg-slate-800 border border-slate-700 rounded p-2 text-sm text-white focus:border-cyan-500 focus:outline-none" />
                      </div>
                    </div>
                  </div>

                  {/* 🟢 チャンピオンズ仕様: 努力値 (ポイント) */}
                  <div>
                    <div className="flex justify-between items-end mb-1">
                      <label className="text-xs text-slate-400 block">ステータスポイント</label>
                      <span className={`text-xs font-bold ${Object.values(tempPokemon.evs).reduce((a, b) => a + b, 0) === 66 ? 'text-lime-400' : 'text-slate-500'}`}>
                        合計: {Object.values(tempPokemon.evs).reduce((a, b) => a + b, 0)} / 66
                      </span>
                    </div>
                    <div className="grid grid-cols-3 gap-2">
                      {['h', 'a', 'b', 'c', 'd', 's'].map((stat) => (
                        <div key={stat} className="flex items-center bg-slate-800 border border-slate-700 rounded overflow-hidden">
                          <span className="px-2 text-xs font-bold text-slate-400 uppercase w-8 text-center bg-slate-700/50">{stat}</span>
                          <input 
                            type="number" 
                            min="0" max="32" 
                            value={tempPokemon.evs[stat as keyof typeof tempPokemon.evs]}
                            onChange={e => {
                              let val = Number(e.target.value) || 0;
                              // 1. 各ステータスの上限は32
                              if (val > 32) val = 32;
                              if (val < 0) val = 0;
                              
                              // 2. 合計66を超えないように自動調整
                              const currentTotalWithoutThis = Object.entries(tempPokemon.evs)
                                .filter(([key]) => key !== stat)
                                .reduce((sum, [, v]) => sum + v, 0);
                              
                              if (currentTotalWithoutThis + val > 66) {
                                val = 66 - currentTotalWithoutThis;
                              }

                              setTempPokemon({
                                ...tempPokemon, 
                                evs: { ...tempPokemon.evs, [stat]: val }
                              });
                            }}
                            className="w-full bg-transparent p-1 text-sm text-white text-center focus:outline-none" 
                          />
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* 🟢 技4つ（アシスト機能付き） */}
                  <div>
                    <label className="text-xs text-slate-400 block mb-1">技構成</label>
                    <div className="grid grid-cols-2 gap-2">
                      {[0, 1, 2, 3].map((i) => (
                        <input 
                          key={i} 
                          type="text" 
                          list="move-assist-list" // これがアシスト機能のキモ
                          value={tempPokemon.moves[i]}
                          onChange={e => {
                            const newMoves = [...tempPokemon.moves];
                            newMoves[i] = e.target.value;
                            setTempPokemon({...tempPokemon, moves: newMoves});
                          }}
                          className="w-full bg-slate-800 border border-slate-700 rounded p-2 text-sm text-white focus:border-cyan-500 focus:outline-none" 
                          placeholder={`技${i + 1}`} 
                        />
                      ))}
                    </div>

                    {/* 技のアシスト候補（※データ取得前の一時的な主要技リスト） */}
                    <datalist id="move-assist-list">
                      <option value="じしん" />
                      <option value="10まんボルト" />
                      <option value="れいとうビーム" />
                      <option value="かえんほうしゃ" />
                      <option value="シャドーボール" />
                      <option value="インファイト" />
                      <option value="りゅうのまい" />
                      <option value="つるぎのまい" />
                      <option value="ステルスロック" />
                      <option value="みがわり" />
                      {/* TODO: 本物の全技データ取得後にここを拡張します */}
                    </datalist>
                  </div>

                  {/* 確定ボタン */}
                  <button 
                    onClick={() => {
                      const newPokemons = [...editingParty.pokemons];
                      newPokemons[editingSlot] = tempPokemon;
                      setEditingParty({...editingParty, pokemons: newPokemons});
                      // 入力終わったらフォームを閉じる
                      setTempPokemon(null);
                      setEditingSlot(null);
                    }}
                    className="w-full bg-cyan-600 hover:bg-cyan-500 text-white font-bold py-3 rounded-lg mt-2 transition-colors"
                  >
                    この枠を確定する
                  </button>
                </div>
              </div>
            )}
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

        {/* 3. 相手パーティ入力画面 */}
        {currentScreen === 'opponent-input' && (
          <div className="space-y-4 animate-in fade-in slide-in-from-right-4 duration-300">
            <h2 className="text-xl font-bold border-l-4 border-lime-400 pl-3 text-lime-400">相手のパーティを入力</h2>
            
            {/* 🟢 タイプアイコンでの絞り込みエリア（複数選択対応版） */}
            <div className="bg-slate-900 border border-slate-800 p-3 rounded-xl mb-4">
              <div className="flex justify-between items-center mb-2">
                <p className="text-xs text-slate-400">タイプで絞り込み</p>
                <p className="text-[10px] text-lime-500 font-bold bg-lime-900/30 px-2 py-0.5 rounded">
                  複合検索対応 (最大2つ)
                </p>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {POKEMON_TYPES.map(type => {
                  const isSelected = selectedTypes.includes(type);
                  return (
                    <button
                      key={type}
                      onClick={() => {
                        if (isSelected) {
                          // 既に選ばれていれば解除
                          setSelectedTypes(selectedTypes.filter(t => t !== type));
                        } else {
                          // 新しく選ぶ場合（3つ目を選んだら、一番古いものを消して追加する）
                          if (selectedTypes.length < 2) {
                            setSelectedTypes([...selectedTypes, type]);
                          } else {
                            setSelectedTypes([selectedTypes[1], type]);
                          }
                        }
                      }}
                      className={`px-2 py-1 text-xs font-medium rounded border transition-colors ${
                        isSelected 
                          ? 'bg-lime-600 border-lime-400 text-white shadow-[0_0_8px_rgba(101,163,13,0.5)]' 
                          : 'bg-slate-800 border-slate-700 text-slate-400 hover:border-slate-500'
                      }`}
                    >
                      {type}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* 名前での検索バー */}
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <Search className="h-5 w-5 text-slate-500" />
              </div>
              <input
                type="text"
                className="w-full bg-slate-900 border border-slate-700 text-white text-sm rounded-xl focus:ring-lime-500 focus:border-lime-500 block pl-10 p-3"
                placeholder="ポケモンの名前でさらに絞り込む..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>

            {/* 検索結果リスト */}
            <div className="bg-slate-900 border border-slate-800 rounded-xl max-h-60 overflow-y-auto">
              {filteredPokemon.length > 0 ? (
                filteredPokemon.map(p => (
                  <button
                    key={p.id}
                    onClick={() => handleAddOpponent(p)}
                    className="w-full text-left px-4 py-3 border-b border-slate-800/50 hover:bg-slate-800 focus:bg-slate-800 transition-colors flex justify-between items-center group"
                  >
                    <span className="font-bold text-slate-200">{p.name}</span>
                    <div className="flex gap-1 opacity-70 group-hover:opacity-100 transition-opacity">
                      <span className="bg-slate-700 text-[10px] px-2 py-0.5 rounded text-slate-300">{p.type1}</span>
                      {p.type2 && <span className="bg-slate-700 text-[10px] px-2 py-0.5 rounded text-slate-300">{p.type2}</span>}
                    </div>
                  </button>
                ))
              ) : (
                <div className="text-center py-6 text-slate-500 text-sm">
                  ポケモンが見つかりません
                </div>
              )}
            </div>

            {/* 選択された相手のポケモン（変更なし） */}
            <div className="mt-6">
              <h3 className="text-sm font-bold text-slate-400 mb-2">現在選択されているポケモン ({opponentParty.length}/6)</h3>
              <div className="flex flex-wrap gap-2">
                {opponentParty.map(p => (
                  <div key={p.id} className="bg-lime-900/30 text-lime-400 border border-lime-800/50 pl-3 pr-1 py-1 rounded-full text-sm font-medium flex items-center gap-1">
                    {p.name}
                    <button onClick={() => setOpponentParty(opponentParty.filter(op => op.id !== p.id))} className="text-lime-500 hover:text-lime-300 bg-lime-950/50 rounded-full p-1 ml-1">
                      <X size={14} />
                    </button>
                  </div>
                ))}
              </div>
            </div>

            {/* 分析へ進むボタン（変更なし） */}
            <button 
              onClick={() => setCurrentScreen('analysis')} 
              disabled={opponentParty.length === 0}
              className="w-full bg-lime-600 hover:bg-lime-500 disabled:bg-slate-800 disabled:text-slate-600 text-white font-bold py-4 rounded-xl transition-all shadow-[0_0_15px_rgba(101,163,13,0.3)] mt-4"
            >
              相性分析を実行
            </button>
          </div>
        )}

        {/* 4. 分析画面 */}
        {currentScreen === 'analysis' && (
          <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-300">
            {/* マトリクス表（変更なしのため省略せずにそのまま残す） */}
            <div>
              <h2 className="text-xl font-bold border-l-4 border-purple-400 pl-3 text-purple-400 mb-2">相性マトリクス</h2>
              <p className="text-xs text-slate-400">青(〇)は有利、赤(✕)は不利を示します。</p>
            </div>
            
            <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-lg overflow-x-auto">
              <table className="w-full text-center text-sm">
                <thead>
                  <tr className="bg-slate-800 text-slate-300 border-b border-slate-700">
                    <th className="p-3 text-left font-normal text-xs">自 \ 敵</th>
                    {opponentParty.map(opp => (
                      <th key={opp.id} className="p-2 font-bold w-14"><div className="truncate text-xs">{opp.name}</div></th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {myParty.map(myPoke => (
                    <tr key={myPoke.id} className="border-b border-slate-800/50 last:border-0">
                      <td className="p-3 text-left font-bold text-slate-200 border-r border-slate-800/50 bg-slate-800/20">{myPoke.name}</td>
                      {opponentParty.map(oppPoke => {
                        const matchup = calculateMatchup(myPoke, oppPoke);
                        return (
                          <td key={oppPoke.id} className="p-2">
                            <div className={`w-8 h-8 mx-auto rounded flex items-center justify-center font-bold border ${matchup.color}`}>{matchup.text}</div>
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* おすすめ選出（計算版） */}
            <div className="bg-slate-900 border border-slate-800 p-5 rounded-xl">
              <h3 className="text-sm font-bold text-slate-300 mb-3 flex items-center gap-2">✨ おすすめの選出（上位3匹）</h3>
              <div className="flex flex-wrap gap-2">
                {recommendedPicks.map(p => (
                  <span key={p.id} className="bg-purple-900/30 text-purple-400 border border-purple-800/50 px-3 py-1 rounded font-medium text-sm shadow-sm">{p.name}</span>
                ))}
              </div>
            </div>

            {/* 🟢 追加：最終選出の決定UI */}
            <div className="space-y-4 bg-slate-900 border border-slate-800 p-5 rounded-xl">
              <h3 className="text-sm font-bold text-slate-300">⚔️ 最終選出を決定</h3>
              
              <div>
                <p className="text-xs text-slate-400 mb-2">自分の選出（3匹）: {myPicks.length}/3</p>
                <div className="flex flex-wrap gap-2">
                  {myParty.map(p => (
                    <button 
                      key={p.id}
                      onClick={() => {
                        if (myPicks.find(pick => pick.id === p.id)) setMyPicks(myPicks.filter(pick => pick.id !== p.id));
                        else if (myPicks.length < 3) setMyPicks([...myPicks, p]);
                      }}
                      className={`px-3 py-1.5 rounded text-sm font-medium border transition-colors ${myPicks.find(pick => pick.id === p.id) ? 'bg-cyan-600 border-cyan-500 text-white' : 'bg-slate-800 border-slate-700 text-slate-400'}`}
                    >
                      {p.name}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <p className="text-xs text-slate-400 mb-2">相手の予想選出（3匹）: {oppPicks.length}/3</p>
                <div className="flex flex-wrap gap-2">
                  {opponentParty.map(p => (
                    <button 
                      key={p.id}
                      onClick={() => {
                        if (oppPicks.find(pick => pick.id === p.id)) setOppPicks(oppPicks.filter(pick => pick.id !== p.id));
                        else if (oppPicks.length < 3) setOppPicks([...oppPicks, p]);
                      }}
                      className={`px-3 py-1.5 rounded text-sm font-medium border transition-colors ${oppPicks.find(pick => pick.id === p.id) ? 'bg-lime-600 border-lime-500 text-white' : 'bg-slate-800 border-slate-700 text-slate-400'}`}
                    >
                      {p.name}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <button 
              onClick={() => setCurrentScreen('battle')} 
              disabled={myPicks.length !== 3 || oppPicks.length !== 3}
              className="w-full bg-purple-600 hover:bg-purple-500 disabled:bg-slate-800 disabled:text-slate-600 text-white font-bold py-4 rounded-xl transition-all shadow-[0_0_15px_rgba(147,51,234,0.3)]"
            >
              選出決定！対戦画面へ
            </button>
          </div>
        )}

        {/* 5. バトル画面（超実戦UI版） */}
        {currentScreen === 'battle' && myPicks.length === 3 && oppPicks.length === 3 && (
          <div className="space-y-6 animate-in fade-in zoom-in-95 duration-300">
            <div className="flex justify-between items-center border-b border-slate-800 pb-2">
              <h2 className="text-xl font-bold border-l-4 border-red-500 pl-3 text-red-500">BATTLE SIMULATOR</h2>
              <button
                onClick={() => {
                  if (window.confirm('対戦を終了してホームに戻りますか？')) {
                    setCurrentScreen('home');
                    setOpponentParty([]); setMyPicks([]); setOppPicks([]);
                    setMyActiveIdx(0); setOppActiveIdx(0);
                  }
                }}
                className="text-xs bg-slate-800 hover:bg-red-950 text-slate-400 hover:text-red-400 px-3 py-1 rounded border border-slate-700 hover:border-red-900 transition-colors"
              >
                対戦終了
              </button>
            </div>

            {/* 🟢 お互いのパーティと対面交代（上部） */}
            <div className="flex justify-between gap-4">
              {/* 自分のパーティ（タップで控えと交代） */}
              <div className="w-1/2 bg-slate-900 border border-slate-800 rounded-xl p-3 shadow-lg">
                <p className="text-[10px] text-cyan-400 mb-2 font-bold">YOUR TEAM (タップで交代)</p>
                <div className="flex flex-col gap-2">
                  {myPicks.map((poke, idx) => (
                    <button
                      key={idx}
                      onClick={() => setMyActiveIdx(idx)}
                      className={`text-left px-3 py-2 rounded text-sm font-bold transition-all ${
                        myActiveIdx === idx
                          ? 'bg-cyan-900/40 border border-cyan-500 text-cyan-100 shadow-[0_0_10px_rgba(8,145,178,0.3)]'
                          : 'bg-slate-800 border border-slate-700 text-slate-400 hover:border-slate-500 hover:bg-slate-750'
                      }`}
                    >
                      {poke.name || '未設定'}
                      {myActiveIdx === idx && <span className="float-right text-[10px] bg-cyan-600 text-white px-1.5 py-0.5 rounded mt-0.5">対面中</span>}
                    </button>
                  ))}
                </div>
              </div>

              {/* 相手のパーティ（タップで交代をシミュレーション） */}
              <div className="w-1/2 bg-slate-900 border border-slate-800 rounded-xl p-3 shadow-lg">
                <p className="text-[10px] text-lime-400 mb-2 font-bold">OPPONENT TEAM (タップで相手変更)</p>
                <div className="flex flex-col gap-2">
                  {oppPicks.map((poke, idx) => (
                    <button
                      key={idx}
                      onClick={() => setOppActiveIdx(idx)}
                      className={`text-left px-3 py-2 rounded text-sm font-bold transition-all ${
                        oppActiveIdx === idx
                          ? 'bg-lime-900/40 border border-lime-500 text-lime-100 shadow-[0_0_10px_rgba(101,163,13,0.3)]'
                          : 'bg-slate-800 border border-slate-700 text-slate-400 hover:border-slate-500 hover:bg-slate-750'
                      }`}
                    >
                      {poke.name}
                      {oppActiveIdx === idx && <span className="float-right text-[10px] bg-lime-600 text-white px-1.5 py-0.5 rounded mt-0.5">対面中</span>}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* 🟢 現在の対面と技選択（下部） */}
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 relative overflow-hidden shadow-lg">
              {/* 装飾用のグラデーションライン */}
              <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-cyan-500 to-lime-500 opacity-50"></div>
              
              <div className="flex justify-between items-end mb-4">
                <div>
                  <p className="text-xs text-slate-400 mb-1">
                    <span className="text-cyan-400">{myPicks[myActiveIdx].name}</span> VS <span className="text-lime-400">{oppPicks[oppActiveIdx].name}</span>
                  </p>
                  <h3 className="text-lg font-bold text-slate-200">技を選択してダメージ計算</h3>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                {/* 🟢 自分のポケモンの技4つと、リアルタイムダメージ計算 */}
                {(myPicks[myActiveIdx] as unknown as TrainedPokemon)?.moves?.map((move, i) => {
                  const myPoke = myPicks[myActiveIdx] as unknown as TrainedPokemon;
                  const oppPoke = oppPicks[oppActiveIdx]; // ※現在は検索用のダミーデータ構造

                  // ⚠️ ここは仮のダメージ計算ロジック（次で実際の技威力データ等と連動させます）
                  // 現在は「威力が90の物理技」と仮定して計算を回しています
                  const movePower = move ? 90 : 0; 
                  const isStab = myPoke.type1 === 'ノーマル' ? 1.5 : 1.0; // 仮の一致判定

                  // 自分の攻撃力（ポイントを反映）
                  const myAttack = calculateStat(100, myPoke.evs.a || 0, false); 
                  
                  // 相手の耐久力（無振りと、H32・B32特化の2パターン）
                  const oppHpBase = oppPoke.baseStats?.h || 100;
                  const oppDefBase = oppPoke.baseStats?.b || 100;
                  
                  const oppH4 = calculateStat(oppHpBase, 0, true); // 無振りHP
                  const oppB4 = calculateStat(oppDefBase, 0, false); // 無振り防御
                  
                  const oppHMax = calculateStat(oppHpBase, 32, true); // H32振り
                  const oppBMax = calculateStat(oppDefBase, 32, false); // B32振り

                  const dmgMin = calculateDamage(50, movePower, myAttack, oppB4, { stab: isStab, typeEffectiveness: 1 });
                  const dmgMax = calculateDamage(50, movePower, myAttack, oppBMax, { stab: isStab, typeEffectiveness: 1 });

                  return (
                    <button
                      key={i}
                      disabled={!move}
                      className="bg-slate-800 border border-slate-700 hover:border-cyan-500 hover:bg-slate-750 p-3 rounded-xl text-left transition-all disabled:opacity-30 disabled:cursor-not-allowed group relative"
                    >
                      <div className="font-bold text-slate-200 text-sm mb-1.5">{move || '技未設定'}</div>
                      {move && (
                        <div className="text-[11px] text-slate-400 group-hover:text-cyan-300 leading-tight">
                          無振り: {getDamageText(dmgMin.minDamage, dmgMin.maxDamage, oppH4)}<br/>
                          特化時: {getDamageText(dmgMax.minDamage, dmgMax.maxDamage, oppHMax)}
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>
              
              <p className="text-center text-[10px] text-slate-500 mt-4">
                ※現在はUIのテストモードです。次のステップで実際の計算式が繋がります。
              </p>
            </div>
          </div>
        )}

      </main>
    </div>
  );
}