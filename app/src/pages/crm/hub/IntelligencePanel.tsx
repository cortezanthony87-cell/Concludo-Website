import React, { useState } from 'react';
import * as Icons from 'lucide-react';
import { HUB_ATTENTION_CONDITIONS, getAttentionConditionsCount } from '../../../lib/crm/hub/data';
import { CommAttentionCondition } from '../../../lib/crm/hub/types';
import { useCrmWrite } from '../../../components/crm/Stage5Pieces';
import { dismissAttentionCondition } from '../../../lib/crm/hub/hubWrites';

interface IntelligencePanelProps {
  onDismissCondition?: (id: string, reason: string) => void;
}

interface CopilotAnswer {
  headline: string;
  body: string;
  citations: string[];
}

const COPILOT_KNOWLEDGE: Record<string, CopilotAnswer> = {
  meeting_summary: {
    headline: 'Meeting summary: Operating model session',
    body: 'Held 14 October 2026 (52 minutes) with Priya Nair (Head of Operations). Reviewed process bottlenecks across manufacturing plants. Three decisions recorded: scope limited to two Victorian sites, board review scheduled for 6 November, and weekly check-ins established. Five actions assigned with owners.',
    citations: [
      '[1] Operating model session transcript, 14 Oct (lines 48-112)',
      '[2] Approved decision log v2, page 2 (Scope confirmation)',
      '[3] CRM meeting record: Preliminary diagnostic debrief, 28 Sep',
    ],
  },
  follow_ups: {
    headline: 'Follow-ups owed (Northbridge Industrial)',
    body: 'Tom Reyes is scheduled to deliver the revised Phase 2 scope to Priya Nair by Thursday 30 October ahead of the Friday 31 October deadline. Inbound email from Daniel Okafor (21 Oct 11:48 am) requested clarification on procurement timelines and milestone payment terms.',
    citations: [
      '[1] Northbridge account room, message from Tom Reyes, 21 Oct 9:34 am',
      '[2] Email reference eml-ref-01 from Daniel Okafor, 21 Oct 11:48 am',
      '[3] CRM commitment record comm-s5-0012 (Open status)',
    ],
  },
  stakeholder_gaps: {
    headline: 'Stakeholder coverage and gaps',
    body: 'Priya Nair is recorded as Head of Operations (Primary contact) and Daniel Okafor as Procurement Lead. The Economic Buyer role remains unassigned on the account roster. Executive sponsorship is required before the 6 November board pack submission.',
    citations: [
      '[1] Northbridge Industrial stakeholder roster (2 active contacts)',
      '[2] Attention condition: no_executive_relationship',
      '[3] Diagnostic notes, 28 Sep (Plant manager mentions managing director review)',
    ],
  },
  account_summary: {
    headline: 'Account summary: Northbridge Industrial',
    body: 'Melbourne-based manufacturing enterprise undergoing operations review and modernisation across two facilities. Customer since March 2026. Active proposal: Operations review, phase 2 ($94,000 AUD). Account team: Maya Chen and Tom Reyes.',
    citations: [
      '[1] CRM organisation record: Northbridge Industrial',
      '[2] Opportunity opp-ops-phase2 (Probability: 65%)',
      '[3] Account plan summary, FY27 modernisation scope',
    ],
  },
};

