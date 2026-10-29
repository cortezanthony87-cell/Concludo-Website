import React, { useState } from 'react';
import { AlertTriangle, CheckCircle2, Copy, ExternalLink, Info, Lock, Printer, ShieldAlert } from 'lucide-react';
import { Link } from 'react-router-dom';
import type { AnswerItem, AnswerSection, CopilotMessage, CopilotNotice, CopilotResponse, SourceRecord, StatementBasis } from '../../lib/copilot/types';

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
const STATUS_COPY: Record<string, string> = {
  grounded: 'Answered from your records',
  partial: 'Answered with limits. See the notes below',
  none: 'Nothing recorded for this question',
  ambiguous: 'Needs your choice before reading any records',
  refused: 'Not answered. This is outside what Concludo does',
};

export function levelOf(score: number): 'low' | 'moderate' | 'high' {
  return score >= 70 ? 'high' : score >= 50 ? 'moderate' : 'low';
}

function NoticeIcon({ kind }: { kind: CopilotNotice['kind'] }) {
  if (kind === 'consent') return <Lock size={16} aria-hidden />;
  if (kind === 'injection') return <ShieldAlert size={16} aria-hidden />;
  if (kind === 'permission' || kind === 'error') return <AlertTriangle size={16} aria-hidden />;
  if (kind === 'scope' || kind === 'info') return <Info size={16} aria-hidden />;
  return <AlertTriangle size={16} aria-hidden />;
}

export function headline(r: CopilotResponse): string {
  const lede = r.sections?.find((s) => s.kind === 'summary')?.items?.[0]?.text;
  if (lede) return lede;
  const first = r.sections?.[0]?.items?.[0]?.text;
  return first || (r.answer || '').split('\n')[0] || 'Answer';
}

function plainText(r: CopilotResponse, sources: SourceRecord[]): string {
  const n = new Map(sources.map((s, i) => [s.id, i + 1]));
  const out: string[] = [];
  if (r.scope?.label) out.push(`Scope: ${r.scope.label}`);
  (r.notices || []).forEach((x) => out.push(`Note: ${x.text}`));
  (r.sections || []).forEach((s) => {
    out.push('', s.title);
    s.items.forEach((i) => out.push(`- [${BASIS_LABEL[i.basis]}] ${i.date ? i.date + ': ' : ''}${i.text}${(i.sourceIds || []).map((id) => (n.get(id) ? ` [${n.get(id)}]` : '')).join('')}`));
  });
  if (sources.length) {
    out.push('', 'Sources');
    sources.forEach((s, i) => out.push(`[${i + 1}] ${s.title}${s.recordDate ? `, ${s.recordDate}` : ''}`));
  }
  return out.join('\n');
}

interface Props {
  message: CopilotMessage;
  citeOpenId: string | null;
  onCite: (id: string | null) => void;
  onFollowUp: (q: string) => void;
  onChoose: (optionId: string) => void;
  isLatest: boolean;
}

