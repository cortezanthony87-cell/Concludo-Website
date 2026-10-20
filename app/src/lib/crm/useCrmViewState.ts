/**
 * The hook that keeps the CRM's choices in the URL.
 *
 * Two things it guarantees, both of them brief requirements:
 *
 * 1. **Filters survive moving between views.** `linkTo` carries the current
 *    query string onto every internal link, so clicking a tab keeps the
 *    organisation, pipeline, owner, range, record type, search and saved view.
 *    This is why nothing in the module uses a bare `<Link to="/crm/...">`.
 *
 * 2. **Dashboard position survives too.** Scroll offset is remembered per path
 *    and restored on return, which a query string cannot sensibly carry.
 */
import { useCallback, useEffect, useMemo } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { CrmViewState } from './types';
import {
  parseCrmViewState,
  recallCrmScroll,
  rememberCrmScroll,
  serialiseCrmViewState,
} from './viewState';
import { setActiveWorkspaceId } from './customWorkspaceStore';

export interface UseCrmViewState {
  viewState: CrmViewState;
  setViewState: (next: Partial<CrmViewState>) => void;
  /** Adds the current query string to an internal path. */
  linkTo: (path: string) => string;
  /** The current query string, including the leading question mark, or ''. */
  query: string;
}

export function useCrmViewState(): UseCrmViewState {
  const location = useLocation();
  const navigate = useNavigate();

  const viewState = useMemo(() => parseCrmViewState(location.search), [location.search]);

  const setViewState = useCallback(
    (next: Partial<CrmViewState>) => {
      if (next.workspaceId) {
        setActiveWorkspaceId(next.workspaceId);
      }
      // Changing any filter by hand clears the saved view, unless the change is
      // the saved view itself. A named view whose filters no longer match it is
      // a lie about what the person is looking at.
      const clearsSavedView = !('savedView' in next);
      const merged: CrmViewState = {
        ...viewState,
        ...next,
        savedView: clearsSavedView ? null : (next.savedView ?? null),
      };
      navigate({ pathname: location.pathname, search: serialiseCrmViewState(merged) }, { replace: true });
    },
    [viewState, navigate, location.pathname]
  );

  const query = useMemo(() => serialiseCrmViewState(viewState), [viewState]);

  const linkTo = useCallback(
    (path: string) => {
      if (!query) return path;
      return path.includes('?') ? `${path}&${query.slice(1)}` : `${path}${query}`;
    },
    [query]
  );

  return { viewState, setViewState, linkTo, query };
}

/**
 * Remembers where the person was on each view.
 *
 * The scroll container is the module's own main region rather than the window,
 * because the application's shell already owns the window scroll and two things
 * fighting over it produces a jump on every navigation.
 */
export function useCrmScrollMemory(ref: React.RefObject<HTMLElement>): void {
  const location = useLocation();

  useEffect(() => {
    const element = ref.current;
    if (!element) return;

    const remembered = recallCrmScroll(location.pathname);
    // One frame later, so the view has rendered its own height first.
    const frame = window.requestAnimationFrame(() => {
      element.scrollTop = remembered;
    });

    const onScroll = () => rememberCrmScroll(location.pathname, element.scrollTop);
    element.addEventListener('scroll', onScroll, { passive: true });

    return () => {
      window.cancelAnimationFrame(frame);
      rememberCrmScroll(location.pathname, element.scrollTop);
      element.removeEventListener('scroll', onScroll);
    };
  }, [location.pathname, ref]);
}
