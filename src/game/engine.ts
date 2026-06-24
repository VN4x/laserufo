// F16 Fury — retro arcade game engine
// Internal logical resolution; canvas is upscaled via CSS for pixel look.
import { P } from "./palette";
import { t } from "./i18n";
import { unlock, bumpAbomb } from "./achievements";
import { Music } from "./music";
import { recordRun, recordLevelTime } from "./stats";
import { SeededRNG } from "./rng";
import type { Input, Snapshot } from "./protocol";
import { EMPTY_INPUT } from "./protocol";

export type { Input, Snapshot };

export type GameMode = "single" | "coop";

export interface CoopConfig {
  localId: string;
  isHost: boolean;
  playerNames: Map<string, string>;
  seed?: number;
  onInputRelay?: (playerId: string, input: Input) => void;
  onSnapshot?: (snap: Snapshot) => void;
}


export type BossVariant = "saucer" | "insect" | "monster" | "spectre";
const BOSS_CYCLE: BossVariant[] = ["saucer", "insect", "monster", "spectre"];

export const VW = 480;
export const VH = 270;

type Vec = { x: number; y: number };

interface Entity {
  pos: Vec;
  vel: Vec;
  w: number;
  h: number;
  alive: boolean;
}

interface Player extends Entity {
  playerId: string;
  displayName?: string;
  hp: number;
  lives: number;
  mana: number;
  maxMana: number;
  invuln: number;
  rotation: number;
  spinning: boolean;
  spinAccum: number;
  spinDir: number;
  mgCool: number;
  laserCool: number;
  bombCool: number;
}

interface Enemy extends Entity {
  netId: number;
  kind: "ufo" | "mother" | "bomber" | "boss";
  hp: number;
  maxHp: number;
  shootCool: number;
  age: number;
  baseY: number;
  amp: number;
  variant?: BossVariant;
  level?: number;
}

interface Projectile extends Entity {
  netId: number;
  damage: number;
  fromPlayerId: string | null;
  kind: "bullet" | "laser" | "bomb" | "plasma";
  life: number;
}

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  color: string;
  size: number;
}

interface FloatText {
  x: number;
  y: number;
  vy: number;
  life: number;
  text: string;
  color: string;
}

export interface GameStats {
  score: number;
  wave: number;
  level: number;
  levelTime: number;
  lives: number;
  mana: number;
  maxMana: number;
  kills: number;
  bosses: number;
  gameOver: boolean;
  paused: boolean;
}

const ENT_SCALE = 1.3;
const START_LIVES = 5;
const SHIELD_COST = 25;

export class Game {
  ctx: CanvasRenderingContext2D;
  mode: GameMode = "single";
  coop: CoopConfig | null = null;
  localId = "local";
  players = new Map<string, Player>();
  remoteInputs = new Map<string, Input>();
  rng = new SeededRNG(Date.now());
  tick = 0;
  nextEnemyId = 1;
  nextProjectileId = 1;
  snapshotInterval = 0;

  get player(): Player {
    return this.players.get(this.localId)!;
  }

  get simulating(): boolean {
    return this.mode === "single" || (this.coop?.isHost ?? false);
  }

  enemies: Enemy[] = [];
  projectiles: Projectile[] = [];
  particles: Particle[] = [];
  floats: FloatText[] = [];
  stars: { x: number; y: number; z: number }[] = [];
  mountains: { x: number; h: number }[] = [];

  input: Input = { ...EMPTY_INPUT };

  wave = 0;
  waveTimer = 0;
  spawnQueue: Array<{ t: number; kind: Enemy["kind"]; y?: number; variant?: BossVariant }> = [];
  score = 0;
  kills = 0;
  killTimes: number[] = [];
  gameOver = false;
  paused = false;
  shake = 0;
  time = 0;
  audio: AudioCtx;
  onStats: (s: GameStats) => void;
  comboCount = 0;
  comboTimer = 0;
  hitsThisWave = 0;
  bossesKilled = 0;
  abombsThisRun = 0;
  levelStartedAt = 0;
  runRecorded = false;

  constructor(ctx: CanvasRenderingContext2D, onStats: (s: GameStats) => void, coop?: CoopConfig) {
    this.ctx = ctx;
    this.onStats = onStats;
    this.audio = new AudioCtx();
    if (coop) {
      this.mode = "coop";
      this.coop = coop;
      this.localId = coop.localId;
      if (coop.seed != null) this.rng = new SeededRNG(coop.seed);
    }
    this.reset();
    for (let i = 0; i < 80; i++) {
      this.stars.push({
        x: Math.random() * VW,
        y: Math.random() * VH,
        z: Math.random() * 0.8 + 0.2,
      });
    }
    for (let i = 0; i < 12; i++) {
      this.mountains.push({ x: i * 60, h: 30 + Math.random() * 40 });
    }
  }

  reset() {
    this.players.clear();
    this.remoteInputs.clear();
    this.nextEnemyId = 1;
    this.nextProjectileId = 1;
    this.tick = 0;

    const spawnPlayer = (id: string, slot: number) => {
      const y = VH / 2 + (slot - 1.5) * 28;
      this.players.set(id, {
        playerId: id,
        displayName: this.coop?.playerNames.get(id),
        pos: { x: 60 + slot * 18, y: Math.max(20, Math.min(VH - 40, y)) },
        vel: { x: 0, y: 0 },
        w: 31,
        h: 13,
        alive: true,
        hp: START_LIVES,
        lives: START_LIVES,
        mana: 0,
        maxMana: 100,
        invuln: 0,
        rotation: 0,
        spinning: false,
        spinAccum: 0,
        spinDir: 0,
        mgCool: 0,
        laserCool: 0,
        bombCool: 0,
      });
    };

    if (this.mode === "coop" && this.coop) {
      let slot = 0;
      for (const id of this.coop.playerNames.keys()) {
        spawnPlayer(id, slot++);
      }
      if (!this.players.has(this.localId)) spawnPlayer(this.localId, slot);
    } else {
      spawnPlayer(this.localId, 0);
    }
    this.enemies = [];
    this.projectiles = [];
    this.particles = [];
    this.floats = [];
    this.wave = 0;
    this.waveTimer = 0;
    this.spawnQueue = [];
    this.score = 0;
    this.kills = 0;
    this.gameOver = false;
    Music.stop();

    this.shake = 0;
    this.time = 0;
    this.comboCount = 0;
    this.comboTimer = 0;
    this.hitsThisWave = 0;
    this.bossesKilled = 0;
    this.abombsThisRun = 0;
    this.levelStartedAt = 0;
    this.runRecorded = false;
    this.startNextWave();
    this.emitStats();
  }

