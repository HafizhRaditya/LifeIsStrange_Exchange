import { $, el, clear } from "../util/dom.js";
import { state } from "../engine/state.js";

/**
 * The Episode 1 set piece.
 *
 * The Script Bible is explicit: the eleven frames must be SHOWN, not described,
 * and if the engine can't frame-step, the scene needs a redesign rather than a
 * workaround. So this is a real frame-stepper — rendering is deterministic per
 * frame index, so stepping back retraces exactly what stepping forward drew.
 *
 * The scene does not advance until the player MARKS a frame inside the window.
 * Not "looked at it" — identified it. Fiz earns this beat and so should they.
 *
 * The fog is procedural because there is no footage yet. Swapping in real frames
 * means replacing drawFrame() with an image-sequence blit; the transport, the
 * gating and the timecode maths do not change.
 */

const W = 640, H = 360, TOTAL = 120, FPS = 24;
const RIBBON = 60;

// From this frame the fog retraces its own path for 11 frames, then continues
// forward from where it left off. The offset stays continuous — no seam, no
// dropped frames, no timecode skip. The weather simply goes backwards.
const ANOMALY_START = 61;
const ANOMALY_LEN = 11;
const DRIFT = 3.2;

function fogOffset(f) {
  if (f <= ANOMALY_START) return f * DRIFT;
  if (f <= ANOMALY_START + ANOMALY_LEN) return (ANOMALY_START - (f - ANOMALY_START)) * DRIFT;
  return (ANOMALY_START - ANOMALY_LEN + (f - ANOMALY_START - ANOMALY_LEN)) * DRIFT;
}

const inAnomaly = (f) => f > ANOMALY_START && f <= ANOMALY_START + ANOMALY_LEN;

