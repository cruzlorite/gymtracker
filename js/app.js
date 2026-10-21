import * as G from './google.js';
import { DemoStore } from './demo.js';
import * as St from './stats.js';
import * as Ex from './exercises.js';
import * as Timer from './timer.js';
import { Outbox } from './outbox.js';
import { icon, logo, googleG } from './icons.js';
import { t, getLang, setLang, locale } from './i18n.js';

const $app = document.getElementById('app');
const $sheet = document.getElementById('sheet');
const $modal = document.getElementById('modal');
const $toast = document.getElementById('toast');

const COLORS = ['#5B8DEF', '#F2994A', '#27AE60', '#E056A0', '#9B51E0', '#2DCCD3', '#EB5757', '#F2C94C'];
const TABS = [['home', 'home'], ['log', 'dumbbell'], ['history', 'calendar'], ['progress', 'chart'], ['group', 'users']];
const CH_TYPES = ['attendance', 'volume', 'improvement', 'sets', 'reps', 'maxWeight', 'prs'];
const REST_OPTIONS = [60, 90, 120, 150, 180, 240];
const STEP_OPTIONS = [1, 1.25, 2.5, 5];

// ---------- per-device preferences ----------
const PREFS_KEY = 'gt:prefs';
const prefs = { rest: 90, autoRest: true, notify: false, volume: 0.8, vibration: 2, step: 2.5, theme: 'system' };
try { Object.assign(prefs, JSON.parse(localStorage.getItem(PREFS_KEY) || '{}')); } catch { /* no storage */ }
const savePrefs = () => { try { localStorage.setItem(PREFS_KEY, JSON.stringify(prefs)); } catch { /* ignore */ } };
function applyTheme() {
  if (prefs.theme === 'system') delete document.documentElement.dataset.theme;
  else document.documentElement.dataset.theme = prefs.theme;
  const dark = prefs.theme === 'dark' || (prefs.theme === 'system' && matchMedia('(prefers-color-scheme: dark)').matches);
  document.querySelector('meta[name=theme-color]')?.setAttribute('content', dark ? '#0B0B0D' : '#F7F7F5');
}

const params = new URLSearchParams(location.search);
const S = {
  store: null, me: null, groups: [], group: null, outbox: null,
  tab: 'home', groupTab: 'ranking', logFor: '',
  day: St.todayISO(), period: '30', month: St.todayISO().slice(0, 7), exercise: '', metric: 'e1rm', compare: true, profile: '',
  sheet: null, // { kind: 'picker', q, cat } | { kind: 'exercise', name, view, edit, w, r }
  pendingGroup: params.get('group'), needsPicker: null, chart: null, loadedAt: 0,
};

// ---------- helpers ----------
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const ls = {
  get: (k) => { try { return localStorage.getItem(k); } catch { return null; } },
  set: (k, v) => { try { localStorage.setItem(k, v); } catch { /* ignore */ } },
};
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
const cap = (s) => s.charAt(0).toLocaleUpperCase(locale()) + s.slice(1);

const fmtCache = new Map();
function cached(kind, opts, make) {
  const k = `${kind}|${locale()}|${JSON.stringify(opts)}`;
  if (!fmtCache.has(k)) fmtCache.set(k, make());
  return fmtCache.get(k);
}
const df = (opts) => cached('d', opts, () => new Intl.DateTimeFormat(locale(), opts));
const fmtN = (n, d = 0) => cached('n', d, () => new Intl.NumberFormat(locale(), { maximumFractionDigits: d })).format(n);
// Positive: load. 0: bodyweight. Negative: machine help on an assisted exercise (shown as −20 kg).
const fmtW = (w) => (w > 0 ? `${fmtN(w, 2)} kg` : w < 0 ? `−${fmtN(-w, 2)} kg` : t('unit.bw'));
const isAssisted = (name) => Boolean(Ex.exerciseInfo(name).assisted);
/** The weight field shows the help as a positive number on assisted exercises. */
const shownW = (name, w) => (isAssisted(name) && typeof w === 'number' ? Math.abs(w) : w);
const fmtKg = (n) => (n >= 10000 ? `${fmtN(n / 1000, 1)} t` : `${fmtN(n)} kg`);
const fmtPct = (p) => `${p > 0 ? '+' : ''}${fmtN(p * 100, 1)} %`;
const fmtDate = (iso) => df({ day: 'numeric', month: 'short' }).format(St.parseISO(iso));
const fmtLong = (iso) => cap(df({ weekday: 'long', day: 'numeric', month: 'long' }).format(St.parseISO(iso)));
const fmtMonth = (d) => cap(df({ month: 'long', year: 'numeric' }).format(d));
const daysAgo = (iso) => Math.round((St.parseISO(St.todayISO()) - St.parseISO(iso)) / 864e5);
const relDay = (iso) => cap(cached('r', 0, () => new Intl.RelativeTimeFormat(locale(), { numeric: 'auto' })).format(-daysAgo(iso), 'day'));
const numIn = (v) => { const n = parseFloat(String(v ?? '').replace(',', '.')); return Number.isFinite(n) ? n : 0; };
const showNum = (n) => (n === '' || n == null ? '' : String(n).replace('.', fmtN(1.5, 1).charAt(1)));

const members = () => S.group?.members || [];
const member = (email) => members().find((m) => m.email === email);
const entriesOf = (email) => S.group.entries.filter((e) => e.email === email);
const mine = () => entriesOf(S.me.email);
// Logging for someone else: the group creator always can (they own the sheet); others only when the
// group is in open mode. Everything in the Workout tab and the exercise sheet works on `target()`.
const canLogFor = (email) => email === S.me.email || Boolean(S.group?.openLogging || S.group?.isOwner);
const canLogForOthers = () => members().length > 1 && Boolean(S.group?.openLogging || S.group?.isOwner);
/** A group with only you in it: rankings, comparisons and the Group tab are hidden. */
const solo = () => members().length <= 1;
const visibleTabs = () => TABS.filter(([k]) => k !== 'group' || !solo());
const target = () => (S.logFor && S.logFor !== S.me.email && member(S.logFor) && canLogFor(S.logFor) ? S.logFor : S.me.email);
const targetEntries = () => entriesOf(target());
const usedNames = () => [...new Set(S.group?.entries.map((e) => e.exercise).filter(Boolean) || [])];

function initials(name) {
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]).join('').toUpperCase() || '?';
}
function avatar(m, size = '') {
  const pic = m.picture ? `<img src="${esc(m.picture)}" alt="" referrerpolicy="no-referrer" data-avatar-img>` : '';
  return `<span class="av ${size}" style="--c:${m.color || '#888'}" title="${esc(m.name)}">${esc(initials(m.name))}${pic}</span>`;
}
// Pictures that fail to load are removed so the initials show (no onerror attributes in the HTML).
document.addEventListener('error', (e) => { if (e.target.matches?.('[data-avatar-img]')) e.target.remove(); }, true);

// The toast is a popover so it lives in the browser's top layer: re-showing it puts it above an open
// modal dialog, whose blurred backdrop would otherwise cover it.
let toastTimer;
const popover = typeof $toast.showPopover === 'function';
function hideToast() {
  $toast.className = '';
  if (popover) setTimeout(() => { if (!$toast.classList.contains('show')) try { $toast.hidePopover(); } catch { /* already hidden */ } }, 250);
}
function toast(msg, { error = false, action, onAction, ic, duration } = {}) {
  clearTimeout(toastTimer);
  if (popover) {
    try { $toast.hidePopover(); } catch { /* not shown */ }
    $toast.showPopover();
  }
  $toast.className = `show${error ? ' error' : ''}`;
  $toast.innerHTML = `${ic ? icon(ic) : ''}<span>${esc(msg)}</span>${action ? `<button class="toast-btn" data-toast-action>${esc(action)}</button>` : ''}`;
  if (action) $toast.querySelector('[data-toast-action]').onclick = () => { hideToast(); onAction(); };
  toastTimer = setTimeout(hideToast, duration ?? (action ? 15000 : error ? 10000 : 3500));
}

async function run(fn) {
  document.body.classList.add('busy');
  try {
    await fn();
  } catch (e) {
    console.error(e);
    if (e?.name === 'AuthError') toast(e.message, { action: t('sync.reconnectShort'), onAction: reconnect });
    else toast(e?.message || t('err.generic'), { error: true });
  } finally {
    document.body.classList.remove('busy');
  }
}

function reconnect() {
  run(async () => {
    await G.signIn();
    S.outbox?.flush();
    if (S.group) await openGroup(S.group.id);
    else render();
    toast(t('sync.renewed'), { ic: 'check' });
  });
}

// ---------- session and groups ----------
function assignColors(g) {
  g.members.sort((a, b) => (a.joined || '9').localeCompare(b.joined || '9') || a.name.localeCompare(b.name, locale()));
  g.members.forEach((m, i) => { m.color = COLORS[i % COLORS.length]; });
}

function startSession(store, me, outboxKey) {
  S.store = store;
  S.me = me;
  S.outbox = new Outbox(outboxKey, store, me.email, () => { renderSync(); saveCache(); });
}

// ---------- local session and cache ----------
// The app remembers who is signed in and keeps a copy of the open group on the device, so it opens
// instantly (even offline or with an expired Google session) and sets can be logged right away.
const SESSION_KEY = 'gt:session';
const cacheKey = (email) => `gt:cache:${email}`;
const readJSON = (k) => { try { return JSON.parse(ls.get(k) || 'null'); } catch { return null; } };

function saveCache() {
  if (S.store?.kind !== 'google' || !S.me) return;
  ls.set(SESSION_KEY, JSON.stringify({ me: S.me }));
  if (S.group?.isMember) ls.set(cacheKey(S.me.email), JSON.stringify({ groups: S.groups, group: S.group }));
  else ls.set(cacheKey(S.me.email), JSON.stringify({ groups: S.groups, group: null }));
}

function clearCache() {
  if (S.me) { try { localStorage.removeItem(cacheKey(S.me.email)); } catch { /* no storage */ } }
  try { localStorage.removeItem(SESSION_KEY); } catch { /* no storage */ }
}

/** Reopens the last session from the device. Returns false if there's nothing to restore. */
function restoreSession() {
  const sess = readJSON(SESSION_KEY);
  if (!sess?.me?.email || !G.isConfigured() || S.pendingGroup) return false;
  startSession(new G.SheetStore(sess.me), sess.me, `gt:outbox:${sess.me.email}`);
  const cache = readJSON(cacheKey(sess.me.email));
  S.groups = cache?.groups || [];
  if (cache?.group?.id) showCachedGroup(cache.group);
  render();
  // With a still-valid token, refresh in the background to pick up friends' new workouts.
  if (G.tokenValid()) run(async () => { S.outbox.flush(); S.groups = await S.store.listGroups(); await (S.group ? openGroup(S.group.id) : afterLogin()); });
  return true;
}

/** Shows a group from the device copy (pending changes applied) while fresh data loads. */
function showCachedGroup(g) {
  g.entries = S.outbox.apply(g.id, g.entries || []);
  assignColors(g);
  Ex.setCustomExercises(g.exercises || []);
  S.group = g;
  S.profile = S.me.email;
}

async function afterLogin(groups) {
  S.groups = groups || await S.store.listGroups();
  S.outbox.flush();
  if (S.pendingGroup) return openPending(S.pendingGroup);
  const last = ls.get('gt:lastGroup');
  const g = S.groups.find((x) => x.id === last) || S.groups[0];
  if (g) return openGroup(g.id);
  render();
}

async function openGroup(id) {
  const g = await S.store.loadGroup(id);
  g.entries = S.outbox.apply(id, g.entries);
  assignColors(g);
  Ex.setCustomExercises(g.exercises || []);
  S.group = g;
  S.loadedAt = Date.now();
  if (!g.members.some((m) => m.email === S.profile)) S.profile = S.me.email;
  ls.set('gt:lastGroup', id);
  saveCache();
  render();
  if (S.sheet) renderSheet();
}

async function openPending(id) {
  try {
    await openGroup(id);
    S.pendingGroup = null;
    history.replaceState(history.state, '', location.pathname);
  } catch (e) {
    if (e.status === 403 || e.status === 404) { S.needsPicker = id; render(); return; }
    throw e;
  }
}

// ---------- sync ----------
function renderSync() {
  const el = document.getElementById('sync');
  if (!el) return;
  const o = S.outbox;
  const n = o?.pending || 0;
  // Restored session without a valid Google token: offer to connect (one tap) to sync and refresh.
  if (o && S.store.kind === 'google' && !G.tokenValid() && !o.busy) {
    el.innerHTML = `<button class="sync ${n ? 'warn' : 'connect'}" data-action="reconnect">${icon('cloudOff')}<span>${n ? t('sync.reconnect', { n }) : t('sync.connect')}</span></button>`;
    return;
  }
  if (!o || (!n && !o.busy)) { el.innerHTML = ''; return; }
  if (o.error?.auth) {
    el.innerHTML = `<button class="sync warn" data-action="reconnect">${icon('cloudOff')}<span>${t('sync.reconnect', { n })}</span></button>`;
  } else if (o.error && !o.busy) {
    el.innerHTML = `<button class="sync warn" data-action="sync-error">${icon('cloudOff')}<span>${t('sync.pending', { n })}</span></button>`;
  } else {
    el.innerHTML = `<span class="sync saving">${icon('cloud')}<span>${t('sync.saving')}</span></span>`;
  }
}

// ---------- main render ----------
function render() {
  if (S.chart) { S.chart.destroy(); S.chart = null; }
  document.documentElement.lang = getLang();
  if (S.booting) { $app.innerHTML = bootScreen(); return; }
  if (!S.store) { $app.innerHTML = landing(); return; }
  let body;
  if (S.needsPicker) body = joinScreen();
  else if (!S.group) body = noGroups();
  else if (!S.group.isMember) body = notMember();
  else body = suspiciousNote() + view();
  $app.innerHTML = shell(body);
  if (S.group?.isMember && S.tab === 'progress') mountChart();
  renderSync();
}

function view() {
  if (!visibleTabs().some(([k]) => k === S.tab)) S.tab = 'home';
  switch (S.tab) {
    case 'home': return viewHome();
    case 'log': return viewLog();
    case 'history': return viewHistory();
    case 'progress': return viewProgress();
    case 'group': return viewGroup();
    default: return viewLog();
  }
}

/** Shown between closing Google's sign-in window and the first data. */
function bootScreen() {
  return `<main class="boot" aria-busy="true">${logo(56)}<span class="spinner" aria-hidden="true"></span><p>${t('boot.loading')}</p>
    <div class="boot-late"><p class="fine">${t('boot.slow')}</p><button class="btn ghost" data-action="boot-cancel">${t('common.back')}</button></div></main>`;
}

function langToggle() {
  const other = getLang() === 'es' ? 'en' : 'es';
  return `<button class="lang-btn" data-action="lang" data-lang="${other}" aria-label="${t('settings.language')}">${icon('globe')}<span>${other.toUpperCase()}</span></button>`;
}

