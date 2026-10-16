/**
 * Memory: what this business needs to remember about a customer.
 *
 * The page is arranged around one claim, and everything on it is there to make
 * the claim checkable rather than impressive.
 *
 * THE CLAIM: NOTHING HERE IS GENERATED.
 *
 * Every sentence on this page came out of a row, and the row is one click
 * away. There is no model behind the nine questions. A memory layer that
 * answers nine questions out of ten from records and the tenth from a language
 * model is worse than one that answers nine and says "not recorded" to the
 * tenth, because the person reading cannot tell which one they are looking at.
 * So an answer with nothing behind it says so, in those words, and that is the
 * most important text on the page.
 *
 * WHY MEMORY AND THE TIMELINE ARE BOTH HERE, AND WHY MEMORY IS FIRST.
 *
 * The Stage 4 timeline is everything that happened. It is the right thing to
 * read when somebody asks what has been going on, and it is the wrong thing to
 * read in the four minutes before a renewal call. Memory is the smaller set:
 * promises, decisions, outcomes, escalations, losses. Showing both, with the
 * timeline folded away and the counts next to each other, is how the
 * difference between them stops being a claim in a document and becomes
 * something a buyer can see.
 *
 * THE READ IS WRITTEN DOWN, AND THE PAGE SAYS SO.
 *
 * Choosing a customer records a read. That is the one write this phase adds,
 * and the reason is in `memoryReads.ts`. It is logged when somebody CHOOSES a
 * customer, not on every render, which is what the ref below is for: a page
 * that logged on render would fill the log with noise and the audit table with
 * duplicates, and a log nobody can read is not a control.
 *
 * NOTHING HERE IS ABOUT A PERSON. The read log holds who read, because that is
 * the privacy obligation. This page shows how many reads and under what roles,
 * never a count beside anybody's name, and the module has no function that
 * would return one.
 */
import React from 'react';
import { Link } from 'react-router-dom';
import { ChevronDown, ChevronRight, Search } from 'lucide-react';
import { Stage4Scaffold, useStage4 } from '../../components/crm/Stage4Scaffold';
import {
  RolePicker,
  WriteNotice,
  WriteResultLine,
  useCrmWrite,
} from '../../components/crm/Stage5Pieces';
import { notifyWritten } from '../../lib/crm/stage5/session';
import {
  MEMORY_KIND_LABELS,
  MEMORY_NOTE,
  MemoryAnswer,
  MemoryEntry,
  MemoryKind,
  answerAll,
  memoryLinks,
  memoryTimeline,
  organisationsWithMemory,
  searchMemory,
} from '../../lib/crm/phase2/memory';
import {
  readsForOrganisation,
  readsToday,
  recordMemoryRead,
} from '../../lib/crm/phase2/memoryReads';

const SOURCE_PATHS: Record<string, (id: string) => string | null> = {
  crm_organisations: (id) => `/crm/organisations/${id}`,
  crm_people: (id) => `/crm/people/${id}`,
  crm_work_items: (id) => `/crm/work/${id}`,
  crm_account_plans: () => '/crm/account-plans',
  crm_account_reviews: () => '/crm/account-plans',
  crm_service_cases: () => '/crm/service',
  crm_commitments: () => '/crm/commitments',
  crm_activities: () => '/crm/activities',
  crm_decisions: () => '/crm/activities',
  crm_audit_events: () => '/crm/audit',
};

const SOURCE_WORDS: Record<string, string> = {
  crm_organisations: 'the organisation record',
  crm_people: 'the contact record',
  crm_work_items: 'the work',
  crm_account_plans: 'the account plan',
  crm_account_reviews: 'the review',
  crm_service_cases: 'the service case',
  crm_commitments: 'the commitment',
  crm_activities: 'the conversation',
  crm_decisions: 'the decision',
  crm_audit_events: 'the audit row',
};

function sourceWord(table: string): string {
  return SOURCE_WORDS[table] ?? table;
}

/**
 * A link read as a sentence rather than as two nouns and a colon.
 *
 * "the conversation to the commitment: the commitment names the conversation"
 * is what a join looks like when it is printed instead of written. Three
 * relations, three sentences.
 */
