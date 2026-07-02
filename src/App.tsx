import { useState, useEffect } from 'react';
import { Search, X } from 'lucide-react';
import { useStore } from './store';
import type { Party, TrainedPokemon, PokemonData } from './store';
import { getEffectiveness } from './typeChart';
import { calculateStat, calculateDamage, getDamageText } from './calc';

type Screen = 'home' | 'party-edit' | 'opponent-input' | 'analysis' | 'battle';

export default function App() {
  const [currentScreen, setCurrentScreen] = useState<Screen>('home');
  const { parties, addParty, updateParty, deleteParty, fullPokedex, fetchPokedex, movesDict, fetchMovesDict } = useStore();
  
  const [editingParty, setEditingParty] = useState<Party | null>(null);
  const [editingSlot, setEditingSlot] = useState<number | null>(null);
  const [tempPokemon, setTempPokemon] = useState<TrainedPokemon | null>(null);
  
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTypes, setSelectedTypes] = useState<string[]>([]);
  
  const [opponentParty, setOpponentParty] = useState<PokemonData[]>([]);
  const [activeParty, setActiveParty] = useState<Party | null>(null);
  const [myPicks, setMyPicks] = useState<TrainedPokemon[]>([]);
  const [oppPicks, setOppPicks] = useState<PokemonData[]>([]);
  
  const [myActiveIdx, setMyActiveIdx] = useState(0);
  const [oppActiveIdx, setOppActiveIdx] = useState(0);

  useEffect(() => {
    fetchPokedex();
    fetchMovesDict();
  }, []);

  // 🟢 鉄壁の検索フィルター（絶対にバグらないAND判定）
  const filteredPokemon = fullPokedex.filter(p => {
    if (!p || !p.name) return false;

    // 1. 名前検索（ひらがな・カタカナ両対応）
    let matchName = true;
    if (searchQuery) {
      const toKatakana = (str: string) => str.replace(/[\u3041-\u3096]/g, m => String.fromCharCode(m.charCodeAt(0) + 0x60));
      matchName = toKatakana(p.name).includes(toKatakana(searchQuery));
    }

    // 2. タイプ検索（選ばれたタイプを「すべて」持っているかチェック）
    let matchType = true;
    if (selectedTypes.length > 0) {
      const t1 = p.type1?.trim() || '';
      const t2 = p.type2?.trim() || '';
      matchType = selectedTypes.every(selected => t1 === selected || t2 === selected);
    }

    return matchName && matchType;
  });

  const POKEMON_TYPES = [
    'ノーマル', 'ほのお', 'みず', 'くさ', 'でんき', 'こおり', 
    'かくとう', 'どく', 'じめん', 'ひこう', 'エスパー', 'むし', 
    'いわ', 'ゴースト', 'ドラゴン', 'あく', 'はがね', 'フェアリー'
  ];

  const handleAddOpponent = (pokemon: PokemonData) => {
    if (opponentParty.length < 6 && !opponentParty.find(p => p.id === pokemon.id)) {
      setOpponentParty([...opponentParty, pokemon]);
      setSearchQuery('');
    }
  };

  const calculateMatchup = (myPoke: TrainedPokemon, oppPoke: PokemonData) => {
    const myAttack1 = getEffectiveness(myPoke.type1, oppPoke.type1, oppPoke.type2);
    const myAttack2 = myPoke.type2 ? getEffectiveness(myPoke.type2, oppPoke.type1, oppPoke.type2) : 0;
    const maxOffense = Math.max(myAttack1, myAttack2);

    let maxDefense = 0;
    maxDefense = Math.max(maxDefense, getEffectiveness(oppPoke.type1, myPoke.type1, myPoke.type2));
    if (oppPoke.type2) maxDefense = Math.max(maxDefense, getEffectiveness(oppPoke.type2, myPoke.type1, myPoke.type2));

    if (maxOffense > maxDefense || (maxOffense >= 2 && maxDefense <= 1)) return { text: '〇', color: 'text-cyan-400 bg-cyan-950/40 border-cyan-800' };
    if (maxOffense < maxDefense || (maxDefense >= 2 && maxOffense <= 1)) return { text: '✕', color: 'text-red-400 bg-red-950/40 border-red-800' };
    
    return { text: 'ー', color: 'text-slate-400 bg-slate-800/40 border-slate-700' };
  };

  const getRecommendedPicks = () => {
    if (opponentParty.length === 0 || !activeParty) return [];
    const validPokemons = activeParty.pokemons.filter((p): p is TrainedPokemon => p !== null);

    const scoredParty = validPokemons.map(myPoke => {
      let score = 0;
      opponentParty.forEach(oppPoke => {
        const matchup = calculateMatchup(myPoke, oppPoke);
        if (matchup.text === '〇') score += 2;
        else if (matchup.text === '✕') score -= 3;
      });
      return { pokemon: myPoke, score };
    });
    return scoredParty.sort((a, b) => b.score - a.score).slice(0, 3).map(s => s.pokemon);
  };

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
        {currentScreen === 'home' && (
          <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-sm">
              <h2 className="text-slate-400 text-sm font-semibold mb-4">登録済みの編成（マイパーティ）</h2>
              <div className="space-y-3 mb-6">
                {parties.map(party => (
                  <div key={party.id} className="bg-slate-900 border border-slate-800 p-4 rounded-xl flex justify-between items-center mb-3">
                    <div>
                      <h3 className="font-bold text-slate-200">{party.name}</h3>
                      <p className="text-xs text-slate-500">{party.pokemons.filter(Boolean).length}匹編成</p>
                    </div>
                    <div className="flex gap-2">
                      <button 
                        onClick={() => {
                          setEditingParty(party);
                          setEditingSlot(null);
                          setTempPokemon(null);
                          setCurrentScreen('party-edit');
                        }}
                        className="bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 px-3 py-2 rounded-lg text-sm font-medium transition-colors"
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
                      <button 
                        onClick={() => {
                          // 🟢 バトル開始の準備。以前の選出を全てリセットして即座に相手入力へ！
                          setActiveParty(party);
                          setMyPicks([]);
                          setOppPicks([]);
                          setOpponentParty([]);
                          setCurrentScreen('opponent-input');
                        }}
                        className="bg-cyan-600 hover:bg-cyan-500 text-white px-3 py-2 rounded-lg text-sm font-bold transition-colors shadow-[0_0_10px_rgba(8,145,178,0.3)]"
                      >
                        バトルへ
                      </button>
                    </div>
                  </div>
                ))}
              </div>
              <button 
                onClick={() => {
                  const newParty = { id: crypto.randomUUID(), name: `新規編成 ${parties.length + 1}`, pokemons: Array(6).fill(null) };
                  addParty(newParty);
                  setEditingParty(newParty);
                  setCurrentScreen('party-edit');
                }} 
                className="w-full py-3 rounded-lg border border-dashed border-slate-700 text-slate-400 hover:text-cyan-400 hover:bg-cyan-950/30 transition-all font-medium text-sm"
              >
                + 新しい編成を登録
              </button>
            </div>
          </div>
        )}

        {currentScreen === 'party-edit' && editingParty && (
          <div className="space-y-6 animate-in fade-in duration-300">
            {/* --- ここは前回から変更なし（省略せずにフルで出力します） --- */}
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

            <div className="grid grid-cols-2 gap-3">
              {[...Array(6)].map((_, index) => {
                const poke = editingParty.pokemons[index];
                const isSelected = editingSlot === index;
                return (
                  <div key={index} className={`bg-slate-900 border ${isSelected ? 'border-cyan-400 ring-1 ring-cyan-400' : 'border-slate-700'} rounded-xl p-3 relative h-24 flex flex-col justify-center items-center cursor-pointer hover:border-cyan-700 transition-all`}
                       onClick={() => {
                         setEditingSlot(index);
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
                            e.stopPropagation();
                            const newPokemons = [...editingParty.pokemons];
                            newPokemons[index] = null;
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
            
            {tempPokemon && editingSlot !== null && (
              <div className="bg-slate-900 border border-cyan-800/50 shadow-[0_0_15px_rgba(8,145,178,0.1)] p-5 rounded-xl animate-in slide-in-from-bottom-4 duration-300">
                <div className="space-y-4">
                  <div>
                    <label className="text-xs text-slate-400 block mb-1">ポケモン名</label>
                    <input 
                      type="text" list="pokemon-name-list"
                      value={tempPokemon.name} 
                      onChange={e => {
                        const typedName = e.target.value;
                        const foundPoke = fullPokedex.find(p => p.name === typedName);
                        setTempPokemon({
                          ...tempPokemon, 
                          name: typedName,
                          type1: foundPoke ? foundPoke.type1 : tempPokemon.type1,
                          type2: foundPoke ? foundPoke.type2 : tempPokemon.type2,
                          pokemonId: foundPoke ? foundPoke.id : 0
                        });
                      }} 
                      className="w-full bg-slate-800 border border-slate-700 rounded p-2 text-sm text-white focus:border-cyan-500 focus:outline-none" 
                    />
                  </div>

                  <div>
                    <div className="flex justify-between items-end mb-1">
                      <label className="text-xs text-slate-400 block">努力値</label>
                      <span className={`text-xs font-bold ${Object.values(tempPokemon.evs).reduce((a, b) => a + b, 0) === 66 ? 'text-lime-400' : 'text-slate-500'}`}>
                        合計: {Object.values(tempPokemon.evs).reduce((a, b) => a + b, 0)} / 66
                      </span>
                    </div>
                    <div className="grid grid-cols-3 gap-2">
                      {['h', 'a', 'b', 'c', 'd', 's'].map((stat) => (
                        <div key={stat} className="flex items-center bg-slate-800 border border-slate-700 rounded overflow-hidden">
                          <span className="px-2 text-xs font-bold text-slate-400 uppercase w-8 text-center bg-slate-700/50">{stat}</span>
                          <input 
                            type="number" min="0" max="32" 
                            value={tempPokemon.evs[stat as keyof typeof tempPokemon.evs]}
                            onChange={e => {
                              let val = Number(e.target.value) || 0;
                              if (val > 32) val = 32;
                              if (val < 0) val = 0;
                              const currentTotalWithoutThis = Object.entries(tempPokemon.evs)
                                .filter(([key]) => key !== stat)
                                .reduce((sum: number, [, v]: [string, any]) => sum + (v as number), 0);
                              
                              if (currentTotalWithoutThis + val > 66) val = 66 - currentTotalWithoutThis;
                              setTempPokemon({...tempPokemon, evs: { ...tempPokemon.evs, [stat]: val }});
                            }}
                            className="w-full bg-transparent p-1 text-sm text-white text-center focus:outline-none" 
                          />
                        </div>
                      ))}
                    </div>
                  </div>

                  <div>
                    <label className="text-xs text-slate-400 block mb-1">技構成</label>
                    <div className="grid grid-cols-2 gap-2">
                      {[0, 1, 2, 3].map((i) => (
                        <input 
                          key={i} type="text" list="move-assist-list"
                          value={tempPokemon.moves[i]}
                          onChange={e => {
                            const newMoves = [...tempPokemon.moves];
                            newMoves[i] = e.target.value;
                            setTempPokemon({...tempPokemon, moves: newMoves});
                          }}
                          className="w-full bg-slate-800 border border-slate-700 rounded p-2 text-sm text-white focus:border-cyan-500 focus:outline-none" 
                        />
                      ))}
                    </div>
                    
                    <datalist id="pokemon-name-list">
                      {fullPokedex.map(p => <option key={p.id} value={p.name} />)}
                    </datalist>
                    <datalist id="move-assist-list">
                      {(fullPokedex.find(p => p.name === tempPokemon.name)?.moves || Object.keys(movesDict)).map(moveName => (
                        <option key={moveName} value={moveName} />
                      ))}
                    </datalist>
                  </div>

                  <button 
                    onClick={() => {
                      const newPokemons = [...editingParty.pokemons];
                      newPokemons[editingSlot] = tempPokemon;
                      setEditingParty({...editingParty, pokemons: newPokemons});
                      setTempPokemon(null);
                      setEditingSlot(null);
                    }}
                    className="w-full bg-cyan-600 hover:bg-cyan-500 text-white font-bold py-3 rounded-lg mt-2 transition-colors"
                  >
                    確定する
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {currentScreen === 'opponent-input' && activeParty && (
          <div className="space-y-4 animate-in fade-in slide-in-from-right-4 duration-300">
            <h2 className="text-xl font-bold border-l-4 border-lime-400 pl-3 text-lime-400">相手のパーティを入力</h2>
            
            <div className="bg-slate-900 border border-slate-800 p-3 rounded-xl mb-4">
              <div className="flex flex-wrap gap-1.5">
                {POKEMON_TYPES.map(type => {
                  const isSelected = selectedTypes.includes(type);
                  // 2個選ばれていて、かつ自分が選ばれていない場合はボタンを半透明にする
                  const isDisabled = !isSelected && selectedTypes.length >= 2;

                  return (
                    <button
                      key={type}
                      disabled={isDisabled}
                      onClick={() => {
                        // 🟢 シンプルで絶対にバグらない選択ロジック
                        if (isSelected) {
                          // 選ばれていれば解除
                          setSelectedTypes(selectedTypes.filter(t => t !== type));
                        } else if (selectedTypes.length < 2) {
                          // 選ばれていなくて、まだ2個未満なら追加
                          setSelectedTypes([...selectedTypes, type]);
                        }
                      }}
                      className={`px-2 py-1 text-xs font-medium rounded border transition-colors ${
                        isSelected 
                          ? 'bg-lime-600 border-lime-400 text-white shadow-[0_0_8px_rgba(101,163,13,0.5)]' 
                          : 'bg-slate-800 border-slate-700 text-slate-400 hover:border-slate-500'
                      } ${isDisabled ? 'opacity-30 cursor-not-allowed' : ''}`}
                    >
                      {type}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <Search className="h-5 w-5 text-slate-500" />
              </div>
              <input
                type="text"
                className="w-full bg-slate-900 border border-slate-700 text-white text-sm rounded-xl focus:ring-lime-500 focus:border-lime-500 block pl-10 p-3"
                placeholder="ポケモンの名前で検索 (ひらがな可)..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>

            <div className="bg-slate-900 border border-slate-800 rounded-xl max-h-60 overflow-y-auto">
              {filteredPokemon.length > 0 ? (
                filteredPokemon.map(p => (
                  <button key={p.id} onClick={() => handleAddOpponent(p)} className="w-full text-left px-4 py-3 border-b border-slate-800/50 hover:bg-slate-800 text-slate-200">
                    <span className="font-bold">{p.name}</span>
                    <span className="text-xs text-slate-500 ml-2">{p.type1} {p.type2 && `/ ${p.type2}`}</span>
                  </button>
                ))
              ) : (
                <div className="text-center py-6 text-slate-500 text-sm">見つかりません</div>
              )}
            </div>

            <div className="mt-6">
              <h3 className="text-sm font-bold text-slate-400 mb-2">選択された相手 ({opponentParty.length}/6)</h3>
              <div className="flex flex-wrap gap-2">
                {opponentParty.map(p => (
                  <div key={p.id} className="bg-lime-900/30 text-lime-400 border border-lime-800/50 pl-3 pr-1 py-1 rounded-full text-sm font-medium flex items-center gap-1">
                    {p.name}
                    <button onClick={() => setOpponentParty(opponentParty.filter(op => op.id !== p.id))} className="text-lime-500 hover:text-lime-300 bg-lime-950/50 rounded-full p-1 ml-1"><X size={14} /></button>
                  </div>
                ))}
              </div>
            </div>

            <button 
              onClick={() => setCurrentScreen('analysis')} 
              disabled={opponentParty.length === 0}
              className="w-full bg-lime-600 hover:bg-lime-500 disabled:bg-slate-800 disabled:text-slate-600 text-white font-bold py-4 rounded-xl mt-4"
            >
              相性分析へ進む
            </button>
          </div>
        )}

        {currentScreen === 'analysis' && activeParty && (
          <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-300">
            <div>
              <h2 className="text-xl font-bold border-l-4 border-purple-400 pl-3 text-purple-400 mb-2">相性マトリクス</h2>
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
                  {activeParty.pokemons.map(myPoke => {
                    if (!myPoke) return null;
                    return (
                      <tr key={myPoke.uid} className="border-b border-slate-800/50 last:border-0">
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
                    );
                  })}
                </tbody>
              </table>
            </div>

            <div className="bg-slate-900 border border-slate-800 p-5 rounded-xl my-6 shadow-sm">
              <h3 className="text-sm font-bold text-slate-300 flex items-center gap-2">✨ AIおすすめ選出（上位3匹）</h3>
              <div className="flex flex-wrap gap-2 mt-3">
                {recommendedPicks.map(p => {
                  if (!p) return null;
                  return (
                    <span key={p.uid} className="bg-purple-900/30 text-purple-400 border border-purple-800/50 px-3 py-1 rounded font-medium text-sm">
                      {p.name}
                    </span>
                  );
                })}
              </div>
            </div>

            {/* 🟢 相性表を見た『後』に、両者の選出を決めるUIに変更！ */}
            <div className="space-y-4 bg-slate-900 border border-slate-800 p-5 rounded-xl">
              <h3 className="text-sm font-bold text-slate-300">⚔️ 両者の選出を決定</h3>
              
              <div>
                <p className="text-xs text-cyan-400 mb-2 font-bold">自分の選出（3匹）: {myPicks.length}/3</p>
                <div className="flex flex-wrap gap-2">
                  {activeParty.pokemons.filter(Boolean).map(p => {
                    if (!p) return null;
                    const isSelected = myPicks.some(pick => pick.uid === p.uid);
                    return (
                      <button 
                        key={p.uid}
                        onClick={() => {
                          if (isSelected) setMyPicks(myPicks.filter(pick => pick.uid !== p.uid));
                          else if (myPicks.length < 3) setMyPicks([...myPicks, p]);
                        }}
                        className={`px-3 py-1.5 rounded text-sm font-medium border transition-colors ${isSelected ? 'bg-cyan-600 border-cyan-500 text-white' : 'bg-slate-800 border-slate-700 text-slate-400'}`}
                      >
                        {p.name}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="mt-4">
                <p className="text-xs text-lime-400 mb-2 font-bold">相手の予想選出（3匹）: {oppPicks.length}/3</p>
                <div className="flex flex-wrap gap-2">
                  {opponentParty.map(p => {
                    const isSelected = oppPicks.some(pick => pick.id === p.id);
                    return (
                      <button 
                        key={p.id}
                        onClick={() => {
                          if (isSelected) setOppPicks(oppPicks.filter(pick => pick.id !== p.id));
                          else if (oppPicks.length < 3) setOppPicks([...oppPicks, p]);
                        }}
                        className={`px-3 py-1.5 rounded text-sm font-medium border transition-colors ${isSelected ? 'bg-lime-600 border-lime-500 text-white' : 'bg-slate-800 border-slate-700 text-slate-400'}`}
                      >
                        {p.name}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

            <button 
              onClick={() => setCurrentScreen('battle')} 
              disabled={myPicks.length < 3 || oppPicks.length < 3}
              className="w-full bg-red-600 hover:bg-red-500 disabled:bg-slate-800 disabled:text-slate-600 text-white font-bold py-4 rounded-xl mt-4 shadow-[0_0_15px_rgba(220,38,38,0.3)]"
            >
              バトルシミュレーター起動！
            </button>
          </div>
        )}

        {currentScreen === 'battle' && myPicks.length === 3 && oppPicks.length === 3 && (
          <div className="space-y-6 animate-in fade-in zoom-in-95 duration-300">
            <div className="flex justify-between gap-4">
              <div className="w-1/2 bg-slate-900 border border-slate-800 rounded-xl p-3 shadow-lg">
                <p className="text-[10px] text-cyan-400 mb-2 font-bold">YOUR TEAM (タップで交代)</p>
                <div className="flex flex-col gap-2">
                  {myPicks.map((poke, idx) => (
                    <button
                      key={idx} onClick={() => setMyActiveIdx(idx)}
                      className={`text-left px-3 py-2 rounded text-sm font-bold ${myActiveIdx === idx ? 'bg-cyan-900/40 border border-cyan-500 text-cyan-100' : 'bg-slate-800 border-slate-700 text-slate-400'}`}
                    >
                      {poke.name}
                    </button>
                  ))}
                </div>
              </div>
              <div className="w-1/2 bg-slate-900 border border-slate-800 rounded-xl p-3 shadow-lg">
                <p className="text-[10px] text-lime-400 mb-2 font-bold">OPPONENT TEAM (タップで相手変更)</p>
                <div className="flex flex-col gap-2">
                  {oppPicks.map((poke, idx) => (
                    <button
                      key={idx} onClick={() => setOppActiveIdx(idx)}
                      className={`text-left px-3 py-2 rounded text-sm font-bold ${oppActiveIdx === idx ? 'bg-lime-900/40 border border-lime-500 text-lime-100' : 'bg-slate-800 border-slate-700 text-slate-400'}`}
                    >
                      {poke.name}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 relative shadow-lg">
              <div className="grid grid-cols-2 gap-3">
                {myPicks[myActiveIdx].moves.map((move, i) => {
                  const myPoke = myPicks[myActiveIdx];
                  const oppPoke = oppPicks[oppActiveIdx];
                  const myPokeData = fullPokedex.find(p => p.name === myPoke.name) || myPoke as any;

                  const moveData = movesDict[move];
                  
                  if (!moveData || moveData.power === 0) {
                    return (
                      <button key={i} disabled={!move} className="bg-slate-800 border border-slate-700 p-3 rounded-xl text-left disabled:opacity-30 group">
                        <div className="font-bold text-slate-200 text-sm mb-1.5">{move || '技未設定'}</div>
                        {move && <div className="text-[11px] text-slate-400">変化技 / ダメージ計算なし</div>}
                      </button>
                    );
                  }

                  const isSpecial = moveData.category === '特殊';
                  const isStab = (myPoke.type1 === moveData.type || myPoke.type2 === moveData.type) ? 1.5 : 1.0; 
                  const typeEffectiveness = getEffectiveness(moveData.type, oppPoke.type1, oppPoke.type2 || '');

                  const attackEV = isSpecial ? (myPoke.evs.c || 0) : (myPoke.evs.a || 0);
                  const attackBase = isSpecial ? (myPokeData.baseStats?.c || 100) : (myPokeData.baseStats?.a || 100);
                  const myAttack = calculateStat(attackBase, attackEV, false); 
                  
                  const oppDefBase = isSpecial ? (oppPoke.baseStats?.d || 100) : (oppPoke.baseStats?.b || 100);
                  const oppHpBase = oppPoke.baseStats?.h || 100;
                  
                  const oppH4 = calculateStat(oppHpBase, 0, true);
                  const oppHMax = calculateStat(oppHpBase, 32, true);
                  const oppB4 = calculateStat(oppDefBase, 0, false);
                  const oppBMax = calculateStat(oppDefBase, 32, false);

                  const dmgMin = calculateDamage(50, moveData.power, myAttack, oppB4, { stab: isStab, typeEffectiveness });
                  const dmgMax = calculateDamage(50, moveData.power, myAttack, oppBMax, { stab: isStab, typeEffectiveness });

                  let effColor = "text-slate-400 border-slate-600";
                  if (typeEffectiveness >= 2) effColor = "text-red-400 border-red-800 bg-red-950/30";
                  if (typeEffectiveness <= 0.5) effColor = "text-blue-400 border-blue-800 bg-blue-950/30";
                  if (typeEffectiveness === 0) effColor = "text-slate-600 border-slate-800 bg-slate-900";

                  return (
                    <button key={i} disabled={!move} className="bg-slate-800 border border-slate-700 hover:border-cyan-500 p-3 rounded-xl text-left transition-all disabled:opacity-30 group relative">
                      <div className="flex justify-between items-start mb-1.5">
                        <span className="font-bold text-slate-200 text-sm">{move || '技未設定'}</span>
                        <span className={`text-[10px] px-1.5 py-0.5 rounded border ${effColor}`}>
                          {moveData.type} / {moveData.category} ({moveData.power})
                        </span>
                      </div>
                      
                      {typeEffectiveness > 0 ? (
                        <div className="text-[11px] text-slate-400 group-hover:text-cyan-300 leading-tight mt-2">
                          無振り: {getDamageText(dmgMin.minDamage, dmgMin.maxDamage, oppH4)}<br/>
                          特化時: {getDamageText(dmgMax.minDamage, dmgMax.maxDamage, oppHMax)}
                        </div>
                      ) : (
                        <div className="text-[11px] text-slate-500 mt-2 font-bold">効果がないみたいだ…</div>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}