function landing() {
  const configured = G.isConfigured();
  return `<main class="landing">
    <header class="landing-top">
      <div class="brand">${logo(34)}<span class="wordmark">GymTracker</span></div>
      ${langToggle()}
    </header>
    <section class="hero">
      <div class="hero-copy">
        <p class="hero-badge">${icon('lock')} ${t('landing.badge')}</p>
        <h1>${t('landing.title')}</h1>
        <p class="lead">${t('landing.lead')}</p>
        ${S.pendingGroup ? `<p class="pill-note">${icon('userPlus')} ${t('landing.invited')}</p>` : ''}
        <div class="cta">
          ${configured
            ? (S.signingIn
              ? `<button class="btn-google" disabled aria-busy="true"><span class="spinner sm" aria-hidden="true"></span><span>${t('landing.opening')}</span></button>`
              : `<button class="btn-google" data-action="login">${googleG}<span>${t('landing.google')}</span></button>`)
            : `<div class="notice">${t('landing.notConfigured')}</div>`}
          <button class="btn ghost lg" data-action="demo">${t('landing.demo')}</button>
        </div>
        ${configured ? `<p class="fine">${icon('shield')} ${t('landing.driveHint')}</p>` : ''}
        ${installBanner()}
      </div>
      <div class="hero-visual" aria-hidden="true">${heroMock()}</div>
    </section>
    <section class="showcase">
      <h2>${t('landing.showcase')}</h2>
      <div class="feat-grid">${FEATURES.map((k) => `<article class="feat">
        <div class="feat-visual" aria-hidden="true">${featureVisual(k)}</div>
        <div class="feat-body"><h3>${t(`landing.${k}.title`, { n: Ex.librarySize() })}</h3><p>${t(`landing.${k}.text`, { n: Ex.librarySize() })}</p></div>
      </article>`).join('')}</div>
    </section>
    <section class="privacy-band">
      <div class="privacy-copy">
        <p class="eyebrow">${icon('lock')} ${t('landing.privacy.eyebrow')}</p>
        <h2>${t('landing.privacy.title')}</h2>
        <p class="lead">${t('landing.privacy.lead')}</p>
        <ul class="checks">${['p1', 'p2', 'p3', 'p4', 'p5'].map((k) => `<li>${icon('check')}<span>${t(`landing.privacy.${k}`)}</span></li>`).join('')}</ul>
      </div>
      <div class="flow" aria-label="${t('landing.privacy.diagram')}">
        <div class="node">${icon('phone')}<strong>${t('landing.privacy.you')}</strong><span>${t('landing.privacy.youSub')}</span></div>
        <div class="link"><i></i><span>${t('landing.privacy.direct')}</span><i></i></div>
        <div class="node google">${icon('sheet')}<strong>${t('landing.privacy.sheets')}</strong><span>${t('landing.privacy.sheetsSub')}</span></div>
        <div class="node none">${icon('server')}<strong>${t('landing.privacy.server')}</strong><span class="none-badge">${t('landing.privacy.serverNone')}</span></div>
      </div>
    </section>
    <footer class="landing-foot">
      <span>${t('landing.noServer')}</span>
      <span><a href="privacy.html">${t('common.privacy')}</a> · <a href="https://github.com/cruzlorite/gymtracker" target="_blank" rel="noopener">GitHub</a></span>
    </footer>
  </main>`;
}

// Landing feature cards, each with a small decorative mock of the real UI.
const FEATURES = ['log', 'timer', 'ranking', 'progress', 'library', 'offline'];

function featureVisual(k) {
  switch (k) {
    case 'log': return `<div class="mini-log">
      <div class="mini-step"><i>${icon('minus')}</i><b>${fmtN(82.5, 1)}</b><i>${icon('plus')}</i></div>
      <div class="mini-step"><i>${icon('minus')}</i><b>6</b><i>${icon('plus')}</i></div>
      <div class="mini-save">${icon('check')} ${t('ex.save')}</div></div>`;
    case 'timer': return `<div class="mini-timer"><div style="width:58%"></div>
      <span>${icon('timer')} ${t('timer.rest')}</span><b>1:24</b><em>−15</em><em>+15</em></div>`;
    case 'ranking': return `<ol class="mini-board">${[['Ana', 18, '#5B8DEF'], [t('common.you'), 16, '#E056A0'], ['Pablo', 12, '#F2994A']].map(([n, v, c], i) =>
      `<li><span class="pos p${i + 1}">${i + 1}</span><span class="av" style="--c:${c}">${esc(n[0])}</span><span>${esc(n)}</span><span class="bar"><i style="width:${v / 18 * 100}%;background:${c}"></i></span><b>${t('unit.days', { n: v })}</b></li>`).join('')}</ol>`;
    case 'progress': return `<div class="mini-chart">
      <svg viewBox="0 0 220 90" preserveAspectRatio="none"><path class="area" d="M0 78 L30 70 L60 72 L90 58 L120 52 L150 44 L180 30 L220 22 L220 90 L0 90Z"/><path class="line" d="M0 78 L30 70 L60 72 L90 58 L120 52 L150 44 L180 30 L220 22"/><circle cx="220" cy="22" r="4"/></svg>
      <span class="mini-pr">${icon('trophy')} ${t('metric.e1rm')} · 105 kg</span></div>`;
    case 'library': return `<div class="mini-lib">
      <div class="mini-search">${icon('search')} rdl</div>
      ${['Romanian deadlift', 'Dumbbell Romanian deadlift', 'Single-leg Romanian deadlift'].map((n) => `<div class="mini-row"><span class="cat-dot" style="--c:#1A9C8C"></span>${esc(Ex.exName(n))}</div>`).join('')}</div>`;
    case 'offline': return `<div class="mini-offline">
      <span class="sync warn">${icon('wifiOff')} ${t('landing.offline.pill1')}</span>
      <span class="mini-arrow">${icon('down')}</span>
      <span class="sync connect">${icon('check')} ${t('landing.offline.pill2')}</span></div>`;
    default: return '';
  }
}

/** Decorative mock of the logging screen for the landing page. */
function heroMock() {
  const name = Ex.exName('Bench press');
  return `<div class="mock">
    <div class="mock-head"><span class="cat-dot" style="--c:#EB5757"></span><strong>${esc(name)}</strong><span class="muted">${t('day.today')}</span></div>
    <div class="mock-steppers">
      <div class="mock-step"><span>${t('ex.weight')}</span><div><i>${icon('minus')}</i><b>${fmtN(82.5, 1)}</b><i>${icon('plus')}</i></div></div>
      <div class="mock-step"><span>${t('ex.reps')}</span><div><i>${icon('minus')}</i><b>6</b><i>${icon('plus')}</i></div></div>
    </div>
    <div class="mock-save">${icon('check')} ${t('ex.save')}</div>
    <ol class="mock-sets">
      <li><span>1</span><b>${fmtW(80)}</b><em>× 8</em></li>
      <li><span>2</span><b>${fmtW(82.5)}</b><em>× 6</em><span class="pr">${icon('trophy')}</span></li>
      <li><span>3</span><b>${fmtW(82.5)}</b><em>× 6</em></li>
    </ol>
    <div class="mock-timer"><div style="width:62%"></div><span>${icon('timer')} ${t('timer.rest')}</span><b>0:34</b></div>
  </div>`;
}

function shell(content) {
  const me = S.me;
  const g = S.group;
  const tabs = g?.isMember && !S.needsPicker;
  return `<div class="shell ${tabs ? 'has-nav' : ''}">
    ${tabs ? `<nav class="nav" aria-label="${t('nav.label')}">
      <button class="nav-brand" data-action="tab" data-tab="home" aria-label="${t('nav.home')}">${logo(30)}<span class="wordmark">GymTracker</span></button>
      ${visibleTabs().map(([k, ic]) => `<button class="nav-item ${S.tab === k ? 'on' : ''}" data-action="tab" data-tab="${k}" ${S.tab === k ? 'aria-current="page"' : ''}>
        ${icon(ic)}<span>${t(`nav.${k}`)}</span></button>`).join('')}
    </nav>` : ''}
    <div class="page">
      <header class="appbar">
        ${tabs ? `<button class="appbar-logo" data-action="tab" data-tab="home" aria-label="${t('nav.home')}">${logo(28)}</button>` : `<span class="appbar-logo">${logo(28)}</span>`}
        ${S.groups.length || g ? `<button class="group-btn" data-action="group-menu"><span>${esc(g?.name || t('group.groups'))}</span>${icon('down')}</button>` : '<span class="wordmark">GymTracker</span>'}
        <span class="spacer"></span>
        <span id="sync"></span>
        <button class="avatar-btn" data-action="settings" aria-label="${t('settings.title')}">${avatar({ ...me, color: member(me.email)?.color || COLORS[0] })}</button>
      </header>
      ${S.store.kind === 'demo' ? `<div class="demo-bar">${t('demo.bar')}</div>` : ''}
      <main class="main main-${S.tab}">${content}</main>
    </div>
  </div>`;
}

function emptyState(ic, title, text, actions = '') {
  return `<section class="empty"><div class="empty-ic">${icon(ic)}</div><h2>${title}</h2><p>${text}</p>${actions}</section>`;
}

function joinScreen() {
  return emptyState('userPlus', t('join.title'), t('join.text'),
    `<button class="btn primary lg" data-action="pick-join">${t('join.button')}</button>
    <p class="fine">${t('join.notListed', { email: esc(S.me.email) })}</p>
    ${S.groups.length ? `<button class="btn ghost" data-action="cancel-join">${t('common.notNow')}</button>` : ''}`);
}

function noGroups() {
  return `<section class="empty"><div class="empty-ic">${icon('dumbbell')}</div><h2>${t('groups.emptyTitle')}</h2><p>${t('groups.emptyText')}</p></section>
    <div class="start-grid">
      <article class="card start-card">
        <span class="feature-ic">${icon('lock')}</span>
        <h3>${t('groups.soloTitle')}</h3><p class="muted">${t('groups.soloText')}</p>
        <button class="btn primary block" data-action="create-solo">${t('groups.soloButton')}</button>
      </article>
      <article class="card start-card">
        <span class="feature-ic">${icon('users')}</span>
        <h3>${t('groups.friendsTitle')}</h3><p class="muted">${t('groups.friendsText')}</p>
        <form class="inline-form" data-form="create-group">
          <input name="name" required maxlength="60" placeholder="${t('groups.namePlaceholder')}" aria-label="${t('groups.name')}">
          <button class="btn primary">${t('groups.createShort')}</button>
        </form>
      </article>
    </div>
    ${S.store.kind === 'google' ? `<p class="center"><button class="btn ghost" data-action="pick-any">${icon('sheet')} ${t('groups.pickShared')}</button></p>` : ''}`;
}

function notMember() {
  return emptyState('flag', esc(S.group.name), t('join.notMember'),
    `<button class="btn primary lg" data-action="join-current">${t('join.button')}</button>`);
}

/** Tabs named after someone who doesn't control them are ignored and flagged (usually only the group creator sees this). */
function suspiciousNote() {
  const s = S.group.suspicious || [];
  if (!s.length) return '';
  return `<p class="notice warn">${icon('shield')}<span>${t('suspicious', { n: s.length, tabs: s.map(esc).join(', ') })}
    ${S.group.url ? ` <a href="${esc(S.group.url)}" target="_blank" rel="noopener">${t('suspicious.open')}</a>` : ''}</span></p>`;
}

/** "Logging for" chips on the Workout tab, when you may log sets for other members. */
/** "Logging for" as a small pill; tapping it lists the members. Highlighted while logging for someone else. */
function logForPicker() {
  if (!canLogForOthers()) return '';
  const who = member(target());
  const other = who.email !== S.me.email;
  return `<div class="for-row">
      <button class="for-pill ${other ? 'other' : ''}" data-action="log-for-menu" aria-label="${t('log.for')}">${avatar(who)}
        <span>${t('log.forShort', { name: esc(other ? who.name.split(' ')[0] : t('common.you')) })}</span>${icon('down')}</button>
      ${other ? `<button class="icon-btn sm" data-action="log-for" data-e="${esc(S.me.email)}" aria-label="${t('log.forBack')}">${icon('x')}</button>` : ''}
    </div>`;
}

function logForMenu() {
  const who = target();
  const list = [...members()].sort((a, b) => (a.email === S.me.email ? -1 : b.email === S.me.email ? 1 : 0));
  openModal(`${modalHead(t('log.for'))}
    <ul class="menu">${list.map((m) => `<li><button class="menu-item ${m.email === who ? 'on' : ''}" data-action="log-for" data-e="${esc(m.email)}">
      ${avatar(m)}<span>${esc(m.email === S.me.email && m.name !== t('common.you') ? `${m.name} (${t('common.you')})` : m.name)}</span>${m.email === who ? icon('check') : ''}</button></li>`).join('')}</ul>`);
}

