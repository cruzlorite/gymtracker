// Rest timer. Lives outside the app's re-renders and stores the end time, so it stays accurate when
// switching screens or when the browser throttles a background tab.
import { t } from './i18n.js';
import { icon } from './icons.js';

const $bar = document.getElementById('restbar');
let end = 0;
let total = 0;
let tick = null;
let doneTimer = null;
let audio = null;
let wakeLock = null;

const fmt = (s) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
export const isRunning = () => end > Date.now();

function beep() {
  try {
    const ctx = audio;
    if (!ctx) return;
    [0, 0.25, 0.5].forEach((d, i) => {
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.frequency.value = i === 2 ? 1320 : 880;
      g.gain.setValueAtTime(0.0001, ctx.currentTime + d);
      g.gain.exponentialRampToValueAtTime(0.25, ctx.currentTime + d + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + d + 0.18);
      o.connect(g).connect(ctx.destination);
      o.start(ctx.currentTime + d);
      o.stop(ctx.currentTime + d + 0.2);
    });
  } catch { /* no audio */ }
}

async function keepAwake(on) {
  try {
    if (on && !wakeLock && navigator.wakeLock) wakeLock = await navigator.wakeLock.request('screen');
    if (!on && wakeLock) { await wakeLock.release(); wakeLock = null; }
  } catch { wakeLock = null; }
}

// The bar is built once and then only the time and progress are updated: rebuilding the HTML on every
// tick could swallow a tap on −15/+15 mid-click.
function build() {
  $bar.className = 'restbar show';
  $bar.innerHTML = `<div class="restbar-fill"></div>
    <div class="restbar-row">
      <span class="restbar-label">${icon('timer')} ${t('timer.rest')}</span>
      <strong class="restbar-time" aria-live="off"></strong>
      <span class="restbar-actions">
        <button class="chip-btn" data-timer="-15" aria-label="${t('timer.minus')}">−15</button>
        <button class="chip-btn" data-timer="15" aria-label="${t('timer.plus')}">+15</button>
        <button class="icon-btn" data-timer="stop" aria-label="${t('timer.skip')}">${icon('x')}</button>
      </span>
    </div>`;
}

function paint() {
  const left = Math.max(0, Math.ceil((end - Date.now()) / 1000));
  if (left <= 0) return finish();
  if (!$bar.querySelector('.restbar-time')) build();
  $bar.querySelector('.restbar-time').textContent = fmt(left);
  $bar.querySelector('.restbar-fill').style.width = `${total ? (1 - left / total) * 100 : 0}%`;
}

function finish() {
  clearInterval(tick); tick = null;
  end = 0;
  keepAwake(false);
  beep();
  navigator.vibrate?.([250, 120, 250]);
  $bar.className = 'restbar show done';
  $bar.innerHTML = `<div class="restbar-row"><span class="restbar-label">${icon('check')} ${t('timer.done')}</span>
    <button class="icon-btn" data-timer="stop" aria-label="${t('common.close')}">${icon('x')}</button></div>`;
  clearTimeout(doneTimer);
  doneTimer = setTimeout(stop, 6000);
}

/** Starts (or restarts) the rest. Call it from a click so the browser allows sound. */
export function start(seconds) {
  try {
    audio ||= new (window.AudioContext || window.webkitAudioContext)();
    audio.resume?.();
  } catch { audio = null; }
  clearTimeout(doneTimer);
  total = seconds;
  end = Date.now() + seconds * 1000;
  keepAwake(true);
  clearInterval(tick);
  build();
  tick = setInterval(paint, 250);
  paint();
}

/** Repaints labels after a language change. */
export function relabel() { if (isRunning()) { build(); paint(); } }

export function add(seconds) {
  if (!isRunning()) return;
  end = Math.max(Date.now() + 1000, end + seconds * 1000);
  total = Math.max(total + seconds, 1);
  paint();
}

export function stop() {
  clearInterval(tick); tick = null;
  clearTimeout(doneTimer);
  end = 0;
  keepAwake(false);
  $bar.className = 'restbar';
  $bar.innerHTML = '';
}

$bar.addEventListener('click', (e) => {
  const b = e.target.closest('[data-timer]');
  if (!b) return;
  if (b.dataset.timer === 'stop') stop();
  else add(Number(b.dataset.timer));
});
// The wake lock is lost when leaving the tab: take it again if the rest is still running.
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible' && isRunning()) { wakeLock = null; keepAwake(true); }
});
