/**
 * Concludo Project Evolution & Stage Intelligence Engine
 * 
 * Remembers the project, attached meetings, documents, and evolves project stages
 * from kick-off to delivery, tracking whether the project is on track or behind deadline.
 * Deterministically calculates stage progression, milestone completion, and status.
 */

import { ProjectSourceItem } from './transcriptExtractor';

export type ProjectStageId =
  | 'stage_1_initiation'
  | 'stage_2_discovery'
  | 'stage_3_planning'
  | 'stage_4_execution'
  | 'stage_5_review'
  | 'stage_6_closeout';

export interface ProjectStageInfo {
  id: ProjectStageId;
  stageNumber: number;
  name: string;
  shortLabel: string;
  description: string;
  status: 'completed' | 'active' | 'upcoming';
  completionPercentage: number;
}

export type ProjectScheduleStatus = 'on_track' | 'behind_deadline' | 'at_risk' | 'completed';

export interface ProjectEvolutionMetrics {
  currentStage: ProjectStageInfo;
  stages: ProjectStageInfo[];
  scheduleStatus: ProjectScheduleStatus;
  statusLabel: string;
  statusColor: string;
  totalActions: number;
  completedActions: number;
  overdueActions: number;
  openActions: number;
  completionRate: number;
  daysToDeadline: number | null;
  nearestDeadline: string | null;
  summaryNarrative: string;
}

/**
 * Standard enterprise 6-stage lifecycle for Concludo projects
 */
export const PROJECT_STAGES_DEFINITION = [
  {
    id: 'stage_1_initiation' as ProjectStageId,
    stageNumber: 1,
    name: 'Stage 1: Project Initiation & Kick-off',
    shortLabel: 'Initiation',
    description: 'Governance charter, stakeholder onboarding, and strategic alignment baseline.',
  },
  {
    id: 'stage_2_discovery' as ProjectStageId,
    stageNumber: 2,
    name: 'Stage 2: Discovery, Specifications & Briefs',
    shortLabel: 'Discovery',
    description: 'Technical scoping, business requirements, vendor discovery, and constraints analysis.',
  },
  {
    id: 'stage_3_planning' as ProjectStageId,
    stageNumber: 3,
    name: 'Stage 3: Strategy & Roadmap Planning',
    shortLabel: 'Planning',
    description: 'Schedule baselining, architectural trade-offs, resource allocation, and risk registry.',
  },
  {
    id: 'stage_4_execution' as ProjectStageId,
    stageNumber: 4,
    name: 'Stage 4: Execution & Workstream Delivery',
    shortLabel: 'Execution',
    description: 'Active sprint execution, technical implementation, vendor delivery, and variation paperwork.',
  },
  {
    id: 'stage_5_review' as ProjectStageId,
    stageNumber: 5,
    name: 'Stage 5: Verification, Review & Testing',
    shortLabel: 'Review & QA',
    description: 'Quality assurance, safety sign-offs, steering committee audits, and validation testing.',
  },
  {
    id: 'stage_6_closeout' as ProjectStageId,
    stageNumber: 6,
    name: 'Stage 6: Handover, Acceptance & Closeout',
    shortLabel: 'Closeout',
    description: 'Final acceptance, asset handover, executive ratification, and retrospective sign-off.',
  },
];

/**
 * Analyzes project content, sources, and action completion to determine
 * exact project evolution stage and on-track / behind deadline health.
 */
