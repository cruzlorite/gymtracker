// Cálculos puros: no tocan la red ni el DOM.

export function toISO(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
export const todayISO = () => toISO(new Date());
export function parseISO(s) {
  const [y, m, d] = s.split('-').map(Number);
  return new Date(y, m - 1, d);
}
/** ¿Es una fecha real con formato AAAA-MM-DD? (la hoja la puede editar cualquiera a mano) */
export const isISODate = (s) => /^\d{4}-\d{2}-\d{2}$/.test(s) && toISO(parseISO(s)) === s;
export function addDays(s, n) {
  const d = parseISO(s);
  d.setDate(d.getDate() + n);
  return toISO(d);
}
/** Lunes de la semana de una fecha. */
export function weekStart(s) {
  const d = parseISO(s);
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
  return toISO(d);
}

export const PERIODS = { 7: '7 días', 30: '30 días', 90: '90 días', 365: '1 año', all: 'Todo' };
export function periodRange(p) {
  const to = todayISO();
  return { from: p === 'all' ? '0000-01-01' : addDays(to, -(Number(p) - 1)), to };
}
const inRange = (e, r) => !r || (e.date >= r.from && e.date <= r.to);

/** 1RM estimado (Epley). */
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

/** Semanas consecutivas (hasta hoy) con al menos un día de gym. La semana actual no rompe la racha. */
export function weekStreak(entries) {
  const weeks = new Set(entries.map(e => weekStart(e.date)));
  let w = weekStart(todayISO());
  if (!weeks.has(w)) w = addDays(w, -7);
  let n = 0;
  while (weeks.has(w)) { n++; w = addDays(w, -7); }
  return n;
}

export function exercises(entries) {
  return [...new Set(entries.map(e => e.exercise).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'es'));
}

/** Mejor 1RM estimado de cada día para un ejercicio. */
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
 * Mejora en el periodo: para cada ejercicio con al menos 2 días, compara el 1RM estimado del
 * primer día con el mejor de los días siguientes. La nota es la media entre ejercicios,
 * así que es justa entre gente de niveles distintos.
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

/** Marcas personales por ejercicio. */
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
  return [...out.values()].sort((a, b) => a.exercise.localeCompare(b.exercise, 'es'));
}

/** Valor de un participante en un reto (null = sin datos suficientes). */
export function challengeValue(ch, entries) {
  const r = { from: ch.start, to: ch.end };
  switch (ch.type) {
    case 'asistencia': return attendance(entries, r);
    case 'volumen': return volume(entries, r, ch.exercise || null);
    case 'mejora': {
      const s = improvement(entries, r, ch.exercise || null).score;
      return s == null ? null : s * 100;
    }
    default: return null;
  }
}
