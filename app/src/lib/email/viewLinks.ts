/**
 * Links between the views of the Email Command Centre.
 *
 * WHY THIS FILE EXISTS. `useEmailViewState().linkTo` appends the person's
 * account and filters to a module path as `path?account=...`. The item actions
 * passed it a path that already carried a query, `/email/thread/ID?tab=draft`,
 * and so produced `/email/thread/ID?tab=draft?account=...`. The second `?` is
 * part of the value of `tab`, so the account never reached the router. A person
 * on the Personal account who pressed "View summary" or "Draft reply" was sent
 * to the Work account, and saw "Thread not found". It failed safe, in that no
 * work thread was shown inside the personal view, but it was broken, and it
 * shipped because every test ran on the default account.
 *
 * `appendParams` is the one place a query is added to a link. It understands a
 * link that already has one.
 *
 * "Concludo proposes; a person disposes." Nothing here sends, files or deletes.
 * These are only paths.
 */
import { EMAIL_MODULE_DESTINATIONS } from './moduleNav';
import { EmailModulePath } from './types';

export type LinkTo = (path: string) => string;

/** Adds query parameters to a link that may already carry a query and a hash. */
export function appendParams(
  href: string,
  params: Readonly<Record<string, string | null | undefined>>
): string {
  const hashAt = href.indexOf('#');
  const hash = hashAt === -1 ? '' : href.slice(hashAt);
  const withoutHash = hashAt === -1 ? href : href.slice(0, hashAt);
  const queryAt = withoutHash.indexOf('?');
  const path = queryAt === -1 ? withoutHash : withoutHash.slice(0, queryAt);
  const query = new URLSearchParams(queryAt === -1 ? '' : withoutHash.slice(queryAt + 1));
  for (const [key, value] of Object.entries(params)) {
    if (value === null || value === undefined || value === '') continue;
    query.set(key, value);
  }
  const text = query.toString();
  return `${path}${text ? `?${text}` : ''}${hash}`;
}

/** The module destinations a thread can be opened from, by their short key. */
const FROM_KEYS: ReadonlyMap<string, EmailModulePath> = new Map(
  EMAIL_MODULE_DESTINATIONS.filter((d) => d.path !== '/email').map((d) => [
    d.path.slice('/email/'.length),
    d.path,
  ])
);

/** `/email/reply-queue` becomes `reply-queue`. The Overview has no key. */
export function fromKeyFor(path: EmailModulePath): string | undefined {
  return path === '/email' ? undefined : path.slice('/email/'.length);
}

/**
 * Reads `?from=`. Only a known destination is accepted, so a link cannot make
 * the Back control point anywhere except somewhere inside this module.
 */
export function parseFrom(search: string): EmailModulePath | null {
  const key = new URLSearchParams(search).get('from');
  return key ? (FROM_KEYS.get(key) ?? null) : null;
}

export interface ThreadLinkOptions {
  /** An analysis tab: overview, draft and so on. Validated by the thread page. */
  tab?: string;
  /** The view the person is coming from, so Back can return to it. */
  from?: EmailModulePath;
}

/** The link to one thread, keeping the account and remembering where it was opened from. */
export function threadHref(linkTo: LinkTo, threadId: string, options: ThreadLinkOptions = {}): string {
  return appendParams(linkTo(`/email/thread/${threadId}`), {
    tab: options.tab,
    from: options.from ? fromKeyFor(options.from) : undefined,
  });
}

/* ----------------------------------------------------- Clear Backlog presets */

/**
 * Where a list hands its threads to Clear Backlog. Each preset is a selection
 * Clear Backlog already offers as a checkbox. Nothing new is selected, and the
 * checkbox stays visible so the person can see and change what was chosen.
 */
export type BacklogPreset = 'replies' | 'dated' | 'unread';

export const BACKLOG_PRESETS: Readonly<
  Record<BacklogPreset, { label: string; flag: 'awaitingReplyOnly' | 'withDeadlineOnly' | 'unreadOnly' }>
> = {
  replies: { label: 'Reply Queue', flag: 'awaitingReplyOnly' },
  dated: { label: 'Actions & Deadlines', flag: 'withDeadlineOnly' },
  unread: { label: 'Unread', flag: 'unreadOnly' },
};

export function parsePreset(search: string): BacklogPreset | null {
  const value = new URLSearchParams(search).get('preset');
  return value === 'replies' || value === 'dated' || value === 'unread' ? value : null;
}

export function backlogHref(linkTo: LinkTo, preset?: BacklogPreset): string {
  return appendParams(linkTo('/email/clear-backlog'), { preset });
}