export function computeProjectEvolution(options: {
  projectTitle: string;
  meetingType?: string | null;
  sources: ProjectSourceItem[];
  actions: Array<{
    id: string;
    action_title: string;
    status: string;
    due_date?: string | null;
  }>;
  decisionsCount?: number;
  createdAt?: string;
  updatedAt?: string;
}): ProjectEvolutionMetrics {
  const { projectTitle, meetingType, sources, actions, decisionsCount = 0 } = options;

  // 1. Calculate action metrics
  const totalActions = actions.length;
  let completedActions = 0;
  let overdueActions = 0;
  let openActions = 0;

  const todayStr = new Date().toISOString().slice(0, 10);
  let nearestUpcomingDeadline: string | null = null;

  for (const act of actions) {
    const isCompleted = act.status === 'completed';
    if (isCompleted) {
      completedActions++;
    } else {
      openActions++;
      if (act.due_date) {
        if (act.due_date < todayStr || act.status === 'overdue') {
          overdueActions++;
        } else if (!nearestUpcomingDeadline || act.due_date < nearestUpcomingDeadline) {
          nearestUpcomingDeadline = act.due_date;
        }
      }
    }
  }

  const completionRate = totalActions > 0 ? Math.round((completedActions / totalActions) * 100) : 0;

  // 2. Determine Schedule Health (on track vs behind deadline)
  let scheduleStatus: ProjectScheduleStatus = 'on_track';
  let statusLabel = 'On Track';
  let statusColor = '#10B981'; // Green

  if (totalActions > 0 && completedActions === totalActions) {
    scheduleStatus = 'completed';
    statusLabel = 'Stage Completed';
    statusColor = '#10B981';
  } else if (overdueActions > 0) {
    scheduleStatus = 'behind_deadline';
    statusLabel = `${overdueActions} Overdue · Behind Deadline`;
    statusColor = '#EF4444'; // Red alert
  } else if (openActions > 0 && nearestUpcomingDeadline && nearestUpcomingDeadline === todayStr) {
    scheduleStatus = 'at_risk';
    statusLabel = 'Due Today · Immediate Action Required';
    statusColor = '#E2B53C'; // Gold warning
  } else {
    scheduleStatus = 'on_track';
    statusLabel = 'On Track';
    statusColor = '#10B981'; // Green
  }

  // Days to nearest deadline
  let daysToDeadline: number | null = null;
  if (nearestUpcomingDeadline) {
    const diffMs = new Date(nearestUpcomingDeadline).getTime() - new Date(todayStr).getTime();
    daysToDeadline = Math.round(diffMs / (1000 * 60 * 60 * 24));
  }

  // 3. Determine Active Stage based on project evolution signals
  // Factors: explicit stage mentions in text/title, meeting types, source count, completion rate
  let inferredStageNumber = 1;

  const fullText = (projectTitle + ' ' + (meetingType || '') + ' ' + sources.map((s) => s.title + ' ' + s.content).join(' ')).toLowerCase();

  // Check explicit stage patterns in project text
  const stageMatch = fullText.match(/(?:stage|phase)\s*([1-6])/i);
  if (stageMatch) {
    inferredStageNumber = Math.min(6, Math.max(1, parseInt(stageMatch[1], 10)));
  } else if (/closeout|handover|retrospective|final acceptance/i.test(fullText)) {
    inferredStageNumber = 6;
  } else if (/review|testing|qa|audit|verification|sign-off|safety/i.test(fullText)) {
    inferredStageNumber = 5;
  } else if (/execution|sprint|implementation|delivery|build|rollout|variation/i.test(fullText)) {
    inferredStageNumber = 4;
  } else if (/planning|roadmap|strategy|schedule|resource/i.test(fullText)) {
    inferredStageNumber = 3;
  } else if (/discovery|specification|brief|requirements|scoping/i.test(fullText)) {
    inferredStageNumber = 2;
  } else {
    // Stage progresses as sources and completed work accumulate
    if (sources.length >= 4 || completionRate >= 75) {
      inferredStageNumber = 5;
    } else if (sources.length >= 2 || completionRate >= 35) {
      inferredStageNumber = 4;
    } else if (sources.length > 1 || decisionsCount > 3) {
      inferredStageNumber = 3;
    } else {
      inferredStageNumber = 1;
    }
  }

  // Build stage list with status and progress
  const stages: ProjectStageInfo[] = PROJECT_STAGES_DEFINITION.map((def) => {
    let stageStatus: 'completed' | 'active' | 'upcoming' = 'upcoming';
    let progress = 0;

    if (def.stageNumber < inferredStageNumber) {
      stageStatus = 'completed';
      progress = 100;
    } else if (def.stageNumber === inferredStageNumber) {
      stageStatus = 'active';
      // Progress within active stage based on completion of actions
      progress = totalActions > 0 ? completionRate : 50;
    } else {
      stageStatus = 'upcoming';
      progress = 0;
    }

    return {
      ...def,
      status: stageStatus,
      completionPercentage: progress,
    };
  });

  const currentStage = stages.find((s) => s.stageNumber === inferredStageNumber) || stages[0];

  const summaryNarrative = `Project is currently in ${currentStage.name} (${currentStage.shortLabel}) across ${sources.length} integrated source session${sources.length === 1 ? '' : 's'}. Execution health is ${statusLabel.toLowerCase()} with ${completedActions} of ${totalActions} actions completed (${completionRate}% completion).`;

  return {
    currentStage,
    stages,
    scheduleStatus,
    statusLabel,
    statusColor,
    totalActions,
    completedActions,
    overdueActions,
    openActions,
    completionRate,
    daysToDeadline,
    nearestDeadline: nearestUpcomingDeadline,
    summaryNarrative,
  };
}
