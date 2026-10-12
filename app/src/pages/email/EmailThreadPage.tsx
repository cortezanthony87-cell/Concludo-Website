/**
 * The Thread Intelligence workspace.
 *
 * Desktop is three columns: thread list, the original conversation, and the
 * analysis. Below 1100px it becomes three accessible sections reachable from
 * one control, because three columns on a phone is three unreadable columns.
 *
 * The original email is never more than one control away at any width. It is
 * the only thing on the screen that is not an interpretation, so it has to stay
 * reachable when a person stops trusting the interpretation.
 */
import React, { useCallback, useMemo, useState } from 'react';
import { useOutletContext, useParams, useLocation, Link } from 'react-router-dom';
import { ArrowLeft, Search, Mail, Brain, List } from 'lucide-react';
import { EmailModuleContext } from '../../components/email/EmailModuleLayout';
import { ConversationPane } from '../../components/email/ConversationPane';
import { IntelligencePane } from '../../components/email/IntelligencePane';
import { EmptyBlock, ErrorBlock, LoadingBlock } from '../../components/email/StateBlocks';
import { AccountBadge, BandBadge, StatusBadge, formatDay } from '../../components/email/viewPrimitives';
import { useViewData } from '../../lib/email/useViewData';
import { DraftSessionProvider } from '../../lib/email/draftSession';
import {
  INTELLIGENCE_TABS,
  IntelligenceTabKey,
  locationsFor,
  threadDetail,
  threadListFor,
} from '../../lib/email/threadIntelligence';
import { PriorityBand, ThreadStatus } from '../../lib/email/model';

type PaneKey = 'list' | 'conversation' | 'intelligence';

const PANES: readonly { key: PaneKey; label: string; iconName: 'List' | 'Mail' | 'Brain' }[] = [
  { key: 'list', label: 'Threads', iconName: 'List' },
  { key: 'conversation', label: 'Original email', iconName: 'Mail' },
  { key: 'intelligence', label: 'Intelligence', iconName: 'Brain' },
];