// ---------- Home ----------
function viewHome() {
  const es = mine();
  const today = St.todayISO();
  const first = (S.me.name || '').split(' ')[0];
  const todays = es.filter((e) => e.date === today && e.exercise);
  const todayEx = new Set(todays.map((e) => e.exercise)).size;
  const todaySets = todays.reduce((a, e) => a + (e.sets || 1), 0);
  const ws = St.weekStart(today);
  const inRange = (e, from, to) => e.date >= from && e.date <= to;
  const week = { from: ws, to: St.addDays(ws, 6) };
  const lastWeek = { from: St.addDays(ws, -7), to: St.addDays(ws, -1) };
  const trained = new Set(es.filter((e) => inRange(e, week.from, week.to)).map((e) => e.date));
  const weekDays = Array.from({ length: 7 }, (_, i) => St.addDays(ws, i));
  const monthFrom = `${today.slice(0, 8)}01`;
  const monthSets = es.filter((e) => e.exercise && inRange(e, monthFrom, today));
  // Weekly volume, last 8 weeks (oldest first).
  const weeks = Array.from({ length: 8 }, (_, i) => St.addDays(ws, -7 * (7 - i)));
  const vols = weeks.map((w) => St.volume(es, { from: w, to: St.addDays(w, 6) }));
  const maxVol = Math.max(...vols, 1);
  // Sets per muscle group this month.
  const byCat = new Map();
  for (const e of monthSets) { const c = Ex.categoryOf(e.exercise); byCat.set(c.id, (byCat.get(c.id) || 0) + (e.sets || 1)); }
  const cats = [...byCat].sort((a, b) => b[1] - a[1]).map(([id, n]) => ({ c: Ex.CATEGORIES.find((x) => x.id === id), n }));
  const maxCat = Math.max(...cats.map((x) => x.n), 1);
  const prs = St.prIds(es);
  const recentPrs = es.filter((e) => prs.has(e.id)).sort((a, b) => (a.date < b.date ? 1 : -1)).slice(0, 5);
  // What the rest of the group did in the last 7 days.
  const since = St.addDays(today, -6);
  const activity = [];
  for (const m of members()) {
    if (m.email === S.me.email) continue;
    for (const [date, list] of groupByDate(entriesOf(m.email).filter((e) => e.exercise && e.date >= since))) activity.push({ m, date, ex: [...new Set(list.map((e) => e.exercise))] });
  }
  activity.sort((a, b) => (a.date < b.date ? 1 : -1));

  return `<div class="home-head">
      <h1>${S.store.kind === 'demo' || !first ? t('home.helloAnon') : t('home.hello', { name: esc(first) })}</h1>
      <p class="muted">${fmtLong(today)}</p>
    </div>
    <section class="card today-card ${todays.length ? 'done' : ''}">
      ${todays.length
        ? `<div><h2>${t('home.todayDone', { summary: `${fmtN(todayEx)} ${t('log.exercises', { n: todayEx })} · ${t('log.sets', { n: todaySets })}` })}</h2></div>
           <button class="btn primary lg" data-action="go-log">${icon('dumbbell')} ${t('home.continue')}</button>`
        : `<div><h2>${t('home.todayEmpty')}</h2><p class="muted">${t('home.todayEmptyText')}</p></div>
           <button class="btn primary lg" data-action="start-workout">${icon('plus')} ${t('home.start')}</button>`}
    </section>
    <div class="home-tiles">
      <div class="tile week-tile"><span>${t('home.week')}</span>
        <div class="week-dots">${weekDays.map((d) => `<i class="${trained.has(d) ? 'on' : ''} ${d === today ? 'today' : ''}" title="${esc(fmtLong(d))}">${df({ weekday: 'narrow' }).format(St.parseISO(d))}</i>`).join('')}</div>
        <em>${t('home.lastWeek', { n: St.attendance(es, lastWeek) })}</em></div>
      <div class="tile"><span>${t('ranking.streak')}</span><strong>${t('unit.weeks', { n: fmtN(St.weekStreak(es)) })}</strong></div>
      <div class="tile"><span>${t('home.month')}</span><strong>${t('home.sessions', { n: fmtN(St.attendance(es, { from: monthFrom, to: today })) })}</strong></div>
      <div class="tile"><span>${t('home.weekVolume')}</span><strong>${fmtKg(St.volume(es, week))}</strong></div>
    </div>
    <div class="grid two">
      <section class="card">
        <h3>${icon('chart')} ${t('home.volumeTrend')}</h3>
        <div class="vol-bars">${vols.map((v, i) => `<div class="vol-col ${i === 7 ? 'now' : ''}" title="${fmtKg(v)}"><i style="height:${Math.max(v ? 4 : 0, v / maxVol * 100)}%"></i><span>${df({ day: 'numeric', month: 'short' }).format(St.parseISO(weeks[i]))}</span></div>`).join('')}</div>
      </section>
      <section class="card">
        <h3>${icon('dumbbell')} ${t('home.muscles')}</h3>
        ${cats.length ? `<ul class="cat-bars">${cats.map(({ c, n }) => `<li><span class="cat-name"><span class="cat-dot" style="--c:${c.color}"></span>${esc(Ex.catLabel(c))}</span>
          <span class="bar"><i style="width:${n / maxCat * 100}%;background:${c.color}"></i></span><b>${fmtN(n)}</b></li>`).join('')}</ul>`
          : `<p class="muted">${t('home.musclesEmpty')}</p>`}
      </section>
      <section class="card">
        <h3>${icon('trophy')} ${t('home.prs')}</h3>
        ${recentPrs.length ? `<ul class="pr-list">${recentPrs.map((e) => `<li><button class="link" data-action="open-ex" data-name="${esc(e.exercise)}">${esc(Ex.exName(e.exercise))}</button>
          <span>${fmtW(e.weight)} × ${fmtN(e.reps)}</span><span class="muted">${relDay(e.date)}</span></li>`).join('')}</ul>`
          : `<p class="muted">${t('home.noPrs')}</p>`}
      </section>
      ${solo() ? '' : `<section class="card">
        <h3>${icon('users')} ${t('home.activity')}</h3>
        ${activity.length ? `<ul class="activity">${activity.slice(0, 6).map(({ m, date, ex }) => `<li>${avatar(m)}<div><strong>${esc(m.name)}</strong>
          <span class="muted">${ex.slice(0, 3).map((n) => esc(Ex.exName(n))).join(', ')}${ex.length > 3 ? ` +${ex.length - 3}` : ''}</span></div><span class="muted">${relDay(date)}</span></li>`).join('')}</ul>`
          : `<p class="muted">${t('home.noActivity')}</p>`}
      </section>`}
    </div>`;
}

function groupByDate(es) {
  const m = new Map();
  for (const e of es) { if (!m.has(e.date)) m.set(e.date, []); m.get(e.date).push(e); }
  return m;
}

// ---------- Workout ----------
function setLine(e, i, prs) {
  const main = e.sets > 1
    ? `<b>${e.sets} × ${fmtN(e.reps)}</b><span class="muted"> · ${fmtW(e.weight)}</span>`
    : `<b>${fmtW(e.weight)}</b><span class="x">×</span><b>${fmtN(e.reps)}</b>`;
  return `<span class="set-n">${i + 1}</span><span class="set-main">${main}</span>${prs.has(e.id) ? `<span class="pr" title="${t('ex.pr')}">${icon('trophy')}</span>` : ''}`;
}

function groupByExercise(es) {
  const m = new Map();
  for (const e of es) {
    if (!m.has(e.exercise)) m.set(e.exercise, []);
    m.get(e.exercise).push(e);
  }
  return m;
}

function viewLog() {
  const today = St.todayISO();
  const day = S.day;
  const all = targetEntries();
  const es = all.filter((e) => e.date === day);
  const byEx = groupByExercise(es.filter((e) => e.exercise));
  const attendance = es.filter((e) => !e.exercise);
  const prs = St.prIds(all);
  const sets = [...byEx.values()].reduce((a, l) => a + l.reduce((b, e) => b + (e.sets || 1), 0), 0);
  const vol = St.volume(es);

  const nav = `<div class="daynav">
    <button class="icon-btn" data-action="day" data-d="${St.addDays(day, -1)}" aria-label="${t('day.prev')}">${icon('left')}</button>
    <label class="daynav-label">
      <span class="daynav-rel">${day === today || daysAgo(day) === 1 ? relDay(day) : cap(df({ weekday: 'long' }).format(St.parseISO(day)))}</span>
      <span class="daynav-date">${cap(df({ day: 'numeric', month: 'long', year: 'numeric' }).format(St.parseISO(day)))}</span>
      <input type="date" data-change="day" value="${day}" max="${today}" aria-label="${t('day.pick')}">
    </label>
    <button class="icon-btn" data-action="day" data-d="${St.addDays(day, 1)}" ${day >= today ? 'disabled' : ''} aria-label="${t('day.next')}">${icon('right')}</button>
  </div>`;

  let body;
  if (!es.length) {
    // Suggestions: the last workout before this day, to repeat it exercise by exercise.
    const prevDate = [...new Set(all.filter((e) => e.exercise && e.date < day).map((e) => e.date))].sort().pop();
    const prevEx = prevDate ? [...groupByExercise(all.filter((e) => e.date === prevDate && e.exercise)).keys()] : [];
    body = `<section class="empty compact">
        <div class="empty-ic">${icon('dumbbell')}</div>
        <h2>${day === today ? t('log.emptyToday') : t('log.emptyDay')}</h2>
        <p>${t('log.emptyText')}</p>
        <button class="btn primary lg" data-action="add-ex">${icon('plus')} ${t('log.addExercise')}</button>
      </section>
      ${prevEx.length ? `<section class="card repeat">
        <h3>${icon('repeat')} ${t('log.repeat', { day: df({ weekday: 'long', day: 'numeric', month: 'long' }).format(St.parseISO(prevDate)) })}</h3>
        <p class="muted">${t('log.repeatHint')}</p>
        <div class="chips">${prevEx.map((n) => `<button class="chip" data-action="open-ex" data-name="${esc(n)}">
          <span class="cat-dot" style="--c:${Ex.categoryOf(n).color}"></span>${esc(Ex.exName(n))}</button>`).join('')}</div>
      </section>` : ''}`;
  } else {
    body = `${byEx.size ? `<div class="stats-row">
        <div><strong>${fmtN(byEx.size)}</strong><span>${t('log.exercises', { n: byEx.size })}</span></div>
        <div><strong>${fmtN(sets)}</strong><span>${t('log.setsWord', { n: sets })}</span></div>
        <div><strong>${fmtKg(vol)}</strong><span>${t('log.volume')}</span></div>
      </div>` : ''}
      <div class="ex-list">${[...byEx].map(([name, list]) => {
        const cat = Ex.categoryOf(name);
        return `<article class="ex-card" role="button" tabindex="0" data-action="open-ex" data-name="${esc(name)}">
          <header><span class="cat-dot" style="--c:${cat.color}"></span><h3>${esc(Ex.exName(name))}</h3>
            <span class="ex-meta">${t('log.sets', { n: list.reduce((a, e) => a + (e.sets || 1), 0) })}</span>
            <button class="icon-btn sm card-del" data-action="del-exercise" data-name="${esc(name)}" aria-label="${t('log.deleteExercise', { name: esc(Ex.exName(name)) })}">${icon('trash')}</button>${icon('right', 'chev')}</header>
          <ol class="sets">${list.map((e, i) => `<li>${setLine(e, i, prs)}</li>`).join('')}</ol>
        </article>`;
      }).join('')}
      ${attendance.map((e) => `<div class="attendance-row">${icon('check')}<span>${t('log.attended')}</span>
        <button class="icon-btn sm" data-action="del-entry" data-id="${esc(e.id)}" aria-label="${t('common.delete')}">${icon('trash')}</button></div>`).join('')}
      </div>`;
  }
  return `${installBanner()}${logForPicker()}${nav}${body}
    ${es.length ? `<button class="fab" data-action="add-ex">${icon('plus')}<span>${t('log.addExercise')}</span></button>` : ''}`;
}

// ---------- Calendar ----------
function viewHistory() {
  const [y, mo] = S.month.split('-').map(Number);
  const first = new Date(y, mo - 1, 1);
  const days = new Date(y, mo, 0).getDate();
  const offset = (first.getDay() + 6) % 7;
  const byDate = new Map();
  for (const e of S.group.entries) {
    if (!e.date.startsWith(S.month)) continue;
    if (!byDate.has(e.date)) byDate.set(e.date, new Set());
    byDate.get(e.date).add(e.email);
  }
  const today = St.todayISO();
  const cells = [];
  for (let i = 0; i < offset; i++) cells.push('<div class="day out"></div>');
  for (let d = 1; d <= days; d++) {
    const iso = `${S.month}-${String(d).padStart(2, '0')}`;
    const who = [...(byDate.get(iso) || [])].map(member).filter(Boolean);
    const me = who.some((m) => m.email === S.me.email);
    cells.push(`<button class="day ${iso === today ? 'today' : ''} ${who.length ? 'has' : ''} ${me ? 'mine' : ''}" ${who.length ? `data-action="cal-day" data-d="${iso}"` : 'disabled'}
      aria-label="${esc(fmtLong(iso))}: ${who.length ? esc(who.map((m) => m.name).join(', ')) : t('cal.nobody')}">
      <span class="num">${d}</span>
      <span class="dots">${who.map((m) => `<i style="background:${m.color}"></i>`).join('')}</span>
    </button>`);
  }
  const counts = members().map((m) => ({ m, n: [...byDate.values()].filter((s) => s.has(m.email)).length })).sort((a, b) => b.n - a.n);
  const prev = St.toISO(new Date(y, mo - 2, 1)).slice(0, 7);
  const next = St.toISO(new Date(y, mo, 1)).slice(0, 7);
  const monday = St.parseISO('2024-01-01');
  const wd = Array.from({ length: 7 }, (_, i) => df({ weekday: 'narrow' }).format(new Date(monday.getFullYear(), 0, 1 + i)));
  return `<div class="view-head">
      <h1>${t('nav.history')}</h1>
      <div class="month-nav">
        <button class="icon-btn" data-action="month" data-m="${prev}" aria-label="${t('cal.prev')}">${icon('left')}</button>
        <strong>${fmtMonth(first)}</strong>
        <button class="icon-btn" data-action="month" data-m="${next}" aria-label="${t('cal.next')}" ${next > today.slice(0, 7) ? 'disabled' : ''}>${icon('right')}</button>
      </div>
    </div>
    <div class="cal-layout">
      <div class="card cal">
        <div class="cal-head">${wd.map((d) => `<span>${d}</span>`).join('')}</div>
        <div class="cal-grid">${cells.join('')}</div>
      </div>
      <aside class="card legend">
        <h3>${t('cal.daysThisMonth')}</h3>
        <ul>${counts.map(({ m, n }) => `<li>${avatar(m)}<span class="name">${esc(m.name)}</span><strong>${n}</strong></li>`).join('')}</ul>
        <p class="fine">${t('cal.hint')}</p>
      </aside>
    </div>`;
}

// ---------- Progress ----------
/** Exercises with data, most logged first. */
function exerciseOptions(entries) {
  const freq = new Map();
  for (const e of entries) if (e.exercise) freq.set(e.exercise, (freq.get(e.exercise) || 0) + 1);
  return [...freq].sort((a, b) => b[1] - a[1]).map(([ex]) => ex);
}
const hasWeight = (name) => S.group.entries.some((e) => e.exercise === name && e.weight !== 0);
/** Metrics that make sense: bodyweight → reps only; assisted → help (max weight) and reps; else all. */
const metricsFor = (name) => (!hasWeight(name) ? ['reps'] : isAssisted(name) ? ['weight', 'reps'] : St.METRICS);
/** Bodyweight-only exercises can only be charted by reps. */
const metricFor = (name) => (metricsFor(name).includes(S.metric) ? S.metric : metricsFor(name)[0]);
const fmtMetric = (metric, v, d = 1) => (metric === 'reps' ? t('unit.reps', { n: fmtN(v) }) : metric === 'volume' ? fmtKg(v) : `${fmtN(v, d)} kg`);

function periodChips() {
  return `<div class="seg" role="group" aria-label="${t('period.label')}">${St.PERIODS.map((k) =>
    `<button class="${S.period === k ? 'on' : ''}" data-action="period" data-p="${k}">${t(`period.${k}`)}</button>`).join('')}</div>`;
}

function metricChips(name, current = metricFor(name), action = 'metric') {
  const ok = metricsFor(name);
  return `<div class="seg" role="group" aria-label="${t('metric.label')}">${St.METRICS.map((k) =>
    `<button class="${current === k ? 'on' : ''}" data-action="${action}" data-m="${k}" ${ok.includes(k) ? '' : 'disabled'}>${t(isAssisted(name) && k === 'weight' ? 'metric.assist' : `metric.${k}`)}</button>`).join('')}</div>`;
}

