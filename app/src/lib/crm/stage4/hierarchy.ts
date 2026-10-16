/**
 * The organisation hierarchy, and stakeholder coverage.
 *
 * TWO THINGS THAT LOOK SIMPLE AND ARE NOT.
 *
 * A hierarchy read from a `parent_id` column is a tree until somebody records a
 * cycle, and then it is a program that never returns. Stage 3 put a trigger on
 * the table that refuses cycles and depth beyond twelve, which means the
 * database cannot hold one. This file still counts its own depth, because a
 * view that hangs is a worse failure than a view that says the data is wrong,
 * and because the fixture is not the only thing this code will ever read.
 *
 * Coverage is the second. "Which roles are covered" is a question about the
 * RECORD, and the moment it is phrased as a percentage it becomes a score for
 * the person who owns the account. So coverage returns which roles are recorded
 * and which are not, by name, and no function here returns a ratio.
 */
import {
  CrmWorkspaceData,
  Organisation,
  Person,
  PersonOrganisationRole,
  StakeholderRole,
} from '../domain';
import { ROLE_WORDS, ROLES_THAT_MATTER } from './relationships';
import { onWriteInvalidate } from '../cacheBus';

export const MAX_DEPTH = 12;

export interface HierarchyNode {
  organisation: Organisation;
  depth: number;
  children: HierarchyNode[];
  /** Live people recorded against this organisation. */
  peopleCount: number;
  openWorkCount: number;
}

/**
 * The whole workspace as a forest, roots first.
 *
 * A node whose parent is missing becomes a root rather than disappearing. An
 * orphan is a data problem worth seeing, and dropping it silently is how a
 * record goes missing from a view that is meant to show everything.
 */
export function buildHierarchy(data: CrmWorkspaceData): HierarchyNode[] {
  const live = data.organisations.filter((o) => o.deletedAt === null);
  const byId = new Map(live.map((o) => [o.id, o]));

  const peopleCount = (id: string): number =>
    data.people.filter(
      (p) => p.deletedAt === null && p.mergedIntoPersonId === null && p.organisationId === id
    ).length;

  const openWorkCount = (id: string): number =>
    data.workItems.filter(
      (w) => w.deletedAt === null && w.organisationId === id && w.status === 'open'
    ).length;

  const childrenOf = (parentId: string | null): Organisation[] =>
    live.filter((o) => {
      if (parentId === null) {
        // A root, or an orphan whose recorded parent is not here.
        return o.parentOrganisationId === null || !byId.has(o.parentOrganisationId);
      }
      return o.parentOrganisationId === parentId;
    });

  const build = (organisation: Organisation, depth: number, seen: Set<string>): HierarchyNode => {
    // The guard the database also applies. It should be impossible to reach;
    // walking a cycle forever is not an acceptable way to discover it is not.
    if (depth > MAX_DEPTH || seen.has(organisation.id)) {
      return {
        organisation,
        depth,
        children: [],
        peopleCount: peopleCount(organisation.id),
        openWorkCount: openWorkCount(organisation.id),
      };
    }

    const nextSeen = new Set(seen).add(organisation.id);
    return {
      organisation,
      depth,
      children: childrenOf(organisation.id).map((child) => build(child, depth + 1, nextSeen)),
      peopleCount: peopleCount(organisation.id),
      openWorkCount: openWorkCount(organisation.id),
    };
  };

  const roots = childrenOf(null).map((root) => build(root, 0, new Set()));

  /* Anything the walk did not reach still gets shown.
   *
   * With a well-formed tree this adds nothing. With a cycle, where every node
   * has a parent and so nothing qualifies as a root, it is the difference
   * between a view that shows the records and a view that shows an empty
   * screen. The database refuses a cycle, so this should be unreachable; an
   * empty organisations page is a bad way to find out that it was not. */
  const reached = new Set<string>();
  const mark = (node: HierarchyNode) => {
    reached.add(node.organisation.id);
    node.children.forEach(mark);
  };
  roots.forEach(mark);

  for (const organisation of live) {
    if (reached.has(organisation.id)) continue;
    const node = build(organisation, 0, new Set());
    mark(node);
    roots.push(node);
  }

  return roots;
}

/** The tree flattened for a table, parents immediately before their children. */
export function flattenHierarchy(nodes: HierarchyNode[]): HierarchyNode[] {
  const out: HierarchyNode[] = [];
  const walk = (node: HierarchyNode) => {
    out.push(node);
    node.children.forEach(walk);
  };
  nodes.forEach(walk);
  return out;
}

/** The chain from the root down to one organisation, root first. */
export function ancestryOf(data: CrmWorkspaceData, organisationId: string): Organisation[] {
  const byId = new Map(data.organisations.map((o) => [o.id, o]));
  const chain: Organisation[] = [];

  let cursor = byId.get(organisationId)?.parentOrganisationId ?? null;
  let depth = 0;
  while (cursor && depth <= MAX_DEPTH) {
    depth += 1;
    const parent = byId.get(cursor);
    if (!parent) break;
    chain.unshift(parent);
    cursor = parent.parentOrganisationId;
  }

  return chain;
}

export function childrenOf(data: CrmWorkspaceData, organisationId: string): Organisation[] {
  return data.organisations.filter(
    (o) => o.deletedAt === null && o.parentOrganisationId === organisationId
  );
}

/* ================================================= stakeholder coverage */