  emitStats() {
    const p = this.player;
    this.onStats({
      score: this.score,
      wave: this.wave,
      level: this.getLevel(),
      levelTime: Math.max(0, this.time - this.levelStartedAt),
      lives: p.lives,
      mana: Math.floor(p.mana),
      maxMana: p.maxMana,
      kills: this.kills,
      bosses: this.bossesKilled,
      gameOver: this.gameOver,
      paused: this.paused,
    });
  }

  rand(): number {
    return this.simulating ? this.rng.next() : Math.random();
  }

  startCoop(seed: number) {
    this.rng = new SeededRNG(seed);
    this.reset();
  }

  addCoopPlayer(id: string, name: string, slot: number) {
    if (this.players.has(id)) return;
    this.coop?.playerNames.set(id, name);
    const y = VH / 2 + (slot - 1.5) * 28;
    this.players.set(id, {
      playerId: id,
      displayName: name,
      pos: { x: 60 + slot * 18, y: Math.max(20, Math.min(VH - 40, y)) },
      vel: { x: 0, y: 0 },
      w: 31,
      h: 13,
      alive: true,
      hp: START_LIVES,
      lives: START_LIVES,
      mana: 0,
      maxMana: 100,
      invuln: 0,
      rotation: 0,
      spinning: false,
      spinAccum: 0,
      spinDir: 0,
      mgCool: 0,
      laserCool: 0,
      bombCool: 0,
    });
  }

  startNextWave() {
    // Reward "no damage" on the wave we just finished
    if (this.wave >= 1 && this.hitsThisWave === 0) {
      unlock("no_dmg_wave");
    }
    this.hitsThisWave = 0;

    const prevWave = this.wave;
    const prevLevel = prevWave > 0 ? Math.floor((prevWave - 1) / 5) + 1 : 0;
    this.wave++;
    if (this.wave >= 5) unlock("wave_5");
    const isBoss = this.wave % 5 === 0;
    const level = this.getLevel();
    // Level transition: record best time, reset level timer
    if (prevLevel > 0 && level > prevLevel) {
      recordLevelTime(prevLevel, this.time - this.levelStartedAt);
      this.levelStartedAt = this.time;
    } else if (prevWave === 0) {
      this.levelStartedAt = this.time;
    }
    this.spawnQueue = [];
    if (isBoss) {
      const variant = BOSS_CYCLE[Math.floor((this.wave - 5) / 5) % BOSS_CYCLE.length];
      this.spawnQueue.push({ t: 1, kind: "boss", variant });
      Music.play("boss");
      this.audio.alarm();
    } else {
      const count = 4 + Math.floor(this.wave * 1.5);
      for (let i = 0; i < count; i++) {
        const r = this.rand();
        const kind: Enemy["kind"] = r < 0.65 ? "ufo" : r < 0.85 ? "bomber" : "mother";
        this.spawnQueue.push({ t: i * 0.8 + 0.5, kind, y: 40 + this.rand() * (VH - 80) });
      }
      Music.play("battle");
      if (prevWave > 0) this.audio.waveClear();
    }
    this.waveTimer = 0;
    this.floats.push({
      x: VW / 2 - 30,
      y: VH / 2 - 20,
      vy: -0.2,
      life: 90,
      text: isBoss
        ? `${t().bossWave} ${this.wave} — LVL ${level}`
        : `${t().wave} ${this.wave} — LVL ${level}`,
      color: P().hudAccent,
    });
  }

  getLevel() {
    return Math.floor((this.wave - 1) / 5) + 1;
  }

  spawnEnemy(kind: Enemy["kind"], y?: number, variant?: BossVariant) {
    const level = this.getLevel();
    const yy = y ?? 40 + this.rand() * (VH - 80);
    const netId = this.nextEnemyId++;
    if (kind === "ufo") {
      this.enemies.push({
        netId,
        pos: { x: VW + 20, y: yy },
        vel: { x: -(1.0 + this.rand() * 0.7), y: 0 },
        w: 23,
        h: 13,
        alive: true,
        kind,
        hp: 1,
        maxHp: 1,
        shootCool: 60 + this.rand() * 60,
        age: 0,
        baseY: yy,
        amp: 20 + this.rand() * 20,
        level,
      });
    } else if (kind === "bomber") {
      this.enemies.push({
        netId,
        pos: { x: VW + 20, y: 40 + this.rand() * 60 },
        vel: { x: -0.6, y: 0 },
        w: 29,
        h: 16,
        alive: true,
        kind,
        hp: 2,
        maxHp: 2,
        shootCool: 90,
        age: 0,
        baseY: 0,
        amp: 0,
        level,
      });
    } else if (kind === "mother") {
      this.enemies.push({
        netId,
        pos: { x: VW + 30, y: yy },
        vel: { x: -0.42, y: 0 },
        w: 42,
        h: 21,
        alive: true,
        kind,
        hp: 5,
        maxHp: 5,
        shootCool: 70,
        age: 0,
        baseY: yy,
        amp: 10,
        level,
      });
    } else {
      const hp = 40 + this.wave * 5;
      this.enemies.push({
        netId,
        pos: { x: VW + 50, y: VH / 2 },
        vel: { x: -0.25, y: 0 },
        w: 78,
        h: 47,
        alive: true,
        kind,
        hp,
        maxHp: hp,
        shootCool: 40,
        age: 0,
        baseY: VH / 2,
        amp: 40,
        variant: variant ?? "saucer",
        level,
      });
    }
  }

  setKey(k: string, down: boolean) {
    const key = k.toLowerCase();
    if (key === "arrowup" || key === "w") this.input.up = down;
    else if (key === "arrowdown" || key === "s") this.input.down = down;
    else if (key === "arrowleft" || key === "a") this.input.left = down;
    else if (key === "arrowright" || key === "d") this.input.right = down;
    else if (key === " " || key === "spacebar") this.input.mg = down;
    else if (key === "j") this.input.laser = down;
    else if (key === "k") this.input.bomb = down;
    else if (key === "b") this.input.abomb = down;
    else if (key === "q") this.input.trickL = down;
    else if (key === "e") this.input.trickR = down;
    else if ((key === "p" || key === "escape") && down) {
      this.paused = !this.paused;
      this.emitStats();
    }

    if (this.mode === "coop" && !this.coop?.isHost) {
      this.coop?.onInputRelay?.(this.localId, { ...this.input });
    }
  }