/** All-time bests for one exercise (mine by default). Shared by Progress and the exercise sheet. */
function recordsBlock(name, entries = mine()) {
  const sum = St.exerciseSummary(entries, name);
  if (!sum) return `<p class="muted">${t('ex.noHistory')}</p>`;
  const tile = (label, value, date, detail = '') =>
    `<div class="tile"><span>${label}</span><strong>${value}</strong>${date ? `<em>${detail ? `${detail} · ` : ''}${fmtDate(date)}</em>` : ''}</div>`;
  const set = (e) => `${fmtW(e.weight)} × ${fmtN(e.reps)}`;
  if (isAssisted(name) && sum.weight.value < 0) {
    return `<div class="tiles">
      ${tile(t('records.leastAssist'), fmtW(sum.weight.value), sum.weight.date, `× ${fmtN(sum.weight.set.reps)}`)}
      ${tile(t('metric.reps'), fmtN(sum.reps.value), sum.reps.date)}
      ${tile(t('ex.sessions'), fmtN(sum.sessions))}
    </div>`;
  }
  if (!(sum.weight.value > 0)) {
    return `<div class="tiles">
      ${tile(t('metric.reps'), fmtN(sum.reps.value), sum.reps.date)}
      ${tile(t('records.totalSets'), fmtN(sum.sets))}
      ${tile(t('ex.sessions'), fmtN(sum.sessions))}
    </div>`;
  }
  return `<div class="tiles">
      ${tile(t('metric.e1rm'), `${fmtN(sum.e1rm.value, 1)} kg`, sum.e1rm.date, set(sum.e1rm.set))}
      ${tile(t('metric.weight'), fmtW(sum.weight.value), sum.weight.date, `× ${fmtN(sum.weight.set.reps)}`)}
      ${tile(t('records.bestSet'), fmtKg(sum.bestSet.value), sum.bestSet.date, set(sum.bestSet.set))}
      ${tile(t('records.bestSession'), fmtKg(sum.sessionVolume.value), sum.sessionVolume.date)}
    </div>`;
}

function viewProgress() {
  const exs = exerciseOptions(S.group.entries);
  if (!exs.length) return `<div class="view-head"><h1>${t('nav.progress')}</h1></div>${emptyState('chart', t('progress.emptyTitle'), t('progress.emptyText'))}`;
  if (!exs.includes(S.exercise)) S.exercise = exerciseOptions(mine())[0] || exs[0];
  const weighted = hasWeight(S.exercise);
  const metric = metricFor(S.exercise);
  const r = St.periodRange(S.period);
  const rows = members().map((m) => ({ m, imp: St.improvement(entriesOf(m.email), r, S.exercise).details[0] }));
  const myPrs = St.prs(mine()).filter((p) => p.e1rm > 0).sort((a, b) => b.e1rm - a.e1rm);
  return `<div class="view-head">
      <h1>${t('nav.progress')}</h1>
      <div class="select-wrap"><select data-change="exercise" aria-label="${t('progress.exercise')}">${exs.map((ex) =>
        `<option value="${esc(ex)}" ${ex === S.exercise ? 'selected' : ''}>${esc(Ex.exName(ex))}</option>`).join('')}</select>${icon('down')}</div>
    </div>
    <div class="toolbar">${metricChips(S.exercise)}</div>
    <div class="toolbar">${periodChips()}
      ${solo() ? '' : `<label class="switch-label"><span>${t('progress.compare')}</span><span class="switch"><input type="checkbox" data-change="compare" ${S.compare ? 'checked' : ''}><i></i></span></label>`}
    </div>
    <div class="card chart-card"><div class="chart-box"><canvas id="chart" aria-label="${t(`metric.${metric}`)}"></canvas></div>
      <p class="fine">${t(`metric.${metric}.help`)}</p></div>
    <section class="card records-card">
      <h3>${icon('trophy')} ${t('records.mine', { name: esc(Ex.exName(S.exercise)) })}</h3>
      ${recordsBlock(S.exercise)}
    </section>
    <div class="grid two">
      ${weighted && !solo() ? `<div class="card">
        <h3>${t('progress.improvement')}</h3>
        <p class="muted card-sub">${t('progress.improvementSub')}</p>
        <table class="table">
          <thead><tr><th>${t('progress.person')}</th><th class="r">${t('progress.start')}</th><th class="r">${t('progress.best')}</th><th class="r">${t('progress.change')}</th></tr></thead>
          <tbody>${rows.sort((a, b) => (b.imp?.pct ?? -9) - (a.imp?.pct ?? -9)).map(({ m, imp }) => `<tr class="${m.email === S.me.email ? 'me' : ''}">
            <td><span class="who">${avatar(m)} ${esc(m.name)}</span></td>
            ${imp ? `<td class="r">${fmtN(imp.base, 1)}</td><td class="r">${fmtN(imp.peak, 1)}</td><td class="r ${imp.pct >= 0 ? 'up' : 'down'}">${fmtPct(imp.pct)}</td>`
              : `<td class="r muted" colspan="3">${t('progress.needTwo')}</td>`}
          </tr>`).join('')}</tbody>
        </table>
      </div>` : ''}
      <div class="card">
        <h3>${icon('trophy')} ${t('progress.myRecords')}</h3>
        ${myPrs.length ? `<table class="table"><thead><tr><th>${t('progress.exercise')}</th><th class="r">${t('progress.bestSet')}</th><th class="r">${t('progress.e1rm')}</th></tr></thead>
          <tbody>${myPrs.map((p) => `<tr><td><button class="link" data-action="progress-ex" data-name="${esc(p.exercise)}">${esc(Ex.exName(p.exercise))}</button></td>
            <td class="r">${fmtW(p.best.weight)} × ${fmtN(p.best.reps)}</td><td class="r"><strong>${fmtN(p.e1rm, 1)} kg</strong></td></tr>`).join('')}</tbody></table>`
          : `<p class="muted">${t('progress.noRecords')}</p>`}
      </div>
    </div>`;
}

function mountChart() {
  const canvas = document.getElementById('chart');
  if (!canvas || !window.Chart) return;
  const css = getComputedStyle(document.documentElement);
  const text = css.getPropertyValue('--muted').trim();
  const grid = css.getPropertyValue('--line').trim();
  const accent = css.getPropertyValue('--accent-text').trim();
  const r = St.periodRange(S.period);
  const metric = metricFor(S.exercise);
  const compare = S.compare && !solo();
  const who = compare ? members() : members().filter((m) => m.email === S.me.email);
  const datasets = who.map((m) => {
    const data = St.dailySeries(entriesOf(m.email).filter((e) => e.date >= r.from && e.date <= r.to), S.exercise, metric)
      .filter((p) => p.value !== 0)
      .map((p) => ({ x: +St.parseISO(p.date), y: Math.round(p.value * 10) / 10 }));
    const me = m.email === S.me.email;
    const color = me && !compare ? accent : m.color;
    return {
      label: m.name, data, borderColor: color, backgroundColor: color, tension: 0.3,
      pointRadius: 2.5, pointHoverRadius: 5, borderWidth: me ? 3 : 2,
    };
  }).filter((d) => d.data.length);
  S.chart = drawChart(canvas, datasets, metric, compare);
}

/** A line chart over time for one metric, styled from the current theme. */
function drawChart(canvas, datasets, metric, legend) {
  const css = getComputedStyle(document.documentElement);
  const text = css.getPropertyValue('--muted').trim();
  const grid = css.getPropertyValue('--line').trim();
  return new window.Chart(canvas, {
    type: 'line',
    data: { datasets },
    options: {
      responsive: true, maintainAspectRatio: false, animation: { duration: 300 },
      interaction: { mode: 'nearest', intersect: false },
      scales: {
        x: { type: 'linear', ticks: { color: text, maxTicksLimit: 6, callback: (v) => df({ day: 'numeric', month: 'short' }).format(new Date(v)) }, grid: { color: grid } },
        y: { ticks: { color: text, callback: (v) => fmtMetric(metric, v, 0) }, grid: { color: grid } },
      },
      plugins: {
        legend: { display: legend, labels: { color: text, usePointStyle: true, boxWidth: 8 } },
        tooltip: { callbacks: {
          title: (items) => cap(df({ weekday: 'long', day: 'numeric', month: 'long' }).format(new Date(items[0].parsed.x))),
          label: (it) => ` ${it.dataset.label}: ${fmtMetric(metric, it.parsed.y)}`,
        } },
      },
    },
  });
}

/** Metric for the exercise sheet's own chart (bodyweight-only exercises: reps). */
const sheetMetric = (name) => (hasWeight(name) ? S.sheet.metric || 'e1rm' : 'reps');

function sheetRecordsView(name) {
  if (!targetEntries().some((e) => e.exercise === name)) return `<p class="muted pad">${t('ex.noHistory')}</p>`;
  const metric = sheetMetric(name);
  return `${recordsBlock(name, targetEntries())}
    <div class="toolbar sheet-metrics">${metricChips(name, metric, 'sheet-metric')}</div>
    <div class="card chart-card"><div class="chart-box sm"><canvas id="sheet-chart" aria-label="${t(`metric.${metric}`)}"></canvas></div>
      <p class="fine">${t(`metric.${metric}.help`)}</p></div>
    <button class="btn ghost block" data-action="ex-chart">${icon('users')} ${t('ex.compareGroup')}</button>`;
}

function mountSheetChart() {
  const canvas = document.getElementById('sheet-chart');
  if (!canvas || !window.Chart) return;
  const name = S.sheet.name;
  const metric = sheetMetric(name);
  const color = getComputedStyle(document.documentElement).getPropertyValue('--accent-text').trim();
  const data = St.dailySeries(targetEntries(), name, metric).filter((p) => p.value !== 0)
    .map((p) => ({ x: +St.parseISO(p.date), y: Math.round(p.value * 10) / 10 }));
  S.sheetChart = drawChart(canvas, [{
    label: member(target())?.name || S.me.name, data, borderColor: color, backgroundColor: color, tension: 0.3, pointRadius: 3, pointHoverRadius: 5, borderWidth: 3,
  }], metric, false);
}

// ---------- "Install as app" prompt ----------
// Android/Chrome hands us an install event we can trigger from a button; iOS has no such API,
// so it gets the manual steps (Share → Add to Home Screen). Dismissing hides it for two weeks.
let installEvent = null;
const INSTALL_KEY = 'gt:installDismissed';
const isStandalone = () => matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;
const isIOS = () => /iPhone|iPad|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);

function installBanner() {
  if (isStandalone() || Date.now() - Number(ls.get(INSTALL_KEY) || 0) < 14 * 864e5) return '';
  const close = `<button class="icon-btn sm" data-action="install-dismiss" aria-label="${t('common.close')}">${icon('x')}</button>`;
  if (installEvent) {
    return `<div class="install-card">${logo(40)}<div class="install-text"><strong>${t('install.title')}</strong><p>${t('install.android')}</p></div>
      <div class="install-actions"><button class="btn primary sm" data-action="install">${t('install.button')}</button>${close}</div></div>`;
  }
  if (isIOS()) {
    return `<div class="install-card">${logo(40)}<div class="install-text"><strong>${t('install.title')}</strong>
      <p>${t('install.ios', { share: icon('share', 'inline') })}</p></div><div class="install-actions">${close}</div></div>`;
  }
  return '';
}
window.addEventListener('beforeinstallprompt', (e) => { e.preventDefault(); installEvent = e; render(); });
window.addEventListener('appinstalled', () => { installEvent = null; render(); });

// ---------- Group ----------
function board(title, sub, rows, get, fmt, { note = '', allowNeg = false } = {}) {
  const vals = rows.map((r) => ({ m: r.m, v: get(r) }));
  const ranked = vals.filter((x) => x.v != null).sort((a, b) => b.v - a.v);
  const missing = vals.filter((x) => x.v == null);
  const max = Math.max(...ranked.map((x) => Math.abs(x.v)), 0) || 1;
  return `<article class="card board">
    <header><h3>${title}</h3><p class="muted">${sub}</p></header>
    <ol>${ranked.map((x, i) => `<li class="${x.m.email === S.me.email ? 'me' : ''}">
        <span class="pos ${i < 3 && (x.v > 0 || (allowNeg && x.v !== 0)) ? `p${i + 1}` : ''}">${i + 1}</span>
        ${avatar(x.m)}
        <span class="name">${esc(x.m.name)}</span>
        <span class="bar"><i style="width:${Math.max(0, x.v) / max * 100}%;background:${x.m.color}"></i></span>
        <span class="val">${fmt(x.v)}</span>
      </li>`).join('')}
      ${missing.map((x) => `<li class="dim ${x.m.email === S.me.email ? 'me' : ''}"><span class="pos">–</span>${avatar(x.m)}<span class="name">${esc(x.m.name)}</span><span class="bar"></span><span class="val">${t('common.noData')}</span></li>`).join('')}
    </ol>
    ${note ? `<p class="fine">${note}</p>` : ''}
  </article>`;
}

function viewGroup() {
  const tabs = ['ranking', 'challenges', 'members'];
  const head = `<div class="view-head">
      <h1>${esc(S.group.name)}</h1>
      <button class="btn ghost" data-action="invite">${icon('userPlus')} ${t('group.invite')}</button>
      <button class="icon-btn" data-action="group-settings" aria-label="${t('gs.title')}">${icon('settings')}</button>
    </div>
    <div class="seg wide" role="tablist">${tabs.map((k) => `<button role="tab" class="${S.groupTab === k ? 'on' : ''}" aria-selected="${S.groupTab === k}" data-action="group-tab" data-v="${k}">${t(`group.${k}`)}</button>`).join('')}</div>`;
  if (S.groupTab === 'challenges') return head + viewChallenges();
  if (S.groupTab === 'members') return head + viewMembers();
  return head + viewRanking();
}

function viewRanking() {
  const r = St.periodRange(S.period);
  const rows = members().map((m) => {
    const es = entriesOf(m.email);
    return { m, att: St.attendance(es, r), streak: St.weekStreak(es), imp: St.improvement(es, r).score, vol: St.volume(es, r) };
  });
  const totalDays = St.sessionDates(S.group.entries, r).length;
  const totalSessions = rows.reduce((a, x) => a + x.att, 0);
  return `<div class="toolbar">${periodChips()}</div>
    <p class="summary">${totalSessions ? t('ranking.summary', { sessions: fmtN(totalSessions), days: fmtN(totalDays) }) : t('ranking.none')}</p>
    <div class="grid two">
      ${board(t('ranking.attendance'), t('ranking.attendanceSub'), rows, (x) => x.att, (v) => t('unit.days', { n: fmtN(v) }))}
      ${board(t('ranking.improvement'), t('ranking.improvementSub'), rows, (x) => x.imp, fmtPct, { allowNeg: true, note: t('ranking.improvementNote') })}
      ${board(t('ranking.streak'), t('ranking.streakSub'), rows, (x) => x.streak, (v) => t('unit.weeks', { n: fmtN(v) }), { note: t('ranking.streakNote') })}
      ${board(t('ranking.volume'), t('ranking.volumeSub'), rows, (x) => x.vol, fmtKg)}
    </div>`;
}

function challengeStatus(c) {
  const today = St.todayISO();
  if (today < c.start) return { key: 'upcoming', label: t('ch.startsOn', { date: fmtDate(c.start) }) };
  if (today > c.end) return { key: 'finished', label: t('ch.finished') };
  const left = Math.round((St.parseISO(c.end) - St.parseISO(today)) / 864e5);
  return { key: 'live', label: left === 0 ? t('ch.lastDay') : t('ch.daysLeft', { n: left }) };
}

