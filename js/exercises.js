// Exercise library by muscle group, in English and Spanish.
// The sheet always stores the library's English name (or the name as typed for custom exercises),
// so a group whose members use different languages shares the same data. Never rename an existing
// English name: logged sets refer to it.
//
// Spanish names are what you'd hear in a gym in Spain, so many stay in English (Hip thrust, Face pull…).
// Aliases (comma-separated, either language) make search find gym slang and abbreviations.
import { getLang } from './i18n.js';

export const CATEGORIES = [
  { id: 'chest', words: 'pectoral, pectorales', en: 'Chest', es: 'Pecho', color: '#EB5757' },
  { id: 'back', words: 'dorsal, dorsales, espalda', en: 'Back', es: 'Espalda', color: '#5B8DEF' },
  { id: 'shoulders', words: 'deltoides, hombro', en: 'Shoulders', es: 'Hombros', color: '#F2994A' },
  { id: 'biceps', words: 'biceps, brazo, brazos', en: 'Biceps', es: 'Bíceps', color: '#9B51E0' },
  { id: 'triceps', words: 'triceps, brazo, brazos', en: 'Triceps', es: 'Tríceps', color: '#D46BD9' },
  { id: 'forearms', words: 'antebrazos, agarre, grip', en: 'Forearms', es: 'Antebrazo', color: '#8C7AE6' },
  { id: 'quads', words: 'pierna, piernas, cuadriceps, legs', en: 'Quads', es: 'Cuádriceps', color: '#27AE60' },
  { id: 'hamstrings', words: 'femoral, femorales, isquiotibiales, pierna, piernas, legs', en: 'Hamstrings', es: 'Isquios', color: '#1A9C8C' },
  { id: 'glutes', words: 'gluteo, gluteos, culo, pierna', en: 'Glutes', es: 'Glúteos', color: '#E056A0' },
  { id: 'calves', words: 'gemelo, pantorrilla, pantorrillas, soleo', en: 'Calves', es: 'Gemelos', color: '#7BC96F' },
  { id: 'core', words: 'abdominales, abs, abdomen, oblicuos, six pack', en: 'Core', es: 'Core', color: '#2DCCD3' },
  { id: 'fullbody', words: 'halterofilia, crossfit, olimpico, funcional', en: 'Full body', es: 'Cuerpo completo', color: '#F2C94C' },
  { id: 'cardio', words: '', en: 'Cardio', es: 'Cardio', color: '#F28B82' },
  { id: 'other', words: '', en: 'Other', es: 'Otros', color: '#8A8A93' },
];
// Categories from the first version of the library, still found in older custom exercises.
const LEGACY_CATEGORY = { legs: 'quads', arms: 'biceps' };
export const catLabel = (c) => c[getLang()] || c.en;

const BW = 1; // bodyweight: 0 kg means no added weight
const ASSIST = 2; // machine-assisted: weight is the help, stored negative (−20 kg = 20 kg of help)

