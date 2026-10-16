/**
 * The eight item actions, and what they actually do in this stage.
 *
 * The brief says: do not perform external actions in this stage. That is taken
 * literally. Nothing here touches a mailbox, a calendar, a task list or a
 * database. Every action records an intention in React state for the length of
 * this page visit and nothing more.
 *
 * The honest consequence is that these changes disappear on reload, and the
 * interface says so rather than letting a person believe they have deferred
 * something. A control that looks like it saved and did not is worse than no
 * control at all, which is why "Add task" and "Add reminder" are worded as
 * SUGGESTIONS throughout: they produce a line of text for the person to use,
 * not a task in a system.
 */
import React, { createContext, useCallback, useContext, useMemo, useState, useEffect } from 'react';
import { getSupabaseBrowserClient } from '../supabase/client';
import { UserDate } from './views';

export type ItemActionKind =
  | 'review'
  | 'view_thread'
  | 'view_summary'
  | 'draft_reply'
  | 'defer'
  | 'mark_waiting'
  | 'suggest_task'
  | 'suggest_reminder';

export interface ItemActionDefinition {
  kind: ItemActionKind;
  label: string;
  /** lucide-react icon name. */
  iconName: string;
  /** What it does, said plainly. Used as the accessible description. */
  effect: string;
  /** True where the action changes session state rather than only navigating. */
  mutatesSession: boolean;
}

export const ITEM_ACTIONS: readonly ItemActionDefinition[] = [
  {
    kind: 'review',
    label: 'Review',
    iconName: 'Eye',
    effect: 'Marks this thread as reviewed for the rest of this visit. Nothing is saved.',
    mutatesSession: true,
  },
  {
    kind: 'view_thread',
    label: 'View thread',
    iconName: 'Mail',
    effect: 'Opens the messages in this thread, in order.',
    mutatesSession: false,
  },
  {
    kind: 'view_summary',
    label: 'View summary',
    iconName: 'FileText',
    effect: 'Opens the full analysis, including every extraction and where it came from.',
    mutatesSession: false,
  },
  {
    kind: 'draft_reply',
    label: 'Draft reply',
    iconName: 'PenLine',
    effect: 'Opens the prepared draft for review. Nothing is written to a mailbox and nothing is sent.',
    mutatesSession: false,
  },
  {
    kind: 'defer',
    label: 'Defer',
    iconName: 'Clock',
    effect: 'Hides this thread from the working queues for the rest of this visit. Nothing is saved.',
    mutatesSession: true,
  },
  {
    kind: 'mark_waiting',
    label: 'Mark as waiting',
    iconName: 'Hourglass',
    effect: 'Moves this thread to Waiting for the rest of this visit. Nothing is saved.',
    mutatesSession: true,
  },
  {
    kind: 'suggest_task',
    label: 'Suggest a task',
    iconName: 'ListChecks',
    effect: 'Writes a task line you can copy. No task is created anywhere.',
    mutatesSession: true,
  },
  {
    kind: 'suggest_reminder',
    label: 'Suggest a reminder',
    iconName: 'BellRing',
    effect: 'Writes a reminder line you can copy, and adds its date to Actions and Deadlines as yours.',
    mutatesSession: true,
  },
];

export interface Suggestion {
  id: string;
  threadId: string;
  kind: 'task' | 'reminder';
  /** The line of text the person can copy. */
  text: string;
  /** Reminders carry a date; tasks do not have to. */
  dueAt: string | null;
  createdAt: string;
}

const IGNORED_STORAGE_KEY = 'concludo_ignored_email_threads';

function loadStoredIgnored(): string[] {
  try {
    const raw = typeof window !== 'undefined' ? localStorage.getItem(IGNORED_STORAGE_KEY) : null;
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed;
    }
  } catch (e) {
    console.warn('Could not load ignored emails:', e);
  }
  return [];
}

export interface LocalActionState {
  reviewed: readonly string[];
  deferred: readonly string[];
  markedWaiting: readonly string[];
  ignored: readonly string[];
  suggestions: readonly Suggestion[];
}

