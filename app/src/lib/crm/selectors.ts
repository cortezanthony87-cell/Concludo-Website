/**
 * Reading the workspace: lookups, filters and the small derived facts the
 * views need.
 *
 * Everything here is pure. Given the same dataset, the same view state and the
 * same moment it returns the same answer, which is what makes the Today page
 * testable without a renderer.
 *
 * One performance note carried over from the Email Command Centre, where it
 * was found the expensive way: never resolve a related record with `.find()`
 * inside a loop. At twenty records nobody notices; at ten thousand it is the
 * whole cost of the page. Every lookup below indexes into a Map built once.
 */
import {
  CrmActivity,
  CrmCommitment,
  CrmDataset,
  CrmOrganisation,
  CrmPerson,
  CrmPipelineStage,
  CrmRecord,
  CrmViewState,
} from './types';
import { CRM_DEMO_NOW, daysSince, daysUntil, ms } from './data/clock';
import { rangeDays } from './viewState';

export interface CrmIndex {
  organisationById: Map<string, CrmOrganisation>;
  personById: Map<string, CrmPerson>;
  stageById: Map<string, CrmPipelineStage>;
  recordById: Map<string, CrmRecord>;
  activityById: Map<string, CrmActivity>;
  /** Activities per organisation, newest first. */
  activitiesByOrganisation: Map<string, CrmActivity[]>;
  /** Open commitments per record. */
  commitmentsByRecord: Map<string, CrmCommitment[]>;
}

export function buildCrmIndex(dataset: CrmDataset): CrmIndex {
  const activitiesByOrganisation = new Map<string, CrmActivity[]>();
  for (const activity of dataset.activities) {
    if (!activity.organisationId) continue;
    const list = activitiesByOrganisation.get(activity.organisationId) ?? [];
    list.push(activity);
    activitiesByOrganisation.set(activity.organisationId, list);
  }
  for (const list of activitiesByOrganisation.values()) {
    list.sort((a, b) => ms(b.occurredAt) - ms(a.occurredAt));
  }

  const commitmentsByRecord = new Map<string, CrmCommitment[]>();
  for (const commitment of dataset.commitments) {
    if (!commitment.recordId) continue;
    const list = commitmentsByRecord.get(commitment.recordId) ?? [];
    list.push(commitment);
    commitmentsByRecord.set(commitment.recordId, list);
  }

  return {
    organisationById: new Map(dataset.organisations.map((o) => [o.id, o])),
    personById: new Map(dataset.people.map((p) => [p.id, p])),
    stageById: new Map(dataset.stages.map((s) => [s.id, s])),
    recordById: new Map(dataset.records.map((r) => [r.id, r])),
    activityById: new Map(dataset.activities.map((a) => [a.id, a])),
    activitiesByOrganisation,
    commitmentsByRecord,
  };
}

/* --------------------------------------------------------------- filters */

function withinRange(iso: string | null, state: CrmViewState, now: string): boolean {
  const days = rangeDays(state.dateRange);
  if (days === null) return true;
  // A record with no date is never filtered out by a date range. Hiding
  // something because it has no date is how a CRM loses the records that most
  // need attention.
  if (!iso) return true;
  return daysSince(iso, now) <= days;
}

function matchesSearch(haystack: string[], search: string): boolean {
  const term = search.trim().toLowerCase();
  if (!term) return true;
  return haystack.some((value) => value.toLowerCase().includes(term));
}

export function filterRecords(
  dataset: CrmDataset,
  index: CrmIndex,
  state: CrmViewState,
  now: string = CRM_DEMO_NOW
): CrmRecord[] {
  return dataset.records.filter((record) => {
    if (state.organisationId !== 'all' && record.organisationId !== state.organisationId) return false;
    if (state.pipelineId !== 'all' && record.pipelineId !== state.pipelineId) return false;
    if (state.owner !== 'all' && record.ownerName !== state.owner) return false;
    if (state.recordType !== 'all') {
      const pipeline = dataset.pipelines.find((p) => p.id === record.pipelineId);
      if (!pipeline || pipeline.recordTerminology !== state.recordType) return false;
    }
    if (!withinRange(record.lastActivityAt ?? record.createdAt, state, now)) return false;
    const organisation = index.organisationById.get(record.organisationId);
    return matchesSearch(
      [record.title, organisation?.name ?? '', record.ownerName, record.nextStep ?? ''],
      state.search
    );
  });
}

