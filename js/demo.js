// Demo mode: same interface as SheetStore, with made-up in-memory data.
import { t } from './i18n.js';
import { addDays, parseISO, todayISO, weekStart } from './stats.js';

function rng(seed) { // mulberry32
  return () => {
    seed |= 0; seed = (seed + 0x6d2b79f5) | 0;
    let x = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    x = (x + Math.imul(x ^ (x >>> 7), 61 | x)) ^ x;
    return ((x ^ (x >>> 14)) >>> 0) / 4294967296;
  };
}
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);

const ROUTINES = [
  ['Bench press', 'Overhead press', 'Dips'],
  ['Squat', 'Romanian deadlift', 'Lunges'],
  ['Weighted pull-ups', 'Barbell row', 'Barbell curl'],
  ['Deadlift', 'Bench press', 'Squat'],
];

const PEOPLE = [
  { email: 'tu@demo.local', name: null, rate: 0.5, gain: 0.10, base: { 'Bench press': 70, 'Squat': 95, 'Deadlift': 120 } },
  { email: 'ana@demo.local', name: 'Ana', rate: 0.62, gain: 0.16, base: { 'Bench press': 45, 'Squat': 80, 'Deadlift': 100 } },
  { email: 'pablo@demo.local', name: 'Pablo', rate: 0.45, gain: 0.05, base: { 'Bench press': 100, 'Squat': 140, 'Deadlift': 175 } },
  { email: 'lucia@demo.local', name: 'Lucía', rate: 0.55, gain: 0.12, base: { 'Bench press': 52, 'Squat': 90, 'Deadlift': 115 } },
  { email: 'marcos@demo.local', name: 'Marcos', rate: 0.3, gain: 0.08, base: { 'Bench press': 85, 'Squat': 110, 'Deadlift': 140 } },
];
const RELATIVE = {
  'Overhead press': ['Bench press', 0.62], 'Dips': ['Bench press', 0.25], 'Romanian deadlift': ['Deadlift', 0.72],
  'Lunges': ['Squat', 0.45], 'Weighted pull-ups': ['Bench press', 0.2], 'Barbell row': ['Bench press', 0.8],
  'Barbell curl': ['Bench press', 0.3],
};

function makeGroup() {
  const r = rng(42);
  const today = todayISO();
  const DAYS = 180;
  const entries = [];
  const members = PEOPLE.map((p) => ({ email: p.email, name: p.name || t('demo.you'), nameKey: p.name ? '' : 'demo.you', picture: '', joined: addDays(today, -DAYS) }));
  for (const p of PEOPLE) {
    let k = Math.floor(r() * 4);
    for (let d = DAYS; d >= 0; d--) {
      const date = addDays(today, -d);
      const wd = parseISO(date).getDay();
      const p2 = p.rate * (wd === 0 || wd === 6 ? 0.55 : 1.15);
      if (r() > p2) continue;
      if (d === 0 && p.email === 'tu@demo.local') continue; // today, "You" starts with an empty workout screen
      const progress = 1 - d / DAYS; // 0 → 1 over the period
      const routine = ROUTINES[k++ % ROUTINES.length];
      routine.forEach((ex, i) => {
        if (i === 2 && r() < 0.35) return;
        const [ref, f] = p.base[ex] ? [ex, 1] : RELATIVE[ex];
        const target = p.base[ref] * f * (1 + p.gain * progress + (r() - 0.5) * 0.06);
        const reps = [5, 6, 8, 10, 12][Math.floor(r() * 5)];
        const weight = Math.max(2.5, Math.round(target / (1 + reps / 30) / 2.5) * 2.5);
        // One row per set, as the app logs them; the last set sometimes comes out a rep or two short.
        const n = 3 + Math.floor(r() * 2);
        for (let s = 0; s < n; s++) {
          const rr = s === n - 1 && r() < 0.4 ? Math.max(1, reps - 1 - Math.floor(r() * 2)) : reps;
          entries.push({ id: uid(), email: p.email, date, exercise: ex, sets: 1, reps: rr, weight, notes: '' });
        }
      });
    }
  }
  const monthStart = `${today.slice(0, 8)}01`;
  const monthEnd = addDays(`${addDays(monthStart, 32).slice(0, 8)}01`, -1);
  const nextWeek = addDays(weekStart(today), 7);
  const challenges = [
    { id: uid(), titleKey: 'demo.ch1', type: 'attendance', exercise: '', start: monthStart, end: monthEnd, createdBy: 'ana@demo.local' },
    { id: uid(), titleKey: 'demo.ch2', type: 'improvement', exercise: 'Bench press', start: addDays(today, -42), end: addDays(today, 14), createdBy: 'pablo@demo.local' },
    { id: uid(), titleKey: 'demo.ch3', type: 'volume', exercise: 'Squat', start: addDays(today, -150), end: addDays(today, -60), createdBy: 'tu@demo.local' },
    { id: uid(), titleKey: 'demo.ch5', type: 'prs', exercise: '', start: addDays(today, -20), end: addDays(today, 10), createdBy: 'marcos@demo.local' },
    { id: uid(), titleKey: 'demo.ch4', type: 'volume', exercise: '', start: nextWeek, end: addDays(nextWeek, 6), createdBy: 'lucia@demo.local' },
  ];
  return { id: 'demo', nameKey: 'demo.groupName', name: '', url: '', members, entries, challenges, exercises: [] };
}