  setRemoteInput(playerId: string, input: Input) {
    this.remoteInputs.set(playerId, input);
  }

  nearestLivingPlayer(ex: number, ey: number): Player | null {
    let best: Player | null = null;
    let bestD = Infinity;
    for (const p of this.players.values()) {
      if (p.lives <= 0) continue;
      const d = Math.hypot(p.pos.x - ex, p.pos.y - ey);
      if (d < bestD) {
        bestD = d;
        best = p;
      }
    }
    return best;
  }

  allPlayersDead(): boolean {
    for (const p of this.players.values()) {
      if (p.lives > 0) return false;
    }
    return true;
  }

  step(dt: number) {
    if (this.paused || this.gameOver) {
      this.draw();
      return;
    }

    if (!this.simulating) {
      this.time += dt;
      this.draw();
      this.emitStats();
      return;
    }

    this.tick += 1;
    this.time += dt;

    if (this.mode === "coop" && this.coop?.isHost) {
      for (const [pid, input] of this.remoteInputs) {
        if (pid !== this.localId) this.updatePlayer(dt, pid, input);
      }
    }
    this.updatePlayer(dt, this.localId, this.input);

    this.updateEnemies(dt);
    this.updateProjectiles(dt);
    this.updateParticles(dt);
    this.updateFloats(dt);
    this.updateSpawner(dt);
    this.updateCombo(dt);
    if (this.shake > 0) this.shake = Math.max(0, this.shake - dt * 60);
    this.draw();
    this.emitStats();

    if (this.mode === "coop" && this.coop?.isHost) {
      this.snapshotInterval += dt;
      if (this.snapshotInterval >= 1 / 15) {
        this.snapshotInterval = 0;
        this.coop.onSnapshot?.(this.exportSnapshot());
      }
    }
  }

  updateCombo(dt: number) {
    if (this.comboTimer > 0) {
      this.comboTimer -= dt;
      if (this.comboTimer <= 0) this.comboCount = 0;
    }
  }

  registerKill(e: Enemy, longShot: boolean, killerId?: string) {
    this.kills++;
    if (this.kills === 1) unlock("first_kill");
    const baseScore =
      e.kind === "ufo" ? 100 : e.kind === "bomber" ? 150 : e.kind === "mother" ? 300 : 2000;
    this.score += baseScore;
    if (this.score >= 10000) unlock("score_10k");
    this.comboCount++;
    this.comboTimer = 2;
    if (this.comboCount >= 5) unlock("combo_5");
    if (this.comboCount >= 10) unlock("combo_10");
    if (this.comboCount >= 3) {
      this.addMana(15, e.pos.x, e.pos.y - 8, `${t().combo} x${this.comboCount}`, killerId);
    }
    if (longShot) {
      this.addMana(8, e.pos.x, e.pos.y - 16, t().precision, killerId);
    }
    this.explode(e.pos.x, e.pos.y, e.kind === "boss" ? 40 : 14);
    this.shake = e.kind === "boss" ? 14 : 4;
    if (e.kind === "boss") {
      unlock("boss_down");
      this.bossesKilled++;
      const kp = this.players.get(killerId ?? this.localId);
      if (kp) {
        kp.lives++;
        this.floats.push({
          x: e.pos.x - 16,
          y: e.pos.y - 20,
          vy: -0.3,
          life: 80,
          text: t().plusLife,
          color: "#7cffb0",
        });
      }
      this.audio.powerup();
      Music.play("battle");
    }
    this.audio.boom();
  }

  addMana(amount: number, x: number, y: number, label: string, playerId?: string) {
    const p = this.players.get(playerId ?? this.localId);
    if (!p) return;
    p.mana += amount;
    this.floats.push({ x, y, vy: -0.4, life: 60, text: `${label} +${amount}`, color: "#7cf0ff" });
    this.audio.ding();
    if (p.mana >= p.maxMana) {
      p.mana = 0;
      p.lives++;
      this.floats.push({
        x: p.pos.x - 18,
        y: p.pos.y - 18,
        vy: -0.4,
        life: 80,
        text: t().plusLife,
        color: "#7cffb0",
      });
      this.audio.powerup();
    }
  }

  pushProjectile(pr: Omit<Projectile, "netId" | "alive">) {
    this.projectiles.push({ ...pr, netId: this.nextProjectileId++, alive: true });
  }

