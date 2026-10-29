// Achievements: ~360 of them in tiered families, all derived from the logged sets (nothing is stored).
// Each family turns a person's history into a timeline of a growing value ([date, value] pairs, never
// decreasing), so every tier knows the exact day it was reached and how close the next one is.
// Strength tiers start low on purpose, so everyone (whatever they lift) has steps to climb.
import { getLang } from './i18n.js';
import * as St from './stats.js';
import { CATEGORIES, exerciseInfo } from './exercises.js';

const L = (es, en) => ({ es, en });
export const tr = (o) => (o == null ? '' : typeof o === 'string' ? o : o[getLang()] || o.es);

export const ACH_CATS = [
  ['consistency', L('Constancia', 'Consistency'), 'calendar'],
  ['strength', L('Fuerza', 'Strength'), 'dumbbell'],
  ['records', L('Récords', 'Records'), 'trophy'],
  ['volume', L('Volumen', 'Volume'), 'chart'],
  ['variety', L('Variedad', 'Variety'), 'search'],
  ['fun', L('Especiales', 'Specials'), 'fire'],
  ['group', L('Grupo', 'Group'), 'users'],
];

// ---------- timeline helpers ----------
const cumulative = (dates) => dates.map((d, i) => [d, i + 1]);
function runningMax(pairs) {
  const out = [];
  let best = -Infinity;
  for (const [d, v] of pairs) if (v > best) { best = v; out.push([d, v]); }
  return out;
}
const byDate = (a, b) => (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0);
const vol = (e) => (+e.sets || 1) * (+e.reps || 0) * Math.max(0, +e.weight || 0);
const md = (d) => d.slice(5);
const dow = (d) => St.parseISO(d).getDay();
const daysBetween = (a, b) => Math.round((St.parseISO(b) - St.parseISO(a)) / 864e5);
const groupBy = (list, key) => { const m = new Map(); for (const x of list) { const k = key(x); if (!m.has(k)) m.set(k, []); m.get(k).push(x); } return m; };

// ---------- labels ----------
const kg = (n) => L(`${n} kg`, `${n} kg`);
const plus = (n) => L(`+${n} kg`, `+${n} kg`);
const reps = (n) => L(`${n} repeticiones`, `${n} reps`);
const count = (es1, esN, en1, enN) => (n) => L(n === 1 ? es1 : esN.replace('{n}', n), n === 1 ? en1 : enN.replace('{n}', n));
const tonnes = (n) => L(n >= 1000 ? `${(n / 1000).toLocaleString('es-ES')} t` : `${n} kg`, n >= 1000 ? `${(n / 1000).toLocaleString('en-GB')} t` : `${n} kg`);
const PLATES = {
  20: L('La barra sola', 'Just the bar'), 60: L('Una placa', 'One plate'), 100: L('Dos placas', 'Two plates'),
  140: L('Tres placas', 'Three plates'), 180: L('Cuatro placas', 'Four plates'), 220: L('Cinco placas', 'Five plates'),
};

// ---------- families ----------
// timeline(ctx) → [[date, value], …] with growing values; tiers are the thresholds.
const FAMILIES = [];
const fam = (f) => FAMILIES.push(f);

// Consistency
fam({ id: 'days', cat: 'consistency', title: L('Días de gym', 'Gym days'), tiers: [1, 5, 10, 25, 50, 75, 100, 150, 200, 250, 300, 365, 500, 750, 1000],
  label: count('Primer entreno', '{n} días', 'First workout', '{n} days'), names: { 1: L('Primera piedra', 'First stone'), 100: L('Club de los 100', 'The 100 club'), 365: L('Un año de gym', 'A year of gym') },
  timeline: (c) => cumulative(c.dates) });
fam({ id: 'streak', cat: 'consistency', title: L('Racha de semanas', 'Week streak'), tiers: [2, 3, 4, 6, 8, 10, 12, 16, 20, 26, 39, 52, 78, 104],
  label: count('1 semana', '{n} semanas seguidas', '1 week', '{n} weeks in a row'), names: { 4: L('Un mes sin fallar', 'A month without missing'), 12: L('Trimestre de hierro', 'Iron quarter'), 52: L('Año de acero', 'Year of steel') },
  timeline: (c) => {
    let prev = null, streak = 0;
    const out = [];
    for (const [w, ds] of c.weeks) { streak = prev && St.addDays(prev, 7) === w ? streak + 1 : 1; prev = w; out.push([ds[0], streak]); }
    return runningMax(out);
  } });