// [English (stored id), Spanish, aliases, BW | ASSIST]
const LIBRARY = {
  chest: [
    ['Bench press', 'Press banca', 'press de banca, press plano, bench'],
    ['Incline bench press', 'Press banca inclinado', 'press inclinado con barra'],
    ['Decline bench press', 'Press banca declinado', 'press declinado con barra'],
    ['Dumbbell bench press', 'Press con mancuernas', 'press plano con mancuernas, press banca mancuernas'],
    ['Incline dumbbell press', 'Press inclinado con mancuernas'],
    ['Decline dumbbell press', 'Press declinado con mancuernas'],
    ['Smith machine bench press', 'Press banca en multipower', 'smith'],
    ['Incline Smith machine press', 'Press inclinado en multipower', 'smith'],
    ['Floor press', 'Floor press', 'press en el suelo'],
    ['Machine chest press', 'Press de pecho en máquina', 'press en máquina'],
    ['Incline machine press', 'Press inclinado en máquina'],
    ['Dumbbell fly', 'Aperturas con mancuernas', 'aperturas planas, fly'],
    ['Incline dumbbell fly', 'Aperturas inclinadas con mancuernas'],
    ['Cable crossover', 'Cruce de poleas', 'crossover, cruces en polea'],
    ['Low-to-high cable fly', 'Cruce de poleas de abajo arriba', 'crossover bajo'],
    ['High-to-low cable fly', 'Cruce de poleas de arriba abajo', 'crossover alto'],
    ['Pec deck', 'Pec deck (contractora)', 'contractora, peck deck, mariposa, butterfly'],
    ['Dumbbell pullover', 'Pullover con mancuerna', 'pullover'],
    ['Svend press', 'Svend press'],
    ['Dips', 'Fondos', 'fondos en paralelas', BW],
    ['Weighted dips', 'Fondos lastrados', 'fondos con lastre', BW],
    ['Assisted dips', 'Fondos asistidos', 'máquina de fondos, asistida, gravitron', ASSIST],
    ['Push-ups', 'Flexiones', 'push ups, lagartijas', BW],
    ['Incline push-ups', 'Flexiones inclinadas', '', BW],
    ['Decline push-ups', 'Flexiones declinadas', '', BW],
    ['Wide-grip bench press', 'Press banca agarre abierto'],
    ['Paused bench press', 'Press banca con pausa'],
    ['Spoto press', 'Spoto press'],
    ['Larsen press', 'Larsen press'],
    ['Dumbbell squeeze press', 'Squeeze press con mancuernas', 'press squeeze con mancuernas, press hex'],
    ['Decline machine press', 'Press declinado en máquina'],
    ['Hammer Strength chest press', 'Press de pecho Hammer', 'hammer'],
    ['Seated cable chest press', 'Press de pecho en polea'],
    ['Single-arm cable fly', 'Cruce de poleas a una mano'],
    ['Decline dumbbell fly', 'Aperturas declinadas con mancuernas'],
    ['Weighted push-ups', 'Flexiones lastradas', '', BW],
    ['Archer push-ups', 'Flexiones arquero', '', BW],
    ['Plyometric push-ups', 'Flexiones pliométricas', 'flexiones con palmada', BW],
  ],
  back: [
    ['Deadlift', 'Peso muerto', 'muerto, convencional'],
    ['Sumo deadlift', 'Peso muerto sumo'],
    ['Trap bar deadlift', 'Peso muerto con barra hexagonal', 'hex bar, barra hexagonal'],
    ['Deficit deadlift', 'Peso muerto con déficit'],
    ['Rack pull', 'Rack pull', 'peso muerto desde soportes'],
    ['Pull-ups', 'Dominadas', 'pull ups, dominadas pronas', BW],
    ['Weighted pull-ups', 'Dominadas lastradas', 'dominadas con lastre', BW],
    ['Chin-ups', 'Dominadas supinas', 'chin ups', BW],
    ['Neutral-grip pull-ups', 'Dominadas agarre neutro', '', BW],
    ['Assisted pull-ups', 'Dominadas asistidas', 'máquina de dominadas, asistida, gravitron', ASSIST],
    ['Assisted chin-ups', 'Dominadas supinas asistidas', 'asistida, gravitron', ASSIST],
    ['Band-assisted pull-ups', 'Dominadas con banda', 'banda elástica, asistida', BW],
    ['Lat pulldown', 'Jalón al pecho', 'polea al pecho, dorsal, jalón'],
    ['Close-grip lat pulldown', 'Jalón agarre estrecho', 'jalón triángulo'],
    ['Reverse-grip lat pulldown', 'Jalón supino', 'jalón agarre supino'],
    ['Single-arm lat pulldown', 'Jalón a una mano'],
    ['Cable pullover', 'Pullover en polea', 'jalón con brazos rectos, straight arm pulldown'],
    ['Barbell row', 'Remo con barra', 'remo inclinado'],
    ['Pendlay row', 'Remo Pendlay'],
    ['Yates row', 'Remo Yates', 'remo supino con barra'],
    ['Dumbbell row', 'Remo con mancuerna', 'remo a una mano'],
    ['Kroc row', 'Remo Kroc'],
    ['Seal row', 'Seal row', 'remo en banco'],
    ['Chest-supported row', 'Remo con apoyo en pecho', 'remo en banco inclinado'],
    ['T-bar row', 'Remo en T', 'remo t'],
    ['Landmine row', 'Remo landmine', 'remo en mina'],
    ['Meadows row', 'Remo Meadows'],
    ['Seated cable row', 'Remo en polea baja', 'remo gironda, gironda, remo en polea'],
    ['Single-arm cable row', 'Remo a una mano en polea'],
    ['Machine row', 'Remo en máquina'],
    ['Inverted row', 'Remo invertido', 'remo australiano', BW],
    ['Back extensions', 'Hiperextensiones', 'lumbares, extensiones lumbares', BW],
    ['Shrugs', 'Shrugs con barra', 'encogimientos con barra, trapecio, encogimientos de hombros'],
    ['Dumbbell shrugs', 'Shrugs con mancuernas', 'encogimientos con mancuernas, trapecio'],
    ['Snatch-grip deadlift', 'Peso muerto agarre de arrancada'],
    ['Wide-grip pull-ups', 'Dominadas agarre ancho', '', BW],
    ['Muscle-ups', 'Muscle-ups', '', BW],
    ['Wide-grip lat pulldown', 'Jalón agarre ancho'],
    ['Behind-the-neck lat pulldown', 'Jalón tras nuca'],
    ['Machine lat pulldown', 'Jalón en máquina'],
    ['Machine pullover', 'Pullover en máquina'],
    ['Incline dumbbell row', 'Remo inclinado con mancuernas'],
    ['Helms row', 'Remo Helms'],
    ['Wide-grip cable row', 'Remo en polea agarre ancho'],
    ['High row machine', 'Remo alto en máquina'],
    ['Iso-lateral row', 'Remo Hammer', 'remo iso lateral, hammer'],
    ['Smith machine row', 'Remo en multipower', 'smith'],
    ['Smith machine shrugs', 'Shrugs en multipower', 'encogimientos en multipower, trapecio, smith'],
    ['Machine back extension', 'Extensión lumbar en máquina', 'lumbares'],
    ['Superman', 'Superman', 'lumbares', BW],
    ['Jefferson curl', 'Jefferson curl'],
  ],
  shoulders: [
    ['Overhead press', 'Press militar', 'ohp, press de hombros con barra, press militar de pie'],
    ['Seated overhead press', 'Press militar sentado'],
    ['Behind-the-neck press', 'Press tras nuca'],
    ['Push press', 'Push press'],
    ['Dumbbell shoulder press', 'Press de hombros con mancuernas', 'press militar con mancuernas'],
    ['Arnold press', 'Press Arnold'],
    ['Machine shoulder press', 'Press de hombros en máquina'],
    ['Smith machine shoulder press', 'Press militar en multipower', 'smith'],
    ['Landmine press', 'Press landmine', 'press en mina'],
    ['Lateral raise', 'Elevaciones laterales', 'laterales, vuelos laterales'],
    ['Cable lateral raise', 'Elevaciones laterales en polea'],
    ['Machine lateral raise', 'Elevaciones laterales en máquina'],
    ['Front raise', 'Elevaciones frontales', 'frontales'],
    ['Rear delt fly', 'Pájaros', 'pájaros con mancuernas, deltoides posterior, reverse fly'],
    ['Reverse pec deck', 'Pec deck inverso', 'contractora inversa, pec deck inverso, deltoides posterior'],
    ['Cable rear delt fly', 'Pájaros en polea', 'cruce inverso'],
    ['Face pull', 'Face pull', 'jalón a la cara'],
    ['Upright row', 'Remo al mentón', 'remo al cuello'],
    ['Y-raise', 'Y-raise', 'elevaciones en y'],
    ['Cuban press', 'Cuban press', 'press cubano'],
    ['Pike push-ups', 'Flexiones pike', '', BW],
    ['Handstand push-ups', 'Flexiones en pino', 'hspu', BW],
    ['Z press', 'Z press', 'press sentado en el suelo'],
    ['Single-arm dumbbell press', 'Press de hombro a una mano'],
    ['Lu raise', 'Lu raise', 'elevaciones lu'],
    ['Cable front raise', 'Elevaciones frontales en polea'],
    ['Plate front raise', 'Elevación frontal con disco', 'disco'],
    ['Cable upright row', 'Remo al mentón en polea'],
    ['External rotation', 'Rotación externa', 'manguito rotador, rotadores'],
    ['Band pull-apart', 'Band pull-apart', 'aperturas con banda, banda elástica', BW],
  ],
  biceps: [
    ['Barbell curl', 'Curl con barra', 'curl bíceps, curl de pie'],
    ['EZ-bar curl', 'Curl con barra Z', 'barra z'],
    ['Dumbbell curl', 'Curl con mancuernas', 'curl alterno'],
    ['Hammer curl', 'Curl martillo'],
    ['Incline dumbbell curl', 'Curl inclinado con mancuernas'],
    ['Preacher curl', 'Curl predicador (Scott)', 'banco scott, curl scott'],
    ['Concentration curl', 'Curl concentrado'],
    ['Cable curl', 'Curl en polea'],
    ['Rope hammer curl', 'Curl martillo en polea con cuerda'],
    ['Bayesian curl', 'Curl bayesiano'],
    ['Spider curl', 'Spider curl', 'curl araña'],
    ['Drag curl', 'Drag curl'],
    ['Machine curl', 'Curl en máquina'],
    ['21s', 'Curl 21', 'veintiunos'],
    ['Zottman curl', 'Curl Zottman'],
    ['Cross-body hammer curl', 'Curl martillo cruzado'],
    ['Dumbbell preacher curl', 'Curl predicador con mancuerna', 'scott'],
    ['High cable curl', 'Curl en polea alta', 'curl doble bíceps'],
    ['Seated dumbbell curl', 'Curl sentado con mancuernas'],
  ],
  triceps: [
    ['Close-grip bench press', 'Press banca agarre cerrado', 'press cerrado'],
    ['Skull crusher', 'Press francés', 'rompecráneos, skull crusher'],
    ['Triceps pushdown', 'Tríceps en polea', 'jalón de tríceps, pushdown, extensión de tríceps en polea'],
    ['Rope pushdown', 'Tríceps en polea con cuerda', 'cuerda'],
    ['Single-arm cable pushdown', 'Tríceps en polea a una mano'],
    ['Overhead triceps extension', 'Extensión de tríceps tras nuca', 'tras nuca, francés con mancuerna'],
    ['Overhead cable extension', 'Extensión tras nuca en polea'],
    ['Dumbbell kickback', 'Patada de tríceps', 'kickback'],
    ['JM press', 'JM press'],
    ['Tate press', 'Tate press'],
    ['Machine dips', 'Fondos en máquina'],
    ['Bench dips', 'Fondos en banco', '', BW],
    ['Diamond push-ups', 'Flexiones diamante', 'flexiones cerradas', BW],
    ['Dumbbell skull crusher', 'Press francés con mancuernas', 'rompecráneos'],
    ['V-bar pushdown', 'Tríceps en polea con barra V'],
    ['Reverse-grip pushdown', 'Tríceps en polea agarre supino'],
    ['Cable kickback (triceps)', 'Patada de tríceps en polea'],
    ['Machine triceps extension', 'Extensión de tríceps en máquina'],
  ],
  forearms: [
    ['Wrist curl', 'Curl de muñeca', 'antebrazo'],
    ['Reverse wrist curl', 'Curl de muñeca invertido'],
    ['Reverse curl', 'Curl invertido', 'curl prono'],
    ['Wrist roller', 'Wrist roller', 'rodillo de muñeca'],
    ['Behind-the-back wrist curl', 'Curl de muñeca tras la espalda'],
    ['Hand gripper', 'Hand gripper', 'pinza de mano, grip, agarre', BW],
  ],
  quads: [
    ['Squat', 'Sentadilla', 'sentadilla trasera, back squat'],
    ['Front squat', 'Sentadilla frontal'],
    ['Pause squat', 'Sentadilla con pausa'],
    ['Box squat', 'Sentadilla al cajón'],
    ['Zercher squat', 'Sentadilla Zercher'],
    ['Goblet squat', 'Sentadilla goblet', 'sentadilla copa'],
    ['Smith machine squat', 'Sentadilla en multipower', 'smith'],
    ['Hack squat', 'Sentadilla hack', 'hack, jaca'],
    ['Pendulum squat', 'Sentadilla péndulo', 'péndulo'],
    ['Belt squat', 'Belt squat', 'sentadilla con cinturón'],
    ['Bulgarian split squat', 'Sentadilla búlgara', 'búlgaras'],
    ['Leg press', 'Prensa', 'prensa de piernas'],
    ['Single-leg leg press', 'Prensa a una pierna'],
    ['Leg extension', 'Extensión de cuádriceps', 'extensiones, cuádriceps en máquina'],
    ['Lunges', 'Zancadas', 'estocadas, lunges'],
    ['Walking lunges', 'Zancadas caminando', 'estocadas caminando'],
    ['Reverse lunges', 'Zancadas hacia atrás'],
    ['Step-ups', 'Step-ups', 'subidas al cajón, step up'],
    ['Sissy squat', 'Sissy squat', '', BW],
    ['Pistol squat', 'Sentadilla pistol', 'pistol', BW],
    ['Safety bar squat', 'Sentadilla con barra safety', 'ssb'],
    ['Cyclist squat', 'Sentadilla ciclista'],
    ['Spanish squat', 'Sentadilla española'],
    ['Split squat', 'Sentadilla split', 'zancada estática'],
    ['Lateral lunge', 'Zancada lateral', 'sentadilla cosaca'],
    ['Horizontal leg press', 'Prensa horizontal'],
    ['V-squat machine', 'Sentadilla en V', 'v squat'],
    ['Single-leg extension', 'Extensión de cuádriceps a una pierna'],
    ['Reverse Nordic', 'Reverse Nordic', 'nórdico inverso', BW],
    ['Jump squats', 'Sentadillas con salto', '', BW],
    ['Air squats', 'Air squats', 'sentadillas sin peso, sentadillas libres', BW],
  ],
  hamstrings: [
    ['Romanian deadlift', 'Peso muerto rumano', 'rdl, rumano'],
    ['Dumbbell Romanian deadlift', 'Peso muerto rumano con mancuernas', 'rdl'],
    ['Single-leg Romanian deadlift', 'Peso muerto rumano a una pierna', 'rdl'],
    ['Stiff-leg deadlift', 'Peso muerto con piernas rígidas', 'piernas rígidas'],
    ['Good morning', 'Good morning', 'buenos días'],
    ['Leg curl', 'Curl femoral', 'femoral'],
    ['Lying leg curl', 'Curl femoral tumbado', 'femoral tumbado'],
    ['Seated leg curl', 'Curl femoral sentado', 'femoral sentado'],
    ['Nordic curl', 'Curl nórdico', 'nórdicos', BW],
    ['Glute-ham raise', 'Glute ham raise', 'ghr', BW],
    ['Standing leg curl', 'Curl femoral de pie'],
    ['Stability ball leg curl', 'Curl femoral con fitball', 'fitball', BW],
    ['Kettlebell Romanian deadlift', 'Peso muerto rumano con kettlebell', 'rdl, pesa rusa'],
  ],
  glutes: [
    ['Hip thrust', 'Hip thrust', 'empuje de cadera'],
    ['Smith machine hip thrust', 'Hip thrust en multipower', 'smith'],
    ['Machine hip thrust', 'Hip thrust en máquina'],
    ['Single-leg hip thrust', 'Hip thrust a una pierna'],
    ['Glute bridge', 'Puente de glúteo', 'puente'],
    ['Cable kickback', 'Patada de glúteo en polea', 'kickback'],
    ['Glute kickback machine', 'Patada de glúteo en máquina'],
    ['Cable pull-through', 'Pull-through en polea'],
    ['Sumo squat', 'Sentadilla sumo'],
    ['Reverse hyperextension', 'Hiperextensión inversa'],
    ['Hip abduction machine', 'Abductores en máquina', 'abductor'],
    ['Hip adduction machine', 'Aductores en máquina', 'aductor'],
    ['Frog pumps', 'Frog pumps', '', BW],
    ['B-stance hip thrust', 'B-stance hip thrust', 'hip thrust en b'],
    ['Single-leg glute bridge', 'Puente de glúteo a una pierna'],
    ['Cable hip abduction', 'Abducción de cadera en polea', 'abductor en polea'],
    ['Curtsy lunge', 'Zancada cruzada', 'reverencia'],
    ['Banded lateral walk', 'Monster walk', 'pasos laterales con banda, monster walk, banda', BW],
    ['Fire hydrants', 'Fire hydrants', 'patada lateral en cuadrupedia', BW],
    ['Donkey kicks', 'Patada de glúteo en cuadrupedia', 'donkey kicks', BW],
  ],
  calves: [
    ['Calf raise', 'Elevación de gemelos', 'gemelos, pantorrillas'],
    ['Standing calf raise', 'Gemelos de pie'],
    ['Seated calf raise', 'Gemelos sentado', 'sóleo'],
    ['Leg press calf raise', 'Gemelos en prensa'],
    ['Smith machine calf raise', 'Gemelos en multipower', 'smith'],
    ['Tibialis raise', 'Tibialis raise', 'elevación de tibial, tibial'],
    ['Single-leg calf raise', 'Gemelos a una pierna'],
    ['Donkey calf raise', 'Donkey calf raise', 'gemelos burro'],
  ],
  core: [
    ['Crunch', 'Crunch', 'abdominales, encogimientos abdominales', BW],
    ['Decline crunch', 'Crunch declinado', '', BW],
    ['Cable crunch', 'Crunch en polea', 'abdominales en polea'],
    ['Machine crunch', 'Crunch en máquina'],
    ['Bicycle crunch', 'Crunch bicicleta', 'bicicleta', BW],
    ['Sit-ups', 'Sit-ups', 'abdominales completos', BW],
    ['Leg raise', 'Elevación de piernas', '', BW],
    ['Hanging leg raise', 'Elevación de piernas colgado', '', BW],
    ['Hanging knee raise', 'Elevación de rodillas colgado', '', BW],
    ["Captain's chair leg raise", 'Elevación de piernas en silla romana', 'silla romana', BW],
    ['Toes to bar', 'Toes to bar', 't2b', BW],
    ['V-ups', 'V-ups', 'abdominales en v', BW],
    ['Dragon flag', 'Dragon flag', '', BW],
    ['Ab wheel rollout', 'Rueda abdominal', 'rueda', BW],
    ['Russian twist', 'Russian twist', 'giros rusos'],
    ['Pallof press', 'Pallof press', 'antirrotación'],
    ['Cable woodchop', 'Leñador en polea', 'leñador, woodchopper'],
    ['Dumbbell side bend', 'Inclinación lateral con mancuerna', 'oblicuos'],
    ['Dead bug', 'Dead bug', 'bicho muerto', BW],
    ['Mountain climbers', 'Mountain climbers', 'escaladores, mountain climbers', BW],
    ['Reverse crunch', 'Crunch inverso', '', BW],
    ['Oblique crunch', 'Crunch oblicuo', 'oblicuos', BW],
    ['Decline sit-ups', 'Sit-ups declinados', '', BW],
    ['Hanging windshield wipers', 'Limpiaparabrisas', 'windshield wipers', BW],
    ['Landmine rotation', 'Landmine rotation', 'rotación landmine, landmine twist'],
    ['Hollow rocks', 'Hollow rocks', 'balanceo hollow', BW],
    ['Flutter kicks', 'Flutter kicks', 'tijeras, flutter kicks', BW],
    ['Heel taps', 'Heel taps', 'toques de talón, heel taps', BW],
  ],
  fullbody: [
    ['Power clean', 'Cargada de potencia', 'power clean'],
    ['Clean', 'Cargada', 'clean'],
    ['Hang clean', 'Cargada colgante', 'hang clean'],
    ['Snatch', 'Arrancada', 'snatch'],
    ['Power snatch', 'Arrancada de potencia', 'power snatch'],
    ['Clean and jerk', 'Dos tiempos', 'clean and jerk, c&j'],
    ['Push jerk', 'Push jerk', 'envión'],
    ['Split jerk', 'Envión en tijera', 'split jerk'],
    ['Thruster', 'Thruster'],
    ['Overhead squat', 'Overhead squat', 'sentadilla overhead, sentadilla por encima de la cabeza'],
    ['Kettlebell swing', 'Swing con kettlebell', 'swing, pesa rusa'],
    ['Kettlebell snatch', 'Arrancada con kettlebell', 'pesa rusa'],
    ['Kettlebell clean', 'Cargada con kettlebell', 'pesa rusa'],
    ['Turkish get-up', 'Turkish get-up', 'levantamiento turco'],
    ['Renegade row', 'Renegade row', 'remo renegado, renegade row'],
    ['Wall balls', 'Wall balls', 'lanzamientos a la pared'],
    ['Burpees', 'Burpees', '', BW],
    ['Box jumps', 'Saltos al cajón', 'box jump', BW],
    ['Hang power clean', 'Cargada colgante de potencia'],
    ['Hang snatch', 'Arrancada colgante'],
    ['Clean pull', 'Tirón de cargada'],
    ['Snatch pull', 'Tirón de arrancada'],
    ['Sumo deadlift high pull', 'Sumo deadlift high pull', 'tirón sumo al mentón, sdhp'],
    ['Dumbbell snatch', 'Arrancada con mancuerna'],
    ['Dumbbell thruster', 'Thruster con mancuernas'],
    ['Devil press', 'Devil press'],
    ['Medicine ball slam', 'Med ball slam', 'slam con balón medicinal, balón medicinal, slam ball'],
    ['Log press', 'Log press', 'strongman'],
    ['Tire flip', 'Volteo de neumático', 'rueda, strongman'],
    ['Atlas stone', 'Atlas stones', 'piedras atlas, strongman'],
    ['Jumping jacks', 'Jumping jacks', 'saltos de tijera', BW],
    ['Broad jumps', 'Saltos de longitud', '', BW],
    ['Double unders', 'Double unders', 'dobles saltos, comba, double unders', BW],
  ],
  cardio: [],
};

