// Exercise library by muscle group, in English and Spanish.
// The sheet always stores the library's English name (or the name as typed for custom exercises),
// so a group whose members use different languages shares the same data.
import { getLang } from './i18n.js';

export const CATEGORIES = [
  { id: 'chest', en: 'Chest', es: 'Pecho', color: '#EB5757' },
  { id: 'back', en: 'Back', es: 'Espalda', color: '#5B8DEF' },
  { id: 'legs', en: 'Legs', es: 'Piernas', color: '#27AE60' },
  { id: 'shoulders', en: 'Shoulders', es: 'Hombros', color: '#F2994A' },
  { id: 'arms', en: 'Arms', es: 'Brazos', color: '#9B51E0' },
  { id: 'core', en: 'Core', es: 'Core', color: '#2DCCD3' },
  { id: 'cardio', en: 'Cardio', es: 'Cardio', color: '#F2C94C' },
  { id: 'other', en: 'Other', es: 'Otros', color: '#8A8A93' },
];
export const catLabel = (c) => c[getLang()] || c.en;

// [English (stored id), Spanish, bodyweight]
const LIBRARY = {
  chest: [['Bench press', 'Press banca'], ['Incline bench press', 'Press banca inclinado'], ['Decline bench press', 'Press banca declinado'],
    ['Dumbbell bench press', 'Press con mancuernas'], ['Incline dumbbell press', 'Press inclinado con mancuernas'],
    ['Dumbbell fly', 'Aperturas con mancuernas'], ['Cable crossover', 'Cruces en polea'], ['Machine chest press', 'Press en máquina'],
    ['Pec deck', 'Contractora (pec deck)'], ['Dips', 'Fondos', 1], ['Push-ups', 'Flexiones', 1]],
  back: [['Pull-ups', 'Dominadas', 1], ['Weighted pull-ups', 'Dominadas lastradas', 1], ['Lat pulldown', 'Jalón al pecho'],
    ['Barbell row', 'Remo con barra'], ['Dumbbell row', 'Remo con mancuerna'], ['Seated cable row', 'Remo en polea'],
    ['Machine row', 'Remo en máquina'], ['Deadlift', 'Peso muerto'], ['Cable pullover', 'Pullover en polea'],
    ['Back extensions', 'Hiperextensiones', 1]],
  legs: [['Squat', 'Sentadilla'], ['Front squat', 'Sentadilla frontal'], ['Bulgarian split squat', 'Sentadilla búlgara'],
    ['Goblet squat', 'Sentadilla goblet'], ['Leg press', 'Prensa'], ['Romanian deadlift', 'Peso muerto rumano'], ['Lunges', 'Zancadas'],
    ['Leg extension', 'Extensión de cuádriceps'], ['Leg curl', 'Curl femoral'], ['Hip thrust', 'Hip thrust'],
    ['Calf raise', 'Elevación de gemelos'], ['Hip abduction machine', 'Abductores en máquina']],
  shoulders: [['Overhead press', 'Press militar'], ['Dumbbell shoulder press', 'Press de hombros con mancuernas'],
    ['Lateral raise', 'Elevaciones laterales'], ['Rear delt fly', 'Pájaros'], ['Face pull', 'Face pull'], ['Shrugs', 'Encogimientos'],
    ['Upright row', 'Remo al mentón']],
  arms: [['Barbell curl', 'Curl bíceps'], ['Dumbbell curl', 'Curl con mancuernas'], ['Hammer curl', 'Curl martillo'],
    ['Cable curl', 'Curl en polea'], ['Preacher curl', 'Curl predicador'], ['Triceps pushdown', 'Extensión de tríceps en polea'],
    ['Skull crusher', 'Press francés'], ['Overhead triceps extension', 'Extensión de tríceps sobre la cabeza'],
    ['Bench dips', 'Fondos en banco', 1]],
  core: [['Crunch', 'Crunch', 1], ['Leg raise', 'Elevación de piernas', 1], ['Ab wheel rollout', 'Rueda abdominal', 1],
    ['Cable crunch', 'Crunch en polea'], ['Russian twist', 'Russian twist'], ['Pallof press', 'Pallof press']],
  cardio: [],
};

const key = (s) => String(s).toLocaleLowerCase('en').trim();
/** Lowercase, accent-free form for search and duplicate checks. */
export const norm = (s) => key(s).normalize('NFD').replace(/[̀-ͯ]/g, '');

const INDEX = new Map();
for (const [cat, list] of Object.entries(LIBRARY)) {
  for (const [en, es, bw] of list) INDEX.set(key(en), { name: en, es, cat, bw: Boolean(bw), custom: false });
}

let custom = new Map(); // custom exercises of the open group

/** The group's custom exercises (_exercises tab). Called whenever a group is opened. */
export function setCustomExercises(list) {
  custom = new Map();
  for (const c of list) {
    const k = key(c.name);
    if (!k || INDEX.has(k)) continue;
    custom.set(k, { name: c.name.trim(), es: '', cat: CATEGORIES.some((x) => x.id === c.cat) ? c.cat : 'other', bw: false, custom: true });
  }
}

export function exerciseInfo(name) {
  const k = key(name);
  return INDEX.get(k) || custom.get(k) || { name, es: '', cat: 'other', bw: false, custom: true };
}
export const categoryOf = (name) => CATEGORIES.find((c) => c.id === exerciseInfo(name).cat);

/** Display name in the current language. */
export function exName(name) {
  const info = exerciseInfo(name);
  return getLang() === 'es' && info.es ? info.es : info.name;
}

/** Library + the group's custom exercises + any other names found in the logs. */
export function allExercises(usedNames = []) {
  const out = new Map([...INDEX, ...custom]);
  for (const n of usedNames) {
    const k = key(n);
    if (k && !out.has(k)) out.set(k, { name: n, es: '', cat: 'other', bw: false, custom: true });
  }
  return [...out.values()];
}

/** Does it match the search in either language? */
export const matches = (e, q) => !q || norm(e.name).includes(q) || (e.es && norm(e.es).includes(q));

/** Is there already an exercise with this name (in either language)? Returns its stored name. */
export function findExisting(name, usedNames = []) {
  const q = norm(name);
  return allExercises(usedNames).find((e) => norm(e.name) === q || (e.es && norm(e.es) === q))?.name || null;
}
