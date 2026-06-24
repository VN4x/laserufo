// Theme palettes for F16 Fury. Colors used by canvas engine.
export type Theme = "arcade" | "terminal";

export interface Palette {
  skyTop: string; skyMid: string; skyBot: string;
  mountain: string; ground: string; sun: string;
  star: (a: number) => string;
  bg: string;
  playerBody: string; playerWing: string; playerTail: string;
  playerNose: string; playerCockpit: string;
  exhaust1: string; exhaust2: string;
  ufoTop: string; ufoBot: string; ufoDome: string; ufoLight: string;
  bomberTop: string; bomberBot: string; bomberLight: string;
  motherTop: string; motherBot: string; motherDome: string; motherLight: string;
  bossTop: string; bossBot: string; bossDome: string; bossLight: string; bossHp: string;
  plasma: string; bombGray: string;
  bullet: string; laserMain: string; laserCore: string;
  bombShell: string; bombFin: string;
  particles: string[];
  overlayDark: string; overlayLight: string;
  gameOver: string; gameOverSub: string; pause: string;
  hudAccent: string;
  scanline: string;
  levelTints: string[];
}


export const PALETTES: Record<Theme, Palette> = {
  arcade: {
    skyTop: "#0a0420", skyMid: "#2a0a4a", skyBot: "#ff2d6a",
    mountain: "#1a0838", ground: "#ff2d6a", sun: "#ffd84d",
    star: (a) => `rgba(255,255,255,${a})`,
    bg: "#0a0420",
    playerBody: "#cfd8e8", playerWing: "#9aa8c0", playerTail: "#5a6a8a",
    playerNose: "#ff4fd8", playerCockpit: "#7cf0ff",
    exhaust1: "#ffd84d", exhaust2: "#ff6a3d",
    ufoTop: "#7cffb0", ufoBot: "#4a8a6a", ufoDome: "#7cf0ff", ufoLight: "#ffd84d",
    bomberTop: "#c46aff", bomberBot: "#7a3aa0", bomberLight: "#ffd84d",
    motherTop: "#ff6a3d", motherBot: "#a03a1a", motherDome: "#7cf0ff", motherLight: "#ffd84d",
    bossTop: "#ff2d6a", bossBot: "#7a0c2a", bossDome: "#7cf0ff", bossLight: "#ffd84d", bossHp: "#7cffb0",
    plasma: "#7cffb0", bombGray: "#888",
    bullet: "#ffd84d", laserMain: "#ff4fd8", laserCore: "#ffffff",
    bombShell: "#aaaaaa", bombFin: "#ff4fd8",
    particles: ["#ff4fd8", "#ffd84d", "#ff6a3d", "#7cf0ff", "#ffffff"],
    overlayDark: "rgba(0,0,0,0.6)", overlayLight: "rgba(0,0,0,0.5)",
    gameOver: "#ff4fd8", gameOverSub: "#7cf0ff", pause: "#ffd84d",
    hudAccent: "#ff4fd8",
    scanline: "rgba(0,0,0,0.15)",
    levelTints: ["#ff4fd8", "#7cffb0", "#ffd84d", "#7cf0ff", "#ff6a3d"],
  },

  terminal: {
    skyTop: "#000000", skyMid: "#050505", skyBot: "#0a0a0a",
    mountain: "#1a1a1a", ground: "#00ff41", sun: "#cccccc",
    star: (a) => `rgba(0,255,65,${a})`,
    bg: "#000000",
    playerBody: "#dddddd", playerWing: "#888888", playerTail: "#555555",
    playerNose: "#00ff41", playerCockpit: "#ffffff",
    exhaust1: "#ffffff", exhaust2: "#00ff41",
    ufoTop: "#00ff41", ufoBot: "#008822", ufoDome: "#ffffff", ufoLight: "#cccccc",
    bomberTop: "#cccccc", bomberBot: "#666666", bomberLight: "#00ff41",
    motherTop: "#aaaaaa", motherBot: "#444444", motherDome: "#00ff41", motherLight: "#ffffff",
    bossTop: "#ffffff", bossBot: "#555555", bossDome: "#00ff41", bossLight: "#cccccc", bossHp: "#00ff41",
    plasma: "#00ff41", bombGray: "#666",
    bullet: "#ffffff", laserMain: "#00ff41", laserCore: "#ffffff",
    bombShell: "#888888", bombFin: "#00ff41",
    particles: ["#00ff41", "#ffffff", "#cccccc", "#888888", "#00aa22"],
    overlayDark: "rgba(0,0,0,0.75)", overlayLight: "rgba(0,0,0,0.6)",
    gameOver: "#00ff41", gameOverSub: "#ffffff", pause: "#00ff41",
    hudAccent: "#00ff41",
    scanline: "rgba(0,255,65,0.06)",
  },
};

let _theme: Theme = "arcade";
export function getTheme(): Theme { return _theme; }
export function setTheme(t: Theme) { _theme = t; }
export function P(): Palette { return PALETTES[_theme]; }
