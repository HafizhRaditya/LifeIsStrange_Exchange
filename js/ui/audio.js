/**
 * Ambience.
 *
 * The bible asks for ambience per scene and **no score** — and explicitly no
 * music at all under the pool scene. So this synthesises room tone rather than
 * playing files: filtered noise, a little movement, and nothing with a melody.
 *
 * Everything is generated in the browser. No audio assets, no downloads, no
 * external requests, and the whole system weighs about 6 KB.
 *
 * Browsers refuse to start audio before a user gesture, so the context stays
 * suspended until the player clicks something. That is not a bug to work around
 * — a game that makes noise before you touch it is worse.
 */

const BEDS = {
  //                 colour     cutoff  wobble  depth  gain
  rain:      { type: "lowpass",  freq: 2200, lfo: 0.09, depth: 420, gain: 0.30, hiss: 0.5 },
  sea:       { type: "lowpass",  freq: 700,  lfo: 0.05, depth: 300, gain: 0.42 },
  wind:      { type: "bandpass", freq: 420,  lfo: 0.04, depth: 220, gain: 0.30 },
  room:      { type: "lowpass",  freq: 260,  lfo: 0.02, depth: 60,  gain: 0.22 },
  fluoro:    { type: "bandpass", freq: 1400, lfo: 0.7,  depth: 120, gain: 0.05 },
  water:     { type: "lowpass",  freq: 900,  lfo: 0.13, depth: 380, gain: 0.34 },
  underwater:{ type: "lowpass",  freq: 220,  lfo: 0.18, depth: 90,  gain: 0.5 },
  traffic:   { type: "lowpass",  freq: 480,  lfo: 0.03, depth: 160, gain: 0.26 },
  crowd:     { type: "bandpass", freq: 800,  lfo: 0.16, depth: 300, gain: 0.16 }
};

/** Which beds play under which background plate, and how loud. */
const SCENES = {
  "dorm-morning":   { rain: 0.5, room: 0.6 },
  "dorm-night":     { room: 0.7, rain: 0.22 },
  "hallway":        { room: 0.5, crowd: 0.7, fluoro: 0.5 },
  "cafeteria":      { crowd: 1.0, room: 0.4 },
  "stairwell":      { room: 0.8, fluoro: 0.3 },
  "quad":           { wind: 0.6, crowd: 0.35 },
  "diner":          { room: 0.6, rain: 0.3 },
  "studio":         { room: 0.5, fluoro: 0.6 },
  "darkroom":       { room: 0.9, fluoro: 0.25 },
  "library":        { room: 0.7, fluoro: 0.2 },
  "media-lab":      { room: 0.6, fluoro: 0.75 },
  "archive":        { room: 0.85, fluoro: 0.4 },
  "science-lab":    { room: 0.6, fluoro: 0.55 },
  "principal-office": { room: 0.7 },
  "bathroom":       { room: 0.8, fluoro: 0.45 },
  "taki-room":      { room: 0.6 },
  "gym":            { room: 0.7, crowd: 0.2 },
  "art-corridor":   { room: 0.6, fluoro: 0.3 },
  "pool-night":     { water: 0.9, room: 0.45 },
  "lighthouse-dusk":{ sea: 0.9, wind: 0.8 },
  "cliff-path":     { wind: 1.0, sea: 0.55 },
  "beach":          { sea: 1.0, wind: 0.5 },
  "harbour":        { sea: 0.85, wind: 0.45, room: 0.2 },
  "rear-steps":     { wind: 0.5, rain: 0.4 },
  "parking-lot":    { rain: 0.6, wind: 0.4 },
  "jones-house":    { room: 0.75 },
  "jones-landing":  { room: 0.8 },
  "riley-room":     { room: 0.7, rain: 0.25 },
  "theo-room":      { room: 0.8 },
  "calder-house":   { room: 0.7, wind: 0.35 },
  "cross-office":   { room: 0.6, fluoro: 0.2 },
  "gazette":        { room: 0.65, fluoro: 0.3 },
  "police":         { room: 0.7, fluoro: 0.4 },
  "hospital":       { room: 0.6, fluoro: 0.8 },
  "car":            { traffic: 1.0, rain: 0.35 },
  "bowling":        { crowd: 0.8, room: 0.5 },
  "airport":        { crowd: 0.6, room: 0.7, traffic: 0.3 },
  "nexus-voice":    { room: 0.55 },
  "dream":          { underwater: 0.7, room: 0.4 },
  "void":           { room: 0.4 }
};

const FADE = 2.2;      // seconds, scene to scene
const STORAGE = "lis_exchange_audio";

