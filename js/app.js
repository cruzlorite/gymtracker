import * as G from './google.js';
import { DemoStore } from './demo.js';
import * as St from './stats.js';

const $app = document.getElementById('app');
const $modal = document.getElementById('modal');
const $toast = document.getElementById('toast');

const COLORS = ['#f0612a', '#2f80ed', '#22a06b', '#9b51e0', '#e2a400', '#0fa3b1', '#e0457b', '#6c7a89'];
const VIEWS = [['ranking', 'Ranking'], ['calendario', 'Calendario'], ['progreso', 'Progreso'], ['retos', 'Retos'], ['perfiles', 'Perfiles']];
const CH_TYPES = {
  asistencia: { label: 'Asistencia', unit: 'días', help: 'Gana quien vaya más días.' },
  volumen: { label: 'Volumen', unit: 'kg', help: 'Gana quien levante más kilos en total (series × reps × kg).' },
  mejora: { label: 'Mejora', unit: '%', help: 'Gana quien más suba su 1RM estimado respecto a su primer día del reto.' },
};

const params = new URLSearchParams(location.search);
const S = {
  store: null, me: null, groups: [], group: null,
  view: 'ranking', period: '30', month: St.todayISO().slice(0, 7), exercise: '', profile: '',
  pendingGroup: params.get('group'), needsPicker: null, chart: null,
};

// ---------- utilidades ----------
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const ls = {
  get: (k) => { try { return localStorage.getItem(k); } catch { return null; } },
  set: (k, v) => { try { localStorage.setItem(k, v); } catch { /* nada */ } },
};
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
const nf = (d = 0) => new Intl.NumberFormat('es-ES', { maximumFractionDigits: d, minimumFractionDigits: 0 });
const fmtN = (n, d = 0) => nf(d).format(n);
const fmtKg = (n) => (n >= 10000 ? `${fmtN(n / 1000, 1)} t` : `${fmtN(n)} kg`);
const fmtPct = (p) => `${p > 0 ? '+' : ''}${fmtN(p * 100, 1)} %`;
const dShort = new Intl.DateTimeFormat('es-ES', { day: 'numeric', month: 'short' });
const dLong = new Intl.DateTimeFormat('es-ES', { weekday: 'long', day: 'numeric', month: 'long' });
const dMonth = new Intl.DateTimeFormat('es-ES', { month: 'long', year: 'numeric' });
const fmtDate = (iso) => dShort.format(St.parseISO(iso));
const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);

const members = () => S.group?.members || [];
const member = (email) => members().find((m) => m.email === email);
const entriesOf = (email) => S.group.entries.filter((e) => e.email === email);

function initials(name) {
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]).join('').toUpperCase() || '?';
}
function avatar(m, size = '') {
  const pic = m.picture ? `<img src="${esc(m.picture)}" alt="" referrerpolicy="no-referrer" onerror="this.remove()">` : '';
  return `<span class="av ${size}" style="--c:${m.color || '#888'}" title="${esc(m.name)}">${esc(initials(m.name))}${pic}</span>`;
}

let toastTimer;
function toast(msg, { error = false, action, onAction } = {}) {
  clearTimeout(toastTimer);
  $toast.className = `show${error ? ' error' : ''}`;
  $toast.innerHTML = `<span>${esc(msg)}</span>${action ? `<button class="btn small" data-toast-action>${esc(action)}</button>` : ''}`;
  if (action) $toast.querySelector('[data-toast-action]').onclick = () => { $toast.className = ''; onAction(); };
  toastTimer = setTimeout(() => { $toast.className = ''; }, action ? 15000 : 4000);
}

async function run(fn) {
  document.body.classList.add('busy');
  try {
    await fn();
  } catch (e) {
    console.error(e);
    if (e?.name === 'AuthError') toast(e.message, { action: 'Reconectar', onAction: reconnect });
    else toast(e?.message || 'Algo ha fallado.', { error: true });
  } finally {
    document.body.classList.remove('busy');
  }
}

function reconnect() {
  run(async () => {
    await G.signIn();
    if (S.group) await openGroup(S.group.id);
    else render();
    toast('Sesión renovada.');
  });
}

// ---------- flujo de sesión y grupos ----------
function assignColors(g) {
  g.members.sort((a, b) => (a.joined || '9').localeCompare(b.joined || '9') || a.name.localeCompare(b.name, 'es'));
  g.members.forEach((m, i) => { m.color = COLORS[i % COLORS.length]; });
}

async function afterLogin() {
  S.groups = await S.store.listGroups();
  if (S.pendingGroup) return openPending(S.pendingGroup);
  const last = ls.get('gt:lastGroup');
  const g = S.groups.find((x) => x.id === last) || S.groups[0];
  if (g) return openGroup(g.id);
  render();
}

async function openGroup(id) {
  const g = await S.store.loadGroup(id);
  assignColors(g);
  S.group = g;
  if (!g.members.some((m) => m.email === S.profile)) S.profile = S.me.email;
  ls.set('gt:lastGroup', id);
  render();
}

async function openPending(id) {
  try {
    await openGroup(id);
    S.pendingGroup = null;
    history.replaceState(null, '', location.pathname);
  } catch (e) {
    if (e.status === 403 || e.status === 404) { S.needsPicker = id; render(); return; }
    throw e;
  }
}

