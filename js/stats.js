// Pure calculations: no network, no DOM.

export function toISO(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
export const todayISO = () => toISO(new Date());
export function parseISO(s) {
  const [y, m, d] = s.split('-').map(Number);
  return new Date(y, m - 1, d);
}
/** Is it a real date in YYYY-MM-DD format? (anyone can edit the sheet by hand) */
export const isISODate = (s) => /^\d{4}-\d{2}-\d{2}$/.test(s) && toISO(parseISO(s)) === s;
export function addDays(s, n) {
  const d = parseISO(s);
  d.setDate(d.getDate() + n);
  return toISO(d);
}
/** Monday of the week containing a date. */
export function weekStart(s) {
  const d = parseISO(s);
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
  return toISO(d);
}

export const PERIODS = ['7', '30', '90', '365', 'all'];
export function periodRange(p) {
  const to = todayISO();
  return { from: p === 'all' ? '0000-01-01' : addDays(to, -(Number(p) - 1)), to };
}
const inRange = (e, r) => !r || (e.date >= r.from && e.date <= r.to);

/** Estimated 1RM (Epley). */
export function e1rm(weight, reps) {
  const w = +weight || 0, r = +reps || 0;
  if (!w || !r) return 0;
  return r === 1 ? w : w * (1 + r / 30);
}

export function sessionDates(entries, r) {
  return [...new Set(entries.filter(e => inRange(e, r)).map(e => e.date))].sort();
}
export const attendance = (entries, r) => sessionDates(entries, r).length;

export function volume(entries, r, exercise) {
  return entries
    .filter(e => inRange(e, r) && (!exercise || e.exercise === exercise))
    .reduce((s, e) => s + (+e.sets || 0) * (+e.reps || 0) * (+e.weight || 0), 0);
}

/** Consecutive weeks (up to today) with at least one gym day. The current week doesn't break the streak. */
export function weekStreak(entries) {
  const weeks = new Set(entries.map(e => weekStart(e.date)));
  let w = weekStart(todayISO());
  if (!weeks.has(w)) w = addDays(w, -7);
  let n = 0;
  while (weeks.has(w)) { n++; w = addDays(w, -7); }
  return n;
}

export function exercises(entries) {
  return [...new Set(entries.map(e => e.exercise).filter(Boolean))].sort((a, b) => a.localeCompare(b));
}

/** Best estimated 1RM per day for an exercise. */
export function bestByDate(entries, exercise) {
  const m = new Map();
  for (const e of entries) {
    if (e.exercise !== exercise) continue;
    const v = e1rm(e.weight, e.reps);
    if (v > (m.get(e.date) || 0)) m.set(e.date, v);
  }
  return [...m].sort((a, b) => (a[0] < b[0] ? -1 : 1)).map(([date, value]) => ({ date, value }));
}

/**
 * Improvement in a period: for each exercise with at least 2 days, compares the first day's
 * estimated 1RM with the best of the following days. The score is the average across exercises,
 * so it's fair between people of different levels.
 */
export function improvement(entries, r, exercise) {
  const scoped = entries.filter(e => inRange(e, r));
  const details = [];
  for (const ex of exercise ? [exercise] : exercises(scoped)) {
    const s = bestByDate(scoped, ex).filter(p => p.value > 0);
    if (s.length < 2) continue;
    const base = s[0].value;
    const peak = Math.max(...s.slice(1).map(p => p.value));
    details.push({ exercise: ex, base, peak, pct: peak / base - 1 });
  }
  const score = details.length ? details.reduce((a, d) => a + d.pct, 0) / details.length : null;
  return { score, details };
}

/** Personal records per exercise. */
export function prs(entries) {
  const out = new Map();
  for (const e of entries) {
    if (!e.exercise) continue;
    const cur = out.get(e.exercise) || { exercise: e.exercise, e1rm: 0, weight: 0, date: '', days: new Set() };
    cur.days.add(e.date);
    const v = e1rm(e.weight, e.reps);
    if (v > cur.e1rm) { cur.e1rm = v; cur.date = e.date; cur.best = e; }
    if ((+e.weight || 0) > cur.weight) cur.weight = +e.weight;
    out.set(e.exercise, cur);
  }
  return [...out.values()].sort((a, b) => a.exercise.localeCompare(b.exercise));
}

/** A participant's value in a challenge (null = not enough data). */
export function challengeValue(ch, entries) {
  const r = { from: ch.start, to: ch.end };
  switch (ch.type) {
    case 'attendance': return attendance(entries, r);
    case 'volume': return volume(entries, r, ch.exercise || null);
    case 'improvement': {
      const s = improvement(entries, r, ch.exercise || null).score;
      return s == null ? null : s * 100;
    }
    default: return null;
  }
}

/**
 * Ids of the sets that were a personal record when logged: they beat the best estimated 1RM of every
 * earlier set of the same exercise. The very first set of an exercise doesn't count as a record.
 */
export function prIds(entries) {
  const best = new Map();
  const out = new Set();
  const sorted = entries.map((e, i) => [e, i]).sort((a, b) => (a[0].date < b[0].date ? -1 : a[0].date > b[0].date ? 1 : a[1] - b[1]));
  for (const [e] of sorted) {
    if (!e.exercise) continue;
    const v = e1rm(e.weight, e.reps);
    const prev = best.get(e.exercise);
    if (prev !== undefined && v > prev) out.add(e.id);
    if (prev === undefined || v > prev) best.set(e.exercise, v);
  }
  return out;
}

/** Sets of an exercise on the last day before `before` it was done. */
export function lastSession(entries, exercise, before) {
  let date = '';
  for (const e of entries) if (e.exercise === exercise && e.date < before && e.date > date) date = e.date;
  return date ? { date, sets: entries.filter((e) => e.exercise === exercise && e.date === date) } : null;
}

/** An exercise's history grouped by day, newest first. */
export function exerciseHistory(entries, exercise) {
  const m = new Map();
  for (const e of entries) {
    if (e.exercise !== exercise) continue;
    if (!m.has(e.date)) m.set(e.date, []);
    m.get(e.date).push(e);
  }
  return [...m].sort((a, b) => (a[0] < b[0] ? 1 : -1)).map(([date, sets]) => ({ date, sets }));
}

// ---------- per-exercise metrics (progress charts and records) ----------

export const METRICS = ['e1rm', 'weight', 'volume', 'reps'];
const setVolume = (e) => (+e.sets || 1) * (+e.reps || 0) * (+e.weight || 0);

/**
 * One value per day for an exercise, oldest first:
 * e1rm = best estimated 1RM · weight = heaviest set · volume = sets × reps × kg · reps = most reps in one set.
 */
export function dailySeries(entries, exercise, metric) {
  const m = new Map();
  for (const e of entries) {
    if (e.exercise !== exercise) continue;
    const cur = m.get(e.date) || 0;
    if (metric === 'volume') m.set(e.date, cur + setVolume(e));
    else {
      const v = metric === 'weight' ? +e.weight || 0 : metric === 'reps' ? +e.reps || 0 : e1rm(e.weight, e.reps);
      m.set(e.date, Math.max(cur, v));
    }
  }
  return [...m].sort((a, b) => (a[0] < b[0] ? -1 : 1)).map(([date, value]) => ({ date, value }));
}

/** All-time bests for one exercise, each with the date it happened. Null fields mean no data. */
export function exerciseSummary(entries, exercise) {
  const es = entries.filter((e) => e.exercise === exercise);
  if (!es.length) return null;
  const best = (score) => es.reduce((a, e) => (score(e) > score(a) ? e : a));
  const top = best((e) => e1rm(e.weight, e.reps));
  const heaviest = best((e) => +e.weight || 0);
  const bestSet = best((e) => (+e.reps || 0) * (+e.weight || 0));
  const mostReps = best((e) => +e.reps || 0);
  const sessions = dailySeries(es, exercise, 'volume');
  const bestSession = sessions.reduce((a, s) => (s.value > a.value ? s : a), { value: 0, date: '' });
  return {
    e1rm: { value: e1rm(top.weight, top.reps), date: top.date, set: top },
    weight: { value: +heaviest.weight || 0, date: heaviest.date, set: heaviest },
    bestSet: { value: (+bestSet.reps || 0) * (+bestSet.weight || 0), date: bestSet.date, set: bestSet },
    reps: { value: +mostReps.reps || 0, date: mostReps.date, set: mostReps },
    sessionVolume: bestSession,
    sessions: sessions.length,
    sets: es.reduce((a, e) => a + (+e.sets || 1), 0),
  };
}

export const REP_TARGETS = [1, 2, 3, 4, 5, 6, 8, 10, 12, 15];

/**
 * Rep records: for each target N, the heaviest weight actually lifted for at least N reps, plus the
 * weight the best estimated 1RM predicts for N reps (Epley, inverted). Estimates beyond ~10 reps are rough.
 */
export function repRecords(entries, exercise) {
  const es = entries.filter((e) => e.exercise === exercise && (+e.weight || 0) > 0 && (+e.reps || 0) > 0);
  const top = es.reduce((a, e) => Math.max(a, e1rm(e.weight, e.reps)), 0);
  return REP_TARGETS.map((n) => {
    let actual = null;
    for (const e of es) if (+e.reps >= n && (!actual || +e.weight > +actual.weight)) actual = e;
    return { reps: n, actual, estimate: top ? (n === 1 ? top : top / (1 + n / 30)) : 0 };
  });
}
