/**
 * A workspace at size, for measuring against.
 *
 * The brief sets the sizes this has to work at: a thousand, ten thousand and a
 * hundred thousand people, ten thousand organisations, a hundred thousand
 * activities. None of those are reachable with hand-written fixture data, so
 * this generates them.
 *
 * THE DATA IS SYNTHETIC AND COULD NOT REACH ANYBODY. Names are built from a
 * fixed list of surnames and given names combined with an index, every address
 * is at `.example` (RFC 2606, unregistrable), and every phone number is in the
 * reserved fictional range. The generator is deterministic from a seed, so a
 * measurement can be repeated and a regression is a real regression rather
 * than a different dataset.
 *
 * WHY A GENERATOR AND NOT A DUMP. A dump of real data is the normal way to load
 * test a CRM, and it is how customer records end up in a test environment with
 * none of the controls of the real one. There is no mechanism here to load real
 * data, which is the point.
 */

import {
  Activity,
  CrmWorkspace,
  CrmWorkspaceData,
  Organisation,
  Person,
  WorkItem,
} from '../domain';
import { emptyData } from '../data/factory';

const GIVEN = [
  'Alinta', 'Bo', 'Caitlin', 'Dermot', 'Eun', 'Farid', 'Grace', 'Hamid',
  'Imogen', 'Jarrah', 'Kiri', 'Lachlan', 'Mele', 'Niamh', 'Omar', 'Pia',
  'Quinn', 'Rosa', 'Sione', 'Tahlia', 'Uma', 'Viktor', 'Wen', 'Xanthe',
  'Yusuf', 'Zara',
];

const FAMILY = [
  'Abbott', 'Baptiste', 'Carmody', 'Dhillon', 'Eastwell', 'Farrugia',
  'Gallagher', 'Hoang', 'Iredale', 'Jovanovic', 'Kirkbride', 'Lowrie',
  'Maguire', 'Nalder', 'Oyelaran', 'Petrakis', 'Quayle', 'Rasheed',
  'Sandoval', 'Thistlewood', 'Underhill', 'Vuong', 'Whitlam', 'Xiong',
  'Yarrow', 'Zammit',
];

const INDUSTRIES = [
  'Construction', 'Professional services', 'Hospitality', 'Manufacturing',
  'Retail', 'Transport', 'Health services', 'Education', 'Agriculture',
  'Property',
];

/** A small deterministic generator. Not for anything that needs randomness. */
function seeded(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state * 1_664_525 + 1_013_904_223) >>> 0;
    return state / 4_294_967_296;
  };
}

export interface ScaleSpec {
  people: number;
  organisations: number;
  activities: number;
  workItems: number;
  seed?: number;
}

export const SCALE_POINTS: Record<string, ScaleSpec> = {
  small: { people: 1_000, organisations: 200, activities: 2_000, workItems: 200 },
  medium: { people: 10_000, organisations: 2_000, activities: 20_000, workItems: 2_000 },
  large: { people: 100_000, organisations: 10_000, activities: 100_000, workItems: 10_000 },
};

const DAY = 86_400_000;

