/**
 * The route table, derived from the destination list.
 *
 * A DEFECT FOUND IN STAGE 2, CORRECTED HERE.
 *
 * Stage 2 declared the ten destinations in `moduleNav.ts` and then separately
 * specified the ten routes in the patch for `App.tsx`. Three of them did not
 * match: `moduleNav` used `/email/reply-queue`, `/email/actions-deadlines` and
 * `/email/security-review`, while the route patch registered `/email/replies`,
 * `/email/actions` and `/email/security`. Three of the ten tabs would have
 * fallen through to the application's catch-all and redirected to the login
 * page. The Stage 2 tests did not catch it because they checked the tab list
 * against itself; the build did not catch it because a path is a string; and
 * the screenshots did not catch it because a screenshot does not click.
 *
 * The fix is not to correct the three strings. Two hand-maintained lists of the
 * same ten paths will drift again. This file makes the route table a function of
 * the destination list, so adding a tab without a route, or a route without a
 * tab, is a type error rather than a redirect to the login page.
 */
import React from 'react';
import { EMAIL_MODULE_DESTINATIONS } from '../../lib/email/moduleNav';
import { EmailModulePath } from '../../lib/email/types';

import { EmailOverviewPage } from './EmailOverviewPage';
import { EmailNeedsAttentionPage } from './EmailNeedsAttentionPage';
import { EmailReplyQueuePage } from './EmailReplyQueuePage';
import { EmailActionsDeadlinesPage } from './EmailActionsDeadlinesPage';
import { EmailWaitingPage } from './EmailWaitingPage';
import { EmailQuickWinsPage } from './EmailQuickWinsPage';
import { EmailClearBacklogPage } from './EmailClearBacklogPage';
import { EmailAllPage } from './EmailAllPage';
import { EmailOutputsPage } from './EmailOutputsPage';
import { EmailSecurityReviewPage } from './EmailSecurityReviewPage';
import { EmailSettingsPage } from './EmailSettingsPage';
import { EmailThreadPage } from './EmailThreadPage';

/**
 * Every destination must appear here. `Record<EmailModulePath, ...>` is what
 * makes that mandatory: leave one out and the file does not compile.
 */
const COMPONENTS: Record<EmailModulePath, React.ComponentType> = {
  '/email': EmailOverviewPage,
  '/email/needs-attention': EmailNeedsAttentionPage,
  '/email/reply-queue': EmailReplyQueuePage,
  '/email/actions-deadlines': EmailActionsDeadlinesPage,
  '/email/waiting': EmailWaitingPage,
  '/email/quick-wins': EmailQuickWinsPage,
  '/email/clear-backlog': EmailClearBacklogPage,
  '/email/all': EmailAllPage,
  '/email/outputs': EmailOutputsPage,
  '/email/security-review': EmailSecurityReviewPage,
  '/email/settings': EmailSettingsPage,
};

/**
 * Routes that are NOT tabs.
 *
 * Stage 5 adds the thread workspace at `/email/thread/:threadId`. It is a
 * destination inside the module but it is not a tab: a tab row with a
 * "currently open thread" entry in it would change shape as a person works,
 * and the ten tabs are a fixed map of the module.
 *
 * Kept as its own list rather than bent into `EMAIL_MODULE_DESTINATIONS`, so
 * the guarantee that every tab has a route and every route has a tab survives
 * intact for the ten that are tabs.
 */
export interface EmailDetailRoute {
  /** Relative to the `/email` parent, with its parameter. */
  segment: string;
  Component: React.ComponentType;
  /** For the tests and for anything that needs to build one of these links. */
  buildPath: (threadId: string) => string;
}

export const EMAIL_DETAIL_ROUTES: readonly EmailDetailRoute[] = [
  {
    segment: 'thread/:threadId',
    Component: EmailThreadPage,
    buildPath: (threadId: string) => `/email/thread/${threadId}`,
  },
];

export interface EmailRoute {
  /** The full module path, as the tab row uses it. */
  path: EmailModulePath;
  /** The segment to register under the `/email` parent. Empty for the index. */
  segment: string;
  isIndex: boolean;
  Component: React.ComponentType;
}

/** Built from the destination list, so the tabs and the routes cannot diverge. */
export const EMAIL_ROUTES: readonly EmailRoute[] = EMAIL_MODULE_DESTINATIONS.map((d) => ({
  path: d.path,
  segment: d.path === '/email' ? '' : d.path.slice('/email/'.length),
  isIndex: d.path === '/email',
  Component: COMPONENTS[d.path],
}));
