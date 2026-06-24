import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { Game, VW, VH, type GameStats } from "../game/engine";
import { setTheme, type Theme } from "../game/palette";
import { setLang, ui, type Lang } from "../game/i18n";
import { onAchievement, getAchievementInfo, type AchKey } from "../game/achievements";
import { Music } from "../game/music";


export const Route = createFileRoute("/play")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "F16 Fury — Mängi" },
      { name: "description", content: "Retro arcade F16 vs UFO külgvaates lendurimäng." },
      { property: "og:title", content: "F16 Fury — Mängi" },
      { property: "og:description", content: "Retro arcade F16 vs UFO külgvaates lendurimäng." },
    ],
  }),
  component: PlayPage,
});

const HS_KEY = "f16fury_highscores_v2";
const NAME_KEY = "f16fury_player_name";
const LANG_KEY = "f16fury_lang";
const THEME_KEY = "f16fury_theme";

type Score = { name: string; score: number; wave: number; date: string };

function loadScores(): Score[] {
  if (typeof window === "undefined") return [];
  try { return JSON.parse(localStorage.getItem(HS_KEY) || "[]"); } catch { return []; }
}
function saveScore(s: Score) {
  const all = [...loadScores(), s].sort((a, b) => b.score - a.score).slice(0, 10);
  localStorage.setItem(HS_KEY, JSON.stringify(all));
}

type ToastItem = { id: number; key: AchKey };