// ---------- render ----------
function render() {
  if (S.chart) { S.chart.destroy(); S.chart = null; }
  if (!S.store) $app.innerHTML = landing();
  else if (S.needsPicker) $app.innerHTML = shell(joinScreen());
  else if (!S.group) $app.innerHTML = shell(noGroups());
  else if (!S.group.isMember) $app.innerHTML = shell(notMember());
  else $app.innerHTML = shell(suspiciousNote() + groupView());
  if (S.group && S.view === 'progreso') mountChart();
  document.querySelector('.tabs .on')?.scrollIntoView({ block: 'nearest', inline: 'center' });
}

function landing() {
  const configured = G.isConfigured();
  return `<main class="landing">
    <div class="hero">
      <div class="logo" aria-hidden="true">🏋️</div>
      <h1>GymTracker</h1>
      <p class="lead">Apunta tus entrenos, compite con tus amigos y descubre quién va más y quién mejora más.</p>
      ${S.pendingGroup ? '<p class="pill-note">Te han invitado a un grupo. Entra con Google para unirte.</p>' : ''}
      <div class="stack">
        ${configured
          ? '<button class="btn primary big" data-action="login"><span class="g">G</span> Entrar con Google</button>'
          : `<div class="notice"><strong>Falta configurar Google.</strong> Rellena <code>config.js</code> siguiendo el README para activar el login. Mientras tanto, puedes probar la demo.</div>`}
        <button class="btn ${configured ? 'ghost' : 'primary big'}" data-action="demo">Probar con datos de ejemplo</button>
      </div>
      <p class="fine">Sin servidor: los datos de cada grupo viven en una hoja de cálculo del Google Drive de quien lo crea. <a href="privacy.html">Privacidad</a></p>
    </div>
  </main>`;
}

function shell(content) {
  const me = S.me;
  const g = S.group;
  return `<header class="topbar">
      <div class="brand"><span aria-hidden="true">🏋️</span><span class="brand-name">GymTracker</span></div>
      ${S.groups.length || g ? `<button class="group-switch" data-action="group-menu">${esc(g?.name || 'Grupos')} <span aria-hidden="true">▾</span></button>` : ''}
      <div class="spacer"></div>
      ${g?.isMember ? '<button class="btn primary" data-action="new-entry">+ <span class="hide-sm">Registrar</span> entreno</button>' : ''}
      <button class="avatar-btn" data-action="user-menu" aria-label="Tu cuenta">${avatar({ ...me, color: member(me.email)?.color || COLORS[0] })}</button>
    </header>
    ${S.store.kind === 'demo' ? '<div class="demo-bar">Estás en modo demo: los datos son inventados y no se guardan.</div>' : ''}
    ${g?.isMember && !S.needsPicker ? `<nav class="tabs" role="tablist">${VIEWS.map(([k, l]) =>
      `<button role="tab" aria-selected="${S.view === k}" class="${S.view === k ? 'on' : ''}" data-action="view" data-v="${k}">${l}</button>`).join('')}</nav>` : ''}
    <main class="content">${content}</main>`;
}

function joinScreen() {
  return `<section class="empty">
    <div class="big-emoji" aria-hidden="true">🤝</div>
    <h2>Te han invitado a un grupo</h2>
    <p>Para que la app pueda leer y escribir en la hoja del grupo, selecciónala en la ventana de Google que se abrirá. Solo hace falta la primera vez.</p>
    <button class="btn primary big" data-action="pick-join">Unirme al grupo</button>
    <p class="fine">¿No aparece la hoja? Pide a quien te invitó que te añada desde <em>Invitar amigos</em> con tu email (${esc(S.me.email)}).</p>
    ${S.groups.length ? '<button class="btn ghost" data-action="cancel-join">Ahora no</button>' : ''}
  </section>`;
}

function noGroups() {
  return `<section class="empty">
    <div class="big-emoji" aria-hidden="true">👋</div>
    <h2>Aún no tienes ningún grupo</h2>
    <p>Crea uno e invita a tus amigos, o únete al de un amigo con el enlace que te haya pasado.</p>
    <form class="inline-form" data-form="create-group">
      <input name="name" required maxlength="60" placeholder="Nombre del grupo (p. ej. Los del gym)" aria-label="Nombre del grupo">
      <button class="btn primary">Crear grupo</button>
    </form>
    ${S.store.kind === 'google' ? '<button class="btn ghost" data-action="pick-any">Ya me han compartido una hoja: elegirla</button>' : ''}
  </section>`;
}

function notMember() {
  return `<section class="empty">
    <div class="big-emoji" aria-hidden="true">🏁</div>
    <h2>${esc(S.group.name)}</h2>
    <p>Puedes ver esta hoja, pero aún no formas parte del grupo. Al unirte se crea tu pestaña, que solo podrás editar tú.</p>
    <button class="btn primary big" data-action="join-current">Unirme al grupo</button>
  </section>`;
}

/** Pestañas con el email de alguien que no las controla: se ignoran y se avisa (normalmente solo lo ve quien creó el grupo). */
function suspiciousNote() {
  const s = S.group.suspicious || [];
  if (!s.length) return '';
  return `<p class="notice warn">⚠️ ${s.length === 1 ? 'Hay una pestaña que no se tiene en cuenta' : `Hay ${s.length} pestañas que no se tienen en cuenta`}
    porque no está protegida a nombre de su dueño: <strong>${s.map(esc).join(', ')}</strong>.
    ${S.group.url ? `Si no las reconoces, bórralas desde <a href="${esc(S.group.url)}" target="_blank" rel="noopener">la hoja</a>.` : ''}</p>`;
}