function viewChallenges() {
  const order = { live: 0, upcoming: 1, finished: 2 };
  const list = [...S.group.challenges].map((c) => ({ c, st: challengeStatus(c) }))
    .sort((a, b) => order[a.st.key] - order[b.st.key] || b.c.start.localeCompare(a.c.start));
  const fmt = (type, v) => ({
    attendance: () => t('unit.days', { n: fmtN(v) }),
    volume: () => fmtKg(v),
    improvement: () => `${v > 0 ? '+' : ''}${fmtN(v, 1)} %`,
    sets: () => t('unit.sets', { n: fmtN(v) }),
    reps: () => t('unit.reps', { n: fmtN(v) }),
    maxWeight: () => fmtW(v),
    prs: () => t('unit.prs', { n: fmtN(v) }),
  }[type] || (() => fmtN(v)))();
  return `<div class="toolbar"><span class="spacer"></span><button class="btn primary" data-action="new-challenge">${icon('plus')} ${t('ch.new')}</button></div>
    ${list.length ? '' : emptyState('flag', t('ch.emptyTitle'), t('ch.emptyText'))}
    <div class="grid">${list.map(({ c, st }) => {
      const rows = members().map((m) => ({ m, v: St.challengeValue(c, entriesOf(m.email)) }));
      const ranked = rows.filter((x) => x.v != null).sort((a, b) => b.v - a.v);
      const rest = rows.filter((x) => x.v == null);
      const max = Math.max(...ranked.map((x) => Math.abs(x.v)), 0) || 1;
      const winner = st.key === 'finished' && ranked[0]?.v > 0 ? ranked[0].m : null;
      const creator = member(c.createdBy);
      return `<article class="card challenge ${st.key}">
        <header>
          <div class="challenge-tags"><span class="badge">${t(`ch.${c.type}`)}${c.exercise ? ` · ${esc(Ex.exName(c.exercise))}` : ''}</span><span class="status ${st.key}">${st.label}</span></div>
          <h3>${esc(c.title)}</h3>
          <p class="muted">${fmtDate(c.start)} – ${fmtDate(c.end)}${creator ? ` · ${t('ch.by', { name: esc(creator.name) })}` : ''}</p>
        </header>
        ${winner ? `<p class="winner">${icon('trophy')} ${t('ch.winner', { name: esc(winner.name) })}</p>` : ''}
        ${st.key === 'upcoming' ? `<p class="fine">${t(`ch.${c.type}.help`)}</p>` : `<ol>${ranked.map((x, i) => `<li class="${x.m.email === S.me.email ? 'me' : ''}">
            <span class="pos">${i + 1}</span>${avatar(x.m)}<span class="name">${esc(x.m.name)}</span>
            <span class="bar"><i style="width:${Math.max(0, x.v) / max * 100}%;background:${x.m.color}"></i></span>
            <span class="val">${fmt(c.type, x.v)}</span></li>`).join('')}
          ${rest.map((x) => `<li class="dim"><span class="pos">–</span>${avatar(x.m)}<span class="name">${esc(x.m.name)}</span><span class="bar"></span><span class="val">${t('common.noData')}</span></li>`).join('')}</ol>`}
      </article>`;
    }).join('')}</div>`;
}

function sessionList(es) {
  const byDate = new Map();
  for (const e of es) {
    if (!byDate.has(e.date)) byDate.set(e.date, []);
    byDate.get(e.date).push(e);
  }
  const dates = [...byDate.keys()].sort().reverse().slice(0, 10);
  if (!dates.length) return `<p class="muted">${t('members.noWorkouts')}</p>`;
  return `<ul class="sessions">${dates.map((d) => {
    const ex = groupByExercise(byDate.get(d).filter((e) => e.exercise));
    return `<li><div class="s-date">${fmtLong(d)}</div>
      ${ex.size ? `<ul>${[...ex].map(([n, l]) => `<li><span class="cat-dot" style="--c:${Ex.categoryOf(n).color}"></span><span class="s-name">${esc(Ex.exName(n))}</span>
        <span class="muted">${l.map((e) => (e.sets > 1 ? `${e.sets}×${fmtN(e.reps)}` : fmtN(e.reps))).join(' · ')} · ${fmtW(Math.max(...l.map((e) => e.weight)))}</span></li>`).join('')}</ul>`
        : `<p class="muted">${t('log.attended')}</p>`}
    </li>`;
  }).join('')}</ul>`;
}

function viewMembers() {
  const m = member(S.profile) || member(S.me.email);
  const es = entriesOf(m.email);
  const dates = St.sessionDates(es);
  const imp = St.improvement(es, St.periodRange('90')).score;
  const prs = St.prs(es).filter((p) => p.e1rm > 0).sort((a, b) => b.e1rm - a.e1rm).slice(0, 8);
  return `<div class="people">${members().map((x) => `<button class="person ${x.email === m.email ? 'on' : ''}" data-action="profile" data-e="${esc(x.email)}">${avatar(x)}<span>${esc(x.name)}</span></button>`).join('')}</div>
    <div class="profile-layout">
      <div>
        <div class="card profile-head">
          ${avatar(m, 'xl')}
          <div><h3>${esc(m.name)}${m.email === S.me.email ? ` <span class="badge">${t('common.you')}</span>` : ''}</h3>
          <p class="muted">${esc(m.email)}${m.joined ? ` · ${t('members.since', { date: fmtDate(m.joined) })}` : ''}</p></div>
        </div>
        <div class="tiles">
          <div class="tile"><span>${t('members.totalDays')}</span><strong>${fmtN(dates.length)}</strong></div>
          <div class="tile"><span>${t('members.last30')}</span><strong>${fmtN(St.attendance(es, St.periodRange('30')))}</strong></div>
          <div class="tile"><span>${t('ranking.streak')}</span><strong>${t('unit.weeks', { n: fmtN(St.weekStreak(es)) })}</strong></div>
          <div class="tile"><span>${t('members.improvement90')}</span><strong>${imp == null ? '—' : fmtPct(imp)}</strong></div>
        </div>
        <div class="card">
          <h3>${icon('trophy')} ${t('progress.records')}</h3>
          ${prs.length ? `<table class="table"><thead><tr><th>${t('progress.exercise')}</th><th class="r">${t('progress.bestSet')}</th><th class="r">${t('progress.e1rm')}</th></tr></thead>
            <tbody>${prs.map((p) => `<tr><td>${esc(Ex.exName(p.exercise))}</td><td class="r">${fmtW(p.best.weight)} × ${fmtN(p.best.reps)}</td><td class="r"><strong>${fmtN(p.e1rm, 1)} kg</strong></td></tr>`).join('')}</tbody></table>`
            : `<p class="muted">${t('progress.noRecords')}</p>`}
        </div>
      </div>
      <div class="card"><h3>${t('members.recent')}</h3>${sessionList(es)}</div>
    </div>`;
}

// ---------- Full-screen sheets: exercise picker and set logger ----------
// ---------- Back button ----------
// Like a native Android app: back closes an open modal, then the exercise sheet, then returns from any
// tab to Home; only on Home does it leave the app. Each layer adds one history entry. Closing a layer
// from the UI pops its entry; history.back() is async, so pushes made meanwhile wait in a queue.
const nav = { tab: false, sheet: false, modal: false, pendingBacks: 0, queue: [], fromPop: false };
function navPush(state) {
  if (nav.pendingBacks) nav.queue.push(state);
  else history.pushState(state, '');
}
function navPop() {
  nav.pendingBacks++;
  history.back();
}
window.addEventListener('popstate', () => {
  if (nav.pendingBacks) {
    // One of our own pops: replay any pushes made while it was in flight.
    if (--nav.pendingBacks === 0) { for (const s of nav.queue) history.pushState(s, ''); nav.queue = []; }
    return;
  }
  if ($modal.open && nav.modal) {
    nav.modal = false;
    nav.fromPop = true;
    $modal.close();
    nav.fromPop = false;
  } else if (S.sheet && nav.sheet) {
    nav.sheet = false;
    S.sheet = null;
    renderSheet();
    render();
  } else if (nav.tab) {
    nav.tab = false;
    S.tab = 'home';
    render();
    window.scrollTo({ top: 0 });
  }
});
$modal.addEventListener('close', () => {
  if (nav.modal && !nav.fromPop) { nav.modal = false; navPop(); }
});

/** Switches tab. Leaving Home adds one history entry, so back returns to Home from any tab. */
function setTab(tab) {
  if (tab === S.tab) return;
  if (tab === 'home') { if (nav.tab) { nav.tab = false; navPop(); } } else if (!nav.tab) { nav.tab = true; navPush({ tab: true }); }
  S.tab = tab;
  render();
  window.scrollTo({ top: 0 });
}

function openSheet(sheet) {
  if (!S.sheet && !nav.sheet) { nav.sheet = true; navPush({ sheet: true }); }
  S.sheet = sheet;
  renderSheet();
}
function closeSheet() {
  S.sheet = null;
  renderSheet();
  render();
  if (nav.sheet) { nav.sheet = false; navPop(); }
}

function renderSheet() {
  document.body.classList.toggle('sheet-open', Boolean(S.sheet));
  if (S.sheetChart) { S.sheetChart.destroy(); S.sheetChart = null; }
  if (!S.sheet) { $sheet.className = ''; $sheet.innerHTML = ''; return; }
  $sheet.className = 'open';
  const html = S.sheet.kind === 'picker' ? pickerSheet() : exerciseSheet();
  // Re-renders swap the panel's contents only, so the slide-in animation plays once when it opens.
  const panel = $sheet.querySelector('.sheet-panel');
  if (panel) panel.innerHTML = html;
  else $sheet.innerHTML = `<div class="sheet-panel" role="dialog" aria-modal="true">${html}</div>`;
  if (S.sheet.kind === 'exercise' && S.sheet.view === 'records') mountSheetChart();
  if (S.sheet.kind === 'picker') {
    const q = document.getElementById('picker-q');
    if (q && matchMedia('(hover: hover)').matches) q.focus();
  }
}

function lastInfo(name) {
  const s = St.lastSession(targetEntries(), name, '9999-12-31');
  if (!s) return '';
  const top = s.sets.reduce((a, e) => (St.e1rm(e.weight, e.reps) > St.e1rm(a.weight, a.reps) ? e : a));
  return `${fmtW(top.weight)} × ${fmtN(top.reps)} · ${relDay(s.date)}`;
}

function pickerSheet() {
  const sh = S.sheet;
  return `<header class="sheet-head">
      <button class="icon-btn" data-action="close-sheet" aria-label="${t('common.back')}">${icon('left')}</button>
      <h2>${t('picker.title')}</h2>
      <button class="btn ghost sm" data-action="new-ex">${icon('plus')} ${t('picker.new')}</button>
    </header>
    <div class="search">${icon('search')}<input type="search" id="picker-q" value="${esc(sh.q)}" placeholder="${t('picker.search')}" autocomplete="off" enterkeyhint="go"></div>
    <div class="cats" id="picker-cats">${pickerCats()}</div>
    <div class="picker-list" id="picker-list">${pickerList()}</div>`;
}

function pickerCats() {
  const cat = S.sheet.cat;
  return [{ id: 'all', label: t('picker.all') }, ...Ex.CATEGORIES.map((c) => ({ id: c.id, label: Ex.catLabel(c), color: c.color }))]
    .map((c) => `<button class="chip ${cat === c.id ? 'on' : ''}" data-action="picker-cat" data-cat="${c.id}">${c.color ? `<span class="cat-dot" style="--c:${c.color}"></span>` : ''}${esc(c.label)}</button>`).join('');
}

function pickRow(e) {
  const cat = Ex.categoryOf(e.name);
  const info = lastInfo(e.name);
  return `<button class="pick-row" data-action="pick" data-name="${esc(e.name)}">
    <span class="cat-dot" style="--c:${cat.color}"></span>
    <span class="pick-name">${esc(Ex.exName(e.name))}</span>
    ${info ? `<span class="pick-meta">${esc(info)}</span>` : ''}
  </button>`;
}

function pickerList() {
  const { q: rawQ, cat } = S.sheet;
  const q = Ex.norm(rawQ || '');
  const all = Ex.allExercises(usedNames()).filter((e) => (cat === 'all' || e.cat === cat) && Ex.matches(e, q));
  const byName = (a, b) => Ex.exName(a.name).localeCompare(Ex.exName(b.name), locale());
  let html = '';
  const exact = rawQ.trim() && Ex.findExisting(rawQ, usedNames());
  if (rawQ.trim() && !exact) {
    html += `<button class="pick-row create" data-action="new-ex" data-name="${esc(rawQ.trim())}">${icon('plus')}<span class="pick-name">${t('picker.create', { name: esc(rawQ.trim()) })}</span></button>`;
  }
  if (q) return html + (all.length ? all.sort(byName).map(pickRow).join('') : `<p class="muted pad">${t('picker.noResults')}</p>`);
  if (cat === 'all') {
    // Recent first: what you repeat most at the gym is one tap away.
    const last = new Map();
    for (const e of targetEntries()) if (e.exercise && (last.get(e.exercise) || '') < e.date) last.set(e.exercise, e.date);
    const recent = [...last].sort((a, b) => (a[1] < b[1] ? 1 : -1)).slice(0, 8).map(([name]) => Ex.exerciseInfo(name));
    if (recent.length) html += `<h3 class="list-head">${t('picker.recent')}</h3>${recent.map(pickRow).join('')}`;
    for (const c of Ex.CATEGORIES) {
      const list = all.filter((e) => e.cat === c.id).sort(byName);
      if (list.length) html += `<h3 class="list-head">${esc(Ex.catLabel(c))}</h3>${list.map(pickRow).join('')}`;
    }
    return html;
  }
  return html + all.sort(byName).map(pickRow).join('');
}

/** Starting values: today's last set or, failing that, the first set of the previous session. */
function defaultsFor(name) {
  const es = targetEntries();
  const today = es.filter((e) => e.exercise === name && e.date === S.day);
  if (today.length) { const e = today[today.length - 1]; return { w: shownW(name, e.weight), r: e.reps }; }
  const last = St.lastSession(es, name, S.day);
  if (last) return { w: shownW(name, last.sets[0].weight), r: last.sets[0].reps };
  return { w: Ex.exerciseInfo(name).bw ? 0 : '', r: '' };
}

function openExercise(name) {
  const d = defaultsFor(name);
  openSheet({ kind: 'exercise', name, view: 'log', edit: null, w: d.w, r: d.r });
}

function exerciseSheet() {
  const sh = S.sheet;
  const name = sh.name;
  const cat = Ex.categoryOf(name);
  const today = St.todayISO();
  return `<header class="sheet-head">
      <button class="icon-btn" data-action="close-sheet" aria-label="${t('common.back')}">${icon('left')}</button>
      <div class="sheet-title"><h2>${esc(Ex.exName(name))}</h2>
        <span class="muted"><span class="cat-dot" style="--c:${cat.color}"></span>${esc(Ex.catLabel(cat))} · ${S.day === today ? t('day.today') : fmtLong(S.day)}${target() !== S.me.email ? ` · <strong class="for-who">${esc(member(target())?.name || '')}</strong>` : ''}</span></div>
      <a class="icon-btn" href="https://www.youtube.com/results?search_query=${encodeURIComponent(`${Ex.exName(name)} ${t('ex.howToQuery')}`)}"
        target="_blank" rel="noopener" aria-label="${t('ex.howTo')}" title="${t('ex.howTo')}">${icon('play')}</a>
      <button class="icon-btn" data-action="timer-settings" aria-label="${t('timer.title')}">${icon('timer')}</button>
    </header>
    <div class="seg wide">${['log', 'history', 'records'].map((v) =>
      `<button class="${sh.view === v ? 'on' : ''}" data-action="ex-view" data-v="${v}">${t(`ex.${v}`)}</button>`).join('')}</div>
    <div class="sheet-body">${sh.view === 'history' ? exerciseHistoryView(name)
      : sh.view === 'records' ? sheetRecordsView(name)
        : exerciseLogView(name)}</div>`;
}

