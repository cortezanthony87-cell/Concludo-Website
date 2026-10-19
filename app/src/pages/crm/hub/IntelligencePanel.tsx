import React, { useState } from 'react';
import * as Icons from 'lucide-react';
import { HUB_ATTENTION_CONDITIONS, getAttentionConditionsCount } from '../../../lib/crm/hub/data';
import { CommAttentionCondition } from '../../../lib/crm/hub/types';
import { useCrmWrite } from '../../../components/crm/Stage5Pieces';
import { dismissAttentionCondition } from '../../../lib/crm/hub/hubWrites';

interface IntelligencePanelProps {
  onDismissCondition?: (id: string, reason: string) => void;
  mode?: 'panel' | 'full';
  onClose?: () => void;
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

export const IntelligencePanel: React.FC<IntelligencePanelProps> = ({
  onDismissCondition,
  mode = 'panel',
  onClose,
}) => {
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

  const isFull = mode === 'full';

  const copilotSection = (
    <>
      {/* Copilot Ask Box */}
      <div style={{ background: 'var(--hub-navy)', color: '#FFFFFF', borderRadius: '10px', padding: '14px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <Icons.Sparkles size={15} color="var(--hub-gold)" />
          <span style={{ fontSize: '13px', fontWeight: 600 }}>Concludo Copilot</span>
        </div>
        <form onSubmit={handleCustomQuery} style={{ marginTop: '10px' }}>
          <div style={{ background: 'var(--hub-navy2)', border: '1px solid #2E4A72', borderRadius: '8px', padding: '8px 12px', color: '#C6D3E4', fontSize: '12.5px', display: 'flex', gap: '8px', alignItems: 'center' }}>
            <Icons.HelpCircle size={14} />
            <input
              type="text"
              placeholder="Ask about Northbridge Industrial..."
              value={copilotQuery}
              onChange={(e) => setCopilotQuery(e.target.value)}
              style={{ background: 'transparent', border: 0, color: '#FFFFFF', outline: 'none', width: '100%', fontSize: '12.5px' }}
            />
          </div>
        </form>
        <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginTop: '10px' }}>
          <button
            className="hub-chip dark"
            style={{ fontSize: '11px', padding: '3px 9px', minHeight: '26px', cursor: 'pointer', border: 0 }}
            onClick={() => handleAskCopilot('meeting_summary')}
          >
            Meeting summary
          </button>
          <button
            className="hub-chip dark"
            style={{ fontSize: '11px', padding: '3px 9px', minHeight: '26px', cursor: 'pointer', border: 0 }}
            onClick={() => handleAskCopilot('follow_ups')}
          >
            Follow-ups owed
          </button>
          <button
            className="hub-chip dark"
            style={{ fontSize: '11px', padding: '3px 9px', minHeight: '26px', cursor: 'pointer', border: 0 }}
            onClick={() => handleAskCopilot('stakeholder_gaps')}
          >
            Stakeholder gaps
          </button>
        </div>
      </div>

      {/* Interactive Cited Copilot Response */}
      {activeCopilotAnswer && (
        <div className="hub-card rule" style={{ background: '#FAFBFD', borderLeft: '3px solid var(--hub-gold)', marginTop: '12px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <h4 style={{ margin: 0, fontSize: '13px', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Icons.Sparkles size={14} color="var(--hub-gold2)" />
              {activeCopilotAnswer.headline}
            </h4>
            <button
              onClick={() => setActiveCopilotAnswer(null)}
              style={{ background: 'transparent', border: 0, color: 'var(--hub-slate)', cursor: 'pointer', padding: 2 }}
              aria-label="Close answer"
            >
              <Icons.X size={14} />
            </button>
          </div>
          <p style={{ fontSize: '12.5px', color: '#22324B', marginTop: '8px', lineHeight: 1.5 }}>
            {activeCopilotAnswer.body}
          </p>
          <div style={{ marginTop: '10px', paddingTop: '8px', borderTop: '1px solid var(--hub-hair)' }}>
            <div style={{ fontSize: '11px', fontWeight: 600, color: 'var(--hub-slate)', textTransform: 'uppercase' }}>Citations</div>
            {activeCopilotAnswer.citations.map((c, idx) => (
              <div key={idx} style={{ fontSize: '11.5px', color: '#33435C', marginTop: '4px' }}>
                {c}
              </div>
            ))}
          </div>
        </div>
      )}
    </>
  );

  const attentionSection = (
    <div className="hub-card rule" style={{ marginTop: isFull ? 0 : '12px' }}>
      <h4>
        <Icons.AlertCircle size={14} color="var(--hub-review)" />
        Needs attention
        <span className="right-info" style={{ color: metCount > 0 ? 'var(--hub-review)' : 'var(--hub-stated)' }}>
          {metCount} of 11 conditions met
        </span>
      </h4>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '8px' }}>
        {conditions.map((cond) => (
          <div key={cond.id} style={{ borderTop: '1px solid #EEF1F6', paddingTop: '8px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span className={`hub-state ${cond.badgeTone === 'review' ? 'hub-st-rev' : cond.badgeTone === 'wait' ? 'hub-st-wait' : 'hub-st-open'}`}>
                {cond.status === 'dismissed' ? 'Dismissed' : cond.badgeLabel}
              </span>
              <span style={{ fontSize: '12.5px', fontWeight: 600, color: 'var(--hub-ink)' }}>
                {cond.conditionSentence}
              </span>
            </div>
            <div style={{ fontSize: '11.5px', color: 'var(--hub-slate)', marginTop: '3px', paddingLeft: '2px' }}>
              Evidence: {cond.evidenceSentence}
            </div>
            <div style={{ fontSize: '11.5px', color: '#33435C', marginTop: '2px', paddingLeft: '2px' }}>
              Resolution: {cond.whatWouldClearIt}
            </div>
            {cond.status === 'met' && (
              <div style={{ marginTop: '6px', textAlign: 'right' }}>
                {activeDismissId === cond.id ? (
                  <div style={{ marginTop: '4px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    <input
                      type="text"
                      placeholder="State reason for dismissal..."
                      value={dismissReason}
                      onChange={(e) => setDismissReason(e.target.value)}
                      style={{ fontSize: '11.5px', padding: '6px 8px', border: '1px solid var(--hub-hair)', borderRadius: '4px' }}
                    />
                    <div style={{ display: 'flex', gap: '6px', justifyContent: 'flex-end' }}>
                      <button
                        onClick={() => setActiveDismissId(null)}
                        style={{ fontSize: '11px', background: 'transparent', border: 0, color: 'var(--hub-slate)', cursor: 'pointer' }}
                      >
                        Cancel
                      </button>
                      <button
                        onClick={() => handleDismiss(cond)}
                        style={{ fontSize: '11px', background: 'var(--hub-navy)', color: '#fff', border: 0, padding: '3px 8px', borderRadius: '4px', cursor: 'pointer' }}
                      >
                        Confirm dismissal
                      </button>
                    </div>
                  </div>
                ) : (
                  <button
                    onClick={() => setActiveDismissId(cond.id)}
                    style={{ fontSize: '11px', color: 'var(--hub-slate)', background: 'transparent', border: 0, cursor: 'pointer', textDecoration: 'underline' }}
                  >
                    Dismiss condition
                  </button>
                )}
              </div>
            )}
            {cond.status === 'dismissed' && cond.dismissedReason && (
              <div style={{ fontSize: '11px', color: 'var(--hub-slate)', fontStyle: 'italic', marginTop: '3px' }}>
                Dismissed reason: {cond.dismissedReason}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );

  const contextCards = (
    <>
      {/* Relationship Map */}
      <div className="hub-card" style={{ marginTop: isFull ? 0 : '12px' }}>
        <h4>
          <Icons.Users size={14} />
          Relationship map
          <span className="right-info">2 recorded</span>
        </h4>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '8px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12.5px' }}>
            <span className="hub-avatar x" style={{ width: '26px', height: '26px', fontSize: '10px' }}>PN</span>
            <span style={{ fontWeight: 600 }}>Priya Nair</span>
            <span style={{ marginLeft: 'auto', fontSize: '11.5px', color: 'var(--hub-slate)' }}>Head of Operations</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12.5px' }}>
            <span className="hub-avatar x" style={{ width: '26px', height: '26px', fontSize: '10px' }}>DO</span>
            <span style={{ fontWeight: 600 }}>Daniel Okafor</span>
            <span style={{ marginLeft: 'auto', fontSize: '11.5px', color: 'var(--hub-slate)' }}>Procurement Lead</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12.5px', border: '1px dashed #B9C4D6', borderRadius: '6px', padding: '6px 10px', background: '#FAFBFD' }}>
            <Icons.UserX size={15} color="var(--hub-review)" />
            <span style={{ fontWeight: 500, color: 'var(--hub-review)' }}>Economic buyer</span>
            <span style={{ marginLeft: 'auto', fontSize: '11px', color: 'var(--hub-review)', fontWeight: 600 }}>Role unassigned</span>
          </div>
        </div>
        <div style={{ fontSize: '11px', color: 'var(--hub-slate)', marginTop: '8px' }}>
          Missing roles show as dashed outlines, never guessed.
        </div>
      </div>

      {/* Suggested Next Actions */}
      <div className="hub-card" style={{ marginTop: '12px' }}>
        <h4>
          <Icons.CheckSquare size={14} />
          Suggested next actions
        </h4>
        <ol style={{ margin: '8px 0 0', paddingLeft: '20px', fontSize: '12.5px', color: '#33435C', lineHeight: 1.6 }}>
          <li>Coordinate with Tom Reyes on revised scope delivery by 30 October.</li>
          <li>Request Priya Nair to identify the economic buyer for board sign-off.</li>
          <li>Schedule internal pre-brief session ahead of 6 November board meeting.</li>
        </ol>
      </div>

      {/* Open Opportunity */}
      <div className="hub-card" style={{ marginTop: '12px' }}>
        <h4>
          <Icons.Target size={14} />
          Open opportunity
        </h4>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '12.5px', marginTop: '6px' }}>
          <span style={{ fontWeight: 600 }}>Operations review, phase 2</span>
          <span className="hub-state hub-st-open">Proposal</span>
        </div>
        <div style={{ fontSize: '12px', color: 'var(--hub-slate)', marginTop: '6px' }}>
          Target close: November 2026 · Value: $94,000 AUD · Probability: 65%
        </div>
      </div>

      {/* Account Summary */}
      <div className="hub-card" style={{ marginTop: '12px' }}>
        <h4>
          <Icons.FileText size={14} />
          Account summary
          <span className="right-info" style={{ fontSize: '10.5px', color: 'var(--hub-slate)' }}>Citations cited</span>
        </h4>
        <p style={{ fontSize: '12.5px', color: '#33435C', margin: '6px 0 0', lineHeight: 1.5 }}>
          Northbridge Industrial is a Melbourne-based manufacturing organisation undergoing operations review and process modernisation across two Victorian facilities.
        </p>
        <div style={{ fontSize: '11.5px', color: 'var(--hub-slate)', marginTop: '8px' }}>
          Source: Diagnostic notes (28 Sep) and Operating model session (14 Oct).
        </div>
      </div>
    </>
  );

  if (isFull) {
    return (
      <div className="hub-intel-full">
        <div className="hub-intel-col">
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '14px' }}>
            <Icons.Sparkles size={18} color="var(--hub-gold2)" />
            <h3 style={{ fontFamily: 'Poppins, sans-serif', fontSize: '16px', fontWeight: 600, margin: 0, color: 'var(--hub-ink)' }}>
              Intelligence and Copilot
            </h3>
            <span className="hub-demo-badge" style={{ fontSize: '10px', padding: '1px 6px', marginLeft: 'auto' }}>
              Screen S25
            </span>
          </div>
          {copilotSection}
          {attentionSection}
        </div>
        <div className="hub-intel-col">
          {contextCards}
        </div>
      </div>
    );
  }

  return (
    <div className="hub-intel">
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', paddingBottom: '6px' }}>
        <Icons.Sparkles size={16} color="var(--hub-gold2)" />
        <h3 style={{ fontFamily: 'Poppins, sans-serif', fontSize: '14px', fontWeight: 600, margin: 0, color: 'var(--hub-ink)' }}>
          Intelligence and Copilot
        </h3>
        <span style={{ marginLeft: 'auto', fontSize: '10.5px', color: 'var(--hub-slate)', background: '#F1F4F9', padding: '2px 6px', borderRadius: '4px' }}>
          Screen S25
        </span>
        {onClose && (
          <button
            onClick={onClose}
            style={{ background: 'transparent', border: 0, color: 'var(--hub-slate)', cursor: 'pointer', padding: '2px 6px', display: 'flex', alignItems: 'center' }}
            aria-label="Close intelligence drawer"
          >
            <Icons.X size={16} />
          </button>
        )}
      </div>

      {copilotSection}
      {attentionSection}
      {contextCards}
    </div>
  );
};