function groupView() {
  switch (S.view) {
    case 'calendario': return viewCalendar();
    case 'progreso': return viewProgress();
    case 'retos': return viewChallenges();
    case 'perfiles': return viewProfiles();
    default: return viewRanking();
  }
}

function periodChips() {
  return `<div class="chips" role="group" aria-label="Periodo">${Object.entries(St.PERIODS).map(([k, l]) =>
    `<button class="chip ${S.period === k ? 'on' : ''}" data-action="period" data-p="${k}">${l}</button>`).join('')}</div>`;
}

function board(title, sub, rows, get, fmt, { note = '', allowNeg = false } = {}) {
  const vals = rows.map((r) => ({ m: r.m, v: get(r) }));
  const ranked = vals.filter((x) => x.v != null).sort((a, b) => b.v - a.v);
  const missing = vals.filter((x) => x.v == null);
  const max = Math.max(...ranked.map((x) => Math.abs(x.v)), 0) || 1;
  const medal = ['🥇', '🥈', '🥉'];
  return `<article class="card board">
    <header><h3>${title}</h3><p class="muted">${sub}</p></header>
    <ol>${ranked.map((x, i) => `<li class="${x.m.email === S.me.email ? 'me' : ''}">
        <span class="pos">${x.v > 0 || (allowNeg && x.v !== 0) ? (medal[i] || i + 1) : i + 1}</span>
        ${avatar(x.m)}
        <span class="name">${esc(x.m.name)}</span>
        <span class="bar"><i style="width:${Math.max(0, x.v) / max * 100}%;background:${x.m.color}"></i></span>
        <span class="val">${fmt(x.v)}</span>
      </li>`).join('')}
      ${missing.map((x) => `<li class="dim ${x.m.email === S.me.email ? 'me' : ''}"><span class="pos">–</span>${avatar(x.m)}<span class="name">${esc(x.m.name)}</span><span class="bar"></span><span class="val">sin datos</span></li>`).join('')}
    </ol>
    ${note ? `<p class="fine">${note}</p>` : ''}
  </article>`;
}

function viewRanking() {
  const r = St.periodRange(S.period);
  const rows = members().map((m) => {
    const es = entriesOf(m.email);
    return { m, att: St.attendance(es, r), streak: St.weekStreak(es), imp: St.improvement(es, r).score, vol: St.volume(es, r) };
  });
  const totalDays = St.sessionDates(S.group.entries, r).length;
  const totalSessions = rows.reduce((a, x) => a + x.att, 0);
  return `<div class="view-head"><h2>Ranking</h2>${periodChips()}</div>
    <p class="summary">${totalSessions ? `El grupo ha ido <strong>${fmtN(totalSessions)}</strong> veces en ${fmtN(totalDays)} días distintos.` : 'Nadie ha registrado entrenos en este periodo todavía.'}</p>
    <div class="grid two">
      ${board('Quién va más', 'Días de gym en el periodo', rows, (x) => x.att, (v) => `${fmtN(v)} d`)}
      ${board('Quién mejora más', 'Subida media del 1RM estimado', rows, (x) => x.imp, fmtPct,
        { allowNeg: true, note: 'Compara el primer día del periodo con tu mejor marca después, ejercicio a ejercicio. Así es justo entre niveles distintos.' })}
      ${board('Rachas', 'Semanas seguidas yendo al menos un día', rows, (x) => x.streak, (v) => `${fmtN(v)} sem`, { note: 'La racha no depende del periodo elegido.' })}
      ${board('Volumen', 'Kilos totales (series × reps × kg)', rows, (x) => x.vol, fmtKg)}
    </div>`;
}

function viewCalendar() {
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
    cells.push(`<button class="day ${iso === today ? 'today' : ''} ${who.length ? 'has' : ''}" ${who.length ? `data-action="day" data-d="${iso}"` : 'disabled'}
      aria-label="${esc(cap(dLong.format(St.parseISO(iso))))}: ${who.length ? esc(who.map((m) => m.name).join(', ')) : 'nadie'}">
      <span class="num">${d}</span>
      <span class="dots">${who.map((m) => `<i style="background:${m.color}" title="${esc(m.name)}"></i>`).join('')}</span>
    </button>`);
  }
  const counts = members().map((m) => ({ m, n: [...byDate.values()].filter((s) => s.has(m.email)).length }))
    .sort((a, b) => b.n - a.n);
  const prev = St.toISO(new Date(y, mo - 2, 1)).slice(0, 7);
  const next = St.toISO(new Date(y, mo, 1)).slice(0, 7);
  return `<div class="view-head">
      <h2>Calendario</h2>
      <div class="month-nav">
        <button class="btn icon" data-action="month" data-m="${prev}" aria-label="Mes anterior">‹</button>
        <strong>${cap(dMonth.format(first))}</strong>
        <button class="btn icon" data-action="month" data-m="${next}" aria-label="Mes siguiente" ${next > today.slice(0, 7) ? 'disabled' : ''}>›</button>
      </div>
    </div>
    <div class="cal-layout">
      <div class="card cal">
        <div class="cal-head">${['L', 'M', 'X', 'J', 'V', 'S', 'D'].map((d) => `<span>${d}</span>`).join('')}</div>
        <div class="cal-grid">${cells.join('')}</div>
      </div>
      <aside class="card legend">
        <h3>Días este mes</h3>
        <ul>${counts.map(({ m, n }) => `<li>${avatar(m)}<span class="name">${esc(m.name)}</span><strong>${n}</strong></li>`).join('')}</ul>
        <p class="fine">Toca un día para ver qué hizo cada uno.</p>
      </aside>
    </div>`;
}

