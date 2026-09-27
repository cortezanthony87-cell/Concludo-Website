import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';

/**
 * ScrollToTop ensures that whenever the route pathname or search parameters change
 * (such as clicking sidebar navigation links or sub-navigation tabs), the view automatically
 * scrolls all the way to the top of both the window and the main scrollable content area.
 */
export const ScrollToTop = () => {
  const { pathname, search, hash } = useLocation();

  useEffect(() => {
    // If a hash anchor is provided, scroll to the designated element smoothly
    if (hash) {
      const targetElement = document.querySelector(hash);
      if (targetElement) {
        targetElement.scrollIntoView({ behavior: 'smooth' });
        return;
      }
    }

    // Scroll browser window to the top
    window.scrollTo({ top: 0, left: 0, behavior: 'instant' as ScrollBehavior });

    // Scroll main-content-area to top (in case layout overflow is on the container)
    const mainArea = document.querySelector('.main-content-area');
    if (mainArea) {
      mainArea.scrollTop = 0;
    }

    // Also check documentElement and body
    if (document.documentElement) {
      document.documentElement.scrollTop = 0;
    }
    if (document.body) {
      document.body.scrollTop = 0;
    }
  }, [pathname, search, hash]);

  return null;
};