/** Source timecode. Clip four sits at 00:04:41 — hh:mm:ss:ff as in the script. */
function timecode(f) {
  const total = 4 * 60 + 41 + f / FPS;
  const m = String(Math.floor(total / 60)).padStart(2, "0");
  const s = String(Math.floor(total % 60)).padStart(2, "0");
  return `00:${m}:${s}:${String(f % FPS).padStart(2, "0")}`;
}

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
    this.marked = null;
    this.playing = false;
    this.timer = null;
    this.resolve = null;
  }

  play(id) {
    return new Promise((resolve) => {
      this.resolve = resolve;
      this.id = id;
      this.frame = 0;
      this.marked = null;
      this.build();
      this.root.hidden = false;
      this.draw();
      this.start();
    });
  }

  build() {
    clear(this.root);

    const head = el("div", "anomaly__head");
    this.tc = el("span", "anomaly__tc");
    head.append(
      el("span", "anomaly__file", "EXCH_1104_B.mov"),
      el("span", "anomaly__spec", `${W}×${H} · ${FPS} FPS · ${TOTAL} FRAMES`),
      this.tc
    );

    const viewer = el("div", "anomaly__viewer");
    this.canvas = el("canvas", "anomaly__canvas");
    this.canvas.width = W;
    this.canvas.height = H;
    this.ctx = this.canvas.getContext("2d");
    viewer.append(this.canvas);

    const foot = el("div", "anomaly__foot");

    this.ribbon = el("div", "anomaly__ribbon");
    this.cells = Array.from({ length: RIBBON }, (_, i) => {
      const cell = el("button", "ribcell");
      cell.type = "button";
      cell.addEventListener("click", (e) => {
        e.stopPropagation();
        this.pause();
        this.seek(Math.round((i / (RIBBON - 1)) * (TOTAL - 1)));
      });
      this.ribbon.append(cell);
      return cell;
    });

    const controls = el("div", "anomaly__controls");
    const transport = el("div", "anomaly__transport");
    const btn = (label, fn) => {
      const b = el("button", "anomaly__btn", label);
      b.type = "button";
      b.addEventListener("click", (e) => { e.stopPropagation(); fn(); });
      return b;
    };

    this.playBtn = btn("❚❚", () => this.toggle());
    transport.append(
      btn("⟵ 10", () => { this.pause(); this.seek(this.frame - 10); }),
      btn("◀", () => { this.pause(); this.seek(this.frame - 1); }),
      this.playBtn,
      btn("▶", () => { this.pause(); this.seek(this.frame + 1); }),
      btn("10 ⟶", () => { this.pause(); this.seek(this.frame + 10); })
    );

    this.markBtn = el("button", "anomaly__mark", "Mark frame");
    this.markBtn.type = "button";
    this.markBtn.addEventListener("click", (e) => { e.stopPropagation(); this.mark(); });

    this.hint = el("span", "anomaly__hint", "Something in clip four keeps pulling your eye.");

    this.continueBtn = el("button", "anomaly__continue", "Stop looking");
    this.continueBtn.type = "button";
    this.continueBtn.hidden = true;
    this.continueBtn.addEventListener("click", (e) => { e.stopPropagation(); this.finish(); });

    controls.append(transport, this.markBtn, this.hint, this.continueBtn);
    foot.append(this.ribbon, controls);

    this.root.append(head, viewer, foot);
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

  toggle() { this.playing ? this.pause() : this.start(); }

  seek(f) {
    this.frame = ((f % TOTAL) + TOTAL) % TOTAL;
    this.draw();
  }

  /**
   * The gate. Marking a frame inside the window is the player saying "there" —
   * which is the whole beat. Marking elsewhere just moves the tick.
   */
  mark() {
    this.marked = this.frame;
    this.markBtn.classList.add("is-armed");
    this.markBtn.textContent = `Marked · f${String(this.frame).padStart(3, "0")}`;

    if (inAnomaly(this.frame)) {
      state.setFlags({ ep1_marked_the_frames: true });
      this.hint.textContent = "The fog is going the wrong way.";
      this.continueBtn.hidden = false;
    } else {
      this.hint.textContent = "Nothing wrong with that one. Keep looking.";
    }
    this.draw();
  }

  draw() {
    const ctx = this.ctx;
    const off = fogOffset(this.frame);

    const sky = ctx.createLinearGradient(0, 0, 0, H);
    sky.addColorStop(0, "#4a5058");
    sky.addColorStop(0.55, "#3a4048");
    sky.addColorStop(1, "#22272c");
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, W, H);

    ctx.fillStyle = "#1d2429";
    ctx.fillRect(0, 246, W, H - 246);

    ctx.fillStyle = "#151a1e";
    ctx.beginPath();
    ctx.moveTo(0, 262); ctx.lineTo(150, 240); ctx.lineTo(300, 250);
    ctx.lineTo(430, 236); ctx.lineTo(W, 258); ctx.lineTo(W, H); ctx.lineTo(0, H);
    ctx.closePath();
    ctx.fill();

    ctx.fillStyle = "#101417";
    ctx.fillRect(404, 138, 30, 104);
    ctx.beginPath();
    ctx.moveTo(404, 138); ctx.lineTo(414, 120); ctx.lineTo(422, 134);
    ctx.lineTo(434, 126); ctx.lineTo(434, 138);
    ctx.closePath();
    ctx.fill();

    ctx.globalCompositeOperation = "lighter";
    for (const b of BLOBS) {
      const span = W + 260;
      const x = (((b.x + off * b.v) % span) + span) % span - 130;
      const g = ctx.createRadialGradient(x, b.y, 0, x, b.y, b.r);
      g.addColorStop(0, `rgba(198,206,214,${b.a})`);
      g.addColorStop(1, "rgba(198,206,214,0)");
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(x, b.y, b.r, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalCompositeOperation = "source-over";

    ctx.fillStyle = "rgba(0,0,0,0.16)";
    for (let y = 0; y < H; y += 3) ctx.fillRect(0, y, W, 1);

    ctx.font = "10px ui-monospace, monospace";
    ctx.fillStyle = "rgba(217,164,65,0.75)";
    ctx.fillText(`f${String(this.frame).padStart(3, "0")}`, 10, 18);

    this.tc.textContent = timecode(this.frame);
    this.canvas.classList.toggle("is-marked", this.marked === this.frame);

    const cur = Math.round((this.frame / (TOTAL - 1)) * (RIBBON - 1));
    const mk = this.marked === null ? -1 : Math.round((this.marked / (TOTAL - 1)) * (RIBBON - 1));
    this.cells.forEach((cell, i) => {
      cell.classList.toggle("is-on", i === cur);
      cell.classList.toggle("is-marked", i === mk);
    });
  }

  finish() {
    this.pause();
    this.root.hidden = true;
    const resolve = this.resolve;
    this.resolve = null;
    resolve?.();
  }

  get isOpen() { return !this.root.hidden; }

  /** Arrow keys step while the viewer is up. */
  handleKey(key) {
    if (key === "ArrowLeft")  { this.pause(); this.seek(this.frame - 1); return true; }
    if (key === "ArrowRight") { this.pause(); this.seek(this.frame + 1); return true; }
    if (key === "m" || key === "M") { this.mark(); return true; }
    if (key === " ") { this.toggle(); return true; }
    return false;
  }
}