function PlayPage() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const gameRef = useRef<Game | null>(null);
  const [stats, setStats] = useState<GameStats>({
    score: 0, wave: 1, lives: 5, mana: 0, maxMana: 100, kills: 0, gameOver: false, paused: false,
  });
  const savedRef = useRef(false);

  const [lang, setLangState] = useState<Lang>("et");
  const [theme, setThemeState] = useState<Theme>("arcade");
  const [name, setName] = useState<string>("");
  const [showNameModal, setShowNameModal] = useState(false);
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const toastIdRef = useRef(0);

  // Hydrate prefs
  useEffect(() => {
    if (typeof window === "undefined") return;
    const savedLang = (localStorage.getItem(LANG_KEY) as Lang) || "et";
    const savedTheme = (localStorage.getItem(THEME_KEY) as Theme) || "arcade";
    const savedName = localStorage.getItem(NAME_KEY) || "";
    setLang(savedLang); setTheme(savedTheme);
    setLangState(savedLang); setThemeState(savedTheme);
    if (savedName) setName(savedName);
    else setShowNameModal(true);
  }, []);

  // Achievement toast handler
  useEffect(() => {
    onAchievement((key) => {
      const id = ++toastIdRef.current;
      setToasts((prev) => [...prev, { id, key }]);
      setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), 4000);
    });
    return () => onAchievement(null);
  }, []);

  useEffect(() => {
    const c = canvasRef.current!;
    c.width = VW; c.height = VH;
    const ctx = c.getContext("2d")!;
    ctx.imageSmoothingEnabled = false;
    const game = new Game(ctx, setStats);
    gameRef.current = game;

    const kd = (e: KeyboardEvent) => {
      if ([" ", "ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(e.key)) e.preventDefault();
      if (e.key.toLowerCase() === "r" && game.gameOver) { savedRef.current = false; game.reset(); return; }
      game.setKey(e.key, true);
    };
    const ku = (e: KeyboardEvent) => game.setKey(e.key, false);
    window.addEventListener("keydown", kd);
    window.addEventListener("keyup", ku);

    let last = performance.now(); let raf = 0;
    const loop = (t: number) => {
      const dt = Math.min(0.05, (t - last) / 1000); last = t;
      game.step(dt);
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("keydown", kd);
      window.removeEventListener("keyup", ku);
    };
  }, []);

  useEffect(() => {
    if (stats.gameOver && !savedRef.current) {
      savedRef.current = true;
      saveScore({
        name: name || ui().namePlaceholder,
        score: stats.score, wave: stats.wave,
        date: new Date().toISOString(),
      });
    }
  }, [stats.gameOver, stats.score, stats.wave, name]);

  const u = ui();
  const manaPct = Math.min(100, (stats.mana / stats.maxMana) * 100);
  const hasShield = stats.mana >= 25;

  const changeLang = (l: Lang) => {
    setLang(l); setLangState(l);
    if (typeof window !== "undefined") localStorage.setItem(LANG_KEY, l);
  };
  const changeTheme = (t: Theme) => {
    setTheme(t); setThemeState(t);
    if (typeof window !== "undefined") localStorage.setItem(THEME_KEY, t);
  };

  const submitName = (val: string) => {
    const clean = val.trim().slice(0, 16) || ui().namePlaceholder;
    setName(clean);
    if (typeof window !== "undefined") localStorage.setItem(NAME_KEY, clean);
    setShowNameModal(false);
  };

  const isTerminal = theme === "terminal";
  const accent = isTerminal ? "#00ff41" : "#ff4fd8";
  const accent2 = isTerminal ? "#ffffff" : "#7cf0ff";
  const bg = isTerminal
    ? "linear-gradient(180deg, #000 0%, #0a0a0a 100%)"
    : "#000";

  return (
    <div
      className="min-h-screen w-full flex flex-col items-center justify-center text-white font-mono p-4 gap-3"
      style={{ background: bg }}
    >
      {/* Top bar: name + toggles */}
      <div className="w-full max-w-[960px] flex flex-wrap items-center justify-between gap-2 text-xs sm:text-sm">
        <div className="flex items-center gap-3">
          <span style={{ color: accent }}>{u.yourName}:</span>
          <button
            onClick={() => setShowNameModal(true)}
            className="underline hover:opacity-80"
            style={{ color: accent2 }}
          >
            {name || ui().namePlaceholder}
          </button>
        </div>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-1">
            <span style={{ color: accent }}>{u.language}:</span>
            <button onClick={() => changeLang("et")} className={`px-1.5 ${lang === "et" ? "underline font-bold" : "opacity-60"}`} style={{ color: accent2 }}>ET</button>
            <span className="opacity-40">|</span>
            <button onClick={() => changeLang("en")} className={`px-1.5 ${lang === "en" ? "underline font-bold" : "opacity-60"}`} style={{ color: accent2 }}>EN</button>
          </div>
          <div className="flex items-center gap-1">
            <span style={{ color: accent }}>{u.theme}:</span>
            <button onClick={() => changeTheme("arcade")} className={`px-1.5 ${theme === "arcade" ? "underline font-bold" : "opacity-60"}`} style={{ color: accent2 }}>{u.arcade}</button>
            <span className="opacity-40">|</span>
            <button onClick={() => changeTheme("terminal")} className={`px-1.5 ${theme === "terminal" ? "underline font-bold" : "opacity-60"}`} style={{ color: accent2 }}>{u.terminal}</button>
          </div>
        </div>
      </div>

      {/* HUD */}
      <div className="w-full max-w-[960px] grid grid-cols-3 gap-2 text-sm sm:text-base">
        <div className="flex items-center gap-2">
          <span style={{ color: accent }}>{u.lives}</span>
          <span className="text-yellow-300 text-xl">{"♥".repeat(Math.max(0, stats.lives))}</span>
        </div>
        <div className="flex items-center gap-2">
          <span style={{ color: accent2 }}>{u.mana}</span>
          <div className="flex-1 h-4 border relative overflow-hidden" style={{ borderColor: `${accent2}99`, background: `${accent2}22` }}>
            <div
              className="absolute inset-y-0 left-0 transition-[width] duration-100"
              style={{
                width: `${manaPct}%`,
                background: isTerminal
                  ? `linear-gradient(to right, #00ff41, #ffffff)`
                  : `linear-gradient(to right, #7cf0ff, #ff4fd8)`,
              }}
            />
          </div>
          <span style={{ color: accent2 }} className="w-10 text-right">{stats.mana}</span>
          {hasShield && <span className="text-xs" style={{ color: accent2 }} title="shield ready">◈</span>}
        </div>
        <div className="flex justify-end gap-4">
          <span><span style={{ color: accent }}>{u.wave}</span> {stats.wave}</span>
          <span><span style={{ color: accent }}>{u.score}</span> {stats.score.toString().padStart(6, "0")}</span>
        </div>
      </div>

      <div
        className="relative"
        style={{
          filter: isTerminal
            ? "drop-shadow(0 0 24px rgba(0,255,65,0.45))"
            : "drop-shadow(0 0 24px rgba(255,79,216,0.4))",
        }}
      >
        <canvas
          ref={canvasRef}
          className="block border-2"
          style={{
            width: "min(96vw, 960px)",
            aspectRatio: `${VW} / ${VH}`,
            imageRendering: "pixelated",
            background: isTerminal ? "#000" : "#0a0420",
            borderColor: isTerminal ? "#00ff4199" : "#ff4fd899",
          }}
        />

        {/* Pause menu overlay */}
        {stats.paused && !stats.gameOver && (
          <div className="absolute inset-0 flex items-center justify-center" style={{ background: "rgba(0,0,0,0.7)" }}>
            <div
              className="border-2 px-8 py-6 flex flex-col items-center gap-3"
              style={{ borderColor: accent, background: "rgba(0,0,0,0.85)" }}
            >
              <div className="text-2xl font-bold tracking-widest" style={{ color: accent }}>{u.pausedTitle}</div>
              <button
                onClick={() => { gameRef.current?.setKey("p", true); }}
                className="px-6 py-2 border hover:opacity-80"
                style={{ borderColor: accent2, color: accent2 }}
              >
                {u.resume}
              </button>
              <button
                onClick={() => { savedRef.current = false; gameRef.current?.reset(); gameRef.current!.paused = false; }}
                className="px-6 py-2 border hover:opacity-80"
                style={{ borderColor: accent2, color: accent2 }}
              >
                {u.restartBtn}
              </button>
              <Link
                to="/"
                className="px-6 py-2 border hover:opacity-80"
                style={{ borderColor: accent2, color: accent2 }}
              >
                {u.quit}
              </Link>
              <div className="text-xs opacity-60 mt-2" style={{ color: accent2 }}>Esc / P</div>
            </div>
          </div>
        )}

        {/* Achievement toasts (top-right of game area) */}
        <div className="absolute top-2 right-2 flex flex-col gap-2 pointer-events-none">
          {toasts.map((toast) => {
            const info = getAchievementInfo(toast.key, lang);
            return (
              <div
                key={toast.id}
                className="border-2 px-3 py-2 text-xs animate-in fade-in slide-in-from-right"
                style={{
                  borderColor: accent,
                  background: "rgba(0,0,0,0.85)",
                  color: accent2,
                  minWidth: 180,
                }}
              >
                <div className="text-[10px] opacity-70" style={{ color: accent }}>★ {u.newAchievement}</div>
                <div className="font-bold">{info.icon} {info.name}</div>
                <div className="opacity-80 text-[10px]">{info.desc}</div>
              </div>
            );
          })}
        </div>
      </div>

      <div
        className="w-full max-w-[960px] text-xs sm:text-sm flex flex-wrap gap-x-4 gap-y-1 justify-center"
        style={{ color: `${accent}cc` }}
      >
        <span>WASD / Arrows — {u.fly}</span>
        <span><span className="text-yellow-300">Space</span> {u.machineGun}</span>
        <span><span className="text-yellow-300">J</span> {u.laser}</span>
        <span><span className="text-yellow-300">K</span> {u.bomb}</span>
        <span><span className="text-yellow-300">B</span> {u.abombHint}</span>
        <span><span className="text-yellow-300">Q/E</span> {u.trick}</span>
        <span><span className="text-yellow-300">Esc/P</span> {u.pause}</span>
        <span><span className="text-yellow-300">R</span> {u.restart}</span>
      </div>

      <Link to="/" className="text-sm underline hover:opacity-80" style={{ color: accent2 }}>{u.back}</Link>

      {/* Name modal */}
      {showNameModal && (
        <NameModal
          initial={name}
          placeholder={ui().namePlaceholder}
          label={u.yourName}
          submitLabel={u.start}
          accent={accent}
          accent2={accent2}
          onSubmit={submitName}
        />
      )}
    </div>
  );
}

function NameModal({
  initial, placeholder, label, submitLabel, accent, accent2, onSubmit,
}: {
  initial: string; placeholder: string; label: string; submitLabel: string;
  accent: string; accent2: string;
  onSubmit: (v: string) => void;
}) {
  const [val, setVal] = useState(initial);
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ background: "rgba(0,0,0,0.85)" }}>
      <form
        onSubmit={(e) => { e.preventDefault(); onSubmit(val); }}
        className="border-2 px-8 py-6 flex flex-col gap-3 font-mono"
        style={{ borderColor: accent, background: "#000" }}
      >
        <label className="text-sm tracking-widest" style={{ color: accent }}>{label}</label>
        <input
          autoFocus
          value={val}
          onChange={(e) => setVal(e.target.value)}
          placeholder={placeholder}
          maxLength={16}
          className="px-3 py-2 bg-black border outline-none text-lg tracking-widest uppercase"
          style={{ borderColor: accent2, color: accent2, minWidth: 240 }}
        />
        <button
          type="submit"
          className="px-4 py-2 border hover:opacity-80 font-bold tracking-widest"
          style={{ borderColor: accent, color: accent }}
        >
          ▶ {submitLabel}
        </button>
      </form>
    </div>
  );
}
