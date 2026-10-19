// Cola de cambios pendientes de subir a la hoja. La app muestra cada serie al instante y la cola la
// sube en segundo plano. Si no hay conexión o caduca la sesión de Google, los cambios esperan en el
// almacenamiento del navegador y se suben al recuperarla. Así nunca se pierde una serie en el gimnasio.

const RETRY_MS = [3000, 10000, 30000, 60000];

export class Outbox {
  /**
   * @param {string} key clave de localStorage (una por usuario)
   * @param {object} store SheetStore o DemoStore
   * @param {() => void} onChange avisa a la interfaz para repintar el estado de sincronización
   */
  constructor(key, store, onChange) {
    this.key = key;
    this.store = store;
    this.onChange = onChange;
    this.ops = this.#load();
    this.busy = false;
    this.error = null; // { auth: bool, message }
    this.tries = 0;
    this.timer = null;
  }

  // key null (modo demo): la cola vive solo en memoria.
  #load() {
    if (!this.key) return [];
    try { return JSON.parse(localStorage.getItem(this.key) || '[]'); } catch { return []; }
  }
  #save() {
    if (!this.key) return;
    try { localStorage.setItem(this.key, JSON.stringify(this.ops)); } catch { /* sin storage: solo en memoria */ }
  }

  get pending() { return this.ops.length; }
  pendingFor(groupId) { return this.ops.filter((o) => o.groupId === groupId); }

  add(groupId, entry) { this.#push({ kind: 'add', groupId, entry }); }

  update(groupId, entry) {
    // Si el alta aún no ha salido, basta con corregirla en la cola.
    const queued = this.ops.find((o) => o.kind === 'add' && o.groupId === groupId && o.entry.id === entry.id);
    if (queued && !this.busy) { queued.entry = entry; this.#save(); this.onChange(); return; }
    this.#push({ kind: 'update', groupId, entry });
  }

  remove(groupId, entryId) {
    const i = this.ops.findIndex((o) => o.kind === 'add' && o.groupId === groupId && o.entry.id === entryId);
    if (i >= 0 && !this.busy) {
      // Nunca llegó a la hoja: se descarta y con él cualquier edición pendiente.
      this.ops = this.ops.filter((o, j) => j !== i && !(o.kind === 'update' && o.entry.id === entryId));
      this.#save(); this.onChange(); return;
    }
    this.#push({ kind: 'delete', groupId, entryId });
  }

  #push(op) {
    this.ops.push(op);
    this.#save();
    this.onChange();
    this.flush();
  }

  /** Aplica los cambios pendientes sobre los registros recién leídos de la hoja. */
  apply(groupId, entries, email) {
    let out = entries;
    for (const op of this.pendingFor(groupId)) {
      if (op.kind === 'add' && !out.some((e) => e.id === op.entry.id)) out = [...out, { ...op.entry, email }];
      else if (op.kind === 'update') out = out.map((e) => (e.id === op.entry.id && e.email === email ? { ...op.entry, email } : e));
      else if (op.kind === 'delete') out = out.filter((e) => !(e.id === op.entryId && e.email === email));
    }
    return out;
  }

  async flush() {
    if (this.busy || !this.ops.length) return;
    clearTimeout(this.timer);
    this.busy = true;
    this.onChange();
    try {
      while (this.ops.length) {
        const op = this.ops[0];
        if (op.kind === 'add') {
          // Las altas seguidas del mismo grupo se suben en una sola petición.
          let n = 1;
          while (n < this.ops.length && this.ops[n].kind === 'add' && this.ops[n].groupId === op.groupId) n++;
          await this.store.addEntries(op.groupId, this.ops.slice(0, n).map((o) => o.entry));
          this.ops.splice(0, n);
        } else {
          if (op.kind === 'update') await this.store.updateEntry(op.groupId, op.entry);
          else await this.store.deleteEntry(op.groupId, op.entryId);
          this.ops.shift();
        }
        this.#save();
        this.onChange();
      }
      this.error = null;
      this.tries = 0;
    } catch (e) {
      const auth = e?.name === 'AuthError';
      this.error = { auth, message: e?.message || '' };
      // Sin sesión hay que esperar a que la persona reconecte; un fallo de red se reintenta solo.
      if (!auth) this.timer = setTimeout(() => this.flush(), RETRY_MS[Math.min(this.tries++, RETRY_MS.length - 1)]);
    } finally {
      this.busy = false;
      this.onChange();
    }
  }

  /** Descarta lo pendiente (p. ej. si Google rechaza un cambio una y otra vez). */
  discard() {
    this.ops = [];
    this.error = null;
    this.#save();
    this.onChange();
  }
}
