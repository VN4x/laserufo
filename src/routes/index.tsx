import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { setLang, getLang, ui, type Lang } from "../game/i18n";
import { setTheme, getTheme, type Theme } from "../game/palette";
import { ACHIEVEMENTS, loadUnlocked, getAchievementInfo, type AchKey } from "../game/achievements";

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

type Score = { name?: string; score: number; wave: number; date: string };

function Index() {
  const [scores, setScores] = useState<Score[]>([]);
  const [lang, setLangState] = useState<Lang>("et");
  const [theme, setThemeState] = useState<Theme>("arcade");
  const [unlocked, setUnlocked] = useState<Set<AchKey>>(new Set());

  useEffect(() => {
    if (typeof window === "undefined") return;
    // Load both score formats (v2 = with names; v1 = legacy)
    let parsed: Score[] = [];
    try { parsed = JSON.parse(localStorage.getItem("f16fury_highscores_v2") || "[]"); } catch { /* */ }
    if (parsed.length === 0) {
      try { parsed = JSON.parse(localStorage.getItem("f16fury_highscores") || "[]"); } catch { /* */ }
    }
    setScores(parsed);

    const savedLang = (localStorage.getItem("f16fury_lang") as Lang) || "et";
    const savedTheme = (localStorage.getItem("f16fury_theme") as Theme) || "arcade";
    setLang(savedLang); setTheme(savedTheme);
    setLangState(savedLang); setThemeState(savedTheme);
    setUnlocked(loadUnlocked());
  }, []);

  const u = ui();
  const isTerminal = theme === "terminal";

  const changeLang = (l: Lang) => {
    setLang(l); setLangState(l);
    if (typeof window !== "undefined") localStorage.setItem("f16fury_lang", l);
  };
  const changeTheme = (tt: Theme) => {
    setTheme(tt); setThemeState(tt);
    if (typeof window !== "undefined") localStorage.setItem("f16fury_theme", tt);
  };

  const bg = isTerminal
    ? "radial-gradient(ellipse at bottom, #003311 0%, #000 70%)"
    : "radial-gradient(ellipse at bottom, #ff2d6a 0%, #2a0a4a 40%, #0a0420 80%)";
  const accent = isTerminal ? "#00ff41" : "#ff4fd8";
  const accent2 = isTerminal ? "#ffffff" : "#7cf0ff";
  const accent3 = isTerminal ? "#cccccc" : "#ffd84d";

  return (
    <div className="min-h-screen w-full font-mono text-white relative overflow-hidden" style={{ background: bg }}>
      <div
        className="absolute inset-0 pointer-events-none opacity-30"
        style={{
          background: isTerminal
            ? "repeating-linear-gradient(0deg, rgba(0,255,65,0.1) 0px, rgba(0,255,65,0.1) 1px, transparent 1px, transparent 3px)"
            : "repeating-linear-gradient(0deg, rgba(0,0,0,0.4) 0px, rgba(0,0,0,0.4) 1px, transparent 1px, transparent 3px)",
        }}
      />
      <div
        className="absolute bottom-0 left-0 right-0 h-1/3 pointer-events-none opacity-60"
        style={{
          background: isTerminal
            ? `linear-gradient(to top, rgba(0,255,65,0.3), transparent), repeating-linear-gradient(90deg, transparent 0, transparent 39px, ${accent} 39px, ${accent} 40px), repeating-linear-gradient(0deg, transparent 0, transparent 19px, ${accent} 19px, ${accent} 20px)`
            : `linear-gradient(to top, rgba(255,45,106,0.4), transparent), repeating-linear-gradient(90deg, transparent 0, transparent 39px, ${accent} 39px, ${accent} 40px), repeating-linear-gradient(0deg, transparent 0, transparent 19px, ${accent} 19px, ${accent} 20px)`,
          transform: "perspective(400px) rotateX(60deg)",
          transformOrigin: "bottom",
        }}
      />

      <div className="relative z-10 max-w-3xl mx-auto px-6 py-12 flex flex-col items-center gap-6">
        {/* Lang + Theme top right */}
        <div className="self-end flex items-center gap-4 text-xs">
          <div className="flex items-center gap-1">
            <span style={{ color: accent }}>{u.language}:</span>
            <button onClick={() => changeLang("et")} className={lang === "et" ? "underline font-bold" : "opacity-60"} style={{ color: accent2 }}>ET</button>
            <span className="opacity-40">|</span>
            <button onClick={() => changeLang("en")} className={lang === "en" ? "underline font-bold" : "opacity-60"} style={{ color: accent2 }}>EN</button>
          </div>
          <div className="flex items-center gap-1">
            <span style={{ color: accent }}>{u.theme}:</span>
            <button onClick={() => changeTheme("arcade")} className={theme === "arcade" ? "underline font-bold" : "opacity-60"} style={{ color: accent2 }}>{u.arcade}</button>
            <span className="opacity-40">|</span>
            <button onClick={() => changeTheme("terminal")} className={theme === "terminal" ? "underline font-bold" : "opacity-60"} style={{ color: accent2 }}>{u.terminal}</button>
          </div>
        </div>

        <div className="text-center">
          <h1
            className="text-5xl sm:text-7xl font-black tracking-wider"
            style={
              isTerminal
                ? { color: accent, textShadow: `0 0 30px ${accent}`, letterSpacing: "0.1em" }
                : {
                    background: "linear-gradient(180deg, #ffd84d 0%, #ff4fd8 60%, #7cf0ff 100%)",
                    WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent",
                    textShadow: "0 0 30px rgba(255,79,216,0.5)", letterSpacing: "0.1em",
                  }
            }
          >F16 FURY</h1>
          <p className="mt-2 text-sm sm:text-base tracking-widest" style={{ color: accent2 }}>{u.insertCoin}</p>
        </div>

        <Link
          to="/play"
          className="px-8 py-4 text-xl font-bold border-2 transition-all hover:scale-105"
          style={{
            borderColor: accent,
            background: `${accent}1a`,
            color: accent,
            textShadow: `0 0 10px ${accent}`,
            boxShadow: `0 0 20px ${accent}66, inset 0 0 20px ${accent}33`,
          }}
        >{u.startGame}</Link>

        <div className="grid sm:grid-cols-2 gap-6 w-full">
          <div className="border p-4 text-sm" style={{ borderColor: `${accent2}66`, background: "rgba(0,0,0,0.5)" }}>
            <h2 className="font-bold mb-2 tracking-widest" style={{ color: accent2 }}>{u.controls}</h2>
            <ul className="space-y-1">
              <li><span style={{ color: accent3 }}>WASD/Arrows</span> — {u.fly}</li>
              <li><span style={{ color: accent3 }}>Space</span> — {u.machineGun}</li>
              <li><span style={{ color: accent3 }}>J</span> — {u.laser}</li>
              <li><span style={{ color: accent3 }}>K</span> — {u.bomb}</li>
              <li><span style={{ color: accent3 }}>B</span> — {u.abombHint}</li>
              <li><span style={{ color: accent3 }}>Q / E</span> — {u.trick}</li>
              <li><span style={{ color: accent3 }}>Esc / P</span> — {u.pause}, <span style={{ color: accent3 }}>R</span> — {u.restart}</li>
            </ul>
          </div>
          <div className="border p-4 text-sm" style={{ borderColor: `${accent}66`, background: "rgba(0,0,0,0.5)" }}>
            <h2 className="font-bold mb-2 tracking-widest" style={{ color: accent }}>{u.manaTricks}</h2>
            <ul className="space-y-1" style={{ color: accent2 }}>
              {u.manaInfo.map((line) => <li key={line}>{line}</li>)}
            </ul>
          </div>
        </div>

        {/* High scores */}
        <div className="w-full border p-4" style={{ borderColor: `${accent3}66`, background: "rgba(0,0,0,0.5)" }}>
          <h2 className="font-bold mb-2 tracking-widest text-center" style={{ color: accent3 }}>{u.highScores}</h2>
          {scores.length === 0 ? (
            <p className="text-center text-sm opacity-60" style={{ color: accent }}>{u.noScores}</p>
          ) : (
            <ol className="space-y-1 text-sm">
              {scores.map((s, i) => (
                <li key={i} className="grid grid-cols-[2rem_1fr_auto_auto_auto] gap-3 items-center">
                  <span style={{ color: accent3 }}>#{i + 1}</span>
                  <span className="truncate" style={{ color: accent }}>{s.name || "—"}</span>
                  <span className="tabular-nums">{s.score.toString().padStart(6, "0")}</span>
                  <span style={{ color: accent2 }}>WAVE {s.wave}</span>
                  <span className="text-xs opacity-60">{new Date(s.date).toLocaleDateString()}</span>
                </li>
              ))}
            </ol>
          )}
        </div>

        {/* Achievements */}
        <div className="w-full border p-4" style={{ borderColor: `${accent}66`, background: "rgba(0,0,0,0.5)" }}>
          <h2 className="font-bold mb-3 tracking-widest text-center" style={{ color: accent }}>
            {u.achievements} <span className="text-xs opacity-70">({unlocked.size}/{Object.keys(ACHIEVEMENTS).length} {u.unlocked})</span>
          </h2>
          <ul className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-xs">
            {(Object.keys(ACHIEVEMENTS) as AchKey[]).map((k) => {
              const info = getAchievementInfo(k, lang);
              const got = unlocked.has(k);
              return (
                <li
                  key={k}
                  className="border px-2 py-1.5"
                  style={{
                    borderColor: got ? accent : `${accent}33`,
                    opacity: got ? 1 : 0.45,
                    background: got ? `${accent}1a` : "transparent",
                  }}
                >
                  <div className="font-bold" style={{ color: got ? accent : accent2 }}>
                    {info.icon} {info.name}
                  </div>
                  <div className="opacity-80 text-[10px]">{info.desc}</div>
                </li>
              );
            })}
          </ul>
        </div>

        <p className="text-xs text-center opacity-40" style={{ color: accent }}>© 1986 LOVABLE ARCADE SYSTEMS · v1.1</p>
      </div>
    </div>
  );
}
