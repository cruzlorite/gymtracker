// Biblioteca de ejercicios por grupo muscular, en español e inglés.
// En la hoja se guarda siempre el nombre en español de la biblioteca (o el nombre tal cual si es propio),
// así un grupo con gente en distintos idiomas comparte los mismos datos.
import { getLang } from './i18n.js';

export const CATEGORIES = [
  { id: 'pecho', es: 'Pecho', en: 'Chest', color: '#EB5757' },
  { id: 'espalda', es: 'Espalda', en: 'Back', color: '#5B8DEF' },
  { id: 'piernas', es: 'Piernas', en: 'Legs', color: '#27AE60' },
  { id: 'hombros', es: 'Hombros', en: 'Shoulders', color: '#F2994A' },
  { id: 'brazos', es: 'Brazos', en: 'Arms', color: '#9B51E0' },
  { id: 'core', es: 'Core', en: 'Core', color: '#2DCCD3' },
  { id: 'cardio', es: 'Cardio', en: 'Cardio', color: '#F2C94C' },
  { id: 'otros', es: 'Otros', en: 'Other', color: '#8A8A93' },
];
export const catLabel = (c) => c[getLang()] || c.es;

// [es, en, peso corporal]
const LIBRARY = {
  pecho: [['Press banca', 'Bench press'], ['Press banca inclinado', 'Incline bench press'], ['Press banca declinado', 'Decline bench press'],
    ['Press con mancuernas', 'Dumbbell bench press'], ['Press inclinado con mancuernas', 'Incline dumbbell press'],
    ['Aperturas con mancuernas', 'Dumbbell fly'], ['Cruces en polea', 'Cable crossover'], ['Press en máquina', 'Machine chest press'],
    ['Contractora (pec deck)', 'Pec deck'], ['Fondos', 'Dips', 1], ['Flexiones', 'Push-ups', 1]],
  espalda: [['Dominadas', 'Pull-ups', 1], ['Dominadas lastradas', 'Weighted pull-ups', 1], ['Jalón al pecho', 'Lat pulldown'],
    ['Remo con barra', 'Barbell row'], ['Remo con mancuerna', 'Dumbbell row'], ['Remo en polea', 'Seated cable row'],
    ['Remo en máquina', 'Machine row'], ['Peso muerto', 'Deadlift'], ['Pullover en polea', 'Cable pullover'],
    ['Hiperextensiones', 'Back extensions', 1]],
  piernas: [['Sentadilla', 'Squat'], ['Sentadilla frontal', 'Front squat'], ['Sentadilla búlgara', 'Bulgarian split squat'],
    ['Sentadilla goblet', 'Goblet squat'], ['Prensa', 'Leg press'], ['Peso muerto rumano', 'Romanian deadlift'], ['Zancadas', 'Lunges'],
    ['Extensión de cuádriceps', 'Leg extension'], ['Curl femoral', 'Leg curl'], ['Hip thrust', 'Hip thrust'],
    ['Elevación de gemelos', 'Calf raise'], ['Abductores en máquina', 'Hip abduction machine']],
  hombros: [['Press militar', 'Overhead press'], ['Press de hombros con mancuernas', 'Dumbbell shoulder press'],
    ['Elevaciones laterales', 'Lateral raise'], ['Pájaros', 'Rear delt fly'], ['Face pull', 'Face pull'], ['Encogimientos', 'Shrugs'],
    ['Remo al mentón', 'Upright row']],
  brazos: [['Curl bíceps', 'Barbell curl'], ['Curl con mancuernas', 'Dumbbell curl'], ['Curl martillo', 'Hammer curl'],
    ['Curl en polea', 'Cable curl'], ['Curl predicador', 'Preacher curl'], ['Extensión de tríceps en polea', 'Triceps pushdown'],
    ['Press francés', 'Skull crusher'], ['Extensión de tríceps sobre la cabeza', 'Overhead triceps extension'],
    ['Fondos en banco', 'Bench dips', 1]],
  core: [['Crunch', 'Crunch', 1], ['Elevación de piernas', 'Leg raise', 1], ['Rueda abdominal', 'Ab wheel rollout', 1],
    ['Crunch en polea', 'Cable crunch'], ['Russian twist', 'Russian twist'], ['Pallof press', 'Pallof press']],
  cardio: [],
};

const key = (s) => String(s).toLocaleLowerCase('es').trim();
export const norm = (s) => key(s).normalize('NFD').replace(/[̀-ͯ]/g, '');

const INDEX = new Map();
for (const [cat, list] of Object.entries(LIBRARY)) {
  for (const [es, en, bw] of list) INDEX.set(key(es), { name: es, en, cat, bw: Boolean(bw), custom: false });
}

let custom = new Map(); // ejercicios propios del grupo abierto

/** Ejercicios creados por el grupo (pestaña _ejercicios). Se llama al abrir cada grupo. */
export function setCustomExercises(list) {
  custom = new Map();
  for (const c of list) {
    const k = key(c.name);
    if (!k || INDEX.has(k)) continue;
    custom.set(k, { name: c.name.trim(), en: '', cat: CATEGORIES.some((x) => x.id === c.cat) ? c.cat : 'otros', bw: false, custom: true });
  }
}

export function exerciseInfo(name) {
  const k = key(name);
  return INDEX.get(k) || custom.get(k) || { name, en: '', cat: 'otros', bw: false, custom: true };
}
export const categoryOf = (name) => CATEGORIES.find((c) => c.id === exerciseInfo(name).cat);

/** Nombre para mostrar en el idioma actual. */
export function exName(name) {
  const info = exerciseInfo(name);
  return getLang() === 'en' && info.en ? info.en : info.name;
}

/** Biblioteca + propios del grupo + nombres que aparezcan en los registros. */
export function allExercises(usedNames = []) {
  const out = new Map([...INDEX, ...custom]);
  for (const n of usedNames) {
    const k = key(n);
    if (k && !out.has(k)) out.set(k, { name: n, en: '', cat: 'otros', bw: false, custom: true });
  }
  return [...out.values()];
}

/** ¿Coincide con la búsqueda en cualquiera de los dos idiomas? */
export const matches = (e, q) => !q || norm(e.name).includes(q) || (e.en && norm(e.en).includes(q));

/** ¿Ya existe un ejercicio con este nombre (en cualquier idioma)? Devuelve el nombre canónico. */
export function findExisting(name, usedNames = []) {
  const q = norm(name);
  return allExercises(usedNames).find((e) => norm(e.name) === q || (e.en && norm(e.en) === q))?.name || null;
}