export interface LocalActionApi extends LocalActionState {
  toggleReviewed: (threadId: string) => void;
  toggleDeferred: (threadId: string) => void;
  toggleWaiting: (threadId: string) => void;
  ignoreEmail: (threadId: string, accountEmail?: string) => void;
  unignoreEmail: (threadId: string, accountEmail?: string) => void;
  addSuggestion: (s: Omit<Suggestion, 'id' | 'createdAt'>) => void;
  removeSuggestion: (id: string) => void;
  clearAll: () => void;
  /** The reminder dates, in the shape Actions and Deadlines expects. */
  userDates: UserDate[];
  /** The last thing that happened, for the live region. Null when nothing has. */
  lastAnnouncement: string | null;
}

const EMPTY: LocalActionApi = {
  reviewed: [],
  deferred: [],
  markedWaiting: [],
  ignored: [],
  suggestions: [],
  toggleReviewed: () => undefined,
  toggleDeferred: () => undefined,
  toggleWaiting: () => undefined,
  ignoreEmail: (_t?: string, _a?: string) => undefined,
  unignoreEmail: (_t?: string, _a?: string) => undefined,
  addSuggestion: () => undefined,
  removeSuggestion: () => undefined,
  clearAll: () => undefined,
  userDates: [],
  lastAnnouncement: null,
};

const LocalActionContext = createContext<LocalActionApi>(EMPTY);

export function useLocalActions(): LocalActionApi {
  return useContext(LocalActionContext);
}

function toggle(list: readonly string[], id: string): string[] {
  return list.includes(id) ? list.filter((x) => x !== id) : [...list, id];
}

