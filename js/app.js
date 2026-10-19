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
const TABS = [['log', 'dumbbell'], ['history', 'calendar'], ['progress', 'chart'], ['group', 'users']];
const CH_TYPES = ['attendance', 'volume', 'improvement'];
const REST_OPTIONS = [60, 90, 120, 150, 180, 240];
const STEP_OPTIONS = [1, 1.25, 2.5, 5];

// ---------- per-device preferences ----------
const PREFS_KEY = 'gt:prefs';
const prefs = { rest: 90, autoRest: true, step: 2.5, theme: 'system' };
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
  tab: 'log', groupTab: 'ranking',
  day: St.todayISO(), period: '30', month: St.todayISO().slice(0, 7), exercise: '', compare: true, profile: '',
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
const fmtW = (w) => (w > 0 ? `${fmtN(w, 2)} kg` : t('unit.bw'));
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

let toastTimer;
function toast(msg, { error = false, action, onAction, ic } = {}) {
  clearTimeout(toastTimer);
  $toast.className = `show${error ? ' error' : ''}`;
  $toast.innerHTML = `${ic ? icon(ic) : ''}<span>${esc(msg)}</span>${action ? `<button class="toast-btn" data-toast-action>${esc(action)}</button>` : ''}`;
  if (action) $toast.querySelector('[data-toast-action]').onclick = () => { $toast.className = ''; onAction(); };
  toastTimer = setTimeout(() => { $toast.className = ''; }, action ? 15000 : error ? 10000 : 3500);
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
  S.outbox = new Outbox(outboxKey, store, renderSync);
}

async function afterLogin() {
  S.groups = await S.store.listGroups();
  S.outbox.flush();
  if (S.pendingGroup) return openPending(S.pendingGroup);
  const last = ls.get('gt:lastGroup');
  const g = S.groups.find((x) => x.id === last) || S.groups[0];
  if (g) return openGroup(g.id);
  render();
}

async function openGroup(id) {
  const g = await S.store.loadGroup(id);
  g.entries = S.outbox.apply(id, g.entries, S.me.email);
  assignColors(g);
  Ex.setCustomExercises(g.exercises || []);
  S.group = g;
  S.loadedAt = Date.now();
  if (!g.members.some((m) => m.email === S.profile)) S.profile = S.me.email;
  ls.set('gt:lastGroup', id);
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
  switch (S.tab) {
    case 'history': return viewHistory();
    case 'progress': return viewProgress();
    case 'group': return viewGroup();
    default: return viewLog();
  }
}

function langToggle() {
  const other = getLang() === 'es' ? 'en' : 'es';
  return `<button class="lang-btn" data-action="lang" data-lang="${other}" aria-label="${t('settings.language')}">${icon('globe')}<span>${other.toUpperCase()}</span></button>`;
}