const key = (s) => String(s).toLocaleLowerCase('en').trim();
/** Lowercase, accent-free form for search and duplicate checks. */
export const norm = (s) => key(s).normalize('NFD').replace(/[̀-ͯ]/g, '');

const INDEX = new Map();
for (const [cat, list] of Object.entries(LIBRARY)) {
  for (const [en, es, aliases = '', kind = 0] of list) {
    const tags = aliases.split(',').map((a) => norm(a)).filter(Boolean);
    INDEX.set(key(en), { name: en, es, cat, bw: kind === BW, assisted: kind === ASSIST, custom: false, tags });
  }
}

let custom = new Map(); // custom exercises of the open group

const validCategory = (c) => {
  const id = LEGACY_CATEGORY[c] || c;
  return CATEGORIES.some((x) => x.id === id) ? id : 'other';
};

/** The group's custom exercises (_exercises tab). Called whenever a group is opened. */
export function setCustomExercises(list) {
  custom = new Map();
  for (const c of list) {
    const k = key(c.name);
    if (!k || INDEX.has(k)) continue;
    custom.set(k, { name: c.name.trim(), es: '', cat: validCategory(c.cat), bw: false, custom: true, tags: [] });
  }
}

export function exerciseInfo(name) {
  const k = key(name);
  return INDEX.get(k) || custom.get(k) || { name, es: '', cat: 'other', bw: false, custom: true, tags: [] };
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
    if (k && !out.has(k)) out.set(k, { name: n, es: '', cat: 'other', bw: false, custom: true, tags: [] });
  }
  return [...out.values()];
}

