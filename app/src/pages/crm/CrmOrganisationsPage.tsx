/**
 * Organisations: the list, with the standing of each one stated.
 *
 * "Standing" here is a sentence drawn from recorded facts, never a health score
 * or a traffic light. A traffic light makes a person act on a colour somebody
 * else's formula produced; a sentence makes them act on what happened.
 */
import React from 'react';
import { Link } from 'react-router-dom';
import { Stage4Scaffold, useStage4 } from '../../components/crm/Stage4Scaffold';
import { Column, DataTable, Value } from '../../components/crm/viewPrimitives';
import { Organisation } from '../../lib/crm/domain';
import { lastMeaningfulContactWith } from '../../lib/crm/stage4/relationships';
import { coverageFor } from '../../lib/crm/stage4/hierarchy';
import { organisationFlags } from '../../lib/crm/stage4/quality';

interface Row {
  id: string;
  organisation: Organisation;
  parentName: string | null;
  peopleCount: number;
  openWorkCount: number;
  lastContactAt: string | null;
  lastContactDays: number | null;
  renewalDate: string | null;
  standing: string;
  flagCount: number;
}

const DAY = 86_400_000;

export const CrmOrganisationsPage: React.FC = () => {
  const { data, now, linkTo, viewState } = useStage4();

  const all = React.useMemo<Row[]>(() => {
    const lastContact = (personId: string) => lastMeaningfulContactWith(data, personId);

    return data.organisations
      .filter((o) => o.deletedAt === null)
      .map((organisation) => {
        const people = data.people.filter(
          (p) =>
            p.deletedAt === null &&
            p.mergedIntoPersonId === null &&
            p.organisationId === organisation.id
        );
        const openWork = data.workItems.filter(
          (w) =>
            w.deletedAt === null && w.organisationId === organisation.id && w.status === 'open'
        );
        const coverage = coverageFor(data, organisation, lastContact);
        const flags = organisationFlags(data, organisation, now);

        const lastContactAt =
          people
            .map((p) => lastContact(p.id))
            .filter((a): a is string => a !== null)
            .sort()
            .at(-1) ?? null;

        const days =
          lastContactAt === null
            ? null
            : Math.floor((new Date(now).getTime() - new Date(lastContactAt).getTime()) / DAY);

        // The standing, assembled from facts in the order a person would say
        // them. Never a grade and never a colour on its own.
        const parts: string[] = [];
        const unresolved = data.serviceCases.filter(
          (c) =>
            c.deletedAt === null &&
            c.organisationId === organisation.id &&
            c.state !== 'resolved' &&
            c.state !== 'closed'
        );
        if (unresolved.length > 0) {
          parts.push(
            `${unresolved.length} service ${unresolved.length === 1 ? 'matter is' : 'matters are'} unresolved.`
          );
        }
        if (coverage.singleContact) parts.push('One contact is recorded.');
        if (days !== null && days > 60) parts.push(`No conversation recorded for ${days} days.`);
        if (days === null) parts.push('No conversation has ever been recorded.');
        if (organisation.renewalDate !== null) {
          const until = Math.round(
            (new Date(organisation.renewalDate).getTime() - new Date(now).getTime()) / DAY
          );
          if (until >= 0 && until <= 60) parts.push(`Renewal or review in ${until} days.`);
        }
        if (parts.length === 0) {
          parts.push(
            openWork.length > 0
              ? `${openWork.length} open ${openWork.length === 1 ? 'item' : 'items'} and recent contact recorded.`
              : 'Nothing outstanding is recorded.'
          );
        }

        return {
          id: organisation.id,
          organisation,
          parentName:
            data.organisations.find((o) => o.id === organisation.parentOrganisationId)?.name ?? null,
          peopleCount: people.length,
          openWorkCount: openWork.length,
          lastContactAt,
          lastContactDays: days,
          renewalDate: organisation.renewalDate,
          standing: parts.join(' '),
          flagCount: flags.length,
        };
      });
  }, [data, now]);

  const rows = React.useMemo(() => {
    const term = viewState.search.trim().toLowerCase();
    let out = all;
    if (viewState.organisationId !== 'all') {
      out = out.filter((r) => r.id === viewState.organisationId);
    }
    if (term) {
      out = out.filter(
        (r) =>
          r.organisation.name.toLowerCase().includes(term) ||
          (r.organisation.industry ?? '').toLowerCase().includes(term)
      );
    }
    return out;
  }, [all, viewState.organisationId, viewState.search]);

  const columns: Column<Row>[] = [
    {
      key: 'name',
      header: 'Organisation',
      isRowHeader: true,
      render: (row) => (
        <span className="ccrm-cell-stack">
          <Link
            className="ccrm-cell-strong ccrm-text-link"
            to={linkTo(`/crm/organisations/${row.id}`)}
          >
            {row.organisation.name}
          </Link>
          <span className="ccrm-cell-quiet">
            <Value value={row.organisation.industry} absent="Industry not recorded" />
          </span>
          {row.parentName ? (
            <span className="ccrm-cell-quiet">Part of {row.parentName}</span>
          ) : null}
        </span>
      ),
    },
    {
      key: 'people',
      header: 'People',
      narrow: true,
      render: (row) => <span>{row.peopleCount}</span>,
    },
    {
      key: 'work',
      header: 'Open work',
      narrow: true,
      render: (row) => <span>{row.openWorkCount}</span>,
    },
    {
      key: 'last',
      header: 'Last conversation',
      narrow: true,
      render: (row) => (
        <span className="ccrm-cell-stack">
          <Value
            value={row.lastContactAt ? row.lastContactAt.slice(0, 10) : null}
            absent="None recorded"
          />
          {row.lastContactDays !== null ? (
            <span className="ccrm-cell-quiet">{row.lastContactDays} days ago</span>
          ) : null}
        </span>
      ),
    },
    {
      key: 'renewal',
      header: 'Renewal or review',
      narrow: true,
      render: (row) => <Value value={row.renewalDate} absent="No date recorded" />,
    },
    {
      key: 'lifecycle',
      header: 'Lifecycle',
      narrow: true,
      render: (row) => <span className="ccrm-cell-quiet">{row.organisation.lifecycleState}</span>,
    },
    {
      key: 'standing',
      header: 'Standing',
      render: (row) => <span className="ccrm-cell-quiet">{row.standing}</span>,
    },
  ];

  return (
    <Stage4Scaffold
      title="Organisations"
      description="Organisations, their structure, and what is recorded about where each one stands."
      loadingLabel="the organisations on record"
      emptyTitle="No organisations are recorded in this workspace"
      emptyBody="Organisations appear here as they are added or drawn out of a conversation and confirmed."
      resultCount={rows.length}
      totalCount={all.length}
    >
      <DataTable
        caption="Organisations on record"
        columns={columns}
        rows={rows}
        emptyMessage="No organisation matches what you have selected."
      />
    </Stage4Scaffold>
  );
};
