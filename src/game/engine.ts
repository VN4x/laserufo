// F16 Fury — retro arcade game engine
// Internal logical resolution; canvas is upscaled via CSS for pixel look.
import { P } from "./palette";
import { t } from "./i18n";
import { unlock, bumpAbomb } from "./achievements";
import { Music } from "./music";

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
  damage: number;
  fromPlayer: boolean;
  kind: "bullet" | "laser" | "bomb" | "plasma";
  life: number;
}

interface Particle {
  x: number; y: number; vx: number; vy: number;
  life: number; maxLife: number;
  color: string; size: number;
}

interface FloatText {
  x: number; y: number; vy: number; life: number; text: string; color: string;
}

export interface GameStats {
  score: number;
  wave: number;
  lives: number;
  mana: number;
  maxMana: number;
  kills: number;
  gameOver: boolean;
  paused: boolean;
}

interface Input {
  up: boolean; down: boolean; left: boolean; right: boolean;
  mg: boolean; laser: boolean; bomb: boolean; abomb: boolean;
  trickL: boolean; trickR: boolean;
}

const ENT_SCALE = 1.3;
const START_LIVES = 5;
const SHIELD_COST = 25;

export class Game {
  ctx: CanvasRenderingContext2D;
  player!: Player;
  enemies: Enemy[] = [];
  projectiles: Projectile[] = [];
  particles: Particle[] = [];
  floats: FloatText[] = [];
  stars: { x: number; y: number; z: number }[] = [];
  mountains: { x: number; h: number }[] = [];

  input: Input = {
    up: false, down: false, left: false, right: false,
    mg: false, laser: false, bomb: false, abomb: false, trickL: false, trickR: false,
  };

  wave = 0;
  waveTimer = 0;
  spawnQueue: Array<{ t: number; kind: Enemy["kind"]; y?: number }> = [];
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

  constructor(ctx: CanvasRenderingContext2D, onStats: (s: GameStats) => void) {
    this.ctx = ctx;
    this.onStats = onStats;
    this.audio = new AudioCtx();
    this.reset();
    for (let i = 0; i < 80; i++) {
      this.stars.push({ x: Math.random() * VW, y: Math.random() * VH, z: Math.random() * 0.8 + 0.2 });
    }
    for (let i = 0; i < 12; i++) {
      this.mountains.push({ x: i * 60, h: 30 + Math.random() * 40 });
    }
  }

  reset() {
    this.player = {
      pos: { x: 80, y: VH / 2 },
      vel: { x: 0, y: 0 },
      w: 31, h: 13,
      alive: true,
      hp: START_LIVES, lives: START_LIVES,
      mana: 0, maxMana: 100,
      invuln: 0,
      rotation: 0, spinning: false, spinAccum: 0, spinDir: 0,
      mgCool: 0, laserCool: 0, bombCool: 0,
    };
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
    this.shake = 0;
    this.time = 0;
    this.comboCount = 0;
    this.comboTimer = 0;
    this.hitsThisWave = 0;
    this.startNextWave();
    this.emitStats();
  }

  emitStats() {
    this.onStats({
      score: this.score,
      wave: this.wave,
      lives: this.player.lives,
      mana: Math.floor(this.player.mana),
      maxMana: this.player.maxMana,
      kills: this.kills,
      gameOver: this.gameOver,
      paused: this.paused,
    });
  }