for (const [n, tiers] of [[3, [1, 5, 10, 25, 50, 100]], [4, [1, 5, 10, 25, 50]], [5, [1, 5, 10, 25]]]) {
  fam({ id: `weeks${n}`, cat: 'consistency', title: L(`Semanas de ${n}+ días`, `${n}+ day weeks`), tiers,
    label: count(`1 semana de ${n} días`, `{n} semanas de ${n}+ días`, `1 week of ${n} days`, `{n} weeks of ${n}+ days`),
    timeline: (c) => cumulative([...c.weeks.values()].filter((ds) => ds.length >= n).map((ds) => ds[n - 1])) });
}
fam({ id: 'month', cat: 'consistency', title: L('Mes intenso', 'Big month'), tiers: [8, 12, 16, 20],
  label: count('', '{n} días en un mes', '', '{n} days in a month'),
  timeline: (c) => { const per = new Map(); return runningMax(c.dates.map((d) => { const k = d.slice(0, 7); per.set(k, (per.get(k) || 0) + 1); return [d, per.get(k)]; })); } });
fam({ id: 'mondays', cat: 'consistency', title: L('Lunes sin excusas', 'No-excuse Mondays'), tiers: [5, 10, 25, 50],
  label: count('', '{n} lunes', '', '{n} Mondays'), timeline: (c) => cumulative(c.dates.filter((d) => dow(d) === 1)) });
fam({ id: 'weekend', cat: 'consistency', title: L('Guerrero de fin de semana', 'Weekend warrior'), tiers: [1, 5, 10, 25],
  label: count('Sábado y domingo', '{n} fines de semana completos', 'Saturday and Sunday', '{n} full weekends'),
  timeline: (c) => { const set = new Set(c.dates); return cumulative(c.dates.filter((d) => dow(d) === 0 && set.has(St.addDays(d, -1)))); } });
fam({ id: 'comeback', cat: 'consistency', title: L('Volver es de valientes', 'Comeback'), tiers: [30, 60, 90],
  label: count('', 'Volver tras {n} días', '', 'Back after {n} days'),
  timeline: (c) => runningMax(c.dates.slice(1).map((d, i) => [d, daysBetween(c.dates[i], d)])) });

// Special days (one tier each)
for (const [id, es, en, emoji, test] of [
  ['xmas', 'Turrón quemado', 'Burning the turkey', '🎄', (d) => ['12-24', '12-25', '12-26'].includes(md(d))],
  ['newyear', 'Año nuevo, mismo gym', 'New year, same gym', '🥂', (d) => ['12-31', '01-01'].includes(md(d))],
  ['reyes', 'Regalo de Reyes', 'Twelfth Night gift', '👑', (d) => md(d) === '01-06'],
  ['valentine', 'Mi amor es el hierro', 'In love with iron', '❤️', (d) => md(d) === '02-14'],
  ['halloween', 'Pesas de miedo', 'Spooky lifts', '🎃', (d) => md(d) === '10-31'],
]) {
  fam({ id, cat: 'fun', emoji, title: L(es, en), tiers: [1], label: () => L('Entrenar ese día', 'Train that day'), timeline: (c) => cumulative(c.dates.filter(test)) });
}
fam({ id: 'summer', cat: 'fun', emoji: '☀️', title: L('Operación verano', 'Summer body'), tiers: [12],
  label: () => L('12 días en agosto', '12 days in August'),
  timeline: (c) => { const per = new Map(); return runningMax(c.dates.filter((d) => d.slice(5, 7) === '08').map((d) => { const y = d.slice(0, 4); per.set(y, (per.get(y) || 0) + 1); return [d, per.get(y)]; })); } });

