// i18n for F16 Fury
export type Lang = "et" | "en";

export interface Dict {
  wave: string;
  bossWave: string;
  gameOver: string;
  score: string;
  pressRestart: string;
  paused: string;
  plusLife: string;
  barrelRoll: string;
  nearMiss: string;
  dodge: string;
  precision: string;
  combo: string;
  aBomb: string;
  shield: string;
}

export const DICTS: Record<Lang, Dict> = {
  et: {
    wave: "WAVE",
    bossWave: "BOSS WAVE",
    gameOver: "GAME OVER",
    score: "SCORE",
    pressRestart: "vajuta R, et alustada uuesti",
    paused: "PAUS",
    plusLife: "+1 ELU",
    barrelRoll: "TÜNNIRULL!",
    nearMiss: "LÄHEDALT!",
    dodge: "PÕIKE!",
    precision: "TÄPSUS!",
    combo: "COMBO",
    aBomb: "A-POMM!",
    shield: "KILP!",
  },
  en: {
    wave: "WAVE",
    bossWave: "BOSS WAVE",
    gameOver: "GAME OVER",
    score: "SCORE",
    pressRestart: "press R to restart",
    paused: "PAUSED",
    plusLife: "+1 LIFE",
    barrelRoll: "BARREL ROLL!",
    nearMiss: "NEAR MISS!",
    dodge: "DODGE!",
    precision: "PRECISION!",
    combo: "COMBO",
    aBomb: "A-BOMB!",
    shield: "SHIELD!",
  },
};

let _lang: Lang = "et";
export function getLang(): Lang { return _lang; }
export function setLang(l: Lang) { _lang = l; }
export function t(): Dict { return DICTS[_lang]; }

// UI strings (outside the canvas) — used by React components
export interface UI {
  lives: string;
  mana: string;
  wave: string;
  score: string;
  controls: string;
  fly: string;
  machineGun: string;
  laser: string;
  bomb: string;
  abombHint: string;
  trick: string;
  pause: string;
  restart: string;
  back: string;
  highScores: string;
  noScores: string;
  resume: string;
  restartBtn: string;
  quit: string;
  settings: string;
  theme: string;
  arcade: string;
  terminal: string;
  language: string;
  yourName: string;
  namePlaceholder: string;
  start: string;
  startGame: string;
  manaTricks: string;
  manaInfo: string[];
  pausedTitle: string;
  achievements: string;
  unlocked: string;
  newAchievement: string;
  insertCoin: string;
  music: string;
  sfx: string;
  mute: string;
  unmute: string;
  level: string;
}


export const UI_DICT: Record<Lang, UI> = {
  et: {
    lives: "ELUD", mana: "MANA", wave: "LAINE", score: "SKOOR",
    controls: "JUHTIMINE", fly: "lenda",
    machineGun: "kuulipilduja", laser: "laser (8 mana)", bomb: "pomm",
    abombHint: "A-pomm (50 mana — hävitab kõik!)", trick: "tünnirull (trikk)",
    pause: "paus", restart: "uuesti", back: "← tagasi menüüsse",
    highScores: "★ TIPPSKOORID ★", noScores: "— pole veel skoore —",
    resume: "JÄTKA", restartBtn: "ALGA UUESTI", quit: "VÄLJU",
    settings: "SEADED", theme: "Teema", arcade: "Arcade Neon", terminal: "Terminal",
    language: "Keel",
    yourName: "Sinu nimi", namePlaceholder: "PILOOT",
    start: "ALUSTA", startGame: "▶ ALUSTA MÄNGU",
    manaTricks: "MANA & TRIKID",
    manaInfo: [
      "★ Tünnirull → +10 mana",
      "★ Lähedalt möödalend → +5 mana",
      "★ Combo (3+) → +15 mana",
      "★ Täpsuslask kaugelt → +8 mana",
      "★ Mana ≥ 25 → kilp neelab tabamuse",
      "★ Mana täis → +1 ELU",
      "★ Boss võidetud → +1 ELU",
    ],
    pausedTitle: "PAUS",
    achievements: "SAAVUTUSED",
    unlocked: "lukust lahti",
    newAchievement: "UUS SAAVUTUS",
    insertCoin: "★ INSERT COIN ★ UFO INVASION 1986 ★",
    music: "Muusika", sfx: "Helid", mute: "Vaigista", unmute: "Heli sisse", level: "TASE",

  },
  en: {
    lives: "LIVES", mana: "MANA", wave: "WAVE", score: "SCORE",
    controls: "CONTROLS", fly: "fly",
    machineGun: "machine gun", laser: "laser (8 mana)", bomb: "bomb",
    abombHint: "A-bomb (50 mana — wipes all!)", trick: "barrel roll (trick)",
    pause: "pause", restart: "restart", back: "← back to menu",
    highScores: "★ HIGH SCORES ★", noScores: "— no scores yet —",
    resume: "RESUME", restartBtn: "RESTART", quit: "QUIT",
    settings: "SETTINGS", theme: "Theme", arcade: "Arcade Neon", terminal: "Terminal",
    language: "Language",
    yourName: "Your name", namePlaceholder: "PILOT",
    start: "START", startGame: "▶ START GAME",
    manaTricks: "MANA & TRICKS",
    manaInfo: [
      "★ Barrel roll → +10 mana",
      "★ Near miss → +5 mana",
      "★ Combo (3+) → +15 mana",
      "★ Long-range precision → +8 mana",
      "★ Mana ≥ 25 → shield absorbs a hit",
      "★ Mana full → +1 LIFE",
      "★ Boss defeated → +1 LIFE",
    ],
    pausedTitle: "PAUSED",
    achievements: "ACHIEVEMENTS",
    unlocked: "unlocked",
    newAchievement: "NEW ACHIEVEMENT",
    insertCoin: "★ INSERT COIN ★ UFO INVASION 1986 ★",
  },
};

export function ui(): UI { return UI_DICT[_lang]; }