/** Does it match the search in either language, or one of its aliases? `q` must already be normalized. */
export const matches = (e, q) => !q || score(e, q) > 0;

// ---------- fuzzy search ----------
// Word order doesn't matter, words can be partial and small typos are forgiven: "banca press",
// "jal pech" and "sentadila" all find what you meant. Query words may match the exercise's names, its
// aliases or its muscle group ("curl biceps"). Results are ranked: names beat aliases, which beat the
// muscle group, and exercises whose own name is closest to the query come first.

const STOPWORDS = new Set(['de', 'del', 'con', 'en', 'a', 'al', 'la', 'el', 'los', 'las', 'y', 'with', 'the', 'and', 'of', 'on']);
const words = (s) => s.split(/[^a-z0-9]+/).filter((w) => w && !STOPWORDS.has(w));

/** Optimal string alignment distance (Levenshtein + adjacent swaps), stopping early past `max`. */
function distance(a, b, max) {
  if (Math.abs(a.length - b.length) > max) return max + 1;
  let prev2 = null;
  let prev = Array.from({ length: b.length + 1 }, (_, j) => j);
  for (let i = 1; i <= a.length; i++) {
    const cur = [i];
    let rowMin = i;
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      let v = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + cost);
      if (prev2 && i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) v = Math.min(v, prev2[j - 2] + 1);
      cur.push(v);
      rowMin = Math.min(rowMin, v);
    }
    if (rowMin > max) return max + 1;
    prev2 = prev;
    prev = cur;
  }
  return prev[b.length];
}