// Strength: heaviest weight (or most reps) per exercise. Low starting tiers on purpose.
const LIFTS = [
  ['bench', ['Bench press'], 'kg', [20, 30, 40, 50, 60, 70, 80, 90, 100, 110, 120, 130, 140, 150, 160, 180, 200]],
  ['squat', ['Squat'], 'kg', [20, 30, 40, 50, 60, 70, 80, 90, 100, 110, 120, 130, 140, 150, 160, 180, 200, 220, 250]],
  ['deadlift', ['Deadlift'], 'kg', [30, 40, 50, 60, 70, 80, 90, 100, 110, 120, 130, 140, 150, 160, 180, 200, 220, 250, 280, 300]],
  ['ohp', ['Overhead press'], 'kg', [15, 20, 25, 30, 35, 40, 50, 60, 70, 80, 90, 100]],
  ['hipthrust', ['Hip thrust'], 'kg', [20, 40, 60, 80, 100, 120, 140, 160, 180, 200, 220, 250]],
  ['row', ['Barbell row'], 'kg', [20, 30, 40, 50, 60, 70, 80, 90, 100, 120]],
  ['legpress', ['Leg press'], 'kg', [50, 80, 100, 120, 150, 180, 200, 250, 300, 350, 400]],
  ['curl', ['Barbell curl'], 'kg', [10, 15, 20, 25, 30, 35, 40, 50, 60]],
  ['pulldown', ['Lat pulldown'], 'kg', [20, 30, 40, 50, 60, 70, 80, 90, 100, 120]],
  ['rdl', ['Romanian deadlift'], 'kg', [20, 30, 40, 50, 60, 80, 100, 120, 140]],
  ['pullups', ['Pull-ups', 'Chin-ups', 'Neutral-grip pull-ups', 'Wide-grip pull-ups', 'Weighted pull-ups'], 'reps', [1, 3, 5, 8, 10, 12, 15, 20, 25]],
  ['wpullups', ['Weighted pull-ups'], 'plus', [5, 10, 15, 20, 25, 30, 40, 50]],
  ['dips', ['Dips', 'Weighted dips'], 'reps', [5, 10, 15, 20, 25, 30]],
  ['pushups', ['Push-ups'], 'reps', [5, 10, 20, 30, 40, 50]],
];
for (const [id, names, unit, tiers] of LIFTS) {
  const info = exerciseInfo(names[0]);
  fam({ id: `lift-${id}`, cat: 'strength', lift: names[0], title: L(info.es || info.name, info.name), tiers,
    label: unit === 'kg' ? kg : unit === 'plus' ? plus : reps,
    names: unit === 'kg' && ['bench', 'squat', 'deadlift', 'ohp', 'row', 'hipthrust', 'rdl'].includes(id) ? PLATES
      : id === 'pullups' ? { 1: L('Tu primera dominada', 'Your first pull-up') } : id === 'deadlift' ? PLATES : {},
    timeline: (c) => runningMax(c.sets.filter((e) => names.includes(e.exercise) && (unit === 'reps' ? +e.weight >= 0 : +e.weight > 0))
      .map((e) => [e.date, unit === 'reps' ? +e.reps || 0 : +e.weight])) });
}
fam({ id: 'big3', cat: 'strength', title: L('Total de las 3 grandes', 'Big three total'), tiers: [100, 150, 200, 250, 300, 350, 400, 453, 500, 600, 700],
  label: (n) => L(`${n} kg en total`, `${n} kg total`), names: { 453: L('Club de los 1000 (libras)', 'The 1000 lb club') },
  sub: L('Mejor 1RM estimado de sentadilla + press banca + peso muerto', 'Best estimated 1RM of squat + bench + deadlift'),
  timeline: (c) => {
    const best = { Squat: 0, 'Bench press': 0, Deadlift: 0 };
    const out = [];
    for (const e of c.sets) {
      if (!(e.exercise in best)) continue;
      const v = St.e1rm(e.weight, e.reps);
      if (v > best[e.exercise]) { best[e.exercise] = v; out.push([e.date, Math.floor(best.Squat + best['Bench press'] + best.Deadlift)]); }
    }
    return runningMax(out);
  } });

// Records
fam({ id: 'prs', cat: 'records', title: L('Coleccionista de récords', 'Record collector'), tiers: [1, 5, 10, 25, 50, 100, 250, 500],
  label: count('Primer récord personal', '{n} récords personales', 'First personal record', '{n} personal records'),
  timeline: (c) => cumulative(c.sets.filter((e) => c.prs.has(e.id)).map((e) => e.date)) });
fam({ id: 'prday', cat: 'records', title: L('Día de dioses', 'Godlike day'), tiers: [2, 3, 5],
  label: count('', '{n} récords en un día', '', '{n} records in one day'),
  timeline: (c) => { const per = new Map(); return runningMax(c.sets.filter((e) => c.prs.has(e.id)).map((e) => { per.set(e.date, (per.get(e.date) || 0) + 1); return [e.date, per.get(e.date)]; })); } });