function landing() {
  const configured = G.isConfigured();
  const hint = G.savedHint();
  return `<main class="landing">
    <header class="landing-top">
      <div class="brand">${logo(34)}<span class="wordmark">GymTracker</span></div>
      ${langToggle()}
    </header>
    <section class="hero">
      <div class="hero-copy">
        <h1>${t('landing.title')}</h1>
        <p class="lead">${t('landing.lead')}</p>
        ${S.pendingGroup ? `<p class="pill-note">${icon('userPlus')} ${t('landing.invited')}</p>` : ''}
        <div class="cta">
          ${configured
            ? `<button class="btn-google" data-action="login">${googleG}<span>${hint ? t('landing.continueAs', { email: esc(hint) }) : t('landing.google')}</span></button>`
            : `<div class="notice">${t('landing.notConfigured')}</div>`}
          <button class="btn ghost lg" data-action="demo">${t('landing.demo')}</button>
        </div>
        ${configured ? `<p class="fine">${icon('shield')} ${t('landing.driveHint')}</p>` : ''}
      </div>
      <div class="hero-visual" aria-hidden="true">${heroMock()}</div>
    </section>
    <section class="features">
      ${[['dumbbell', 'f1'], ['timer', 'f2'], ['users', 'f3']].map(([ic, k]) => `<article class="feature">
        <span class="feature-ic">${icon(ic)}</span><h3>${t(`landing.${k}.title`)}</h3><p>${t(`landing.${k}.text`)}</p></article>`).join('')}
    </section>
    <footer class="landing-foot">
      <span>${t('landing.noServer')}</span>
      <span><a href="privacy.html">${t('common.privacy')}</a> · <a href="https://github.com/cruzlorite/gymtracker" target="_blank" rel="noopener">GitHub</a></span>
    </footer>
  </main>`;
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
      <div class="nav-brand">${logo(30)}<span class="wordmark">GymTracker</span></div>
      ${TABS.map(([k, ic]) => `<button class="nav-item ${S.tab === k ? 'on' : ''}" data-action="tab" data-tab="${k}" ${S.tab === k ? 'aria-current="page"' : ''}>
        ${icon(ic)}<span>${t(`nav.${k}`)}</span></button>`).join('')}
    </nav>` : ''}
    <div class="page">
      <header class="appbar">
        <span class="appbar-logo">${logo(28)}</span>
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
  return emptyState('users', t('groups.emptyTitle'), t('groups.emptyText'),
    `<form class="inline-form" data-form="create-group">
      <input name="name" required maxlength="60" placeholder="${t('groups.namePlaceholder')}" aria-label="${t('groups.name')}">
      <button class="btn primary">${t('groups.create')}</button>
    </form>
    ${S.store.kind === 'google' ? `<button class="btn ghost" data-action="pick-any">${t('groups.pickShared')}</button>` : ''}`);
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
  const all = mine();
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
        <button class="btn ghost" data-action="mark-attendance">${icon('check')} ${t('log.markAttendance')}</button>
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
            <span class="ex-meta">${t('log.sets', { n: list.reduce((a, e) => a + (e.sets || 1), 0) })}</span>${icon('right', 'chev')}</header>
          <ol class="sets">${list.map((e, i) => `<li>${setLine(e, i, prs)}</li>`).join('')}</ol>
        </article>`;
      }).join('')}
      ${attendance.map((e) => `<div class="attendance-row">${icon('check')}<span>${t('log.attended')}</span>
        <button class="icon-btn sm" data-action="del-entry" data-id="${esc(e.id)}" aria-label="${t('common.delete')}">${icon('trash')}</button></div>`).join('')}
      </div>`;
  }
  return `${nav}${body}
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
function exerciseOptions(entries) {
  const freq = new Map();
  for (const e of entries) if (e.exercise && e.weight > 0) freq.set(e.exercise, (freq.get(e.exercise) || 0) + 1);
  return [...freq].sort((a, b) => b[1] - a[1]).map(([ex]) => ex);
}

function periodChips() {
  return `<div class="seg" role="group" aria-label="${t('period.label')}">${St.PERIODS.map((k) =>
    `<button class="${S.period === k ? 'on' : ''}" data-action="period" data-p="${k}">${t(`period.${k}`)}</button>`).join('')}</div>`;
}