/** Typos allowed for a query word: none for short words, then 1, then 2. */
const allowed = (w) => (w.length <= 3 ? 0 : w.length <= 6 ? 1 : 2);

/** How well one query word matches one word of the exercise: 1 exact … 0 no match. */
function wordScore(q, w) {
  if (w === q) return 1;
  if (w.startsWith(q)) return 0.9;
  if (q.length >= 3 && w.includes(q)) return 0.7;
  const max = allowed(q);
  if (!max) return 0;
  // Compare against the whole word and against its start, so a misspelt partial word still counts.
  const d = Math.min(distance(q, w, max), w.length > q.length ? distance(q, w.slice(0, q.length), max) : max + 1);
  return d <= max ? 0.6 - 0.1 * d : 0;
}

const NAME = 1, ALIAS = 0.85, GROUP = 0.6; // how much a match counts depending on where it is

/** Match quality of an exercise for a normalized query (0 = no match). */
export function score(e, q) {
  if (!q) return 1;
  const names = [e.name, e.es].filter(Boolean).map(norm);
  const aliases = e.tags || [];
  let best = 0;
  // Whole-text matches: exact, starts with, contains (shorter names rank higher).
  for (const [list, weight] of [[names, NAME], [aliases, ALIAS]]) {
    for (const f of list) {
      const extra = Math.min(20, f.length - q.length);
      if (f === q) best = Math.max(best, 100 * weight);
      else if (f.startsWith(q)) best = Math.max(best, (92 - extra * 0.4) * weight);
      else if (f.includes(q)) best = Math.max(best, (82 - extra * 0.4) * weight);
    }
  }
  // Word by word, across names, aliases and muscle group.
  const qWords = words(q);
  if (!qWords.length) return best;
  const group = CATEGORIES.find((c) => c.id === e.cat);
  const bag = [
    ...names.flatMap((f) => words(f).map((w) => [w, NAME])),
    ...aliases.flatMap((f) => words(f).map((w) => [w, ALIAS])),
    ...(group ? [group.en, group.es, group.words || ''].flatMap((f) => words(norm(f)).map((w) => [w, GROUP])) : []),
  ];
  let total = 0;
  for (const qw of qWords) {
    let s = 0;
    for (const [w, weight] of bag) s = Math.max(s, wordScore(qw, w) * weight);
    if (!s) return best; // every query word must match something
    total += s;
  }
  // Bonus when the query covers most of the exercise's own name: "sentadila" → Sentadilla first.
  const coverage = Math.max(...names.map((f) => {
    const ws = words(f);
    return ws.length ? ws.filter((w) => qWords.some((qw) => wordScore(qw, w) > 0)).length / ws.length : 0;
  }));
  return Math.max(best, 40 + 30 * (total / qWords.length) + 12 * coverage);
}