  updatePlayer(dt: number, playerId: string, inp: Input) {
    const p = this.players.get(playerId);
    if (!p || p.lives <= 0) return;
    const speed = 1.87;
    p.vel.x = (inp.right ? 1 : 0) - (inp.left ? 1 : 0);
    p.vel.y = (inp.down ? 1 : 0) - (inp.up ? 1 : 0);
    p.pos.x += p.vel.x * speed;
    p.pos.y += p.vel.y * speed * 0.9;
    p.pos.x = Math.max(10, Math.min(VW - 36, p.pos.x));
    p.pos.y = Math.max(15, Math.min(VH - 32, p.pos.y));

    // Trick: barrel roll / loop
    if ((inp.trickL || inp.trickR) && !p.spinning) {
      p.spinning = true;
      p.spinAccum = 0;
      p.spinDir = inp.trickR ? 1 : -1;
      if (playerId === this.localId) this.audio.whoosh();
    }
    if (p.spinning) {
      const spd = 0.21;
      p.rotation += spd * p.spinDir;
      p.spinAccum += spd;
      if (p.spinAccum >= Math.PI * 2) {
        p.spinning = false;
        p.rotation = 0;
        this.addMana(10, p.pos.x, p.pos.y - 16, t().barrelRoll, playerId);
      }
    }

    if (p.invuln > 0) p.invuln -= dt * 60;
    if (p.mgCool > 0) p.mgCool -= dt * 60;
    if (p.laserCool > 0) p.laserCool -= dt * 60;
    if (p.bombCool > 0) p.bombCool -= dt * 60;

    // Fire weapons
    if (inp.mg && p.mgCool <= 0) {
      this.pushProjectile({
        pos: { x: p.pos.x + 22, y: p.pos.y + 1 },
        vel: { x: 5.1, y: 0 },
        w: 5,
        h: 2,
        damage: 1,
        fromPlayerId: playerId,
        kind: "bullet",
        life: 80,
      });
      p.mgCool = 6;
      if (playerId === this.localId) this.audio.shoot();
    }
    if (inp.laser && p.laserCool <= 0 && p.mana >= 8) {
      p.mana -= 8;
      this.pushProjectile({
        pos: { x: p.pos.x + 22, y: p.pos.y + 1 },
        vel: { x: 7.65, y: 0 },
        w: 30,
        h: 3,
        damage: 5,
        fromPlayerId: playerId,
        kind: "laser",
        life: 60,
      });
      p.laserCool = 18;
      if (playerId === this.localId) this.audio.laser();
    }
    if (inp.bomb && p.bombCool <= 0) {
      this.pushProjectile({
        pos: { x: p.pos.x + 10, y: p.pos.y + 6 },
        vel: { x: 1.7, y: 1.27 },
        w: 6,
        h: 8,
        damage: 30,
        fromPlayerId: playerId,
        kind: "bomb",
        life: 200,
      });
      p.bombCool = 30;
      if (playerId === this.localId) this.audio.drop();
    }
    if (inp.abomb && p.mana >= 50 && playerId === this.localId) {
      p.mana -= 50;
      this.input.abomb = false;
      this.shake = 22;
      this.audio.aBomb();
      this.abombsThisRun++;
      bumpAbomb();
      this.floats.push({
        x: VW / 2 - 30,
        y: VH / 2 - 12,
        vy: -0.3,
        life: 70,
        text: t().aBomb,
        color: "#ffd84d",
      });
      for (let i = 0; i < 14; i++) {
        this.explode(40 + this.rand() * (VW - 80), 20 + this.rand() * (VH - 60), 18);
      }
      for (const e of this.enemies) {
        if (!e.alive) continue;
        if (e.pos.x < VW + 10 && e.pos.x > -10) {
          if (e.kind === "boss") {
            e.hp -= 25;
            this.explode(e.pos.x, e.pos.y, 30);
            if (e.hp <= 0) {
              e.alive = false;
              this.registerKill(e, false, playerId);
            }
          } else {
            e.alive = false;
            this.registerKill(e, false, playerId);
          }
        }
      }
      for (const pr of this.projectiles) {
        if (pr.fromPlayerId === null) pr.alive = false;
      }
    }

    // Near-miss detection (local player only for achievements)
    if (playerId !== this.localId) return;
    for (const e of this.enemies) {
      if (!e.alive) continue;
      const dx = e.pos.x - p.pos.x;
      const dy = e.pos.y - p.pos.y;
      const d = Math.hypot(dx, dy);
      const tagged = (e as unknown as { _nearMissed?: number })._nearMissed;
      if (d < 26 && d > 16 && !tagged && e.pos.x < p.pos.x + 30) {
        (e as unknown as { _nearMissed?: number })._nearMissed = this.time;
        this.addMana(5, p.pos.x + 10, p.pos.y - 14, t().nearMiss, playerId);
      }
    }
    for (const pr of this.projectiles) {
      if (pr.fromPlayerId !== null || !pr.alive) continue;
      const dx = pr.pos.x - p.pos.x;
      const dy = pr.pos.y - p.pos.y;
      const d = Math.hypot(dx, dy);
      const tagged = (pr as unknown as { _nearMissed?: boolean })._nearMissed;
      if (d < 18 && d > 10 && !tagged) {
        (pr as unknown as { _nearMissed?: boolean })._nearMissed = true;
        this.addMana(5, p.pos.x, p.pos.y - 14, t().dodge, playerId);
      }
    }
  }

  updateEnemies(dt: number) {
    for (const e of this.enemies) {
      if (!e.alive) continue;
      e.age += dt;
      e.pos.x += e.vel.x;
      if (e.kind === "ufo") {
        e.pos.y = e.baseY + Math.sin(e.age * 3) * e.amp;
      } else if (e.kind === "boss") {
        e.pos.y = e.baseY + Math.sin(e.age * 1.2) * e.amp;
        if (e.pos.x > VW - 80) {
          // come into view
        } else {
          e.vel.x = 0;
        }
      }
      e.shootCool -= dt * 60;
      if (e.shootCool <= 0 && e.pos.x < VW) {
        if (e.kind === "bomber") {
          this.pushProjectile({
            pos: { x: e.pos.x, y: e.pos.y + 8 },
            vel: { x: -0.42, y: 1.27 },
            w: 5,
            h: 7,
            damage: 1,
            fromPlayerId: null,
            kind: "bomb",
            life: 200,
          });
          e.shootCool = 90;
        } else {
          const target = this.nearestLivingPlayer(e.pos.x, e.pos.y);
          if (!target) continue;
          const px = target.pos.x;
          const py = target.pos.y;
          const dx = px - e.pos.x;
          const dy = py - e.pos.y;
          const d = Math.hypot(dx, dy) || 1;
          const sp = e.kind === "boss" ? 2.55 : 2.04;
          this.pushProjectile({
            pos: { x: e.pos.x, y: e.pos.y },
            vel: { x: (dx / d) * sp, y: (dy / d) * sp },
            w: 6,
            h: 6,
            damage: 1,
            fromPlayerId: null,
            kind: "plasma",
            life: 180,
          });
          e.shootCool = e.kind === "boss" ? 28 : 100;
          this.audio.zap();
        }
      }
      if (e.pos.x < -40) e.alive = false;
    }
    this.enemies = this.enemies.filter((e) => e.alive);
  }

  updateProjectiles(dt: number) {
    for (const pr of this.projectiles) {
      if (!pr.alive) continue;
      pr.pos.x += pr.vel.x;
      pr.pos.y += pr.vel.y;
      if (pr.kind === "bomb") pr.vel.y += 0.08;
      pr.life -= dt * 60;
      if (pr.life <= 0 || pr.pos.x < -20 || pr.pos.x > VW + 20 || pr.pos.y > VH || pr.pos.y < -20) {
        if (pr.kind === "bomb" && pr.fromPlayerId !== null) this.explode(pr.pos.x, pr.pos.y, 30);
        pr.alive = false;
        continue;
      }
      if (pr.fromPlayerId !== null) {
        const shooter = this.players.get(pr.fromPlayerId);
        for (const e of this.enemies) {
          if (!e.alive) continue;
          if (rectsHit(pr, e)) {
            e.hp -= pr.damage;
            this.particles.push({
              x: pr.pos.x,
              y: pr.pos.y,
              vx: -1,
              vy: (Math.random() - 0.5) * 2,
              life: 10,
              maxLife: 10,
              color: "#ffd84d",
              size: 2,
            });
            if (pr.kind !== "laser") pr.alive = false;
            if (e.hp <= 0) {
              e.alive = false;
              const longShot = shooter ? pr.pos.x - shooter.pos.x > 200 : false;
              this.registerKill(e, longShot, pr.fromPlayerId);
            }
            if (pr.kind === "bomb") this.explode(pr.pos.x, pr.pos.y, 30);
            break;
          }
        }
      } else {
        for (const p of this.players.values()) {
          if (p.lives <= 0 || p.invuln > 0) continue;
          if (rectsHit(pr, { pos: { x: p.pos.x, y: p.pos.y }, w: p.w, h: p.h } as Entity)) {
            pr.alive = false;
            this.hitPlayer(p.playerId);
            break;
          }
        }
      }
    }
    for (const p of this.players.values()) {
      if (p.lives <= 0 || p.invuln > 0) continue;
      for (const e of this.enemies) {
        if (!e.alive) continue;
        if (rectsHit({ pos: p.pos, w: p.w, h: p.h } as Entity, e)) {
          this.hitPlayer(p.playerId);
          e.hp -= 5;
          if (e.hp <= 0) {
            e.alive = false;
            this.registerKill(e, false, p.playerId);
          }
          break;
        }
      }
    }
    this.projectiles = this.projectiles.filter((pr) => pr.alive);
  }