export function generateWorkspace(spec: ScaleSpec, now: string): CrmWorkspaceData {
  const random = seeded(spec.seed ?? 20_261_014);
  const nowMs = new Date(now).getTime();
  const at = (daysBack: number): string => new Date(nowMs - daysBack * DAY).toISOString();

  const workspace: CrmWorkspace = {
    id: 'ws-scale',
    name: 'Synthetic workspace, for measurement',
    depth: 'enterprise',
    recordTerminology: 'opportunity',
    recordTerminologyPlural: 'opportunities',
    terminology: {},
    linkedTeamId: null,
    linkedOrganizationId: null,
    workspaceScope: 'work',
    createdBy: 'user-scale',
    accountPlanningEnabled: false,
    createdAt: at(400),
    updatedAt: now,
    deletedAt: null,
    deletedBy: null,
    purgeAfter: null,
  };

  const data = emptyData(workspace, [
    {
      id: 'mem-scale',
      crmWorkspaceId: workspace.id,
      userId: 'user-scale',
      crmRole: 'crm_admin',
      createdAt: at(400),
      updatedAt: at(400),
    },
  ]);

  const pipelineId = 'pipe-scale';
  data.pipelines.push({
    id: pipelineId,
    crmWorkspaceId: workspace.id,
    name: 'Standard',
    workItemType: 'opportunity',
    isDefault: true,
    createdAt: at(400),
    updatedAt: at(400),
    deletedAt: null,
    deletedBy: null,
    purgeAfter: null,
  });

  const stageNames = ['Enquiry', 'Qualified', 'Proposal', 'Decision', 'Won', 'Not proceeding'];
  stageNames.forEach((name, index) => {
    data.stages.push({
      id: `stage-scale-${index}`,
      crmWorkspaceId: workspace.id,
      pipelineId,
      name,
      stageOrder: index,
      typicalDays: 7 * (index + 1),
      isClosed: index >= 4,
      closedDisposition: index === 4 ? 'won' : index === 5 ? 'not_proceeding' : null,
      createdAt: at(400),
      updatedAt: at(400),
    });
  });

  for (let i = 0; i < spec.organisations; i += 1) {
    const organisation: Organisation = {
      id: `org-${i}`,
      crmWorkspaceId: workspace.id,
      name: `${FAMILY[i % FAMILY.length]} ${['Group', 'Partners', 'Holdings', 'Pty Ltd', 'Collective'][i % 5]} ${i}`,
      legalName: null,
      tradingName: null,
      abn: null,
      industry: INDUSTRIES[i % INDUSTRIES.length],
      website: null,
      parentOrganisationId: i > 0 && i % 25 === 0 ? `org-${i - 1}` : null,
      hierarchyDepth: i > 0 && i % 25 === 0 ? 1 : 0,
      ownerUserId: 'user-scale',
      relationshipOwnerUserId: 'user-scale',
      dataQualityOwnerUserId: i % 3 === 0 ? 'user-scale' : null,
      lifecycleState: i % 7 === 0 ? 'prospect' : i % 11 === 0 ? 'dormant' : 'active',
      renewalDate: null,
      createdAt: at(300 - (i % 280)),
      updatedAt: at(1 + (i % 90)),
      deletedAt: null,
      deletedBy: null,
      purgeAfter: null,
    };
    data.organisations.push(organisation);
  }

  for (let i = 0; i < spec.people; i += 1) {
    const given = GIVEN[i % GIVEN.length];
    const family = FAMILY[(i * 7) % FAMILY.length];
    const person: Person = {
      id: `per-${i}`,
      crmWorkspaceId: workspace.id,
      fullName: `${given} ${family} ${i}`,
      givenName: given,
      familyName: family,
      // RFC 2606 reserves .example, so nothing here can be delivered.
      primaryEmail: i % 9 === 0 ? null : `${given.toLowerCase()}.${i}@business${i % 50}.example`,
      secondaryEmail: null,
      // The 0491 570 1xx range is reserved for fiction in Australia.
      phone: i % 5 === 0 ? '0491 570 156' : null,
      primaryEmailScope: 'work',
      organisationId: spec.organisations > 0 ? `org-${i % spec.organisations}` : null,
      roleLabel: null,
      ownerUserId: 'user-scale',
      relationshipOwnerUserId: 'user-scale',
      mergedIntoPersonId: null,
      createdAt: at(300 - (i % 290)),
      updatedAt: at(1 + (i % 120)),
      deletedAt: null,
      deletedBy: null,
      purgeAfter: null,
    };
    data.people.push(person);

    if (i % 4 === 0) {
      data.consentRecords.push({
        id: `cons-${i}`,
        crmWorkspaceId: workspace.id,
        personId: person.id,
        consentType: 'contact',
        basis: 'express',
        capturedAt: at(200 - (i % 190)),
        capturedFrom: 'Synthetic',
        capturedBy: 'user-scale',
        expiresAt: null,
        withdrawnAt: null,
        withdrawalNote: null,
        createdAt: at(200),
        updatedAt: at(200),
      });
    }
  }

  for (let i = 0; i < spec.workItems; i += 1) {
    const stageIndex = Math.floor(random() * 6);
    const item: WorkItem = {
      id: `wi-${i}`,
      crmWorkspaceId: workspace.id,
      workItemType: 'opportunity',
      title: `Project ${i}`,
      organisationId: spec.organisations > 0 ? `org-${i % spec.organisations}` : null,
      primaryPersonId: spec.people > 0 ? `per-${i % spec.people}` : null,
      pipelineId,
      stageId: `stage-scale-${stageIndex}`,
      enteredStageAt: at(1 + (i % 120)),
      status: stageIndex === 4 ? 'won' : stageIndex === 5 ? 'not_proceeding' : 'open',
      ownerUserId: 'user-scale',
      valueAmount: 2_000 + (i % 40) * 500,
      valueCurrency: 'AUD',
      valueBasis: 'stated',
      expectedCloseDate: new Date(nowMs + (i % 90) * DAY).toISOString().slice(0, 10),
      nextStep: i % 6 === 0 ? null : 'Follow up',
      nextStepDue: i % 6 === 0 ? null : new Date(nowMs + (i % 21) * DAY).toISOString().slice(0, 10),
      actionOwnerUserId: 'user-scale',
      resolvedAt: stageIndex >= 4 ? at(1 + (i % 30)) : null,
      resolutionReason: stageIndex >= 4 ? 'Recorded by the generator' : null,
      createdAt: at(200 - (i % 190)),
      updatedAt: at(1 + (i % 90)),
      deletedAt: null,
      deletedBy: null,
      purgeAfter: null,
    };
    data.workItems.push(item);
  }

  const types: Activity['activityType'][] = ['meeting', 'call', 'email', 'note', 'document'];
  for (let i = 0; i < spec.activities; i += 1) {
    const activity: Activity = {
      id: `act-${i}`,
      crmWorkspaceId: workspace.id,
      activityType: types[i % types.length],
      title: `Conversation ${i}`,
      summary: null,
      occurredAt: at(i % 365),
      // One in forty is attached to nothing, so the unlinked-activity
      // indicator has something to count at every size.
      organisationId: i % 40 === 0 || spec.organisations === 0 ? null : `org-${i % spec.organisations}`,
      workItemId: null,
      isMeaningfulContact: i % 3 === 0,
      followThroughOutstanding: i % 17 === 0,
      followThroughReason: i % 17 === 0 ? 'Nothing recorded against it' : null,
      createdBy: 'user-scale',
      createdAt: at(i % 365),
      updatedAt: at(i % 365),
      deletedAt: null,
      deletedBy: null,
      purgeAfter: null,
    };
    data.activities.push(activity);

    if (i % 4 === 0 && spec.people > 0) {
      data.activityParticipants.push({
        id: `ap-${i}`,
        crmWorkspaceId: workspace.id,
        activityId: activity.id,
        personId: `per-${i % spec.people}`,
        unresolvedName: null,
        participantRole: 'attendee',
      });
    }
  }

  return data;
}

export function describeSize(data: CrmWorkspaceData): string {
  return [
    `${data.people.length.toLocaleString('en-AU')} people`,
    `${data.organisations.length.toLocaleString('en-AU')} organisations`,
    `${data.activities.length.toLocaleString('en-AU')} activities`,
    `${data.workItems.length.toLocaleString('en-AU')} work items`,
  ].join(', ');
}