export class DemoStore {
  kind = 'demo';

  constructor() {
    this.me = { email: 'tu@demo.local', name: t('demo.you'), picture: '' };
    this.groups = [makeGroup()];
    this.relabel();
  }

  /** Re-applies translated texts (your name, group name, challenge titles) after a language change. */
  relabel() {
    this.me.name = t('demo.you');
    for (const g of this.groups) {
      if (g.nameKey) g.name = t(g.nameKey);
      for (const m of g.members) if (m.nameKey) m.name = t(m.nameKey);
      for (const c of g.challenges) if (c.titleKey) c.title = t(c.titleKey);
    }
  }

  #get(id) {
    const g = this.groups.find((x) => x.id === id);
    if (!g) throw Object.assign(new Error('Group not found'), { status: 404 });
    return g;
  }

  async listGroups() { return this.groups.map((g) => ({ id: g.id, name: g.name, owner: null })); }

  async createGroup(name) {
    const id = `demo-${uid()}`;
    this.groups.push({ id, name, url: '', members: [{ ...this.me, joined: todayISO() }], entries: [], challenges: [], exercises: [] });
    return id;
  }

  async join() {}

  async loadGroup(id) {
    return { ...structuredClone(this.#get(id)), isMember: true, isOwner: true, openLogging: this.#get(id).openLogging !== false, canShare: true, ownerName: t('demo.you'), suspicious: [] };
  }

  async addEntries(id, rows, email = this.me.email) { this.#get(id).entries.push(...rows.map((e) => ({ ...e, email }))); }

  async updateEntry(id, e, email = this.me.email) {
    const g = this.#get(id);
    g.entries = g.entries.map((x) => (x.id === e.id && x.email === email ? { ...e, email } : x));
  }

  async deleteEntry(id, entryId, email = this.me.email) {
    const g = this.#get(id);
    g.entries = g.entries.filter((e) => !(e.id === entryId && e.email === email));
  }

  async setOpenLogging(id, open) { this.#get(id).openLogging = open; }

  async addChallenge(id, c) { this.#get(id).challenges.push({ ...c, createdBy: this.me.email }); }

  async addExercise(id, ex) { this.#get(id).exercises.push(ex); }

  async invite(id, email) {
    const g = this.#get(id);
    g.invited ||= [];
    if (!g.invited.includes(email)) g.invited.push(email.trim().toLowerCase());
  }

  async listPermissions(id) {
    const g = this.#get(id);
    return [
      ...g.members.map((m) => ({ id: `p-${m.email}`, email: m.email, name: m.name, role: m.email === this.me.email ? 'owner' : 'writer' })),
      ...(g.invited || []).map((email) => ({ id: `p-${email}`, email, name: '', role: 'writer' })),
    ];
  }

  async revoke(id, permissionId) {
    const g = this.#get(id);
    g.invited = (g.invited || []).filter((e) => `p-${e}` !== permissionId);
  }

  async removeMember(id, email) {
    const g = this.#get(id);
    g.members = g.members.filter((m) => m.email !== email);
    g.entries = g.entries.filter((e) => e.email !== email);
  }

  async renameGroup(id, name) { this.#get(id).name = name; }

  async deleteGroup(id) { this.groups = this.groups.filter((g) => g.id !== id); }
}
