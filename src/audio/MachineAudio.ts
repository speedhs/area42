/**
 * Procedural machine audio — no asset files.
 * Drone bed shifts by wing; footsteps, CRT boot, hatch, and axiom stings.
 */
export type WingBed = "a" | "b" | "c" | "escape" | "boot";

export class MachineAudio {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private droneGain: GainNode | null = null;
  private drones: OscillatorNode[] = [];
  private muted = false;
  private started = false;
  private stepTimer = 0;
  private lastBed: WingBed = "boot";

  async ensure(): Promise<void> {
    if (this.started && this.ctx) {
      if (this.ctx.state === "suspended") await this.ctx.resume();
      return;
    }
    const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    this.ctx = new Ctx();
    this.master = this.ctx.createGain();
    this.master.gain.value = 0.22;
    this.master.connect(this.ctx.destination);

    this.droneGain = this.ctx.createGain();
    this.droneGain.gain.value = 0.35;
    this.droneGain.connect(this.master);

    this.started = true;
    this.setBed("a");
  }

  setMuted(muted: boolean): void {
    this.muted = muted;
    if (this.master && this.ctx) {
      this.master.gain.setTargetAtTime(muted ? 0 : 0.22, this.ctx.currentTime, 0.05);
    }
  }

  get isMuted(): boolean {
    return this.muted;
  }

  toggleMute(): boolean {
    this.setMuted(!this.muted);
    return this.muted;
  }

  setBed(bed: WingBed): void {
    if (!this.ctx || !this.droneGain) return;
    if (bed === this.lastBed && this.drones.length) return;
    this.lastBed = bed;

    for (const osc of this.drones) {
      try {
        osc.stop();
        osc.disconnect();
      } catch {
        /* already stopped */
      }
    }
    this.drones = [];

    const freqs =
      bed === "boot"
        ? [55, 82.5]
        : bed === "a"
          ? [48, 72, 96]
          : bed === "b"
            ? [44, 66, 99, 132]
            : bed === "c"
              ? [60, 90, 180]
              : [52, 78, 104, 156];

    const now = this.ctx.currentTime;
    for (const f of freqs) {
      const osc = this.ctx.createOscillator();
      const g = this.ctx.createGain();
      osc.type = bed === "c" ? "triangle" : "sine";
      osc.frequency.value = f;
      g.gain.value = 0.12 / freqs.length;
      osc.connect(g);
      g.connect(this.droneGain);
      osc.start(now);
      this.drones.push(osc);
    }
  }

  /** Call each frame while walking. */
  updateFootsteps(dt: number, moving: boolean, scaled: boolean): void {
    if (!this.ctx || !this.master || this.muted || !moving) {
      this.stepTimer = 0;
      return;
    }
    this.stepTimer -= dt;
    if (this.stepTimer > 0) return;
    this.stepTimer = scaled ? 0.38 : 0.42;
    this.footstep(scaled);
  }

  footstep(scaled = false): void {
    if (!this.ctx || !this.master || this.muted) return;
    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    const filter = this.ctx.createBiquadFilter();
    osc.type = "square";
    osc.frequency.value = scaled ? 140 : 90;
    filter.type = "lowpass";
    filter.frequency.value = scaled ? 600 : 400;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.18, t + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.09);
    osc.connect(filter);
    filter.connect(g);
    g.connect(this.master);
    osc.start(t);
    osc.stop(t + 0.1);
  }

  crtBoot(): void {
    this.blip([880, 1320], 0.12, "sine", 0.1);
  }

  hatchClack(): void {
    if (!this.ctx || !this.master || this.muted) return;
    const t = this.ctx.currentTime;
    const buffer = this.ctx.createBuffer(1, this.ctx.sampleRate * 0.08, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < data.length; i++) {
      data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (data.length * 0.15));
    }
    const src = this.ctx.createBufferSource();
    const g = this.ctx.createGain();
    const filter = this.ctx.createBiquadFilter();
    src.buffer = buffer;
    filter.type = "bandpass";
    filter.frequency.value = 700;
    g.gain.value = 0.35;
    src.connect(filter);
    filter.connect(g);
    g.connect(this.master);
    src.start(t);
  }

  /** Rising harmonic — same motif, richer layers for later axioms. */
  axiomSting(tier: number): void {
    if (!this.ctx || !this.master || this.muted) return;
    const base = [220, 277, 330, 440];
    const count = Math.min(base.length, 1 + tier);
    const t = this.ctx.currentTime;
    for (let i = 0; i < count; i++) {
      const osc = this.ctx.createOscillator();
      const g = this.ctx.createGain();
      osc.type = "sine";
      osc.frequency.value = base[i]!;
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(0.14 / count, t + 0.04 + i * 0.03);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.55 + i * 0.08);
      osc.connect(g);
      g.connect(this.master);
      osc.start(t);
      osc.stop(t + 0.7);
    }
  }

  seamWhoosh(): void {
    this.blip([180, 90], 0.2, "triangle", 0.08);
  }

  uiClick(): void {
    this.blip([660], 0.06, "square", 0.06);
  }

  dispose(): void {
    for (const osc of this.drones) {
      try {
        osc.stop();
      } catch {
        /* */
      }
    }
    this.drones = [];
    void this.ctx?.close();
    this.ctx = null;
    this.started = false;
  }

  private blip(
    freqs: number[],
    dur: number,
    type: OscillatorType,
    gain: number,
  ): void {
    if (!this.ctx || !this.master || this.muted) return;
    const t = this.ctx.currentTime;
    for (const f of freqs) {
      const osc = this.ctx.createOscillator();
      const g = this.ctx.createGain();
      osc.type = type;
      osc.frequency.setValueAtTime(f, t);
      if (freqs.length > 1) {
        osc.frequency.exponentialRampToValueAtTime(freqs[freqs.length - 1]!, t + dur);
      }
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(gain, t + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      osc.connect(g);
      g.connect(this.master);
      osc.start(t);
      osc.stop(t + dur + 0.02);
    }
  }
}