export const LocalActionProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [state, setState] = useState<LocalActionState>(() => ({
    reviewed: [],
    deferred: [],
    markedWaiting: [],
    ignored: loadStoredIgnored(),
    suggestions: [],
  }));
  const [lastAnnouncement, setLastAnnouncement] = useState<string | null>(null);

  // Sync ignored email records from Supabase on session start
  useEffect(() => {
    let isMounted = true;
    async function syncIgnoredFromDatabase() {
      try {
        const supabase = getSupabaseBrowserClient();
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;
        const { data, error } = await supabase
          .from('user_email_actions')
          .select('thread_id')
          .eq('user_id', user.id)
          .eq('action', 'ignore');
        if (!error && Array.isArray(data) && isMounted) {
          const dbIds = data.map((r: any) => r.thread_id);
          setState((prev) => {
            const merged = Array.from(new Set([...prev.ignored, ...dbIds]));
            return { ...prev, ignored: merged };
          });
        }
      } catch (err) {
        console.warn('Could not sync user_email_actions from database:', err);
      }
    }
    syncIgnoredFromDatabase();
    return () => { isMounted = false; };
  }, []);

  // Every action announces what it did, because several of them change a list
  // the person may not be looking at. A deferral that silently removes a row is
  // indistinguishable from a bug.
  const announce = useCallback((text: string) => setLastAnnouncement(text), []);

  const toggleReviewed = useCallback(
    (threadId: string) =>
      setState((s) => {
        const now = toggle(s.reviewed, threadId);
        announce(now.includes(threadId) ? 'Marked as reviewed for this visit.' : 'No longer marked as reviewed.');
        return { ...s, reviewed: now };
      }),
    [announce]
  );

  const toggleDeferred = useCallback(
    (threadId: string) =>
      setState((s) => {
        const now = toggle(s.deferred, threadId);
        announce(
          now.includes(threadId)
            ? 'Deferred for this visit. It returns on reload, because nothing is saved.'
            : 'No longer deferred.'
        );
        return { ...s, deferred: now };
      }),
    [announce]
  );

  const ignoreEmail = useCallback(
    (threadId: string, accountEmail?: string) => {
      setState((s) => {
        const next = Array.from(new Set([...s.ignored, threadId]));
        try {
          if (typeof window !== 'undefined') {
            localStorage.setItem(IGNORED_STORAGE_KEY, JSON.stringify(next));
            if (accountEmail) {
              localStorage.setItem(`concludo_ignored_email_threads_${accountEmail}`, JSON.stringify(next));
            }
          }
        } catch (e) {
          console.warn('Could not persist ignored email to localStorage:', e);
        }
        announce('Email ignored and marked as done. Excluded from Email Command Centre.');
        // Persist to Supabase user_email_actions asynchronously
        (async () => {
          try {
            const supabase = getSupabaseBrowserClient();
            const { data: { user } } = await supabase.auth.getUser();
            if (user) {
              await supabase.from('user_email_actions').upsert({
                user_id: user.id,
                thread_id: threadId,
                action: 'ignore',
                account_email: accountEmail || null,
              }, { onConflict: 'user_id,thread_id,action' });
            }
          } catch (e) {
            console.warn('Could not persist email action to database:', e);
          }
        })();
        return { ...s, ignored: next };
      });
    },
    [announce]
  );

  const unignoreEmail = useCallback(
    (threadId: string, accountEmail?: string) => {
      setState((s) => {
        const next = s.ignored.filter((id) => id !== threadId);
        try {
          if (typeof window !== 'undefined') {
            localStorage.setItem(IGNORED_STORAGE_KEY, JSON.stringify(next));
            if (accountEmail) {
              localStorage.setItem(`concludo_ignored_email_threads_${accountEmail}`, JSON.stringify(next));
            }
          }
        } catch (e) {
          console.warn('Could not persist unignored email to localStorage:', e);
        }
        announce('Email un-ignored.');
        // Remove from Supabase user_email_actions asynchronously
        (async () => {
          try {
            const supabase = getSupabaseBrowserClient();
            const { data: { user } } = await supabase.auth.getUser();
            if (user) {
              await supabase.from('user_email_actions').delete()
                .eq('user_id', user.id)
                .eq('thread_id', threadId)
                .eq('action', 'ignore');
            }
          } catch (e) {
            console.warn('Could not remove email action from database:', e);
          }
        })();
        return { ...s, ignored: next };
      });
    },
    [announce]
  );

  const toggleWaiting = useCallback(
    (threadId: string) =>
      setState((s) => {
        const now = toggle(s.markedWaiting, threadId);
        announce(
          now.includes(threadId)
            ? 'Marked as waiting on someone else, for this visit.'
            : 'No longer marked as waiting.'
        );
        return { ...s, markedWaiting: now };
      }),
    [announce]
  );

  const addSuggestion = useCallback<LocalActionApi['addSuggestion']>(
    (s) =>
      setState((prev) => {
        const id = `sug-${prev.suggestions.length + 1}-${s.threadId}`;
        announce(
          s.kind === 'task'
            ? 'Task line written below. No task was created anywhere.'
            : 'Reminder line written below, and its date added to Actions and Deadlines.'
        );
        return {
          ...prev,
          suggestions: [
            ...prev.suggestions,
            { ...s, id, createdAt: new Date().toISOString() },
          ],
        };
      }),
    [announce]
  );

  const removeSuggestion = useCallback(
    (id: string) =>
      setState((s) => {
        announce('Suggestion removed.');
        return { ...s, suggestions: s.suggestions.filter((x) => x.id !== id) };
      }),
    [announce]
  );

  const clearAll = useCallback(() => {
    try {
      if (typeof window !== 'undefined') {
        localStorage.removeItem(IGNORED_STORAGE_KEY);
      }
    } catch (e) {
      console.warn('Could not clear ignored emails from localStorage:', e);
    }
    setState({ reviewed: [], deferred: [], markedWaiting: [], ignored: [], suggestions: [] });
    announce('Every change made in this visit has been cleared.');
  }, [announce]);

  const userDates = useMemo(
    () =>
      state.suggestions
        .filter((s) => s.kind === 'reminder' && s.dueAt)
        .map((s) => ({
          id: s.id,
          threadId: s.threadId,
          description: s.text,
          dueAt: s.dueAt as string,
        })),
    [state.suggestions]
  );

  const value: LocalActionApi = {
    ...state,
    toggleReviewed,
    toggleDeferred,
    toggleWaiting,
    ignoreEmail,
    unignoreEmail,
    addSuggestion,
    removeSuggestion,
    clearAll,
    userDates,
    lastAnnouncement,
  };

  return React.createElement(LocalActionContext.Provider, { value }, children);
};

/**
 * Applies the session state to a list of threads.
 *
 * Deferred threads leave the working queues. They are not deleted and they are
 * not hidden from All Email, because a thread a person cannot find is a thread
 * the module has taken from them.
 */
export function withoutDeferred<T extends { thread: { id: string } }>(
  records: readonly T[],
  deferred: readonly string[]
): T[] {
  if (deferred.length === 0) return records.slice();
  return records.filter((r) => !deferred.includes(r.thread.id));
}