// The staples most people log: among similar matches they come first ("bench" → Bench press, not Bench dips).
const STAPLES = new Set(['Bench press', 'Squat', 'Deadlift', 'Overhead press', 'Barbell row', 'Pull-ups', 'Chin-ups', 'Lat pulldown',
  'Barbell curl', 'Dumbbell curl', 'Hammer curl', 'Leg press', 'Romanian deadlift', 'Hip thrust', 'Dips', 'Push-ups', 'Leg curl',
  'Leg extension', 'Lateral raise', 'Triceps pushdown', 'Incline dumbbell press', 'Dumbbell bench press', 'Seated cable row',
  'Dumbbell row', 'Lunges']);

/**
 * Exercises matching the query, best first (ties by the given name order).
 * @param {(e) => number} [boost] extra points, e.g. for exercises the person already does
 */
export function search(list, rawQuery, nameOf = (e) => e.name, boost = () => 0) {
  const q = norm(rawQuery);
  return list.map((e) => { const s = score(e, q); return { e, s: s > 0 ? s + (STAPLES.has(e.name) ? 6 : 0) + boost(e) : 0 }; }).filter((x) => x.s > 0)
    .sort((a, b) => b.s - a.s || nameOf(a.e).localeCompare(nameOf(b.e)))
    .map((x) => x.e);
}

/** Is there already an exercise with this name (in either language)? Returns its stored name. */
export function findExisting(name, usedNames = []) {
  const q = norm(name);
  return allExercises(usedNames).find((e) => norm(e.name) === q || (e.es && norm(e.es) === q))?.name || null;
}

export const librarySize = () => INDEX.size;
