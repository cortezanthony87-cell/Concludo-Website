import React from 'react';
import { AlertTriangle, CheckCircle2, ExternalLink, Info, ShieldAlert, Lock, Layers } from 'lucide-react';
import type { AnswerItem, CopilotMessage, CopilotNotice, CopilotResponse, SourceRecord, StatementBasis } from '../../lib/copilot/types';
import { Link } from 'react-router-dom';

export const BASIS_LABEL: Record<StatementBasis, string> = {
  recorded: 'Recorded',
  calculated: 'Calculated',
  inferred: 'Inferred',
  recommended: 'Suggested',
  modelled: 'Modelled',
};
const BASIS_HELP: Record<StatementBasis, string> = {
  recorded: 'Taken directly from a saved record.',
  calculated: 'Counted or compared from saved records.',
  inferred: 'A reasonable reading of records. Check the source.',
  recommended: 'A suggestion. Not a recorded fact.',
  modelled: 'A simulation or estimate. Not an observed result.',
};

function NoticeIcon({ kind }: { kind: CopilotNotice['kind'] }) {
  if (kind === 'consent') return <Lock size={16} aria-hidden />;
  if (kind === 'injection') return <ShieldAlert size={16} aria-hidden />;
  if (kind === 'permission' || kind === 'error') return <AlertTriangle size={16} aria-hidden />;
  if (kind === 'scope' || kind === 'info') return <Info size={16} aria-hidden />;
  return <AlertTriangle size={16} aria-hidden />;
}

export function levelOf(score: number): 'low' | 'moderate' | 'high' {
  return score >= 70 ? 'high' : score >= 50 ? 'moderate' : 'low';
}

const STATUS_COPY: Record<string, string> = {
  grounded: 'Answered from your records',
  partial: 'Answered with limits. See the notes below',
  none: 'Nothing recorded for this question',
  ambiguous: 'Needs your choice before reading any records',
  refused: 'Not answered. This is outside what Concludo does',
};

interface Props {
  message: CopilotMessage;
  citeOpenId: string | null;
  onCite: (id: string | null) => void;
  onFollowUp: (q: string) => void;
  onChoose: (optionId: string) => void;
  isLatest: boolean;
}

function SourceChip({ n, src, onClick }: { n: number; src: SourceRecord; onClick: () => void }) {
  return (
    <button type="button" className="cp-src" onClick={onClick} aria-label={`Source ${n}: ${src.title}`}>
      [{n}]
    </button>
  );
}

