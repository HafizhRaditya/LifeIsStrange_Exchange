#!/usr/bin/env python3
"""
Generates the background plates as SVG.

Thirty-eight hand-written files would drift apart within a week. These are
composed from a small set of archetypes — room, corridor, exterior — so every
plate shares the same light behaviour, the same fog, and the same safe areas,
and the whole set can be regenerated when the palette moves.

    python tools/make_plates.py

Writes assets/bg/*.svg and css/plates.css. Both are generated: don't hand-edit
them, change the table below.

Composition rules, from docs/DESIGN_BRIEF.md — every archetype obeys them:
  · empty of people
  · standing eye height, slightly back
  · lower third quiet (the dialogue box covers it)
  · centre clear (portraits stand there)
  · diffuse light, almost no hard shadows
"""

import pathlib

W, H = 1920, 1080
ROOT = pathlib.Path(__file__).resolve().parent.parent
BG = ROOT / "assets" / "bg"

# Plates already built by hand; the generator leaves them alone.
HANDMADE = {"lighthouse-dusk", "pool-night"}


# ─────────────────────────────────────────────────────────── shared pieces ──

def defs(sky, key=None, fog=None, seed=7, floor_fade=0.72, vig=0.66):
    """Gradients and filters every plate uses."""
    out = ['<defs>']
    out.append(f'''<linearGradient id="sky" x1="0" y1="0" x2="0" y2="1">
      {"".join(f'<stop offset="{o}%" stop-color="{c}"/>' for o, c in sky)}
    </linearGradient>''')

    if key:
        cx, cy, r, col, op = key
        out.append(f'''<radialGradient id="key" cx="{cx}" cy="{cy}" r="{r}">
          <stop offset="0%" stop-color="{col}" stop-opacity="{op}"/>
          <stop offset="55%" stop-color="{col}" stop-opacity="{op*0.28:.3f}"/>
          <stop offset="100%" stop-color="{col}" stop-opacity="0"/>
        </radialGradient>''')

    if fog:
        fx, fy, r_, g_, b_, amp, off = fog
        out.append(f'''<filter id="fog" x="-30%" y="-60%" width="160%" height="260%"
          color-interpolation-filters="sRGB">
          <feTurbulence type="fractalNoise" baseFrequency="{fx} {fy}" numOctaves="4" seed="{seed}" result="n"/>
          <feColorMatrix in="n" type="matrix" values="
            0 0 0 0 {r_}  0 0 0 0 {g_}  0 0 0 0 {b_}  0 0 0 {amp} {off}"/>
        </filter>
        <linearGradient id="band" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stop-color="#fff" stop-opacity="0"/>
          <stop offset="34%" stop-color="#fff" stop-opacity="0.9"/>
          <stop offset="72%" stop-color="#fff" stop-opacity="0.7"/>
          <stop offset="100%" stop-color="#fff" stop-opacity="0"/>
        </linearGradient>''')

    out.append(f'''<radialGradient id="vig" cx="0.5" cy="0.48" r="0.8">
      <stop offset="42%" stop-color="#000" stop-opacity="0"/>
      <stop offset="100%" stop-color="#000" stop-opacity="{vig}"/>
    </radialGradient>
    <linearGradient id="floorFade" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#000" stop-opacity="0"/>
      <stop offset="100%" stop-color="#000" stop-opacity="{floor_fade}"/>
    </linearGradient>''')
    out.append('</defs>')
    return "".join(out)


def settle(floor_top=740):
    """Vignette plus a fade over the lower third, so the UI stays readable."""
    return (f'<rect width="{W}" height="{H}" fill="url(#vig)"/>'
            f'<rect y="{floor_top}" width="{W}" height="{H-floor_top}" fill="url(#floorFade)"/>')


def fog_band(y, h, opacity=0.5):
    return (f'<g mask="url(#fogMask{y})" opacity="{opacity}">'
            f'<rect x="-200" y="{y-40}" width="{W+400}" height="{h+80}" filter="url(#fog)"/></g>')


def fog_mask(y, h):
    return f'<mask id="fogMask{y}"><rect x="-200" y="{y}" width="{W+400}" height="{h}" fill="url(#band)"/></mask>'