function exerciseOptions(entries) {
  const freq = new Map();
  for (const e of entries) if (e.exercise && e.weight > 0) freq.set(e.exercise, (freq.get(e.exercise) || 0) + 1);
  return [...freq].sort((a, b) => b[1] - a[1]).map(([ex]) => ex);
}

function viewProgress() {
  const exs = exerciseOptions(S.group.entries);
  if (!exs.length) return `<div class="view-head"><h2>Progreso</h2></div><p class="summary">Cuando registréis ejercicios con peso, aquí veréis la evolución de cada uno.</p>`;
  if (!exs.includes(S.exercise)) S.exercise = exs[0];
  const r = St.periodRange(S.period);
  const rows = members().map((m) => {
    const imp = St.improvement(entriesOf(m.email), r, S.exercise).details[0];
    return { m, imp };
  });
  return `<div class="view-head">
      <h2>Progreso</h2>
      <select data-change="exercise" aria-label="Ejercicio">${exs.map((ex) => `<option ${ex === S.exercise ? 'selected' : ''}>${esc(ex)}</option>`).join('')}</select>
      ${periodChips()}
    </div>
    <div class="card chart-card"><div class="chart-box"><canvas id="chart" aria-label="Evolución del 1RM estimado"></canvas></div>
      <p class="fine">1RM estimado = el peso que podrías levantar a una repetición, calculado a partir de tus series (fórmula de Epley). Permite comparar series con distintas repeticiones.</p></div>
    <div class="card">
      <table class="table">
        <thead><tr><th>Persona</th><th class="r">Inicio</th><th class="r">Mejor</th><th class="r">Mejora</th></tr></thead>
        <tbody>${rows.sort((a, b) => (b.imp?.pct ?? -9) - (a.imp?.pct ?? -9)).map(({ m, imp }) => `<tr class="${m.email === S.me.email ? 'me' : ''}">
          <td><span class="who">${avatar(m)} ${esc(m.name)}</span></td>
          ${imp ? `<td class="r">${fmtN(imp.base, 1)} kg</td><td class="r">${fmtN(imp.peak, 1)} kg</td><td class="r ${imp.pct >= 0 ? 'up' : 'down'}">${fmtPct(imp.pct)}</td>`
            : '<td class="r muted" colspan="3">Necesita 2 días con este ejercicio en el periodo</td>'}
        </tr>`).join('')}</tbody>
      </table>
    </div>`;
}

function mountChart() {
  const canvas = document.getElementById('chart');
  if (!canvas || !window.Chart) return;
  const css = getComputedStyle(document.documentElement);
  const text = css.getPropertyValue('--muted').trim();
  const grid = css.getPropertyValue('--line').trim();
  const r = St.periodRange(S.period);
  const datasets = members().map((m) => {
    const data = St.bestByDate(entriesOf(m.email).filter((e) => e.date >= r.from && e.date <= r.to), S.exercise)
      .map((p) => ({ x: +St.parseISO(p.date), y: Math.round(p.value * 10) / 10 }));
    return {
      label: m.name, data, borderColor: m.color, backgroundColor: m.color, tension: 0.3,
      pointRadius: 2.5, pointHoverRadius: 5, borderWidth: m.email === S.me.email ? 3 : 2,
    };
  }).filter((d) => d.data.length);
  S.chart = new window.Chart(canvas, {
    type: 'line',
    data: { datasets },
    options: {
      responsive: true, maintainAspectRatio: false, animation: { duration: 300 },
      interaction: { mode: 'nearest', intersect: false },
      scales: {
        x: { type: 'linear', ticks: { color: text, maxTicksLimit: 6, callback: (v) => dShort.format(new Date(v)) }, grid: { color: grid } },
        y: { ticks: { color: text, callback: (v) => `${fmtN(v)} kg` }, grid: { color: grid } },
      },
      plugins: {
        legend: { labels: { color: text, usePointStyle: true, boxWidth: 8 } },
        tooltip: { callbacks: {
          title: (items) => cap(dLong.format(new Date(items[0].parsed.x))),
          label: (it) => ` ${it.dataset.label}: ${fmtN(it.parsed.y, 1)} kg`,
        } },
      },
    },
  });
}

function challengeStatus(c) {
  const t = St.todayISO();
  if (t < c.start) return { key: 'proximo', label: `Empieza el ${fmtDate(c.start)}` };
  if (t > c.end) return { key: 'terminado', label: 'Terminado' };
  const left = Math.round((St.parseISO(c.end) - St.parseISO(t)) / 864e5);
  return { key: 'curso', label: left === 0 ? 'Último día' : `Quedan ${left} días` };
}

