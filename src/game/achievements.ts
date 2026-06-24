// Achievement definitions + local persistence for F16 Fury
import type { Lang } from "./i18n";

export type AchKey =
  | "first_kill"
  | "combo_5"
  | "combo_10"
  | "abomb_3"
  | "no_dmg_wave"
  | "score_10k"
  | "boss_down"
  | "shield_save"
  | "wave_5";

interface AchDef {
  et: { name: string; desc: string };
  en: { name: string; desc: string };
  icon: string;
}

export const ACHIEVEMENTS: Record<AchKey, AchDef> = {
  first_kill: {
    icon: "★",
    et: { name: "Esimene veri", desc: "Lasta alla esimene vaenlane" },
    en: { name: "First Blood", desc: "Take down your first enemy" },
  },
  combo_5: {
    icon: "✦",
    et: { name: "Sarivõit", desc: "5x combo" },
    en: { name: "Streak", desc: "5x combo chain" },
  },
  combo_10: {
    icon: "✸",
    et: { name: "Massaaker", desc: "10x combo" },
    en: { name: "Massacre", desc: "10x combo chain" },
  },
  abomb_3: {
    icon: "☢",
    et: { name: "Aatomivanaisa", desc: "Kasuta A-pommi 3 korda" },
    en: { name: "A-Bomb Master", desc: "Use A-Bomb 3 times" },
  },
  no_dmg_wave: {
    icon: "♦",
    et: { name: "Puhas töö", desc: "Läbi laine ilma tabamuseta" },
    en: { name: "Flawless Wave", desc: "Clear a wave without being hit" },
  },
  score_10k: {
    icon: "♛",
    et: { name: "10k klubi", desc: "Saavuta 10 000 punkti" },
    en: { name: "10K Club", desc: "Reach 10,000 points" },
  },
  boss_down: {
    icon: "☠",
    et: { name: "Bossitapja", desc: "Hävita boss" },
    en: { name: "Boss Slayer", desc: "Destroy a boss" },
  },
  shield_save: {
    icon: "◈",
    et: { name: "Mana kilp", desc: "Päästa mana abil tabamus" },
    en: { name: "Mana Shield", desc: "Absorb a hit with mana" },
  },
  wave_5: {
    icon: "▲",
    et: { name: "Veteran", desc: "Jõua 5. laineni" },
    en: { name: "Veteran", desc: "Reach wave 5" },
  },
};

const STORE_KEY = "f16fury_achievements_v1";
const STAT_KEY = "f16fury_lifetime_stats_v1";

interface LifetimeStats {
  abombUses: number;
}

function safeLS(): Storage | null {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

export function loadUnlocked(): Set<AchKey> {
  const ls = safeLS();
  if (!ls) return new Set();
  try {
    return new Set<AchKey>(JSON.parse(ls.getItem(STORE_KEY) || "[]"));
  } catch {
    return new Set();
  }
}
function saveUnlocked(set: Set<AchKey>) {
  const ls = safeLS();
  if (!ls) return;
  ls.setItem(STORE_KEY, JSON.stringify([...set]));
}
function loadStats(): LifetimeStats {
  const ls = safeLS();
  if (!ls) return { abombUses: 0 };
  try {
    return { abombUses: 0, ...JSON.parse(ls.getItem(STAT_KEY) || "{}") };
  } catch {
    return { abombUses: 0 };
  }
}
function saveStats(s: LifetimeStats) {
  const ls = safeLS();
  if (!ls) return;
  ls.setItem(STAT_KEY, JSON.stringify(s));
}

export function getAchievementInfo(key: AchKey, lang: Lang) {
  const a = ACHIEVEMENTS[key];
  return { ...a[lang], icon: a.icon };
}

export type AchListener = (key: AchKey) => void;

let _listener: AchListener | null = null;
export function onAchievement(l: AchListener | null) {
  _listener = l;
}

export function unlock(key: AchKey) {
  const set = loadUnlocked();
  if (set.has(key)) return false;
  set.add(key);
  saveUnlocked(set);
  if (_listener) _listener(key);
  return true;
}

export function bumpAbomb() {
  const s = loadStats();
  s.abombUses++;
  saveStats(s);
  if (s.abombUses >= 3) unlock("abomb_3");
}