function stepper(field, label, value, unit) {
  return `<div class="stepper">
    <span class="stepper-label">${label}${unit ? ` <span class="muted">(${unit})</span>` : ''}</span>
    <div class="stepper-row">
      <button class="step" data-step="${field}" data-d="-1" aria-label="${t('ex.less', { what: label })}">${icon('minus')}</button>
      <input id="in-${field}" class="step-input" inputmode="${field === 'w' ? 'decimal' : 'numeric'}" enterkeyhint="done" autocomplete="off"
        value="${esc(showNum(value))}" placeholder="0" aria-label="${label}">
      <button class="step" data-step="${field}" data-d="1" aria-label="${t('ex.more', { what: label })}">${icon('plus')}</button>
    </div>
  </div>`;
}

function exerciseLogView(name) {
  const sh = S.sheet;
  const all = targetEntries();
  const todays = all.filter((e) => e.exercise === name && e.date === S.day);
  const prs = St.prIds(all);
  const last = St.lastSession(all, name, S.day);
  const editing = sh.edit && todays.some((e) => e.id === sh.edit);
  return `<section class="entry-card ${editing ? 'editing' : ''}">
      ${editing ? `<p class="editing-label">${icon('edit')} ${t('ex.editing', { n: todays.findIndex((e) => e.id === sh.edit) + 1 })}</p>` : ''}
      <div class="steppers">
        ${stepper('w', isAssisted(name) ? t('ex.assist') : t('ex.weight'), sh.w, 'kg')}
        ${stepper('r', t('ex.reps'), sh.r, '')}
      </div>
      ${editing
        ? `<div class="entry-actions">
            <button class="btn danger" data-action="del-set" aria-label="${t('common.delete')}">${icon('trash')}</button>
            <button class="btn ghost" data-action="cancel-edit">${t('common.cancel')}</button>
            <button class="btn primary grow" data-action="save-set">${icon('check')} ${t('ex.update')}</button>
          </div>`
        : `<button class="btn primary xl block" data-action="save-set">${icon('check')} ${t('ex.save')}</button>`}
      ${Ex.exerciseInfo(name).bw ? `<p class="fine center">${t('ex.bwHint')}</p>` : ''}
      ${isAssisted(name) ? `<p class="fine center">${t('ex.assistHint')}</p>` : ''}
    </section>
    ${last ? `<section class="last">
      <h3>${t('ex.lastTime', { day: relDay(last.date) })}</h3>
      <div class="chips">${last.sets.map((e) => `<button class="chip set-chip" data-action="fill" data-w="${e.weight}" data-r="${e.reps}">${fmtW(e.weight)} × ${fmtN(e.reps)}${e.sets > 1 ? ` <span class="muted">(${e.sets})</span>` : ''}</button>`).join('')}</div>
    </section>` : ''}
    <section class="today-sets">
      <h3>${S.day === St.todayISO() ? t('ex.todaySets') : t('ex.daySets')} ${todays.length ? `<span class="count">${todays.length}</span>` : ''}</h3>
      ${todays.length ? `<ol class="sets big">${todays.map((e, i) => `<li><button class="set-btn ${sh.edit === e.id ? 'on' : ''}" data-action="edit-set" data-id="${esc(e.id)}">${setLine(e, i, prs)}</button></li>`).join('')}</ol>
        <button class="btn ghost danger-text block del-all" data-action="del-exercise" data-name="${esc(name)}">${icon('trash')} ${t('ex.deleteAll')}</button>`
        : `<p class="muted">${t('ex.noSetsYet')}</p>`}
    </section>`;
}

function exerciseHistoryView(name) {
  const all = targetEntries();
  const hist = St.exerciseHistory(all, name);
  if (!hist.length) return `<p class="muted pad">${t('ex.noHistory')}</p>`;
  const prs = St.prIds(all);
  return `<ul class="history">${hist.slice(0, 30).map((h) => `<li>
      <div class="s-date">${fmtLong(h.date)}</div>
      <ol class="sets">${h.sets.map((e, i) => `<li>${setLine(e, i, prs)}</li>`).join('')}</ol>
    </li>`).join('')}</ul>`;
}

/** Updates only the results while typing, without re-rendering the sheet (keeps focus and the keyboard open). */
function refreshPicker() {
  const list = document.getElementById('picker-list');
  if (list) list.innerHTML = pickerList();
  const cats = document.getElementById('picker-cats');
  if (cats) cats.innerHTML = pickerCats();
}

function readSteppers() {
  const sh = S.sheet;
  const w = document.getElementById('in-w');
  const r = document.getElementById('in-r');
  if (w) sh.w = w.value.trim() === '' ? '' : numIn(w.value);
  if (r) sh.r = r.value.trim() === '' ? '' : Math.round(numIn(r.value));
}

function step(field, dir) {
  const input = document.getElementById(`in-${field}`);
  if (!input) return;
  const cur = numIn(input.value);
  const inc = field === 'w' ? prefs.step : 1;
  // +/− snaps to a multiple of the increment (82.3 → 82.5 with 2.5 steps).
  let next = dir > 0 ? Math.floor(cur / inc + 1e-9) * inc + inc : Math.ceil(cur / inc - 1e-9) * inc - inc;
  next = Math.max(field === 'w' ? 0 : 1, Math.round(next * 100) / 100);
  input.value = showNum(next);
  S.sheet[field] = next;
  navigator.vibrate?.(8);
}

// Holding +/− repeats the step, like native apps.
let holdTimer = null;
let holdRepeat = null;
let held = false;
function stopHold() { clearTimeout(holdTimer); clearInterval(holdRepeat); holdTimer = holdRepeat = null; }
$sheet.addEventListener('pointerdown', (e) => {
  const b = e.target.closest('[data-step]');
  if (!b) return;
  held = false;
  stopHold();
  holdTimer = setTimeout(() => {
    held = true;
    holdRepeat = setInterval(() => step(b.dataset.step, Number(b.dataset.d)), 90);
  }, 420);
});
['pointerup', 'pointercancel', 'pointerleave'].forEach((ev) => $sheet.addEventListener(ev, stopHold));

function saveSet() {
  readSteppers();
  const sh = S.sheet;
  const reps = Math.round(numIn(sh.r));
  // Assisted: the field holds the help; it's stored negative so less help ranks as a better set.
  const weight = isAssisted(sh.name) ? -Math.abs(numIn(sh.w)) : Math.max(0, numIn(sh.w));
  if (!reps || reps < 1) { toast(t('ex.needReps'), { error: true }); document.getElementById('in-r')?.focus(); return; }
  const gid = S.group.id;
  const who = target();
  if (sh.edit) {
    const old = S.group.entries.find((e) => e.id === sh.edit && e.email === who);
    if (old) {
      Object.assign(old, { weight, reps });
      S.outbox.update(gid, { id: old.id, date: old.date, exercise: old.exercise, sets: old.sets || 1, reps, weight, notes: old.notes || '' }, who);
    }
    sh.edit = null;
    toast(t('ex.updated'), { ic: 'check' });
  } else {
    const entry = { id: uid(), date: S.day, exercise: sh.name, sets: 1, reps, weight, notes: '' };
    S.group.entries.push({ ...entry, email: who });
    S.outbox.add(gid, entry, who);
    if (St.prIds(targetEntries()).has(entry.id)) toast(t('ex.newPr'), { ic: 'trophy' });
    // Only while actually training: back-filling a past day doesn't need rest.
    if (prefs.autoRest && S.day === St.todayISO()) Timer.start(prefs.rest, timerOptions());
    navigator.vibrate?.(20);
  }
  // Expired session: renew it using this click (Google's popup needs a user gesture).
  if (S.store.kind === 'google' && !G.tokenValid()) G.signIn().then(() => S.outbox.flush(), () => {});
  renderSheet();
}

// ---------- modals ----------
function openModal(html, cls = '') {
  $modal.className = cls;
  $modal.innerHTML = `<div class="modal-body">${html}</div>`;
  if (!$modal.open) {
    $modal.showModal();
    if (!nav.modal) { nav.modal = true; navPush({ modal: true }); }
  }
  $modal.querySelector('[autofocus]')?.focus();
}
const closeModal = () => $modal.open && $modal.close();
const modalHead = (title) => `<header class="modal-head"><h2>${title}</h2><button class="icon-btn" data-action="close-modal" aria-label="${t('common.close')}">${icon('x')}</button></header>`;

function segPref(key, options, label) {
  return `<div class="seg wide">${options.map(([v, l]) => `<button class="${String(prefs[key]) === String(v) ? 'on' : ''}" data-action="pref" data-k="${key}" data-v="${v}">${l}</button>`).join('')}</div>`
    + (label ? `<span class="sr-only">${label}</span>` : '');
}

function restSettings() {
  return `<div class="setting"><span class="setting-label">${t('timer.duration')}</span>
      ${segPref('rest', REST_OPTIONS.map((s) => [s, `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`]))}</div>
    <label class="setting row"><span><span class="setting-label">${t('timer.auto')}</span><span class="fine">${t('timer.autoHelp')}</span></span>
      <span class="switch"><input type="checkbox" data-pref-toggle="autoRest" ${prefs.autoRest ? 'checked' : ''}><i></i></span></label>
    <div class="setting">
      <span class="setting-label">${t('timer.volume')} <span class="setting-value" id="volume-value">${Math.round(prefs.volume * 100)} %</span></span>
      <div class="slider-row">${icon('volume')}<input type="range" min="0" max="100" step="5" value="${Math.round(prefs.volume * 100)}" data-range="volume" aria-label="${t('timer.volume')}">
        <button type="button" class="btn ghost sm" data-action="test-sound">${t('timer.test')}</button></div>
      <span class="fine">${t('timer.volumeHelp')}</span>
    </div>
    <div class="setting">
      <span class="setting-label">${t('timer.vibration')} <span class="setting-value" id="vibration-value">${t(`timer.vib${prefs.vibration}`)}</span></span>
      <div class="slider-row">${icon('vibrate')}<input type="range" min="0" max="3" step="1" value="${prefs.vibration}" data-range="vibration" aria-label="${t('timer.vibration')}">
        <button type="button" class="btn ghost sm" data-action="test-vibration">${t('timer.test')}</button></div>
      <span class="fine">${t('timer.vibrationHelp')}</span>
    </div>
    <label class="setting row"><span><span class="setting-label">${t('timer.notify')}</span><span class="fine">${t('timer.notifyHelp')}</span></span>
      <span class="switch"><input type="checkbox" data-pref-toggle="notify" ${prefs.notify && notificationsGranted() ? 'checked' : ''}><i></i></span></label>`;
}

const timerOptions = () => ({ notify: prefs.notify, volume: prefs.volume, vibration: prefs.vibration });

const notificationsGranted = () => 'Notification' in window && Notification.permission === 'granted';

/** Turning on timer notifications asks for permission (from the toggle's own tap). */
function enableNotifications(input) {
  const off = (msg) => { prefs.notify = false; savePrefs(); input.checked = false; toast(msg, { error: true }); };
  if (!('Notification' in window) || !navigator.serviceWorker) return off(t('timer.notifyUnsupported'));
  Notification.requestPermission().then((p) => {
    if (p === 'granted') toast(t('timer.notifyOn'), { ic: 'check' });
    else off(t('timer.notifyDenied'));
  });
}

function settingsModal() {
  const me = S.me;
  const demo = S.store.kind === 'demo';
  openModal(`${modalHead(t('settings.title'))}
    <div class="profile-head">${avatar({ ...me, color: member(me.email)?.color || COLORS[0] }, 'lg')}
      <div><h3>${esc(me.name)}</h3><p class="muted">${esc(me.email)}</p></div></div>
    <div class="setting"><span class="setting-label">${t('settings.language')}</span>
      <div class="seg wide">${[['es', 'Español'], ['en', 'English']].map(([v, l]) => `<button class="${getLang() === v ? 'on' : ''}" data-action="lang" data-lang="${v}">${l}</button>`).join('')}</div></div>
    <div class="setting"><span class="setting-label">${t('settings.theme')}</span>
      ${segPref('theme', [['system', t('settings.system')], ['light', t('settings.light')], ['dark', t('settings.dark')]])}</div>
    <div class="setting"><span class="setting-label">${t('settings.step')}</span>
      ${segPref('step', STEP_OPTIONS.map((s) => [s, `${fmtN(s, 2)} kg`]))}</div>
    ${restSettings()}
    <p class="fine">${demo ? t('settings.demoNote') : t('settings.dataNote')} <a href="privacy.html">${t('common.privacy')}</a></p>
    <footer class="modal-foot"><button class="btn ghost" data-action="logout">${icon('logout')} ${demo ? t('settings.exitDemo') : t('settings.signOut')}</button></footer>`);
}

function timerModal() {
  openModal(`${modalHead(t('timer.title'))}
    ${restSettings()}
    <footer class="modal-foot">
      ${Timer.isRunning() ? `<button class="btn ghost" data-action="timer-stop">${t('timer.skip')}</button>` : ''}
      <button class="btn primary" data-action="timer-start">${icon('timer')} ${t('timer.startNow')}</button>
    </footer>`);
}

function newExerciseModal(name = '') {
  openModal(`${modalHead(t('newEx.title'))}
    <form data-form="new-ex">
      <label class="field"><span>${t('newEx.name')}</span><input name="name" required maxlength="60" value="${esc(name)}" placeholder="${t('newEx.placeholder')}" autofocus></label>
      <fieldset class="field"><legend>${t('newEx.category')}</legend>
        <div class="chips">${Ex.CATEGORIES.map((c, i) => `<label class="chip radio"><input type="radio" name="cat" value="${c.id}" ${i === Ex.CATEGORIES.length - 1 ? 'checked' : ''}>
          <span class="cat-dot" style="--c:${c.color}"></span>${esc(Ex.catLabel(c))}</label>`).join('')}</div>
      </fieldset>
      <p class="fine">${t('newEx.shared')}</p>
      <footer class="modal-foot"><button type="button" class="btn ghost" data-action="close-modal">${t('common.cancel')}</button><button class="btn primary">${t('newEx.create')}</button></footer>
    </form>`);
}

function calDayModal(iso) {
  const es = S.group.entries.filter((e) => e.date === iso);
  const who = [...new Set(es.map((e) => e.email))].map(member).filter(Boolean);
  openModal(`${modalHead(esc(fmtLong(iso)))}
    <div class="day-list">${who.map((m) => {
      const ex = groupByExercise(es.filter((e) => e.email === m.email && e.exercise));
      return `<section><h3 class="who">${avatar(m)} ${esc(m.name)}</h3>
        ${ex.size ? `<ul>${[...ex].map(([n, l]) => `<li><span class="cat-dot" style="--c:${Ex.categoryOf(n).color}"></span><span class="s-name">${esc(Ex.exName(n))}</span>
          <span class="muted">${l.map((e) => `${fmtW(e.weight)}×${fmtN(e.reps)}${e.sets > 1 ? ` (${e.sets})` : ''}`).join(' · ')}</span></li>`).join('')}</ul>`
          : `<p class="muted">${t('log.attended')}</p>`}
      </section>`;
    }).join('')}</div>
    <footer class="modal-foot"><button class="btn primary" data-action="goto-day" data-d="${iso}">${icon('dumbbell')} ${t('cal.openMine')}</button></footer>`);
}

