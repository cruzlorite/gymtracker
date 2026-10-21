// Everything that talks to Google: sign-in, Drive, Sheets and the file picker.
// There is no server: the browser calls Google's APIs with the user's own token.
import { CONFIG } from '../config.js';
import { t } from './i18n.js';
import { isISODate, todayISO, toISO } from './stats.js';

const SCOPE_FILE = 'https://www.googleapis.com/auth/drive.file';
const SCOPES = `${SCOPE_FILE} openid email profile`;
const SHEETS = 'https://sheets.googleapis.com/v4/spreadsheets';
const DRIVE = 'https://www.googleapis.com/drive/v3/files';

// The sheet format doesn't depend on the app language: tab and column names are fixed.
export const TITLE_PREFIX = 'GymTracker · ';
export const TAB = { group: '_group', members: '_members', challenges: '_challenges', exercises: '_exercises' };
const HEADERS = {
  group: ['key', 'value'],
  members: ['email', 'name', 'picture', 'joined'],
  challenges: ['id', 'title', 'type', 'exercise', 'start', 'end', 'created_by'],
  exercises: ['name', 'category', 'created_by'],
  entries: ['id', 'date', 'exercise', 'sets', 'reps', 'weight_kg', 'notes'],
};
// Stored in the file's Drive appProperties too, so sheets from older formats aren't listed.
const SCHEMA_VERSION = '2';

export class AuthError extends Error {
  constructor() { super(t('err.session')); this.name = 'AuthError'; }
}

export const isConfigured = () => Boolean(CONFIG.CLIENT_ID);
export const sheetUrl = (id) => `https://docs.google.com/spreadsheets/d/${id}/edit`;

// ---------- loading Google's scripts ----------
const scripts = {};
function loadScript(src) {
  return (scripts[src] ||= new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = src; s.async = true;
    s.onload = () => resolve();
    s.onerror = () => { delete scripts[src]; reject(new Error(t('err.script'))); };
    document.head.appendChild(s);
  }));
}
export const loadGis = () => loadScript('https://accounts.google.com/gsi/client');
export const loadPicker = () =>
  loadScript('https://apis.google.com/js/api.js').then(() => new Promise((r) => window.gapi.load('picker', r)));

// ---------- sign-in ----------
const HINT_KEY = 'gt:hint';
const TOKEN_KEY = 'gt:token';
const lsGet = (k) => { try { return localStorage.getItem(k); } catch { return null; } };
const lsSet = (k, v) => { try { v == null ? localStorage.removeItem(k) : localStorage.setItem(k, v); } catch { /* no storage */ } };
export const savedHint = () => lsGet(HINT_KEY) || '';

let token = null;
let tokenExp = 0;
let forceConsent = false;
// Keep a still-valid token (at most 1 hour) so reopening the app, e.g. the installed PWA, doesn't ask
// to sign in again. Trade-off: while it lasts, it's readable by anyone with access to this browser profile.
try {
  const saved = JSON.parse(lsGet(TOKEN_KEY) || 'null');
  if (saved?.exp > Date.now()) ({ token, exp: tokenExp } = saved);
  else lsSet(TOKEN_KEY, null);
} catch { lsSet(TOKEN_KEY, null); }
function dropToken() { token = null; tokenExp = 0; lsSet(TOKEN_KEY, null); }
export const tokenValid = () => Boolean(token) && Date.now() < tokenExp;

/** Opens Google's popup. Must be called directly from a click, before any await. */
export function signIn() {
  return new Promise((resolve, reject) => {
    const oauth = window.google?.accounts?.oauth2;
    if (!oauth) return reject(new Error(t('err.gisLoading')));
    const client = oauth.initTokenClient({
      client_id: CONFIG.CLIENT_ID,
      scope: SCOPES,
      callback: (r) => {
        if (r.error) return reject(new Error(r.error_description || r.error));
        if (!oauth.hasGrantedAllScopes(r, SCOPE_FILE)) {
          // Google shows permissions as checkboxes and the Drive one starts unticked: on retry,
          // force the consent screen so it shows up again.
          forceConsent = true;
          return reject(new Error(t('err.drivePerm')));
        }
        forceConsent = false;
        token = r.access_token;
        tokenExp = Date.now() + (Number(r.expires_in || 3600) - 60) * 1000;
        lsSet(TOKEN_KEY, JSON.stringify({ token, exp: tokenExp }));
        resolve();
      },
      error_callback: (e) => reject(new Error(
        e?.type === 'popup_closed' ? t('err.popupClosed')
          : e?.type === 'popup_failed_to_open' ? t('err.popupBlocked')
            : t('err.signin'))),
    });
    const hint = savedHint();
    const prompt = forceConsent ? 'consent' : '';
    client.requestAccessToken(hint ? { prompt, login_hint: hint } : { prompt });
  });
}

