// Share images: a workout, an achievement or a record drawn on a canvas, in story (9:16) or post (4:5)
// format, to hand to the phone's share sheet (Instagram, WhatsApp, TikTok…) or download.
// Cards arrive with every text already translated and formatted; this module only lays them out.
import { logo } from './icons.js';

const W = 1080;
const SIZES = { story: 1920, post: 1350 };
const FONT = '-apple-system, BlinkMacSystemFont, "SF Pro Display", "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif';
const INK = '#F4F4F5';
const MUTED = '#A1A1AA';
const ACCENT = '#C8F04A';
const GOLD = '#F2C232';
const UP = '#4ADE80';
const PAD = 90;

const font = (size, weight = 700) => `${weight} ${size}px ${FONT}`;

function svgImage(svg) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    const src = svg.includes('xmlns=') ? svg : svg.replace('<svg ', '<svg xmlns="http://www.w3.org/2000/svg" ');
    img.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(src)}`;
  });
}

/** Largest size ≤ max at which the text fits in width. */
function fit(ctx, text, max, width, weight = 700, min = 24) {
  let size = max;
  ctx.font = font(size, weight);
  while (size > min && ctx.measureText(text).width > width) { size -= 2; ctx.font = font(size, weight); }
  return size;
}

/** Splits text into at most `lines` lines that fit in width; the last one gets an ellipsis if needed. */
function wrap(ctx, text, width, lines = 2) {
  const words = String(text).split(' ');
  const out = [];
  let line = '';
  for (let i = 0; i < words.length; i++) {
    const next = line ? `${line} ${words[i]}` : words[i];
    if (ctx.measureText(next).width <= width || !line) { line = next; continue; }
    if (out.length === lines - 1) { line = `${line} ${words.slice(i).join(' ')}`; break; }
    out.push(line);
    line = words[i];
  }
  out.push(line);
  const last = out.length - 1;
  if (ctx.measureText(out[last]).width > width) {
    while (out[last].length > 1 && ctx.measureText(`${out[last]}…`).width > width) out[last] = out[last].slice(0, -1);
    out[last] += '…';
  }
  return out;
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.roundRect ? ctx.roundRect(x, y, w, h, r) : ctx.rect(x, y, w, h);
}

// ---------- blocks: each has a height and draws itself from a top y ----------
const spacer = (h) => ({ h, draw() {} });
function eyebrow(ctx, text, color = ACCENT) {
  return { h: 64, draw(y) {
    ctx.font = font(34, 800);
    if ('letterSpacing' in ctx) ctx.letterSpacing = '6px';
    ctx.fillStyle = color;
    ctx.textAlign = 'center';
    ctx.fillText(text.toUpperCase(), W / 2, y + 40);
    if ('letterSpacing' in ctx) ctx.letterSpacing = '0px';
  } };
}
function title(ctx, text, size = 76, color = INK, lines = 2) {
  ctx.font = font(size, 800);
  const ls = wrap(ctx, text, W - PAD * 2, lines);
  const lh = size * 1.14;
  return { h: ls.length * lh + 6, draw(y) {
    ctx.font = font(size, 800);
    ctx.fillStyle = color;
    ctx.textAlign = 'center';
    ls.forEach((l, i) => ctx.fillText(l, W / 2, y + size * 0.92 + i * lh));
  } };
}
function line(ctx, text, size = 40, color = MUTED, weight = 600) {
  const s = fit(ctx, text, size, W - PAD * 2, weight);
  return { h: s * 1.45, draw(y) {
    ctx.font = font(s, weight);
    ctx.fillStyle = color;
    ctx.textAlign = 'center';
    ctx.fillText(text, W / 2, y + s * 1.05);
  } };
}
function big(ctx, text, max = 160, color = ACCENT) {
  const s = fit(ctx, text, max, W - PAD * 2, 850);
  return { h: s * 1.2, draw(y) {
    ctx.font = font(s, 850);
    ctx.fillStyle = color;
    ctx.textAlign = 'center';
    ctx.fillText(text, W / 2, y + s * 0.95);
  } };
}
function pill(ctx, text, color = INK, bg = 'rgb(255 255 255 / .09)') {
  const s = fit(ctx, text, 36, W - PAD * 2 - 80, 700);
  ctx.font = font(s, 700);
  const w = ctx.measureText(text).width + 72;
  return { h: 92, draw(y) {
    ctx.fillStyle = bg;
    roundRect(ctx, (W - w) / 2, y + 6, w, 76, 38);
    ctx.fill();
    ctx.font = font(s, 700);
    ctx.fillStyle = color;
    ctx.textAlign = 'center';
    ctx.fillText(text, W / 2, y + 44 + s * 0.36);
  } };
}
function image(ctx, img, w) {
  const h = (w * img.height) / img.width;
  return { h, draw(y) { ctx.drawImage(img, (W - w) / 2, y, w, h); } };
}
function stats(ctx, items) {
  const col = (W - PAD * 2) / items.length;
  return { h: 170, draw(y) {
    ctx.fillStyle = 'rgb(255 255 255 / .06)';
    roundRect(ctx, PAD, y, W - PAD * 2, 160, 36);
    ctx.fill();
    items.forEach(([value, label], i) => {
      const cx = PAD + col * i + col / 2;
      const s = fit(ctx, value, 64, col - 30, 800);
      ctx.font = font(s, 800);
      ctx.fillStyle = INK;
      ctx.textAlign = 'center';
      ctx.fillText(value, cx, y + 82);
      ctx.font = font(28, 600);
      ctx.fillStyle = MUTED;
      ctx.fillText(label, cx, y + 128);
    });
  } };
}
function rows(ctx, list, rowH) {
  return { h: list.length * rowH, draw(y) {
    list.forEach((r, i) => {
      const top = y + i * rowH;
      if (i) { ctx.fillStyle = 'rgb(255 255 255 / .08)'; ctx.fillRect(PAD, top, W - PAD * 2, 2); }
      const mid = top + rowH / 2 + 13;
      if (r.more) {
        ctx.font = font(34, 600);
        ctx.fillStyle = MUTED;
        ctx.textAlign = 'center';
        ctx.fillText(r.more, W / 2, mid);
        return;
      }
      ctx.font = font(36, 700);
      const valueW = Math.min(ctx.measureText(r.value).width, 380);
      const prW = r.pr ? 56 : 0;
      ctx.fillStyle = r.pr ? GOLD : INK;
      ctx.textAlign = 'right';
      ctx.fillText(r.value, W - PAD, mid, 380);
      if (r.pr) ctx.fillText('🏆', W - PAD - valueW - 14, mid);
      ctx.font = font(38, 650);
      ctx.fillStyle = INK;
      ctx.textAlign = 'left';
      const [name] = wrap(ctx, r.name, W - PAD * 2 - valueW - prW - 40, 1);
      ctx.fillText(name, PAD, r.sub ? top + rowH / 2 - 4 : mid);
      if (r.sub) {
        ctx.font = font(27, 600);
        ctx.fillStyle = MUTED;
        ctx.fillText(r.sub, PAD, top + rowH / 2 + 34);
      }
    });
  } };
}

// ---------- cards ----------
async function blocksFor(ctx, card, format) {
  const story = format === 'story';
  if (card.type === 'workout') {
    const max = story ? 8 : 5;
    const list = card.rows.length > max ? [...card.rows.slice(0, max - 1), { more: card.more(card.rows.length - max + 1) }] : card.rows;
    return [eyebrow(ctx, card.eyebrow), title(ctx, card.title, 70, INK, 1), spacer(story ? 40 : 24), stats(ctx, card.stats),
      spacer(story ? 30 : 14), rows(ctx, list, story ? 112 : 104),
      ...(card.pills.length ? [spacer(story ? 30 : 10), ...card.pills.slice(0, story ? 2 : 1).map((p) => pill(ctx, p))] : [])];
  }
  if (card.type === 'achievement') {
    const medal = await svgImage(card.medal);
    return [eyebrow(ctx, card.eyebrow, card.color), spacer(story ? 30 : 6), image(ctx, medal, story ? 560 : 330), spacer(story ? 40 : 20),
      title(ctx, card.title, story ? 84 : 70), line(ctx, card.sub, 42, MUTED), spacer(story ? 30 : 12), pill(ctx, card.pill),
      ...(story && card.pill2 ? [pill(ctx, card.pill2, MUTED, 'transparent')] : [])];
  }
  // record
  return [eyebrow(ctx, card.eyebrow, GOLD), spacer(story ? 30 : 10), line(ctx, '🏆', story ? 150 : 110, INK), spacer(story ? 10 : 0),
    title(ctx, card.title, story ? 80 : 68), spacer(story ? 30 : 16), big(ctx, card.big, story ? 170 : 140), line(ctx, card.sub, 42, MUTED),
    spacer(story ? 40 : 20), pill(ctx, card.delta, card.up ? UP : INK, card.up ? 'rgb(74 222 128 / .14)' : 'rgb(255 255 255 / .09)')];
}

/** Draws a card. @returns {Promise<HTMLCanvasElement>} */
export async function render(card, format = 'story') {
  const H = SIZES[format] || SIZES.story;
  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d');
  // Background: near-black with a coloured glow behind the content and a faint one below.
  ctx.fillStyle = '#0B0B0D';
  ctx.fillRect(0, 0, W, H);
  const color = card.color || ACCENT;
  const glow = (x, y, r, alpha) => {
    const g = ctx.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, `${color}${Math.round(alpha * 255).toString(16).padStart(2, '0')}`);
    g.addColorStop(1, `${color}00`);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);
  };
  glow(W / 2, H * 0.42, W * 0.85, 0.22);
  glow(W * 0.1, H, W * 0.7, 0.1);

  // Brand on top.
  const top = format === 'story' ? 120 : 70;
  const mark = await svgImage(logo(64));
  ctx.drawImage(mark, PAD, top, 76, 76);
  ctx.font = font(42, 800);
  ctx.fillStyle = INK;
  ctx.textAlign = 'left';
  ctx.fillText('GymTracker', PAD + 100, top + 52);

  // Footer: who and when.
  const bottom = H - (format === 'story' ? 130 : 70);
  ctx.fillStyle = 'rgb(255 255 255 / .1)';
  ctx.fillRect(PAD, bottom - 96, W - PAD * 2, 2);
  ctx.font = font(36, 700);
  ctx.fillStyle = INK;
  ctx.fillText(card.name || '', PAD, bottom - 20, W / 2);
  ctx.font = font(32, 600);
  ctx.fillStyle = MUTED;
  ctx.textAlign = 'right';
  ctx.fillText(card.date || '', W - PAD, bottom - 20, W / 2 - PAD);

  // Content, centred in the space between.
  const blocks = await blocksFor(ctx, card, format);
  const areaTop = top + 120;
  const areaH = bottom - 110 - areaTop;
  const total = blocks.reduce((a, b) => a + b.h, 0);
  let y = areaTop + Math.max(0, (areaH - total) / 2);
  for (const b of blocks) { b.draw(y); y += b.h; }
  return canvas;
}

export const toBlob = (canvas) => new Promise((resolve) => canvas.toBlob(resolve, 'image/png'));
