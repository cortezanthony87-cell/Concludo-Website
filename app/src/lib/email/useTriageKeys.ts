/**
 * Keyboard triage for the views that list threads.
 *
 * J moves to the next thread, K to the previous, O opens the one in focus, and
 * R marks it reviewed. The keys do nothing while a person is typing, while a
 * dialog is open, or when a modifier key is held, so they cannot collide with
 * a browser shortcut or a form.
 *
 * Every move lands on a real element and focus is visible, so a screen reader
 * announces the thread's heading as it arrives. Nothing here sends, files or
 * deletes: opening a thread navigates, and reviewing is a mark kept for this
 * visit only.
 */
import { RefObject, useEffect } from 'react';

const TYPING = 'input, textarea, select, [contenteditable=""], [contenteditable="true"]';

export interface TriageKeyHandlers {
  onOpen: (threadId: string) => void;
  onReview: (threadId: string) => void;
}

/** The thread rows inside a container, in document order. */
export function triageRows(container: ParentNode): HTMLElement[] {
  return Array.from(container.querySelectorAll<HTMLElement>('[data-thread-id]'));
}

/** Which row index should be focused after a key, given where focus is now. */
export function nextIndex(current: number, count: number, key: 'j' | 'k'): number {
  if (count === 0) return -1;
  if (current < 0) return key === 'j' ? 0 : count - 1;
  const next = key === 'j' ? current + 1 : current - 1;
  return Math.min(count - 1, Math.max(0, next));
}

export function useTriageKeys(
  containerRef: RefObject<HTMLElement | null>,
  enabled: boolean,
  handlers: TriageKeyHandlers
): void {
  const { onOpen, onReview } = handlers;

  useEffect(() => {
    if (!enabled) return;

    const listener = (event: KeyboardEvent) => {
      if (event.defaultPrevented) return;
      if (event.ctrlKey || event.metaKey || event.altKey) return;
      const key = event.key.toLowerCase();
      if (key !== 'j' && key !== 'k' && key !== 'o' && key !== 'r') return;

      const target = event.target as HTMLElement | null;
      if (target?.closest?.(TYPING)) return;
      if (document.querySelector('[aria-modal="true"]')) return;

      const container = containerRef.current;
      if (!container) return;
      const rows = triageRows(container);
      if (rows.length === 0) return;

      const active = document.activeElement as HTMLElement | null;
      const current = active ? rows.findIndex((row) => row === active || row.contains(active)) : -1;

      if (key === 'j' || key === 'k') {
        const index = nextIndex(current, rows.length, key);
        if (index < 0) return;
        event.preventDefault();
        const row = rows[index];
        row.focus({ preventScroll: true });
        row.scrollIntoView({ block: 'nearest' });
        return;
      }

      if (current < 0) return;
      const id = rows[current].dataset.threadId;
      if (!id) return;
      event.preventDefault();
      if (key === 'o') onOpen(id);
      else onReview(id);
    };

    document.addEventListener('keydown', listener);
    return () => document.removeEventListener('keydown', listener);
  }, [containerRef, enabled, onOpen, onReview]);
}
