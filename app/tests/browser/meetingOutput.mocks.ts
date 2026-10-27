// Recording stand-ins for the Workspace data clients. Used only by the browser harness.
type W = { fn: string; input: Record<string, unknown> };
const g = globalThis as unknown as { __writes: W[] };
g.__writes = g.__writes || [];
let n = 0;
const rec = async (fn: string, input: Record<string, unknown>) => {
  g.__writes.push({ fn, input });
  return { data: { id: `${fn}-${++n}`, ...input }, error: null };
};
export const createProject = (_s: unknown, i: Record<string, unknown>) => rec('createProject', i);
export const saveOutput = (_s: unknown, i: Record<string, unknown>) => rec('saveOutput', i);
export const saveDecision = (_s: unknown, i: Record<string, unknown>) => rec('saveDecision', i);
export const saveAction = (_s: unknown, i: Record<string, unknown>) => rec('saveAction', i);
export const createProjectFile = (_s: unknown, i: Record<string, unknown>) => rec('createProjectFile', i);
export const refreshAllIntelligence = async () => undefined;