export interface RoleHolder {
  person: Person;
  roleLabel: string | null;
  stakeholderRole: StakeholderRole;
  isPrimary: boolean;
  lastContactAt: string | null;
}

export interface Coverage {
  organisation: Organisation;
  /** Who is recorded, by role. */
  held: RoleHolder[];
  /** Which of the roles that usually matter nobody is recorded in. */
  absent: StakeholderRole[];
  /** People at the organisation with no role recorded at all. */
  withoutRole: Person[];
  /** True where exactly one person is recorded against the organisation. */
  singleContact: boolean;
  openWorkCount: number;
  /** What this means, in a sentence. Never a grade. */
  summary: string;
}

interface CoverageIndex {
  peopleByOrganisation: Map<string, Person[]>;
  rolesByOrganisation: Map<string, PersonOrganisationRole[]>;
  openWorkByOrganisation: Map<string, number>;
}

const coverageIndexes = new WeakMap<CrmWorkspaceData, CoverageIndex>();

function coverageIndex(data: CrmWorkspaceData): CoverageIndex {
  const cached = coverageIndexes.get(data);
  if (cached) return cached;

  const index: CoverageIndex = {
    peopleByOrganisation: new Map(),
    rolesByOrganisation: new Map(),
    openWorkByOrganisation: new Map(),
  };

  for (const person of data.people) {
    if (person.deletedAt !== null || person.mergedIntoPersonId !== null) continue;
    if (person.organisationId === null) continue;
    const existing = index.peopleByOrganisation.get(person.organisationId);
    if (existing) existing.push(person);
    else index.peopleByOrganisation.set(person.organisationId, [person]);
  }

  for (const role of data.personOrganisationRoles) {
    if (role.endedOn !== null || role.organisationId === null) continue;
    const existing = index.rolesByOrganisation.get(role.organisationId);
    if (existing) existing.push(role);
    else index.rolesByOrganisation.set(role.organisationId, [role]);
  }

  for (const item of data.workItems) {
    if (item.deletedAt !== null || item.status !== 'open' || item.organisationId === null) continue;
    index.openWorkByOrganisation.set(
      item.organisationId,
      (index.openWorkByOrganisation.get(item.organisationId) ?? 0) + 1
    );
  }

  coverageIndexes.set(data, index);
  return index;
}

/** Drops the cached lookups, for a caller that mutates a dataset in place. */
export function forgetCoverageIndex(data: CrmWorkspaceData): void {
  coverageIndexes.delete(data);
}

export function coverageFor(
  data: CrmWorkspaceData,
  organisation: Organisation,
  lastContact: (personId: string) => string | null
): Coverage {
  // Indexed in Stage 8. Called once per organisation by `workspaceCoverage`,
  // and each call used to scan the contact table, the role table and the work
  // table. At ten thousand of each that is three hundred million comparisons
  // for one page, which measured at half a second; the lists it builds are
  // unchanged.
  const index = coverageIndex(data);
  const people = index.peopleByOrganisation.get(organisation.id) ?? [];
  const roles = index.rolesByOrganisation.get(organisation.id) ?? [];

  const held: RoleHolder[] = roles
    .map((role) => {
      const person = people.find((p) => p.id === role.personId);
      if (!person) return null;
      return {
        person,
        roleLabel: role.roleLabel,
        stakeholderRole: role.stakeholderRole,
        isPrimary: role.isPrimary,
        lastContactAt: lastContact(person.id),
      };
    })
    .filter((h): h is RoleHolder => h !== null);

  const heldRoles = new Set(held.map((h) => h.stakeholderRole));
  const absent = ROLES_THAT_MATTER.filter((role) => !heldRoles.has(role));

  const withRole = new Set(held.map((h) => h.person.id));
  const withoutRole = people.filter((p) => !withRole.has(p.id));

  const openWorkCount = index.openWorkByOrganisation.get(organisation.id) ?? 0;

  const parts: string[] = [];
  if (people.length === 0) {
    parts.push('Nobody is recorded at this organisation.');
  } else if (people.length === 1) {
    parts.push('One contact is recorded.');
  } else {
    parts.push(`${people.length} contacts are recorded.`);
  }
  if (absent.length > 0) {
    parts.push(
      `No ${absent.map((r) => ROLE_WORDS[r].toLowerCase()).join(' and no ')} is recorded.`
    );
  }
  if (withoutRole.length > 0) {
    parts.push(
      `${withoutRole.length} ${withoutRole.length === 1 ? 'person has' : 'people have'} no role recorded.`
    );
  }
  if (absent.length === 0 && withoutRole.length === 0 && people.length > 1) {
    parts.push('Every role that usually matters has somebody recorded in it.');
  }

  return {
    organisation,
    held,
    absent,
    withoutRole,
    singleContact: people.length === 1,
    openWorkCount,
    summary: parts.join(' '),
  };
}

export function workspaceCoverage(
  data: CrmWorkspaceData,
  lastContact: (personId: string) => string | null
): Coverage[] {
  return data.organisations
    .filter((o) => o.deletedAt === null)
    .map((organisation) => coverageFor(data, organisation, lastContact));
}

export { ROLE_WORDS, ROLES_THAT_MATTER };

/*
 * Drop the coverage lookups whenever anything is written.
 *
 * The session store mutates one workspace object in place, so a cache keyed on
 * that object outlives the data it was built from. Registering here means the
 * cache is dropped by the thing that knows a write happened, rather than by
 * every caller remembering to.
 */
onWriteInvalidate(forgetCoverageIndex);
