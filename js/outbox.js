// Queue of changes waiting to be uploaded to the sheet. The app shows every set instantly and the queue
// uploads it in the background. If there's no connection or the Google session expires, changes wait in
// the browser's storage and are uploaded once it's back, so a set is never lost at the gym.
//
// Each change carries the email of the person the set belongs to, which is also the sheet tab it goes
// to: you can log sets for other members of your group.

const RETRY_MS = [3000, 10000, 30000, 60000];

export class Outbox {
  /**
   * @param {string} key localStorage key (one per user)
   * @param {object} store SheetStore or DemoStore
   * @param {string} me the signed-in user's email (default owner of queued sets)
   * @param {() => void} onChange tells the UI to repaint the sync status
   */
  constructor(key, store, me, onChange) {
    this.key = key;
    this.store = store;
    this.me = me;
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
  #owner(op) { return op.email || this.me; }

  add(groupId, entry, email = this.me) { this.#push({ kind: 'add', groupId, email, entry }); }

  update(groupId, entry, email = this.me) {
    // If the insert hasn't gone out yet, just fix it in the queue.
    const queued = this.ops.find((o) => o.kind === 'add' && o.groupId === groupId && this.#owner(o) === email && o.entry.id === entry.id);
    if (queued && !this.busy) { queued.entry = entry; this.#save(); this.onChange(); return; }
    this.#push({ kind: 'update', groupId, email, entry });
  }

  remove(groupId, entryId, email = this.me) {
    const i = this.ops.findIndex((o) => o.kind === 'add' && o.groupId === groupId && this.#owner(o) === email && o.entry.id === entryId);
    if (i >= 0 && !this.busy) {
      // It never reached the sheet: drop it along with any pending edits.
      this.ops = this.ops.filter((o, j) => j !== i && !(o.kind === 'update' && this.#owner(o) === email && o.entry.id === entryId));
      this.#save(); this.onChange(); return;
    }
    this.#push({ kind: 'delete', groupId, email, entryId });
  }

  #push(op) {
    this.ops.push(op);
    this.#save();
    this.onChange();
    this.flush();
  }

  /** Applies pending changes on top of entries freshly read from the sheet. */
  apply(groupId, entries) {
    let out = entries;
    for (const op of this.pendingFor(groupId)) {
      const email = this.#owner(op);
      const same = (e, id) => e.id === id && e.email === email;
      if (op.kind === 'add' && !out.some((e) => same(e, op.entry.id))) out = [...out, { ...op.entry, email }];
      else if (op.kind === 'update') out = out.map((e) => (same(e, op.entry.id) ? { ...op.entry, email } : e));
      else if (op.kind === 'delete') out = out.filter((e) => !same(e, op.entryId));
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
        const email = this.#owner(op);
        if (op.kind === 'add') {
          // Consecutive inserts for the same group and person go up in a single request.
          let n = 1;
          while (n < this.ops.length && this.ops[n].kind === 'add' && this.ops[n].groupId === op.groupId && this.#owner(this.ops[n]) === email) n++;
          await this.store.addEntries(op.groupId, this.ops.slice(0, n).map((o) => o.entry), email);
          this.ops.splice(0, n);
        } else {
          if (op.kind === 'update') await this.store.updateEntry(op.groupId, op.entry, email);
          else await this.store.deleteEntry(op.groupId, op.entryId, email);
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