// Volume, with fun comparisons
fam({ id: 'tonnage', cat: 'volume', title: L('Kilos acumulados', 'Total lifted'), tiers: [500, 1500, 2300, 6000, 8000, 12000, 25000, 30000, 60000, 150000, 225000, 400000, 1000000, 7300000],
  label: tonnes,
  names: { 500: L('Un piano de cola', 'A grand piano'), 1500: L('Un coche', 'A car'), 2300: L('Un rinoceronte', 'A rhino'), 6000: L('Un elefante', 'An elephant'),
    8000: L('Un T-Rex', 'A T-Rex'), 12000: L('Un autobús', 'A bus'), 25000: L('Un camión', 'A lorry'), 30000: L('Una ballena jorobada', 'A humpback whale'),
    60000: L('Un tanque', 'A tank'), 150000: L('Una ballena azul', 'A blue whale'), 225000: L('La Estatua de la Libertad', 'The Statue of Liberty'),
    400000: L('Un Boeing 747', 'A Boeing 747'), 1000000: L('Mil toneladas', 'A thousand tonnes'), 7300000: L('La Torre Eiffel', 'The Eiffel Tower') },
  timeline: (c) => { let s = 0; return c.sets.map((e) => [e.date, (s += vol(e))]); } });
fam({ id: 'sessionvol', cat: 'volume', title: L('Sesión monstruo', 'Monster session'), tiers: [2000, 5000, 10000, 15000, 20000, 30000],
  label: (n) => L(`${tonnes(n).es} en un día`, `${tonnes(n).en} in a day`),
  timeline: (c) => { const per = new Map(); return runningMax(c.sets.map((e) => { per.set(e.date, (per.get(e.date) || 0) + vol(e)); return [e.date, per.get(e.date)]; })); } });
fam({ id: 'setsday', cat: 'volume', title: L('Maratón de series', 'Set marathon'), tiers: [15, 20, 25, 30, 40],
  label: count('', '{n} series en un día', '', '{n} sets in a day'),
  timeline: (c) => { const per = new Map(); return runningMax(c.sets.map((e) => { per.set(e.date, (per.get(e.date) || 0) + (+e.sets || 1)); return [e.date, per.get(e.date)]; })); } });
fam({ id: 'setstotal', cat: 'volume', title: L('Series totales', 'Total sets'), tiers: [100, 500, 1000, 2500, 5000, 10000],
  label: count('', '{n} series', '', '{n} sets'), timeline: (c) => { let s = 0; return c.sets.map((e) => [e.date, (s += +e.sets || 1)]); } });
fam({ id: 'repstotal', cat: 'volume', title: L('Repeticiones totales', 'Total reps'), tiers: [1000, 5000, 10000, 25000, 50000, 100000],
  label: count('', '{n} repeticiones', '', '{n} reps'), timeline: (c) => { let s = 0; return c.sets.map((e) => [e.date, (s += (+e.sets || 1) * (+e.reps || 0))]); } });
fam({ id: 'repsone', cat: 'volume', title: L('Mil repeticiones', 'A thousand reps'), tiers: [500, 1000, 5000],
  label: count('', '{n} reps de un mismo ejercicio', '', '{n} reps of one exercise'),
  timeline: (c) => { const per = new Map(); return runningMax(c.sets.map((e) => { per.set(e.exercise, (per.get(e.exercise) || 0) + (+e.sets || 1) * (+e.reps || 0)); return [e.date, per.get(e.exercise)]; })); } });

// Variety
const MUSCLES = CATEGORIES.filter((c) => !['cardio', 'other'].includes(c.id));
const LEGS = new Set(['quads', 'hamstrings', 'glutes', 'calves']);
fam({ id: 'distinct', cat: 'variety', title: L('Explorador', 'Explorer'), tiers: [5, 10, 20, 30, 50, 75, 100],
  label: count('', '{n} ejercicios distintos', '', '{n} different exercises'),
  timeline: (c) => { const seen = new Set(); return c.sets.filter((e) => !seen.has(e.exercise) && seen.add(e.exercise)).map((e, i) => [e.date, i + 1]); } });