function challengeModal() {
  const today = St.todayISO();
  const exs = St.exercises(S.group.entries);
  openModal(`${modalHead(t('ch.new'))}
    <form data-form="challenge">
      <label class="field"><span>${t('ch.titleLabel')}</span><input name="title" required maxlength="80" placeholder="${t('ch.titlePlaceholder')}" autofocus></label>
      <fieldset class="field">
        <legend class="legend-row">${t('ch.type')}
          <button type="button" class="info-btn" data-action="toggle-info" aria-expanded="false" aria-controls="ch-type-help" aria-label="${t('ch.typesHelp')}">${icon('info')}</button>
        </legend>
        <div class="chips type-chips" role="radiogroup">${CH_TYPES.map((k, i) => `<label class="chip radio"><input type="radio" name="type" value="${k}" ${i === 0 ? 'checked' : ''}>${t(`ch.${k}`)}</label>`).join('')}</div>
        <dl class="info-box" id="ch-type-help" hidden>${CH_TYPES.map((k) => `<dt>${t(`ch.${k}`)}</dt><dd>${t(`ch.${k}.help`)}</dd>`).join('')}</dl>
      </fieldset>
      <label class="field"><span>${t('ch.exercise')}</span><div class="select-wrap"><select name="exercise"><option value="">${t('ch.allExercises')}</option>${exs.map((x) => `<option value="${esc(x)}">${esc(Ex.exName(x))}</option>`).join('')}</select>${icon('down')}</div></label>
      <div class="two"><label class="field"><span>${t('ch.start')}</span><input type="date" name="start" value="${today}" required></label>
      <label class="field"><span>${t('ch.end')}</span><input type="date" name="end" value="${St.addDays(today, 29)}" required></label></div>
      <footer class="modal-foot"><button type="button" class="btn ghost" data-action="close-modal">${t('common.cancel')}</button><button class="btn primary">${t('ch.create')}</button></footer>
    </form>`);
}

function inviteModal() {
  const link = `${location.origin}${location.pathname}?group=${encodeURIComponent(S.group.id)}`;
  const demo = S.store.kind === 'demo';
  const owner = S.group.ownerName || t('group.creator');
  const message = t('invite.message', { group: S.group.name, link });
  openModal(`${modalHead(t('invite.title'))}
    ${S.group.canShare ? `<p>${t('invite.text')}</p>
    <form data-form="invite" class="inline-form">
      <input type="email" name="email" required placeholder="email@gmail.com" aria-label="${t('invite.emailLabel')}" autofocus>
      <button class="btn primary">${t('invite.send')}</button>
    </form>` : `<p>${t('invite.onlyOwner', { owner: `<strong>${esc(owner)}</strong>` })}</p>`}
    <section class="share">
      <h3 class="list-head">${t('invite.sendLink')}</h3>
      <div class="share-grid">
        <a class="btn ghost" href="https://wa.me/?text=${encodeURIComponent(message)}" target="_blank" rel="noopener">${icon('chat')} WhatsApp</a>
        <a class="btn ghost" href="mailto:?subject=${encodeURIComponent(t('invite.subject', { group: S.group.name }))}&body=${encodeURIComponent(message)}">${icon('mail')} Email</a>
        ${navigator.share ? `<button class="btn ghost" type="button" data-action="share-link">${icon('share')} ${t('invite.more')}</button>` : ''}
        <button class="btn ghost" type="button" data-action="copy-link">${icon('link')} ${t('common.copy')}</button>
      </div>
      <input type="hidden" value="${esc(link)}" id="invite-link">
    </section>
    <p class="fine">${t('invite.linkNote')}${demo ? ` ${t('invite.demoNote')}` : ''}</p>`);
}

function groupMenu() {
  const g = S.group;
  const isGoogle = S.store.kind === 'google';
  openModal(`${modalHead(t('group.groups'))}
    <ul class="menu">
      ${S.groups.map((x) => `<li><button class="menu-item ${x.id === g?.id ? 'on' : ''}" data-action="switch-group" data-id="${esc(x.id)}">
        <span>${esc(x.name)}</span>${x.owner ? `<span class="muted">${t('group.of', { owner: esc(x.owner) })}</span>` : ''}${x.id === g?.id ? icon('check') : ''}</button></li>`).join('')}
    </ul>
    <div class="menu-actions">
      ${g?.isMember ? `<button class="btn ghost" data-action="invite">${icon('userPlus')} ${t('group.invite')}</button>
        <button class="btn ghost" data-action="group-settings">${icon('settings')} ${t('gs.title')}</button>` : ''}
      ${g ? `<button class="btn ghost" data-action="refresh">${icon('refresh')} ${t('group.refresh')}</button>` : ''}
      <button class="btn ghost" data-action="create-group">${icon('plus')} ${t('groups.create')}</button>
      ${isGoogle ? `<button class="btn ghost" data-action="pick-any">${icon('sheet')} ${t('groups.pickShared')}</button>` : ''}
      ${g?.url ? `<a class="btn ghost" href="${esc(g.url)}" target="_blank" rel="noopener">${icon('external')} ${t('group.openSheet')}</a>` : ''}
    </div>`);
}

// ---------- group settings: rename, members, delete ----------
let groupPerms = null; // Drive permissions of the open group, loaded when its settings open
let pendingConfirm = null;

function groupSettingsModal() {
  const g = S.group;
  const owner = g.isOwner;
  const perms = groupPerms;
  const memberRows = members().map((m) => {
    const me = m.email === S.me.email;
    const isOwnerRow = perms ? perms.some((p) => p.email === m.email && p.role === 'owner') : me && owner;
    return `<li class="member-row">${avatar(m)}
      <div class="member-info"><strong>${esc(m.name)}${me ? ` <span class="badge">${t('common.you')}</span>` : ''}</strong>
        <span class="muted">${esc(m.email)} · ${isOwnerRow ? t('gs.owner') : t('gs.member')}</span></div>
      ${owner && !me ? `<button class="icon-btn sm" data-action="member-remove" data-e="${esc(m.email)}" aria-label="${t('gs.removeLabel', { name: esc(m.name) })}">${icon('userMinus')}</button>` : ''}
    </li>`;
  }).join('');
  const pending = (perms || []).filter((p) => p.role !== 'owner' && !members().some((m) => m.email === p.email));
  openModal(`${modalHead(t('gs.title'))}
    ${owner ? `<form data-form="rename-group" class="field"><span>${t('groups.name')}</span>
      <div class="inline-form"><input name="name" value="${esc(g.name)}" maxlength="60" required aria-label="${t('groups.name')}"><button class="btn ghost">${t('common.save')}</button></div></form>` : ''}
    <section>
      <h3 class="list-head">${t('gs.members', { n: members().length })}</h3>
      <ul class="member-list">${memberRows}</ul>
    </section>
    ${owner ? `<section>
      <h3 class="list-head">${t('gs.pending')}</h3>
      ${!perms ? `<p class="muted">${t('gs.loading')}</p>` : pending.length ? `<ul class="member-list">${pending.map((p) => `<li class="member-row">
        <span class="av" style="--c:#8A8A93">${icon('userPlus')}</span>
        <div class="member-info"><strong>${esc(p.name || p.email)}</strong><span class="muted">${esc(p.email)} · ${t('gs.pendingHint')}</span></div>
        <button class="icon-btn sm" data-action="invite-cancel" data-id="${esc(p.id)}" aria-label="${t('gs.cancelInvite')}">${icon('x')}</button>
      </li>`).join('')}</ul>` : `<p class="muted">${t('gs.noPending')}</p>`}
      <button class="btn ghost block" data-action="invite">${icon('userPlus')} ${t('group.invite')}</button>
    </section>
    <label class="setting row"><span><span class="setting-label">${t('gs.openLogging')}</span><span class="fine">${t('gs.openLoggingHelp')}</span></span>
      <span class="switch"><input type="checkbox" data-change="open-logging" ${g.openLogging ? 'checked' : ''}><i></i></span></label>
    <div class="danger-zone">
      <button class="btn ghost danger-text" data-action="group-delete">${icon('trash')} ${t('gs.delete')}</button>
      <p class="fine">${t('gs.deleteNote')}</p>
    </div>` : `<p class="fine">${t('gs.onlyOwner', { owner: `<strong>${esc(g.ownerName || t('group.creator'))}</strong>` })}</p>`}`);
}

function openGroupSettings() {
  groupPerms = null;
  groupSettingsModal();
  if (!S.group.isOwner) return;
  const gid = S.group.id;
  S.store.listPermissions(gid).then((p) => {
    groupPerms = p;
    if ($modal.open && S.group?.id === gid && $modal.querySelector('.member-list')) groupSettingsModal();
  }, (e) => toast(e.message, { error: true }));
}

/** Confirmation for irreversible actions. "Cancel" goes back to where it came from. */
function confirmModal(title, text, yesLabel, onYes, onNo = closeModal) {
  pendingConfirm = { onYes, onNo };
  openModal(`${modalHead(title)}<p>${text}</p>
    <footer class="modal-foot"><button class="btn ghost" data-action="confirm-no">${t('common.cancel')}</button>
      <button class="btn danger-solid" data-action="confirm-yes">${yesLabel}</button></footer>`);
}

function createGroupModal() {
  openModal(`${modalHead(t('groups.create'))}
    <form data-form="create-group">
      <label class="field"><span>${t('groups.name')}</span><input name="name" required maxlength="60" placeholder="${t('groups.namePlaceholder')}" autofocus></label>
      <p class="fine">${S.store.kind === 'google' ? t('groups.createNote') : t('groups.createDemoNote')}</p>
      <footer class="modal-foot"><button type="button" class="btn ghost" data-action="close-modal">${t('common.cancel')}</button><button class="btn primary">${t('groups.createShort')}</button></footer>
    </form>`);
}

function syncErrorModal() {
  const o = S.outbox;
  openModal(`${modalHead(t('sync.errorTitle'))}
    <p>${t('sync.errorText', { n: o.pending })}</p>
    ${o.error?.message ? `<p class="notice">${esc(o.error.message)}</p>` : ''}
    <footer class="modal-foot">
      <button class="btn ghost danger-text" data-action="sync-discard">${t('sync.discard')}</button>
      <button class="btn primary" data-action="sync-retry">${icon('refresh')} ${t('sync.retry')}</button>
    </footer>`);
}

// ---------- actions ----------
function armed(el, label) {
  // Two-tap confirmation (confirm() doesn't work in every embedded browser).
  if (el.dataset.armed) return true;
  el.dataset.armed = '1';
  const prev = el.innerHTML;
  el.innerHTML = `${icon('trash')}<span>${label}</span>`;
  el.classList.add('armed');
  setTimeout(() => { if (el.isConnected) { delete el.dataset.armed; el.innerHTML = prev; el.classList.remove('armed'); } }, 3000);
  return false;
}

/** Deletes my entries by id and returns a function that puts them back where they were. */
function removeEntries(ids, who = target()) {
  const gid = S.group.id;
  const removed = [];
  S.group.entries = S.group.entries.filter((e, i) => {
    const hit = ids.includes(e.id) && e.email === who;
    if (hit) removed.push([i, e]);
    return !hit;
  });
  for (const id of ids) S.outbox.remove(gid, id, who);
  return () => {
    if (S.group?.id !== gid) return;
    for (const [i, e] of removed) {
      S.group.entries.splice(Math.min(i, S.group.entries.length), 0, e);
      const { email, ...entry } = e;
      S.outbox.add(gid, entry, email);
    }
    render();
    if (S.sheet) renderSheet();
  };
}

/** One tap deletes; the toast offers Undo for a few seconds instead of asking to confirm. */
function deleteWithUndo(ids, message) {
  const undo = removeEntries(ids);
  toast(message, { ic: 'trash', action: t('common.undo'), onAction: undo, duration: 4000 });
}