export const EmailThreadPage: React.FC = () => {
  const { accountId, linkTo } = useOutletContext<EmailModuleContext>();
  const { threadId } = useParams<{ threadId: string }>();
  const { dataset, accountLabel, accountType, state, now } = useViewData(accountId);

  // `?tab=` lets a link land on a specific analysis tab, which is how the
  // "View summary" and "Draft reply" actions reach the right place rather than
  // dropping a person on Overview and leaving them to find it.
  const location = useLocation();
  const requestedTab = new URLSearchParams(location.search).get('tab');
  const validTab = INTELLIGENCE_TABS.some((t) => t.key === requestedTab)
    ? (requestedTab as IntelligenceTabKey)
    : 'overview';

  const [tab, setTab] = useState<IntelligenceTabKey>(validTab);
  const [pane, setPane] = useState<PaneKey>('intelligence');
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<{ id: string; label: string } | null>(null);

  const detail = useMemo(
    () => (threadId ? threadDetail(dataset, threadId) : null),
    [dataset, threadId]
  );
  const threads = useMemo(() => threadListFor(dataset), [dataset]);

  const filteredThreads = useMemo(() => {
    const needle = search.trim().toLowerCase();
    if (!needle) return threads;
    return threads.filter(
      (r) =>
        r.thread.subject.toLowerCase().includes(needle) ||
        r.counterpartyName.toLowerCase().includes(needle) ||
        r.analysis.oneLineSummary.toLowerCase().includes(needle)
    );
  }, [threads, search]);

  const onSelectSource = useCallback(
    (id: string, label: string) => {
      setSelected((current) => (current?.id === id ? null : { id, label }));
      // On a narrow screen the conversation is a separate section, so revealing
      // a source has to take the person there. Highlighting something they
      // cannot see is not revealing it.
      if (window.matchMedia('(max-width: 1100px)').matches) setPane('conversation');
    },
    []
  );

  const highlights = useMemo(() => {
    if (!detail || !selected) return [];
    const extraction = detail.extractions.find((e) => e.id === selected.id);
    if (!extraction) return [];
    return locationsFor(detail.messages, extraction);
  }, [detail, selected]);

  if (state === 'loading') {
    return (
      <section className="ecc-page">
        <LoadingBlock label="this thread" rows={5} />
      </section>
    );
  }

  if (state === 'error' || !dataset) {
    return (
      <section className="ecc-page">
        <ErrorBlock
          label="this thread"
          message="This account is not available, so nothing is being shown. That is different from having nothing to do. Check the account selector above."
        />
      </section>
    );
  }

  if (!detail) {
    return (
      <section className="ecc-page">
        <h2 className="ecc-page-title">Thread not found</h2>
        <EmptyBlock
          message="This thread is not on the account you have open."
          note="Threads are never looked up across accounts. If you reached this from a link, it may belong to the other account, and you would need to switch to it deliberately."
        />
        <Link className="btn-secondary" to={linkTo('/email/all')}>
          Back to All Email
        </Link>
      </section>
    );
  }

  const fromAddress = dataset.account.address;

  return (
    <DraftSessionProvider now={now}>
      <section className="ecc-page ecc-workspace-page" aria-labelledby="ecc-thread-heading">
        <header className="ecc-thread-head">
          <Link className="ecc-text-button ecc-back-link" to={linkTo('/email/all')}>
            <ArrowLeft size={14} aria-hidden="true" />
            Back to All Email
          </Link>
          <h2 id="ecc-thread-heading" className="ecc-page-title">
            {detail.record.thread.subject}
          </h2>
          <div className="ecc-card-badges">
            <AccountBadge accountType={accountType} label={accountLabel} />
            <BandBadge
              band={detail.analysis.priorityBand as PriorityBand}
              score={detail.analysis.priorityScore}
            />
            <StatusBadge status={detail.status as ThreadStatus} />
          </div>
          <p className="ecc-view-account">
            Showing <strong>{accountLabel}</strong>, the {accountType} account. Work and personal are
            never combined.
          </p>
        </header>

        {/*
          The pane switcher. It is always rendered and always operable; CSS
          hides it at desktop width where all three columns are on screen at
          once. Rendering it conditionally on a media query would make it
          unavailable to anything that does not run the query.
        */}
        <div className="ecc-pane-switch" role="tablist" aria-label="Workspace sections">
          {PANES.map((p) => (
            <button
              key={p.key}
              role="tab"
              type="button"
              aria-selected={pane === p.key}
              aria-controls={`ecc-pane-${p.key}`}
              className={`ecc-pane-tab ${pane === p.key ? 'ecc-pane-tab-active' : ''}`}
              onClick={() => setPane(p.key)}
            >
              {p.iconName === 'List' ? <List size={14} aria-hidden="true" /> : null}
              {p.iconName === 'Mail' ? <Mail size={14} aria-hidden="true" /> : null}
              {p.iconName === 'Brain' ? <Brain size={14} aria-hidden="true" /> : null}
              {p.label}
            </button>
          ))}
        </div>

        <div className={`ecc-workspace ecc-pane-${pane}`}>
          {/* ------------------------------------------- left: thread list */}
          <div
            className="ecc-col ecc-col-list"
            id="ecc-pane-list"
            role="tabpanel"
            aria-labelledby="ecc-thread-heading"
          >
            <h3 className="ecc-column-title">Threads</h3>
            <div className="ecc-control ecc-control-search">
              <label className="ecc-control-label" htmlFor="ecc-thread-search">
                Search this account
              </label>
              <div className="ecc-search-wrap">
                <Search size={14} aria-hidden="true" className="ecc-search-icon" />
                <input
                  id="ecc-thread-search"
                  type="search"
                  className="ecc-input"
                  placeholder="Sender, subject or summary"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>
            </div>
            <p className="ecc-column-note" role="status">
              {filteredThreads.length} of {threads.length} threads
            </p>
            <ul className="ecc-thread-list">
              {filteredThreads.map((r) => {
                const current = r.thread.id === detail.record.thread.id;
                return (
                  <li key={r.thread.id}>
                    <Link
                      to={linkTo(`/email/thread/${r.thread.id}`)}
                      className={`ecc-thread-item ${current ? 'ecc-thread-item-current' : ''}`}
                      aria-current={current ? 'page' : undefined}
                    >
                      <span className="ecc-thread-sender">{r.counterpartyName}</span>
                      <span className="ecc-thread-subject">{r.thread.subject}</span>
                      <span className="ecc-thread-meta">
                        <BandBadge band={r.analysis.priorityBand as PriorityBand} />
                        <span className="ecc-thread-date">{formatDay(r.thread.lastMessageAt)}</span>
                      </span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>

          {/* --------------------------------------- centre: the real email */}
          <div
            className="ecc-col ecc-col-conversation"
            id="ecc-pane-conversation"
            role="tabpanel"
            aria-labelledby="ecc-conversation-heading"
          >
            <ConversationPane
              messages={detail.messages}
              attachments={detail.analysis.attachments}
              accountType={accountType}
              accountLabel={accountLabel}
              highlights={highlights}
              selectionLabel={selected?.label ?? null}
              onClearSelection={() => setSelected(null)}
            />
          </div>

          {/* ------------------------------------------ right: the analysis */}
          <div
            className="ecc-col ecc-col-intelligence"
            id="ecc-pane-intelligence"
            role="tabpanel"
            aria-labelledby="ecc-intelligence-heading"
          >
            <IntelligencePane
              detail={detail}
              draft={dataset.drafts.find((d) => d.threadId === detail.record.thread.id) ?? null}
              fromAddress={fromAddress}
              activeTab={tab}
              onTabChange={setTab}
              onSelectSource={onSelectSource}
              selectedId={selected?.id ?? null}
            />
          </div>
        </div>

      </section>
    </DraftSessionProvider>
  );
};