export const IntelligencePanel: React.FC<IntelligencePanelProps> = ({ onDismissCondition }) => {
  const [conditions, setConditions] = useState<CommAttentionCondition[]>(HUB_ATTENTION_CONDITIONS);
  const [activeDismissId, setActiveDismissId] = useState<string | null>(null);
  const [dismissReason, setDismissReason] = useState<string>('');
  const [copilotQuery, setCopilotQuery] = useState<string>('');
  const [activeCopilotAnswer, setActiveCopilotAnswer] = useState<CopilotAnswer | null>(null);
  const write = useCrmWrite();

  const metCount = getAttentionConditionsCount(conditions);

  const handleDismiss = (cond: CommAttentionCondition) => {
    if (!dismissReason.trim()) return;
    const reasonText = dismissReason.trim();

    // Condition dismissal goes through commit()
    const result = write.run('Dismiss attention condition', (context, workspace) => {
      return dismissAttentionCondition({
        context,
        data: workspace,
        conditionId: cond.id,
        reason: reasonText,
      });
    });

    if (result) {
      setConditions((prev) =>
        prev.map((c) =>
          c.id === cond.id ? { ...c, status: 'dismissed', dismissedReason: reasonText } : c
        )
      );
      if (onDismissCondition) {
        onDismissCondition(cond.id, reasonText);
      }
      setActiveDismissId(null);
      setDismissReason('');
    }
  };

  const handleAskCopilot = (key: string) => {
    const answer = COPILOT_KNOWLEDGE[key];
    if (answer) {
      setActiveCopilotAnswer(answer);
    }
  };

  const handleCustomQuery = (e: React.FormEvent) => {
    e.preventDefault();
    if (!copilotQuery.trim()) return;
    const q = copilotQuery.toLowerCase();
    if (q.includes('meet') || q.includes('summary')) {
      setActiveCopilotAnswer(COPILOT_KNOWLEDGE.meeting_summary);
    } else if (q.includes('follow') || q.includes('owe') || q.includes('action')) {
      setActiveCopilotAnswer(COPILOT_KNOWLEDGE.follow_ups);
    } else if (q.includes('gap') || q.includes('stakeholder') || q.includes('buyer')) {
      setActiveCopilotAnswer(COPILOT_KNOWLEDGE.stakeholder_gaps);
    } else {
      setActiveCopilotAnswer(COPILOT_KNOWLEDGE.account_summary);
    }
    setCopilotQuery('');
  };

  return (
    <div className="hub-intel">
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', paddingBottom: '4px' }}>
        <Icons.Sparkles size={16} color="var(--hub-gold2)" />
        <h3 style={{ fontFamily: 'Poppins, sans-serif', fontSize: '14px', fontWeight: 600, margin: 0, color: 'var(--hub-ink)' }}>
          Intelligence and Copilot
        </h3>
        <span style={{ marginLeft: 'auto', fontSize: '10.5px', color: 'var(--hub-slate)', background: '#F1F4F9', padding: '2px 6px', borderRadius: '4px' }}>
          Screen S25
        </span>
      </div>

      {/* Copilot Ask Box */}
      <div style={{ background: 'var(--hub-navy)', color: '#FFFFFF', borderRadius: '10px', padding: '12px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <Icons.Sparkles size={14} color="var(--hub-gold)" />
          <span style={{ fontSize: '12.5px', fontWeight: 600 }}>Concludo Copilot</span>
        </div>
        <form onSubmit={handleCustomQuery} style={{ marginTop: '8px' }}>
          <div style={{ background: 'var(--hub-navy2)', border: '1px solid #2E4A72', borderRadius: '8px', padding: '6px 10px', color: '#C6D3E4', fontSize: '12px', display: 'flex', gap: '6px', alignItems: 'center' }}>
            <Icons.HelpCircle size={13} />
            <input
              type="text"
              placeholder="Ask about Northbridge Industrial..."
              value={copilotQuery}
              onChange={(e) => setCopilotQuery(e.target.value)}
              style={{ background: 'transparent', border: 0, color: '#FFFFFF', outline: 'none', width: '100%', fontSize: '12px' }}
            />
          </div>
        </form>
        <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginTop: '8px' }}>
          <button
            className="hub-chip dark"
            style={{ fontSize: '10.5px', padding: '2px 8px', minHeight: '26px', cursor: 'pointer', border: 0 }}
            onClick={() => handleAskCopilot('meeting_summary')}
          >
            Meeting summary
          </button>
          <button
            className="hub-chip dark"
            style={{ fontSize: '10.5px', padding: '2px 8px', minHeight: '26px', cursor: 'pointer', border: 0 }}
            onClick={() => handleAskCopilot('follow_ups')}
          >
            Follow-ups owed
          </button>
          <button
            className="hub-chip dark"
            style={{ fontSize: '10.5px', padding: '2px 8px', minHeight: '26px', cursor: 'pointer', border: 0 }}
            onClick={() => handleAskCopilot('stakeholder_gaps')}
          >
            Stakeholder gaps
          </button>
        </div>
      </div>

      {/* Interactive Cited Copilot Response */}
      {activeCopilotAnswer && (
        <div className="hub-card rule" style={{ background: '#FAFBFD', borderLeft: '3px solid var(--hub-gold)' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <h4 style={{ margin: 0, fontSize: '12.5px', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Icons.Sparkles size={13} color="var(--hub-gold2)" />
              {activeCopilotAnswer.headline}
            </h4>
            <button
              onClick={() => setActiveCopilotAnswer(null)}
              style={{ background: 'transparent', border: 0, color: 'var(--hub-slate)', cursor: 'pointer', padding: 2 }}
              aria-label="Close answer"
            >
              <Icons.X size={13} />
            </button>
          </div>
          <p style={{ fontSize: '12px', color: '#22324B', marginTop: '6px', lineHeight: 1.5 }}>
            {activeCopilotAnswer.body}
          </p>
          <div style={{ marginTop: '8px', paddingTop: '6px', borderTop: '1px solid var(--hub-hair)' }}>
            <div style={{ fontSize: '11px', fontWeight: 600, color: 'var(--hub-slate)', textTransform: 'uppercase' }}>Citations</div>
            {activeCopilotAnswer.citations.map((c, idx) => (
              <div key={idx} style={{ fontSize: '11px', color: '#33435C', marginTop: '3px' }}>
                {c}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Attention Conditions Card */}
      <div className="hub-card rule">
        <h4>
          <Icons.AlertCircle size={13} color="var(--hub-review)" />
          Needs attention
          <span className="right-info" style={{ color: metCount > 0 ? 'var(--hub-review)' : 'var(--hub-stated)' }}>
            {metCount} of 11 conditions met
          </span>
        </h4>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
          {conditions.map((cond) => (
            <div key={cond.id} style={{ borderTop: '1px solid #EEF1F6', paddingTop: '6px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span className={`hub-state ${cond.badgeTone === 'review' ? 'hub-st-rev' : cond.badgeTone === 'wait' ? 'hub-st-wait' : 'hub-st-open'}`}>
                  {cond.status === 'dismissed' ? 'Dismissed' : cond.badgeLabel}
                </span>
                <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--hub-ink)' }}>
                  {cond.conditionSentence}
                </span>
              </div>
              <div style={{ fontSize: '11px', color: 'var(--hub-slate)', marginTop: '2px', paddingLeft: '2px' }}>
                Evidence: {cond.evidenceSentence}
              </div>
              <div style={{ fontSize: '11px', color: '#33435C', marginTop: '1px', paddingLeft: '2px' }}>
                Resolution: {cond.whatWouldClearIt}
              </div>
              {cond.status === 'met' && (
                <div style={{ marginTop: '4px', textAlign: 'right' }}>
                  {activeDismissId === cond.id ? (
                    <div style={{ marginTop: '4px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                      <input
                        type="text"
                        placeholder="State reason for dismissal..."
                        value={dismissReason}
                        onChange={(e) => setDismissReason(e.target.value)}
                        style={{ fontSize: '11px', padding: '4px 6px', border: '1px solid var(--hub-hair)', borderRadius: '4px' }}
                      />
                      <div style={{ display: 'flex', gap: '4px', justifyContent: 'flex-end' }}>
                        <button
                          onClick={() => setActiveDismissId(null)}
                          style={{ fontSize: '10px', background: 'transparent', border: 0, color: 'var(--hub-slate)', cursor: 'pointer' }}
                        >
                          Cancel
                        </button>
                        <button
                          onClick={() => handleDismiss(cond)}
                          style={{ fontSize: '10px', background: 'var(--hub-navy)', color: '#fff', border: 0, padding: '2px 6px', borderRadius: '4px', cursor: 'pointer' }}
                        >
                          Confirm dismissal
                        </button>
                      </div>
                    </div>
                  ) : (
                    <button
                      onClick={() => setActiveDismissId(cond.id)}
                      style={{ fontSize: '10.5px', color: 'var(--hub-slate)', background: 'transparent', border: 0, cursor: 'pointer', textDecoration: 'underline' }}
                    >
                      Dismiss condition
                    </button>
                  )}
                </div>
              )}
              {cond.status === 'dismissed' && cond.dismissedReason && (
                <div style={{ fontSize: '10.5px', color: 'var(--hub-slate)', fontStyle: 'italic', marginTop: '2px' }}>
                  Dismissed reason: {cond.dismissedReason}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Account Summary */}
      <div className="hub-card">
        <h4>
          <Icons.FileText size={13} />
          Account summary
          <span className="right-info" style={{ fontSize: '10px', color: 'var(--hub-slate)' }}>Citations cited</span>
        </h4>
        <p style={{ fontSize: '12px', color: '#33435C', margin: 0, lineHeight: 1.5 }}>
          Northbridge Industrial is a Melbourne-based manufacturing organisation undergoing operations review and process modernisation across two Victorian facilities.
        </p>
        <div style={{ fontSize: '11px', color: 'var(--hub-slate)', marginTop: '6px' }}>
          Source: Diagnostic notes (28 Sep) and Operating model session (14 Oct).
        </div>
      </div>

      {/* Relationship Map */}
      <div className="hub-card">
        <h4>
          <Icons.Users size={13} />
          Relationship map
          <span className="right-info">2 recorded</span>
        </h4>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px' }}>
            <span className="hub-avatar x" style={{ width: '24px', height: '24px', fontSize: '9.5px' }}>PN</span>
            <span style={{ fontWeight: 600 }}>Priya Nair</span>
            <span style={{ marginLeft: 'auto', fontSize: '11px', color: 'var(--hub-slate)' }}>Head of Operations</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px' }}>
            <span className="hub-avatar x" style={{ width: '24px', height: '24px', fontSize: '9.5px' }}>DO</span>
            <span style={{ fontWeight: 600 }}>Daniel Okafor</span>
            <span style={{ marginLeft: 'auto', fontSize: '11px', color: 'var(--hub-slate)' }}>Procurement Lead</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px', border: '1px dashed #B9C4D6', borderRadius: '6px', padding: '4px 8px', background: '#FAFBFD' }}>
            <Icons.UserX size={14} color="var(--hub-review)" />
            <span style={{ fontWeight: 500, color: 'var(--hub-review)' }}>Economic buyer</span>
            <span style={{ marginLeft: 'auto', fontSize: '10.5px', color: 'var(--hub-review)', fontWeight: 600 }}>Role unassigned</span>
          </div>
        </div>
        <div style={{ fontSize: '10.5px', color: 'var(--hub-slate)', marginTop: '6px' }}>
          Missing roles show as dashed outlines, never guessed.
        </div>
      </div>

      {/* Suggested Next Actions */}
      <div className="hub-card">
        <h4>
          <Icons.CheckSquare size={13} />
          Suggested next actions
        </h4>
        <ol style={{ margin: 0, paddingLeft: '18px', fontSize: '12px', color: '#33435C', lineHeight: 1.6 }}>
          <li>Coordinate with Tom Reyes on revised scope delivery by 30 October.</li>
          <li>Request Priya Nair to identify the economic buyer for board sign-off.</li>
          <li>Schedule internal pre-brief session ahead of 6 November board meeting.</li>
        </ol>
      </div>

      {/* Open Opportunity */}
      <div className="hub-card">
        <h4>
          <Icons.Target size={13} />
          Open opportunity
        </h4>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '12px' }}>
          <span style={{ fontWeight: 600 }}>Operations review, phase 2</span>
          <span className="hub-state hub-st-open">Proposal</span>
        </div>
        <div style={{ fontSize: '11.5px', color: 'var(--hub-slate)', marginTop: '4px' }}>
          Target close: November 2026 · Value: $94,000 AUD · Probability: 65%
        </div>
      </div>
    </div>
  );
};
