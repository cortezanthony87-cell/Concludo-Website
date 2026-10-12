/**
 * The React binding for view state. All logic lives in viewState.ts, which is
 * pure and tested. This file only connects it to the router.
 */
import { useCallback, useEffect, useMemo, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { EmailViewState } from './types';
import { parseViewState, serialiseViewState, rememberScroll, recallScroll } from './viewState';
import { DEFAULT_ACCOUNT_ID } from './shellAdapter';

export interface UseEmailViewState {
  viewState: EmailViewState;
  /** Merges a partial change and writes it to the URL, replacing history. */
  setViewState: (patch: Partial<EmailViewState>) => void;
  /** Appends the current state to a module path, so tabs keep the person's context. */
  linkTo: (path: string) => string;
}

export function useEmailViewState(): UseEmailViewState {
  const location = useLocation();
  const navigate = useNavigate();

  const viewState = useMemo(
    () => parseViewState(location.search, DEFAULT_ACCOUNT_ID),
    [location.search]
  );

  const setViewState = useCallback(
    (patch: Partial<EmailViewState>) => {
      const next = { ...viewState, ...patch };
      const query = serialiseViewState(next);
      navigate({ pathname: location.pathname, search: query ? `?${query}` : '' }, { replace: true });
    },
    [viewState, location.pathname, navigate]
  );

  const linkTo = useCallback(
    (path: string) => {
      const query = serialiseViewState(viewState);
      return query ? `${path}?${query}` : path;
    },
    [viewState]
  );

  return { viewState, setViewState, linkTo };
}

/**
 * Restores scroll within the module.
 *
 * WorkspaceLayout resets scroll on every route change, which is right for the
 * application and wrong for moving between tabs of one module. This restores
 * the remembered offset for the path being entered, after the reset has run.
 */
export function useEmailScrollMemory(scrollRef: React.RefObject<HTMLElement>): void {
  const location = useLocation();
  const previousPath = useRef<string | null>(null);

  useEffect(() => {
    const element = scrollRef.current;
    const leaving = previousPath.current;

    if (leaving && element) rememberScroll(leaving, element.scrollTop);
    previousPath.current = location.pathname;

    if (!element) return;
    const offset = recallScroll(location.pathname);
    const frame = window.requestAnimationFrame(() => {
      element.scrollTop = offset;
    });
    return () => window.cancelAnimationFrame(frame);
  }, [location.pathname, scrollRef]);

  useEffect(() => {
    const element = scrollRef.current;
    return () => {
      if (element && previousPath.current) rememberScroll(previousPath.current, element.scrollTop);
    };
  }, [scrollRef]);
}