function viewChallenges() {
  const order = { curso: 0, proximo: 1, terminado: 2 };
  const list = [...S.group.challenges].map((c) => ({ c, st: challengeStatus(c) }))
    .sort((a, b) => order[a.st.key] - order[b.st.key] || b.c.start.localeCompare(a.c.start));
  const fmt = (type, v) => (type === 'asistencia' ? `${fmtN(v)} d` : type === 'volumen' ? fmtKg(v) : `${v > 0 ? '+' : ''}${fmtN(v, 1)} %`);
  return `<div class="view-head"><h2>Retos</h2><button class="btn primary" data-action="new-challenge">+ Nuevo reto</button></div>
    ${list.length ? '' : '<p class="summary">Todavía no hay retos. ¡Crea el primero!</p>'}
    <div class="grid">${list.map(({ c, st }) => {
      const t = CH_TYPES[c.type] || CH_TYPES.asistencia;
      const rows = members().map((m) => ({ m, v: St.challengeValue(c, entriesOf(m.email)) }));
      const ranked = rows.filter((x) => x.v != null).sort((a, b) => b.v - a.v);
      const rest = rows.filter((x) => x.v == null);
      const max = Math.max(...ranked.map((x) => Math.abs(x.v)), 0) || 1;
      const winner = st.key === 'terminado' && ranked[0]?.v > 0 ? ranked[0].m : null;
      const creator = member(c.createdBy);
      return `<article class="card challenge ${st.key}">
        <header>
          <div><span class="badge">${t.label}${c.exercise ? ` · ${esc(c.exercise)}` : ''}</span><span class="status ${st.key}">${st.label}</span></div>
          <h3>${esc(c.title)}</h3>
          <p class="muted">${fmtDate(c.start)} – ${fmtDate(c.end)}${creator ? ` · propuesto por ${esc(creator.name)}` : ''}</p>
        </header>
        ${winner ? `<p class="winner">🏆 Ha ganado <strong>${esc(winner.name)}</strong></p>` : ''}
        ${st.key === 'proximo' ? `<p class="fine">${t.help}</p>` : `<ol>${ranked.map((x, i) => `<li class="${x.m.email === S.me.email ? 'me' : ''}">
            <span class="pos">${i + 1}</span>${avatar(x.m)}<span class="name">${esc(x.m.name)}</span>
            <span class="bar"><i style="width:${Math.max(0, x.v) / max * 100}%;background:${x.m.color}"></i></span>
            <span class="val">${fmt(c.type, x.v)}</span></li>`).join('')}
          ${rest.map((x) => `<li class="dim"><span class="pos">–</span>${avatar(x.m)}<span class="name">${esc(x.m.name)}</span><span class="bar"></span><span class="val">sin datos</span></li>`).join('')}</ol>`}
      </article>`;
    }).join('')}</div>`;
}

function sessionList(es, mine) {
  const byDate = new Map();
  for (const e of es) {
    if (!byDate.has(e.date)) byDate.set(e.date, []);
    byDate.get(e.date).push(e);
  }
  const dates = [...byDate.keys()].sort().reverse().slice(0, 12);
  if (!dates.length) return '<p class="muted">Sin entrenos todavía.</p>';
  return `<ul class="sessions">${dates.map((d) => `<li>
      <div class="s-date">${cap(dLong.format(St.parseISO(d)))}</div>
      <ul>${byDate.get(d).map((e) => `<li>
        <span>${e.exercise ? esc(e.exercise) : '<span class="muted">Asistencia</span>'}</span>
        <span class="muted">${e.exercise ? `${fmtN(e.sets)}×${fmtN(e.reps)}${e.weight ? ` · ${fmtN(e.weight, 1)} kg` : ''}` : ''}</span>
        ${mine ? `<button class="btn icon small" data-action="del-entry" data-id="${esc(e.id)}" aria-label="Borrar">✕</button>` : ''}
      </li>`).join('')}</ul>
    </li>`).join('')}</ul>`;
}

function viewProfiles() {
  const m = member(S.profile) || member(S.me.email);
  const es = entriesOf(m.email);
  const mine = m.email === S.me.email;
  const dates = St.sessionDates(es);
  const r30 = St.periodRange('30');
  const imp = St.improvement(es, St.periodRange('90')).score;
  const prs = St.prs(es).filter((p) => p.e1rm > 0);
  return `<div class="view-head"><h2>Perfiles</h2></div>
    <div class="people">${members().map((x) => `<button class="person ${x.email === m.email ? 'on' : ''}" data-action="profile" data-e="${esc(x.email)}">${avatar(x)}<span>${esc(x.name)}</span></button>`).join('')}</div>
    <div class="profile-layout">
      <div>
        <div class="card profile-head">
          ${avatar(m, 'xl')}
          <div><h3>${esc(m.name)}${mine ? ' <span class="badge">Tú</span>' : ''}</h3>
          <p class="muted">${esc(m.email)}${m.joined ? ` · en el grupo desde ${fmtDate(m.joined)}` : ''}</p></div>
        </div>
        <div class="tiles">
          <div class="tile"><span class="muted">Días totales</span><strong>${fmtN(dates.length)}</strong></div>
          <div class="tile"><span class="muted">Últimos 30 días</span><strong>${fmtN(St.attendance(es, r30))}</strong></div>
          <div class="tile"><span class="muted">Racha</span><strong>${fmtN(St.weekStreak(es))} sem</strong></div>
          <div class="tile"><span class="muted">Mejora 90 días</span><strong>${imp == null ? '—' : fmtPct(imp)}</strong></div>
        </div>
        <div class="card">
          <h3>Marcas personales</h3>
          ${prs.length ? `<table class="table"><thead><tr><th>Ejercicio</th><th class="r">Mejor serie</th><th class="r">1RM est.</th><th class="r opt">Fecha</th></tr></thead>
            <tbody>${prs.map((p) => `<tr><td>${esc(p.exercise)}</td><td class="r">${fmtN(p.best.reps)} × ${fmtN(p.best.weight, 1)} kg</td><td class="r"><strong>${fmtN(p.e1rm, 1)} kg</strong></td><td class="r muted opt">${fmtDate(p.date)}</td></tr>`).join('')}</tbody></table>`
            : '<p class="muted">Aún no hay ejercicios con peso.</p>'}
        </div>
      </div>
      <div class="card">
        <h3>Últimos entrenos</h3>
        ${sessionList(es, mine)}
        ${dates.length > 12 ? `<p class="fine">Mostrando los 12 más recientes de ${fmtN(dates.length)}.</p>` : ''}
      </div>
    </div>`;
}

