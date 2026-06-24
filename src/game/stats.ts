// Career stats + per-level best times for F16 Fury
export interface CareerStats {
  gamesPlayed: number;
  totalKills: number;
  totalWaves: number;
  totalBosses: number;
  totalAbombs: number;
  totalPlaytime: number; // seconds
  highestLevel: number;
  highestWave: number;
  highestScore: number;
}

const CAREER_KEY = "f16fury_career_v1";
const BEST_KEY = "f16fury_level_best_v1";

const EMPTY: CareerStats = {
  gamesPlayed: 0,
  totalKills: 0,
  totalWaves: 0,
  totalBosses: 0,
  totalAbombs: 0,
  totalPlaytime: 0,
  highestLevel: 0,
  highestWave: 0,
  highestScore: 0,
};

function ls(): Storage | null {
  if (typeof window === "undefined") return null;
  try { return window.localStorage; } catch { return null; }
}

export function loadCareer(): CareerStats {
  const s = ls(); if (!s) return { ...EMPTY };
  try { return { ...EMPTY, ...JSON.parse(s.getItem(CAREER_KEY) || "{}") }; }
  catch { return { ...EMPTY }; }
}
function saveCareer(c: CareerStats) {
  const s = ls(); if (!s) return;
  s.setItem(CAREER_KEY, JSON.stringify(c));
}

export interface RunResult {
  kills: number;
  waves: number; // waves completed (wave - 1 if died mid-wave; pass actual reached)
  level: number;
  bosses: number;
  abombs: number;
  playtime: number;
  score: number;
}

export function recordRun(r: RunResult) {
  const c = loadCareer();
  c.gamesPlayed++;
  c.totalKills += r.kills;
  c.totalWaves += r.waves;
  c.totalBosses += r.bosses;
  c.totalAbombs += r.abombs;
  c.totalPlaytime += r.playtime;
  if (r.level > c.highestLevel) c.highestLevel = r.level;
  if (r.waves > c.highestWave) c.highestWave = r.waves;
  if (r.score > c.highestScore) c.highestScore = r.score;
  saveCareer(c);
}

export function loadBestTimes(): Record<number, number> {
  const s = ls(); if (!s) return {};
  try { return JSON.parse(s.getItem(BEST_KEY) || "{}"); } catch { return {}; }
}
export function recordLevelTime(level: number, seconds: number) {
  const s = ls(); if (!s) return;
  const map = loadBestTimes();
  if (!map[level] || seconds < map[level]) {
    map[level] = seconds;
    s.setItem(BEST_KEY, JSON.stringify(map));
  }
}

export function formatTime(sec: number): string {
  if (!isFinite(sec) || sec < 0) sec = 0;
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}