export function filterPeople(
  dataset: CrmDataset,
  index: CrmIndex,
  state: CrmViewState
): CrmPerson[] {
  return dataset.people.filter((person) => {
    if (state.organisationId !== 'all' && person.organisationId !== state.organisationId) return false;
    const organisation = person.organisationId
      ? index.organisationById.get(person.organisationId)
      : undefined;
    return matchesSearch(
      [person.fullName, person.roleLabel, organisation?.name ?? '', person.email ?? ''],
      state.search
    );
  });
}

export function filterOrganisations(dataset: CrmDataset, state: CrmViewState): CrmOrganisation[] {
  return dataset.organisations.filter((organisation) => {
    if (state.organisationId !== 'all' && organisation.id !== state.organisationId) return false;
    if (state.owner !== 'all' && organisation.ownerName !== state.owner) return false;
    return matchesSearch([organisation.name, organisation.industry, organisation.ownerName], state.search);
  });
}

export function filterActivities(
  dataset: CrmDataset,
  index: CrmIndex,
  state: CrmViewState,
  now: string = CRM_DEMO_NOW
): CrmActivity[] {
  return dataset.activities
    .filter((activity) => {
      if (state.organisationId !== 'all' && activity.organisationId !== state.organisationId) return false;
      if (!withinRange(activity.occurredAt, state, now)) return false;
      const organisation = activity.organisationId
        ? index.organisationById.get(activity.organisationId)
        : undefined;
      return matchesSearch([activity.title, activity.summary, organisation?.name ?? ''], state.search);
    })
    .sort((a, b) => ms(b.occurredAt) - ms(a.occurredAt));
}

export function filterCommitments(
  dataset: CrmDataset,
  index: CrmIndex,
  state: CrmViewState
): CrmCommitment[] {
  return dataset.commitments.filter((commitment) => {
    if (state.organisationId !== 'all' && commitment.organisationId !== state.organisationId) return false;
    if (state.owner !== 'all' && commitment.ownerName !== state.owner) return false;
    const organisation = commitment.organisationId
      ? index.organisationById.get(commitment.organisationId)
      : undefined;
    return matchesSearch(
      [commitment.description, commitment.ownerName, organisation?.name ?? ''],
      state.search
    );
  });
}

/* ------------------------------------------------------- derived facts */

/** How long a record has been in its stage, against what that stage expects. */
export interface StageDwell {
  days: number;
  typicalDays: number;
  /** True when it has been there longer than the stage normally takes. */
  longerThanUsual: boolean;
  stageName: string;
}

export function stageDwell(
  record: CrmRecord,
  index: CrmIndex,
  now: string = CRM_DEMO_NOW
): StageDwell {
  const stage = index.stageById.get(record.stageId);
  const days = daysSince(record.enteredStageAt, now);
  const typicalDays = stage?.typicalDays ?? 0;
  return {
    days,
    typicalDays,
    longerThanUsual: typicalDays > 0 && days > typicalDays,
    stageName: stage?.name ?? 'Unknown stage',
  };
}

/** Days until a commitment is due, or null where no date was recorded. */
export function commitmentDueIn(commitment: CrmCommitment, now: string = CRM_DEMO_NOW): number | null {
  return commitment.dueDate ? daysUntil(commitment.dueDate, now) : null;
}

/** The owners present in the workspace, for the owner filter. */
export function ownersIn(dataset: CrmDataset): string[] {
  const owners = new Set<string>();
  for (const record of dataset.records) owners.add(record.ownerName);
  for (const organisation of dataset.organisations) owners.add(organisation.ownerName);
  return [...owners].sort();
}

/** The organisation name for a record, or a plain fallback. */
export function organisationName(id: string | null, index: CrmIndex): string {
  if (!id) return 'No organisation recorded';
  return index.organisationById.get(id)?.name ?? 'Unknown organisation';
}

/** The person's name, or a plain fallback. */
export function personName(id: string | null, index: CrmIndex): string {
  if (!id) return 'No person recorded';
  return index.personById.get(id)?.fullName ?? 'Unknown person';
}
