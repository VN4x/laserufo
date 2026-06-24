// Procedural chiptune background music for F16 Fury.
// Two loops: "battle" (driving arpeggio) and "boss" (darker, slower).
// Volume is exposed via setMusicVolume/setSfxVolume and persisted by callers.

export type Loop = "battle" | "boss" | null;

const BATTLE: number[] = [
  // simple A minor arpeggio loop, 16 steps
  220, 277, 330, 440, 330, 277, 220, 165,
  196, 247, 294, 392, 294, 247, 196, 147,
];
const BASS_BATTLE: number[] = [
  110, 110, 110, 110, 98, 98, 98, 98,
  87, 87, 87, 87, 110, 110, 98, 98,
];
const BOSS: number[] = [
  // dissonant chromatic descent
  311, 277, 233, 220, 196, 220, 233, 277,
  311, 277, 233, 220, 196, 165, 147, 165,
];
const BASS_BOSS: number[] = [
  82, 82, 73, 73, 65, 65, 73, 73,
  82, 82, 73, 73, 65, 65, 58, 58,
];

class MusicEngine {
  ac: AudioContext | null = null;
  masterMusic: GainNode | null = null;
  masterSfx: GainNode | null = null;
  current: Loop = null;
  timer: number | null = null;
  step = 0;
  musicVol = 0.4;
  sfxVol = 0.7;
  muted = false;

  ensure(): AudioContext | null {
    if (typeof window === "undefined") return null;
    if (!this.ac) {
      try {
        const Ctor = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
        this.ac = new Ctor();
        this.masterMusic = this.ac.createGain();
        this.masterSfx = this.ac.createGain();
        this.masterMusic.gain.value = this.muted ? 0 : this.musicVol;
        this.masterSfx.gain.value = this.muted ? 0 : this.sfxVol;
        this.masterMusic.connect(this.ac.destination);
        this.masterSfx.connect(this.ac.destination);
      } catch { /* ignore */ }
    }
    return this.ac;
  }

  setMusicVolume(v: number) {
    this.musicVol = Math.max(0, Math.min(1, v));
    if (this.masterMusic) this.masterMusic.gain.value = this.muted ? 0 : this.musicVol;
  }
  setSfxVolume(v: number) {
    this.sfxVol = Math.max(0, Math.min(1, v));
    if (this.masterSfx) this.masterSfx.gain.value = this.muted ? 0 : this.sfxVol;
  }
  setMuted(m: boolean) {
    this.muted = m;
    if (this.masterMusic) this.masterMusic.gain.value = m ? 0 : this.musicVol;
    if (this.masterSfx) this.masterSfx.gain.value = m ? 0 : this.sfxVol;
  }
  getSfxNode(): GainNode | null { this.ensure(); return this.masterSfx; }

  play(loop: Loop) {
    const ac = this.ensure(); if (!ac) return;
    if (this.current === loop) return;
    this.stop();
    this.current = loop;
    if (!loop) return;
    this.step = 0;
    const bpm = loop === "boss" ? 110 : 140;
    const stepDur = 60 / bpm / 2; // eighth notes
    const startAt = ac.currentTime + 0.05;
    let next = startAt;
    const schedule = () => {
      if (!this.ac || this.current !== loop) return;
      while (next < this.ac.currentTime + 0.3) {
        this.playStep(loop, next, stepDur);
        next += stepDur;
        this.step++;
      }
      this.timer = window.setTimeout(schedule, 80);
    };
    schedule();
  }

  stop() {
    this.current = null;
    if (this.timer !== null) { clearTimeout(this.timer); this.timer = null; }
  }

  private playStep(loop: Exclude<Loop, null>, t: number, dur: number) {
    if (!this.ac || !this.masterMusic) return;
    const seq = loop === "boss" ? BOSS : BATTLE;
    const bass = loop === "boss" ? BASS_BOSS : BASS_BATTLE;
    const i = this.step % seq.length;
    // Lead
    this.tone(seq[i], t, dur * 0.9, loop === "boss" ? "sawtooth" : "square", 0.07);
    // Bass on every other step
    if (this.step % 2 === 0) {
      this.tone(bass[i], t, dur * 1.8, "triangle", 0.1);
    }
    // Hi-hat-ish noise on offbeats
    if (this.step % 2 === 1) this.noise(t, 0.03, 0.04);
  }

  private tone(freq: number, when: number, dur: number, type: OscillatorType, vol: number) {
    if (!this.ac || !this.masterMusic) return;
    const o = this.ac.createOscillator();
    const g = this.ac.createGain();
    o.type = type;
    o.frequency.value = freq;
    g.gain.setValueAtTime(0.0001, when);
    g.gain.exponentialRampToValueAtTime(vol, when + 0.005);
    g.gain.exponentialRampToValueAtTime(0.0001, when + dur);
    o.connect(g); g.connect(this.masterMusic);
    o.start(when); o.stop(when + dur + 0.02);
  }

  private noise(when: number, dur: number, vol: number) {
    if (!this.ac || !this.masterMusic) return;
    const buf = this.ac.createBuffer(1, Math.floor(this.ac.sampleRate * dur), this.ac.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * 0.5;
    const src = this.ac.createBufferSource();
    src.buffer = buf;
    const g = this.ac.createGain();
    g.gain.value = vol;
    src.connect(g); g.connect(this.masterMusic);
    src.start(when); src.stop(when + dur);
  }
}

export const Music = new MusicEngine();
