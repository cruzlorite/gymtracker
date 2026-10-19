// Queue of changes waiting to be uploaded to the sheet. The app shows every set instantly and the queue
// uploads it in the background. If there's no connection or the Google session expires, changes wait in
// the browser's storage and are uploaded once it's back, so a set is never lost at the gym.

const RETRY_MS = [3000, 10000, 30000, 60000];

export class Outbox {
  /**
   * @param {string} key localStorage key (one per user)
   * @param {object} store SheetStore or DemoStore
   * @param {() => void} onChange tells the UI to repaint the sync status
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

  // key null (demo mode): the queue only lives in memory.
  #load() {
    if (!this.key) return [];
    try { return JSON.parse(localStorage.getItem(this.key) || '[]'); } catch { return []; }
  }
  #save() {
    if (!this.key) return;
    try { localStorage.setItem(this.key, JSON.stringify(this.ops)); } catch { /* no storage: memory only */ }
  }

  get pending() { return this.ops.length; }
  pendingFor(groupId) { return this.ops.filter((o) => o.groupId === groupId); }

  add(groupId, entry) { this.#push({ kind: 'add', groupId, entry }); }

  update(groupId, entry) {
    // If the insert hasn't gone out yet, just fix it in the queue.
    const queued = this.ops.find((o) => o.kind === 'add' && o.groupId === groupId && o.entry.id === entry.id);
    if (queued && !this.busy) { queued.entry = entry; this.#save(); this.onChange(); return; }
    this.#push({ kind: 'update', groupId, entry });
  }

  remove(groupId, entryId) {
    const i = this.ops.findIndex((o) => o.kind === 'add' && o.groupId === groupId && o.entry.id === entryId);
    if (i >= 0 && !this.busy) {
      // It never reached the sheet: drop it along with any pending edits.
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

  /** Applies pending changes on top of entries freshly read from the sheet. */
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
          // Consecutive inserts for the same group go up in a single request.
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
      // Without a session we wait for the user to reconnect; network failures retry on their own.
      if (!auth) this.timer = setTimeout(() => this.flush(), RETRY_MS[Math.min(this.tries++, RETRY_MS.length - 1)]);
    } finally {
      this.busy = false;
      this.onChange();
    }
  }

  /** Drops everything pending (e.g. if Google keeps rejecting a change). */
  discard() {
    this.ops = [];
    this.error = null;
    this.#save();
    this.onChange();
  }
}