function viewProgress() {
  const exs = exerciseOptions(S.group.entries);
  if (!exs.length) return `<div class="view-head"><h1>${t('nav.progress')}</h1></div>${emptyState('chart', t('progress.emptyTitle'), t('progress.emptyText'))}`;
  if (!exs.includes(S.exercise)) S.exercise = exerciseOptions(mine())[0] || exs[0];
  const r = St.periodRange(S.period);
  const rows = members().map((m) => ({ m, imp: St.improvement(entriesOf(m.email), r, S.exercise).details[0] }));
  const myPrs = St.prs(mine()).filter((p) => p.e1rm > 0).sort((a, b) => b.e1rm - a.e1rm);
  return `<div class="view-head">
      <h1>${t('nav.progress')}</h1>
      <div class="select-wrap"><select data-change="exercise" aria-label="${t('progress.exercise')}">${exs.map((ex) =>
        `<option value="${esc(ex)}" ${ex === S.exercise ? 'selected' : ''}>${esc(Ex.exName(ex))}</option>`).join('')}</select>${icon('down')}</div>
    </div>
    <div class="toolbar">${periodChips()}
      <label class="switch-label"><span>${t('progress.compare')}</span><span class="switch"><input type="checkbox" data-change="compare" ${S.compare ? 'checked' : ''}><i></i></span></label>
    </div>
    <div class="card chart-card"><div class="chart-box"><canvas id="chart" aria-label="${t('progress.chartLabel')}"></canvas></div>
      <p class="fine">${t('progress.e1rmHelp')}</p></div>
    <div class="grid two">
      <div class="card">
        <h3>${t('progress.improvement')}</h3>
        <table class="table">
          <thead><tr><th>${t('progress.person')}</th><th class="r">${t('progress.start')}</th><th class="r">${t('progress.best')}</th><th class="r">${t('progress.change')}</th></tr></thead>
          <tbody>${rows.sort((a, b) => (b.imp?.pct ?? -9) - (a.imp?.pct ?? -9)).map(({ m, imp }) => `<tr class="${m.email === S.me.email ? 'me' : ''}">
            <td><span class="who">${avatar(m)} ${esc(m.name)}</span></td>
            ${imp ? `<td class="r">${fmtN(imp.base, 1)}</td><td class="r">${fmtN(imp.peak, 1)}</td><td class="r ${imp.pct >= 0 ? 'up' : 'down'}">${fmtPct(imp.pct)}</td>`
              : `<td class="r muted" colspan="3">${t('progress.needTwo')}</td>`}
          </tr>`).join('')}</tbody>
        </table>
      </div>
      <div class="card">
        <h3>${icon('trophy')} ${t('progress.myRecords')}</h3>
        ${myPrs.length ? `<table class="table"><thead><tr><th>${t('progress.exercise')}</th><th class="r">${t('progress.bestSet')}</th><th class="r">${t('progress.e1rm')}</th></tr></thead>
          <tbody>${myPrs.map((p) => `<tr><td><button class="link" data-action="open-ex" data-name="${esc(p.exercise)}">${esc(Ex.exName(p.exercise))}</button></td>
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
  const accent = css.getPropertyValue('--accent').trim();
  const r = St.periodRange(S.period);
  const who = S.compare ? members() : members().filter((m) => m.email === S.me.email);
  const datasets = who.map((m) => {
    const data = St.bestByDate(entriesOf(m.email).filter((e) => e.date >= r.from && e.date <= r.to), S.exercise)
      .map((p) => ({ x: +St.parseISO(p.date), y: Math.round(p.value * 10) / 10 }));
    const me = m.email === S.me.email;
    const color = me && !S.compare ? accent : m.color;
    return {
      label: m.name, data, borderColor: color, backgroundColor: color, tension: 0.3,
      pointRadius: 2.5, pointHoverRadius: 5, borderWidth: me ? 3 : 2,
    };
  }).filter((d) => d.data.length);
  S.chart = new window.Chart(canvas, {
    type: 'line',
    data: { datasets },
    options: {
      responsive: true, maintainAspectRatio: false, animation: { duration: 300 },
      interaction: { mode: 'nearest', intersect: false },
      scales: {
        x: { type: 'linear', ticks: { color: text, maxTicksLimit: 6, callback: (v) => df({ day: 'numeric', month: 'short' }).format(new Date(v)) }, grid: { color: grid } },
        y: { ticks: { color: text, callback: (v) => `${fmtN(v)} kg` }, grid: { color: grid } },
      },
      plugins: {
        legend: { display: S.compare, labels: { color: text, usePointStyle: true, boxWidth: 8 } },
        tooltip: { callbacks: {
          title: (items) => cap(df({ weekday: 'long', day: 'numeric', month: 'long' }).format(new Date(items[0].parsed.x))),
          label: (it) => ` ${it.dataset.label}: ${fmtN(it.parsed.y, 1)} kg`,
        } },
      },
    },
  });
}

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
  const fmt = (type, v) => (type === 'attendance' ? t('unit.days', { n: fmtN(v) }) : type === 'volume' ? fmtKg(v) : `${v > 0 ? '+' : ''}${fmtN(v, 1)} %`);
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
function openSheet(sheet) {
  // A single history entry, so the phone's back button closes the sheet.
  if (!S.sheet) history.pushState({ sheet: true }, '');
  S.sheet = sheet;
  renderSheet();
}
function closeSheet() {
  if (S.sheet && history.state?.sheet) history.back();
  else { S.sheet = null; renderSheet(); render(); }
}
window.addEventListener('popstate', () => {
  if (!S.sheet) return;
  S.sheet = null;
  renderSheet();
  render();
});

function renderSheet() {
  document.body.classList.toggle('sheet-open', Boolean(S.sheet));
  if (!S.sheet) { $sheet.className = ''; $sheet.innerHTML = ''; return; }
  $sheet.className = 'open';
  $sheet.innerHTML = `<div class="sheet-panel" role="dialog" aria-modal="true">${S.sheet.kind === 'picker' ? pickerSheet() : exerciseSheet()}</div>`;
  if (S.sheet.kind === 'picker') {
    const q = document.getElementById('picker-q');
    if (q && matchMedia('(hover: hover)').matches) q.focus();
  }
}

function lastInfo(name) {
  const s = St.lastSession(mine(), name, '9999-12-31');
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
    for (const e of mine()) if (e.exercise && (last.get(e.exercise) || '') < e.date) last.set(e.exercise, e.date);
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
  const es = mine();
  const today = es.filter((e) => e.exercise === name && e.date === S.day);
  if (today.length) { const e = today[today.length - 1]; return { w: e.weight, r: e.reps }; }
  const last = St.lastSession(es, name, S.day);
  if (last) return { w: last.sets[0].weight, r: last.sets[0].reps };
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
        <span class="muted"><span class="cat-dot" style="--c:${cat.color}"></span>${esc(Ex.catLabel(cat))} · ${S.day === today ? t('day.today') : fmtLong(S.day)}</span></div>
      <button class="icon-btn" data-action="timer-settings" aria-label="${t('timer.title')}">${icon('timer')}</button>
    </header>
    <div class="seg wide">
      <button class="${sh.view === 'log' ? 'on' : ''}" data-action="ex-view" data-v="log">${t('ex.log')}</button>
      <button class="${sh.view === 'history' ? 'on' : ''}" data-action="ex-view" data-v="history">${t('ex.history')}</button>
    </div>
    <div class="sheet-body">${sh.view === 'history' ? exerciseHistoryView(name) : exerciseLogView(name)}</div>`;
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
  const all = mine();
  const todays = all.filter((e) => e.exercise === name && e.date === S.day);
  const prs = St.prIds(all);
  const last = St.lastSession(all, name, S.day);
  const editing = sh.edit && todays.some((e) => e.id === sh.edit);
  return `<section class="entry-card ${editing ? 'editing' : ''}">
      ${editing ? `<p class="editing-label">${icon('edit')} ${t('ex.editing', { n: todays.findIndex((e) => e.id === sh.edit) + 1 })}</p>` : ''}
      <div class="steppers">
        ${stepper('w', t('ex.weight'), sh.w, 'kg')}
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
    </section>
    ${last ? `<section class="last">
      <h3>${t('ex.lastTime', { day: relDay(last.date) })}</h3>
      <div class="chips">${last.sets.map((e) => `<button class="chip set-chip" data-action="fill" data-w="${e.weight}" data-r="${e.reps}">${fmtW(e.weight)} × ${fmtN(e.reps)}${e.sets > 1 ? ` <span class="muted">(${e.sets})</span>` : ''}</button>`).join('')}</div>
    </section>` : ''}
    <section class="today-sets">
      <h3>${S.day === St.todayISO() ? t('ex.todaySets') : t('ex.daySets')} ${todays.length ? `<span class="count">${todays.length}</span>` : ''}</h3>
      ${todays.length ? `<ol class="sets big">${todays.map((e, i) => `<li><button class="set-btn ${sh.edit === e.id ? 'on' : ''}" data-action="edit-set" data-id="${esc(e.id)}">${setLine(e, i, prs)}</button></li>`).join('')}</ol>`
        : `<p class="muted">${t('ex.noSetsYet')}</p>`}
    </section>`;
}

function exerciseHistoryView(name) {
  const all = mine();
  const hist = St.exerciseHistory(all, name);
  if (!hist.length) return `<p class="muted pad">${t('ex.noHistory')}</p>`;
  const prs = St.prIds(all);
  const best = St.prs(all.filter((e) => e.exercise === name))[0];
  return `<div class="tiles three">
      <div class="tile"><span>${t('progress.e1rm')}</span><strong>${fmtN(best?.e1rm || 0, 1)} kg</strong></div>
      <div class="tile"><span>${t('ex.maxWeight')}</span><strong>${fmtW(best?.weight || 0)}</strong></div>
      <div class="tile"><span>${t('ex.sessions')}</span><strong>${fmtN(hist.length)}</strong></div>
    </div>
    <button class="btn ghost block" data-action="ex-chart">${icon('chart')} ${t('ex.seeChart')}</button>
    <ul class="history">${hist.slice(0, 30).map((h) => `<li>
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
  const weight = Math.max(0, numIn(sh.w));
  if (!reps || reps < 1) { toast(t('ex.needReps'), { error: true }); document.getElementById('in-r')?.focus(); return; }
  const gid = S.group.id;
  if (sh.edit) {
    const old = S.group.entries.find((e) => e.id === sh.edit && e.email === S.me.email);
    if (old) {
      Object.assign(old, { weight, reps });
      S.outbox.update(gid, { id: old.id, date: old.date, exercise: old.exercise, sets: old.sets || 1, reps, weight, notes: old.notes || '' });
    }
    sh.edit = null;
    toast(t('ex.updated'), { ic: 'check' });
  } else {
    const entry = { id: uid(), date: S.day, exercise: sh.name, sets: 1, reps, weight, notes: '' };
    S.group.entries.push({ ...entry, email: S.me.email });
    S.outbox.add(gid, entry);
    if (St.prIds(mine()).has(entry.id)) toast(t('ex.newPr'), { ic: 'trophy' });
    // Only while actually training: back-filling a past day doesn't need rest.
    if (prefs.autoRest && S.day === St.todayISO()) Timer.start(prefs.rest);
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
  if (!$modal.open) $modal.showModal();
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
      <span class="switch"><input type="checkbox" data-pref-toggle="autoRest" ${prefs.autoRest ? 'checked' : ''}><i></i></span></label>`;
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
      <label class="field"><span>${t('ch.type')}</span><div class="select-wrap"><select name="type">${CH_TYPES.map((k) => `<option value="${k}">${t(`ch.${k}`)} — ${t(`ch.${k}.help`)}</option>`).join('')}</select>${icon('down')}</div></label>
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
  openModal(`${modalHead(t('invite.title'))}
    ${S.group.canShare ? `<p>${t('invite.text')}</p>
    <form data-form="invite" class="inline-form">
      <input type="email" name="email" required placeholder="email@gmail.com" aria-label="${t('invite.emailLabel')}" autofocus>
      <button class="btn primary">${t('invite.send')}</button>
    </form>` : `<p>${t('invite.onlyOwner', { owner: `<strong>${esc(owner)}</strong>` })}</p>`}
    <label class="field"><span>${t('invite.link')}</span>
      <div class="inline-form"><input readonly value="${esc(link)}" id="invite-link"><button class="btn ghost" type="button" data-action="copy-link">${icon('link')} ${t('common.copy')}</button></div></label>
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
      ${g?.isMember ? `<button class="btn ghost" data-action="invite">${icon('userPlus')} ${t('group.invite')}</button>` : ''}
      ${g ? `<button class="btn ghost" data-action="refresh">${icon('refresh')} ${t('group.refresh')}</button>` : ''}
      <button class="btn ghost" data-action="create-group">${icon('plus')} ${t('groups.create')}</button>
      ${isGoogle ? `<button class="btn ghost" data-action="pick-any">${icon('sheet')} ${t('groups.pickShared')}</button>` : ''}
      ${g?.url ? `<a class="btn ghost" href="${esc(g.url)}" target="_blank" rel="noopener">${icon('external')} ${t('group.openSheet')}</a>` : ''}
    </div>`);
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

function removeEntry(id) {
  S.group.entries = S.group.entries.filter((e) => !(e.id === id && e.email === S.me.email));
  S.outbox.remove(S.group.id, id);
}

const actions = {
  login: () => run(async () => {
    await G.signIn(); // first line: must run right in the click so the popup isn't blocked
    const me = await G.getProfile();
    startSession(new G.SheetStore(me), me, `gt:outbox:${me.email}`);
    G.loadPicker().catch(() => {});
    await afterLogin();
  }),
  demo: () => run(async () => {
    const store = new DemoStore();
    startSession(store, store.me, null);
    S.pendingGroup = null;
    await afterLogin();
  }),
  logout: () => {
    closeModal();
    Timer.stop();
    if (S.store?.kind === 'google') G.signOut();
    Object.assign(S, { store: null, me: null, groups: [], group: null, outbox: null, needsPicker: null, tab: 'log', sheet: null, day: St.todayISO() });
    renderSheet();
    render();
  },
  lang: (el) => {
    setLang(el.dataset.lang);
    fmtCache.clear();
    Timer.relabel();
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
  tab: (el) => { S.tab = el.dataset.tab; render(); window.scrollTo({ top: 0 }); },
  'group-tab': (el) => { S.groupTab = el.dataset.v; render(); },
  period: (el) => { S.period = el.dataset.p; render(); },
  month: (el) => { S.month = el.dataset.m; render(); },
  day: (el) => { S.day = el.dataset.d; render(); },
  profile: (el) => { S.profile = el.dataset.e; render(); },
  'cal-day': (el) => calDayModal(el.dataset.d),
  'goto-day': (el) => { closeModal(); S.day = el.dataset.d; S.tab = 'log'; render(); window.scrollTo({ top: 0 }); },
  'close-modal': closeModal,
  'add-ex': () => openSheet({ kind: 'picker', q: '', cat: 'all' }),
  'open-ex': (el) => openExercise(el.dataset.name),
  'mark-attendance': () => {
    const entry = { id: uid(), date: S.day, exercise: '', sets: 0, reps: 0, weight: 0, notes: '' };
    S.group.entries.push({ ...entry, email: S.me.email });
    S.outbox.add(S.group.id, entry);
    render();
    toast(t('log.attendanceSaved'), { ic: 'check' });
  },
  'del-entry': (el) => { if (armed(el, t('common.confirmDelete'))) { removeEntry(el.dataset.id); render(); } },
  'close-sheet': closeSheet,
  'picker-cat': (el) => { S.sheet.cat = el.dataset.cat; refreshPicker(); },
  pick: (el) => {
    const d = defaultsFor(el.dataset.name);
    S.sheet = { kind: 'exercise', name: el.dataset.name, view: 'log', edit: null, w: d.w, r: d.r };
    renderSheet();
  },
  'new-ex': (el) => newExerciseModal(el.dataset.name || S.sheet?.q || ''),
  'ex-view': (el) => { readSteppers(); S.sheet.view = el.dataset.v; renderSheet(); },
  'ex-chart': () => { const name = S.sheet.name; S.exercise = name; S.tab = 'progress'; closeSheet(); },
  fill: (el) => {
    S.sheet.w = Number(el.dataset.w); S.sheet.r = Number(el.dataset.r);
    document.getElementById('in-w').value = showNum(S.sheet.w);
    document.getElementById('in-r').value = showNum(S.sheet.r);
  },
  'save-set': saveSet,
  'edit-set': (el) => {
    readSteppers();
    const e = mine().find((x) => x.id === el.dataset.id);
    if (!e) return;
    if (S.sheet.edit === e.id) { S.sheet.edit = null; } else { Object.assign(S.sheet, { edit: e.id, w: e.weight, r: e.reps }); }
    renderSheet();
  },
  'cancel-edit': () => { S.sheet.edit = null; renderSheet(); },
  'del-set': (el) => {
    if (!armed(el, t('common.confirmDelete'))) return;
    removeEntry(S.sheet.edit);
    S.sheet.edit = null;
    renderSheet();
  },
  'timer-settings': () => timerModal(),
  'timer-start': () => { Timer.start(prefs.rest); closeModal(); },
  'timer-stop': () => { Timer.stop(); closeModal(); },
  'new-challenge': () => challengeModal(),
  'group-menu': () => groupMenu(),
  settings: () => settingsModal(),
  invite: () => inviteModal(),
  'create-group': () => createGroupModal(),
  refresh: () => { closeModal(); run(() => openGroup(S.group.id)); },
  reconnect: () => reconnect(),
  'sync-error': () => syncErrorModal(),
  'sync-retry': () => { closeModal(); S.outbox.flush(); },
  'sync-discard': (el) => {
    if (!armed(el, t('common.confirmDelete'))) return;
    S.outbox.discard();
    closeModal();
    run(() => openGroup(S.group.id));
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
};

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
      toast(t('newEx.created', { name: ex.name }), { ic: 'check' });
      open(ex.name);
    });
  },
  challenge: (f) => {
    const c = { id: uid(), title: f.title.value.trim(), type: f.type.value, exercise: f.exercise.value, start: f.start.value, end: f.end.value };
    if (c.end < c.start) return toast(t('ch.badDates'), { error: true });
    return run(async () => {
      await S.store.addChallenge(S.group.id, c);
      closeModal();
      S.tab = 'group'; S.groupTab = 'challenges';
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
      S.tab = 'log';
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
  if (e.target.id === 'picker-q') { S.sheet.q = e.target.value; refreshPicker(); }
  if (e.target.classList?.contains('step-input')) readSteppers();
});
document.addEventListener('change', (e) => {
  const el = e.target;
  if (el.dataset?.change === 'exercise') { S.exercise = el.value; render(); }
  if (el.dataset?.change === 'compare') { S.compare = el.checked; render(); }
  if (el.dataset?.change === 'day' && St.isISODate(el.value)) { S.day = el.value > St.todayISO() ? St.todayISO() : el.value; render(); }
  if (el.dataset?.prefToggle) { prefs[el.dataset.prefToggle] = el.checked; savePrefs(); }
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

// ---------- startup ----------
applyTheme();
render();
if (G.isConfigured()) G.loadGis().catch((e) => toast(e.message, { error: true }));
