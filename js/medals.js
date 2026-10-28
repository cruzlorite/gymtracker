// Procedural medals: one SVG per achievement, generated from its category, tier and value, so ~365
// achievements each get their own look without drawing any by hand.
//   shape   → category (circle, hexagon, seal, shield, diamond, flower, octagon)
//   metal   → tier (bronze, silver, gold, platinum) or grey while locked
//   ribbon  → category colour, with a stripe pattern picked from the achievement's key
//   rays    → count and style also picked from the key
//   centre  → the number to reach and its unit (60 kg, 100 días…), or an emoji for special days
const METALS = {
  bronze: ['#F2B98A', '#C77B45', '#7E4520', '#5C2F12'],
  silver: ['#FBFCFD', '#C9D0D8', '#8A949F', '#58616B'],
  gold: ['#FFF0A8', '#F2C232', '#B8860B', '#7A5600'],
  platinum: ['#F3FBFF', '#BFE3F5', '#7FA9C4', '#3E6A86'],
  locked: ['#F0F0EC', '#D5D5CF', '#ADADA6', '#8B8B85'],
};
const RIBBONS = {
  consistency: ['#5B8DEF', '#3D6CD1'], strength: ['#EB5757', '#C23B3B'], records: ['#F2994A', '#CC7428'],
  volume: ['#27AE60', '#1B8A4A'], variety: ['#9B51E0', '#7A33BF'], fun: ['#E056A0', '#BD3A80'], group: ['#2DCCD3', '#1BA4AA'],
};

function hash(s) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
  return h >>> 0;
}

/** Regular polygon or star around (50, 62): n points, alternating outer/inner radius when inner is set. */
function poly(n, outer, inner = null, rot = -90) {
  const pts = [];
  const steps = inner ? n * 2 : n;
  for (let i = 0; i < steps; i++) {
    const r = inner && i % 2 ? inner : outer;
    const a = ((rot + (360 / steps) * i) * Math.PI) / 180;
    pts.push(`${(50 + r * Math.cos(a)).toFixed(1)},${(62 + r * Math.sin(a)).toFixed(1)}`);
  }
  return `<polygon points="${pts.join(' ')}"/>`;
}

const SHAPES = {
  consistency: () => '<circle cx="50" cy="62" r="35"/>',
  strength: () => poly(6, 37, null, 0),
  records: () => poly(12, 38, 33),
  volume: () => '<path d="M50 25 L82 35 V62 C82 82 66 94 50 100 C34 94 18 82 18 62 V35 Z"/>',
  variety: () => '<rect x="25" y="37" width="50" height="50" rx="9" transform="rotate(45 50 62)"/>',
  fun: () => poly(16, 37, 33.5),
  group: () => poly(8, 37, null, -67.5),
};

/** Short number for the medal's face: 25000 → 25k, 7300 stays. */
function compact(text) {
  const v = Number(text);
  if (!Number.isFinite(v) || v < 1e4) return text;
  return v >= 1e6 ? `${+(v / 1e6).toFixed(1)}M` : `${Math.round(v / 1e3)}k`;
}
/** Main colour of a category's ribbon (share images use it as their glow). */
export const catColor = (cat) => (RIBBONS[cat] || RIBBONS.fun)[0];
const isEmoji = (s) => /\p{Extended_Pictographic}/u.test(s);

/**
 * @param {object} o
 * @param {string} o.key      achievement id (e.g. "lift-bench:60"), picks ribbon stripes and rays
 * @param {string} o.cat      achievement category
 * @param {string} o.metal    bronze | silver | gold | platinum
 * @param {boolean} o.locked  grey while not reached
 * @param {string} o.text     the threshold shown on the face (or an emoji)
 * @param {string} [o.unit]   small text under it (kg, days, weeks…)
 * @param {number} [o.size]
 */