def prop(kind, x, y, w, h, dark="#131619", rim=None, rim_op=0.35):
    """A silhouette against the back wall. Rim only on the lit side."""
    body = ""
    if kind == "block":
        body = f'<rect x="{x}" y="{y}" width="{w}" height="{h}" fill="{dark}"/>'
    elif kind == "shelf":
        rows = max(2, h // 62)
        body = f'<rect x="{x}" y="{y}" width="{w}" height="{h}" fill="{dark}"/>'
        for i in range(1, rows):
            yy = y + i * (h / rows)
            body += f'<rect x="{x}" y="{yy:.0f}" width="{w}" height="3" fill="#0a0c0e" opacity="0.8"/>'
    elif kind == "desk":
        body = (f'<rect x="{x}" y="{y}" width="{w}" height="{h*0.24:.0f}" fill="{dark}"/>'
                f'<rect x="{x+8}" y="{y+h*0.24:.0f}" width="14" height="{h*0.76:.0f}" fill="{dark}"/>'
                f'<rect x="{x+w-22}" y="{y+h*0.24:.0f}" width="14" height="{h*0.76:.0f}" fill="{dark}"/>')
    elif kind == "lockers":
        n = max(3, w // 78)
        body = f'<rect x="{x}" y="{y}" width="{w}" height="{h}" fill="{dark}"/>'
        for i in range(1, n):
            xx = x + i * (w / n)
            body += f'<rect x="{xx:.0f}" y="{y}" width="2.5" height="{h}" fill="#08090b" opacity="0.9"/>'
        body += f'<rect x="{x}" y="{y+h*0.42:.0f}" width="{w}" height="2" fill="#08090b" opacity="0.6"/>'
    elif kind == "window":
        body = f'<rect x="{x}" y="{y}" width="{w}" height="{h}" rx="3" fill="{dark}"/>'
        body += f'<rect x="{x+w/2-1.5:.0f}" y="{y}" width="3" height="{h}" fill="#06070a" opacity="0.7"/>'
    elif kind == "bed":
        body = (f'<rect x="{x}" y="{y+h*0.42:.0f}" width="{w}" height="{h*0.58:.0f}" fill="{dark}"/>'
                f'<rect x="{x}" y="{y}" width="{w*0.26:.0f}" height="{h*0.52:.0f}" rx="6" fill="{dark}"/>')
    elif kind == "pillar":
        body = f'<rect x="{x}" y="{y}" width="{w}" height="{h}" fill="{dark}"/>'
    elif kind == "mass":
        body = f'<ellipse cx="{x+w/2:.0f}" cy="{y+h}" rx="{w/2}" ry="{h}" fill="{dark}"/>'
    elif kind == "tree":
        body = (f'<rect x="{x+w/2-5:.0f}" y="{y+h*0.4:.0f}" width="10" height="{h*0.6:.0f}" fill="{dark}"/>'
                f'<path d="M{x+w/2} {y} L{x} {y+h*0.55:.0f} L{x+w} {y+h*0.55:.0f} Z" fill="{dark}" opacity="0.72"/>')

    if rim:
        body += (f'<rect x="{x+w-3}" y="{y}" width="3" height="{h}" fill="{rim}" opacity="{rim_op}"/>')
    return body


# ────────────────────────────────────────────────────────────── archetypes ──

def room(sky, key, props, floor_y=700, floor="#0e1114", windows=None,
         rim=None, seed=7, haze=None, vig=0.66):
    """Back wall, floor, a few silhouettes. The workhorse."""
    svg = [defs(sky, key, haze, seed, vig=vig)]
    if haze:
        svg.append(fog_mask(floor_y - 260, 320))
    svg.append(f'<rect width="{W}" height="{H}" fill="url(#sky)"/>')

    if windows:
        y, h, count, x0, gap = windows
        w = (W - 2 * x0 - (count - 1) * gap) / count
        for i in range(count):
            svg.append(prop("window", int(x0 + i * (w + gap)), y, int(w), h, "#1a232e"))

    if key:
        svg.append(f'<rect width="{W}" height="{H}" fill="url(#key)"/>')

    for p in props:
        svg.append(prop(*p, rim=rim))

    # floor: a flat band, slightly darker, no hard shadow
    svg.append(f'<rect y="{floor_y}" width="{W}" height="{H-floor_y}" fill="{floor}"/>')
    svg.append(f'<rect y="{floor_y-2}" width="{W}" height="2" fill="#000" opacity="0.35"/>')

    if haze:
        svg.append(fog_band(floor_y - 260, 320, 0.32))
    svg.append(settle(floor_y))
    return "".join(svg)


def corridor(sky, key, floor_y=760, vanish=(960, 500), doors=6,
             wall="#151a1f", floor="#0d1013", lights=True, seed=7, vig=0.7):
    """One-point perspective. Reads as depth without needing detail."""
    svg = [defs(sky, key, vig=vig)]
    svg.append(f'<rect width="{W}" height="{H}" fill="url(#sky)"/>')
    vx, vy = vanish

    # side walls as converging wedges
    svg.append(f'<path d="M0 0 L{vx-260} {vy-90} L{vx-260} {vy+150} L0 {H} Z" fill="{wall}"/>')
    svg.append(f'<path d="M{W} 0 L{vx+260} {vy-90} L{vx+260} {vy+150} L{W} {H} Z" fill="{wall}"/>')

    # door / locker rhythm receding on both sides
    for side in (-1, 1):
        for i in range(doors):
            t0 = i / doors
            t1 = (i + 0.62) / doors
            x0 = vx + side * (260 + (1 - t0) * (W * 0.62))
            x1 = vx + side * (260 + (1 - t1) * (W * 0.62))
            yt0 = vy - 90 + t0 * -170
            yb0 = vy + 150 + t0 * 300
            yt1 = vy - 90 + t1 * -170
            yb1 = vy + 150 + t1 * 300
            op = 0.85 - t0 * 0.45
            svg.append(f'<path d="M{x0:.0f} {yt0:.0f} L{x1:.0f} {yt1:.0f} L{x1:.0f} {yb1:.0f} '
                       f'L{x0:.0f} {yb0:.0f} Z" fill="#0b0e11" opacity="{op:.2f}"/>')

    # far end
    svg.append(f'<rect x="{vx-260}" y="{vy-90}" width="520" height="240" fill="#1b2229"/>')
    if key:
        svg.append(f'<rect width="{W}" height="{H}" fill="url(#key)"/>')

    if lights:
        for i in range(4):
            t = i / 4
            w_ = 200 - t * 150
            svg.append(f'<rect x="{vx-w_/2:.0f}" y="{120 + t*180:.0f}" width="{w_:.0f}" height="10" '
                       f'fill="#cfd8dd" opacity="{0.16 - t*0.03:.2f}"/>')

    svg.append(f'<rect y="{floor_y}" width="{W}" height="{H-floor_y}" fill="{floor}"/>')
    svg.append(f'<path d="M{vx-260} {vy+150} L{vx+260} {vy+150} L{W} {H} L0 {H} Z" fill="{floor}"/>')
    svg.append(settle(floor_y))
    return "".join(svg)


def exterior(sky, key, horizon=470, ground="#1b1f22", masses=(), fore=(),
             sea=None, fog_at=None, seed=11, vig=0.62):
    """Sky, horizon, a distant mass, something in the near ground."""
    haze = (0.0018, 0.012, 0.84, 0.87, 0.91, 1.3, -0.48) if fog_at else None
    svg = [defs(sky, key, haze, seed, vig=vig)]
    if fog_at:
        svg.append(fog_mask(fog_at, 300))
    svg.append(f'<rect width="{W}" height="{H}" fill="url(#sky)"/>')
    if key:
        svg.append(f'<rect width="{W}" height="{int(horizon*1.5)}" fill="url(#key)"/>')

    if sea:
        svg.append(f'<rect y="{horizon}" width="{W}" height="{sea[0]-horizon}" fill="{sea[1]}"/>')
        for i, yy in enumerate(range(horizon + 30, sea[0], 46)):
            svg.append(f'<path d="M-20 {yy} Q {300+i*90} {yy-7} {760+i*40} {yy+3} T {W+20} {yy-2}" '
                       f'fill="none" stroke="#8e8f88" stroke-opacity="0.09" stroke-width="2"/>')

    for m in masses:
        svg.append(prop(*m))

    gy = sea[0] if sea else horizon
    svg.append(f'<path d="M-20 {gy+10} Q {W*0.28:.0f} {gy-14} {W*0.52:.0f} {gy+8} '
               f'Q {W*0.78:.0f} {gy+26} {W+20} {gy+2} L{W+20} {H} L-20 {H} Z" fill="{ground}"/>')

    for f in fore:
        svg.append(prop(*f))

    if fog_at:
        svg.append(fog_band(fog_at, 300, 0.55))
    svg.append(settle(gy + 40))
    return "".join(svg)


# ──────────────────────────────────────────────────────────────── the table ──
# Palettes are pulled from css/theme.css. Cold blue stays reserved for night
# and water — see the design brief.

SLATE  = [(0, "#20242a"), (55, "#2a3037"), (100, "#171b20")]
WARM   = [(0, "#2a241f"), (52, "#38302a"), (100, "#1d1916")]
GREEN  = [(0, "#232a26"), (55, "#2c332c"), (100, "#161a17")]
CLINIC = [(0, "#2b3033"), (52, "#333a3d"), (100, "#1b1f21")]
NIGHT  = [(0, "#0d1116"), (55, "#131a21"), (100, "#080b0e")]
DUSKSKY= [(0, "#2a323d"), (44, "#3c4450"), (78, "#6a6560"), (100, "#8d7a5a")]
DAYSKY = [(0, "#3d4550"), (50, "#4d555f"), (100, "#6b6f70")]

AMBER  = "#d9a441"
COLD   = "#4d7a97"
BONE   = "#cfd8dd"
RUST   = "#b4623a"

PLATES = {
  # ── dorms & bedrooms ──────────────────────────────────────────────────────
  "dorm-morning": dict(kind="room", sky=WARM, key=(0.78, 0.26, 0.5, AMBER, 0.30),
      windows=(150, 300, 2, 1180, 70), rim=AMBER,
      props=[("bed", 190, 470, 430, 240), ("desk", 700, 560, 300, 150),
             ("block", 1060, 500, 90, 200)]),
  "dorm-night": dict(kind="room", sky=NIGHT, key=(0.62, 0.6, 0.42, COLD, 0.34),
      windows=(150, 300, 2, 1180, 70), rim=COLD, vig=0.72,
      props=[("bed", 190, 470, 430, 240), ("desk", 700, 560, 300, 150),
             ("block", 1060, 500, 90, 200)]),
  "riley-room": dict(kind="room", sky=WARM, key=(0.4, 0.4, 0.46, RUST, 0.24), rim=RUST,
      props=[("bed", 240, 480, 400, 230), ("shelf", 760, 380, 280, 300),
             ("desk", 1160, 560, 300, 150)]),
  "theo-room": dict(kind="room", sky=NIGHT, key=(0.58, 0.58, 0.44, COLD, 0.26), rim=COLD, vig=0.74,
      props=[("bed", 260, 490, 400, 220), ("block", 800, 540, 200, 170),
             ("shelf", 1140, 430, 240, 250)]),
  "taki-room": dict(kind="room", sky=GREEN, key=(0.46, 0.36, 0.5, "#8fa07a", 0.26), rim="#8fa07a",
      props=[("block", 210, 300, 520, 380), ("block", 780, 320, 420, 360),
             ("desk", 1300, 560, 300, 150)]),
  "calder-house": dict(kind="room", sky=[(0, "#1c1a20"), (55, "#241f2b"), (100, "#100e13")],
      key=(0.5, 0.42, 0.48, "#8f78b0", 0.24), rim="#8f78b0", vig=0.72,
      props=[("shelf", 250, 360, 300, 330), ("block", 700, 470, 240, 220),
             ("window", 1240, 260, 260, 300)]),
  "jones-house": dict(kind="room", sky=[(0, "#37342f"), (52, "#443f38"), (100, "#26241f")],
      key=(0.5, 0.3, 0.55, AMBER, 0.20), rim=AMBER, vig=0.6,
      props=[("block", 300, 470, 520, 230), ("pillar", 980, 250, 46, 450),
             ("block", 1220, 500, 400, 200)]),

  # ── school interiors ──────────────────────────────────────────────────────
  "library": dict(kind="room", sky=WARM, key=(0.42, 0.3, 0.52, AMBER, 0.26), rim=AMBER,
      props=[("shelf", 120, 280, 300, 420), ("shelf", 470, 280, 300, 420),
             ("desk", 900, 560, 420, 150), ("shelf", 1420, 280, 380, 420)]),
  "archive": dict(kind="room", sky=SLATE, key=(0.5, 0.22, 0.5, BONE, 0.14), rim=BONE, vig=0.76,
      props=[("shelf", 140, 250, 330, 450), ("shelf", 530, 250, 330, 450),
             ("shelf", 920, 250, 330, 450), ("shelf", 1320, 250, 330, 450)]),
  "media-lab": dict(kind="room", sky=NIGHT, key=(0.5, 0.52, 0.48, COLD, 0.40), rim=COLD, vig=0.74,
      props=[("desk", 200, 540, 460, 170), ("desk", 760, 540, 400, 170),
             ("desk", 1260, 540, 460, 170), ("block", 320, 440, 180, 110),
             ("block", 860, 440, 180, 110), ("block", 1400, 440, 180, 110)]),
  "science-lab": dict(kind="room", sky=GREEN, key=(0.52, 0.3, 0.5, "#93a682", 0.24), rim="#93a682",
      props=[("desk", 180, 520, 480, 190), ("desk", 760, 520, 400, 190),
             ("shelf", 1280, 330, 420, 350)]),
  "studio": dict(kind="room", sky=SLATE, key=(0.5, 0.26, 0.52, BONE, 0.18), rim=BONE,
      props=[("block", 220, 300, 300, 200), ("block", 620, 290, 300, 210),
             ("block", 1020, 305, 300, 195), ("desk", 1420, 550, 340, 160)]),
  "darkroom": dict(kind="room", sky=[(0, "#160a0c"), (55, "#1d0e11"), (100, "#080405")],
      key=(0.5, 0.44, 0.55, "#c8302f", 0.34), rim="#c8302f", vig=0.8, floor="#0a0507",
      props=[("desk", 260, 540, 480, 170), ("shelf", 900, 360, 260, 320),
             ("block", 1300, 430, 300, 250)]),
  "principal-office": dict(kind="room", sky=WARM, key=(0.68, 0.3, 0.48, AMBER, 0.22), rim=AMBER,
      props=[("shelf", 200, 320, 300, 360), ("desk", 700, 520, 560, 190),
             ("window", 1420, 230, 320, 330)]),
  "bathroom": dict(kind="room", sky=CLINIC, key=(0.5, 0.24, 0.5, BONE, 0.2), rim=BONE, floor="#151a1d",
      props=[("block", 180, 430, 380, 120), ("block", 700, 430, 380, 120),
             ("pillar", 1240, 300, 200, 400)]),
  "gym": dict(kind="room", sky=WARM, key=(0.5, 0.2, 0.55, AMBER, 0.2), rim=AMBER,
      windows=(140, 220, 4, 200, 90),
      props=[("block", 250, 500, 260, 200), ("block", 1420, 500, 260, 200)]),
  "cafeteria": dict(kind="room", sky=GREEN, key=(0.5, 0.2, 0.58, BONE, 0.2), rim=BONE,
      windows=(120, 250, 4, 180, 80),
      props=[("desk", 160, 560, 500, 150), ("desk", 760, 560, 400, 150),
             ("desk", 1280, 560, 500, 150)]),
  "bowling": dict(kind="room", sky=[(0, "#2b2119"), (52, "#37291d"), (100, "#1a1310")],
      key=(0.5, 0.34, 0.55, RUST, 0.34), rim=RUST, vig=0.7,
      props=[("block", 140, 380, 240, 320), ("block", 470, 380, 240, 320),
             ("block", 800, 380, 240, 320), ("block", 1130, 380, 240, 320),
             ("block", 1460, 380, 240, 320)]),
  "hospital": dict(kind="room", sky=CLINIC, key=(0.5, 0.18, 0.55, BONE, 0.26), rim=BONE,
      floor="#181d20", vig=0.58,
      props=[("bed", 250, 490, 420, 210), ("bed", 1080, 490, 420, 210),
             ("pillar", 900, 280, 60, 420)]),
  "nexus-voice": dict(kind="room", sky=[(0, "#0c0d13"), (52, "#151622"), (100, "#08090d")],
      key=(0.5, 0.5, 0.42, "#7a6ee0", 0.38), rim="#7a6ee0", vig=0.78, floor="#08090c",
      props=[("desk", 620, 560, 680, 150), ("block", 800, 430, 320, 130)]),

  # ── town interiors ────────────────────────────────────────────────────────
  "diner": dict(kind="room", sky=WARM, key=(0.24, 0.36, 0.5, AMBER, 0.34), rim=AMBER,
      windows=(230, 290, 2, 1120, 90),
      # the counter, and the half-burned photo behind it — plot-critical, visible
      # but not centred
      props=[("block", 120, 470, 640, 240), ("shelf", 260, 300, 300, 150),
             ("block", 900, 520, 260, 190)]),
  "gazette": dict(kind="room", sky=WARM, key=(0.38, 0.3, 0.5, AMBER, 0.24), rim=AMBER,
      props=[("desk", 180, 540, 520, 170), ("shelf", 800, 330, 300, 350),
             ("desk", 1240, 540, 480, 170)]),
  "police": dict(kind="room", sky=SLATE, key=(0.5, 0.22, 0.5, BONE, 0.18), rim=BONE, vig=0.7,
      props=[("desk", 220, 540, 500, 170), ("shelf", 840, 330, 280, 350),
             ("desk", 1260, 540, 460, 170)]),
  "cross-office": dict(kind="room", sky=SLATE, key=(0.5, 0.24, 0.56, BONE, 0.16), rim=BONE, vig=0.6,
      windows=(180, 420, 3, 260, 120),
      props=[("desk", 700, 540, 560, 170)]),
  "airport": dict(kind="room", sky=CLINIC, key=(0.5, 0.2, 0.6, BONE, 0.24), rim=BONE, vig=0.56,
      windows=(160, 340, 5, 130, 70),
      props=[("block", 240, 560, 340, 150), ("block", 800, 560, 340, 150),
             ("block", 1360, 560, 340, 150)]),
  "art-corridor": dict(kind="room", sky=SLATE, key=(0.5, 0.28, 0.5, BONE, 0.16), rim=BONE,
      props=[("block", 180, 300, 220, 260), ("block", 480, 310, 220, 250),
             ("block", 780, 300, 220, 260), ("block", 1080, 312, 220, 248),
             ("block", 1380, 300, 220, 260)]),

  # ── corridors ─────────────────────────────────────────────────────────────
  "hallway":       dict(kind="corridor", sky=SLATE, key=(0.5, 0.44, 0.5, BONE, 0.2), doors=7),
  "stairwell":     dict(kind="corridor", sky=SLATE, key=(0.5, 0.5, 0.45, BONE, 0.14),
                        vanish=(960, 560), doors=4, vig=0.76),
  "jones-landing": dict(kind="corridor", sky=[(0, "#191a1d"), (50, "#212227"), (100, "#0d0e10")],
                        key=(0.5, 0.88, 0.5, AMBER, 0.30), vanish=(960, 600), doors=3,
                        lights=False, vig=0.74),

  # ── exteriors ─────────────────────────────────────────────────────────────
  "quad": dict(kind="exterior", sky=DAYSKY, key=(0.62, 0.2, 0.5, BONE, 0.16), horizon=520,
      ground="#2b322b", fog_at=None,
      masses=[("mass", 60, 300, 300, 220, "#232a26"), ("mass", 1500, 320, 340, 200, "#232a26")],
      fore=[("tree", 240, 300, 150, 300, "#161a17"), ("tree", 1560, 330, 140, 270, "#161a17")]),
  "rear-steps": dict(kind="exterior", sky=[(0, "#1c2026"), (55, "#23282f"), (100, "#14171a")],
      key=(0.28, 0.72, 0.42, AMBER, 0.26), horizon=560, ground="#171b1e", vig=0.74,
      masses=[("block", 0, 200, 520, 380, "#12161a")],
      fore=[("block", 1200, 520, 720, 90, "#101315")]),
  "parking-lot": dict(kind="exterior", sky=[(0, "#1a1e23"), (52, "#22262c"), (100, "#0f1215")],
      key=(0.66, 0.62, 0.46, AMBER, 0.24), horizon=540, ground="#15181b", vig=0.74,
      masses=[("block", 120, 380, 400, 170, "#101315"), ("block", 640, 390, 380, 160, "#101315"),
              ("block", 1140, 380, 420, 170, "#101315")],
      fore=[("pillar", 1660, 250, 16, 330, "#0d0f11")]),
  "cliff-path": dict(kind="exterior", sky=DUSKSKY, key=(0.7, 0.36, 0.46, AMBER, 0.22),
      horizon=460, sea=(700, "#2c3540"), ground="#1b1e1c", fog_at=470,
      masses=[("mass", -80, 400, 460, 80, "#252c34")],
      fore=[("mass", 1420, 700, 700, 160, "#141614")]),
  "beach": dict(kind="exterior", sky=DUSKSKY, key=(0.44, 0.46, 0.5, AMBER, 0.26),
      horizon=470, sea=(760, "#2a333d"), ground="#2f3037", fog_at=480,
      masses=[("mass", 1500, 410, 500, 70, "#242a31")],
      fore=[("block", 180, 800, 300, 26, "#141517"), ("block", 1240, 840, 380, 22, "#141517")]),
  "harbour": dict(kind="exterior", sky=NIGHT, key=(0.56, 0.6, 0.5, COLD, 0.34),
      horizon=440, sea=(820, "#152230"), ground="#0d1319", vig=0.72,
      masses=[("block", 120, 300, 260, 150, "#0d1116"), ("block", 1500, 290, 300, 160, "#0d1116"),
              ("pillar", 700, 330, 18, 120, "#0d1116"), ("pillar", 1120, 320, 18, 130, "#0d1116")],
      fore=[("block", 0, 830, 2000, 40, "#0a0e12")]),
  "car": dict(kind="exterior", sky=[(0, "#0e1116"), (52, "#151a20"), (100, "#0a0d10")],
      key=(0.5, 0.42, 0.44, AMBER, 0.22), horizon=500, ground="#0c0f12", vig=0.8,
      masses=[("block", 0, 0, 260, 1080, "#090b0d"), ("block", 1660, 0, 260, 1080, "#090b0d")],
      fore=[("block", 0, 700, 1920, 60, "#0b0e11")]),

  # ── the dreams ────────────────────────────────────────────────────────────
  "dream": dict(kind="room", sky=[(0, "#0a0a0d"), (48, "#171020"), (100, "#060608")],
      key=(0.5, 0.44, 0.6, "#b43c3c", 0.30), rim="#b43c3c", vig=0.84, floor="#06060a",
      haze=(0.003, 0.02, 0.55, 0.5, 0.6, 1.5, -0.62), seed=41,
      props=[("block", 180, 430, 380, 280), ("block", 700, 460, 300, 250),
             ("block", 1180, 420, 420, 290)]),
}


def build(name, spec):
    kind = spec.pop("kind")
    fn = {"room": room, "corridor": corridor, "exterior": exterior}[kind]
    body = fn(**spec)
    return (f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {W} {H}" '
            f'width="{W}" height="{H}" preserveAspectRatio="xMidYMid slice">'
            f'<title>{name}</title>{body}</svg>\n')


def main():
    BG.mkdir(parents=True, exist_ok=True)
    written = []
    for name, spec in PLATES.items():
        (BG / f"{name}.svg").write_text(build(name, dict(spec)), encoding="utf-8")
        written.append(name)

    all_plates = sorted(written + list(HANDMADE))
    css = ["/* GENERATED by tools/make_plates.py — do not hand-edit.",
           "   One class per background. Swapping in photography means changing",
           "   the url() and nothing else; no JS knows these exist. */", ""]
    for name in all_plates:
        css.append(f'.bg--{name} {{ background: #0b0c0e url("../assets/bg/{name}.svg") center / cover no-repeat; }}')
    css.append('.bg--void { background: radial-gradient(circle at 50% 40%, #16181c, #08090b 70%); }')
    (ROOT / "css" / "plates.css").write_text("\n".join(css) + "\n", encoding="utf-8")

    total = sum((BG / f"{n}.svg").stat().st_size for n in all_plates)
    print(f"  wrote {len(written)} plates (+{len(HANDMADE)} handmade)")
    print(f"  css/plates.css: {len(all_plates)} rules")
    print(f"  assets/bg total: {total/1024:.0f} KB")


if __name__ == "__main__":
    main()
