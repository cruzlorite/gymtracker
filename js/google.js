// Todo lo que habla con Google: login, Drive, Sheets y el selector de archivos (Picker).
// No hay servidor: el navegador usa el token del propio usuario contra las APIs de Google.
import { CONFIG } from '../config.js';
import { isISODate, todayISO, toISO } from './stats.js';

const SCOPE_FILE = 'https://www.googleapis.com/auth/drive.file';
const SCOPES = `${SCOPE_FILE} openid email profile`;
const SHEETS = 'https://sheets.googleapis.com/v4/spreadsheets';
const DRIVE = 'https://www.googleapis.com/drive/v3/files';

export const TITLE_PREFIX = 'GymTracker · ';
export const TAB = { group: '_grupo', members: '_miembros', challenges: '_retos' };
const HEADERS = {
  group: ['clave', 'valor'],
  members: ['email', 'nombre', 'foto', 'alta'],
  challenges: ['id', 'titulo', 'tipo', 'ejercicio', 'inicio', 'fin', 'creado_por'],
  entries: ['id', 'fecha', 'ejercicio', 'series', 'reps', 'kg', 'notas'],
};
const SCHEMA_VERSION = 1;

export class AuthError extends Error {
  constructor() { super('Tu sesión de Google ha caducado.'); this.name = 'AuthError'; }
}

export const isConfigured = () => Boolean(CONFIG.CLIENT_ID);
export const sheetUrl = (id) => `https://docs.google.com/spreadsheets/d/${id}/edit`;

// ---------- carga de scripts de Google ----------
const scripts = {};
function loadScript(src) {
  return (scripts[src] ||= new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = src; s.async = true;
    s.onload = () => resolve();
    s.onerror = () => { delete scripts[src]; reject(new Error('No se pudo cargar un script de Google. ¿Hay conexión?')); };
    document.head.appendChild(s);
  }));
}
export const loadGis = () => loadScript('https://accounts.google.com/gsi/client');
export const loadPicker = () =>
  loadScript('https://apis.google.com/js/api.js').then(() => new Promise((r) => window.gapi.load('picker', r)));

// ---------- login ----------
let token = null;
let tokenExp = 0;
const HINT_KEY = 'gt:hint';
const lsGet = (k) => { try { return localStorage.getItem(k); } catch { return null; } };
const lsSet = (k, v) => { try { v == null ? localStorage.removeItem(k) : localStorage.setItem(k, v); } catch { /* sin storage */ } };
export const savedHint = () => lsGet(HINT_KEY) || '';

/** Abre el popup de Google. Hay que llamarla directamente desde un clic. */
export function signIn() {
  return new Promise((resolve, reject) => {
    const oauth = window.google?.accounts?.oauth2;
    if (!oauth) return reject(new Error('El login de Google aún está cargando. Prueba de nuevo en un segundo.'));
    const client = oauth.initTokenClient({
      client_id: CONFIG.CLIENT_ID,
      scope: SCOPES,
      callback: (r) => {
        if (r.error) return reject(new Error(r.error_description || r.error));
        if (!oauth.hasGrantedAllScopes(r, SCOPE_FILE)) {
          return reject(new Error('Hace falta el permiso de Google Drive para guardar los entrenos en tu hoja.'));
        }
        token = r.access_token;
        tokenExp = Date.now() + (Number(r.expires_in || 3600) - 60) * 1000;
        resolve();
      },
      error_callback: (e) => reject(new Error(
        e?.type === 'popup_closed' ? 'Has cerrado la ventana de Google.'
          : e?.type === 'popup_failed_to_open' ? 'El navegador ha bloqueado la ventana de Google. Permite las ventanas emergentes.'
            : 'No se pudo iniciar sesión con Google.')),
    });
    const hint = savedHint();
    client.requestAccessToken(hint ? { prompt: '', login_hint: hint } : { prompt: '' });
  });
}

export function signOut() {
  token = null; tokenExp = 0;
  lsSet(HINT_KEY, null);
}

