// Rest timer. Lives outside the app's re-renders and stores the end time, so it stays accurate when
// switching screens or when the browser throttles a background tab.
//
// When it ends: a loud double alarm, a strong vibration (Android; iOS doesn't allow web vibration) and,
// if enabled and the app is in the background, a system notification. The last 3 seconds get short
// countdown beeps.
import { t } from './i18n.js';
import { icon } from './icons.js';

const $bar = document.getElementById('restbar');
let end = 0;
let total = 0;
let tick = null;
let endTimer = null;
let doneTimer = null;
let audio = null;
let wakeLock = null;
let notify = false;
let lastCountdown = 0;

const fmt = (s) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
export const isRunning = () => end > Date.now();

/** One tone; square waves sound much louder than sine at the same volume. */
function tone(freq, at, length, gain, type = 'square') {
  const ctx = audio;
  const o = ctx.createOscillator();
  const g = ctx.createGain();
  o.type = type;
  o.frequency.value = freq;
  g.gain.setValueAtTime(0.0001, ctx.currentTime + at);
  g.gain.exponentialRampToValueAtTime(gain, ctx.currentTime + at + 0.015);
  g.gain.setValueAtTime(gain, ctx.currentTime + at + length - 0.03);
  g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + at + length);
  o.connect(g).connect(ctx.destination);
  o.start(ctx.currentTime + at);
  o.stop(ctx.currentTime + at + length + 0.02);
}

function alarm() {
  try {
    if (!audio) return;
    audio.resume?.();
    // Two rounds of three rising beeps.
    for (const round of [0, 0.9]) {
      tone(880, round, 0.16, 0.45);
      tone(880, round + 0.22, 0.16, 0.45);
      tone(1320, round + 0.44, 0.3, 0.5);
    }
  } catch { /* no audio */ }
}

function countdownBeep() {
  try {
    if (!audio) return;
    audio.resume?.();
    tone(660, 0, 0.09, 0.3);
  } catch { /* no audio */ }
}

/** System notification, only useful when the app is in the background. Needs the service worker on Android. */
async function notifyDone() {
  if (!notify || document.visibilityState === 'visible') return;
  try {
    if (!('Notification' in window) || Notification.permission !== 'granted' || !navigator.serviceWorker) return;
    const reg = await navigator.serviceWorker.ready;
    await reg.showNotification(t('timer.done'), {
      body: t('timer.notifBody'), tag: 'gymtracker-rest', renotify: true,
      icon: 'icons/icon-192.png', badge: 'icons/icon-192.png', vibrate: [500, 200, 500, 200, 500],
    });
  } catch { /* notifications unavailable */ }
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
  $bar.classList.toggle('ending', left <= 3);
  // 3, 2, 1: a short beep and tap each second (only while the app is on screen).
  if (left <= 3 && left !== lastCountdown && document.visibilityState === 'visible') {
    lastCountdown = left;
    countdownBeep();
    navigator.vibrate?.(60);
  }
}

function finish() {
  clearInterval(tick); tick = null;
  clearTimeout(endTimer);
  end = 0;
  keepAwake(false);
  alarm();
  navigator.vibrate?.([500, 200, 500, 200, 500]);
  notifyDone();
  $bar.className = 'restbar show done';
  $bar.innerHTML = `<div class="restbar-row"><span class="restbar-label">${icon('check')} ${t('timer.done')}</span>
    <button class="icon-btn" data-timer="stop" aria-label="${t('common.close')}">${icon('x')}</button></div>`;
  clearTimeout(doneTimer);
  doneTimer = setTimeout(stop, 8000);
}

function schedule() {
  clearTimeout(endTimer);
  // A dedicated timeout for the exact end, on top of the 4-per-second repaint.
  endTimer = setTimeout(paint, Math.max(0, end - Date.now()) + 20);
}

/**
 * Starts (or restarts) the rest. Call it from a click so the browser allows sound.
 * @param {number} seconds
 * @param {{ notify?: boolean }} [opts] show a system notification if it ends while the app is in the background
 */
export function start(seconds, opts = {}) {
  try {
    audio ||= new (window.AudioContext || window.webkitAudioContext)();
    audio.resume?.();
  } catch { audio = null; }
  notify = Boolean(opts.notify);
  clearTimeout(doneTimer);
  total = seconds;
  end = Date.now() + seconds * 1000;
  lastCountdown = 0;
  keepAwake(true);
  clearInterval(tick);
  build();
  tick = setInterval(paint, 250);
  schedule();
  paint();
}

/** Repaints labels after a language change. */
export function relabel() { if (isRunning()) { build(); paint(); } }

export function add(seconds) {
  if (!isRunning()) return;
  end = Math.max(Date.now() + 1000, end + seconds * 1000);
  total = Math.max(total + seconds, 1);
  lastCountdown = 0;
  schedule();
  paint();
}

export function stop() {
  clearInterval(tick); tick = null;
  clearTimeout(endTimer);
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
// Back on screen: retake the wake lock (it's lost when leaving) and catch up at once.
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState !== 'visible') return;
  if (isRunning()) { wakeLock = null; keepAwake(true); paint(); } else if (end) paint();
});