  startNextWave() {
    // Reward "no damage" on the wave we just finished
    if (this.wave >= 1 && this.hitsThisWave === 0) {
      unlock("no_dmg_wave");
    }
    this.hitsThisWave = 0;

    const prevWave = this.wave;
    this.wave++;
    if (this.wave >= 5) unlock("wave_5");
    const isBoss = this.wave % 5 === 0;
    const level = this.getLevel();
    this.spawnQueue = [];
    if (isBoss) {
      const variant = BOSS_CYCLE[(Math.floor((this.wave - 5) / 5)) % BOSS_CYCLE.length];
      this.spawnQueue.push({ t: 1, kind: "boss", variant });
      Music.play("boss");
      this.audio.alarm();
    } else {
      const count = 4 + Math.floor(this.wave * 1.5);
      for (let i = 0; i < count; i++) {
        const r = Math.random();
        const kind: Enemy["kind"] = r < 0.65 ? "ufo" : r < 0.85 ? "bomber" : "mother";
        this.spawnQueue.push({ t: i * 0.8 + 0.5, kind, y: 40 + Math.random() * (VH - 80) });
      }
      Music.play("battle");
      if (prevWave > 0) this.audio.waveClear();
    }
    this.waveTimer = 0;
    this.floats.push({
      x: VW / 2 - 30, y: VH / 2 - 20, vy: -0.2, life: 90,
      text: isBoss
        ? `${t().bossWave} ${this.wave} — LVL ${level}`
        : `${t().wave} ${this.wave} — LVL ${level}`,
      color: P().hudAccent,
    });
  }

  getLevel() { return Math.floor((this.wave - 1) / 5) + 1; }

