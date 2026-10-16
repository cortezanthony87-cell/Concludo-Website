/**
 * People: every person on record, as a table.
 *
 * A table rather than cards, because the questions people ask of this list are
 * comparative. "Who have I not spoken to", "who has no owner", "who is marked
 * do not contact" are all answered by scanning one column, and a card grid
 * makes every one of them a hunt.
 *
 * The do-not-contact column is first after the name on purpose. It is the one
 * fact on this screen that changes what somebody is allowed to do next, and a
 * person who scrolls past it has already made the mistake.
 */
import React from 'react';
import { Link } from 'react-router-dom';
import { Stage4Scaffold, useStage4 } from '../../components/crm/Stage4Scaffold';
import { Column, DataTable, Value } from '../../components/crm/viewPrimitives';
import { PersonSummary, peopleSummaries } from '../../lib/crm/stage4/records';

export const CrmPeoplePage: React.FC = () => {
  const { data, now, linkTo, viewState } = useStage4();

  const all = React.useMemo(() => peopleSummaries(data, now), [data, now]);

  const rows = React.useMemo(() => {
    const term = viewState.search.trim().toLowerCase();
    let out = all;
    if (viewState.organisationId !== 'all') {
      out = out.filter((p) => p.person.organisationId === viewState.organisationId);
    }
    if (term) {
      out = out.filter(
        (p) =>
          p.person.fullName.toLowerCase().includes(term) ||
          (p.organisationName ?? '').toLowerCase().includes(term) ||
          (p.person.roleLabel ?? '').toLowerCase().includes(term)
      );
    }
    return out;
  }, [all, viewState.organisationId, viewState.search]);

  const columns: Column<PersonSummary & { id: string }>[] = [
    {
      key: 'name',
      header: 'Person',
      isRowHeader: true,
      render: (row) => (
        <span className="ccrm-cell-stack">
          <Link className="ccrm-cell-strong ccrm-text-link" to={linkTo(`/crm/people/${row.person.id}`)}>
            {row.person.fullName}
          </Link>
          <span className="ccrm-cell-quiet">
            <Value value={row.person.roleLabel} absent="Role not recorded" />
          </span>
        </span>
      ),
    },
    {
      key: 'contactable',
      header: 'Contact',
      narrow: true,
      render: (row) =>
        row.doNotContact ? (
          // Carried by a word, not a colour. The whole point of this column is
          // that somebody reads it before they send anything.
          <span className="ccrm-dnc">
            Do not contact
            <span className="ccrm-visually-hidden">. A preference is recorded against this person.</span>
          </span>
        ) : row.person.primaryEmail || row.person.phone ? (
          <span className="ccrm-cell-quiet">
            {row.person.primaryEmailScope === 'personal' ? 'Personal address' : 'Open'}
          </span>
        ) : (
          <span className="ccrm-absent">No contact method</span>
        ),
    },
    {
      key: 'organisation',
      header: 'Organisation',
      render: (row) =>
        row.person.organisationId ? (
          <Link
            className="ccrm-text-link"
            to={linkTo(`/crm/organisations/${row.person.organisationId}`)}
          >
            {row.organisationName}
          </Link>
        ) : (
          <span className="ccrm-absent">Not recorded</span>
        ),
    },
    {
      key: 'role',
      header: 'Role in a decision',
      render: (row) => <span className="ccrm-cell-quiet">{row.role}</span>,
    },
    {
      key: 'owner',
      header: 'Relationship owner',
      render: (row) => (
        <Value value={row.relationshipOwner} absent="Nobody recorded" />
      ),
    },
    {
      key: 'last',
      header: 'Last conversation',
      narrow: true,
      render: (row) => (
        <span className="ccrm-cell-stack">
          <span>
            <Value
              value={row.lastMeaningfulAt ? row.lastMeaningfulAt.slice(0, 10) : null}
              absent="None recorded"
            />
          </span>
          {row.lastMeaningfulDays !== null ? (
            <span className="ccrm-cell-quiet">{row.lastMeaningfulDays} days ago</span>
          ) : null}
        </span>
      ),
    },
    {
      key: 'work',
      header: 'Open work',
      narrow: true,
      render: (row) => <span>{row.openWorkCount}</span>,
    },
    {
      key: 'note',
      header: 'Worth knowing',
      render: (row) =>
        row.note ? (
          <span className="ccrm-cell-quiet">{row.note}</span>
        ) : (
          <span className="ccrm-absent">Nothing outstanding</span>
        ),
    },
  ];

  return (
    <Stage4Scaffold
      title="People"
      description="Everyone on record, who holds each relationship, and when they were last spoken to."
      loadingLabel="the people on record"
      emptyTitle="No people are recorded in this workspace"
      emptyBody="People appear here as they are added, or as they are drawn out of a conversation and confirmed."
      resultCount={rows.length}
      totalCount={all.length}
    >
      <DataTable
        caption="People on record"
        columns={columns}
        rows={rows.map((row) => ({ ...row, id: row.person.id }))}
        emptyMessage="No person matches what you have selected."
      />
    </Stage4Scaffold>
  );
};
