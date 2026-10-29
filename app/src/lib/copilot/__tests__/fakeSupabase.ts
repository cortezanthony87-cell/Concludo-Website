/**
 * In-memory stand-in for the Supabase query builder, used only by tests.
 * It really filters (is, eq, in, gte, lte, contains), orders and limits, and it emulates row level
 * security by hiding rows whose `_owner` is a different user. It is an emulation of RLS for logic tests,
 * not a test of the real policies.
 */
export type Row = Record<string, any>;
export interface FakeOptions {
  user?: string;
  failTables?: string[];
  insertError?: string;
}

export function fakeSupabase(tables: Record<string, Row[]>, opts: FakeOptions = {}) {
  const log: Array<{ table: string; op: string }> = [];
  const user = opts.user || 'u1';
  const db: Record<string, Row[]> = Object.fromEntries(Object.entries(tables).map(([k, v]) => [k, v.map((r) => ({ ...r }))]));
  let seq = 0;

  const resolvePath = (row: Row, path: string) => {
    // json_content->risks  or json_content->>executiveSummary
    const m = path.match(/^([a-z_]+)(->>?)([A-Za-z_]+)$/);
    if (!m) return undefined;
    return row[m[1]]?.[m[3]];
  };

  function builder(table: string) {
    let rows: Row[] = (db[table] || []).filter((r) => r._owner === undefined || r._owner === user);
    let selectCols = '*';
    let single: 'none' | 'maybe' | 'one' = 'none';
    let pendingInsert: Row | null = null;
    const api: any = {};
    const chain = (fn: () => void) => (..._args: any[]) => {
      fn();
      return api;
    };
    api.select = (cols?: string) => {
      selectCols = cols || '*';
      return api;
    };
    api.is = (col: string, val: any) => ((rows = rows.filter((r) => (val === null ? r[col] == null : r[col] === val))), api);
    api.eq = (col: string, val: any) => ((rows = rows.filter((r) => r[col] === val)), api);
    api.in = (col: string, vals: any[]) => ((rows = rows.filter((r) => vals.includes(r[col]))), api);
    api.gte = (col: string, val: any) => ((rows = rows.filter((r) => r[col] != null && String(r[col]).slice(0, 10) >= val)), api);
    api.lte = (col: string, val: any) => ((rows = rows.filter((r) => r[col] != null && String(r[col]).slice(0, 10) <= val)), api);
    api.contains = (col: string, obj: any) =>
      ((rows = rows.filter((r) => Object.entries(obj).every(([k, v]) => r[col]?.[k] === v))), api);
    api.order = (col: string, o?: { ascending?: boolean }) => {
      const asc = o?.ascending !== false;
      rows = [...rows].sort((a, b) => String(a[col] ?? '').localeCompare(String(b[col] ?? '')) * (asc ? 1 : -1));
      return api;
    };
    api.limit = (n: number) => ((rows = rows.slice(0, n)), api);
    api.maybeSingle = () => ((single = 'maybe'), api);
    api.single = () => ((single = 'one'), api);
    api.insert = (row: Row) => ((pendingInsert = row), api);
    let pendingUpdate: Row | null = null;
    api.update = (patch: Row) => ((pendingUpdate = patch), api);
    api.or = () => api;
    api.ilike = (col: string, pat: string) => {
      const needle = pat.replace(/%/g, '').toLowerCase();
      rows = rows.filter((r) => String(r[col] ?? '').toLowerCase().includes(needle));
      return api;
    };
    api.then = (resolve: any, reject: any) => {
      log.push({ table, op: pendingInsert ? 'insert' : pendingUpdate ? 'update' : 'select' });
      if (pendingUpdate) {
        rows.forEach((r) => Object.assign((db[table] || []).find((x) => x.id === r.id) || {}, pendingUpdate));
        const updated = rows.map((r) => (db[table] || []).find((x) => x.id === r.id));
        const out = single !== 'none' ? updated[0] ?? null : updated;
        return Promise.resolve({ data: out, error: null }).then(resolve, reject);
      }
      if (opts.failTables?.includes(table)) return Promise.resolve({ data: null, error: { message: `${table} unavailable` } }).then(resolve, reject);
      if (pendingInsert) {
        if (opts.insertError) return Promise.resolve({ data: null, error: { message: opts.insertError } }).then(resolve, reject);
        const now = new Date().toISOString();
        const row = { id: `new-${++seq}`, created_at: now, updated_at: now, deleted_at: null, ...pendingInsert };
        (db[table] = db[table] || []).push(row);
        const out = single !== 'none' ? row : [row];
        return Promise.resolve({ data: out, error: null }).then(resolve, reject);
      }
      const shaped = rows.map((r) => {
        if (selectCols === '*') return r;
        const out: Row = {};
        for (const raw of selectCols.split(',').map((c) => c.trim())) {
          if (raw.includes(':')) {
            const [alias, path] = raw.split(':');
            out[alias] = resolvePath(r, path);
          } else out[raw] = r[raw];
        }
        return out;
      });
      const data = single === 'none' ? shaped : shaped[0] ?? null;
      const error = single === 'one' && !shaped[0] ? { message: 'no rows' } : null;
      return Promise.resolve({ data, error }).then(resolve, reject);
    };
    return api;
  }
  const client: any = { from: (t: string) => builder(t), rpc: async () => ({ data: null, error: null }) };
  return { client, log, db };
}
