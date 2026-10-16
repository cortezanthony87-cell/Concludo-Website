/**
 * One place to say "something was written, drop your caches".
 *
 * WHY THIS IS ITS OWN FILE, WITH NO IMPORTS.
 *
 * Five modules cache an index against the workspace object. The session store
 * mutates one workspace in place rather than replacing it, so those caches
 * have to be dropped when something is written, and the module that knows a
 * write happened is the session store.
 *
 * Putting the registry in the session store creates a cycle: the session store
 * imports the write path, the write path reaches the composition modules, and
 * those modules would import the session store to register. The cycle itself
 * is survivable; what is not is that the registration runs at module scope,
 * and in a cycle it can run before the array it pushes to exists. That is
 * exactly what happened, and it took the whole module down with "Cannot access
 * 'invalidators' before initialization".
 *
 * So this file imports nothing at all. Nothing can be circular with it.
 */

type Invalidator = (data: unknown) => void;

const invalidators: Invalidator[] = [];

/**
 * Register a cache to be dropped whenever anything is written.
 *
 * Called at module scope by every module that caches an index. A module
 * nobody imported has no cache to drop, so a missing registration is not a
 * correctness problem.
 */
export function onWriteInvalidate<T>(invalidator: (data: T) => void): void {
  invalidators.push(invalidator as Invalidator);
}

/** Drop every registered cache for one workspace. */
export function invalidateCaches(data: unknown): void {
  for (const invalidator of invalidators) invalidator(data);
}

/** How many caches are registered. For the test that asserts all five are. */
export function registeredCacheCount(): number {
  return invalidators.length;
}