  hitPlayer(playerId: string) {
    const p = this.players.get(playerId);
    if (!p) return;
    // MANA SHIELD: absorb the hit if enough mana
    if (p.mana >= SHIELD_COST) {
      p.mana -= SHIELD_COST;
      p.invuln = 60;
      this.shake = 6;
      this.floats.push({
        x: p.pos.x - 10,
        y: p.pos.y - 16,
        vy: -0.4,
        life: 60,
        text: t().shield,
        color: "#7cf0ff",
      });
      this.audio.ding();
      unlock("shield_save");
      return;
    }
    this.hitsThisWave++;
    p.lives--;
    p.invuln = 90;
    this.shake = 10;
    this.explode(p.pos.x + 10, p.pos.y + 4, 18);
    this.audio.hurt();
    if (p.lives <= 0) {
      const shouldEnd = this.mode === "coop" ? this.allPlayersDead() : true;
      if (shouldEnd) {
        this.gameOver = true;
        this.audio.gameOver();
        Music.stop();
        if (!this.runRecorded) {
          this.runRecorded = true;
          recordRun({
            kills: this.kills,
            waves: Math.max(0, this.wave - 1),
            level: this.getLevel(),
            bosses: this.bossesKilled,
            abombs: this.abombsThisRun,
            playtime: this.time,
            score: this.score,
          });
        }
      }
    }
  }

  explode(x: number, y: number, count: number) {
    const colors = P().particles;
    for (let i = 0; i < count; i++) {
      const a = Math.random() * Math.PI * 2;
      const s = 0.5 + Math.random() * 2.5;
      this.particles.push({
        x,
        y,
        vx: Math.cos(a) * s,
        vy: Math.sin(a) * s,
        life: 20 + Math.random() * 20,
        maxLife: 30,
        color: colors[Math.floor(Math.random() * colors.length)],
        size: 1 + Math.random() * 2,
      });
    }
  }

  updateParticles(dt: number) {
    for (const p of this.particles) {
      p.x += p.vx;
      p.y += p.vy;
      p.vy += 0.05;
      p.life -= dt * 60;
    }
    this.particles = this.particles.filter((p) => p.life > 0);
  }

  updateFloats(dt: number) {
    for (const f of this.floats) {
      f.y += f.vy;
      f.life -= dt * 60;
    }
    this.floats = this.floats.filter((f) => f.life > 0);
  }

  updateSpawner(dt: number) {
    this.waveTimer += dt;
    while (this.spawnQueue.length && this.spawnQueue[0].t <= this.waveTimer) {
      const s = this.spawnQueue.shift()!;
      this.spawnEnemy(s.kind, s.y, s.variant);
    }
    if (this.spawnQueue.length === 0 && this.enemies.length === 0) {
      this.startNextWave();
    }
    for (const st of this.stars) {
      st.x -= st.z * 1.5;
      if (st.x < 0) {
        st.x += VW;
        st.y = this.rand() * VH;
      }
    }
    for (const m of this.mountains) {
      m.x -= 0.3;
      if (m.x < -60) {
        m.x += 60 * this.mountains.length;
        m.h = 30 + this.rand() * 40;
      }
    }
  }

  exportSnapshot(): Snapshot {
    return {
      tick: this.tick,
      wave: this.wave,
      score: this.score,
      kills: this.kills,
      gameOver: this.gameOver,
      players: [...this.players.values()].map((p) => ({
        id: p.playerId,
        name: p.displayName,
        x: p.pos.x,
        y: p.pos.y,
        rot: p.rotation,
        lives: p.lives,
        mana: Math.floor(p.mana),
        invuln: p.invuln,
      })),
      enemies: this.enemies
        .filter((e) => e.alive)
        .map((e) => ({
          id: e.netId,
          kind: e.kind,
          x: e.pos.x,
          y: e.pos.y,
          hp: e.hp,
          maxHp: e.maxHp,
          variant: e.variant,
        })),
      projectiles: this.projectiles
        .filter((p) => p.alive)
        .map((p) => ({
          id: p.netId,
          x: p.pos.x,
          y: p.pos.y,
          kind: p.kind,
          fromPlayerId: p.fromPlayerId,
        })),
    };
  }

  applySnapshot(snap: Snapshot) {
    this.tick = snap.tick;
    this.wave = snap.wave;
    this.score = snap.score;
    this.kills = snap.kills;
    this.gameOver = snap.gameOver;

    for (const ps of snap.players) {
      let p = this.players.get(ps.id);
      if (!p) {
        this.addCoopPlayer(ps.id, ps.name ?? "PILOT", this.players.size);
        p = this.players.get(ps.id);
      }
      if (!p) continue;
      p.pos.x = ps.x;
      p.pos.y = ps.y;
      p.rotation = ps.rot;
      p.lives = ps.lives;
      p.mana = ps.mana;
      p.invuln = ps.invuln;
      if (ps.name) p.displayName = ps.name;
    }

    this.enemies = snap.enemies.map((e) => ({
      netId: e.id,
      pos: { x: e.x, y: e.y },
      vel: { x: -1, y: 0 },
      w: e.kind === "boss" ? 78 : e.kind === "mother" ? 42 : 23,
      h: e.kind === "boss" ? 47 : e.kind === "mother" ? 21 : 13,
      alive: true,
      kind: e.kind as Enemy["kind"],
      hp: e.hp,
      maxHp: e.maxHp,
      shootCool: 60,
      age: 0,
      baseY: e.y,
      amp: 20,
      variant: e.variant as BossVariant | undefined,
      level: this.getLevel(),
    }));

    this.projectiles = snap.projectiles.map((p) => ({
      netId: p.id,
      pos: { x: p.x, y: p.y },
      vel: { x: p.fromPlayerId ? 5 : -2, y: 0 },
      w: 6,
      h: 6,
      alive: true,
      damage: 1,
      fromPlayerId: p.fromPlayerId,
      kind: p.kind as Projectile["kind"],
      life: 60,
    }));

    this.nextEnemyId = Math.max(this.nextEnemyId, ...snap.enemies.map((e) => e.id), 0) + 1;
    this.nextProjectileId =
      Math.max(this.nextProjectileId, ...snap.projectiles.map((p) => p.id), 0) + 1;
  }

