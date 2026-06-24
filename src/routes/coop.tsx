import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { setLang, getLang, ui, type Lang } from "../game/i18n";
import { setTheme, getTheme, type Theme } from "../game/palette";
import {
  connectNet,
  disconnectNet,
  joinRoom,
  randomPlayerId,
  randomSeed,
  startRoom,
} from "../game/net";
import { createRoom, addRoomPlayer, updateRoomStatus } from "../game/lobby";
import type { RoomState } from "../game/protocol";

export const Route = createFileRoute("/coop")({
  ssr: false,
  head: () => ({
    meta: [{ title: "F16 Fury — Co-op Lobby" }],
  }),
  component: CoopLobby,
});

const PLAYER_ID_KEY = "f16fury_player_id";
const NAME_KEY = "f16fury_player_name";

function CoopLobby() {
  const [lang, setLangState] = useState<Lang>("et");
  const [theme, setThemeState] = useState<Theme>("arcade");
  const [name, setName] = useState("");
  const [playerId, setPlayerId] = useState("");
  const [roomCode, setRoomCode] = useState("");
  const [roomId, setRoomId] = useState("");
  const [joinCode, setJoinCode] = useState("");
  const [roomState, setRoomState] = useState<RoomState | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const isHostRef = useRef(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const savedLang = (localStorage.getItem("f16fury_lang") as Lang) || "et";
    const savedTheme = (localStorage.getItem("f16fury_theme") as Theme) || "arcade";
    const savedName = localStorage.getItem(NAME_KEY) || "";
    let pid = localStorage.getItem(PLAYER_ID_KEY);
    if (!pid) {
      pid = randomPlayerId();
      localStorage.setItem(PLAYER_ID_KEY, pid);
    }
    setLang(savedLang);
    setTheme(savedTheme);
    setLangState(savedLang);
    setThemeState(savedTheme);
    setName(savedName);
    setPlayerId(pid);

    connectNet({
      onState: (s) => setRoomState(s),
    });

    return () => disconnectNet();
  }, []);

  const u = ui();
  const isTerminal = theme === "terminal";
  const accent = isTerminal ? "#00ff41" : "#ff4fd8";
  const accent2 = isTerminal ? "#ffffff" : "#7cf0ff";

  const create = async () => {
    setError("");
    setLoading(true);
    try {
      const clean = name.trim().slice(0, 16) || u.namePlaceholder;
      localStorage.setItem(NAME_KEY, clean);
      const room = await createRoom(clean);
      await addRoomPlayer(room.id, clean, 0);
      const ok = await joinRoom(room.code, playerId, clean);
      if (!ok) throw new Error("Socket join failed");
      isHostRef.current = true;
      setRoomCode(room.code);
      setRoomId(room.id);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Create failed");
    } finally {
      setLoading(false);
    }
  };

  const join = async () => {
    setError("");
    setLoading(true);
    try {
      const code = joinCode.trim().toUpperCase();
      if (code.length !== 4) throw new Error("Enter 4-letter code");
      const clean = name.trim().slice(0, 16) || u.namePlaceholder;
      localStorage.setItem(NAME_KEY, clean);
      const ok = await joinRoom(code, playerId, clean);
      if (!ok) throw new Error("Could not join room");
      setRoomCode(code);
      isHostRef.current = false;
    } catch (e) {
      setError(e instanceof Error ? e.message : "Join failed");
    } finally {
      setLoading(false);
    }
  };

  const start = async () => {
    if (!roomState || roomState.hostId !== playerId) return;
    const seed = randomSeed();
    startRoom(seed);
    if (roomId) await updateRoomStatus(roomId, "playing");
    window.location.href = `/coop/${roomCode}?seed=${seed}`;
  };

  const copyLink = () => {
    const url = `${window.location.origin}/coop/${roomCode}`;
    navigator.clipboard?.writeText(url);
  };

  return (
    <div
      className="min-h-screen w-full font-mono text-white flex flex-col items-center justify-center p-6 gap-6"
      style={{
        background: isTerminal
          ? "radial-gradient(ellipse at bottom, #003311 0%, #000 70%)"
          : "radial-gradient(ellipse at bottom, #ff2d6a 0%, #2a0a4a 40%, #0a0420 80%)",
      }}
    >
      <h1 className="text-3xl font-black tracking-widest" style={{ color: accent }}>
        {u.coopTitle}
      </h1>

      <label className="flex flex-col gap-1 text-sm">
        <span style={{ color: accent2 }}>{u.yourName}</span>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          maxLength={16}
          className="px-3 py-2 bg-black border uppercase"
          style={{ borderColor: accent, color: accent2, minWidth: 200 }}
        />
      </label>

      {!roomCode ? (
        <div className="flex flex-col sm:flex-row gap-4 items-center">
          <button
            disabled={loading}
            onClick={create}
            className="px-6 py-3 border-2 font-bold"
            style={{ borderColor: accent, color: accent }}
          >
            {u.coopCreate}
          </button>
          <div className="flex gap-2 items-center">
            <input
              value={joinCode}
              onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
              maxLength={4}
              placeholder="CODE"
              className="px-3 py-2 bg-black border w-24 text-center tracking-widest"
              style={{ borderColor: accent2, color: accent2 }}
            />
            <button
              disabled={loading}
              onClick={join}
              className="px-4 py-2 border"
              style={{ borderColor: accent2, color: accent2 }}
            >
              {u.coopJoin}
            </button>
          </div>
        </div>
      ) : (
        <div
          className="border p-6 flex flex-col items-center gap-4"
          style={{ borderColor: `${accent}66` }}
        >
          <div className="text-4xl font-black tracking-[0.3em]" style={{ color: accent }}>
            {roomCode}
          </div>
          <button onClick={copyLink} className="text-xs underline" style={{ color: accent2 }}>
            {u.coopCopyLink}
          </button>
          <ul className="text-sm space-y-1">
            {roomState?.players.map((p) => (
              <li key={p.id} style={{ color: p.id === roomState.hostId ? accent : accent2 }}>
                {p.name} {p.id === roomState.hostId ? `(${u.coopHost})` : ""}
              </li>
            ))}
          </ul>
          {roomState?.hostId === playerId && (roomState?.players.length ?? 0) >= 1 && (
            <button
              onClick={start}
              className="px-6 py-3 border-2 font-bold"
              style={{ borderColor: accent, color: accent }}
            >
              {u.coopStart}
            </button>
          )}
          {roomState && roomState.hostId !== playerId && (
            <p className="text-xs opacity-70" style={{ color: accent2 }}>
              {u.coopWaitingHost}
            </p>
          )}
        </div>
      )}

      {error && <p className="text-sm text-red-400">{error}</p>}

      <Link to="/" className="text-sm underline" style={{ color: accent2 }}>
        {u.back}
      </Link>
    </div>
  );
}
