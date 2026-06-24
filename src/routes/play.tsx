import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { Game, VW, VH, type GameStats } from "../game/engine";

export const Route = createFileRoute("/play")({
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

const HS_KEY = "f16fury_highscores";

type Score = { score: number; wave: number; date: string };

function loadScores(): Score[] {
  if (typeof window === "undefined") return [];
  try { return JSON.parse(localStorage.getItem(HS_KEY) || "[]"); } catch { return []; }
}
function saveScore(s: Score) {
  const all = [...loadScores(), s].sort((a, b) => b.score - a.score).slice(0, 5);
  localStorage.setItem(HS_KEY, JSON.stringify(all));
}

function PlayPage() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const gameRef = useRef<Game | null>(null);
  const [stats, setStats] = useState<GameStats>({
    score: 0, wave: 1, lives: 3, mana: 0, maxMana: 100, kills: 0, gameOver: false, paused: false,
  });
  const savedRef = useRef(false);

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
      saveScore({ score: stats.score, wave: stats.wave, date: new Date().toISOString() });
    }
  }, [stats.gameOver, stats.score, stats.wave]);

  const manaPct = Math.min(100, (stats.mana / stats.maxMana) * 100);

  return (
    <div className="min-h-screen w-full flex flex-col items-center justify-center bg-black text-white font-mono p-4 gap-3">
      {/* HUD */}
      <div className="w-full max-w-[960px] grid grid-cols-3 gap-2 text-sm sm:text-base">
        <div className="flex items-center gap-2">
          <span className="text-pink-400">LIVES</span>
          <span className="text-yellow-300 text-xl">{"♥".repeat(Math.max(0, stats.lives))}</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-cyan-300">MANA</span>
          <div className="flex-1 h-4 border border-cyan-300/60 bg-cyan-950/40 relative overflow-hidden">
            <div className="absolute inset-y-0 left-0 bg-gradient-to-r from-cyan-400 to-pink-400 transition-[width] duration-100" style={{ width: `${manaPct}%` }} />
          </div>
          <span className="text-cyan-200 w-10 text-right">{stats.mana}</span>
        </div>
        <div className="flex justify-end gap-4">
          <span><span className="text-pink-400">WAVE</span> {stats.wave}</span>
          <span><span className="text-pink-400">SCORE</span> {stats.score.toString().padStart(6, "0")}</span>
        </div>
      </div>

      <div className="relative" style={{ filter: "drop-shadow(0 0 24px rgba(255,79,216,0.4))" }}>
        <canvas
          ref={canvasRef}
          className="block border-2 border-pink-500/60"
          style={{
            width: "min(96vw, 960px)",
            aspectRatio: `${VW} / ${VH}`,
            imageRendering: "pixelated",
            background: "#0a0420",
          }}
        />
      </div>

      <div className="w-full max-w-[960px] text-[10px] sm:text-xs text-pink-300/80 flex flex-wrap gap-x-4 gap-y-1 justify-center">
        <span>WASD / Nooled — lenda</span>
        <span><span className="text-yellow-300">Tühik</span> kuulipilduja</span>
        <span><span className="text-yellow-300">J</span> laser (8 mana)</span>
        <span><span className="text-yellow-300">K</span> pomm (20 mana)</span>
        <span><span className="text-yellow-300">Q/E</span> tünnirull (trikk)</span>
        <span><span className="text-yellow-300">P</span> paus</span>
        <span><span className="text-yellow-300">R</span> uuesti</span>
      </div>

      <Link to="/" className="text-cyan-300 hover:text-pink-400 text-xs underline">← tagasi menüüsse</Link>
    </div>
  );
}
