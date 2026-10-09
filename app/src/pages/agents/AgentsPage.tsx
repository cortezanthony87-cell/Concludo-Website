import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../lib/auth/AuthContext';
import {
  INITIAL_AGENTS,
  AgentDefinition,
  AgentType,
  AgentActivityRecord,
  AgentRunResult,
} from '../../lib/agents/types';
import { fetchAgentActivity } from '../../lib/agents/agentMemoryService';
import { runAgent } from '../../lib/agents/agentRunner';
import { fetchWorkflowApprovals } from '../../lib/workflows/workflowService';
import { WorkflowApprovalRecord } from '../../lib/workflows/types';
import { fetchIntegrations } from '../../lib/integrations/integrationClient';
import './agents-page-template.css';

interface AgentEditorialCopy {
  voice: string;
  watches: string;
  handsYou: string[];
  note?: string;
  sigilSvg: React.ReactNode;
}

const AGENT_EDITORIAL: Record<AgentType, AgentEditorialCopy> = {
  meeting_followup: {
    voice: 'I read the meeting after everyone has left, and I write the follow-up you were going to write tonight.',
    watches: 'Completed meetings that have a transcript and generated outputs attached.',
    handsYou: [
      'Follow-up summary',
      'Action review and decision review',
      'A drafted follow-up message',
      'A suggested agenda for next time',
    ],
    sigilSvg: (
      <svg viewBox="0 0 24 24" fill="none" stroke="#E2B53C" strokeWidth="1.6" strokeLinecap="round">
        <path d="M3 4h18v10H9l-6 5z" />
        <path d="M7 8h10M7 11h6" />
      </svg>
    ),
  },
  decision_followup: {
    voice: 'I keep every decision you have made in one place, and I tell you which ones have gone quiet.',
    watches: 'Saved decisions, their owners, their dependencies and how long since each one moved.',
    handsYou: [
      'Decisions still pending',
      'Unresolved dependencies',
      'Decisions that have gone inactive, and ones at risk',
      'A recommendation for each, to accept or ignore',
    ],
    sigilSvg: (
      <svg viewBox="0 0 24 24" fill="none" stroke="#E2B53C" strokeWidth="1.6" strokeLinecap="round">
        <path d="M12 3l5 5-5 5-5-5z" />
        <path d="M12 13v8M12 21h7" />
      </svg>
    ),
  },
  action_accountability: {
    voice: 'I watch the action tracker so you do not have to, and I tell you what is overdue, blocked, or has nobody\'s name on it.',
    watches: 'Every action in the tracker: its owner, its due date and whether it has moved.',
    handsYou: [
      'Overdue actions',
      'Blocked actions, with what is blocking them',
      'Commitments with no owner',
      'A drafted escalation you can send or bin',
    ],
    sigilSvg: (
      <svg viewBox="0 0 24 24" fill="none" stroke="#E2B53C" strokeWidth="1.6" strokeLinecap="round">
        <path d="M4 5h9M4 12h9M4 19h6" />
        <circle cx="18" cy="17" r="4" />
        <path d="M18 15.3V17l1.2.9" />
      </svg>
    ),
  },
  project_intelligence: {
    voice: 'I read across your meetings, not just the last one, and I tell you what keeps coming up.',
    watches: 'Meeting history across every project, looking for what repeats.',
    handsYou: [
      'Themes that keep returning',
      'Opportunities that are forming',
      'Delivery risks and stakeholder concerns',
      'Where execution keeps getting stuck',
    ],
    sigilSvg: (
      <svg viewBox="0 0 24 24" fill="none" stroke="#E2B53C" strokeWidth="1.6" strokeLinecap="round">
        <path d="M3 18c4-9 14-9 18 0" />
        <path d="M5 13c3-6 11-6 14 0" />
        <circle cx="12" cy="7" r="2.3" />
      </svg>
    ),
  },
  risk_monitoring: {
    voice: 'I look for the shape of trouble: deadlines that slip, risks that keep returning, work that quietly changes scope.',
    watches: 'Patterns across deadlines, delays, risks and scope. Work, never people.',
    handsYou: [
      'Deadlines that are breaking, and the pattern behind them',
      'Delays that keep repeating',
      'Risks that keep returning',
      'Where work is queuing, and project drift warnings',
    ],
    sigilSvg: (
      <svg viewBox="0 0 24 24" fill="none" stroke="#E2B53C" strokeWidth="1.6" strokeLinecap="round">
        <path d="M3 17l5-5 3 3 4-6" />
        <path d="M15 9h4v4" />
        <circle cx="19.5" cy="18.5" r="2.2" />
      </svg>
    ),
  },
  report_generation: {
    voice: 'I build the report on the day it is due, in the Concludo format, ready for you to read before anyone else does.',
    watches: 'The reporting calendar, and the records each report draws on.',
    handsYou: [
      'Endpoint reports and executive briefings',
      'Project health reports',
      'Decision audit reports',
      'Action performance reports, measured on actions',
    ],
    sigilSvg: (
      <svg viewBox="0 0 24 24" fill="none" stroke="#E2B53C" strokeWidth="1.6" strokeLinecap="round">
        <path d="M6 3h8l4 4v14H6z" />
        <path d="M14 3v4h4" />
        <path d="M9 12h6M9 16h4" />
      </svg>
    ),
  },
  workflow_coordinator: {
    voice: 'I carry the work from the meeting to the tasks to the calendar, and I stop at the approval step every time.',
    watches: 'Multi-step pipelines: meeting completed, actions identified, decisions saved, tasks created, people told.',
    handsYou: [
      'The execution plan, step by step',
      'The tasks it would create',
      'What it would send, and to whom',
      'One approval package covering the lot',
    ],
    note: 'This is the only agent that can dispatch to another system, and only after you approve the package.',
    sigilSvg: (
      <svg viewBox="0 0 24 24" fill="none" stroke="#E2B53C" strokeWidth="1.6" strokeLinecap="round">
        <circle cx="4.5" cy="12" r="2" />
        <circle cx="19.5" cy="12" r="2" />
        <path d="M6.5 12h3M14.5 12h3" />
        <path d="M12 8.5v7M9.5 10.5h5v3h-5z" stroke="#F59E0B" />
      </svg>
    ),
  },
  document_intelligence: {
    voice: 'I read the document the meeting was actually about, and I put what it means into the output, so nobody has to open the contract to understand it.',
    watches: 'Documents imported to a project, and whether the meeting engaged with any of them.',
    handsYou: [
      'Document brief, in every output that needs one',
      'What the document obliges, and by when',
      'The dates and amounts, with their source',
      'Risks, rated, with a clause reference',
      'Who to take it to, and what to ask them',
    ],
    note: 'It explains documents. It does not give legal, accounting or tax advice, and it never says whether a clause is enforceable.',
    sigilSvg: (
      <svg viewBox="0 0 24 24" fill="none" stroke="#E2B53C" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
        <path d="M4 3h11l5 5v13H4z" />
        <path d="M15 3v5h5" />
        <path d="M8 13h8" stroke="#F59E0B" />
        <circle cx="10" cy="17" r="2.2" />
        <path d="M11.6 18.6L14 21" />
      </svg>
    ),
  },
  inbox_command_centre: {
    voice: 'I read your inbox before you do, and I tell you what needs you today, what is waiting on someone else, and what can wait until Friday.',
    watches: 'A connected mailbox, in read-only. Work and personal stay separate.',
    handsYou: [
      'A morning briefing, ranked',
      'What is waiting on you, and what you are waiting on',
      'Deadlines and commitments buried in threads',
      'Reply drafts, held for your approval',
      'Anything that looks like phishing or fraud',
    ],
    note: 'It never sends, deletes, files or unsubscribes. A draft reaches your mailbox only after you approve that exact text. Starter: 3 runs/week (resets weekly). Pro and Team: unlimited.',
    sigilSvg: (
      <svg viewBox="0 0 24 24" fill="none" stroke="#E2B53C" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
        <path d="M3 6l9 6 9-6" />
        <path d="M3 6v12h5" />
        <path d="M21 6v5" />
        <path d="M12 13h9" />
        <path d="M12 17h6" />
        <path d="M12 21h3" />
      </svg>
    ),
  },
};

