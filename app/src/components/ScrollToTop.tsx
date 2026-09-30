import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';

export function resetAllScrollPositions(options?: { preserveSidebar?: boolean }) {
  window.scrollTo({ top: 0, left: 0, behavior: 'instant' as ScrollBehavior });
  if (document.documentElement) document.documentElement.scrollTop = 0;
  if (document.body) document.body.scrollTop = 0;
  const mainArea = document.querySelector('.main-content-area');
  if (mainArea) mainArea.scrollTop = 0;
  // Reset other scroll containers but strictly preserve left-sidebar scroll position so navigating side tabs stays where you last left off
  const scrollContainers = document.querySelectorAll('.app-container, .app-shell-body, [data-scroll-container]');
  scrollContainers.forEach((el) => {
    if (el.classList.contains('left-sidebar')) return;
    (el as HTMLElement).scrollTop = 0;
  });
}

/**
 * ScrollToTop ensures that whenever the route pathname or search parameters change,
 * the view automatically scrolls all the way to the top of both the window and
 * all scrollable containers.
 */
export const ScrollToTop = () => {
  const { pathname, search, hash } = useLocation();

  useEffect(() => {
    if (hash) {
      // Do not attempt querySelector if hash contains token parameters (e.g. #access_token=...)
      if (!hash.includes('access_token=') && !hash.includes('refresh_token=')) {
        try {
          const targetElement = document.querySelector(hash);
          if (targetElement) {
            targetElement.scrollIntoView({ behavior: 'smooth' });
            return;
          }
        } catch (selectorErr) {
          // If hash is not a valid CSS selector, safely fallback to top scrolling
        }
      }
    }

    resetAllScrollPositions();

    // Rerun on next animation frame in case content takes a tick to mount
    const rafId = requestAnimationFrame(() => {
      resetAllScrollPositions();
    });

    const timer = setTimeout(() => {
      resetAllScrollPositions();
    }, 60);

    return () => {
      cancelAnimationFrame(rafId);
      clearTimeout(timer);
    };
  }, [pathname, search, hash]);

  return null;
};