  draw() {
    const ctx = this.ctx;
    const pal = P();
    const sx = (Math.random() - 0.5) * this.shake;
    const sy = (Math.random() - 0.5) * this.shake;
    ctx.save();
    ctx.translate(sx, sy);
    // Sky gradient
    const g = ctx.createLinearGradient(0, 0, 0, VH);
    g.addColorStop(0, pal.skyTop);
    g.addColorStop(0.6, pal.skyMid);
    g.addColorStop(1, pal.skyBot);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, VW, VH);
    // Stars
    for (const st of this.stars) {
      ctx.fillStyle = pal.star(st.z);
      ctx.fillRect(Math.floor(st.x), Math.floor(st.y), 1, 1);
    }
    // Sun
    ctx.fillStyle = pal.sun;
    ctx.beginPath();
    ctx.arc(VW - 80, VH - 80, 40, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = pal.bg;
    for (let i = 0; i < 5; i++) ctx.fillRect(VW - 130, VH - 70 + i * 8, 100, 3);
    // Mountains
    ctx.fillStyle = pal.mountain;
    for (const m of this.mountains) {
      ctx.beginPath();
      ctx.moveTo(m.x, VH - 40);
      ctx.lineTo(m.x + 30, VH - 40 - m.h);
      ctx.lineTo(m.x + 60, VH - 40);
      ctx.closePath();
      ctx.fill();
    }
    // Ground line
    ctx.fillStyle = pal.ground;
    ctx.fillRect(0, VH - 40, VW, 1);
    for (let i = 0; i < 8; i++) {
      ctx.fillRect(0, VH - 40 + i * 5 + 2, VW, 1);
    }
    // Grid lines
    ctx.strokeStyle = pal.ground;
    ctx.lineWidth = 0.5;
    for (let i = 0; i < 10; i++) {
      const y = VH - 40 + i * 4;
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(VW, y);
      ctx.stroke();
    }

    // Projectiles (enemy)
    for (const pr of this.projectiles) {
      if (pr.fromPlayerId !== null) continue;
      if (pr.kind === "plasma") {
        ctx.fillStyle = pal.plasma;
        ctx.fillRect(Math.floor(pr.pos.x - 3), Math.floor(pr.pos.y - 3), 6, 6);
        ctx.fillStyle = pal.laserCore;
        ctx.fillRect(Math.floor(pr.pos.x - 1), Math.floor(pr.pos.y - 1), 2, 2);
      } else if (pr.kind === "bomb") {
        ctx.fillStyle = pal.bombGray;
        ctx.fillRect(Math.floor(pr.pos.x - 2), Math.floor(pr.pos.y - 3), 4, 6);
      }
    }
    // Enemies
    for (const e of this.enemies) this.drawEnemy(e);
    // Player projectiles
    for (const pr of this.projectiles) {
      if (pr.fromPlayerId === null) continue;
      if (pr.kind === "bullet") {
        ctx.fillStyle = pal.bullet;
        ctx.fillRect(Math.floor(pr.pos.x), Math.floor(pr.pos.y), 5, 2);
      } else if (pr.kind === "laser") {
        ctx.fillStyle = pal.laserMain;
        ctx.fillRect(Math.floor(pr.pos.x), Math.floor(pr.pos.y - 1), 30, 3);
        ctx.fillStyle = pal.laserCore;
        ctx.fillRect(Math.floor(pr.pos.x), Math.floor(pr.pos.y), 30, 1);
      } else if (pr.kind === "bomb") {
        ctx.fillStyle = pal.bombShell;
        ctx.fillRect(Math.floor(pr.pos.x - 2), Math.floor(pr.pos.y - 3), 5, 7);
        ctx.fillStyle = pal.bombFin;
        ctx.fillRect(Math.floor(pr.pos.x), Math.floor(pr.pos.y - 4), 1, 2);
      }
    }
    // Players
    for (const pl of this.players.values()) {
      this.drawPlayer(pl, pl.playerId === this.localId);
    }
    // Particles
    for (const p of this.particles) {
      const a = p.life / p.maxLife;
      ctx.fillStyle = p.color;
      ctx.globalAlpha = Math.max(0, Math.min(1, a));
      ctx.fillRect(Math.floor(p.x), Math.floor(p.y), p.size, p.size);
    }
    ctx.globalAlpha = 1;
    // Floating text
    ctx.font = "bold 9px monospace";
    for (const f of this.floats) {
      ctx.fillStyle = f.color;
      ctx.fillText(f.text, f.x, f.y);
    }
    ctx.restore();

    // Scanlines
    ctx.fillStyle = pal.scanline;
    for (let y = 0; y < VH; y += 2) ctx.fillRect(0, y, VW, 1);

    if (this.gameOver) {
      ctx.fillStyle = pal.overlayDark;
      ctx.fillRect(0, 0, VW, VH);
      ctx.fillStyle = pal.gameOver;
      ctx.font = "bold 28px monospace";
      ctx.textAlign = "center";
      ctx.fillText(t().gameOver, VW / 2, VH / 2 - 10);
      ctx.fillStyle = pal.gameOverSub;
      ctx.font = "12px monospace";
      ctx.fillText(`${t().score} ${this.score}  ${t().wave} ${this.wave}`, VW / 2, VH / 2 + 10);
      ctx.fillText(t().pressRestart, VW / 2, VH / 2 + 26);
      ctx.textAlign = "left";
    }
    if (this.paused && !this.gameOver) {
      ctx.fillStyle = pal.overlayLight;
      ctx.fillRect(0, 0, VW, VH);
      ctx.fillStyle = pal.pause;
      ctx.font = "bold 23px monospace";
      ctx.textAlign = "center";
      ctx.fillText(t().paused, VW / 2, VH / 2);
      ctx.textAlign = "left";
    }
  }

