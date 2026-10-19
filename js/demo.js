// Modo demo: misma interfaz que SheetStore, con datos inventados en memoria.
import { addDays, parseISO, todayISO, weekStart } from './stats.js';

function rng(seed) { // mulberry32
  return () => {
    seed |= 0; seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);

const ROUTINES = [
  ['Press banca', 'Press militar', 'Fondos'],
  ['Sentadilla', 'Peso muerto rumano', 'Zancadas'],
  ['Dominadas lastradas', 'Remo con barra', 'Curl bíceps'],
  ['Peso muerto', 'Press banca', 'Sentadilla'],
];

const PEOPLE = [
  { email: 'tu@demo.local', name: 'Tú', rate: 0.5, gain: 0.10, base: { 'Press banca': 70, 'Sentadilla': 95, 'Peso muerto': 120 } },
  { email: 'ana@demo.local', name: 'Ana', rate: 0.62, gain: 0.16, base: { 'Press banca': 45, 'Sentadilla': 80, 'Peso muerto': 100 } },
  { email: 'pablo@demo.local', name: 'Pablo', rate: 0.45, gain: 0.05, base: { 'Press banca': 100, 'Sentadilla': 140, 'Peso muerto': 175 } },
  { email: 'lucia@demo.local', name: 'Lucía', rate: 0.55, gain: 0.12, base: { 'Press banca': 52, 'Sentadilla': 90, 'Peso muerto': 115 } },
  { email: 'marcos@demo.local', name: 'Marcos', rate: 0.3, gain: 0.08, base: { 'Press banca': 85, 'Sentadilla': 110, 'Peso muerto': 140 } },
];
const RELATIVE = {
  'Press militar': ['Press banca', 0.62], 'Fondos': ['Press banca', 0.25], 'Peso muerto rumano': ['Peso muerto', 0.72],
  'Zancadas': ['Sentadilla', 0.45], 'Dominadas lastradas': ['Press banca', 0.2], 'Remo con barra': ['Press banca', 0.8],
  'Curl bíceps': ['Press banca', 0.3],
};

function makeGroup() {
  const r = rng(42);
  const today = todayISO();
  const DAYS = 180;
  const entries = [];
  const members = PEOPLE.map((p) => ({ email: p.email, name: p.name, picture: '', joined: addDays(today, -DAYS) }));
  for (const p of PEOPLE) {
    let k = Math.floor(r() * 4);
    for (let d = DAYS; d >= 0; d--) {
      const date = addDays(today, -d);
      const wd = parseISO(date).getDay();
      const p2 = p.rate * (wd === 0 || wd === 6 ? 0.55 : 1.15);
      if (r() > p2) continue;
      const t = 1 - d / DAYS; // progreso 0→1
      const routine = ROUTINES[k++ % ROUTINES.length];
      routine.forEach((ex, i) => {
        if (i === 2 && r() < 0.35) return;
        const [ref, f] = p.base[ex] ? [ex, 1] : RELATIVE[ex];
        const target = p.base[ref] * f * (1 + p.gain * t + (r() - 0.5) * 0.06);
        const reps = [5, 6, 8, 10, 12][Math.floor(r() * 5)];
        const weight = Math.max(2.5, Math.round(target / (1 + reps / 30) / 2.5) * 2.5);
        entries.push({ id: uid(), email: p.email, date, exercise: ex, sets: 3 + Math.floor(r() * 2), reps, weight, notes: '' });
      });
    }
  }
  const monthStart = `${today.slice(0, 8)}01`;
  const monthEnd = addDays(`${addDays(monthStart, 32).slice(0, 8)}01`, -1);
  const nextWeek = addDays(weekStart(today), 7);
  const challenges = [
    { id: uid(), title: '¿Quién va más este mes?', type: 'asistencia', exercise: '', start: monthStart, end: monthEnd, createdBy: 'ana@demo.local' },
    { id: uid(), title: 'Banca: +5 % en 8 semanas', type: 'mejora', exercise: 'Press banca', start: addDays(today, -42), end: addDays(today, 14), createdBy: 'pablo@demo.local' },
    { id: uid(), title: 'Verano: más kilos de sentadilla', type: 'volumen', exercise: 'Sentadilla', start: addDays(today, -150), end: addDays(today, -60), createdBy: 'tu@demo.local' },
    { id: uid(), title: 'Semana de volumen total', type: 'volumen', exercise: '', start: nextWeek, end: addDays(nextWeek, 6), createdBy: 'lucia@demo.local' },
  ];
  return { id: 'demo', name: 'Los del gym (demo)', url: '', members, entries, challenges };
}

export class DemoStore {
  kind = 'demo';

  constructor() {
    this.me = { email: 'tu@demo.local', name: 'Tú', picture: '' };
    this.groups = [makeGroup()];
  }

  #get(id) {
    const g = this.groups.find((x) => x.id === id);
    if (!g) throw Object.assign(new Error('Grupo no encontrado'), { status: 404 });
    return g;
  }

  async listGroups() { return this.groups.map((g) => ({ id: g.id, name: g.name, owner: null })); }

  async createGroup(name) {
    const id = `demo-${uid()}`;
    this.groups.push({ id, name, url: '', members: [{ ...this.me, joined: todayISO() }], entries: [], challenges: [] });
    return id;
  }

  async join() {}

  async loadGroup(id) {
    return { ...structuredClone(this.#get(id)), isMember: true, canShare: true, ownerName: 'Tú', suspicious: [] };
  }

  async addEntries(id, rows) { this.#get(id).entries.push(...rows.map((e) => ({ ...e, email: this.me.email }))); }

  async deleteEntry(id, entryId) {
    const g = this.#get(id);
    g.entries = g.entries.filter((e) => !(e.id === entryId && e.email === this.me.email));
  }

  async addChallenge(id, c) { this.#get(id).challenges.push({ ...c, createdBy: this.me.email }); }

  async invite() {}
}