fam({ id: 'groupsweek', cat: 'variety', title: L('Cuerpo completo', 'Full body'), tiers: [5, 8, 11],
  label: count('', '{n} grupos musculares en una semana', '', '{n} muscle groups in a week'),
  timeline: (c) => { const per = new Map(); return runningMax(c.sets.map((e) => { const w = St.weekStart(e.date); if (!per.has(w)) per.set(w, new Set()); per.get(w).add(exerciseInfo(e.exercise).cat); return [e.date, [...per.get(w)].filter((x) => MUSCLES.some((m) => m.id === x)).length]; })); } });
fam({ id: 'legweeks', cat: 'variety', title: L('Nunca te saltes pierna', 'Never skip leg day'), tiers: [2, 4, 8, 12, 26],
  label: count('', '{n} semanas seguidas con pierna', '', '{n} weeks in a row with legs'),
  timeline: (c) => {
    const weeks = [...new Set(c.sets.filter((e) => LEGS.has(exerciseInfo(e.exercise).cat)).map((e) => e.date))].sort()
      .reduce((m, d) => { const w = St.weekStart(d); if (!m.has(w)) m.set(w, d); return m; }, new Map());
    let prev = null, streak = 0;
    const out = [];
    for (const [w, d] of weeks) { streak = prev && St.addDays(prev, 7) === w ? streak + 1 : 1; prev = w; out.push([d, streak]); }
    return runningMax(out);
  } });
for (const m of MUSCLES) {
  fam({ id: `spec-${m.id}`, cat: 'variety', title: L(`Especialista: ${m.es}`, `${m.en} specialist`), tiers: [50, 250, 1000],
    label: count('', '{n} series', '', '{n} sets'),
    timeline: (c) => { let s = 0; return c.sets.filter((e) => exerciseInfo(e.exercise).cat === m.id).map((e) => [e.date, (s += +e.sets || 1)]); } });
}
fam({ id: 'noassist', cat: 'variety', emoji: '💪', title: L('Adiós, máquina', 'Bye bye, machine'), tiers: [1],
  label: () => L('Una dominada sin asistencia, tras usar la asistida', 'An unassisted pull-up after using the assisted one'),
  timeline: (c) => {
    const firstAssisted = c.sets.find((e) => e.exercise === 'Assisted pull-ups')?.date;
    const after = firstAssisted && c.sets.find((e) => e.date >= firstAssisted && ['Pull-ups', 'Chin-ups', 'Weighted pull-ups'].includes(e.exercise) && +e.weight >= 0);
    return after ? [[after.date, 1]] : [];
  } });

// Fun
fam({ id: 'perfect', cat: 'fun', title: L('Perfeccionista', 'Perfectionist'), tiers: [1, 10, 50],
  label: count('5 series idénticas', '{n} veces 5 series idénticas', '5 identical sets', '5 identical sets {n} times'),
  timeline: (c) => cumulative([...groupBy(c.sets, (e) => `${e.date}|${e.exercise}`).values()]
    .filter((es) => [...groupBy(es, (e) => `${e.weight}|${e.reps}`).values()].some((g) => g.length >= 5)).map((es) => es[0].date).sort()) });
fam({ id: 'pyramid', cat: 'fun', title: L('Pirámide', 'Pyramid'), tiers: [1, 10],
  label: count('4 series subiendo peso', '{n} pirámides', '4 sets going up in weight', '{n} pyramids'),
  timeline: (c) => cumulative([...groupBy(c.sets, (e) => `${e.date}|${e.exercise}`).values()]
    .filter((es) => es.length >= 4 && es.every((e, i) => i === 0 || +e.weight > +es[i - 1].weight)).map((es) => es[0].date).sort()) });
fam({ id: 'chestmonday', cat: 'fun', title: L('Lunes internacional de pecho', 'International chest day'), tiers: [1, 10, 25],
  label: count('Press banca un lunes', '{n} lunes de press banca', 'Bench press on a Monday', '{n} bench Mondays'),
  timeline: (c) => cumulative([...new Set(c.sets.filter((e) => e.exercise === 'Bench press' && dow(e.date) === 1).map((e) => e.date))]) });
fam({ id: 'rep21', cat: 'fun', title: L('Veintiuno', 'Twenty-one'), tiers: [1],
  label: () => L('Una serie de exactamente 21 repeticiones', 'A set of exactly 21 reps'),
  timeline: (c) => { const e = c.sets.find((x) => +x.reps === 21); return e ? [[e.date, 1]] : []; } });