  spawnEnemy(kind: Enemy["kind"], y?: number, variant?: BossVariant) {

    const yy = y ?? 40 + Math.random() * (VH - 80);
    if (kind === "ufo") {
      this.enemies.push({
        pos: { x: VW + 20, y: yy }, vel: { x: -(1.0 + Math.random() * 0.7), y: 0 },
        w: 23, h: 13, alive: true, kind, hp: 1, maxHp: 1, shootCool: 60 + Math.random() * 60,
        age: 0, baseY: yy, amp: 20 + Math.random() * 20,
      });
    } else if (kind === "bomber") {
      this.enemies.push({
        pos: { x: VW + 20, y: 40 + Math.random() * 60 }, vel: { x: -0.6, y: 0 },
        w: 29, h: 16, alive: true, kind, hp: 2, maxHp: 2, shootCool: 90,
        age: 0, baseY: 0, amp: 0,
      });
    } else if (kind === "mother") {
      this.enemies.push({
        pos: { x: VW + 30, y: yy }, vel: { x: -0.42, y: 0 },
        w: 42, h: 21, alive: true, kind, hp: 5, maxHp: 5, shootCool: 70,
        age: 0, baseY: yy, amp: 10,
      });
    } else {
      this.enemies.push({
        pos: { x: VW + 50, y: VH / 2 }, vel: { x: -0.25, y: 0 },
        w: 78, h: 47, alive: true, kind, hp: 40 + this.wave * 5, maxHp: 40 + this.wave * 5,
        shootCool: 40, age: 0, baseY: VH / 2, amp: 40,
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
  }

  step(dt: number) {
    if (this.paused || this.gameOver) { this.draw(); return; }
    this.time += dt;
    this.updatePlayer(dt);
    this.updateEnemies(dt);
    this.updateProjectiles(dt);
    this.updateParticles(dt);
    this.updateFloats(dt);
    this.updateSpawner(dt);
    this.updateCombo(dt);
    if (this.shake > 0) this.shake = Math.max(0, this.shake - dt * 60);
    this.draw();
    this.emitStats();
  }

  updateCombo(dt: number) {
    if (this.comboTimer > 0) {
      this.comboTimer -= dt;
      if (this.comboTimer <= 0) this.comboCount = 0;
    }
  }

  registerKill(e: Enemy, longShot: boolean) {
    this.kills++;
    if (this.kills === 1) unlock("first_kill");
    const baseScore = e.kind === "ufo" ? 100 : e.kind === "bomber" ? 150 : e.kind === "mother" ? 300 : 2000;
    this.score += baseScore;
    if (this.score >= 10000) unlock("score_10k");
    this.comboCount++;
    this.comboTimer = 2;
    if (this.comboCount >= 5) unlock("combo_5");
    if (this.comboCount >= 10) unlock("combo_10");
    if (this.comboCount >= 3) {
      this.addMana(15, e.pos.x, e.pos.y - 8, `${t().combo} x${this.comboCount}`);
    }
    if (longShot) {
      this.addMana(8, e.pos.x, e.pos.y - 16, t().precision);
    }
    this.explode(e.pos.x, e.pos.y, e.kind === "boss" ? 40 : 14);
    this.shake = e.kind === "boss" ? 14 : 4;
    if (e.kind === "boss") {
      unlock("boss_down");
      this.player.lives++;
      this.floats.push({ x: e.pos.x - 16, y: e.pos.y - 20, vy: -0.3, life: 80, text: t().plusLife, color: "#7cffb0" });
    }
    this.audio.boom();
  }

  addMana(amount: number, x: number, y: number, label: string) {
    this.player.mana += amount;
    this.floats.push({ x, y, vy: -0.4, life: 60, text: `${label} +${amount}`, color: "#7cf0ff" });
    this.audio.ding();
    if (this.player.mana >= this.player.maxMana) {
      this.player.mana = 0;
      this.player.lives++;
      this.floats.push({ x: this.player.pos.x - 18, y: this.player.pos.y - 18, vy: -0.4, life: 80, text: t().plusLife, color: "#7cffb0" });
    }
  }

  updatePlayer(dt: number) {
    const p = this.player;
    const speed = 1.87;
    p.vel.x = (this.input.right ? 1 : 0) - (this.input.left ? 1 : 0);
    p.vel.y = (this.input.down ? 1 : 0) - (this.input.up ? 1 : 0);
    p.pos.x += p.vel.x * speed;
    p.pos.y += p.vel.y * speed * 0.9;
    p.pos.x = Math.max(10, Math.min(VW - 36, p.pos.x));
    p.pos.y = Math.max(15, Math.min(VH - 32, p.pos.y));

    // Trick: barrel roll / loop
    if ((this.input.trickL || this.input.trickR) && !p.spinning) {
      p.spinning = true;
      p.spinAccum = 0;
      p.spinDir = this.input.trickR ? 1 : -1;
      this.audio.whoosh();
    }
    if (p.spinning) {
      const spd = 0.21;
      p.rotation += spd * p.spinDir;
      p.spinAccum += spd;
      if (p.spinAccum >= Math.PI * 2) {
        p.spinning = false;
        p.rotation = 0;
        this.addMana(10, p.pos.x, p.pos.y - 16, t().barrelRoll);
      }
    }

    if (p.invuln > 0) p.invuln -= dt * 60;
    if (p.mgCool > 0) p.mgCool -= dt * 60;
    if (p.laserCool > 0) p.laserCool -= dt * 60;
    if (p.bombCool > 0) p.bombCool -= dt * 60;

    // Fire weapons
    if (this.input.mg && p.mgCool <= 0) {
      this.projectiles.push({
        pos: { x: p.pos.x + 22, y: p.pos.y + 1 }, vel: { x: 5.1, y: 0 },
        w: 5, h: 2, alive: true, damage: 1, fromPlayer: true, kind: "bullet", life: 80,
      });
      p.mgCool = 6;
      this.audio.shoot();
    }
    if (this.input.laser && p.laserCool <= 0 && p.mana >= 8) {
      p.mana -= 8;
      this.projectiles.push({
        pos: { x: p.pos.x + 22, y: p.pos.y + 1 }, vel: { x: 7.65, y: 0 },
        w: 30, h: 3, alive: true, damage: 5, fromPlayer: true, kind: "laser", life: 60,
      });
      p.laserCool = 18;
      this.audio.laser();
    }
    // K bomb — always available, no mana cost (fix: previously locked behind 20 mana)
    if (this.input.bomb && p.bombCool <= 0) {
      this.projectiles.push({
        pos: { x: p.pos.x + 10, y: p.pos.y + 6 }, vel: { x: 1.7, y: 1.27 },
        w: 6, h: 8, alive: true, damage: 30, fromPlayer: true, kind: "bomb", life: 200,
      });
      p.bombCool = 30;
      this.audio.drop();
    }
    // A-BOMB: wipe all enemies on screen
    if (this.input.abomb && p.mana >= 50) {
      p.mana -= 50;
      this.input.abomb = false;
      this.shake = 22;
      this.audio.aBomb();
      bumpAbomb();
      this.floats.push({ x: VW / 2 - 30, y: VH / 2 - 12, vy: -0.3, life: 70, text: t().aBomb, color: "#ffd84d" });
      for (let i = 0; i < 14; i++) {
        this.explode(40 + Math.random() * (VW - 80), 20 + Math.random() * (VH - 60), 18);
      }
      for (const e of this.enemies) {
        if (!e.alive) continue;
        if (e.pos.x < VW + 10 && e.pos.x > -10) {
          if (e.kind === "boss") {
            e.hp -= 25;
            this.explode(e.pos.x, e.pos.y, 30);
            if (e.hp <= 0) { e.alive = false; this.registerKill(e, false); }
          } else {
            e.alive = false;
            this.registerKill(e, false);
          }
        }
      }
      for (const pr of this.projectiles) {
        if (!pr.fromPlayer) pr.alive = false;
      }
    }

    // Near-miss detection
    for (const e of this.enemies) {
      if (!e.alive) continue;
      const dx = e.pos.x - p.pos.x; const dy = e.pos.y - p.pos.y;
      const d = Math.hypot(dx, dy);
      const tagged = (e as unknown as { _nearMissed?: number })._nearMissed;
      if (d < 26 && d > 16 && !tagged && e.pos.x < p.pos.x + 30) {
        (e as unknown as { _nearMissed?: number })._nearMissed = this.time;
        this.addMana(5, p.pos.x + 10, p.pos.y - 14, t().nearMiss);
      }
    }
    for (const pr of this.projectiles) {
      if (pr.fromPlayer || !pr.alive) continue;
      const dx = pr.pos.x - p.pos.x; const dy = pr.pos.y - p.pos.y;
      const d = Math.hypot(dx, dy);
      const tagged = (pr as unknown as { _nearMissed?: boolean })._nearMissed;
      if (d < 18 && d > 10 && !tagged) {
        (pr as unknown as { _nearMissed?: boolean })._nearMissed = true;
        this.addMana(5, p.pos.x, p.pos.y - 14, t().dodge);
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
        } else { e.vel.x = 0; }
      }
      e.shootCool -= dt * 60;
      if (e.shootCool <= 0 && e.pos.x < VW) {
        if (e.kind === "bomber") {
          this.projectiles.push({
            pos: { x: e.pos.x, y: e.pos.y + 8 }, vel: { x: -0.42, y: 1.27 },
            w: 5, h: 7, alive: true, damage: 1, fromPlayer: false, kind: "bomb", life: 200,
          });
          e.shootCool = 90;
        } else {
          const px = this.player.pos.x; const py = this.player.pos.y;
          const dx = px - e.pos.x; const dy = py - e.pos.y;
          const d = Math.hypot(dx, dy) || 1;
          const sp = e.kind === "boss" ? 2.55 : 2.04;
          this.projectiles.push({
            pos: { x: e.pos.x, y: e.pos.y }, vel: { x: dx / d * sp, y: dy / d * sp },
            w: 6, h: 6, alive: true, damage: 1, fromPlayer: false, kind: "plasma", life: 180,
          });
          e.shootCool = e.kind === "boss" ? 28 : 100;
          this.audio.zap();
        }
      }
      if (e.pos.x < -40) e.alive = false;
    }
    this.enemies = this.enemies.filter(e => e.alive);
  }

  updateProjectiles(dt: number) {
    const p = this.player;
    for (const pr of this.projectiles) {
      if (!pr.alive) continue;
      pr.pos.x += pr.vel.x;
      pr.pos.y += pr.vel.y;
      if (pr.kind === "bomb") pr.vel.y += 0.08;
      pr.life -= dt * 60;
      if (pr.life <= 0 || pr.pos.x < -20 || pr.pos.x > VW + 20 || pr.pos.y > VH || pr.pos.y < -20) {
        if (pr.kind === "bomb" && pr.fromPlayer) this.explode(pr.pos.x, pr.pos.y, 30);
        pr.alive = false;
        continue;
      }
      if (pr.fromPlayer) {
        for (const e of this.enemies) {
          if (!e.alive) continue;
          if (rectsHit(pr, e)) {
            e.hp -= pr.damage;
            this.particles.push({
              x: pr.pos.x, y: pr.pos.y, vx: -1, vy: (Math.random() - 0.5) * 2,
              life: 10, maxLife: 10, color: "#ffd84d", size: 2,
            });
            if (pr.kind !== "laser") pr.alive = false;
            if (e.hp <= 0) {
              e.alive = false;
              const longShot = (pr.pos.x - p.pos.x) > 200;
              this.registerKill(e, longShot);
            }
            if (pr.kind === "bomb") this.explode(pr.pos.x, pr.pos.y, 30);
            break;
          }
        }
      } else {
        if (p.invuln <= 0 && rectsHit(pr, { pos: { x: p.pos.x, y: p.pos.y }, w: p.w, h: p.h } as Entity)) {
          pr.alive = false;
          this.hitPlayer();
        }
      }
    }
    // Player-enemy collision
    if (p.invuln <= 0) {
      for (const e of this.enemies) {
        if (!e.alive) continue;
        if (rectsHit({ pos: p.pos, w: p.w, h: p.h } as Entity, e)) {
          this.hitPlayer();
          e.hp -= 5;
          if (e.hp <= 0) { e.alive = false; this.registerKill(e, false); }
          break;
        }
      }
    }
    this.projectiles = this.projectiles.filter(pr => pr.alive);
  }

  hitPlayer() {
    const p = this.player;
    // MANA SHIELD: absorb the hit if enough mana
    if (p.mana >= SHIELD_COST) {
      p.mana -= SHIELD_COST;
      p.invuln = 60;
      this.shake = 6;
      this.floats.push({
        x: p.pos.x - 10, y: p.pos.y - 16, vy: -0.4, life: 60,
        text: t().shield, color: "#7cf0ff",
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
      this.gameOver = true;
      this.audio.gameOver();
    }
  }

  explode(x: number, y: number, count: number) {
    const colors = P().particles;
    for (let i = 0; i < count; i++) {
      const a = Math.random() * Math.PI * 2;
      const s = 0.5 + Math.random() * 2.5;
      this.particles.push({
        x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s,
        life: 20 + Math.random() * 20, maxLife: 30,
        color: colors[Math.floor(Math.random() * colors.length)],
        size: 1 + Math.random() * 2,
      });
    }
  }

  updateParticles(dt: number) {
    for (const p of this.particles) {
      p.x += p.vx; p.y += p.vy; p.vy += 0.05; p.life -= dt * 60;
    }
    this.particles = this.particles.filter(p => p.life > 0);
  }

  updateFloats(dt: number) {
    for (const f of this.floats) { f.y += f.vy; f.life -= dt * 60; }
    this.floats = this.floats.filter(f => f.life > 0);
  }

  updateSpawner(dt: number) {
    this.waveTimer += dt;
    while (this.spawnQueue.length && this.spawnQueue[0].t <= this.waveTimer) {
      const s = this.spawnQueue.shift()!;
      this.spawnEnemy(s.kind, s.y);
    }
    if (this.spawnQueue.length === 0 && this.enemies.length === 0) {
      this.startNextWave();
    }
    for (const st of this.stars) {
      st.x -= st.z * 1.5;
      if (st.x < 0) { st.x += VW; st.y = Math.random() * VH; }
    }
    for (const m of this.mountains) {
      m.x -= 0.3;
      if (m.x < -60) { m.x += 60 * this.mountains.length; m.h = 30 + Math.random() * 40; }
    }
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
    ctx.beginPath(); ctx.arc(VW - 80, VH - 80, 40, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = pal.bg;
    for (let i = 0; i < 5; i++) ctx.fillRect(VW - 130, VH - 70 + i * 8, 100, 3);
    // Mountains
    ctx.fillStyle = pal.mountain;
    for (const m of this.mountains) {
      ctx.beginPath();
      ctx.moveTo(m.x, VH - 40);
      ctx.lineTo(m.x + 30, VH - 40 - m.h);
      ctx.lineTo(m.x + 60, VH - 40);
      ctx.closePath(); ctx.fill();
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
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(VW, y); ctx.stroke();
    }

    // Projectiles (enemy)
    for (const pr of this.projectiles) {
      if (pr.fromPlayer) continue;
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
      if (!pr.fromPlayer) continue;
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
    // Player
    this.drawPlayer();
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

  drawPlayer() {
    const p = this.player;
    const ctx = this.ctx;
    const pal = P();
    if (p.invuln > 0 && Math.floor(p.invuln / 4) % 2 === 0) return;
    ctx.save();
    ctx.translate(p.pos.x + 16, p.pos.y + 7);
    ctx.rotate(p.rotation);
    ctx.scale(ENT_SCALE, ENT_SCALE);
    ctx.fillStyle = pal.playerBody;
    ctx.fillRect(-12, -2, 22, 4);
    ctx.fillStyle = pal.playerWing;
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
      ctx.globalAlpha = 1;
      ctx.fillStyle = "#000";
      ctx.fillRect(-30, -22, 60, 3);
      ctx.fillStyle = pal.bossHp;
      ctx.fillRect(-30, -22, Math.floor(60 * e.hp / e.maxHp), 3);
    }
    ctx.restore();
  }
}

function rectsHit(a: { pos: Vec; w: number; h: number }, b: { pos: Vec; w: number; h: number }) {
  return a.pos.x < b.pos.x + b.w / 2 + a.w / 2 &&
    a.pos.x + a.w / 2 > b.pos.x - b.w / 2 &&
    a.pos.y < b.pos.y + b.h / 2 + a.h / 2 &&
    a.pos.y + a.h / 2 > b.pos.y - b.h / 2;
}

// Web Audio chiptune
class AudioCtx {
  ac: AudioContext | null = null;
  ensure() {
    if (!this.ac) {
      try { this.ac = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)(); } catch { /* ignore */ }
    }
    return this.ac;
  }
  beep(freq: number, dur: number, type: OscillatorType = "square", vol = 0.05) {
    const ac = this.ensure(); if (!ac) return;
    const o = ac.createOscillator(); const g = ac.createGain();
    o.type = type; o.frequency.value = freq;
    g.gain.value = vol;
    o.connect(g); g.connect(ac.destination);
    o.start();
    g.gain.exponentialRampToValueAtTime(0.0001, ac.currentTime + dur);
    o.stop(ac.currentTime + dur);
  }
  shoot() { this.beep(880, 0.04, "square", 0.03); }
  laser() { this.beep(1400, 0.12, "sawtooth", 0.04); }
  drop()  { this.beep(220, 0.15, "triangle", 0.05); }
  boom()  { this.beep(120, 0.25, "square", 0.07); this.beep(80, 0.3, "sawtooth", 0.05); }
  hurt()  { this.beep(180, 0.2, "sawtooth", 0.07); }
  zap()   { this.beep(660, 0.06, "square", 0.025); }
  ding()  { this.beep(1760, 0.08, "triangle", 0.04); }
  whoosh(){ this.beep(440, 0.18, "sine", 0.04); }
  gameOver(){ [440,330,220,150].forEach((f,i)=>setTimeout(()=>this.beep(f,0.25,"square",0.06), i*180)); }
  aBomb(){ this.beep(90,0.5,"sawtooth",0.09); this.beep(60,0.6,"square",0.07); setTimeout(()=>this.beep(140,0.3,"square",0.06),120); }
}