const RELATION_WORDS: Record<string, (from: string, to: string) => string> = {
  fulfilled_by: (from, to) => `What closed ${from} is ${to}`,
  led_to: (from, to) => `${from.charAt(0).toUpperCase()}${from.slice(1)} led to ${to}`,
  about: (from, to) => `${from.charAt(0).toUpperCase()}${from.slice(1)} is about ${to}`,
};

/* ------------------------------------------------------- one record line */

const SourceLine: React.FC<{
  table: string;
  id: string;
  what: string;
  linkTo: (path: string) => string;
}> = ({ table, id, what, linkTo }) => {
  const path = SOURCE_PATHS[table]?.(id) ?? null;
  return (
    <span className="ccrm-item-context">
      {path ? (
        <Link className="ccrm-text-link" to={linkTo(path)}>
          Open {sourceWord(table)}
        </Link>
      ) : (
        <>Held in {sourceWord(table)}</>
      )}
      {': '}
      {what}
    </span>
  );
};

/* ------------------------------------------------------- one memory entry */

const MemoryRow: React.FC<{ entry: MemoryEntry; linkTo: (path: string) => string }> = ({
  entry,
  linkTo,
}) => (
  <li className="ccrm-signal">
    <span className="ccrm-item">
      <span className="ccrm-item-main">
        <span className="ccrm-item-kind">{MEMORY_KIND_LABELS[entry.kind]}</span>
        <span className="ccrm-item-title">{entry.statement}</span>
        <span className="ccrm-item-context">
          {entry.who ? `${entry.who}. ` : 'Nobody is named on the record. '}
          {entry.occurredAt.slice(0, 10)}
        </span>
        {entry.resolved === false ? (
          <span className="ccrm-flag-resolution">
            Nothing is recorded as having come of this.
          </span>
        ) : null}
        {entry.resolved === true && entry.resolvedBy ? (
          <span className="ccrm-reason-text">
            Closed, and the record names what closed it.
          </span>
        ) : null}
        <SourceLine
          table={entry.source.table}
          id={entry.source.id}
          what={entry.source.what}
          linkTo={linkTo}
        />
      </span>
    </span>
  </li>
);

/* ------------------------------------------------------- one question */

const AnswerPanel: React.FC<{ answer: MemoryAnswer; linkTo: (path: string) => string }> = ({
  answer,
  linkTo,
}) => {
  const [open, setOpen] = React.useState(false);

  return (
    <li className={`ccrm-answer${answer.notRecorded ? ' ccrm-answer-empty' : ''}`}>
      <p className="ccrm-answer-question">{answer.question}</p>
      <p className={answer.notRecorded ? 'ccrm-answer-not-recorded' : 'ccrm-answer-text'}>
        {answer.answer}
      </p>

      {answer.lines.length > 0 ? (
        <>
          <button
            type="button"
            className="ccrm-text-link ccrm-disclosure-button"
            aria-expanded={open}
            onClick={() => setOpen((was) => !was)}
          >
            {open ? (
              <ChevronDown size={12} aria-hidden="true" />
            ) : (
              <ChevronRight size={12} aria-hidden="true" />
            )}
            {open
              ? 'Hide the records behind this'
              : `Show the ${answer.lines.length} ${answer.lines.length === 1 ? 'record' : 'records'} behind this`}
          </button>
          {open ? (
            <ul className="ccrm-item-list ccrm-evidence-list">
              {answer.lines.map((line, index) => (
                <li key={`${line.source.table}-${line.source.id}-${index}`}>
                  <span className="ccrm-item-main">
                    <span className="ccrm-item-title">{line.statement}</span>
                    <span className="ccrm-item-context">
                      {line.who ? `${line.who}. ` : ''}
                      {line.occurredAt.slice(0, 10)}
                    </span>
                    <SourceLine
                      table={line.source.table}
                      id={line.source.id}
                      what={line.source.what}
                      linkTo={linkTo}
                    />
                  </span>
                </li>
              ))}
            </ul>
          ) : null}
        </>
      ) : null}
    </li>
  );
};

/* ------------------------------------------------------- the page */

