/**
 * The route table, derived from the destination list.
 *
 * WHY THIS FILE EXISTS.
 *
 * The Email Command Centre's Stage 2 shipped a hand-written route list beside a
 * hand-written tab list. Three of the ten paths disagreed, three tabs would
 * have fallen through to the login page, and the tests did not catch it because
 * they compared the tab list with itself.
 *
 * `Record<CrmModulePath, ComponentType>` is the fix. Adding a destination
 * without a page, or a page without a destination, is a compile error rather
 * than a defect somebody finds by clicking.
 */
import { ComponentType } from 'react';
import { CrmModulePath } from '../../lib/crm/types';
import { CRM_MODULE_DESTINATIONS } from '../../lib/crm/moduleNav';

import { CrmTodayPage } from './CrmTodayPage';
import { CrmAttentionPage } from './CrmAttentionPage';
import { CrmDashboardPage } from './CrmDashboardPage';
import { CrmKamPage } from './CrmKamPage';
import { CrmMemoryPage } from './CrmMemoryPage';
import { CrmPeoplePage } from './CrmPeoplePage';
import { CrmCapturePage } from './CrmCapturePage';
import { CrmForecastPage } from './CrmForecastPage';
import { CrmWorkItemPage } from './CrmWorkItemPage';
import { CrmHierarchyPage } from './CrmHierarchyPage';
import { CrmCoveragePage } from './CrmCoveragePage';
import { CrmPersonPage } from './CrmPersonPage';
import { CrmOrganisationPage } from './CrmOrganisationPage';
import { CrmRelationshipsPage } from './CrmRelationshipsPage';
import { CrmOrganisationsPage } from './CrmOrganisationsPage';
import { CrmLeadsPage } from './CrmLeadsPage';
import { CrmPipelinePage } from './CrmPipelinePage';
import { CrmActivitiesPage } from './CrmActivitiesPage';
import { CrmCommitmentsPage } from './CrmCommitmentsPage';
import { CrmAccountPlansPage } from './CrmAccountPlansPage';
import { CrmAccountPlanPage } from './CrmAccountPlanPage';
import { CrmStakeholderMapPage } from './CrmStakeholderMapPage';
import { CrmWhitespacePage } from './CrmWhitespacePage';
import { CrmJointPlanPage } from './CrmJointPlanPage';
import { CrmAccountReviewPage } from './CrmAccountReviewPage';
import { CrmServicePage } from './CrmServicePage';
import { CrmProposalsPage } from './CrmProposalsPage';
import { CrmProposalPage } from './CrmProposalPage';
import { CrmReportsPage } from './CrmReportsPage';
import { CrmDataQualityPage } from './CrmDataQualityPage';
import { CrmImportsPage } from './CrmImportsPage';
import { CrmSettingsPage } from './CrmSettingsPage';

/** Every destination has exactly one page. The type enforces it. */
const COMPONENTS: Record<CrmModulePath, ComponentType> = {
  '/crm': CrmTodayPage,
  '/crm/attention': CrmAttentionPage,
  '/crm/dashboard': CrmDashboardPage,
  '/crm/memory': CrmMemoryPage,
  '/crm/kam': CrmKamPage,
  '/crm/relationships': CrmRelationshipsPage,
  '/crm/people': CrmPeoplePage,
  '/crm/organisations': CrmOrganisationsPage,
  '/crm/hierarchy': CrmHierarchyPage,
  '/crm/coverage': CrmCoveragePage,
  '/crm/capture': CrmCapturePage,
  '/crm/forecast': CrmForecastPage,
  '/crm/leads': CrmLeadsPage,
  '/crm/pipeline': CrmPipelinePage,
  '/crm/activities': CrmActivitiesPage,
  '/crm/commitments': CrmCommitmentsPage,
  '/crm/account-plans': CrmAccountPlansPage,
  '/crm/service': CrmServicePage,
  '/crm/proposals': CrmProposalsPage,
  '/crm/reports': CrmReportsPage,
  '/crm/data-quality': CrmDataQualityPage,
  '/crm/imports': CrmImportsPage,
  '/crm/settings': CrmSettingsPage,
};

export interface CrmRouteEntry {
  path: CrmModulePath;
  /** The child segment, relative to the `/crm` parent route. */
  segment: string;
  isIndex: boolean;
  Component: ComponentType;
}

export const CRM_ROUTES: CrmRouteEntry[] = CRM_MODULE_DESTINATIONS.map((destination) => ({
  path: destination.path,
  segment: destination.path === '/crm' ? '' : destination.path.replace('/crm/', ''),
  isIndex: destination.path === '/crm',
  Component: COMPONENTS[destination.path],
}));

/**
 * Routes inside the module that are not tabs.
 *
 * Stage 4 filled the slot Stage 2 left for them. They are kept out of the
 * destination list on purpose: a tab row that gains a "currently open contact"
 * entry changes shape as a person works, and the tabs are a fixed map of the
 * module rather than a history of where somebody has been.
 */
export const CRM_DETAIL_ROUTES: { segment: string; Component: ComponentType }[] = [
  { segment: 'people/:personId', Component: CrmPersonPage },
  { segment: 'organisations/:organisationId', Component: CrmOrganisationPage },
  { segment: 'work/:workItemId', Component: CrmWorkItemPage },

  /* Stage 6. Five routes, one tab.
   *
   * The plan, the stakeholder map, the whitespace grid, the joint plan and the
   * review are all reached from the plan rather than from the tab row. A
   * feature that adds five destinations to everybody's navigation has not been
   * kept out of the way of the people who do not need it, which is the thing
   * Stage 6 was asked to get right. The one tab it does add disappears
   * entirely when account planning is off. */
  { segment: 'account-plans/joint/:jointPlanId', Component: CrmJointPlanPage },
  { segment: 'account-plans/:organisationId', Component: CrmAccountPlanPage },
  { segment: 'account-plans/:organisationId/stakeholders', Component: CrmStakeholderMapPage },
  { segment: 'account-plans/:organisationId/whitespace', Component: CrmWhitespacePage },
  { segment: 'account-plans/:organisationId/review', Component: CrmAccountReviewPage },

  /* Stage 7. One route, under the destination that already exists. */
  { segment: 'proposals/:proposalId', Component: CrmProposalPage },
];