export function signOut() {
  dropToken();
  lsSet(HINT_KEY, null);
}

async function api(url, { method = 'GET', body, query } = {}) {
  if (!tokenValid()) throw new AuthError();
  const u = new URL(url);
  for (const [k, v] of Object.entries(query || {})) u.searchParams.set(k, v);
  // Never wait forever: a hung request becomes an error after 20 s (the outbox retries it later).
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 20000);
  let res;
  try {
    res = await fetch(u, {
      method,
      signal: ctrl.signal,
      headers: { Authorization: `Bearer ${token}`, ...(body ? { 'Content-Type': 'application/json' } : {}) },
      body: body ? JSON.stringify(body) : undefined,
    });
  } catch (e) {
    throw e?.name === 'AbortError' ? new Error(t('err.timeout')) : e;
  } finally {
    clearTimeout(timer);
  }
  if (res.status === 401) { dropToken(); throw new AuthError(); }
  if (!res.ok) {
    let msg = '';
    try { msg = (await res.json()).error?.message || ''; } catch { /* no body */ }
    const err = new Error(msg || t('err.google', { status: res.status }));
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
 * Google's file picker. Picking the sheet grants the app access (drive.file scope) to that
 * specific file. Returns its id, or null if cancelled.
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
      .setTitle(fileId ? t('picker.join') : t('picker.choose'))
      .setCallback((d) => {
        if (d.action === P.Action.PICKED) resolve(d.docs[0].id);
        else if (d.action === P.Action.CANCEL) resolve(null);
      });
    if (CONFIG.APP_ID) b.setAppId(CONFIG.APP_ID);
    b.build().setVisible(true);
  });
}

// ---------- Sheets helpers ----------
const quote = (tab) => `'${tab.replace(/'/g, "''")}'`;
const enc = encodeURIComponent;

function append(id, tab, rows) {
  return api(`${SHEETS}/${id}/values/${enc(`${quote(tab)}!A1`)}:append`, {
    method: 'POST',
    query: { valueInputOption: 'RAW', insertDataOption: 'INSERT_ROWS' },
    body: { values: rows },
  });
}

/** Dates: if someone types into the sheet by hand, Sheets may turn them into serial numbers. */
function normDate(v) {
  if (typeof v === 'number') return toISO(new Date(Date.UTC(1899, 11, 30) + v * 864e5 + new Date().getTimezoneOffset() * 6e4));
  return String(v ?? '').trim().slice(0, 10);
}
const num = (v) => {
  if (typeof v === 'number') return v;
  const n = parseFloat(String(v ?? '').replace(',', '.'));
  return Number.isFinite(n) ? n : 0;
};
const CH_TYPES = new Set(['attendance', 'volume', 'improvement', 'sets', 'reps', 'maxWeight', 'prs']);
const entryRow = (e) => [e.id, e.date, e.exercise, e.sets, e.reps, e.weight, e.notes || ''];
const OPEN_KEY = 'open_logging';
/** Locks a personal tab so only its owner (and the sheet owner) can edit it. */
const protectTab = (sheetId, email) => ({ addProtectedRange: { protectedRange: {
  range: { sheetId }, description: `${email}'s workouts: only the owner can edit`, editors: { users: [email] },
} } });

/** Google profile pictures only: an arbitrary URL in _members would reveal the IP of everyone opening the app. */
function safePicture(v) {
  try {
    const u = new URL(String(v || ''));
    return u.protocol === 'https:' && u.hostname.endsWith('.googleusercontent.com') ? u.href : '';
  } catch { return ''; }
}

const isWholeSheet = (r = {}, sheetId) => (r.sheetId ?? 0) === sheetId
  && r.startRowIndex == null && r.endRowIndex == null && r.startColumnIndex == null && r.endColumnIndex == null;