export const CrmMemoryPage: React.FC = () => {
  const { data, now, version, linkTo } = useStage4();
  const write = useCrmWrite();

  const [selected, setSelected] = React.useState<string | null>(null);
  const [kind, setKind] = React.useState<MemoryKind | 'all'>('all');
  const [showActivity, setShowActivity] = React.useState(false);
  const [query, setQuery] = React.useState('');
  const [searched, setSearched] = React.useState('');

  const picker = React.useMemo(
    () => organisationsWithMemory(data, write.role),
    [data, version, write.role]
  );

  const current = selected ?? picker[0]?.organisationId ?? null;

  const timeline = React.useMemo(
    () => (current ? memoryTimeline(data, current, write.role) : null),
    [data, version, current, write.role]
  );

  const answers = React.useMemo(
    () => (current ? answerAll(data, current, now, write.role) : []),
    [data, version, current, now, write.role]
  );

  const links = React.useMemo(
    () => (current ? memoryLinks(data, current, write.role) : []),
    [data, version, current, write.role]
  );

  const results = React.useMemo(
    () => (searched.trim().length >= 2 ? searchMemory(data, searched, write.role) : null),
    [data, version, searched, write.role]
  );

  /* ---- the read, written down once per customer chosen ---- */

  // Not on every render. A page that logged on render would record thirty
  // reads for one and turn the control into noise.
  const lastLogged = React.useRef<string | null>(null);

  React.useEffect(() => {
    if (current === null || timeline === null) return;
    if (lastLogged.current === current) return;
    lastLogged.current = current;

    /* Deliberately NOT through `write.run`.

       `write.run` puts a green banner at the top of the page saying what was
       recorded, which is right for an act somebody chose to perform and wrong
       for this. A banner on every customer clicked would be noise, and noise
       is how a control stops being read. The read is said once, in its own
       section, in a sentence about this customer.

       It still goes through `commit()`, so it still arrives with an audit row
       and the same role and workspace checks as every other write, and
       `notifyWritten` is still called so the figure on the page updates. */
    try {
      recordMemoryRead(write.context, write.data, {
        organisationId: current,
        kind: 'explorer',
        entriesReturned: timeline.memory.length,
        readAs: write.context.role,
      });
      notifyWritten();
    } catch {
      // A read that cannot be logged must not take the page down with it. The
      // refusal is already on the record as a failed write; the page carries
      // on, because refusing to show a customer's history because the log is
      // unavailable would be the wrong failure.
    }
    // `write` is rebuilt on every render by design, so it is deliberately not
    // a dependency: including it would log a read on every render, which is
    // exactly what the ref above exists to prevent.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [current, timeline]);

  const readLog = current ? readsForOrganisation(data, current) : null;

  const shown = React.useMemo(() => {
    if (!timeline) return [];
    if (kind === 'all') return timeline.memory;
    return timeline.memory.filter((entry) => entry.kind === kind);
  }, [timeline, kind]);

  const counts = React.useMemo(() => {
    const byKind = new Map<MemoryKind, number>();
    for (const entry of timeline?.memory ?? []) {
      byKind.set(entry.kind, (byKind.get(entry.kind) ?? 0) + 1);
    }
    return byKind;
  }, [timeline]);

  const runSearch = (event: React.FormEvent) => {
    event.preventDefault();
    setSearched(query);
    if (query.trim().length >= 2) {
      const found = searchMemory(data, query, write.role);
      try {
        recordMemoryRead(write.context, write.data, {
          organisationId: null,
          kind: 'search',
          query,
          entriesReturned: found.hits.length,
          readAs: write.context.role,
        });
        notifyWritten();
      } catch {
        // As above: a search that cannot be logged still returns its results.
      }
    }
  };

  return (
    <Stage4Scaffold
      title="Memory"
      description="What this business needs to remember about a customer: what was promised, what was decided, what came of it. Every line is a record, and nothing on this page is generated."
      loadingLabel="customer memory"
      emptyTitle="No organisation is recorded in this workspace yet"
      emptyBody="A customer's memory is assembled from the records held against them, so it appears here as those records are added."
      resultCount={shown.length}
      totalCount={timeline?.memory.length ?? 0}
      toolbar={<RolePicker />}
    >
      <WriteNotice />
      <WriteResultLine result={write.last} onClear={write.clearLast} />

      <p className="ccrm-not-ranked ccrm-policy" role="note">
        {MEMORY_NOTE}
      </p>

      {/* ---- who ---- */}

      <h3 className="ccrm-group-title">Customers</h3>
      <p className="ccrm-section-description">
        The figure on each is how many things are recorded as worth remembering. It is a count of
        records, never a judgement about an account or anybody who works on it.
      </p>

      <ul className="ccrm-card-rail">
        {picker.map((entry) => (
          <li key={entry.organisationId}>
            <button
              type="button"
              className={`ccrm-card ccrm-card-button${current === entry.organisationId ? ' ccrm-card-attention' : ''}`}
              aria-pressed={current === entry.organisationId}
              onClick={() => {
                setSelected(entry.organisationId);
                setKind('all');
                setShowActivity(false);
              }}
            >
              <span className="ccrm-card-count">{entry.entries}</span>
              <span className="ccrm-card-label">{entry.name}</span>
              <span className="ccrm-card-note">
                {entry.entries === 0
                  ? 'Nothing is recorded here yet'
                  : `${entry.entries} ${entry.entries === 1 ? 'thing' : 'things'} worth remembering`}
              </span>
            </button>
          </li>
        ))}
      </ul>

      {/* ---- search ---- */}

      <h3 className="ccrm-group-title">Search the records</h3>
      <form className="ccrm-memory-search" onSubmit={runSearch}>
        <label className="ccrm-field-label" htmlFor="memory-search">
          Words to look for
        </label>
        <div className="ccrm-signal-decide">
          <input
            id="memory-search"
            className="form-control"
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="renewal, payroll, deferred"
          />
          <button type="submit" className="ccrm-button">
            <Search size={14} aria-hidden="true" /> Search
          </button>
        </div>
      </form>

      {results ? (
        <>
          <p className="ccrm-view-tenant">
            {results.hits.length} {results.hits.length === 1 ? 'result' : 'results'} across{' '}
            {results.searched} {results.searched === 1 ? 'customer' : 'customers'}.
          </p>
          <p className="ccrm-policy" role="note">
            {results.note}
          </p>
          {results.hits.length === 0 ? (
            <p className="ccrm-panel-empty">
              Nothing recorded in this workspace contains those words. Concludo does not widen a
              search that found nothing, because a result that does not contain what was asked for
              is how a search stops being trusted.
            </p>
          ) : (
            <ul className="ccrm-item-list">
              {results.hits.map((hit) => (
                <li className="ccrm-signal" key={hit.entry.id}>
                  <span className="ccrm-item">
                    <span className="ccrm-item-main">
                      <span className="ccrm-item-kind">
                        {MEMORY_KIND_LABELS[hit.entry.kind]}
                      </span>
                      <span className="ccrm-item-title">{hit.matched}</span>
                      <span className="ccrm-item-context">
                        {hit.organisationName}. {hit.entry.occurredAt.slice(0, 10)}
                      </span>
                      <SourceLine
                        table={hit.entry.source.table}
                        id={hit.entry.source.id}
                        what={hit.entry.source.what}
                        linkTo={linkTo}
                      />
                    </span>
                  </span>
                </li>
              ))}
            </ul>
          )}
        </>
      ) : null}

      {/* ---- the nine questions ---- */}

      {timeline ? (
        <>
          <h3 className="ccrm-group-title">
            {timeline.organisation.name}
            <span className="ccrm-stage-count">{timeline.memory.length}</span>
          </h3>

          <h4 className="ccrm-plan-section-title">The nine questions</h4>
          <p className="ccrm-section-description">
            Answered from the records, with no model involved. Where nothing in the records answers
            a question, the answer says so rather than filling the gap.
          </p>

          <ul className="ccrm-answer-list">
            {answers.map((answer) => (
              <AnswerPanel key={answer.kind} answer={answer} linkTo={linkTo} />
            ))}
          </ul>

          {/* ---- the entries ---- */}

          <h4 className="ccrm-plan-section-title">
            Everything worth remembering
            <span className="ccrm-stage-count">{shown.length}</span>
          </h4>

          <ul className="ccrm-card-rail">
            {(Object.keys(MEMORY_KIND_LABELS) as MemoryKind[])
              .filter((candidate) => (counts.get(candidate) ?? 0) > 0)
              .map((candidate) => (
                <li key={candidate}>
                  <button
                    type="button"
                    className={`ccrm-card ccrm-card-button${kind === candidate ? ' ccrm-card-attention' : ''}`}
                    aria-pressed={kind === candidate}
                    onClick={() => setKind(kind === candidate ? 'all' : candidate)}
                  >
                    <span className="ccrm-card-count">{counts.get(candidate) ?? 0}</span>
                    <span className="ccrm-card-label">{MEMORY_KIND_LABELS[candidate]}</span>
                  </button>
                </li>
              ))}
          </ul>

          {shown.length === 0 ? (
            <p className="ccrm-panel-empty">
              Nothing is recorded against this customer that this product treats as memory. That is
              not the same as nothing having happened, which is what the conversation history below
              is for.
            </p>
          ) : (
            <ul className="ccrm-item-list">
              {shown.map((entry) => (
                <MemoryRow key={entry.id} entry={entry} linkTo={linkTo} />
              ))}
            </ul>
          )}

          {/* ---- the links ---- */}

          {links.length > 0 ? (
            <>
              <h4 className="ccrm-plan-section-title">
                What is joined to what
                <span className="ccrm-stage-count">{links.length}</span>
              </h4>
              <p className="ccrm-section-description">
                Only the joins the records already carry. Concludo does not infer that one thing
                caused another.
              </p>
              <ul className="ccrm-flag-list">
                {links.map((link, index) => (
                  <li className="ccrm-flag" key={`${link.from.id}-${link.to.id}-${index}`}>
                    <span className="ccrm-flag-detail">
                      {RELATION_WORDS[link.relation](
                        sourceWord(link.from.table),
                        sourceWord(link.to.table)
                      )}
                      {'. '}
                      {link.because}
                    </span>
                  </li>
                ))}
              </ul>
            </>
          ) : null}

          {/* ---- the timeline, folded ---- */}

          <h4 className="ccrm-plan-section-title">Everything that happened</h4>
          <p className="ccrm-section-description">
            The full conversation history, which is a different and much longer thing. Memory above
            is {timeline.memory.length} of these {timeline.activity.length}.
          </p>
          <button
            type="button"
            className="ccrm-text-link ccrm-disclosure-button"
            aria-expanded={showActivity}
            onClick={() => setShowActivity((was) => !was)}
          >
            {showActivity ? (
              <ChevronDown size={12} aria-hidden="true" />
            ) : (
              <ChevronRight size={12} aria-hidden="true" />
            )}
            {showActivity
              ? 'Hide the full history'
              : `Show all ${timeline.activity.length} ${timeline.activity.length === 1 ? 'entry' : 'entries'}`}
          </button>

          {showActivity ? (
            timeline.activity.length === 0 ? (
              <p className="ccrm-panel-empty">Nothing has been recorded against this customer.</p>
            ) : (
              <ul className="ccrm-item-list">
                {timeline.activity.map((entry) => (
                  <li key={`${entry.subjectTable}-${entry.subjectId}`}>
                    <span className="ccrm-item-main">
                      <span className="ccrm-item-title">{entry.title}</span>
                      <span className="ccrm-item-context">
                        {entry.occurredAt.slice(0, 10)}. {sourceWord(entry.subjectTable)}.
                      </span>
                    </span>
                  </li>
                ))}
              </ul>
            )
          ) : null}

          {/* ---- the read log ---- */}

          {readLog ? (
            <>
              <h4 className="ccrm-plan-section-title">Who has read this</h4>
              <p className="ccrm-view-tenant">
                This customer's memory has been read {readLog.reads}{' '}
                {readLog.reads === 1 ? 'time' : 'times'} on the record
                {readLog.lastReadAt ? `, most recently on ${readLog.lastReadAt.slice(0, 10)}` : ''}.
                {readLog.roles.length > 0
                  ? ` Under ${readLog.roles.map((candidate) => candidate.replace('crm_', '')).join(', ')}.`
                  : ''}{' '}
                {readsToday(data, now)}{' '}
                {readsToday(data, now) === 1 ? 'read' : 'reads'} across this workspace in the last
                day.
              </p>
              <p className="ccrm-policy" role="note">
                {readLog.note}
              </p>
            </>
          ) : null}
        </>
      ) : null}
    </Stage4Scaffold>
  );
};