  drawPlayer(p: Player, isLocal: boolean) {
    const ctx = this.ctx;
    const pal = P();
    if (p.lives <= 0) return;
    if (p.invuln > 0 && Math.floor(p.invuln / 4) % 2 === 0) return;
    ctx.save();
    ctx.translate(p.pos.x + 16, p.pos.y + 7);
    ctx.rotate(p.rotation);
    ctx.scale(ENT_SCALE, ENT_SCALE);
    ctx.fillStyle = isLocal ? pal.playerBody : pal.playerWing;
    ctx.fillRect(-12, -2, 22, 4);
    ctx.fillStyle = isLocal ? pal.playerWing : pal.playerTail;
    ctx.fillRect(-4, -6, 8, 12);
    ctx.fillStyle = pal.playerTail;
    ctx.fillRect(-10, -4, 3, 8);
    ctx.fillStyle = pal.playerNose;
    ctx.fillRect(8, -1, 3, 2);
    ctx.fillStyle = pal.playerCockpit;
    ctx.fillRect(2, -1, 3, 2);
    ctx.fillStyle = pal.exhaust1;
    ctx.fillRect(-15, -1, 3, 2);
    ctx.fillStyle = pal.exhaust2;
    ctx.fillRect(-18, -1, 3, 2);
    ctx.restore();
    if (p.displayName && this.mode === "coop") {
      ctx.font = "bold 7px monospace";
      ctx.fillStyle = isLocal ? pal.hudAccent : pal.laserCore;
      ctx.fillText(p.displayName.slice(0, 8), p.pos.x, p.pos.y - 4);
    }
  }

  drawEnemy(e: Enemy) {
    const ctx = this.ctx;
    const pal = P();
    ctx.save();
    ctx.translate(Math.floor(e.pos.x), Math.floor(e.pos.y));
    ctx.scale(ENT_SCALE, ENT_SCALE);
    if (e.kind === "ufo") {
      ctx.fillStyle = pal.ufoTop;
      ctx.fillRect(-9, -1, 18, 3);
      ctx.fillStyle = pal.ufoBot;
      ctx.fillRect(-9, 2, 18, 2);
      ctx.fillStyle = pal.ufoDome;
      ctx.fillRect(-4, -4, 8, 3);
      ctx.fillStyle = pal.laserCore;
      ctx.fillRect(-2, -3, 2, 1);
      if (Math.floor(e.age * 6) % 2) {
        ctx.fillStyle = pal.ufoLight;
        ctx.fillRect(-7, 4, 2, 1);
        ctx.fillRect(5, 4, 2, 1);
      }
    } else if (e.kind === "bomber") {
      ctx.fillStyle = pal.bomberTop;
      ctx.fillRect(-11, -2, 22, 5);
      ctx.fillStyle = pal.bomberBot;
      ctx.fillRect(-11, 3, 22, 3);
      ctx.fillStyle = pal.bomberLight;
      ctx.fillRect(-8, 6, 2, 1);
      ctx.fillRect(6, 6, 2, 1);
    } else if (e.kind === "mother") {
      ctx.fillStyle = pal.motherTop;
      ctx.fillRect(-16, -2, 32, 6);
      ctx.fillStyle = pal.motherBot;
      ctx.fillRect(-16, 4, 32, 4);
      ctx.fillStyle = pal.motherDome;
      ctx.fillRect(-8, -6, 16, 4);
      ctx.fillStyle = pal.motherLight;
      const tt = Math.floor(e.age * 4) % 4;
      for (let i = 0; i < 4; i++) {
        ctx.globalAlpha = i === tt ? 1 : 0.4;
        ctx.fillRect(-12 + i * 8, 8, 2, 1);
      }
      ctx.globalAlpha = 1;
    } else if (e.kind === "boss") {
      this.drawBoss(e);
    }
    // Level-based tint overlay (cosmetic) for non-boss enemies
    if (e.kind !== "boss") {
      const tints = pal.levelTints;
      const lvl = (e.level ?? 1) - 1;
      if (tints && tints.length && lvl > 0) {
        const tint = tints[lvl % tints.length];
        ctx.globalCompositeOperation = "source-atop";
        ctx.globalAlpha = 0.35;
        ctx.fillStyle = tint;
        ctx.fillRect(-22, -8, 44, 22);
        ctx.globalAlpha = 1;
        ctx.globalCompositeOperation = "source-over";
      }
    }
    ctx.restore();
  }

