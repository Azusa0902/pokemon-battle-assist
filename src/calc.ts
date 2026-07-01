// src/calc.ts

// 🟢 レベル50時における実数値を計算する関数（個体値は31で固定計算）
export const calculateStat = (base: number, ev: number, isHP: boolean, natureMultiplier: number = 1.0) => {
  const iv = 31; // 実戦を想定しV(31)固定
  if (isHP) {
    return Math.floor((base * 2 + iv + Math.floor(ev / 4)) * 50 / 100) + 50 + 10;
  }
  return Math.floor((Math.floor((base * 2 + iv + Math.floor(ev / 4)) * 50 / 100) + 5) * natureMultiplier);
};

// 🟢 実際のダメージ計算式（第5世代以降の標準仕様）
export const calculateDamage = (
  level: number,
  power: number,
  attackStat: number,
  defenseStat: number,
  modifiers: {
    stab: number; // タイプ一致ボーナス (1.5 or 1.0)
    typeEffectiveness: number; // タイプ相性 (0, 0.5, 1, 2, 4)
    item?: number; // 持ち物補正
  }
) => {
  // 1. 基礎ダメージ計算
  const baseDamage = Math.floor(Math.floor(Math.floor(2 * level / 5 + 2) * power * attackStat / defenseStat) / 50 + 2);
  
  // 2. 補正値の適用
  let finalDamage = baseDamage;
  finalDamage = Math.floor(finalDamage * modifiers.stab);
  finalDamage = Math.floor(finalDamage * modifiers.typeEffectiveness);
  if (modifiers.item) finalDamage = Math.floor(finalDamage * modifiers.item);

  // 3. 乱数幅の計算（0.85 〜 1.0）
  const minDamage = Math.floor(finalDamage * 0.85);
  const maxDamage = finalDamage;

  return { minDamage, maxDamage };
};

// 🟢 確定〇発などを計算してテキストにする関数
export const getDamageText = (minDamage: number, maxDamage: number, targetHP: number) => {
  const minPercent = Math.floor((minDamage / targetHP) * 100);
  const maxPercent = Math.floor((maxDamage / targetHP) * 100);
  
  if (minDamage >= targetHP) return `確1 (${minPercent}%〜${maxPercent}%)`;
  if (maxDamage >= targetHP) return `乱1 (${minPercent}%〜${maxPercent}%)`;
  if (minDamage * 2 >= targetHP) return `確2 (${minPercent}%〜${maxPercent}%)`;
  if (maxDamage * 2 >= targetHP) return `乱2 (${minPercent}%〜${maxPercent}%)`;
  return `確3発以上 (${minPercent}%〜${maxPercent}%)`;
};