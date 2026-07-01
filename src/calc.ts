// src/calc.ts

// 🟢 チャンピオンズ仕様のステータス計算（レベル50想定、個体値なし(最大固定)、独自ポイント制）
export const calculateStat = (base: number, points: number, isHP: boolean, natureMultiplier: number = 1.0) => {
  const iv = 31; // 個体値は最大(V)として固定
  // チャンピオンズの1ポイントは、本編の努力値8に相当すると仮定して実数値を算出（32ポイント = 256相当）
  const evEquivalent = points * 8; 

  if (isHP) {
    return Math.floor((base * 2 + iv + Math.floor(evEquivalent / 4)) * 50 / 100) + 50 + 10;
  }
  return Math.floor((Math.floor((base * 2 + iv + Math.floor(evEquivalent / 4)) * 50 / 100) + 5) * natureMultiplier);
};

// 🟢 ダメージ計算式本体
export const calculateDamage = (
  level: number,
  power: number,
  attackStat: number,
  defenseStat: number,
  modifiers: {
    stab: number; // タイプ一致 (1.5)
    typeEffectiveness: number; // 相性 (0, 0.5, 1, 2, 4)
  }
) => {
  if (power === 0) return { minDamage: 0, maxDamage: 0 }; // 変化技などは0

  // 基礎ダメージ
  const baseDamage = Math.floor(Math.floor(Math.floor(2 * level / 5 + 2) * power * attackStat / defenseStat) / 50 + 2);
  
  let finalDamage = baseDamage;
  finalDamage = Math.floor(finalDamage * modifiers.stab);
  finalDamage = Math.floor(finalDamage * modifiers.typeEffectiveness);

  // 乱数幅（0.85 〜 1.0）
  const minDamage = Math.floor(finalDamage * 0.85);
  const maxDamage = finalDamage;

  return { minDamage, maxDamage };
};

// 🟢 「確1」「乱2」などのテキストに変換する関数
export const getDamageText = (minDamage: number, maxDamage: number, targetHP: number) => {
  if (minDamage === 0 && maxDamage === 0) return "-";
  
  const minPercent = Math.floor((minDamage / targetHP) * 100);
  const maxPercent = Math.floor((maxDamage / targetHP) * 100);
  
  if (minDamage >= targetHP) return `確1 (${minPercent}%〜)`;
  if (maxDamage >= targetHP) return `乱1 (${minPercent}%〜${maxPercent}%)`;
  if (minDamage * 2 >= targetHP) return `確2 (${minPercent}%〜)`;
  if (maxDamage * 2 >= targetHP) return `乱2 (${minPercent}%〜${maxPercent}%)`;
  return `確3以上 (${maxPercent}%以下)`;
};