const actions = {
  logout: () => {
    closeModal();
    Timer.stop();
    if (S.store?.kind === 'google') { G.signOut(); clearCache(); }
    Object.assign(nav, { tab: false, sheet: false, modal: false });
    Object.assign(S, { store: null, me: null, groups: [], group: null, outbox: null, needsPicker: null, tab: 'home', logFor: '', sheet: null, day: St.todayISO() });
    renderSheet();
    render();
  },
  lang: (el) => {
    setLang(el.dataset.lang);
    fmtCache.clear();
    Timer.relabel();
    if (S.store?.kind === 'demo') {
      S.store.relabel();
      S.me = S.store.me;
      if (S.group) run(() => openGroup(S.group.id));
    }
    render();
    if (S.sheet) renderSheet();
    if ($modal.open) settingsModal();
  },
  pref: (el) => {
    const k = el.dataset.k;
    prefs[k] = k === 'theme' ? el.dataset.v : Number(el.dataset.v);
    savePrefs();
    if (k === 'theme') { applyTheme(); render(); }
    el.parentElement.querySelectorAll('button').forEach((b) => b.classList.toggle('on', b === el));
  },
  tab: (el) => setTab(el.dataset.tab),
  'group-tab': (el) => { S.groupTab = el.dataset.v; render(); },
  period: (el) => { S.period = el.dataset.p; render(); },
  metric: (el) => { S.metric = el.dataset.m; render(); },
  'progress-ex': (el) => { S.exercise = el.dataset.name; render(); window.scrollTo({ top: 0, behavior: 'smooth' }); },
  month: (el) => { S.month = el.dataset.m; render(); },
  day: (el) => { S.day = el.dataset.d; render(); },
  profile: (el) => { S.profile = el.dataset.e; render(); },
  'cal-day': (el) => calDayModal(el.dataset.d),
  'goto-day': (el) => { closeModal(); S.day = el.dataset.d; setTab('log'); render(); },
  'close-modal': closeModal,
  'add-ex': () => openSheet({ kind: 'picker', q: '', cat: 'all' }),
  'open-ex': (el) => openExercise(el.dataset.name),
  'del-entry': (el) => { deleteWithUndo([el.dataset.id], t('log.attendanceDeleted')); render(); },
  'del-exercise': (el) => {
    const name = el.dataset.name;
    const ids = targetEntries().filter((e) => e.exercise === name && e.date === S.day).map((e) => e.id);
    if (!ids.length) return;
    deleteWithUndo(ids, t('log.exerciseDeleted', { name: Ex.exName(name) }));
    if (S.sheet) { S.sheet.edit = null; renderSheet(); }
    render();
  },
  'sheet-metric': (el) => { S.sheet.metric = el.dataset.m; renderSheet(); },
  install: () => {
    const ev = installEvent;
    if (!ev) return;
    installEvent = null;
    ev.prompt(); // straight from the click, as the browser requires
    ev.userChoice.then((r) => { if (r.outcome !== 'accepted') ls.set(INSTALL_KEY, String(Date.now())); render(); });
  },
  'install-dismiss': () => { ls.set(INSTALL_KEY, String(Date.now())); render(); },
  'close-sheet': closeSheet,
  'picker-cat': (el) => { S.sheet.cat = el.dataset.cat; refreshPicker(); },
  pick: (el) => {
    const d = defaultsFor(el.dataset.name);
    S.sheet = { kind: 'exercise', name: el.dataset.name, view: 'log', edit: null, w: d.w, r: d.r };
    renderSheet();
  },
  'new-ex': (el) => newExerciseModal(el.dataset.name || S.sheet?.q || ''),
  'ex-view': (el) => { readSteppers(); S.sheet.view = el.dataset.v; renderSheet(); },
  'ex-chart': () => { S.exercise = S.sheet.name; closeSheet(); setTab('progress'); },
  fill: (el) => {
    S.sheet.w = shownW(S.sheet.name, Number(el.dataset.w)); S.sheet.r = Number(el.dataset.r);
    document.getElementById('in-w').value = showNum(S.sheet.w);
    document.getElementById('in-r').value = showNum(S.sheet.r);
  },
  'save-set': saveSet,
  'edit-set': (el) => {
    readSteppers();
    const e = targetEntries().find((x) => x.id === el.dataset.id);
    if (!e) return;
    if (S.sheet.edit === e.id) { S.sheet.edit = null; } else { Object.assign(S.sheet, { edit: e.id, w: shownW(e.exercise, e.weight), r: e.reps }); }
    renderSheet();
    // The steppers are at the top: bring them into view so the edit doesn't happen off-screen.
    if (S.sheet.edit) $sheet.querySelector('.sheet-panel')?.scrollTo({ top: 0, behavior: 'smooth' });
  },
  'cancel-edit': () => { S.sheet.edit = null; renderSheet(); },
  'del-set': () => {
    const id = S.sheet.edit;
    S.sheet.edit = null;
    deleteWithUndo([id], t('ex.setDeleted'));
    renderSheet();
  },
  'timer-settings': () => timerModal(),
  'timer-start': () => { Timer.start(prefs.rest, timerOptions()); closeModal(); },
  'test-sound': () => Timer.testSound(prefs.volume),
  'test-vibration': () => Timer.testVibration(prefs.vibration),
  'timer-stop': () => { Timer.stop(); closeModal(); },
  'new-challenge': () => challengeModal(),
  'group-menu': () => groupMenu(),
  settings: () => settingsModal(),
  invite: () => inviteModal(),
  'create-group': () => createGroupModal(),
  refresh: () => { closeModal(); run(() => openGroup(S.group.id)); },
  reconnect: () => reconnect(),
  'sync-error': () => syncErrorModal(),
  'group-settings': () => openGroupSettings(),
  'log-for': (el) => { closeModal(); S.logFor = el.dataset.e === S.me.email ? '' : el.dataset.e; render(); },
  'log-for-menu': () => logForMenu(),
  'create-solo': () => run(async () => {
    const id = await S.store.createGroup(t('groups.soloName'));
    S.groups = await S.store.listGroups();
    S.tab = 'home';
    await openGroup(id);
  }),
  'start-workout': () => { S.day = St.todayISO(); setTab('log'); openSheet({ kind: 'picker', q: '', cat: 'all' }); },
  'go-log': () => { S.day = St.todayISO(); setTab('log'); },
  'toggle-info': (el) => {
    const box = document.getElementById(el.getAttribute('aria-controls'));
    if (!box) return;
    box.hidden = !box.hidden;
    el.setAttribute('aria-expanded', String(!box.hidden));
  },
  'confirm-yes': () => { const c = pendingConfirm; pendingConfirm = null; closeModal(); c?.onYes(); },
  'confirm-no': () => { const c = pendingConfirm; pendingConfirm = null; (c?.onNo || closeModal)(); },
  'member-remove': (el) => {
    const m = member(el.dataset.e);
    if (!m) return;
    const gid = S.group.id;
    const perm = groupPerms?.find((p) => p.email === m.email);
    confirmModal(t('gs.removeTitle', { name: esc(m.name) }), t('gs.removeText', { name: esc(m.name) }), t('gs.remove'),
      () => run(async () => {
        await S.store.removeMember(gid, m.email, perm?.id);
        await openGroup(gid);
        toast(t('gs.removed', { name: m.name }), { ic: 'check' });
        openGroupSettings();
      }), groupSettingsModal);
  },
  'invite-cancel': (el) => run(async () => {
    await S.store.revoke(S.group.id, el.dataset.id);
    groupPerms = (groupPerms || []).filter((p) => p.id !== el.dataset.id);
    groupSettingsModal();
    toast(t('gs.inviteCancelled'), { ic: 'check' });
  }),
  'group-delete': () => {
    const g = S.group;
    confirmModal(t('gs.deleteTitle', { name: esc(g.name) }), t('gs.deleteText'), t('gs.deleteYes'),
      () => run(async () => {
        await S.store.deleteGroup(g.id);
        S.groups = await S.store.listGroups();
        S.group = null;
        const next = S.groups[0];
        if (next) await openGroup(next.id);
        else { saveCache(); render(); }
        toast(t('gs.deleted'), { ic: 'trash' });
      }), groupSettingsModal);
  },
  'sync-retry': () => { closeModal(); S.outbox.flush(); },
  'sync-discard': (el) => {
    if (!armed(el, t('common.confirmDelete'))) return;
    S.outbox.discard();
    closeModal();
    run(() => openGroup(S.group.id));
  },
  'share-link': () => {
    const link = document.getElementById('invite-link').value;
    navigator.share?.({ title: 'GymTracker', text: t('invite.message', { group: S.group.name, link: '' }).trim(), url: link }).catch(() => {});
  },
  'copy-link': () => {
    const v = document.getElementById('invite-link').value;
    navigator.clipboard?.writeText(v).then(() => toast(t('invite.copied'), { ic: 'check' }), () => toast(t('invite.copyFailed')));
  },
  'switch-group': (el) => { closeModal(); run(() => openGroup(el.dataset.id)); },
  'join-current': () => run(async () => {
    await S.store.join(S.group.id);
    S.groups = await S.store.listGroups();
    await openGroup(S.group.id);
    toast(t('join.done'), { ic: 'check' });
  }),
  'pick-join': () => run(async () => {
    const id = await G.pickSheet(S.needsPicker);
    if (!id) return;
    await S.store.join(id);
    S.needsPicker = null;
    S.pendingGroup = null;
    history.replaceState(history.state, '', location.pathname);
    S.groups = await S.store.listGroups();
    await openGroup(id);
    toast(t('join.done'), { ic: 'check' });
  }),
  'pick-any': () => {
    closeModal();
    run(async () => {
      const id = await G.pickSheet();
      if (!id) return;
      await S.store.join(id);
      S.groups = await S.store.listGroups();
      await openGroup(id);
      toast(t('join.done'), { ic: 'check' });
    });
  },
  'cancel-join': () => {
    S.needsPicker = null; S.pendingGroup = null;
    history.replaceState(history.state, '', location.pathname);
    run(afterLogin);
  },
  login: () => {
    const signingIn = G.signIn(); // first line: the popup must open right in the click or it gets blocked
    // While Google's window is open the button shows "Opening Google…". Google's window can close without
    // telling us (some browsers and installed apps), so once we're back on screen with no answer, the
    // button comes back for another try. A late answer still completes the sign-in.
    S.signingIn = true;
    render();
    const giveUp = () => { if (S.signingIn) { S.signingIn = false; if (!S.store && !S.booting) render(); } };
    const onBack = () => setTimeout(giveUp, 2500);
    window.addEventListener('focus', onBack, { once: true });
    const timeout = setTimeout(giveUp, 60000);
    const done = () => { S.signingIn = false; clearTimeout(timeout); window.removeEventListener('focus', onBack); };
    signingIn.then(() => { done(); run(completeLogin); }, (e) => { done(); render(); toast(e.message, { error: true }); });
  },
  'boot-cancel': () => { S.booting = false; S.store = null; S.me = null; S.group = null; render(); },
  demo: () => run(async () => {
    const store = new DemoStore();
    startSession(store, store.me, null);
    S.pendingGroup = null;
    await afterLogin();
  }),
};

/** After Google answers: load profile, groups and the current group behind a loading screen. */
async function completeLogin() {
  S.booting = true;
  render();
  try {
      // Profile and group list don't depend on each other: fetch both at once.
      const store = new G.SheetStore(null);
      const [me, groups] = await Promise.all([G.getProfile(), store.listGroups()]);
      store.me = me;
      startSession(store, me, `gt:outbox:${me.email}`);
      S.groups = groups;
      // Signed in on this device before: show the last copy of the group now, refresh behind it.
      const cache = readJSON(cacheKey(me.email));
      if (!S.pendingGroup && cache?.group?.id && groups.some((g) => g.id === cache.group.id)) {
        showCachedGroup(cache.group);
        S.booting = false;
        render();
      }
      saveCache();
      G.loadPicker().catch(() => {});
      await afterLogin(groups);
  } finally {
    if (S.booting) { S.booting = false; render(); }
  }
}



const forms = {
  'new-ex': (f) => {
    const raw = f.name.value.trim().replace(/\s+/g, ' ');
    if (!raw) return;
    const existing = Ex.findExisting(raw, usedNames());
    const open = (name) => {
      closeModal();
      const d = defaultsFor(name);
      const sheet = { kind: 'exercise', name, view: 'log', edit: null, w: d.w, r: d.r };
      if (S.sheet) { S.sheet = sheet; renderSheet(); } else openSheet(sheet);
    };
    if (existing) return open(existing);
    const ex = { name: raw.charAt(0).toLocaleUpperCase(locale()) + raw.slice(1), cat: f.cat.value };
    return run(async () => {
      await S.store.addExercise(S.group.id, ex);
      S.group.exercises = [...(S.group.exercises || []), ex];
      Ex.setCustomExercises(S.group.exercises);
      saveCache();
      toast(t('newEx.created', { name: ex.name }), { ic: 'check' });
      open(ex.name);
    });
  },
  'rename-group': (f) => {
    const name = f.name.value.trim();
    const gid = S.group.id;
    if (!name || name === S.group.name) return;
    return run(async () => {
      await S.store.renameGroup(gid, name);
      S.group.name = name;
      S.groups = S.groups.map((x) => (x.id === gid ? { ...x, name } : x));
      saveCache();
      render();
      groupSettingsModal();
      toast(t('gs.renamed'), { ic: 'check' });
    });
  },
  challenge: (f) => {
    const c = { id: uid(), title: f.title.value.trim(), type: f.type.value, exercise: f.exercise.value, start: f.start.value, end: f.end.value };
    if (c.end < c.start) return toast(t('ch.badDates'), { error: true });
    return run(async () => {
      await S.store.addChallenge(S.group.id, c);
      closeModal();
      S.groupTab = 'challenges';
      setTab('group');
      await openGroup(S.group.id);
      toast(t('ch.created'), { ic: 'flag' });
    });
  },
  invite: (f) => {
    const email = f.email.value.trim();
    const link = document.getElementById('invite-link').value;
    return run(async () => {
      await S.store.invite(S.group.id, email, link);
      f.reset();
      toast(S.store.kind === 'demo' ? t('invite.demoSent') : t('invite.sent', { email }), { ic: 'check' });
    });
  },
  'create-group': (f) => {
    const name = f.name.value.trim();
    if (!name) return;
    return run(async () => {
      const id = await S.store.createGroup(name);
      closeModal();
      S.groups = await S.store.listGroups();
      S.tab = 'home';
      await openGroup(id);
      toast(t('groups.created'), { action: t('group.invite'), onAction: inviteModal });
    });
  },
};

document.addEventListener('click', (e) => {
  const el = e.target.closest('[data-action]');
  if (!el || el.disabled) return;
  if (el.dataset.step) return;
  actions[el.dataset.action]?.(el, e);
});
// +/− are handled separately: a tap adds one step, unless holding already repeated it.
$sheet.addEventListener('click', (e) => {
  const b = e.target.closest('[data-step]');
  if (!b) return;
  if (!held) step(b.dataset.step, Number(b.dataset.d));
  held = false;
});
document.addEventListener('keydown', (e) => {
  const el = e.target;
  if ((e.key === 'Enter' || e.key === ' ') && el.matches?.('[role=button][data-action]')) { e.preventDefault(); el.click(); }
  if (e.key === 'Enter' && el.classList?.contains('step-input')) { e.preventDefault(); saveSet(); }
  if (e.key === 'Escape' && S.sheet && !$modal.open) closeSheet();
});
document.addEventListener('submit', (e) => {
  const f = e.target.closest('[data-form]');
  if (!f) return;
  e.preventDefault();
  forms[f.dataset.form]?.(f);
});
document.addEventListener('input', (e) => {
  const range = e.target.dataset?.range;
  if (range === 'volume') {
    prefs.volume = Number(e.target.value) / 100;
    document.getElementById('volume-value').textContent = `${e.target.value} %`;
    savePrefs();
  } else if (range === 'vibration') {
    prefs.vibration = Number(e.target.value);
    document.getElementById('vibration-value').textContent = t(`timer.vib${prefs.vibration}`);
    savePrefs();
    Timer.testVibration(prefs.vibration); // feel it while choosing
  }
  if (e.target.id === 'picker-q') { S.sheet.q = e.target.value; refreshPicker(); }
  if (e.target.classList?.contains('step-input')) readSteppers();
});
document.addEventListener('change', (e) => {
  const el = e.target;
  if (el.dataset?.change === 'exercise') { S.exercise = el.value; render(); }
  if (el.dataset?.change === 'compare') { S.compare = el.checked; render(); }
  if (el.dataset?.change === 'open-logging') {
    const open = el.checked;
    const gid = S.group.id;
    run(async () => {
      await S.store.setOpenLogging(gid, open);
      await openGroup(gid);
      groupSettingsModal();
      toast(open ? t('gs.openOn') : t('gs.openOff'), { ic: 'check' });
    });
  }
  if (el.dataset?.change === 'day' && St.isISODate(el.value)) { S.day = el.value > St.todayISO() ? St.todayISO() : el.value; render(); }
  if (el.dataset?.prefToggle) {
    prefs[el.dataset.prefToggle] = el.checked;
    savePrefs();
    if (el.dataset.prefToggle === 'notify' && el.checked) enableNotifications(el);
  }
});
$modal.addEventListener('click', (e) => { if (e.target === $modal) closeModal(); });
matchMedia('(prefers-color-scheme: dark)').addEventListener?.('change', () => { applyTheme(); if (S.tab === 'progress') render(); });

// When returning to the app: upload pending changes and, if it's been a while, reload the group.
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState !== 'visible' || !S.group) return;
  S.outbox?.flush();
  const canLoad = S.store.kind === 'demo' || G.tokenValid();
  if (canLoad && !S.sheet && !$modal.open && Date.now() - S.loadedAt > 120000) run(() => openGroup(S.group.id));
});
window.addEventListener('online', () => S.outbox?.flush());
// iOS Safari ignores user-scalable=no: block its pinch gesture directly.
document.addEventListener('gesturestart', (e) => e.preventDefault());

// ---------- startup ----------
applyTheme();
if (!restoreSession()) render();
if (G.isConfigured()) G.loadGis().catch((e) => toast(e.message, { error: true }));
// Only used for the rest-timer notification; it caches nothing.
if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js').catch(() => {});