// ---------- modales ----------
function openModal(html) {
  $modal.innerHTML = `<div class="modal-body">${html}</div>`;
  if (!$modal.open) $modal.showModal();
  $modal.querySelector('[autofocus]')?.focus();
}
const closeModal = () => $modal.open && $modal.close();
const modalHead = (t) => `<header class="modal-head"><h2>${t}</h2><button class="btn icon" data-action="close-modal" aria-label="Cerrar">✕</button></header>`;

function setRow(e = {}) {
  return `<div class="set-row">
    <input name="exercise" list="ex-list" placeholder="Ejercicio" value="${esc(e.exercise || '')}" aria-label="Ejercicio">
    <input name="sets" type="number" min="1" max="50" inputmode="numeric" placeholder="Series" value="${esc(e.sets ?? '')}" aria-label="Series" title="Series">
    <input name="reps" type="number" min="1" max="200" inputmode="numeric" placeholder="Reps" title="Repeticiones" value="${esc(e.reps ?? '')}" aria-label="Repeticiones">
    <input name="weight" type="number" min="0" max="1000" step="0.5" inputmode="decimal" placeholder="kg" value="${esc(e.weight ?? '')}" aria-label="Kilos">
    <button type="button" class="btn icon small" data-action="remove-row" aria-label="Quitar ejercicio">✕</button>
  </div>`;
}

function entryModal(rows) {
  const exs = St.exercises(S.group.entries);
  openModal(`${modalHead('Registrar entreno')}
    <form data-form="entry">
      <label class="field"><span>Fecha</span><input type="date" name="date" value="${St.todayISO()}" max="${St.todayISO()}" required></label>
      <div class="sets-head"><span>Ejercicio</span><span>Series</span><span>Reps</span><span>kg</span><span></span></div>
      <div id="set-rows">${(rows?.length ? rows : [{}]).map(setRow).join('')}</div>
      <datalist id="ex-list">${exs.map((x) => `<option value="${esc(x)}">`).join('')}</datalist>
      <div class="row-actions">
        <button type="button" class="btn ghost small" data-action="add-row">+ Ejercicio</button>
        <button type="button" class="btn ghost small" data-action="copy-last">Copiar mi último entreno</button>
      </div>
      <label class="field"><span>Notas (opcional)</span><input name="notes" maxlength="200" placeholder="Cómo te has sentido, cardio…"></label>
      <p class="fine">Si no apuntas ejercicios, cuenta solo como día de asistencia.</p>
      <footer class="modal-foot"><button type="button" class="btn ghost" data-action="close-modal">Cancelar</button><button class="btn primary">Guardar</button></footer>
    </form>`);
}

function dayModal(iso) {
  const es = S.group.entries.filter((e) => e.date === iso);
  const who = [...new Set(es.map((e) => e.email))].map(member).filter(Boolean);
  openModal(`${modalHead(esc(cap(dLong.format(St.parseISO(iso)))))}
    <div class="day-list">${who.map((m) => `<section><h3 class="who">${avatar(m)} ${esc(m.name)}</h3>
      <ul>${es.filter((e) => e.email === m.email).map((e) => `<li>${e.exercise ? `${esc(e.exercise)} <span class="muted">${fmtN(e.sets)}×${fmtN(e.reps)}${e.weight ? ` · ${fmtN(e.weight, 1)} kg` : ''}</span>` : '<span class="muted">Asistencia</span>'}${e.notes ? `<div class="fine">${esc(e.notes)}</div>` : ''}</li>`).join('')}</ul></section>`).join('')}</div>`);
}

function challengeModal() {
  const t = St.todayISO();
  const exs = St.exercises(S.group.entries);
  openModal(`${modalHead('Nuevo reto')}
    <form data-form="challenge">
      <label class="field"><span>Título</span><input name="title" required maxlength="80" placeholder="p. ej. Noviembre sin fallar" autofocus></label>
      <label class="field"><span>Tipo</span><select name="type">${Object.entries(CH_TYPES).map(([k, v]) => `<option value="${k}">${v.label} — ${v.help}</option>`).join('')}</select></label>
      <label class="field"><span>Ejercicio (opcional, para volumen o mejora)</span><input name="exercise" list="ex-list2" placeholder="Todos los ejercicios"></label>
      <datalist id="ex-list2">${exs.map((x) => `<option value="${esc(x)}">`).join('')}</datalist>
      <div class="two"><label class="field"><span>Empieza</span><input type="date" name="start" value="${t}" required></label>
      <label class="field"><span>Termina</span><input type="date" name="end" value="${St.addDays(t, 29)}" required></label></div>
      <footer class="modal-foot"><button type="button" class="btn ghost" data-action="close-modal">Cancelar</button><button class="btn primary">Crear reto</button></footer>
    </form>`);
}

