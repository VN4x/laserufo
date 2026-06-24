import PocketBase from "pocketbase";
import { pocketBaseUrl } from "./config";
import { randomRoomCode } from "./net";

let pb: PocketBase | null = null;

export function getPocketBase(): PocketBase {
  if (!pb) pb = new PocketBase(pocketBaseUrl());
  return pb;
}

export type RoomRecord = {
  id: string;
  code: string;
  status: "waiting" | "playing" | "finished";
  host_name: string;
  max_players?: number;
};

export async function createRoom(hostName: string): Promise<RoomRecord> {
  const client = getPocketBase();
  let code = randomRoomCode();
  for (let attempt = 0; attempt < 5; attempt++) {
    try {
      const record = await client.collection("rooms").create({
        code,
        status: "waiting",
        host_name: hostName.slice(0, 16),
        max_players: 4,
      });
      return record as unknown as RoomRecord;
    } catch {
      code = randomRoomCode();
    }
  }
  throw new Error("Could not create room");
}

export async function findRoomByCode(code: string): Promise<RoomRecord | null> {
  const client = getPocketBase();
  const list = await client.collection("rooms").getList(1, 1, {
    filter: `code = "${code.toUpperCase()}"`,
  });
  return (list.items[0] as unknown as RoomRecord) ?? null;
}

export async function addRoomPlayer(roomId: string, name: string, slot: number): Promise<void> {
  const client = getPocketBase();
  await client.collection("room_players").create({
    room: roomId,
    name: name.slice(0, 16),
    slot,
  });
}

export async function updateRoomStatus(
  roomId: string,
  status: "waiting" | "playing" | "finished",
): Promise<void> {
  const client = getPocketBase();
  await client.collection("rooms").update(roomId, { status });
}

export async function submitCoopScore(data: {
  room_code: string;
  player_names: string[];
  score: number;
  wave: number;
  kills: number;
}): Promise<void> {
  const client = getPocketBase();
  await client.collection("coop_scores").create({
    ...data,
    finished_at: new Date().toISOString(),
  });
}