// Group (needs everyone's data)
fam({ id: 'won', cat: 'group', title: L('Campeón', 'Champion'), tiers: [1, 3, 5, 10],
  label: count('Ganar un reto', 'Ganar {n} retos', 'Win a challenge', 'Win {n} challenges'),
  timeline: (c) => cumulative(c.challenges.filter((ch) => ch.end < c.today).filter((ch) => {
    const ranked = c.members.map((m) => ({ m, v: St.challengeValue(ch, c.entriesOf(m.email)) })).filter((x) => x.v != null && x.v > 0).sort((a, b) => b.v - a.v);
    return ranked[0]?.m.email === c.email;
  }).map((ch) => ch.end).sort()) });
const monthRanks = (c) => {
  // Days trained per month for every member, counted once.
  const perMember = new Map(c.members.map((m) => {
    const days = new Map();
    for (const d of new Set(c.entriesOf(m.email).map((e) => e.date))) days.set(d.slice(0, 7), (days.get(d.slice(0, 7)) || 0) + 1);
    return [m.email, days];
  }));
  const months = [...new Set(c.dates.map((d) => d.slice(0, 7)))].filter((m) => m < c.today.slice(0, 7));
  return months.map((mo) => {
    const mine = perMember.get(c.email)?.get(mo) || 0;
    const better = new Set([...perMember.values()].map((days) => days.get(mo) || 0).filter((v) => v > mine)).size;
    return { end: St.addDays(`${St.addDays(`${mo}-01`, 32).slice(0, 7)}-01`, -1), rank: better + 1 };
  });
};
fam({ id: 'podium', cat: 'group', title: L('Podio del mes', 'Monthly podium'), tiers: [1, 3, 6, 12],
  label: count('Top 3 de asistencia un mes', 'Top 3 en {n} meses', 'Top 3 attendance in a month', 'Top 3 in {n} months'),
  timeline: (c) => (c.members.length < 2 ? [] : cumulative(monthRanks(c).filter((x) => x.rank <= 3).map((x) => x.end))) });
fam({ id: 'firstmonth', cat: 'group', title: L('El que más va', 'Gym rat of the month'), tiers: [1, 3, 6],
  label: count('El que más fue en un mes', 'El que más fue {n} meses', 'Most days in a month', 'Most days in {n} months'),
  timeline: (c) => (c.members.length < 2 ? [] : cumulative(monthRanks(c).filter((x) => x.rank === 1).map((x) => x.end))) });
fam({ id: 'buddy', cat: 'group', title: L('Compañero fiel', 'Gym buddy'), tiers: [5, 10, 25, 50, 100],
  label: count('', '{n} días entrenando el mismo día que alguien del grupo', '', '{n} days training the same day as someone in the group'),
  timeline: (c) => { const others = new Set(c.members.filter((m) => m.email !== c.email).flatMap((m) => c.entriesOf(m.email).map((e) => e.date))); return cumulative(c.dates.filter((d) => others.has(d))); } });
fam({ id: 'proposer', cat: 'group', title: L('Organizador', 'Organiser'), tiers: [1, 5, 10],
  label: count('Proponer un reto', 'Proponer {n} retos', 'Propose a challenge', 'Propose {n} challenges'),
  timeline: (c) => cumulative(c.challenges.filter((ch) => ch.createdBy === c.email).map((ch) => ch.start).sort()) });