/**
 * Does the tab really belong to the person in its title? Any editor can create a tab named after
 * someone else, but a protection's editors are only visible to the sheet owner and to whoever can edit it.
 * true = verified · false = unprotected or impersonated · null = can't be checked from this account.
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

// ---------- Google Sheets storage ----------
export class SheetStore {
  kind = 'google';

  constructor(me) {
    this.me = me;
    this.meta = new Map(); // groupId → { tabs: Map(email → tab), hasExercises, openLogging }
  }

  async listGroups() {
    const q = `appProperties has { key='app' and value='${CONFIG.APP_TAG}' } and appProperties has { key='schema' and value='${SCHEMA_VERSION}' } and trashed=false`;
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
        sheets: [TAB.group, TAB.members, TAB.challenges, TAB.exercises].map((title) => ({ properties: { title } })),
      },
    });
    const id = ss.spreadsheetId;
    const groupSheetId = ss.sheets.find((s) => s.properties.title === TAB.group).properties.sheetId;
    await api(`${SHEETS}/${id}/values:batchUpdate`, {
      method: 'POST',
      body: {
        valueInputOption: 'RAW',
        data: [
          { range: `${TAB.group}!A1`, values: [HEADERS.group, ['schema', SCHEMA_VERSION], ['app', CONFIG.APP_TAG], [OPEN_KEY, 'true']] },
          { range: `${TAB.members}!A1`, values: [HEADERS.members] },
          { range: `${TAB.challenges}!A1`, values: [HEADERS.challenges] },
          { range: `${TAB.exercises}!A1`, values: [HEADERS.exercises] },
        ],
      },
    });
    await api(`${SHEETS}/${id}:batchUpdate`, {
      method: 'POST',
      body: { requests: [{ addProtectedRange: { protectedRange: {
        range: { sheetId: groupSheetId }, description: 'Group settings', editors: { users: [this.me.email] },
      } } }] },
    });
    // Invisible tag to find the app's sheets without scanning the whole Drive.
    // writersCanShare: only the group creator can share the sheet with more people.
    await api(`${DRIVE}/${id}`, {
      method: 'PATCH', body: { appProperties: { app: CONFIG.APP_TAG, schema: SCHEMA_VERSION }, writersCanShare: false },
    });
    await this.join(id, { open: true });
    return id;
  }

  async tabs(id) {
    const fields = 'properties.title,sheets(properties(sheetId,title),protectedRanges(protectedRangeId,range,editors,requestingUserCanEdit))';
    const r = await api(`${SHEETS}/${id}`, { query: { fields } });
    return { title: r.properties.title, tabs: r.sheets.map((s) => ({ ...s.properties, protectedRanges: s.protectedRanges || [] })) };
  }

  file(id) {
    return api(`${DRIVE}/${id}`, { query: { fields: 'ownedByMe,writersCanShare,owners(displayName,emailAddress),capabilities(canShare)' } });
  }

  /** Whether anyone in the group may log sets for anyone (the `open_logging` row of _group). */
  async #openLogging(id) {
    const r = await api(`${SHEETS}/${id}/values/${enc(`${TAB.group}!A2:B`)}`);
    return (r.values || []).some((row) => row[0] === OPEN_KEY && String(row[1]).toLowerCase() === 'true');
  }

  /**
   * Creates the user's tab and adds them to _members. In protected mode the tab is locked so only they
   * (and the sheet owner) can edit it; in open mode any member can log sets in it.
   */
  async join(id, { open } = {}) {
    const me = this.me;
    const [{ tabs }, file, isOpen] = await Promise.all([this.tabs(id), this.file(id), open ?? this.#openLogging(id)]);
    if (!tabs.some((x) => x.title === TAB.members)) throw new Error(t('err.notGroup'));
    const mine = tabs.find((x) => x.title.toLowerCase() === me.email);
    if (mine && !isOpen && tabOwnership(mine, file.owners?.[0]?.emailAddress?.toLowerCase()) !== true) {
      throw new Error(file.ownedByMe
        ? t('err.tabNotYoursOwner', { tab: mine.title })
        : t('err.tabNotYours', { owner: file.owners?.[0]?.displayName || t('group.creator') }));
    }
    if (!mine) {
      const sheetId = 1 + Math.floor(Math.random() * 2e9);
      await api(`${SHEETS}/${id}:batchUpdate`, {
        method: 'POST',
        body: { requests: [
          { addSheet: { properties: { sheetId, title: me.email } } },
          ...(isOpen ? [] : [protectTab(sheetId, me.email)]),
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
    // Three independent reads in parallel: saves a round trip on every load.
    const [{ title, tabs }, file, openLogging] = await Promise.all([this.tabs(id), this.file(id), this.#openLogging(id)]);
    const ownerEmail = file.owners?.[0]?.emailAddress?.toLowerCase();
    // Safety net: the owner closes the sheet so other members can't re-share it.
    if (file.ownedByMe && file.writersCanShare !== false) {
      api(`${DRIVE}/${id}`, { method: 'PATCH', body: { writersCanShare: false } }).catch(() => {});
    }
    const userTabs = [];
    const suspicious = [];
    for (const tab of tabs) {
      if (tab.title.startsWith('_') || !tab.title.includes('@')) continue;
      // In open mode anyone may write in any tab, so there is no ownership to verify.
      if (openLogging) { userTabs.push(tab); continue; }
      const ok = tabOwnership(tab, ownerEmail);
      const mine = tab.title.toLowerCase() === this.me.email;
      (ok === false || (mine && ok !== true) ? suspicious : userTabs).push(tab);
    }
    const hasExercises = tabs.some((x) => x.title === TAB.exercises);
    this.meta.set(id, { tabs: new Map(userTabs.map((x) => [x.title.toLowerCase(), x])), hasExercises, openLogging });

    const params = new URLSearchParams({ valueRenderOption: 'UNFORMATTED_VALUE' });
    // Without an _exercises tab, that slot re-reads _members and is discarded below.
    [`${TAB.members}!A2:D`, `${TAB.challenges}!A2:G`, `${hasExercises ? TAB.exercises : TAB.members}!A2:C`,
      ...userTabs.map((x) => `${quote(x.title)}!A2:G`)]
      .forEach((r) => params.append('ranges', r));
    const res = await api(`${SHEETS}/${id}/values:batchGet?${params}`);
    const [memberRows, challengeRows, exerciseRows, ...entryRows] = res.valueRanges.map((v) => v.values || []);

    // Only people with a valid tab count as members: a stray row in _members isn't enough.
    const tabEmails = new Set(userTabs.map((x) => x.title.toLowerCase()));
    const members = [];
    for (const r of memberRows) {
      const email = String(r[0] || '').trim().toLowerCase();
      if (!tabEmails.has(email) || members.some((m) => m.email === email)) continue;
      const joined = normDate(r[3]);
      members.push({ email, name: String(r[1] || email), picture: safePicture(r[2]), joined: isISODate(joined) ? joined : '' });
    }
    const entries = [];
    userTabs.forEach((tab, i) => {
      const email = tab.title.toLowerCase();
      if (!members.some((m) => m.email === email)) members.push({ email, name: email.split('@')[0], picture: '', joined: '' });
      const seen = new Set(); // a network retry can duplicate a row: the id wins
      for (const r of entryRows[i]) {
        const date = normDate(r[1]);
        const entryId = String(r[0] || '');
        if (!isISODate(date) || (entryId && seen.has(entryId))) continue;
        seen.add(entryId);
        entries.push({
          id: entryId, email, date, exercise: String(r[2] || '').trim(),
          sets: num(r[3]), reps: num(r[4]), weight: num(r[5]), notes: String(r[6] || ''),
        });
      }
    });
    // A challenge with invalid dates or type (edited by hand) is ignored instead of breaking the view.
    const challenges = challengeRows.map((r) => ({
      id: String(r[0] || ''), title: String(r[1] || ''), type: String(r[2] || 'attendance'), exercise: String(r[3] || ''),
      start: normDate(r[4]), end: normDate(r[5]), createdBy: String(r[6] || '').toLowerCase(),
    })).filter((c) => c.id && c.title && CH_TYPES.has(c.type) && isISODate(c.start) && isISODate(c.end) && c.start <= c.end);
    const exercises = hasExercises
      ? exerciseRows.filter((r) => String(r[0] || '').trim()).map((r) => ({ name: String(r[0]).trim().slice(0, 60), cat: String(r[1] || 'other') }))
      : [];
    return {
      id,
      name: title.startsWith(TITLE_PREFIX) ? title.slice(TITLE_PREFIX.length) : title,
      url: sheetUrl(id),
      members, entries, challenges, exercises,
      isMember: tabEmails.has(this.me.email),
      isOwner: Boolean(file.ownedByMe),
      openLogging,
      canShare: Boolean(file.capabilities?.canShare),
      ownerName: file.owners?.[0]?.displayName || '',
      suspicious: suspicious.map((x) => x.title),
    };
  }

  /** The tab where `email`'s sets live (the signed-in user's by default). */
  async #tabOf(id, email = this.me.email) {
    if (!this.meta.get(id)?.tabs?.has(email)) await this.loadGroup(id);
    const tab = this.meta.get(id)?.tabs?.get(email);
    if (!tab) throw new Error(t('err.noTab'));
    return tab;
  }

  /**
   * Rows (0-based, header excluded) of an entry in my tab. Usually one; more if a network retry
   * duplicated the insert. Empty if it's gone.
   */
  async #rowsOf(id, tab, entryId) {
    const r = await api(`${SHEETS}/${id}/values/${enc(`${quote(tab.title)}!A:A`)}`);
    return (r.values || []).flatMap((row, i) => (i > 0 && String(row[0]) === entryId ? [i] : []));
  }

  async addEntries(id, rows, email = this.me.email) {
    const tab = email === this.me.email ? { title: this.me.email } : await this.#tabOf(id, email);
    return append(id, tab.title, rows.map(entryRow));
  }

  async updateEntry(id, e, email = this.me.email) {
    const tab = await this.#tabOf(id, email);
    const rows = await this.#rowsOf(id, tab, e.id);
    if (!rows.length) return; // deleted from the sheet: nothing to update
    await api(`${SHEETS}/${id}/values:batchUpdate`, {
      method: 'POST',
      body: { valueInputOption: 'RAW', data: rows.map((i) => ({ range: `${quote(tab.title)}!A${i + 1}:G${i + 1}`, values: [entryRow(e)] })) },
    });
  }

  async deleteEntry(id, entryId, email = this.me.email) {
    const tab = await this.#tabOf(id, email);
    const rows = await this.#rowsOf(id, tab, entryId);
    if (!rows.length) return; // already gone: deleting is idempotent
    // Bottom-up, so deleting one row doesn't shift the next ones.
    await api(`${SHEETS}/${id}:batchUpdate`, {
      method: 'POST',
      body: { requests: rows.reverse().map((i) => ({ deleteDimension: { range: { sheetId: tab.sheetId, dimension: 'ROWS', startIndex: i, endIndex: i + 1 } } })) },
    });
  }

  addChallenge(id, c) {
    return append(id, TAB.challenges, [[c.id, c.title, c.type, c.exercise || '', c.start, c.end, this.me.email]]);
  }

  /** Deletes a challenge's row(s) from _challenges. */
  async deleteChallenge(id, challengeId) {
    const { tabs } = await this.tabs(id);
    const tab = tabs.find((x) => x.title === TAB.challenges);
    const r = await api(`${SHEETS}/${id}/values/${enc(`${TAB.challenges}!A:A`)}`);
    const rows = (r.values || []).flatMap((row, i) => (i > 0 && String(row[0]) === challengeId ? [i] : []));
    if (!tab || !rows.length) return; // already gone
    await api(`${SHEETS}/${id}:batchUpdate`, {
      method: 'POST',
      body: { requests: rows.reverse().map((i) => ({ deleteDimension: { range: { sheetId: tab.sheetId, dimension: 'ROWS', startIndex: i, endIndex: i + 1 } } })) },
    });
  }

  /** A group's custom exercise. Creates the _exercises tab first if it's missing. */
  async addExercise(id, ex) {
    if (!this.meta.get(id)?.hasExercises) {
      const { tabs } = await this.tabs(id);
      if (!tabs.some((x) => x.title === TAB.exercises)) {
        await api(`${SHEETS}/${id}:batchUpdate`, {
          method: 'POST', body: { requests: [{ addSheet: { properties: { title: TAB.exercises } } }] },
        });
        await api(`${SHEETS}/${id}/values/${enc(`${TAB.exercises}!A1`)}`, {
          method: 'PUT', query: { valueInputOption: 'RAW' }, body: { values: [HEADERS.exercises] },
        });
      }
      this.meta.set(id, { ...this.meta.get(id), hasExercises: true });
    }
    await append(id, TAB.exercises, [[ex.name, ex.cat, this.me.email]]);
  }

  /** People with access to the group's sheet (only the owner sees the full list). */
  async listPermissions(id) {
    const r = await api(`${DRIVE}/${id}/permissions`, { query: { fields: 'permissions(id,type,role,emailAddress,displayName)' } });
    return (r.permissions || []).filter((p) => p.type === 'user' && p.emailAddress)
      .map((p) => ({ id: p.id, email: p.emailAddress.toLowerCase(), name: p.displayName || '', role: p.role }));
  }

  /** Revokes someone's access to the sheet (cancels a pending invitation). */
  async revoke(id, permissionId) {
    try {
      await api(`${DRIVE}/${id}/permissions/${permissionId}`, { method: 'DELETE' });
    } catch (e) {
      if (e.status !== 404) throw e; // already gone
    }
  }

  /** Removes a member: revokes their access, deletes their tab and their row in _members. Owner only. */
  async removeMember(id, email, permissionId) {
    if (permissionId) await this.revoke(id, permissionId);
    const { tabs } = await this.tabs(id);
    const requests = [];
    const tab = tabs.find((x) => x.title.toLowerCase() === email);
    if (tab) requests.push({ deleteSheet: { sheetId: tab.sheetId } });
    const membersTab = tabs.find((x) => x.title === TAB.members);
    const r = await api(`${SHEETS}/${id}/values/${enc(`${TAB.members}!A:A`)}`);
    const rows = (r.values || []).flatMap((row, i) => (i > 0 && String(row[0]).toLowerCase() === email ? [i] : []));
    // Bottom-up, so deleting one row doesn't shift the next ones.
    for (const i of rows.reverse()) {
      requests.push({ deleteDimension: { range: { sheetId: membersTab.sheetId, dimension: 'ROWS', startIndex: i, endIndex: i + 1 } } });
    }
    if (requests.length) await api(`${SHEETS}/${id}:batchUpdate`, { method: 'POST', body: { requests } });
  }

  /**
   * Owner only. Open: anyone can log sets for anyone (protections on personal tabs are removed).
   * Closed: each personal tab is locked to its owner again.
   */
  async setOpenLogging(id, open) {
    const { tabs } = await this.tabs(id);
    const r = await api(`${SHEETS}/${id}/values/${enc(`${TAB.group}!A:A`)}`);
    const row = (r.values || []).findIndex((x) => x[0] === OPEN_KEY);
    if (row > 0) {
      await api(`${SHEETS}/${id}/values/${enc(`${TAB.group}!A${row + 1}:B${row + 1}`)}`, {
        method: 'PUT', query: { valueInputOption: 'RAW' }, body: { values: [[OPEN_KEY, String(open)]] },
      });
    } else {
      await append(id, TAB.group, [[OPEN_KEY, String(open)]]);
    }
    const requests = [];
    for (const tab of tabs) {
      if (tab.title.startsWith('_') || !tab.title.includes('@')) continue;
      const whole = tab.protectedRanges.filter((p) => isWholeSheet(p.range, tab.sheetId));
      if (open) whole.forEach((p) => requests.push({ deleteProtectedRange: { protectedRangeId: p.protectedRangeId } }));
      else if (!whole.length) requests.push(protectTab(tab.sheetId, tab.title.toLowerCase()));
    }
    if (requests.length) await api(`${SHEETS}/${id}:batchUpdate`, { method: 'POST', body: { requests } });
  }

  renameGroup(id, name) {
    return api(`${DRIVE}/${id}`, { method: 'PATCH', body: { name: TITLE_PREFIX + name } });
  }

  /** Moves the sheet to the owner's Drive trash, where it can be recovered for 30 days. */
  deleteGroup(id) {
    return api(`${DRIVE}/${id}`, { method: 'PATCH', body: { trashed: true } });
  }

  /** Shares the sheet from the user's Drive. Google sends the invitation email with the link. */
  invite(id, email, link) {
    return api(`${DRIVE}/${id}/permissions`, {
      method: 'POST',
      query: { sendNotificationEmail: 'true', emailMessage: t('invite.email', { link }) },
      body: { role: 'writer', type: 'user', emailAddress: email.trim() },
    });
  }
}