export function medalSVG({ key, cat, metal, locked = false, text: raw, unit = '', size = 56 }) {
  const h = hash(key);
  const id = `md${h.toString(36)}${locked ? 'l' : ''}`;
  const [hi, mid, lo, ink] = METALS[locked ? 'locked' : metal] || METALS.bronze;
  const [rb, rbDark] = locked ? ['#C9C9C3', '#ADADA6'] : RIBBONS[cat] || RIBBONS.fun;
  const stripes = h % 3; // 0 plain, 1 centre stripe, 2 two stripes
  const rayCount = 12 + (h % 4) * 4;
  const rays = Array.from({ length: rayCount }, (_, i) => {
    const a = (Math.PI * 2 * i) / rayCount;
    return `<line x1="${(50 + 24.5 * Math.cos(a)).toFixed(1)}" y1="${(62 + 24.5 * Math.sin(a)).toFixed(1)}" x2="${(50 + 28.5 * Math.cos(a)).toFixed(1)}" y2="${(62 + 28.5 * Math.sin(a)).toFixed(1)}"/>`;
  }).join('');
  const text = compact(String(raw));
  const emoji = isEmoji(text);
  const fs = emoji ? 22 : text.length >= 5 ? 12.5 : text.length >= 4 ? 15 : text.length >= 3 ? 18 : 21;
  const shape = (SHAPES[cat] || SHAPES.consistency)();
  return `<svg xmlns="http://www.w3.org/2000/svg" class="medal ${locked ? 'locked' : metal}" width="${size}" height="${size * 1.12}" viewBox="0 0 100 112" role="img" aria-hidden="true">
    <defs>
      <linearGradient id="${id}g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${hi}"/><stop offset=".55" stop-color="${mid}"/><stop offset="1" stop-color="${lo}"/></linearGradient>
      <linearGradient id="${id}r" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${rb}"/><stop offset="1" stop-color="${rbDark}"/></linearGradient>
    </defs>
    <path d="M30 2 H46 L58 32 H42 Z" fill="url(#${id}r)"/><path d="M70 2 H54 L42 32 H58 Z" fill="url(#${id}r)"/>
    ${stripes === 1 ? `<path d="M36 2 H40 L50 26 L48 29 Z M64 2 H60 L50 26 L52 29 Z" fill="#fff" opacity=".45"/>` : ''}
    ${stripes === 2 ? `<path d="M33 2 H35.5 L46 30 H43.5 Z M41 2 H43.5 L54 30 H51.5 Z" fill="#fff" opacity=".35"/>` : ''}
    <g fill="${lo}" transform="translate(0 2)">${shape}</g>
    <g fill="url(#${id}g)" stroke="${ink}" stroke-opacity=".35" stroke-width="1.2">${shape}</g>
    <circle cx="50" cy="62" r="30" fill="none" stroke="${ink}" stroke-opacity=".28" stroke-width="1.4"/>
    <g stroke="${hi}" stroke-opacity=".6" stroke-width="1.6" stroke-linecap="round">${rays}</g>
    <circle cx="50" cy="62" r="22.5" fill="${mid}" stroke="${ink}" stroke-opacity=".3"/>
    <path d="M24 49 A29 29 0 0 1 49 33" fill="none" stroke="#fff" stroke-opacity=".55" stroke-width="2.4" stroke-linecap="round"/>
    <text x="50" y="${emoji ? 70 : unit ? 65 : 68}" text-anchor="middle" font-family="system-ui, -apple-system, Roboto, sans-serif" font-weight="800" font-size="${fs}" fill="${ink}"${emoji && locked ? ' opacity=".35" style="filter:grayscale(1)"' : ''}>${text}</text>
    ${unit ? `<text x="50" y="75" text-anchor="middle" font-family="system-ui, -apple-system, Roboto, sans-serif" font-weight="700" font-size="8" fill="${ink}" opacity=".8">${unit}</text>` : ''}
  </svg>`;
}
