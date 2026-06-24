/** Runtime URLs — empty VITE_* means same origin (VPS Caddy deployment). */
export function gameServerUrl(): string {
  const env = import.meta.env.VITE_GAME_SERVER_URL as string | undefined;
  if (env && env.length > 0) return env.replace(/\/$/, "");
  if (typeof window !== "undefined") return window.location.origin;
  return "http://localhost:3001";
}

export function pocketBaseUrl(): string {
  const env = import.meta.env.VITE_POCKETBASE_URL as string | undefined;
  if (env && env.length > 0) return env.replace(/\/$/, "");
  if (typeof window !== "undefined") return `${window.location.origin}/pb`;
  return "http://localhost:8090";
}