export class Ambience {
  constructor() {
    this.enabled = true;
    this.volume = 0.55;
    this.layers = new Map();
    this.current = null;
    this.restore();
  }

  restore() {
    try {
      const saved = JSON.parse(localStorage.getItem(STORAGE) ?? "{}");
      if (typeof saved.volume === "number") this.volume = saved.volume;
      if (typeof saved.enabled === "boolean") this.enabled = saved.enabled;
    } catch { /* storage off — defaults are fine */ }
  }

  persist() {
    try {
      localStorage.setItem(STORAGE, JSON.stringify({ volume: this.volume, enabled: this.enabled }));
    } catch { /* storage off */ }
  }

  /** Called from the first real user gesture; before that browsers refuse anyway. */
  unlock() {
    if (this.ctx) {
      if (this.ctx.state === "suspended") this.ctx.resume();
      return;
    }

    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (!Ctx) return;

    this.ctx = new Ctx();
    this.master = this.ctx.createGain();
    this.master.gain.value = this.enabled ? this.volume : 0;
    this.master.connect(this.ctx.destination);
    this.noise = makeNoise(this.ctx);

    if (this.pending) this.play(this.pending);
  }

  setVolume(v) {
    this.volume = Math.max(0, Math.min(1, v));
    this.enabled = this.volume > 0;
    if (this.master) {
      this.master.gain.setTargetAtTime(this.enabled ? this.volume : 0, this.ctx.currentTime, 0.08);
    }
    this.persist();
  }

  toggle() {
    this.enabled = !this.enabled;
    if (this.master) {
      this.master.gain.setTargetAtTime(this.enabled ? this.volume : 0, this.ctx.currentTime, 0.08);
    }
    this.persist();
    return this.enabled;
  }

  /** Crossfade to the bed mix for a background plate. */
  play(background) {
    this.pending = background;
    if (!this.ctx) return;
    if (this.current === background) return;
    this.current = background;

    const mix = SCENES[background] ?? SCENES.void;
    const now = this.ctx.currentTime;

    // fade out anything not in the new mix
    for (const [name, layer] of this.layers) {
      const target = (mix[name] ?? 0) * BEDS[name].gain;
      layer.gain.gain.cancelScheduledValues(now);
      layer.gain.gain.setTargetAtTime(target, now, FADE / 3);
    }

    // start anything new
    for (const [name, level] of Object.entries(mix)) {
      if (this.layers.has(name)) continue;
      const layer = this.makeLayer(name);
      if (!layer) continue;
      layer.gain.gain.setValueAtTime(0, now);
      layer.gain.gain.setTargetAtTime(level * BEDS[name].gain, now, FADE / 3);
      this.layers.set(name, layer);
    }
  }

  makeLayer(name) {
    const spec = BEDS[name];
    if (!spec) return null;

    const src = this.ctx.createBufferSource();
    src.buffer = this.noise;
    src.loop = true;

    const filter = this.ctx.createBiquadFilter();
    filter.type = spec.type;
    filter.frequency.value = spec.freq;
    filter.Q.value = spec.type === "bandpass" ? 0.7 : 0.5;

    // slow movement, so it never sits still enough to notice the loop
    const lfo = this.ctx.createOscillator();
    lfo.frequency.value = spec.lfo;
    const lfoGain = this.ctx.createGain();
    lfoGain.gain.value = spec.depth;
    lfo.connect(lfoGain).connect(filter.frequency);

    const gain = this.ctx.createGain();
    gain.gain.value = 0;

    src.connect(filter).connect(gain).connect(this.master);
    src.start();
    lfo.start();

    return { src, filter, gain, lfo };
  }

  /** Riley's two seconds: everything drops and muffles. */
  submerge(on) {
    if (!this.ctx) return;
    const now = this.ctx.currentTime;
    for (const layer of this.layers.values()) {
      layer.filter.frequency.setTargetAtTime(on ? 160 : layer.filter.frequency.defaultValue, now, 0.4);
    }
    this.master.gain.setTargetAtTime(
      this.enabled ? this.volume * (on ? 0.45 : 1) : 0, now, 0.4
    );
  }
}

/** Four seconds of white noise, reused by every layer. */
function makeNoise(ctx) {
  const frames = ctx.sampleRate * 4;
  const buffer = ctx.createBuffer(1, frames, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  let last = 0;
  for (let i = 0; i < frames; i++) {
    const white = Math.random() * 2 - 1;
    last = (last + 0.02 * white) / 1.02;   // slight brown tilt: less hissy, more room
    data[i] = last * 3.5;
  }
  return buffer;
}
