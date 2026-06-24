import { z } from "zod";

export const InputSchema = z.object({
  up: z.boolean(),
  down: z.boolean(),
  left: z.boolean(),
  right: z.boolean(),
  mg: z.boolean(),
  laser: z.boolean(),
  bomb: z.boolean(),
  abomb: z.boolean(),
  trickL: z.boolean(),
  trickR: z.boolean(),
});

export type Input = z.infer<typeof InputSchema>;

export const EMPTY_INPUT: Input = {
  up: false,
  down: false,
  left: false,
  right: false,
  mg: false,
  laser: false,
  bomb: false,
  abomb: false,
  trickL: false,
  trickR: false,
};

export const PlayerSnapSchema = z.object({
  id: z.string(),
  name: z.string().optional(),
  x: z.number(),
  y: z.number(),
  rot: z.number(),
  lives: z.number(),
  mana: z.number(),
  invuln: z.number(),
});

export const EnemySnapSchema = z.object({
  id: z.number(),
  kind: z.string(),
  x: z.number(),
  y: z.number(),
  hp: z.number(),
  maxHp: z.number(),
  variant: z.string().optional(),
});

export const ProjectileSnapSchema = z.object({
  id: z.number(),
  x: z.number(),
  y: z.number(),
  kind: z.string(),
  fromPlayerId: z.string().nullable(),
});

export const SnapshotSchema = z.object({
  tick: z.number(),
  wave: z.number(),
  score: z.number(),
  kills: z.number(),
  gameOver: z.boolean(),
  players: z.array(PlayerSnapSchema),
  enemies: z.array(EnemySnapSchema),
  projectiles: z.array(ProjectileSnapSchema),
});

export type Snapshot = z.infer<typeof SnapshotSchema>;

export const RoomJoinSchema = z.object({
  code: z.string().length(4),
  playerId: z.string().min(1),
  name: z.string().min(1).max(16),
});

export const RoomStateSchema = z.object({
  players: z.array(
    z.object({
      id: z.string(),
      name: z.string(),
      slot: z.number(),
    }),
  ),
  hostId: z.string(),
  status: z.enum(["waiting", "playing", "finished"]),
});

export const RoomStartSchema = z.object({
  seed: z.number(),
});

export const InputEventSchema = z.object({
  playerId: z.string(),
  seq: z.number(),
  input: InputSchema,
});

export const HostMigrateSchema = z.object({
  newHostId: z.string(),
  snapshot: SnapshotSchema.optional(),
});

export type RoomState = z.infer<typeof RoomStateSchema>;
export type RoomStart = z.infer<typeof RoomStartSchema>;
export type HostMigrate = z.infer<typeof HostMigrateSchema>;
