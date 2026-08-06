/**
 * Placeholder portraits.
 *
 * These are NOT trying to be character art. Real art goes in /assets/portraits
 * and replaces this wholesale — see docs/DESIGN_BRIEF.md.
 *
 * But "missing image" and "deliberate silhouette" look completely different on
 * screen, and the game has to be presentable before the art exists. So each
 * character gets a rim-lit silhouette built from the appearance canon in
 * characters.json: you can tell Riley's bun from Olivia's long black hair from
 * Luke's buzz cut at a glance, which is all the viewport actually needs.
 */

const HAIR = {
  buzz: (s) =>
    `<path d="M98 148 Q100 88 150 86 Q200 88 202 148 Q196 108 150 104 Q104 108 98 148Z" fill="${s.hair}"/>`,

  short: (s) =>
    `<path d="M95 152 Q94 80 150 78 Q206 80 205 152 Q198 104 150 100 Q102 104 95 152Z" fill="${s.hair}"/>`,

  bob: (s) =>
    `<path d="M93 150 Q92 78 150 76 Q208 78 207 150 L207 214 Q200 224 192 214 L192 140
       Q186 104 150 100 Q114 104 108 140 L108 214 Q100 224 93 214Z" fill="${s.hair}"/>`,

  long: (s) =>
    `<path d="M92 148 Q90 76 150 74 Q210 76 208 148 L212 292 Q196 300 190 288 L188 142
       Q184 102 150 98 Q116 102 112 142 L110 288 Q104 300 88 292Z" fill="${s.hair}"/>`,

  wavy: (s) =>
    `<path d="M93 150 Q91 78 150 76 Q209 78 207 150 Q212 214 198 250 Q194 226 190 200
       L188 142 Q184 102 150 98 Q116 102 112 142 L110 200 Q106 226 102 250 Q88 214 93 150Z"
       fill="${s.hair}"/>`,

  bun: (s) =>
    `<circle cx="150" cy="66" r="27" fill="${s.hair}"/>
     <path d="M96 150 Q95 80 150 78 Q205 80 204 150 Q197 106 150 102 Q103 106 96 150Z" fill="${s.hair}"/>`,

  curly: (s) =>
    `<g fill="${s.hair}">
       <circle cx="150" cy="80" r="34"/><circle cx="108" cy="106" r="27"/>
       <circle cx="192" cy="106" r="27"/><circle cx="96" cy="148" r="22"/>
       <circle cx="204" cy="148" r="22"/><circle cx="122" cy="80" r="24"/>
       <circle cx="178" cy="80" r="24"/>
     </g>`,

  bald: () => ""
};

const SKIN = {
  pale: "#e2c6b4", fair: "#d9b79f", light: "#cfa98e",
  olive: "#b98f6d", tan: "#a87851", brown: "#8a5a3a", deep: "#5f3a26"
};

/** Silhouettes read as intent; a flat card reads as a bug. */
export function portraitSVG(person) {
  const hue = person.hue ?? 30;
  const look = person.look ?? {};
  const shade = {
    hair: `hsl(${hue} 18% 7%)`,
    body: `hsl(${hue} 20% 9%)`,
    skin: SKIN[look.skin] ?? SKIN.fair
  };

  const broad = look.build === "broad";
  const slim = look.build === "slim";
  const shoulderX = broad ? 44 : slim ? 74 : 60;
  const shoulderY = broad ? 248 : 258;
  const hair = (HAIR[look.hair] ?? HAIR.short)(shade);

  return `
<svg viewBox="0 0 300 400" xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="xMidYMax slice" aria-hidden="true">
  <defs>
    <linearGradient id="g${hue}" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%"  stop-color="hsl(${hue} 24% 20%)"/>
      <stop offset="62%" stop-color="hsl(${hue} 20% 11%)"/>
      <stop offset="100%" stop-color="hsl(${hue} 16% 6%)"/>
    </linearGradient>
    <radialGradient id="k${hue}" cx="26%" cy="24%" r="72%">
      <stop offset="0%"   stop-color="hsl(${hue} 62% 62%)" stop-opacity="0.30"/>
      <stop offset="100%" stop-color="hsl(${hue} 62% 62%)" stop-opacity="0"/>
    </radialGradient>
    <clipPath id="c${hue}"><rect width="300" height="400"/></clipPath>
  </defs>

  <g clip-path="url(#c${hue})">
    <rect width="300" height="400" fill="url(#g${hue})"/>
    <rect width="300" height="400" fill="url(#k${hue})"/>

    <!-- figure -->
    <path d="M${shoulderX} 400 Q${shoulderX + 46} ${shoulderY} 112 246 L188 246
             Q${242 - (shoulderX - 60)} ${shoulderY} ${300 - shoulderX} 400Z" fill="${shade.body}"/>
    <path d="M132 206 L168 206 L168 250 L132 250Z" fill="${shade.body}"/>
    <ellipse cx="150" cy="150" rx="53" ry="63" fill="${shade.body}"/>

    <!-- the only skin that shows: a thin lit edge, so it reads as a person not a shape -->
    <path d="M97 150 Q97 88 150 87 L150 213 Q97 212 97 150Z" fill="${shade.skin}" opacity="0.13"/>
    ${hair}

    <!-- rim light -->
    <path d="M96 152 Q95 86 150 84" fill="none" stroke="hsl(${hue} 70% 68%)"
          stroke-width="2.5" stroke-linecap="round" opacity="0.5"/>
    <path d="M${shoulderX + 12} 400 Q${shoulderX + 54} ${shoulderY + 6} 116 250"
          fill="none" stroke="hsl(${hue} 70% 68%)" stroke-width="2" stroke-linecap="round" opacity="0.28"/>

    <rect width="300" height="400" fill="none"/>
  </g>
</svg>`.trim();
}