export const CopilotResponseView: React.FC<Props> = ({ message, citeOpenId, onCite, onFollowUp, onChoose, isLatest }) => {
  const r = message.response as CopilotResponse;
  const sources: SourceRecord[] = r.sourceRecords || [];
  const numberOf = new Map(sources.map((s, i) => [s.id, i + 1]));
  const status = r.evidenceStatus || 'grounded';
  const hasSections = Array.isArray(r.sections) && r.sections.length > 0;
  const score = r.confidenceScore ?? 0;
  const level = levelOf(score);
  const showStrength = status !== 'refused' && status !== 'ambiguous' && typeof r.confidenceScore === 'number';
  const draft = r.executionDraft;

  return (
    <article className="cp-a" data-status={status} aria-label="Copilot answer">
      <div className="cp-a-head">
        <span className="cp-pill">{STATUS_COPY[status] || 'Answer'}</span>
        <span className="grow" />
        {r.scope?.dataMode === 'sample' && <span className="cp-pill cp-pill-sample"><span className="dot" />Sample records</span>}
      </div>
      {r.scope && r.scope.label && <div className="cp-a-scope">Scope: {r.scope.label}</div>}

      {r.notices && r.notices.length > 0 && (
        <div className="cp-notices" role="list">
          {r.notices.map((n, i) => (
            <div key={i} className="cp-notice" data-kind={n.kind} role="listitem">
              <NoticeIcon kind={n.kind} />
              <span>{n.text}</span>
            </div>
          ))}
        </div>
      )}

      <div className="cp-a-body">
        {r.clarification && (
          <div className="cp-sec">
            <h3>Which one do you mean?</h3>
            <p style={{ margin: '0 0 10px' }}>{r.clarification.question}</p>
            <div className="cp-choices">
              {r.clarification.options.map((o) => (
                <button key={o.id} type="button" className="cp-choice" disabled={!isLatest} onClick={() => onChoose(o.id)}>
                  <strong>{o.label}</strong>
                  <span>{o.detail}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {hasSections && !r.clarification
          ? r.sections!.filter((sec) => !(draft && draft.preview && sec.items.length === draft.preview.length && sec.items.every((it, k) => it.text === draft.preview![k]))).map((sec, si) => (
              <section key={si} className="cp-sec">
                <h3>{sec.title}</h3>
                <ul className="cp-items">
                  {sec.items.map((it: AnswerItem, ii: number) => (
                    <li key={ii} className="cp-item" data-tone={it.tone || 'normal'}>
                      <span className="cp-tag" data-basis={it.basis} title={BASIS_HELP[it.basis]}>{BASIS_LABEL[it.basis]}</span>
                      <span className="cp-item-text">{it.text}</span>
                      {((it.sourceIds && it.sourceIds.length > 0) || it.date) && (
                        <span className="cp-item-meta">
                          {it.date && <span>{it.date}</span>}
                          {(it.sourceIds || []).map((sid) => {
                            const n = numberOf.get(sid);
                            const s = sources.find((x) => x.id === sid);
                            return n && s ? <SourceChip key={sid} n={n} src={s} onClick={() => onCite(citeOpenId === sid ? null : sid)} /> : null;
                          })}
                        </span>
                      )}
                    </li>
                  ))}
                </ul>
              </section>
            ))
          : !hasSections && r.answer && !r.clarification && (
              <div className="cp-sec" style={{ whiteSpace: 'pre-wrap' }}>{r.answer}</div>
            )}

        {draft && (
          <div className="cp-approval" aria-label="Approval request">
            <header>
              <strong>{draft.title}</strong>
              {draft.status === 'pending_approval' && draft.approvalId ? (
                <span className="cp-state" data-state="queued"><CheckCircle2 size={14} aria-hidden /> Queued for approval</span>
              ) : (
                <span className="cp-state" data-state="not-queued"><AlertTriangle size={14} aria-hidden /> Not queued</span>
              )}
            </header>
            {draft.preview && draft.preview.length > 0 && (
              <ul>{draft.preview.map((p, i) => <li key={i}>{p}</li>)}</ul>
            )}
            <footer>
              {draft.status === 'pending_approval' && draft.approvalId ? (
                <>
                  <Link className="cp-btn cp-btn-primary" to={`/approvals/${draft.approvalId}`}>Open in Approvals</Link>
                  <span className="cp-hint">Nothing has been sent or run. A person must approve it.</span>
                </>
              ) : (
                <span className="cp-hint">{draft.persistError ? `Not saved: ${draft.persistError}. ` : ''}Nothing has been sent or run. Ask again to retry.</span>
              )}
            </footer>
          </div>
        )}
      </div>

      {(showStrength || sources.length > 0 || (r.suggestedFollowUps || []).length > 0) && (
        <div className="cp-foot">
          {showStrength && (
            <div className="cp-strength">
              <strong>Evidence strength</strong>
              <div className="cp-meter" data-level={level} role="meter" aria-valuemin={0} aria-valuemax={100} aria-valuenow={score} aria-label={`Evidence strength ${score} out of 100`}>
                <i style={{ width: `${Math.max(4, Math.min(100, score))}%` }} />
              </div>
              <span>{score} of 100, {level}</span>
            </div>
          )}
          <details className="cp-disc" open={!!citeOpenId || undefined}>
            <summary><Layers size={15} aria-hidden /> How this was built{sources.length ? ` and ${sources.length} ${sources.length === 1 ? 'source' : 'sources'}` : ''}</summary>
            <div className="cp-disc-body">
              <p style={{ margin: 0 }}>
                Evidence strength shows how much recorded support the answer had. It is not a chance of being right. It is built from these named factors:
              </p>
              {r.strengthFactors && r.strengthFactors.length > 0 && (
                <ul style={{ margin: 0, paddingLeft: 18 }}>
                  {r.strengthFactors.map((f, i) => <li key={i}>{f.label}: {f.points > 0 ? '+' : ''}{f.points}</li>)}
                </ul>
              )}
              {r.reasoningPath && r.reasoningPath.length > 0 && (
                <ol style={{ margin: 0, paddingLeft: 18 }}>{r.reasoningPath.map((s, i) => <li key={i}>{s}</li>)}</ol>
              )}
              {sources.length > 0 && (
                <div className="cp-src-list">
                  {sources.map((s, i) => (
                    <div key={s.id} className="cp-src-row" style={citeOpenId === s.id ? { borderColor: 'var(--cp-blue)', boxShadow: 'var(--cp-glow)' } : undefined}>
                      <span className="cp-src-num">[{i + 1}]</span>
                      <div>
                        <div className="cp-src-type">{s.type.replace('_', ' ')}{s.recordDate ? ` | ${s.recordDate}` : ''}{s.status ? ` | ${s.status}` : ''}</div>
                        <div style={{ fontWeight: 600 }}>{s.title}</div>
                        {s.snippet && <div style={{ color: 'var(--cp-muted)' }}>{s.snippet}</div>}
                      </div>
                      {s.href ? <Link className="cp-src" to={s.href} aria-label={`Open ${s.title}`}>Open <ExternalLink size={12} aria-hidden style={{ marginLeft: 4 }} /></Link> : <span />}
                    </div>
                  ))}
                </div>
              )}
              <div className="cp-hint">Labels: {Object.entries(BASIS_LABEL).map(([k, v]) => `${v} (${BASIS_HELP[k as StatementBasis].toLowerCase()})`).join(' ')}</div>
            </div>
          </details>
          {isLatest && (r.suggestedFollowUps || []).length > 0 && (
            <div className="cp-follow" aria-label="Suggested follow-up questions">
              {r.suggestedFollowUps.slice(0, 4).map((q, i) => (
                <button key={i} type="button" className="cp-chip" onClick={() => onFollowUp(q)}>{q}</button>
              ))}
            </div>
          )}
        </div>
      )}
    </article>
  );
};