// What the medal shows in its centre: the number to reach and a short unit.
const UNITS = {
  days: L('días', 'days'), month: L('días', 'days'), comeback: L('días', 'days'), buddy: L('días', 'days'), mondays: L('lunes', 'Mon'),
  streak: L('semanas', 'weeks'), weeks3: L('semanas', 'weeks'), weeks4: L('semanas', 'weeks'), weeks5: L('semanas', 'weeks'), legweeks: L('semanas', 'weeks'),
  weekend: L('findes', 'wknds'), big3: L('kg', 'kg'), prs: L('récords', 'PRs'), prday: L('récords', 'PRs'),
  setsday: L('series', 'sets'), setstotal: L('series', 'sets'), repstotal: L('reps', 'reps'), repsone: L('reps', 'reps'),
  distinct: L('ejercicios', 'exercises'), groupsweek: L('grupos', 'groups'), perfect: L('veces', 'times'), pyramid: L('pirámides', 'pyramids'),
  chestmonday: L('lunes', 'Mon'), rep21: L('reps', 'reps'), won: L('retos', 'wins'), podium: L('meses', 'months'), firstmonth: L('meses', 'months'),
  proposer: L('retos', 'challenges'),
};
export function face(f, th) {
  if (f.emoji) return { text: f.emoji, unit: '' };
  if (f.id === 'tonnage' || f.id === 'sessionvol') {
    return th >= 1000 ? { text: (th / 1000).toLocaleString(getLang() === 'en' ? 'en-GB' : 'es-ES'), unit: 't' } : { text: String(th), unit: 'kg' };
  }
  if (f.id.startsWith('spec-')) return { text: String(th), unit: tr(UNITS.setstotal) };
  if (f.lift) return f.label === kg ? { text: String(th), unit: 'kg' } : f.label === plus ? { text: `+${th}`, unit: 'kg' } : { text: String(th), unit: 'reps' };
  const unit = tr(UNITS[f.id]);
  return { text: String(th), unit: th === 1 ? ONE[unit] || unit : unit };
}
// Singular units, for the tiers of exactly 1 ("1 día", not "1 días").
const ONE = { días: 'día', days: 'day', semanas: 'semana', weeks: 'week', findes: 'finde', wknds: 'wknd', récords: 'récord', PRs: 'PR',
  veces: 'vez', times: 'time', pirámides: 'pirámide', pyramids: 'pyramid', retos: 'reto', wins: 'win', meses: 'mes', months: 'month',
  challenges: 'challenge', ejercicios: 'ejercicio', exercises: 'exercise', grupos: 'grupo', groups: 'group', series: 'serie', sets: 'set', reps: 'rep' };

export const TOTAL = FAMILIES.reduce((a, f) => a + f.tiers.length, 0);

/** Medal colour by how far up the family's tiers this one is. */
export function medal(i, n) {
  if (n >= 3 && i === n - 1) return 'platinum';
  const f = n <= 1 ? 1 : i / (n - 1);
  return f >= 0.67 ? 'gold' : f >= 0.34 ? 'silver' : 'bronze';
}

/**
 * Evaluates every family for one person of a group.
 * @returns {{ families, unlocked, done, total }} unlocked: newest first, each { key, family, tier, date }.
 */
export function evaluate(email, group) {
  // Each member's entries, split once: the group families look them up many times.
  const byMember = new Map();
  for (const e of group.entries) { if (!byMember.has(e.email)) byMember.set(e.email, []); byMember.get(e.email).push(e); }
  const entriesOf = (m) => byMember.get(m) || [];
  const mineAll = entriesOf(email);
  const sets = mineAll.map((e, i) => [e, i]).filter(([e]) => e.exercise).sort((a, b) => byDate([a[0].date], [b[0].date]) || a[1] - b[1]).map(([e]) => e);
  const dates = [...new Set(mineAll.map((e) => e.date))].sort();
  const weeks = new Map();
  for (const d of dates) { const w = St.weekStart(d); if (!weeks.has(w)) weeks.set(w, []); weeks.get(w).push(d); }
  const ctx = {
    email, sets, dates, weeks: new Map([...weeks].sort(byDate)), prs: St.prIds(mineAll), today: St.todayISO(),
    members: group.members, challenges: group.challenges || [], entriesOf,
  };
  const families = [];
  const unlocked = [];
  for (const f of FAMILIES) {
    let line;
    try { line = f.timeline(ctx); } catch { line = []; }
    const value = line.length ? line[line.length - 1][1] : 0;
    const tiers = f.tiers.map((th, i) => {
      const hit = line.find(([, v]) => v >= th);
      const t = { th, i, label: f.label(th), name: f.names?.[th] || null, date: hit ? hit[0] : null, medal: medal(i, f.tiers.length) };
      if (t.date) unlocked.push({ key: `${f.id}:${th}`, family: f, tier: t, date: t.date });
      return t;
    });
    const level = tiers.filter((t) => t.date).length;
    families.push({ ...f, value, tiers, level, next: tiers.find((t) => !t.date) || null });
  }
  unlocked.sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));
  return { families, unlocked, done: unlocked.length, total: TOTAL };
}
