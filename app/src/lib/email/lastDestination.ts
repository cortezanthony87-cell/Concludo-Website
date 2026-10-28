/**
 * Remembers the last module destination a person was on, for the length of the
 * visit, so a thread opened from anywhere can send them back there.
 *
 * Only destinations are recorded, never threads. Moving from one thread to the
 * next in the left-hand list must not change where Back goes.
 *
 * It is a plain module variable on purpose: nothing is written to storage, no
 * message content is held, and a reload forgets it.
 */
import { EMAIL_MODULE_DESTINATIONS } from './moduleNav';
import { EmailModulePath } from './types';

const PATHS: ReadonlySet<string> = new Set(EMAIL_MODULE_DESTINATIONS.map((d) => d.path));

let last: EmailModulePath | null = null;

/** Strips a trailing slash so `/email/` and `/email` are the same place. */
function normalise(pathname: string): string {
  return pathname.length > 1 && pathname.endsWith('/') ? pathname.slice(0, -1) : pathname;
}

/** Records a visit. A thread path or anything else is ignored. */
export function noteVisit(pathname: string): void {
  const path = normalise(pathname);
  if (PATHS.has(path)) last = path as EmailModulePath;
}

export function lastDestination(): EmailModulePath | null {
  return last;
}

/** For the tests. */
export function forgetDestination(): void {
  last = null;
}

export function labelForDestination(path: EmailModulePath): string {
  return EMAIL_MODULE_DESTINATIONS.find((d) => d.path === path)?.label ?? 'All Email';
}