async function api(url, { method = 'GET', body, query } = {}) {
  if (!token || Date.now() > tokenExp) throw new AuthError();
  const u = new URL(url);
  for (const [k, v] of Object.entries(query || {})) u.searchParams.set(k, v);
  const res = await fetch(u, {
    method,
    headers: { Authorization: `Bearer ${token}`, ...(body ? { 'Content-Type': 'application/json' } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (res.status === 401) throw new AuthError();
  if (!res.ok) {
    let msg = '';
    try { msg = (await res.json()).error?.message || ''; } catch { /* sin cuerpo */ }
    const err = new Error(msg || `Google respondió con un error (${res.status}).`);
    err.status = res.status;
    throw err;
  }
  return res.status === 204 ? null : res.json();
}

export async function getProfile() {
  const p = await api('https://www.googleapis.com/oauth2/v3/userinfo');
  lsSet(HINT_KEY, p.email);
  return { email: p.email.toLowerCase(), name: p.name || p.email.split('@')[0], picture: p.picture || '' };
}

/**
 * Selector de archivos de Google. Al elegir la hoja, Google le da permiso a la app
 * (scope drive.file) sobre ese archivo concreto. Devuelve el id o null si se cancela.
 */
export async function pickSheet(fileId) {
  await loadPicker();
  const P = window.google.picker;
  return new Promise((resolve) => {
    const view = new P.DocsView(P.ViewId.SPREADSHEETS).setMode(P.DocsViewMode.LIST).setIncludeFolders(false);
    if (fileId) view.setFileIds(fileId);
    const b = new P.PickerBuilder()
      .addView(view)
      .setOAuthToken(token)
      .setDeveloperKey(CONFIG.API_KEY)
      .setTitle(fileId ? 'Selecciona la hoja del grupo para unirte' : 'Elige la hoja del grupo')
      .setCallback((d) => {
        if (d.action === P.Action.PICKED) resolve(d.docs[0].id);
        else if (d.action === P.Action.CANCEL) resolve(null);
      });
    if (CONFIG.APP_ID) b.setAppId(CONFIG.APP_ID);
    b.build().setVisible(true);
  });
}

// ---------- utilidades de Sheets ----------
const quote = (tab) => `'${tab.replace(/'/g, "''")}'`;
const enc = encodeURIComponent;

function append(id, tab, rows) {
  return api(`${SHEETS}/${id}/values/${enc(`${quote(tab)}!A1`)}:append`, {
    method: 'POST',
    query: { valueInputOption: 'RAW', insertDataOption: 'INSERT_ROWS' },
    body: { values: rows },
  });
}

/** Fechas: si alguien escribe a mano en la hoja, Sheets puede convertirlas en número de serie. */
function normDate(v) {
  if (typeof v === 'number') return toISO(new Date(Date.UTC(1899, 11, 30) + v * 864e5 + new Date().getTimezoneOffset() * 6e4));
  return String(v ?? '').trim().slice(0, 10);
}
const num = (v) => {
  if (typeof v === 'number') return v;
  const n = parseFloat(String(v ?? '').replace(',', '.'));
  return Number.isFinite(n) ? n : 0;
};
const CH_TYPES = new Set(['asistencia', 'volumen', 'mejora']);

/** Solo fotos de perfil de Google: una URL arbitraria en _miembros revelaría la IP de quien abre la app. */
function safePicture(v) {
  try {
    const u = new URL(String(v || ''));
    return u.protocol === 'https:' && u.hostname.endsWith('.googleusercontent.com') ? u.href : '';
  } catch { return ''; }
}

const isWholeSheet = (r = {}, sheetId) => (r.sheetId ?? 0) === sheetId
  && r.startRowIndex == null && r.endRowIndex == null && r.startColumnIndex == null && r.endColumnIndex == null;

/**
 * ¿La pestaña es de quien dice su título? Cualquier editor puede crear una pestaña con el email de
 * otro, pero los editores de una protección solo los ven el dueño de la hoja y quien puede editarla.
 * true = verificada · false = sin proteger o suplantada · null = no se puede comprobar desde esta cuenta.
 */
function tabOwnership(tab, ownerEmail) {
  const email = tab.title.toLowerCase();
  const whole = tab.protectedRanges.filter((p) => isWholeSheet(p.range, tab.sheetId));
  if (!whole.length) return false;
  const visible = whole.filter((p) => p.editors);
  if (!visible.length) return null;
  return visible.some(({ editors: ed }) => {
    const users = (ed.users || []).map((u) => u.toLowerCase());
    return users.includes(email) && users.every((u) => u === email || u === ownerEmail)
      && !ed.groups?.length && !ed.domainUsersCanEdit;
  });
}

// ---------- almacenamiento en Google Sheets ----------
export class SheetStore {
  kind = 'google';

  constructor(me) { this.me = me; }

  async listGroups() {
    const q = `appProperties has { key='app' and value='${CONFIG.APP_TAG}' } and trashed=false`;
    const r = await api(DRIVE, {
      query: { q, pageSize: 100, orderBy: 'modifiedTime desc', fields: 'files(id,name,ownedByMe,owners(displayName))' },
    });
    return (r.files || []).map((f) => ({
      id: f.id,
      name: f.name.startsWith(TITLE_PREFIX) ? f.name.slice(TITLE_PREFIX.length) : f.name,
      owner: f.ownedByMe ? null : f.owners?.[0]?.displayName || null,
    }));
  }

  async createGroup(name) {
    const ss = await api(SHEETS, {
      method: 'POST',
      body: {
        properties: { title: TITLE_PREFIX + name },
        sheets: [TAB.group, TAB.members, TAB.challenges].map((title) => ({ properties: { title } })),
      },
    });
    const id = ss.spreadsheetId;
    const groupSheetId = ss.sheets.find((s) => s.properties.title === TAB.group).properties.sheetId;
    await api(`${SHEETS}/${id}/values:batchUpdate`, {
      method: 'POST',
      body: {
        valueInputOption: 'RAW',
        data: [
          { range: `${TAB.group}!A1`, values: [HEADERS.group, ['version', SCHEMA_VERSION], ['app', CONFIG.APP_TAG]] },
          { range: `${TAB.members}!A1`, values: [HEADERS.members] },
          { range: `${TAB.challenges}!A1`, values: [HEADERS.challenges] },
        ],
      },
    });
    await api(`${SHEETS}/${id}:batchUpdate`, {
      method: 'POST',
      body: { requests: [{ addProtectedRange: { protectedRange: {
        range: { sheetId: groupSheetId }, description: 'Configuración del grupo', editors: { users: [this.me.email] },
      } } }] },
    });
    // Marca invisible para encontrar las hojas de la app sin escanear todo el Drive.
    // writersCanShare: solo quien crea el grupo puede compartir la hoja con más gente.
    await api(`${DRIVE}/${id}`, { method: 'PATCH', body: { appProperties: { app: CONFIG.APP_TAG }, writersCanShare: false } });
    await this.join(id);
    return id;
  }

  async tabs(id) {
    const fields = 'properties.title,sheets(properties(sheetId,title),protectedRanges(range,editors,requestingUserCanEdit))';
    const r = await api(`${SHEETS}/${id}`, { query: { fields } });
    return { title: r.properties.title, tabs: r.sheets.map((s) => ({ ...s.properties, protectedRanges: s.protectedRanges || [] })) };
  }

  file(id) {
    return api(`${DRIVE}/${id}`, { query: { fields: 'ownedByMe,writersCanShare,owners(displayName,emailAddress),capabilities(canShare)' } });
  }

  /** Crea la pestaña del usuario (protegida: solo la edita él) y lo apunta en _miembros. */
  async join(id) {
    const me = this.me;
    const [{ tabs }, file] = await Promise.all([this.tabs(id), this.file(id)]);
    if (!tabs.some((t) => t.title === TAB.members)) throw new Error('Esa hoja no es un grupo de GymTracker.');
    const mine = tabs.find((t) => t.title.toLowerCase() === me.email);
    if (mine && tabOwnership(mine, file.owners?.[0]?.emailAddress?.toLowerCase()) !== true) {
      throw new Error(file.ownedByMe
        ? `La pestaña «${mine.title}» no la ha creado esta app para ti. Bórrala desde la hoja y vuelve a unirte.`
        : `Alguien ha creado una pestaña con tu email que no puedes controlar. Pide a ${file.owners?.[0]?.displayName || 'quien creó el grupo'} que la borre de la hoja y vuelve a intentarlo.`);
    }
    if (!mine) {
      const sheetId = 1 + Math.floor(Math.random() * 2e9);
      await api(`${SHEETS}/${id}:batchUpdate`, {
        method: 'POST',
        body: { requests: [
          { addSheet: { properties: { sheetId, title: me.email } } },
          { addProtectedRange: { protectedRange: {
            range: { sheetId }, description: `Entrenos de ${me.name}: solo los edita su dueño`, editors: { users: [me.email] },
          } } },
        ] },
      });
      await api(`${SHEETS}/${id}/values/${enc(`${quote(me.email)}!A1`)}`, {
        method: 'PUT', query: { valueInputOption: 'RAW' }, body: { values: [HEADERS.entries] },
      });
    }
    const r = await api(`${SHEETS}/${id}/values/${enc(`${TAB.members}!A2:A`)}`);
    if (!(r.values || []).some((row) => String(row[0]).toLowerCase() === me.email)) {
      await append(id, TAB.members, [[me.email, me.name, me.picture || '', todayISO()]]);
    }
  }

  async loadGroup(id) {
    const [{ title, tabs }, file] = await Promise.all([this.tabs(id), this.file(id)]);
    const ownerEmail = file.owners?.[0]?.emailAddress?.toLowerCase();
    // Grupos creados antes de este ajuste: el dueño cierra la hoja para que los demás no la compartan.
    if (file.ownedByMe && file.writersCanShare !== false) {
      api(`${DRIVE}/${id}`, { method: 'PATCH', body: { writersCanShare: false } }).catch(() => {});
    }
    const userTabs = [];
    const suspicious = [];
    for (const t of tabs) {
      if (t.title.startsWith('_') || !t.title.includes('@')) continue;
      const ok = tabOwnership(t, ownerEmail);
      const mine = t.title.toLowerCase() === this.me.email;
      (ok === false || (mine && ok !== true) ? suspicious : userTabs).push(t);
    }
    const params = new URLSearchParams({ valueRenderOption: 'UNFORMATTED_VALUE' });
    [`${TAB.members}!A2:D`, `${TAB.challenges}!A2:G`, ...userTabs.map((t) => `${quote(t.title)}!A2:G`)]
      .forEach((r) => params.append('ranges', r));
    const res = await api(`${SHEETS}/${id}/values:batchGet?${params}`);
    const [memberRows, challengeRows, ...entryRows] = res.valueRanges.map((v) => v.values || []);

    // Solo cuenta como miembro quien tiene una pestaña válida: una fila suelta en _miembros no basta.
    const tabEmails = new Set(userTabs.map((t) => t.title.toLowerCase()));
    const members = [];
    for (const r of memberRows) {
      const email = String(r[0] || '').trim().toLowerCase();
      if (!tabEmails.has(email) || members.some((m) => m.email === email)) continue;
      const joined = normDate(r[3]);
      members.push({ email, name: String(r[1] || email), picture: safePicture(r[2]), joined: isISODate(joined) ? joined : '' });
    }
    const entries = [];
    userTabs.forEach((t, i) => {
      const email = t.title.toLowerCase();
      if (!members.some((m) => m.email === email)) members.push({ email, name: email.split('@')[0], picture: '', joined: '' });
      for (const r of entryRows[i]) {
        const date = normDate(r[1]);
        if (!isISODate(date)) continue;
        entries.push({
          id: String(r[0] || ''), email, date, exercise: String(r[2] || '').trim(),
          sets: num(r[3]), reps: num(r[4]), weight: num(r[5]), notes: String(r[6] || ''),
        });
      }
    });
    // Un reto con fechas o tipo inválidos (editado a mano) se ignora en vez de romper la vista.
    const challenges = challengeRows.map((r) => ({
      id: String(r[0] || ''), title: String(r[1] || ''), type: String(r[2] || 'asistencia'), exercise: String(r[3] || ''),
      start: normDate(r[4]), end: normDate(r[5]), createdBy: String(r[6] || '').toLowerCase(),
    })).filter((c) => c.id && c.title && CH_TYPES.has(c.type) && isISODate(c.start) && isISODate(c.end) && c.start <= c.end);
    return {
      id,
      name: title.startsWith(TITLE_PREFIX) ? title.slice(TITLE_PREFIX.length) : title,
      url: sheetUrl(id),
      members, entries, challenges,
      isMember: tabEmails.has(this.me.email),
      canShare: Boolean(file.capabilities?.canShare),
      ownerName: file.owners?.[0]?.displayName || '',
      suspicious: suspicious.map((t) => t.title),
    };
  }

  addEntries(id, rows) {
    return append(id, this.me.email, rows.map((e) => [e.id, e.date, e.exercise, e.sets, e.reps, e.weight, e.notes || '']));
  }

  async deleteEntry(id, entryId) {
    const { tabs } = await this.tabs(id);
    const tab = tabs.find((t) => t.title.toLowerCase() === this.me.email);
    if (!tab) throw new Error('No encuentro tu pestaña en la hoja.');
    const r = await api(`${SHEETS}/${id}/values/${enc(`${quote(tab.title)}!A:A`)}`);
    const idx = (r.values || []).findIndex((row) => String(row[0]) === entryId);
    if (idx < 1) throw new Error('Ese registro ya no existe en la hoja.');
    await api(`${SHEETS}/${id}:batchUpdate`, {
      method: 'POST',
      body: { requests: [{ deleteDimension: { range: { sheetId: tab.sheetId, dimension: 'ROWS', startIndex: idx, endIndex: idx + 1 } } }] },
    });
  }

  addChallenge(id, c) {
    return append(id, TAB.challenges, [[c.id, c.title, c.type, c.exercise || '', c.start, c.end, this.me.email]]);
  }

  /** Comparte la hoja desde el Drive del usuario. Google envía el email con el enlace de invitación. */
  invite(id, email, link) {
    return api(`${DRIVE}/${id}/permissions`, {
      method: 'POST',
      query: { sendNotificationEmail: 'true', emailMessage: `¡Únete a nuestro grupo de GymTracker! Abre este enlace: ${link}` },
      body: { role: 'writer', type: 'user', emailAddress: email.trim() },
    });
  }
}
