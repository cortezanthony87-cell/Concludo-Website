/**
 * Commitments and promises.
 *
 * Every row carries the sentence it came from. A commitment without its quote
 * is an assertion about what somebody said, and the person reading it has no
 * way to check. With the quote, a wrong extraction is obvious in two seconds
 * rather than becoming a wrong follow-up three weeks later.
 *
 * Yours and theirs are distinguished, because they call for different actions:
 * one is work, the other is a reason to follow up.
 */
import React from 'react';
import { ViewScaffold, useCrmView } from '../../components/crm/ViewScaffold';
import { BasisChip, Column, DataTable, StatusMark, Value } from '../../components/crm/viewPrimitives';
import { CrmCommitment } from '../../lib/crm/types';
import { buildCrmIndex, commitmentDueIn, filterCommitments, organisationName } from '../../lib/crm/selectors';
import { formatDay } from '../../lib/crm/today';

export const CrmCommitmentsPage: React.FC = () => {
  const { dataset, viewState } = useCrmView();
  const index = React.useMemo(() => buildCrmIndex(dataset), [dataset]);
  const commitments = React.useMemo(
    () => filterCommitments(dataset, index, viewState),
    [dataset, index, viewState]
  );

  const columns: Column<CrmCommitment>[] = [
    {
      key: 'what',
      header: 'Commitment',
      isRowHeader: true,
      render: (commitment) => (
        <span className="ccrm-cell-stack">
          <span className="ccrm-cell-strong">{commitment.description}</span>
          <span className="ccrm-cell-quiet">{organisationName(commitment.organisationId, index)}</span>
        </span>
      ),
    },
    {
      key: 'owner',
      header: 'Who',
      narrow: true,
      render: (commitment) => (
        <span className="ccrm-cell-stack">
          <span>{commitment.ownerName}</span>
          <span className="ccrm-cell-quiet">{commitment.ownedByUser ? 'Yours' : 'Theirs'}</span>
        </span>
      ),
    },
    {
      key: 'due',
      header: 'Due',
      narrow: true,
      render: (commitment) => {
        const due = commitmentDueIn(commitment);
        if (due === null) return <Value value={null} absent="No date recorded" />;
        return (
          <span className="ccrm-cell-stack">
            <span>{formatDay(commitment.dueDate as string)}</span>
            <span className="ccrm-cell-quiet">
              {due < 0 ? `${Math.abs(due)} days ago` : due === 0 ? 'Today' : `In ${due} days`}
            </span>
          </span>
        );
      },
    },
    {
      key: 'source',
      header: 'Taken from',
      render: (commitment) => (
        <span className="ccrm-cell-stack">
          <BasisChip basis={commitment.source.basis} />
          <span className="ccrm-cell-quote">{commitment.source.evidence ?? 'No quote recorded.'}</span>
        </span>
      ),
    },
    {
      key: 'state',
      header: 'Standing',
      narrow: true,
      render: (commitment) =>
        commitment.state === 'done' ? (
          <StatusMark shape="none" label="Done" />
        ) : commitment.ownedByUser ? (
          <StatusMark shape="open" label="Open" />
        ) : (
          <StatusMark shape="waiting" label="Waiting on them" />
        ),
    },
  ];

  return (
    <ViewScaffold
      title="Commitments"
      description="What was promised, by whom, by when, and the sentence it came from."
      loadingLabel="commitments"
      emptyTitle="No commitments recorded"
      emptyBody="Commitments are proposed from a meeting and confirmed by a person."
      resultCount={commitments.length}
      totalCount={dataset.commitments.length}
    >
      <DataTable
        caption="Commitments in this workspace"
        columns={columns}
        rows={commitments}
        emptyMessage="No commitments match the current filters."
      />
    </ViewScaffold>
  );
};