function inviteModal() {
  const link = `${location.origin}${location.pathname}?group=${encodeURIComponent(S.group.id)}`;
  const demo = S.store.kind === 'demo';
  const owner = S.group.ownerName || 'quien creó el grupo';
  openModal(`${modalHead('Invitar amigos')}
    ${S.group.canShare ? `<p>Invitar a alguien hace dos cosas: comparte la hoja desde tu Google Drive con su email, y Google le envía un correo con este enlace.</p>
    <form data-form="invite" class="inline-form">
      <input type="email" name="email" required placeholder="email@gmail.com" aria-label="Email de tu amigo" autofocus>
      <button class="btn primary">Invitar</button>
    </form>` : `<p>Solo <strong>${esc(owner)}</strong> puede añadir gente a la hoja del grupo. Pásale el email de tu amigo y, cuando le haya invitado, mándale este enlace.</p>`}
    <label class="field"><span>Enlace del grupo</span>
      <div class="inline-form"><input readonly value="${esc(link)}" id="invite-link"><button class="btn ghost" type="button" data-action="copy-link">Copiar</button></div></label>
    <p class="fine">El enlace solo funciona para quien tenga la hoja compartida.${demo ? ' (En la demo no se envía nada.)' : ''}</p>`);
}

function groupMenu() {
  const g = S.group;
  const isGoogle = S.store.kind === 'google';
  openModal(`${modalHead('Grupos')}
    <ul class="menu">
      ${S.groups.map((x) => `<li><button class="menu-item ${x.id === g?.id ? 'on' : ''}" data-action="switch-group" data-id="${esc(x.id)}">
        <span>${esc(x.name)}</span>${x.owner ? `<span class="muted">de ${esc(x.owner)}</span>` : ''}${x.id === g?.id ? '<span aria-hidden="true">✓</span>' : ''}</button></li>`).join('')}
    </ul>
    <div class="menu-actions">
      ${g?.isMember ? '<button class="btn ghost" data-action="invite">Invitar amigos</button>' : ''}
      <button class="btn ghost" data-action="create-group">Crear grupo</button>
      ${isGoogle ? '<button class="btn ghost" data-action="pick-any">Unirme con una hoja que me han compartido</button>' : ''}
      ${g?.url ? `<a class="btn ghost" href="${esc(g.url)}" target="_blank" rel="noopener">Abrir la hoja en Google Sheets ↗</a>` : ''}
    </div>`);
}

function userMenu() {
  const me = S.me;
  openModal(`${modalHead('Tu cuenta')}
    <div class="profile-head">${avatar({ ...me, color: member(me.email)?.color || COLORS[0] }, 'xl')}
      <div><h3>${esc(me.name)}</h3><p class="muted">${esc(me.email)}</p></div></div>
    <p class="fine">${S.store.kind === 'demo' ? 'Estás en modo demo.' : 'Tus entrenos se guardan en tu pestaña de la hoja de cada grupo. Solo tú (y quien creó el grupo) podéis editarla.'} <a href="privacy.html">Privacidad</a></p>
    <footer class="modal-foot"><button class="btn ghost" data-action="logout">${S.store.kind === 'demo' ? 'Salir de la demo' : 'Cerrar sesión'}</button></footer>`);
}

function createGroupModal() {
  openModal(`${modalHead('Crear grupo')}
    <form data-form="create-group">
      <label class="field"><span>Nombre</span><input name="name" required maxlength="60" placeholder="p. ej. Los del gym" autofocus></label>
      <p class="fine">${S.store.kind === 'google' ? 'Se creará una hoja de cálculo en tu Google Drive. Después podrás invitar a tus amigos.' : 'En la demo el grupo solo existe mientras no recargues.'}</p>
      <footer class="modal-foot"><button type="button" class="btn ghost" data-action="close-modal">Cancelar</button><button class="btn primary">Crear</button></footer>
    </form>`);
}

