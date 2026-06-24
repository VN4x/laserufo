import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "F16 Fury — Retro Arcade Lendurimäng" },
      { name: "description", content: "Juhi F16 hävitajat, tulista UFO-sid laserite, pommide ja kuulipildujaga. Tee trikke, kasvata manat, võida elusid." },
      { property: "og:title", content: "F16 Fury" },
      { property: "og:description", content: "Retro 80ndate arcade lendurimäng — F16 vs UFO-d." },
    ],
  }),
  component: Index,
});

type Score = { score: number; wave: number; date: string };

function Index() {
  const [scores, setScores] = useState<Score[]>([]);
  useEffect(() => {
    try { setScores(JSON.parse(localStorage.getItem("f16fury_highscores") || "[]")); } catch { /* */ }
  }, []);

  return (
    <div className="min-h-screen w-full font-mono text-white relative overflow-hidden"
      style={{
        background: "radial-gradient(ellipse at bottom, #ff2d6a 0%, #2a0a4a 40%, #0a0420 80%)",
      }}
    >
      {/* Scanlines */}
      <div className="absolute inset-0 pointer-events-none opacity-30"
        style={{ background: "repeating-linear-gradient(0deg, rgba(0,0,0,0.4) 0px, rgba(0,0,0,0.4) 1px, transparent 1px, transparent 3px)" }} />
      {/* Grid floor */}
      <div className="absolute bottom-0 left-0 right-0 h-1/3 pointer-events-none opacity-60"
        style={{
          background: "linear-gradient(to top, rgba(255,45,106,0.4), transparent), repeating-linear-gradient(90deg, transparent 0, transparent 39px, #ff2d6a 39px, #ff2d6a 40px), repeating-linear-gradient(0deg, transparent 0, transparent 19px, #ff2d6a 19px, #ff2d6a 20px)",
          transform: "perspective(400px) rotateX(60deg)",
          transformOrigin: "bottom",
        }} />

      <div className="relative z-10 max-w-3xl mx-auto px-6 py-12 flex flex-col items-center gap-8">
        <div className="text-center">
          <h1 className="text-5xl sm:text-7xl font-black tracking-wider"
            style={{
              background: "linear-gradient(180deg, #ffd84d 0%, #ff4fd8 60%, #7cf0ff 100%)",
              WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent",
              textShadow: "0 0 30px rgba(255,79,216,0.5)",
              letterSpacing: "0.1em",
            }}
          >F16 FURY</h1>
          <p className="text-cyan-300 mt-2 text-sm sm:text-base tracking-widest">★ INSERT COIN ★ UFO INVASION 1986 ★</p>
        </div>

        <Link
          to="/play"
          className="px-8 py-4 text-xl font-bold border-2 border-pink-400 bg-pink-500/10 hover:bg-pink-500/30 transition-all hover:scale-105 text-pink-200"
          style={{ textShadow: "0 0 10px #ff4fd8", boxShadow: "0 0 20px rgba(255,79,216,0.4), inset 0 0 20px rgba(255,79,216,0.2)" }}
        >▶ ALUSTA MÄNGU</Link>

        <div className="grid sm:grid-cols-2 gap-6 w-full">
          <div className="border border-cyan-400/40 bg-black/50 p-4 text-sm">
            <h2 className="text-cyan-300 font-bold mb-2 tracking-widest">JUHTIMINE</h2>
            <ul className="space-y-1 text-pink-100">
              <li><span className="text-yellow-300">WASD/Nooled</span> — lenda</li>
              <li><span className="text-yellow-300">Tühik</span> — kuulipilduja</li>
              <li><span className="text-yellow-300">J</span> — laser (8 mana)</li>
              <li><span className="text-yellow-300">K</span> — pomm (20 mana)</li>
              <li><span className="text-yellow-300">Q / E</span> — tünnirull (trikk)</li>
              <li><span className="text-yellow-300">P</span> — paus, <span className="text-yellow-300">R</span> — uuesti</li>
            </ul>
          </div>
          <div className="border border-pink-400/40 bg-black/50 p-4 text-sm">
            <h2 className="text-pink-300 font-bold mb-2 tracking-widest">MANA & TRIKID</h2>
            <ul className="space-y-1 text-cyan-100">
              <li>★ Tünnirull → <span className="text-cyan-300">+10 mana</span></li>
              <li>★ Lähedalt möödalend → <span className="text-cyan-300">+5 mana</span></li>
              <li>★ Combo (3+) → <span className="text-cyan-300">+15 mana</span></li>
              <li>★ Täpsuslask kaugelt → <span className="text-cyan-300">+8 mana</span></li>
              <li>★ Mana täis → <span className="text-yellow-300">+1 ELU</span></li>
              <li>★ Boss võidetud → <span className="text-yellow-300">+1 ELU</span></li>
            </ul>
          </div>
        </div>

        <div className="w-full border border-yellow-400/40 bg-black/50 p-4">
          <h2 className="text-yellow-300 font-bold mb-2 tracking-widest text-center">★ HIGH SCORES ★</h2>
          {scores.length === 0 ? (
            <p className="text-center text-pink-300/60 text-sm">— pole veel skoore —</p>
          ) : (
            <ol className="space-y-1 text-sm">
              {scores.map((s, i) => (
                <li key={i} className="flex justify-between text-pink-100">
                  <span className="text-yellow-300">#{i + 1}</span>
                  <span>{s.score.toString().padStart(6, "0")}</span>
                  <span className="text-cyan-300">WAVE {s.wave}</span>
                  <span className="text-pink-300/60 text-xs">{new Date(s.date).toLocaleDateString()}</span>
                </li>
              ))}
            </ol>
          )}
        </div>

        <p className="text-pink-300/40 text-xs text-center">© 1986 LOVABLE ARCADE SYSTEMS · v1.0</p>
      </div>
    </div>
  );
}