export const CopilotResponseView: React.FC<Props> = ({ message, citeOpenId, onCite, onFollowUp, onChoose, isLatest }) => {
  const r = message.response as CopilotResponse;
  const sources: SourceRecord[] = r.sourceRecords || [];
  const numberOf = new Map(sources.map((s, i) => [s.id, i + 1]));
  const status = r.evidenceStatus || 'grounded';
  const draft = r.executionDraft;
  const score = r.confidenceScore ?? 0;
  const level = levelOf(score);
  const showStrength = status !== 'refused' && status !== 'ambiguous' && typeof r.confidenceScore === 'number';
  const [copied, setCopied] = useState(false);

  const allSections: AnswerSection[] = Array.isArray(r.sections) ? r.sections : [];
  const sections = r.clarification
    ? []
    : allSections.filter((sec) => !(draft && draft.preview && sec.items.length === draft.preview.length && sec.items.every((it, k) => it.text === draft.preview![k])));
  const ledeSections = sections.filter((s, i) => s.kind === 'summary' && i === 0);
  const bodySections = sections.filter((s) => !ledeSections.includes(s));
  const uid = message.id;
  const sid = (i: number) => `cp-${uid}-s${i}`;

  const copy = async () => {
    try { await navigator.clipboard.writeText(plainText(r, sources)); setCopied(true); setTimeout(() => setCopied(false), 1800); } catch { /* clipboard blocked: nothing to do */ }
  };

  const jump = (id: string) => document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });

  const chips = (it: AnswerItem) =>
    (it.sourceIds || []).map((id) => {
      const n = numberOf.get(id);
      const s = sources.find((x) => x.id === id);
      return n && s ? (
        <button key={id} type="button" className="cp-src" aria-label={`Source ${n}: ${s.title}`} onClick={() => { onCite(id); jump(`cp-${uid}-src-${id}`); }}>[{n}]</button>
      ) : null;
    });

  const row = (it: AnswerItem, k: number) => (
    <li key={k} className="cp-row" data-tone={it.tone || 'normal'}>
      <span className="cp-row-date">{it.date || ''}</span>
      <span className="cp-row-text">{it.text}</span>
      <span className="cp-row-side">
        <span className="cp-tag" data-basis={it.basis} title={BASIS_HELP[it.basis]}>{BASIS_LABEL[it.basis]}</span>
        {chips(it)}
      </span>
    </li>
  );

  return (
    <article className="cp-report" data-status={status} aria-label="Copilot answer">
      <header className="cp-rep-head">
        <div className="cp-rep-state">
          <span className="cp-pill">{STATUS_COPY[status] || 'Answer'}</span>
          {r.scope?.dataMode === 'sample' && <span className="cp-pill cp-pill-sample"><span className="dot" />Sample records</span>}
        </div>
        <div className="cp-rep-actions">
          <button type="button" className="cp-btn cp-btn-quiet" onClick={copy}><Copy size={14} aria-hidden /> {copied ? 'Copied' : 'Copy'}</button>
          <button type="button" className="cp-btn cp-btn-quiet" onClick={() => window.print()}><Printer size={14} aria-hidden /> Print or save as PDF</button>
        </div>
      </header>
      {r.scope?.label && <div className="cp-a-scope">Scope: {r.scope.label}</div>}

      <div className="cp-rep-grid">
        <div className="cp-rep-main">
          {r.notices && r.notices.length > 0 && (
            <div className="cp-notices" role="list">
              {r.notices.map((n, i) => (
                <div key={i} className="cp-notice" data-kind={n.kind} role="listitem"><NoticeIcon kind={n.kind} /><span>{n.text}</span></div>
              ))}
            </div>
          )}

          {ledeSections.map((s, i) => (
            <section key={i} className="cp-lede" id={sid(-1)}>
              {s.items.map((it, k) => (
                <p key={k} data-tone={it.tone || 'normal'}>
                  {it.text} <span className="cp-tag" data-basis={it.basis} title={BASIS_HELP[it.basis]}>{BASIS_LABEL[it.basis]}</span> {chips(it)}
                </p>
              ))}
            </section>
          ))}

          {r.clarification && (
            <section className="cp-sec">
              <h3>Which one do you mean?</h3>
              <p className="cp-lede-q">{r.clarification.question}</p>
              <div className="cp-choices">
                {r.clarification.options.map((o) => (
                  <button key={o.id} type="button" className="cp-choice" disabled={!isLatest} onClick={() => onChoose(o.id)}>
                    <strong>{o.label}</strong><span>{o.detail}</span>
                  </button>
                ))}
              </div>
            </section>
          )}

          {sections.length === 0 && !r.clarification && r.answer && <div className="cp-lede"><p style={{ whiteSpace: 'pre-wrap' }}>{r.answer}</p></div>}

          {bodySections.map((sec, si) => (
            <section key={si} className="cp-sec" id={sid(si)}>
              <h3><span>{sec.title}</span><em>{sec.items.length}</em></h3>
              <ul className="cp-rows">{sec.items.map(row)}</ul>
            </section>
          ))}

          {draft && (
            <section className="cp-approval" aria-label="Approval request">
              <header>
                <strong>{draft.title}</strong>
                {draft.status === 'pending_approval' && draft.approvalId
                  ? <span className="cp-state" data-state="queued"><CheckCircle2 size={14} aria-hidden /> Queued for approval</span>
                  : <span className="cp-state" data-state="not-queued"><AlertTriangle size={14} aria-hidden /> Not queued</span>}
              </header>
              {draft.preview && draft.preview.length > 0 && <ul>{draft.preview.map((p, i) => <li key={i}>{p}</li>)}</ul>}
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
            </section>
          )}

          {sources.length > 0 && (
            <section className="cp-sec" id={`cp-${uid}-sources`}>
              <h3><span>Sources</span><em>{sources.length}</em></h3>
              <ol className="cp-srcs">
                {sources.map((s, i) => (
                  <li key={s.id} id={`cp-${uid}-src-${s.id}`} className="cp-srcrow" data-hit={citeOpenId === s.id ? 'true' : 'false'}>
                    <span className="cp-src-num">[{i + 1}]</span>
                    <span className="cp-srcrow-main">
                      <span className="cp-src-type">{s.type.replace('_', ' ')}{s.recordDate ? ` | ${s.recordDate}` : ''}{s.status ? ` | ${s.status}` : ''}</span>
                      <strong>{s.title}</strong>
                      {s.snippet && <span className="cp-srcrow-snip">{s.snippet}</span>}
                    </span>
                    {s.href ? <Link className="cp-src" to={s.href} aria-label={`Open ${s.title}`}>Open <ExternalLink size={12} aria-hidden style={{ marginLeft: 4 }} /></Link> : <span />}
                  </li>
                ))}
              </ol>
            </section>
          )}

          {isLatest && (r.suggestedFollowUps || []).length > 0 && (
            <section className="cp-follow-wrap">
              <h3><span>Ask next</span></h3>
              <div className="cp-follow">{r.suggestedFollowUps.slice(0, 4).map((q, i) => <button key={i} type="button" className="cp-chip" onClick={() => onFollowUp(q)}>{q}</button>)}</div>
            </section>
          )}
        </div>

        <aside className="cp-rep-side" aria-label="On this answer">
          {(bodySections.length > 0 || sources.length > 0) && (
            <nav className="cp-toc" aria-label="Sections in this answer">
              <div className="cp-side-h">On this page</div>
              {ledeSections.length > 0 && <button type="button" onClick={() => jump(sid(-1))}>Summary</button>}
              {bodySections.map((s, i) => <button key={i} type="button" onClick={() => jump(sid(i))}><span>{s.title}</span><em>{s.items.length}</em></button>)}
              {sources.length > 0 && <button type="button" onClick={() => jump(`cp-${uid}-sources`)}><span>Sources</span><em>{sources.length}</em></button>}
            </nav>
          )}
          {showStrength && (
            <div className="cp-side-card">
              <div className="cp-side-h">Evidence strength</div>
              <div className="cp-strength-big"><strong>{score}</strong><span>of 100, {level}</span></div>
              <div className="cp-meter" data-level={level} role="meter" aria-valuemin={0} aria-valuemax={100} aria-valuenow={score} aria-label={`Evidence strength ${score} out of 100`}>
                <i style={{ width: `${Math.max(4, Math.min(100, score))}%` }} />
              </div>
              <p className="cp-side-note">How much recorded support the answer had. Not a chance of being right.</p>
              {r.strengthFactors && r.strengthFactors.length > 0 && (
                <ul className="cp-factors">{r.strengthFactors.map((f, i) => <li key={i}><span>{f.label}</span><b>{f.points > 0 ? '+' : ''}{f.points}</b></li>)}</ul>
              )}
            </div>
          )}
          <div className="cp-side-card">
            <div className="cp-side-h">What the labels mean</div>
            <ul className="cp-legend">
              {(Object.keys(BASIS_LABEL) as StatementBasis[]).map((k) => (
                <li key={k}><span className="cp-tag" data-basis={k}>{BASIS_LABEL[k]}</span><span>{BASIS_HELP[k]}</span></li>
              ))}
            </ul>
          </div>
        </aside>
      </div>
    </article>
  );
};