// ---------- acciones ----------
const actions = {
  login: () => run(async () => {
    await G.signIn(); // primera línea: debe ir pegada al clic para que no se bloquee el popup
    S.me = await G.getProfile();
    S.store = new G.SheetStore(S.me);
    G.loadPicker().catch(() => {});
    await afterLogin();
  }),
  demo: () => run(async () => {
    S.store = new DemoStore();
    S.me = S.store.me;
    S.pendingGroup = null;
    await afterLogin();
  }),
  logout: () => {
    closeModal();
    if (S.store?.kind === 'google') G.signOut();
    Object.assign(S, { store: null, me: null, groups: [], group: null, needsPicker: null, view: 'ranking' });
    render();
  },
  view: (el) => { S.view = el.dataset.v; render(); window.scrollTo({ top: 0 }); },
  period: (el) => { S.period = el.dataset.p; render(); },
  month: (el) => { S.month = el.dataset.m; render(); },
  profile: (el) => { S.profile = el.dataset.e; render(); },
  day: (el) => dayModal(el.dataset.d),
  'close-modal': closeModal,
  'new-entry': () => entryModal(),
  'add-row': () => {
    document.getElementById('set-rows').insertAdjacentHTML('beforeend', setRow());
    document.querySelector('#set-rows .set-row:last-child input')?.focus();
  },
  'remove-row': (el) => {
    const rows = document.querySelectorAll('#set-rows .set-row');
    if (rows.length > 1) el.closest('.set-row').remove();
    else el.closest('.set-row').querySelectorAll('input').forEach((i) => { i.value = ''; });
  },
  'copy-last': () => {
    const mine = entriesOf(S.me.email).filter((e) => e.exercise);
    const last = mine.map((e) => e.date).sort().pop();
    if (!last) return toast('Aún no tienes entrenos con ejercicios.');
    document.getElementById('set-rows').innerHTML = mine.filter((e) => e.date === last).map(setRow).join('');
  },
  'del-entry': (el) => {
    // Confirmación en dos toques (los diálogos confirm() no funcionan en todos los navegadores embebidos).
    if (!el.dataset.armed) {
      el.dataset.armed = '1';
      el.textContent = '¿Borrar?';
      el.classList.add('armed');
      setTimeout(() => { delete el.dataset.armed; el.textContent = '✕'; el.classList.remove('armed'); }, 3000);
      return;
    }
    run(async () => {
      await S.store.deleteEntry(S.group.id, el.dataset.id);
      await openGroup(S.group.id);
      toast('Registro borrado.');
    });
  },
  'new-challenge': () => challengeModal(),
  'group-menu': () => groupMenu(),
  'user-menu': () => userMenu(),
  invite: () => inviteModal(),
  'create-group': () => createGroupModal(),
  'copy-link': () => {
    const v = document.getElementById('invite-link').value;
    navigator.clipboard?.writeText(v).then(() => toast('Enlace copiado.'), () => toast('No se pudo copiar; selecciónalo a mano.'));
  },
  'switch-group': (el) => { closeModal(); run(() => openGroup(el.dataset.id)); },
  'join-current': () => run(async () => {
    await S.store.join(S.group.id);
    S.groups = await S.store.listGroups();
    await openGroup(S.group.id);
    toast('¡Ya estás en el grupo!');
  }),
  'pick-join': () => run(async () => {
    const id = await G.pickSheet(S.needsPicker);
    if (!id) return;
    await S.store.join(id);
    S.needsPicker = null;
    S.pendingGroup = null;
    history.replaceState(null, '', location.pathname);
    S.groups = await S.store.listGroups();
    await openGroup(id);
    toast('¡Ya estás en el grupo!');
  }),
  'pick-any': () => {
    closeModal();
    run(async () => {
      const id = await G.pickSheet();
      if (!id) return;
      await S.store.join(id);
      S.groups = await S.store.listGroups();
      await openGroup(id);
      toast('¡Ya estás en el grupo!');
    });
  },
  'cancel-join': () => {
    S.needsPicker = null; S.pendingGroup = null;
    history.replaceState(null, '', location.pathname);
    run(afterLogin);
  },
};

const forms = {
  entry: (f) => {
    const date = f.date.value;
    const notes = f.notes.value.trim();
    const rows = [...f.querySelectorAll('.set-row')].map((r) => ({
      exercise: r.querySelector('[name=exercise]').value.trim(),
      sets: +r.querySelector('[name=sets]').value || 0,
      reps: +r.querySelector('[name=reps]').value || 0,
      weight: +r.querySelector('[name=weight]').value || 0,
    })).filter((r) => r.exercise);
    if (rows.some((r) => !r.reps)) return toast('Pon las repeticiones de cada ejercicio.', { error: true });
    const entries = (rows.length ? rows : [{ exercise: '', sets: 0, reps: 0, weight: 0 }])
      .map((r, i) => ({ id: uid(), date, ...r, sets: r.sets || (r.exercise ? 1 : 0), notes: i === 0 ? notes : '' }));
    return run(async () => {
      await S.store.addEntries(S.group.id, entries);
      closeModal();
      await openGroup(S.group.id);
      toast(rows.length ? `¡Entreno guardado! ${rows.length} ejercicio${rows.length > 1 ? 's' : ''}.` : '¡Día de gym apuntado!');
    });
  },
  challenge: (f) => {
    const c = { id: uid(), title: f.title.value.trim(), type: f.type.value, exercise: f.exercise.value.trim(), start: f.start.value, end: f.end.value };
    if (c.end < c.start) return toast('La fecha de fin es anterior a la de inicio.', { error: true });
    return run(async () => {
      await S.store.addChallenge(S.group.id, c);
      closeModal();
      S.view = 'retos';
      await openGroup(S.group.id);
      toast('Reto creado.');
    });
  },
  invite: (f) => {
    const email = f.email.value.trim();
    const link = document.getElementById('invite-link').value;
    return run(async () => {
      await S.store.invite(S.group.id, email, link);
      f.reset();
      toast(S.store.kind === 'demo' ? 'En la demo no se envían invitaciones.' : `Invitación enviada a ${email}.`);
    });
  },
  'create-group': (f) => {
    const name = f.name.value.trim();
    if (!name) return;
    return run(async () => {
      const id = await S.store.createGroup(name);
      closeModal();
      S.groups = await S.store.listGroups();
      S.view = 'ranking';
      await openGroup(id);
      toast('Grupo creado. ¡Invita a tus amigos!', { action: 'Invitar', onAction: inviteModal });
    });
  },
};

document.addEventListener('click', (e) => {
  const el = e.target.closest('[data-action]');
  if (el && !el.disabled) actions[el.dataset.action]?.(el, e);
});
document.addEventListener('submit', (e) => {
  const f = e.target.closest('[data-form]');
  if (!f) return;
  e.preventDefault();
  forms[f.dataset.form]?.(f);
});
document.addEventListener('change', (e) => {
  if (e.target.dataset?.change === 'exercise') { S.exercise = e.target.value; render(); }
});
$modal.addEventListener('click', (e) => { if (e.target === $modal) closeModal(); });
matchMedia('(prefers-color-scheme: dark)').addEventListener?.('change', () => S.view === 'progreso' && render());

// ---------- arranque ----------
render();
if (G.isConfigured()) G.loadGis().catch((e) => toast(e.message, { error: true }));
