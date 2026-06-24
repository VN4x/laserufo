import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { Game, VW, VH, type GameStats, type CoopConfig } from "../game/engine";
import { setTheme, type Theme } from "../game/palette";
import { setLang, ui, type Lang } from "../game/i18n";
import {
  connectNet,
  disconnectNet,
  joinRoom,
  sendInput,
  sendSnapshot,
  randomPlayerId,
} from "../game/net";
import { findRoomByCode, submitCoopScore, updateRoomStatus } from "../game/lobby";
import type { RoomState } from "../game/protocol";

export const Route = createFileRoute("/coop/$code")({
  ssr: false,
  validateSearch: (s: Record<string, unknown>) => ({
    seed: typeof s.seed === "string" ? s.seed : undefined,
  }),
  component: CoopGamePage,
});

const PLAYER_ID_KEY = "f16fury_player_id";
const NAME_KEY = "f16fury_player_name";

function CoopGamePage() {
  const { code } = Route.useParams();
  const navigate = useNavigate();
  const search = Route.useSearch();
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const gameRef = useRef<Game | null>(null);
  const isHostRef = useRef(false);
  const playerIdRef = useRef("");
  const roomStateRef = useRef<RoomState | null>(null);
  const scoreSavedRef = useRef(false);

  const [stats, setStats] = useState<GameStats>({
    score: 0,
    wave: 1,
    lives: 5,
    mana: 0,
    maxMana: 100,
    kills: 0,
    gameOver: false,
    paused: false,
  });
  const [lang] = useState<Lang>(() =>
    typeof window !== "undefined" ? (localStorage.getItem("f16fury_lang") as Lang) || "et" : "et",
  );
  const [theme] = useState<Theme>(() =>
    typeof window !== "undefined"
      ? (localStorage.getItem("f16fury_theme") as Theme) || "arcade"
      : "arcade",
  );

  useEffect(() => {
    setLang(lang);
    setTheme(theme);
  }, [lang, theme]);

  useEffect(() => {
    const c = canvasRef.current!;
    c.width = VW;
    c.height = VH;
    const ctx = c.getContext("2d")!;
    ctx.imageSmoothingEnabled = false;

    const playerId = localStorage.getItem(PLAYER_ID_KEY) || randomPlayerId();
    localStorage.setItem(PLAYER_ID_KEY, playerId);
    playerIdRef.current = playerId;
    const name = localStorage.getItem(NAME_KEY) || ui().namePlaceholder;

    const playerNames = new Map<string, string>();
    playerNames.set(playerId, name);

    let game: Game | null = null;

    const buildCoop = (isHost: boolean): CoopConfig => ({
      localId: playerId,
      isHost,
      playerNames,
      seed: search.seed ? Number(search.seed) : undefined,
      onInputRelay: (pid, input) => sendInput(pid, input),
      onSnapshot: (snap) => sendSnapshot(snap),
    });

    connectNet({
      onState: (state) => {
        roomStateRef.current = state;
        isHostRef.current = state.hostId === playerId;
        for (const p of state.players) {
          playerNames.set(p.id, p.name);
          game?.addCoopPlayer(p.id, p.name, p.slot);
        }
        if (game) {
          game.coop = { ...game.coop!, isHost: isHostRef.current };
        }
      },
      onStart: ({ seed }) => {
        if (isHostRef.current && game) {
          game.startCoop(seed);
        }
      },
      onSnapshot: (snap) => {
        if (!isHostRef.current && game) {
          game.applySnapshot(snap);
        }
      },
      onInput: (pid, input) => {
        game?.setRemoteInput(pid, input);
      },
      onHostMigrate: ({ newHostId, snapshot }) => {
        isHostRef.current = newHostId === playerId;
        if (game?.coop) game.coop.isHost = isHostRef.current;
        if (snapshot && isHostRef.current) {
          game?.applySnapshot(snapshot);
        }
      },
    });

    joinRoom(code, playerId, name).then((ok) => {
      if (!ok) {
        navigate({ to: "/coop" });
        return;
      }
      isHostRef.current = roomStateRef.current?.hostId === playerId;
      game = new Game(ctx, setStats, buildCoop(isHostRef.current));
      if (search.seed && isHostRef.current) {
        game.startCoop(Number(search.seed));
      }
      gameRef.current = game;
    });

    const kd = (e: KeyboardEvent) => {
      if (!game) return;
      if ([" ", "ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(e.key))
        e.preventDefault();
      game.setKey(e.key, true);
    };
    const ku = (e: KeyboardEvent) => {
      game?.setKey(e.key, false);
    };
    window.addEventListener("keydown", kd);
    window.addEventListener("keyup", ku);

    let last = performance.now();
    let raf = 0;
    const loop = (t: number) => {
      const dt = Math.min(0.05, (t - last) / 1000);
      last = t;
      game?.step(dt);
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("keydown", kd);
      window.removeEventListener("keyup", ku);
      disconnectNet();
    };
  }, [code, navigate, search.seed]);

  useEffect(() => {
    if (!stats.gameOver || scoreSavedRef.current) return;
    scoreSavedRef.current = true;
    if (!isHostRef.current) return;
    const state = roomStateRef.current;
    const names = state?.players.map((p) => p.name) ?? [];
    submitCoopScore({
      room_code: code.toUpperCase(),
      player_names: names,
      score: stats.score,
      wave: stats.wave,
      kills: stats.kills,
    }).catch(() => undefined);
    findRoomByCode(code).then((room) => {
      if (room) updateRoomStatus(room.id, "finished").catch(() => undefined);
    });
  }, [stats.gameOver, stats.score, stats.wave, stats.kills, code]);

  const u = ui();
  const isTerminal = theme === "terminal";
  const accent = isTerminal ? "#00ff41" : "#ff4fd8";
  const accent2 = isTerminal ? "#ffffff" : "#7cf0ff";

  return (
    <div
      className="min-h-screen w-full flex flex-col items-center justify-center text-white font-mono p-4 gap-3"
      style={{ background: "#000" }}
    >
      <div className="w-full max-w-[960px] grid grid-cols-3 gap-2 text-sm">
        <div>
          <span style={{ color: accent }}>{u.lives}</span> {"♥".repeat(Math.max(0, stats.lives))}
        </div>
        <div className="text-center" style={{ color: accent2 }}>
          {u.coopRoom} {code.toUpperCase()}
        </div>
        <div className="text-right">
          <span style={{ color: accent }}>{u.score}</span> {stats.score}
        </div>
      </div>
      <canvas
        ref={canvasRef}
        className="block border-2"
        style={{
          width: "min(96vw, 960px)",
          aspectRatio: `${VW} / ${VH}`,
          imageRendering: "pixelated",
          borderColor: `${accent}99`,
        }}
      />
      {stats.gameOver && (
        <Link to="/coop" className="text-sm underline" style={{ color: accent2 }}>
          {u.coopBackLobby}
        </Link>
      )}
      <Link to="/" className="text-sm underline" style={{ color: accent2 }}>
        {u.back}
      </Link>
    </div>
  );
}
