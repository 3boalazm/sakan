// Minimal in-memory Firestore-compatible shim — for local tests ONLY.
export function makeFakeDb() {
  const store = new Map();
  const col = (name) => { if (!store.has(name)) store.set(name, new Map()); return store.get(name); };
  const docRef = (name, id) => ({
    id,
    async get() { const m = col(name); const has = m.has(id); const data = has ? { ...m.get(id) } : undefined; return { exists: has, id, data: () => data }; },
    async set(obj) { col(name).set(id, { ...obj }); },
    async update(obj) { const m = col(name); m.set(id, { ...(m.get(id) || {}), ...obj }); },
    async delete() { col(name).delete(id); },
  });
  const query = (name, filters) => ({
    where(f, op, v) { return query(name, [...filters, [f, op, v]]); },
    async get() {
      const docs = [];
      for (const [id, data] of col(name)) {
        if (filters.every(([f, op, v]) => (op === '==' ? data[f] === v : true))) docs.push({ id, data: () => ({ ...data }) });
      }
      return { docs, empty: docs.length === 0 };
    },
  });
  return {
    collection(name) {
      return {
        doc(id) { return docRef(name, id); },
        async add(obj) { const id = globalThis.crypto.randomUUID(); col(name).set(id, { ...obj }); return { id }; },
        where(f, op, v) { return query(name, [[f, op, v]]); },
      };
    },
    async runTransaction(fn) {
      const tx = { get: (ref) => ref.get(), set: (ref, o) => ref.set(o), update: (ref, o) => ref.update(o) };
      return await fn(tx);
    },
  };
}
