import { $, el, clear } from "../util/dom.js";
import { state } from "../engine/state.js";

/**
 * The Episode 1 set piece.
 *
 * The Script Bible is explicit: the eleven frames must be SHOWN, not described,
 * and if the engine can't frame-step, the scene needs a redesign rather than a
 * workaround. So this is a real frame-stepper — deterministic rendering keyed on
 * frame index, so stepping back retraces exactly what stepping forward drew.
 *
 * The fog is generated procedurally because there is no footage yet. Swapping in
 * real frames later means replacing drawFrame() with an image-sequence blit; the
 * transport, the gating and the timecode maths do not change.
 */

const W = 640;
const H = 360;
const TOTAL = 120;
const FPS = 24;

// The anomaly: from this frame, the fog retraces its own path for 11 frames,
// then continues forward from where it left off. Offset stays continuous —
// no seam, no dropped frames, no timecode skip. The weather simply goes backwards.
const ANOMALY_START = 61;
const ANOMALY_LEN = 11;
const DRIFT = 3.2; // px of fog travel per frame

function fogOffset(f) {
  if (f <= ANOMALY_START) return f * DRIFT;
  if (f <= ANOMALY_START + ANOMALY_LEN) return (ANOMALY_START - (f - ANOMALY_START)) * DRIFT;
  return (ANOMALY_START - ANOMALY_LEN + (f - ANOMALY_START - ANOMALY_LEN)) * DRIFT;
}

const inAnomaly = (f) => f > ANOMALY_START && f <= ANOMALY_START + ANOMALY_LEN;

/** Source timecode. Clip four starts at 00:04:41 — hh:mm:ss:ff as in the script. */
function timecode(f) {
  const base = 4 * 60 + 41;
  const total = base + f / FPS;
  const m = String(Math.floor(total / 60)).padStart(2, "0");
  const s = String(Math.floor(total % 60)).padStart(2, "0");
  const ff = String(f % FPS).padStart(2, "0");
  return `00:${m}:${s}:${ff}`;
}