export const AgentsPage: React.FC = () => {
  const { user } = useAuth();
  const [agents] = useState<AgentDefinition[]>(INITIAL_AGENTS);
  const [activities, setActivities] = useState<AgentActivityRecord[]>([]);
  const [approvals, setApprovals] = useState<WorkflowApprovalRecord[]>([]);
  const [hasMailboxConnected, setHasMailboxConnected] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Execution modal state & card timer
  const [runningAgent, setRunningAgent] = useState<AgentType | null>(null);
  const [executing, setExecuting] = useState<boolean>(false);
  const [elapsedSeconds, setElapsedSeconds] = useState<number>(0);
  const timerRef = useRef<any>(null);

  const [runResult, setRunResult] = useState<AgentRunResult | null>(null);
  const [execError, setExecError] = useState<string | null>(null);

  // Selected agent for viewing outputs
  const [viewingOutputsAgent, setViewingOutputsAgent] = useState<AgentType | null>(null);

  const loadPageData = async () => {
    if (!user) return;
    setLoading(true);
    setError(null);
    try {
      const [actData, appData, intData] = await Promise.all([
        fetchAgentActivity({ userId: user.id }),
        fetchWorkflowApprovals({ userId: user.id }).catch(() => []),
        fetchIntegrations().catch(() => []),
      ]);
      setActivities(actData);
      setApprovals(appData);
      const mailboxConnected = (intData as any[]).some(
        (i: any) =>
          (i.provider === 'outlook_mail' || i.provider === 'gmail' || i.provider === 'mailbox') &&
          i.status === 'connected'
      );
      setHasMailboxConnected(mailboxConnected);
    } catch (err: any) {
      setError('Failed to load agents activity logs. Please verify permissions.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadPageData();
  }, [user]);

  // Elapsed time tracker for running agent
  useEffect(() => {
    if (executing) {
      setElapsedSeconds(0);
      timerRef.current = setInterval(() => {
        setElapsedSeconds((prev) => prev + 1);
      }, 1000);
    } else {
      if (timerRef.current) clearInterval(timerRef.current);
      setElapsedSeconds(0);
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [executing]);

  // Derived counts strictly from INITIAL_AGENTS to guarantee zero discrepancy
  const totalCount = agents.length;
  const proposeCount = useMemo(() => agents.filter((a) => a.requiresReview).length, [agents]);
  const reportCount = useMemo(() => agents.filter((a) => !a.requiresReview).length, [agents]);

  const meetingLane = useMemo(
    () => agents.filter((a) => a.category === 'Meeting & Decisions'),
    [agents]
  );
  const operationsLane = useMemo(
    () => agents.filter((a) => a.category === 'Operations & Tasks'),
    [agents]
  );
  const intelligenceLane = useMemo(
    () => agents.filter((a) => a.category === 'Intelligence & Risk'),
    [agents]
  );
  const orchestrationLane = useMemo(
    () => agents.filter((a) => a.category === 'Orchestration'),
    [agents]
  );

  const pendingApprovalsByAgent = useMemo(() => {
    const map = new Set<string>();
    approvals.forEach((app) => {
      if (app.status === 'pending') {
        if (app.workflow_id) map.add('workflow_coordinator');
      }
    });
    return map;
  }, [approvals]);

  const handleRunAgent = async (agentType: AgentType) => {
    if (!user || executing) return;
    setRunningAgent(agentType);
    setExecuting(true);
    setRunResult(null);
    setExecError(null);

    try {
      const result = await runAgent({
        agentType,
        userId: user.id,
      });
      setRunResult(result);
      await loadPageData();
    } catch (err: any) {
      setExecError(`Failed to complete action: ${err.message || 'Execution error'}`);
    } finally {
      setExecuting(false);
    }
  };

  const handleCloseModal = () => {
    setRunResult(null);
    setExecError(null);
    setRunningAgent(null);
  };

  const renderCard = (agent: AgentDefinition) => {
    const editorial = AGENT_EDITORIAL[agent.id] || {
      voice: agent.description,
      watches: agent.purpose,
      handsYou: agent.supportedOutputs,
      sigilSvg: (
        <svg viewBox="0 0 24 24" fill="none" stroke="#E2B53C" strokeWidth="1.6">
          <circle cx="12" cy="12" r="8" />
        </svg>
      ),
    };

    const isRunning = executing && runningAgent === agent.id;
    const isWaiting = pendingApprovalsByAgent.has(agent.id);
    const needsMailbox = agent.requiresConnection === 'mailbox' && !hasMailboxConnected;

    let cardStateClass = '';
    if (isRunning) cardStateClass = 'state-running';
    else if (isWaiting) cardStateClass = 'state-waiting';
    else if (needsMailbox) cardStateClass = 'state-needs-connection';

    return (
      <article key={agent.id} className={`agents-card ${cardStateClass}`}>
        <div className="agents-top">
          <span className="agents-sigil" aria-hidden="true">
            {editorial.sigilSvg}
          </span>
          <div>
            <h4>{agent.name}</h4>
            {agent.requiresReview ? (
              <span className="agents-pill decide">Proposes. You decide</span>
            ) : (
              <span className="agents-pill reports">Reports only</span>
            )}
          </div>
        </div>

        <p className="agents-voice">{editorial.voice}</p>

        <div className="agents-kv">
          <div className="agents-k">Watches</div>
          <div className="agents-v">{editorial.watches}</div>
        </div>

        <div className="agents-kv">
          <div className="agents-k">Hands you</div>
          <ul>
            {editorial.handsYou.map((output, idx) => (
              <li key={idx}>{output}</li>
            ))}
          </ul>
        </div>

        {editorial.note && (
          <div className="agents-kv">
            <div className="agents-k">Note</div>
            <div className="agents-v">{editorial.note}</div>
          </div>
        )}

        {isWaiting && (
          <div className="agents-card-notice notice-waiting">
            <span>One package is waiting in the Approval centre</span>
            <Link to="/approvals" style={{ textDecoration: 'underline', fontWeight: 600 }}>
              Review →
            </Link>
          </div>
        )}

        {needsMailbox && (
          <div className="agents-card-notice notice-missing">
            <span>Connect a mailbox to run this agent</span>
            <Link to="/integrations" style={{ textDecoration: 'underline', fontWeight: 600 }}>
              Connect →
            </Link>
          </div>
        )}

        <div className="agents-foot">
          <span className="agents-sched">
            {isRunning ? (
              <span style={{ color: 'var(--gold)', fontWeight: 600 }}>
                Running {elapsedSeconds}s...
              </span>
            ) : agent.trigger === 'on_output_generation' ? (
              'Runs with every output'
            ) : agent.scheduleSupport ? (
              'Schedulable'
            ) : (
              'Run when you need it'
            )}
          </span>

          <button
            type="button"
            className="agents-ghost"
            onClick={() => setViewingOutputsAgent(agent.id)}
            title="View recent outputs and audit history"
          >
            View outputs
          </button>

          {agent.trigger === 'on_output_generation' ? (
            <button
              type="button"
              className="agents-run"
              onClick={() => setViewingOutputsAgent(agent.id)}
              title="View what Document Intelligence added to outputs"
            >
              View what it added
            </button>
          ) : (
            <button
              type="button"
              className="agents-run"
              onClick={() => handleRunAgent(agent.id)}
              disabled={executing || needsMailbox}
            >
              {isRunning ? `Running (${elapsedSeconds}s)` : 'Run agent'}
            </button>
          )}
        </div>
      </article>
    );
  };

  const currentAgentOutputs = useMemo(() => {
    if (!viewingOutputsAgent) return [];
    return activities.filter((act) => act.agent_type === viewingOutputsAgent);
  }, [activities, viewingOutputsAgent]);

  const viewingAgentDef = useMemo(() => {
    return agents.find((a) => a.id === viewingOutputsAgent);
  }, [agents, viewingOutputsAgent]);

  return (
    <div className="agents-page-root">
      {/* Sticky Top Header */}
      <header className="agents-hdr">
        <div className="agents-wrap">
          <Link to="/dashboard" className="agents-crumb" aria-label="Back to Workspace Dashboard">
            &#8249; Workspace
          </Link>
          <span className="agents-sep" aria-hidden="true">
            /
          </span>
          <h1>AI Agents</h1>
          <nav className="agents-nav" aria-label="Agent sections">
            <Link to="/agents" aria-current="page">
              Agents
            </Link>
            <Link to="/agents/dashboard">Agent dashboard</Link>
            <Link to="/workflows">Workflows</Link>
            <Link to="/approvals">Approval centre</Link>
            <Link to="/workflows/governance">Governance</Link>
          </nav>
        </div>
      </header>

      {/* Main Content Wrap */}
      <main className="agents-wrap">
        {/* Band 01: Hero Identity & Promise */}
        <section className="agents-hero">
          <p className="agents-eyebrow">AI Agents</p>
          <h2>Nine agents that do the work after the meeting</h2>
          <p className="agents-lede">
            Each one watches something specific, drafts what it finds, and then stops. Nothing is
            sent, assigned or changed until a person approves it.
          </p>
          <div className="agents-rule" />
          <div className="agents-marks">
            <div>
              <span className="agents-num">{totalCount}</span>
              <span className="agents-lab">Agents</span>
            </div>
            <div>
              <span className="agents-num">4</span>
              <span className="agents-lab">Groups of work</span>
            </div>
            <div>
              <span className="agents-num">1</span>
              <span className="agents-lab">Approval gate, always</span>
            </div>
            <div>
              <span className="agents-num">0</span>
              <span className="agents-lab">Actions taken without a person</span>
            </div>
          </div>

          {/* Band 02: The Principle & Governance */}
          <p className="agents-principle">Concludo proposes. A person disposes.</p>
          <div className="agents-gov">
            <div>
              <div className="agents-k">Approval first</div>
              <div className="agents-v">
                No agent sends a message, assigns work or changes a record on its own. Every
                external action waits for a named person.
              </div>
            </div>
            <div>
              <div className="agents-k">Work, not people</div>
              <div className="agents-v">
                Agents report on actions, decisions, deadlines and risks. They do not score, rank
                or rate anyone.
              </div>
            </div>
            <div>
              <div className="agents-k">On the record</div>
              <div className="agents-v">
                What an agent read, what it produced and who approved it is written to the audit log
                and kept.
              </div>
            </div>
          </div>
        </section>

        {/* Band 03: Where the agents sit (Pipeline) */}
        <section className="agents-band" aria-labelledby="flow-h">
          <h3 id="flow-h">Where the agents sit</h3>
          <p className="agents-sub">
            From a pasted transcript to finished work. The agents occupy one step, and the approval
            gate sits between them and the world.
          </p>
          <div className="agents-flow">
            <div className="agents-step">
              <div className="agents-n">01</div>
              <div className="agents-t">Transcript in</div>
              <div className="agents-d">
                Paste a transcript from any source. Concludo does not record or join meetings.
              </div>
            </div>
            <div className="agents-step">
              <div className="agents-n">02</div>
              <div className="agents-t">Outputs generated</div>
              <div className="agents-d">
                Summary, actions, decisions and the documents you asked for.
              </div>
            </div>
            <div className="agents-step agents-step-tint">
              <div className="agents-n">03</div>
              <div className="agents-t">Agents read and draft</div>
              <div className="agents-d">
                Nine agents watch what was produced and draft what comes next.
              </div>
            </div>
            <div className="agents-step agents-step-gate">
              <div className="agents-n">04</div>
              <div className="agents-t">A person approves</div>
              <div className="agents-d">
                Nothing leaves Concludo and nothing is assigned until this step is cleared.
              </div>
            </div>
            <div className="agents-step">
              <div className="agents-n">05</div>
              <div className="agents-t">Work lands</div>
              <div className="agents-d">
                Tasks, calendar dates, messages and reports, with the source attached.
              </div>
            </div>
          </div>

          {/* Band 04: Posture Legend */}
          <div className="agents-legend">
            <div className="agents-p">
              <span className="agents-pill decide">Proposes. You decide</span>
              <div className="agents-body">
                <strong>{proposeCount === 7 ? 'Seven agents' : `${proposeCount} agents`}</strong>
                Draft work and hold it. The draft exists, nobody else has seen it, and it goes
                nowhere until you approve it.
              </div>
            </div>
            <div className="agents-p">
              <span className="agents-pill reports">Reports only</span>
              <div className="agents-body">
                <strong>{reportCount === 2 ? 'Two agents' : `${reportCount} agents`}</strong>
                Read and write a report for you. They change nothing, send nothing and assign
                nothing, ever.
              </div>
            </div>
          </div>
        </section>

        {/* Band 05: Four Lanes of Agents */}

        {/* Lane 1: Meeting and decisions (2) */}
        <section className="agents-lane">
          <div className="agents-lane-head">
            <h3>Meeting and decisions</h3>
            <span className="agents-pill cat">
              {meetingLane.length === 1 ? '1 agent' : `${meetingLane.length} agents`}
            </span>
            <span className="agents-c">What was said, and what was decided</span>
          </div>
          <div className="agents-grid">
            {meetingLane.map(renderCard)}
            <aside className="agents-note">
              <div className="agents-k">What these two do not do</div>
              <p>
                Both read what a meeting produced, not the meeting itself. Concludo does not join,
                record or transcribe a conversation. If no transcript was pasted, these agents have
                nothing to read and they say so rather than guessing.
              </p>
            </aside>
          </div>
        </section>

        {/* Lane 2: Operations and tasks (1) */}
        <section className="agents-lane">
          <div className="agents-lane-head">
            <h3>Operations and tasks</h3>
            <span className="agents-pill cat">
              {operationsLane.length === 1 ? '1 agent' : `${operationsLane.length} agents`}
            </span>
            <span className="agents-c">What was promised, and whether it is moving</span>
          </div>
          <div className="agents-grid">
            {operationsLane.map(renderCard)}
            <aside className="agents-note">
              <div className="agents-k">Two focused operating agents</div>
              <p>
                Action tracking and mailbox triage are kept clean and distinct. Neither agent modifies
                external records or dispatches replies without a person approving the exact text.
              </p>
            </aside>
          </div>
        </section>

        {/* Lane 3: Intelligence and risk (3) */}
        <section className="agents-lane">
          <div className="agents-lane-head">
            <h3>Intelligence and risk</h3>
            <span className="agents-pill cat">
              {intelligenceLane.length === 1 ? '1 agent' : `${intelligenceLane.length} agents`}
            </span>
            <span className="agents-c">What is building up across all of it</span>
          </div>
          <div className="agents-grid">{intelligenceLane.map(renderCard)}</div>
        </section>

        {/* Lane 4: Orchestration (1) */}
        <section className="agents-lane">
          <div className="agents-lane-head">
            <h3>Orchestration</h3>
            <span className="agents-pill cat">
              {orchestrationLane.length === 1 ? '1 agent' : `${orchestrationLane.length} agents`}
            </span>
            <span className="agents-c">The one that carries work between the others</span>
          </div>
          <div className="agents-grid">
            {orchestrationLane.map(renderCard)}
            <aside className="agents-note agents-span2">
              <div className="agents-k">The strictest gate in the product</div>
              <p>
                The coordinator is the only agent that can reach another system, and it is the one
                that waits the longest. It assembles the whole pipeline, shows you every step and
                every dispatch in one package, and stops. Approve the package and the relay runs.
                Decline it and nothing moves.
              </p>
            </aside>
          </div>
        </section>

        {/* Closing Band */}
        <section className="agents-close">
          <div>
            <div className="agents-k">What an agent cannot do</div>
            <div className="agents-v">
              Send a message, assign work to a person, change a decision, delete a record, or reach
              another system, without an approval recorded against a named person.
            </div>
          </div>
          <div>
            <div className="agents-k">What is kept</div>
            <div className="agents-v">
              Every run records what the agent read, what it produced, how long it took, and who
              approved or declined it. Declined work is kept too.
            </div>
          </div>
          <div>
            <div className="agents-k">Where to go next</div>
            <div className="agents-v">
              The Approval centre holds anything waiting on you. The Agent dashboard shows what
              has run. Governance holds the rules these agents work under.
            </div>
          </div>
        </section>
      </main>

      {/* Execution Result Modal */}
      {(executing || runResult || execError) && (
        <div className="agents-modal-overlay">
          <div className="agents-modal-box">
            <button
              type="button"
              onClick={handleCloseModal}
              className="agents-modal-close"
              aria-label="Close dialog"
            >
              ✕
            </button>

            <h3 style={{ fontFamily: 'var(--font-h)', fontSize: '18px', fontWeight: 700, margin: '0 0 12px' }}>
              {executing ? 'Running Agent...' : 'Agent Execution Result'}
            </h3>

            {executing && (
              <div style={{ textAlign: 'center', padding: '36px 0' }}>
                <div
                  style={{
                    width: '32px',
                    height: '32px',
                    border: '2px solid var(--gold)',
                    borderTopColor: 'transparent',
                    borderRadius: '50%',
                    animation: 'spin 1s linear infinite',
                    margin: '0 auto 16px',
                  }}
                />
                <p style={{ color: 'var(--sub)', fontSize: '13px' }}>
                  Processing Agent and synthesizing outputs...
                </p>
              </div>
            )}

            {execError && (
              <div
                style={{
                  background: '#2D1416',
                  border: '1px solid #6E2629',
                  color: '#F87171',
                  padding: '12px',
                  borderRadius: '6px',
                  fontSize: '12.5px',
                  marginBottom: '16px',
                }}
              >
                {execError}
              </div>
            )}

            {runResult && (
              <div style={{ maxHeight: '60vh', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '14px' }}>
                <div
                  style={{
                    background: 'var(--ground)',
                    border: '1px solid var(--navy2)',
                    padding: '14px',
                    borderRadius: '6px',
                  }}
                >
                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      fontFamily: 'var(--font-m)',
                      fontSize: '11px',
                      color: 'var(--sub)',
                      marginBottom: '6px',
                    }}
                  >
                    <span>AGENT: {runResult.agentType}</span>
                    <span>DURATION: {runResult.executionDurationMs}ms</span>
                  </div>
                  <p style={{ color: 'var(--ok)', fontSize: '13px', margin: 0, fontWeight: 500 }}>
                    {runResult.summary}
                  </p>
                </div>

                {runResult.requiresApproval && (
                  <div
                    style={{
                      background: '#2A2008',
                      border: '1px solid #5C4310',
                      padding: '14px',
                      borderRadius: '6px',
                    }}
                  >
                    <p style={{ color: 'var(--warn)', fontSize: '12px', fontWeight: 600, margin: '0 0 4px' }}>
                      Human Approval Requested
                    </p>
                    <p style={{ color: 'var(--sub)', fontSize: '12.5px', margin: 0 }}>
                      This agent generated external operational items or escalations. Action has been staged in the Approval Centre for administrator sign-off.
                    </p>
                    <Link
                      to="/approvals"
                      style={{
                        display: 'inline-block',
                        marginTop: '8px',
                        color: 'var(--gold)',
                        fontSize: '12px',
                        textDecoration: 'underline',
                      }}
                    >
                      Go to Approval Centre →
                    </Link>
                  </div>
                )}

                <div
                  style={{
                    background: 'var(--ground)',
                    border: '1px solid var(--navy2)',
                    padding: '12px',
                    borderRadius: '6px',
                    fontFamily: 'var(--font-m)',
                    fontSize: '11px',
                    color: 'var(--sub)',
                    overflowX: 'auto',
                  }}
                >
                  <pre style={{ margin: 0 }}>{JSON.stringify(runResult.data, null, 2)}</pre>
                </div>
              </div>
            )}

            <div style={{ marginTop: '20px', paddingTop: '14px', borderTop: '1px solid var(--navy2)', display: 'flex', justifyContent: 'flex-end' }}>
              <button
                type="button"
                onClick={handleCloseModal}
                className="agents-ghost"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* View Outputs Modal */}
      {viewingOutputsAgent && (
        <div className="agents-modal-overlay">
          <div className="agents-modal-box">
            <button
              type="button"
              onClick={() => setViewingOutputsAgent(null)}
              className="agents-modal-close"
              aria-label="Close dialog"
            >
              ✕
            </button>

            <h3 style={{ fontFamily: 'var(--font-h)', fontSize: '18px', fontWeight: 700, margin: '0 0 4px' }}>
              {viewingAgentDef?.name || 'Agent'} Outputs
            </h3>
            <p style={{ color: 'var(--sub)', fontSize: '12.5px', margin: '0 0 16px' }}>
              Recorded outputs, review posture and activity history for this agent.
            </p>

            <div style={{ maxHeight: '60vh', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {currentAgentOutputs.length === 0 ? (
                <div
                  style={{
                    padding: '24px',
                    textAlign: 'center',
                    color: 'var(--sub)',
                    fontSize: '13px',
                    background: 'var(--ground)',
                    border: '1px dashed var(--navy2)',
                    borderRadius: '6px',
                  }}
                >
                  No recent execution records found for this agent. Trigger a run or view the full audit history in the Agent Dashboard.
                </div>
              ) : (
                currentAgentOutputs.map((act) => (
                  <div
                    key={act.id}
                    style={{
                      background: 'var(--ground)',
                      border: '1px solid var(--navy2)',
                      padding: '12px',
                      borderRadius: '6px',
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                      <span style={{ fontFamily: 'var(--font-m)', fontSize: '11px', color: 'var(--gold)' }}>
                        {act.action_type}
                      </span>
                      <span
                        className={`agents-pill ${
                          act.status === 'success'
                            ? 'reports'
                            : act.status === 'requires_approval'
                            ? 'decide'
                            : 'reports'
                        }`}
                        style={{ fontSize: '9px', padding: '3px 8px' }}
                      >
                        {act.status}
                      </span>
                    </div>
                    <p style={{ color: 'var(--light)', fontSize: '12.5px', margin: '0 0 6px' }}>
                      {act.details?.summary || act.details?.error || 'Execution completed'}
                    </p>
                    <div style={{ fontFamily: 'var(--font-m)', fontSize: '10px', color: '#5F6E85' }}>
                      {new Date(act.created_at).toLocaleString('en-AU')}
                    </div>
                  </div>
                ))
              )}
            </div>

            <div
              style={{
                marginTop: '20px',
                paddingTop: '14px',
                borderTop: '1px solid var(--navy2)',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
              }}
            >
              <Link
                to="/agents/dashboard"
                style={{
                  fontFamily: 'var(--font-m)',
                  fontSize: '11px',
                  color: 'var(--gold)',
                  textDecoration: 'underline',
                }}
              >
                Open Full Agent Dashboard →
              </Link>
              <button
                type="button"
                onClick={() => setViewingOutputsAgent(null)}
                className="agents-ghost"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AgentsPage;
