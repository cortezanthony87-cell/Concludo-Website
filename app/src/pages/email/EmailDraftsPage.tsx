/**
 * Drafts.
 *
 * Every prepared reply, and every reply deliberately not prepared, with the
 * reason. The withheld ones matter more than the ready ones: they are where the
 * module is declining to write something on a person's behalf, and the reason
 * is the only way to judge whether it was right to.
 *
 * There is no send control on this page, and there is no "write to mailbox"
 * control either. Neither exists in the codebase.
 */
import React, { useMemo, useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import { ShieldCheck } from 'lucide-react';
import { EmailModuleContext } from '../../components/email/EmailModuleLayout';
import { ViewScaffold } from '../../components/email/ViewScaffold';
import { FilterChips } from '../../components/email/FilterChips';
import { ItemActions } from '../../components/email/ItemActions';
import { DraftCardItem } from '../../components/email/DraftCardItem';
import {
  AccountBadge,
  DraftChip,
  ConfidenceChip,
  Field,
  formatDayTime,
} from '../../components/email/viewPrimitives';
import { useViewData } from '../../lib/email/useViewData';
import { draftItems } from '../../lib/email/views';
import { DraftStatus, DraftStyle, DRAFT_STYLE_LABEL } from '../../lib/email/model';

const STATUS_OPTIONS: readonly { key: DraftStatus; label: string; description: string }[] = [
  { key: 'available', label: 'Ready for review', description: 'A draft has been written and is waiting on you.' },
  {
    key: 'clarification_required',
    label: 'Clarification required',
    description: 'Something is missing, so nothing was written.',
  },
  {
    key: 'withheld_for_safety',
    label: 'Withheld',
    description: 'Deliberately not written: security flagged, sensitive, or already closed.',
  },
];

const STYLES: readonly DraftStyle[] = ['concise', 'warm', 'detailed'];

export const EmailDraftsPage: React.FC = () => {
  const { accountId, linkTo } = useOutletContext<EmailModuleContext>();
  const { dataset, records, accountLabel, accountType, state } = useViewData(accountId);

  const [statuses, setStatuses] = useState<DraftStatus[]>([]);
  const [style, setStyle] = useState<DraftStyle>('concise');

  const drafts = dataset?.drafts ?? [];
  const chosen = statuses.length > 0 ? statuses : STATUS_OPTIONS.map((s) => s.key);
  const items = useMemo(
    () => draftItems(records, drafts, style, chosen),
    [records, drafts, style, chosen]
  );

  const all = useMemo(() => draftItems(records, drafts, style), [records, drafts, style]);

  return (
    <ViewScaffold
      title="Drafts"
      description="Replies prepared for your review, and replies deliberately not prepared. Nothing here is written to a mailbox and nothing is sent."
      state={state}
      count={items.length}
      emptyMessage="No draft matches the filters you have chosen."
      accountLabel={accountLabel}
      accountType={accountType}
      notice={
        <p className="ecc-safety-note" role="note">
          <ShieldCheck size={14} aria-hidden="true" />
          Concludo proposes; a person disposes. Review, edit, attach documents, and send through your connected mailbox using the Approval Centre gate.
        </p>
      }
      controls={
        <>
          <FilterChips
            legend="Draft status"
            options={STATUS_OPTIONS.map((s) => ({
              key: s.key,
              label: s.label,
              description: s.description,
              count: all.filter((i) => i.draft.status === s.key).length,
            }))}
            active={statuses}
            onToggle={(key) =>
              setStatuses((s) => (s.includes(key) ? s.filter((x) => x !== key) : [...s, key]))
            }
            onClear={() => setStatuses([])}
            combineNote="Choosing none shows all three."
          />
          <fieldset className="ecc-style-picker">
            <legend className="ecc-chips-legend">Draft style</legend>
            <div className="ecc-chip-row">
              {STYLES.map((s) => (
                <button
                  key={s}
                  type="button"
                  className={`ecc-chip ${style === s ? 'ecc-chip-on' : ''}`}
                  aria-pressed={style === s}
                  onClick={() => setStyle(s)}
                >
                  {DRAFT_STYLE_LABEL[s]}
                </button>
              ))}
            </div>
          </fieldset>
        </>
      }
    >
      <ul className="ecc-card-list">
        {items.map(({ record, draft, bodyForStyle }) => (
          <DraftCardItem
            key={draft.id}
            record={record}
            draft={draft}
            bodyForStyle={bodyForStyle}
            accountLabel={accountLabel}
            accountType={accountType}
            linkTo={linkTo}
            style={style}
          />
        ))}
      </ul>
    </ViewScaffold>
  );
};