/* deterministic PRNG so a given frame always draws identically */
function seeded(n) {
  let t = n + 0x6d2b79f5;
  return () => {
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const BLOBS = (() => {
  const rand = seeded(1013);
  return Array.from({ length: 46 }, () => ({
    x: rand() * (W + 260) - 130,
    y: 150 + rand() * 190,
    r: 40 + rand() * 110,
    a: 0.05 + rand() * 0.16,
    v: 0.6 + rand() * 0.9
  }));
})();

export class Anomaly {
  constructor() {
    this.root = $("#anomaly");
    this.frame = 0;
    this.playing = false;
    this.timer = null;
    this.inspected = false;
    this.resolve = null;
  }

  play(id) {
    return new Promise((resolve) => {
      this.resolve = resolve;
      this.id = id;
      this.build();
      this.root.hidden = false;
      this.root.classList.add("is-open");
      this.frame = 0;
      this.inspected = false;
      this.draw();
      this.start();
      this.hintTimer = setTimeout(() => this.hint.classList.add("is-shown"), 14000);
    });
  }

  build() {
    clear(this.root);

    const shell = el("div", "anomaly__shell");

    this.canvas = el("canvas", "anomaly__canvas");
    this.canvas.width = W;
    this.canvas.height = H;
    this.ctx = this.canvas.getContext("2d");

    const bar = el("div", "anomaly__bar");
    this.tc = el("span", "anomaly__tc");
    this.scrub = el("input", "anomaly__scrub");
    this.scrub.type = "range";
    this.scrub.min = 0;
    this.scrub.max = TOTAL - 1;
    this.scrub.step = 1;
    this.scrub.value = 0;
    this.scrub.addEventListener("input", () => {
      this.pause();
      this.seek(Number(this.scrub.value));
    });

    const transport = el("div", "anomaly__transport");
    const mk = (label, title, fn) => {
      const b = el("button", "anomaly__btn", label);
      b.type = "button";
      b.title = title;
      b.addEventListener("click", (e) => { e.stopPropagation(); fn(); });
      return b;
    };
    this.playBtn = mk("❚❚", "Play / pause", () => this.toggle());
    transport.append(
      mk("◀◀", "Step back one frame", () => { this.pause(); this.seek(this.frame - 1); }),
      this.playBtn,
      mk("▶▶", "Step forward one frame", () => { this.pause(); this.seek(this.frame + 1); })
    );

    bar.append(this.tc, this.scrub, transport);

    this.hint = el("p", "anomaly__hint", "Step it. Frame by frame.");
    this.continueBtn = el("button", "anomaly__continue", "Stop looking");
    this.continueBtn.type = "button";
    this.continueBtn.hidden = true;
    this.continueBtn.addEventListener("click", (e) => { e.stopPropagation(); this.finish(); });

    shell.append(this.canvas, bar, this.hint, this.continueBtn);
    this.root.append(shell);

    this.root.onclick = (e) => e.stopPropagation();
  }

  start() {
    this.playing = true;
    this.playBtn.textContent = "❚❚";
    clearInterval(this.timer);
    this.timer = setInterval(() => this.seek(this.frame + 1), 1000 / FPS);
  }

  pause() {
    this.playing = false;
    this.playBtn.textContent = "▶";
    clearInterval(this.timer);
  }

  toggle() {
    this.playing ? this.pause() : this.start();
  }

  seek(f) {
    this.frame = ((f % TOTAL) + TOTAL) % TOTAL;

    // The beat only lands if the player finds it themselves, so the exit
    // unlocks on stepping into the window while paused — not on a timer.
    if (!this.playing && inAnomaly(this.frame) && !this.inspected) {
      this.inspected = true;
      state.setFlags({ ep1_stepped_the_frames: true });
      this.continueBtn.hidden = false;
      this.hint.classList.remove("is-shown");
    }

    this.draw();
  }

  draw() {
    const ctx = this.ctx;
    const off = fogOffset(this.frame);

    // sky
    const sky = ctx.createLinearGradient(0, 0, 0, H);
    sky.addColorStop(0, "#4a5058");
    sky.addColorStop(0.55, "#3a4048");
    sky.addColorStop(1, "#22272c");
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, W, H);

    // sea
    ctx.fillStyle = "#1d2429";
    ctx.fillRect(0, 246, W, H - 246);

    // headland + the ruin
    ctx.fillStyle = "#151a1e";
    ctx.beginPath();
    ctx.moveTo(0, 262);
    ctx.lineTo(150, 240);
    ctx.lineTo(300, 250);
    ctx.lineTo(430, 236);
    ctx.lineTo(W, 258);
    ctx.lineTo(W, H);
    ctx.lineTo(0, H);
    ctx.closePath();
    ctx.fill();

    ctx.fillStyle = "#101417";
    ctx.fillRect(404, 138, 30, 104);
    ctx.beginPath();          // broken top
    ctx.moveTo(404, 138);
    ctx.lineTo(414, 120);
    ctx.lineTo(422, 134);
    ctx.lineTo(434, 126);
    ctx.lineTo(434, 138);
    ctx.closePath();
    ctx.fill();

    // fog — the thing that goes backwards
    ctx.globalCompositeOperation = "lighter";
    for (const b of BLOBS) {
      const span = W + 260;
      let x = (((b.x + off * b.v) % span) + span) % span - 130;
      const g = ctx.createRadialGradient(x, b.y, 0, x, b.y, b.r);
      g.addColorStop(0, `rgba(198,206,214,${b.a})`);
      g.addColorStop(1, "rgba(198,206,214,0)");
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(x, b.y, b.r, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalCompositeOperation = "source-over";

    // scanline + grain, so it reads as footage rather than a drawing
    ctx.fillStyle = "rgba(0,0,0,0.16)";
    for (let y = 0; y < H; y += 3) ctx.fillRect(0, y, W, 1);

    this.tc.textContent = `${timecode(this.frame)}   f${String(this.frame).padStart(3, "0")}`;
    this.scrub.value = this.frame;
  }

  finish() {
    this.pause();
    clearTimeout(this.hintTimer);
    this.root.classList.remove("is-open");
    this.root.hidden = true;
    const resolve = this.resolve;
    this.resolve = null;
    resolve?.();
  }

  get isOpen() {
    return !this.root.hidden;
  }

  /** Arrow keys step while the viewer is up. */
  handleKey(key) {
    if (key === "ArrowLeft") { this.pause(); this.seek(this.frame - 1); return true; }
    if (key === "ArrowRight") { this.pause(); this.seek(this.frame + 1); return true; }
    if (key === " ") { this.toggle(); return true; }
    return false;
  }
}