  drawBoss(e: Enemy) {
    const ctx = this.ctx;
    const pal = P();
    const v: BossVariant = e.variant ?? "saucer";
    const hpFrac = e.hp / e.maxHp;
    // HP bar (common)
    const renderHp = () => {
      ctx.globalAlpha = 1;
      ctx.fillStyle = "#000";
      ctx.fillRect(-30, -26, 60, 3);
      ctx.fillStyle = pal.bossHp;
      ctx.fillRect(-30, -26, Math.floor(60 * hpFrac), 3);
    };
    if (v === "saucer") {
      ctx.fillStyle = pal.bossTop;
      ctx.fillRect(-30, -8, 60, 16);
      ctx.fillStyle = pal.bossBot;
      ctx.fillRect(-30, 8, 60, 8);
      ctx.fillStyle = pal.bossDome;
      ctx.fillRect(-16, -14, 32, 6);
      ctx.fillStyle = pal.laserCore;
      ctx.fillRect(-12, -12, 4, 2);
      ctx.fillRect(8, -12, 4, 2);
      ctx.fillStyle = pal.bossLight;
      for (let i = 0; i < 6; i++) {
        const on = Math.floor(e.age * 8 + i) % 2 === 0;
        ctx.globalAlpha = on ? 1 : 0.3;
        ctx.fillRect(-24 + i * 10, 16, 3, 2);
      }
    } else if (v === "insect") {
      // Segmented body
      ctx.fillStyle = pal.bossBot;
      for (let i = -2; i <= 2; i++) ctx.fillRect(i * 10 - 4, -6, 8, 12);
      ctx.fillStyle = pal.bossTop;
      ctx.fillRect(-30, -2, 60, 4);
      // Wings flap
      const flap = Math.sin(e.age * 10) * 4;
      ctx.fillStyle = pal.bossDome;
      ctx.globalAlpha = 0.7;
      ctx.fillRect(-18, -16 - flap, 16, 6);
      ctx.fillRect(2, -16 - flap, 16, 6);
      ctx.globalAlpha = 1;
      // Head + mandibles + eyes
      ctx.fillStyle = pal.bossTop;
      ctx.fillRect(22, -6, 12, 12);
      ctx.fillStyle = pal.laserCore;
      ctx.fillRect(26, -4, 3, 3);
      ctx.fillRect(26, 1, 3, 3);
      ctx.fillStyle = pal.bossLight;
      ctx.fillRect(34, -7, 3, 2);
      ctx.fillRect(34, 5, 3, 2);
      // Antennae
      ctx.fillStyle = pal.bossLight;
      ctx.fillRect(28, -12, 1, 4);
      ctx.fillRect(32, -12, 1, 4);
    } else if (v === "monster") {
      // Lumpy bulb body
      ctx.fillStyle = pal.bossBot;
      ctx.fillRect(-26, -10, 52, 22);
      ctx.fillStyle = pal.bossTop;
      ctx.fillRect(-22, -14, 44, 8);
      // Spikes on top
      ctx.fillStyle = pal.bossDome;
      for (let i = 0; i < 6; i++) ctx.fillRect(-20 + i * 8, -18, 3, 4);
      // Big eyes
      ctx.fillStyle = pal.laserCore;
      ctx.fillRect(-14, -4, 6, 6);
      ctx.fillRect(8, -4, 6, 6);
      ctx.fillStyle = "#000";
      const blink = Math.floor(e.age * 2) % 8 === 0 ? 1 : 0;
      ctx.fillRect(-12, -2 + blink, 2, 2);
      ctx.fillRect(10, -2 + blink, 2, 2);
      // Jagged teeth
      ctx.fillStyle = pal.bossLight;
      for (let i = 0; i < 8; i++) {
        const x = -22 + i * 6;
        ctx.fillRect(x, 8, 2, 3 + (i % 2) * 2);
      }
    } else if (v === "spectre") {
      // Wispy ghost — translucent
      ctx.globalAlpha = 0.55 + Math.sin(e.age * 4) * 0.1;
      ctx.fillStyle = pal.bossTop;
      ctx.fillRect(-24, -12, 48, 22);
      ctx.fillStyle = pal.bossBot;
      // Tattered bottom
      for (let i = 0; i < 8; i++) {
        const h = 4 + (i % 2) * 4 + Math.floor(Math.sin(e.age * 3 + i) * 2);
        ctx.fillRect(-24 + i * 6, 10, 5, h);
      }
      // Hollow eyes (glowing)
      ctx.globalAlpha = 1;
      ctx.fillStyle = pal.bossDome;
      ctx.fillRect(-12, -6, 6, 6);
      ctx.fillRect(6, -6, 6, 6);
      ctx.fillStyle = pal.laserCore;
      ctx.fillRect(-10, -4, 2, 2);
      ctx.fillRect(8, -4, 2, 2);
      // Crown halo
      ctx.fillStyle = pal.bossLight;
      ctx.globalAlpha = 0.7;
      for (let i = 0; i < 9; i++) ctx.fillRect(-20 + i * 5, -16, 2, 3);
    }
    renderHp();
  }
}

function rectsHit(a: { pos: Vec; w: number; h: number }, b: { pos: Vec; w: number; h: number }) {
  return (
    a.pos.x < b.pos.x + b.w / 2 + a.w / 2 &&
    a.pos.x + a.w / 2 > b.pos.x - b.w / 2 &&
    a.pos.y < b.pos.y + b.h / 2 + a.h / 2 &&
    a.pos.y + a.h / 2 > b.pos.y - b.h / 2
  );
}

// Web Audio chiptune — routed through Music's sfx gain for volume control
class AudioCtx {
  ensure(): AudioContext | null {
    return Music.ensure();
  }
  private dest(): AudioNode | null {
    const ac = this.ensure();
    if (!ac) return null;
    return Music.getSfxNode() ?? ac.destination;
  }
  beep(freq: number, dur: number, type: OscillatorType = "square", vol = 0.05) {
    const ac = this.ensure();
    const d = this.dest();
    if (!ac || !d) return;
    const o = ac.createOscillator();
    const g = ac.createGain();
    o.type = type;
    o.frequency.value = freq;
    g.gain.value = vol;
    o.connect(g);
    g.connect(d);
    o.start();
    g.gain.exponentialRampToValueAtTime(0.0001, ac.currentTime + dur);
    o.stop(ac.currentTime + dur);
  }
  sweep(f0: number, f1: number, dur: number, type: OscillatorType = "sawtooth", vol = 0.06) {
    const ac = this.ensure();
    const d = this.dest();
    if (!ac || !d) return;
    const o = ac.createOscillator();
    const g = ac.createGain();
    o.type = type;
    o.frequency.setValueAtTime(f0, ac.currentTime);
    o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), ac.currentTime + dur);
    g.gain.value = vol;
    o.connect(g);
    g.connect(d);
    o.start();
    g.gain.exponentialRampToValueAtTime(0.0001, ac.currentTime + dur);
    o.stop(ac.currentTime + dur);
  }
  shoot() {
    this.beep(880, 0.04, "square", 0.03);
  }
  laser() {
    this.beep(1400, 0.12, "sawtooth", 0.04);
  }
  drop() {
    this.beep(220, 0.15, "triangle", 0.05);
  }
  boom() {
    this.beep(120, 0.25, "square", 0.07);
    this.beep(80, 0.3, "sawtooth", 0.05);
  }
  hurt() {
    this.beep(180, 0.2, "sawtooth", 0.07);
  }
  zap() {
    this.beep(660, 0.06, "square", 0.025);
  }
  ding() {
    this.beep(1760, 0.08, "triangle", 0.04);
  }
  whoosh() {
    this.beep(440, 0.18, "sine", 0.04);
  }
  gameOver() {
    [440, 330, 220, 150].forEach((f, i) =>
      setTimeout(() => this.beep(f, 0.25, "square", 0.06), i * 180),
    );
  }
  aBomb() {
    this.beep(90, 0.5, "sawtooth", 0.09);
    this.beep(60, 0.6, "square", 0.07);
    setTimeout(() => this.beep(140, 0.3, "square", 0.06), 120);
  }
  alarm() {
    [0, 180, 360].forEach((d) =>
      setTimeout(() => {
        this.beep(880, 0.15, "square", 0.06);
        this.beep(660, 0.15, "square", 0.05);
      }, d),
    );
  }
  waveClear() {
    [523, 659, 784, 1046].forEach((f, i) =>
      setTimeout(() => this.beep(f, 0.12, "triangle", 0.06), i * 70),
    );
  }
  powerup() {
    this.sweep(440, 1760, 0.25, "square", 0.05);
  }
}
