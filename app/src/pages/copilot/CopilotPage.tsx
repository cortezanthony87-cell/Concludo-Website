import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Bookmark, BookmarkPlus, Edit2, Menu, Plus, RotateCw, Search, Send, Sparkles, Trash2 } from 'lucide-react';
import { useAuth } from '../../lib/auth/AuthContext';
import {
  AssistantType,
  CopilotConversation,
  CopilotMessage,
  CopilotPrompt,
  CopilotResponse,
  CopilotScopeSelection,
  PromptCategory,
  PromptScope,
} from '../../lib/copilot/types';
import { CopilotClient } from '../../lib/copilot/copilotClient';
import type { CopilotStage, ScopeOptions } from '../../lib/copilot/copilotEngine';
import { addDays, melbourneToday, formatAuDate } from '../../lib/copilot/dates';
import { CopilotResponseView, headline as headlineOf } from './CopilotResponseView';
import '../../styles/copilot-bright.css';

const ASSISTANTS: Array<{ id: AssistantType; label: string }> = [
  { id: 'copilot', label: 'All' },
  { id: 'decision_assistant', label: 'Decisions' },
  { id: 'project_assistant', label: 'Projects' },
  { id: 'action_assistant', label: 'Actions' },
  { id: 'risk_assistant', label: 'Risks' },
  { id: 'executive_assistant', label: 'Executive' },
  { id: 'knowledge_assistant', label: 'Knowledge' },
];

const STARTERS = [
  { k: 'Project history', t: 'Show me everything recorded for this project', d: 'Meetings, decisions, actions and risks, in date order.', q: 'Summarise the history of this project: meetings, decisions, actions and risks.' },
  { k: 'Owed to a client', t: 'What do we owe this client?', d: 'Open actions committed to the client, with due dates.', q: 'What actions are we still owed to deliver to this client?' },
  { k: 'A period', t: 'What happened in a period?', d: 'Set the period above, then ask.', q: 'What was decided and what is still open in this period?' },
  { k: 'Workflow health', t: 'Anything waiting on me?', d: 'Pending approvals, failed runs and open incidents.', q: 'What approvals are pending and which workflow runs failed recently?' },
];

const STAGES: Array<{ id: CopilotStage; label: string }> = [
  { id: 'understanding', label: 'Understanding the question' },
  { id: 'reading', label: 'Reading your records' },
  { id: 'checking', label: 'Checking scope, dates and consent' },
  { id: 'writing', label: 'Writing the answer with sources' },
];

type PeriodPreset = 'any' | '30' | 'quarter' | 'custom';

function quarterRange(today: string): { from: string; to: string } {
  const [y, m] = today.split('-').map(Number);
  const q = Math.floor((m - 1) / 3);
  const from = `${y}-${String(q * 3 + 1).padStart(2, '0')}-01`;
  const endM = q * 3 + 3;
  const to = `${y}-${String(endM).padStart(2, '0')}-${endM === 6 || endM === 9 ? '30' : '31'}`;
  return { from, to };
}

export const CopilotPage: React.FC = () => {
  const { user, profile, supabase } = useAuth() as any;

  const [client, setClient] = useState<CopilotClient | null>(null);
  const [conversations, setConversations] = useState<CopilotConversation[]>([]);
  const [active, setActive] = useState<CopilotConversation | null>(null);
  const [messages, setMessages] = useState<CopilotMessage[]>([]);
  const [prompts, setPrompts] = useState<CopilotPrompt[]>([]);
  const [assistant, setAssistant] = useState<AssistantType>('copilot');
  const [input, setInput] = useState('');
  const [convSearch, setConvSearch] = useState('');
  const [railOpen, setRailOpen] = useState(false);

  const [loadingConvs, setLoadingConvs] = useState(true);
  const [loadingMsgs, setLoadingMsgs] = useState(false);
  const [stage, setStage] = useState<CopilotStage | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [lastQuery, setLastQuery] = useState<string | null>(null);

  const [scopeOpts, setScopeOpts] = useState<ScopeOptions | null>(null);
  const [scopeError, setScopeError] = useState<string | null>(null);
  const [projectKey, setProjectKey] = useState('');
  const [clientKey, setClientKey] = useState('');
  const [docs, setDocs] = useState<Array<{ id: string; name: string; version: number | string | null }>>([]);
  const [docId, setDocId] = useState('');
  const [preset, setPreset] = useState<PeriodPreset>('any');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');

  const [scopeOpen, setScopeOpen] = useState(false);
  const [focus, setFocus] = useState(false);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [citeOpen, setCiteOpen] = useState<string | null>(null);
  const [saveOpen, setSaveOpen] = useState(false);
  const [pTitle, setPTitle] = useState('');
  const [pText, setPText] = useState('');
  const [pCat, setPCat] = useState<PromptCategory>('general');
  const [pScope, setPScope] = useState<PromptScope>('personal');
  const [renaming, setRenaming] = useState<string | null>(null);
  const [renameTitle, setRenameTitle] = useState('');
  const [deleting, setDeleting] = useState<CopilotConversation | null>(null);

  const endRef = useRef<HTMLDivElement>(null);
  const today = useMemo(() => melbourneToday(), []);
  const dataMode: 'live' | 'sample' = (typeof window !== 'undefined' && (window as any).__CONCLUDO_COPILOT_SAMPLE__) ? 'sample' : 'live';

  useEffect(() => {
    if (!user || !supabase) return;
    setClient(new CopilotClient({ supabase, userId: user.id, organizationId: profile?.organization_id || null, teamId: profile?.team_id || null }));
  }, [user, profile, supabase]);

  const loadConversations = useCallback(async (c: CopilotClient) => {
    try {
      setLoadingConvs(true);
      const data = await c.listConversations();
      setConversations(data);
    } catch (e: any) {
      setError(e?.message || 'Could not load conversations.');
    } finally {
      setLoadingConvs(false);
    }
  }, []);

  useEffect(() => {
    if (!client) return;
    loadConversations(client);
    client.listPrompts().then(setPrompts).catch(() => undefined);
    client.listScopeOptions().then(setScopeOpts).catch((e: any) => setScopeError(e?.message || 'Could not load projects and clients.'));
  }, [client, loadConversations]);

  useEffect(() => {
    // Show the start of the newest answer, not its end, so the reader begins at the top.
    if (stage) { endRef.current?.scrollIntoView({ block: 'end' }); return; }
    const answers = document.querySelectorAll('.cp-thread .cp-report');
    const last = answers[answers.length - 1] as HTMLElement | undefined;
    if (last) last.scrollIntoView({ block: 'start' });
  }, [messages, stage]);

  // documents follow the chosen project
  useEffect(() => {
    setDocId('');
    setDocs([]);
    if (!client || !projectKey) return;
    client.listDocuments(projectKey).then((d: any[]) => setDocs(d.map((x) => ({ id: x.id, name: x.name, version: x.version })))).catch(() => setDocs([]));
  }, [client, projectKey]);

  const period = useMemo(() => {
    if (preset === 'any') return null;
    if (preset === '30') return { from: addDays(today, -29), to: today };
    if (preset === 'quarter') return quarterRange(today);
    if (from && to && from <= to) return { from, to };
    return null;
  }, [preset, from, to, today]);

  const selection = useCallback((overrides?: Partial<CopilotScopeSelection>): CopilotScopeSelection => {
    const s: CopilotScopeSelection = {};
    if (projectKey) s.projectKey = projectKey;
    else if (clientKey) s.client = clientKey;
    if (docId) s.documentId = docId;
    if (period) s.period = period;
    return { ...s, ...overrides };
  }, [projectKey, clientKey, docId, period]);

  const selectConversation = async (c: CopilotConversation) => {
    if (!client) return;
    try {
      setActive(c); setLoadingMsgs(true); setError(null); setRailOpen(false);
      setMessages(await client.getMessages(c.id));
    } catch (e: any) {
      setError(e?.message || 'Could not load this conversation.');
    } finally {
      setLoadingMsgs(false);
    }
  };

  const newConversation = () => { setActive(null); setMessages([]); setError(null); setRailOpen(false); };

  const send = async (text?: string, scopeOverride?: CopilotScopeSelection) => {
    const q = (text ?? input).trim();
    if (!q || !client || stage) return;
    setInput(''); setError(null); setLastQuery(q); setStage('understanding');
    try {
      const res = await client.ask({
        query: q,
        conversationId: active?.id || null,
        assistantType: assistant !== 'copilot' ? assistant : undefined,
        scope: scopeOverride || selection(),
        requestedBy: profile?.full_name || user?.email || 'Copilot user',
        onProgress: (s) => setStage(s),
        dataMode,
      });
      if (!active) { setActive(res.conversation); setConversations((p) => [res.conversation, ...p]); }
      setMessages((p) => [...p, res.userMessage, res.assistantMessage]);
      setLastQuery(null);
    } catch (e: any) {
      setError(e?.message || 'Copilot could not answer. Nothing was changed.');
    } finally {
      setStage(null);
    }
  };

  const choose = (optionId: string) => {
    // the last user question is asked again with the chosen name as an explicit scope
    const lastUser = [...messages].reverse().find((m) => m.role === 'user');
    const [kind, ...rest] = optionId.split(':');
    const key = rest.join(':');
    if (kind === 'project') { setProjectKey(key); setClientKey(''); } else { setClientKey(key); setProjectKey(''); }
    if (lastUser) send(lastUser.message, { ...selection({}), ...(kind === 'project' ? { projectKey: key, client: undefined } : { client: key, projectKey: undefined }) });
  };

  const del = async () => {
    if (!client || !deleting) return;
    try {
      await client.deleteConversation(deleting.id);
      setConversations((p) => p.filter((c) => c.id !== deleting.id));
      if (active?.id === deleting.id) newConversation();
    } catch (e: any) { setError(e?.message || 'Could not delete the conversation.'); }
    setDeleting(null);
  };

  const rename = async (id: string) => {
    if (!client || !renameTitle.trim()) return;
    try {
      const u = await client.renameConversation(id, renameTitle.trim());
      setConversations((p) => p.map((c) => (c.id === id ? u : c)));
      if (active?.id === id) setActive(u);
      setRenaming(null); setRenameTitle('');
    } catch (e: any) { setError(e?.message || 'Could not rename.'); }
  };

  const savePrompt = async () => {
    if (!client || !pTitle.trim() || !pText.trim()) return;
    try {
      const np = await client.savePrompt(pTitle.trim(), pText.trim(), pCat, pScope);
      setPrompts((p) => [np, ...p]);
      setSaveOpen(false); setPTitle(''); setPText('');
    } catch (e: any) { setError(e?.message || 'Could not save the prompt.'); }
  };

  const delPrompt = async (id: string) => {
    if (!client) return;
    try { await client.deletePrompt(id); setPrompts((p) => p.filter((x) => x.id !== id)); }
    catch (e: any) { setError(e?.message || 'Could not delete the prompt.'); }
  };

  const filtered = conversations.filter((c) => c.title.toLowerCase().includes(convSearch.toLowerCase()));
  const lastAssistantIdx = (() => { for (let i = messages.length - 1; i >= 0; i--) if (messages[i].role === 'assistant') return i; return -1; })();
  const stageIdx = stage ? STAGES.findIndex((s) => s.id === stage) : -1;
  const asOfLabel = formatAuDate(today);

  const scopeText = (() => {
    const bits: string[] = [];
    const p = scopeOpts?.projects.find((x) => x.key === projectKey);
    const c = scopeOpts?.clients.find((x) => x.key === clientKey);
    if (p) bits.push(`Project: ${p.name}`);
    if (c) bits.push(`Client: ${c.name}`);
    if (docId) bits.push(`Document: ${docs.find((d) => d.id === docId)?.name || 'selected'}`);
    if (period) bits.push(`Period: ${formatAuDate(period.from)} to ${formatAuDate(period.to)}, inclusive`);
    return bits.length ? bits.join('  |  ') : 'Whole workspace you can access. Choose a project, client, document or period to narrow it.';
  })();

  return (
    <div className="cp" data-rail={railOpen ? 'open' : 'closed'} data-focus={focus ? 'true' : 'false'}>
      {/* ------------------------------ rail */}
      <aside className="cp-rail" aria-label="Conversations and saved prompts">
        <div className="cp-rail-top">
          <div className="cp-brand">
            <div className="cp-mark" aria-hidden><Sparkles size={18} /></div>
            <div><h1>Copilot</h1><small>Answers from your records</small></div>
          </div>
          <button type="button" className="cp-btn cp-btn-primary" onClick={newConversation}><Plus size={16} aria-hidden /> New conversation</button>
          <div style={{ position: 'relative' }}>
            <label className="cp-sr" htmlFor="cp-conv-search">Search conversations</label>
            <Search size={15} aria-hidden style={{ position: 'absolute', left: 12, top: 15, color: 'var(--cp-muted)' }} />
            <input id="cp-conv-search" className="cp-input" style={{ paddingLeft: 34 }} placeholder="Search conversations" value={convSearch} onChange={(e) => setConvSearch(e.target.value)} />
          </div>
        </div>
        <div className="cp-rail-scroll">
          <div className="cp-rail-label">Recent</div>
          {loadingConvs ? (
            <div className="cp-empty-note" role="status"><RotateCw size={14} aria-hidden /> Loading conversations</div>
          ) : filtered.length === 0 ? (
            <div className="cp-empty-note">{convSearch ? 'No conversation matches that search.' : 'No conversations yet. Ask your first question.'}</div>
          ) : filtered.map((c) => (
            <div key={c.id}>
              {renaming === c.id ? (
                <div style={{ display: 'flex', gap: 6, padding: 4 }}>
                  <input className="cp-input" aria-label="New conversation title" autoFocus value={renameTitle} onChange={(e) => setRenameTitle(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') rename(c.id); if (e.key === 'Escape') setRenaming(null); }} />
                  <button type="button" className="cp-btn" onClick={() => rename(c.id)}>Save</button>
                </div>
              ) : (
                <div className="cp-conv" role="button" tabIndex={0} aria-current={active?.id === c.id} onClick={() => selectConversation(c)} onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); selectConversation(c); } }}>
                  <span className="cp-conv-title">{c.title}</span>
                  <span className="cp-conv-actions">
                    <button type="button" className="cp-icon-btn" aria-label={`Rename ${c.title}`} onClick={(e) => { e.stopPropagation(); setRenaming(c.id); setRenameTitle(c.title); }}><Edit2 size={14} aria-hidden /></button>
                    <button type="button" className="cp-icon-btn" aria-label={`Delete ${c.title}`} onClick={(e) => { e.stopPropagation(); setDeleting(c); }}><Trash2 size={14} aria-hidden /></button>
                  </span>
                </div>
              )}
            </div>
          ))}

          <div className="cp-rail-label" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span>Saved prompts</span>
            <button type="button" className="cp-icon-btn" aria-label="Save a prompt" onClick={() => { setPText(input); setSaveOpen(true); }}><BookmarkPlus size={16} aria-hidden /></button>
          </div>
          {prompts.length === 0 ? <div className="cp-empty-note">No saved prompts yet.</div> : prompts.map((p) => (
            <div key={p.id} className="cp-conv" role="button" tabIndex={0} onClick={() => { setInput(p.prompt_text); setRailOpen(false); }} onKeyDown={(e) => { if (e.key === 'Enter') setInput(p.prompt_text); }}>
              <Bookmark size={14} aria-hidden style={{ color: 'var(--cp-cyan-ink)' }} />
              <span className="cp-conv-title">{p.title}</span>
              <button type="button" className="cp-icon-btn" aria-label={`Delete saved prompt ${p.title}`} onClick={(e) => { e.stopPropagation(); delPrompt(p.id); }}><Trash2 size={14} aria-hidden /></button>
            </div>
          ))}
        </div>
      </aside>

      {/* ------------------------------ main */}
      <main className="cp-main">
        <header className="cp-head">
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <button type="button" className="cp-icon-btn cp-rail-toggle" aria-label="Open conversations" aria-expanded={railOpen} onClick={() => setRailOpen((v) => !v)}><Menu size={20} aria-hidden /></button>
            <h2>{active?.title || 'New conversation'}</h2>
          </div>
          <div className="cp-head-meta">
            {dataMode === 'sample'
              ? <span className="cp-pill cp-pill-sample"><span className="dot" />Sample records (preview)</span>
              : <span className="cp-pill cp-pill-live"><span className="dot" />Your live records</span>}
            <span className="cp-pill">As at {asOfLabel}</span>
            <button type="button" className="cp-btn cp-btn-quiet cp-focus-btn" aria-pressed={focus} onClick={() => setFocus((v) => !v)}>{focus ? 'Show conversations' : 'Wide view'}</button>
          </div>
        </header>

        <section className="cp-scope" aria-label="Scope of the question" data-open={scopeOpen ? 'true' : 'false'}>
          <div className="cp-scope-now" aria-live="polite">
            <strong>Reading:</strong> <span className="cp-scope-text">{scopeText}</span>
            <button type="button" className="cp-btn cp-btn-quiet cp-scope-toggle" aria-expanded={scopeOpen} aria-controls="cp-scope-fields" onClick={() => setScopeOpen((v) => !v)}>
              {scopeOpen ? 'Hide scope' : 'Change scope'}
            </button>
          </div>
          <div className="cp-scope-row" id="cp-scope-fields">
            <div className="cp-field">
              <label htmlFor="cp-project">Project or meeting series</label>
              <select id="cp-project" value={projectKey} onChange={(e) => { setProjectKey(e.target.value); if (e.target.value) setClientKey(''); }} disabled={!scopeOpts}>
                <option value="">Any project</option>
                {scopeOpts?.projects.map((p) => <option key={p.key} value={p.key}>{p.name}{p.client ? ` (${p.client})` : ''}, {p.meetings} {p.meetings === 1 ? 'meeting' : 'meetings'}</option>)}
              </select>
            </div>
            <div className="cp-field">
              <label htmlFor="cp-client">Client</label>
              <select id="cp-client" value={clientKey} onChange={(e) => { setClientKey(e.target.value); if (e.target.value) setProjectKey(''); }} disabled={!scopeOpts || !!projectKey}>
                <option value="">Any client</option>
                {scopeOpts?.clients.map((c) => <option key={c.key} value={c.key}>{c.name}, {c.meetings} {c.meetings === 1 ? 'meeting' : 'meetings'}</option>)}
              </select>
            </div>
            <div className="cp-field">
              <label htmlFor="cp-doc">Document</label>
              <select id="cp-doc" value={docId} onChange={(e) => setDocId(e.target.value)} disabled={!projectKey || docs.length === 0}>
                <option value="">{projectKey ? (docs.length ? 'No document' : 'No documents in this project') : 'Choose a project first'}</option>
                {docs.map((d) => <option key={d.id} value={d.id}>{d.name}{d.version ? ` (version ${d.version})` : ''}</option>)}
              </select>
            </div>
            <div className="cp-field">
              <label htmlFor="cp-period">Period</label>
              <select id="cp-period" value={preset} onChange={(e) => setPreset(e.target.value as PeriodPreset)}>
                <option value="any">Any time</option>
                <option value="30">Last 30 days</option>
                <option value="quarter">This quarter</option>
                <option value="custom">Choose dates</option>
              </select>
            </div>
            {preset === 'custom' && (
              <>
                <div className="cp-field" style={{ minWidth: 150 }}><label htmlFor="cp-from">From</label><input id="cp-from" type="date" value={from} onChange={(e) => setFrom(e.target.value)} /></div>
                <div className="cp-field" style={{ minWidth: 150 }}><label htmlFor="cp-to">To</label><input id="cp-to" type="date" value={to} onChange={(e) => setTo(e.target.value)} /></div>
              </>
            )}
          </div>
          {scopeError && <div className="cp-notice" data-kind="error" role="alert">{scopeError} You can still ask, and Copilot will read the whole workspace you can access.</div>}
          {scopeOpts?.truncated && <div className="cp-scope-note">Only the most recent projects are listed here. Type a name in your question to reach older ones.</div>}
        </section>

        <div className="cp-thread" aria-live="polite" aria-busy={!!stage}>
          <div className="cp-thread-inner">
            {loadingMsgs ? (
              <div className="cp-activity" role="status">Loading this conversation</div>
            ) : messages.length === 0 && !stage ? (
              <div className="cp-welcome">
                <div className="cp-hero">
                  <h2>Ask about your own records</h2>
                  <p>Copilot reads your saved meetings, decisions, actions, risks and workflow records. Every statement says how it was reached and where it came from. If nothing is recorded, it says so.</p>
                </div>
                <div className="cp-cards">
                  {STARTERS.map((s) => (
                    <button key={s.k} type="button" className="cp-card" onClick={() => setInput(s.q)}>
                      <span className="cp-card-k">{s.k}</span><strong>{s.t}</strong><span>{s.d}</span>
                    </button>
                  ))}
                </div>
              </div>
            ) : messages.map((m, i) => {
              if (m.role === 'user') return <div key={m.id} className="cp-q"><span>You asked</span>{m.message}</div>;
              const latest = i === lastAssistantIdx;
              if (!latest && !expanded[m.id]) {
                const rr = m.response as CopilotResponse;
                return (
                  <div key={m.id} className="cp-prev">
                    <span className="cp-prev-text">{headlineOf(rr)}</span>
                    <button type="button" className="cp-btn cp-btn-quiet" onClick={() => setExpanded((e) => ({ ...e, [m.id]: true }))}>Show full answer</button>
                  </div>
                );
              }
              return <CopilotResponseView key={m.id} message={m} citeOpenId={citeOpen} onCite={setCiteOpen} onFollowUp={(q) => send(q)} onChoose={choose} isLatest={latest} />;
            })}

            {stage && (
              <div className="cp-activity" role="status" aria-label="Copilot is working">
                <strong>Working on it</strong>
                <ol className="cp-steps">
                  {STAGES.map((s, i) => (
                    <li key={s.id} className="cp-step" data-state={i < stageIdx ? 'done' : i === stageIdx ? 'active' : 'todo'}>
                      <i aria-hidden /><span>{s.label}</span>
                    </li>
                  ))}
                </ol>
              </div>
            )}

            {error && (
              <div className="cp-error" role="alert">
                <span>{error}</span>
                {lastQuery && <button type="button" className="cp-btn" onClick={() => send(lastQuery)}><RotateCw size={14} aria-hidden /> Try again</button>}
              </div>
            )}
            <div ref={endRef} />
          </div>
        </div>

        <footer className="cp-composer">
          <div className="cp-composer-inner">
            <div className="cp-assist" role="group" aria-label="Focus">
              {ASSISTANTS.map((a) => (
                <button key={a.id} type="button" aria-pressed={assistant === a.id} onClick={() => setAssistant(a.id)}>{a.label}</button>
              ))}
            </div>
            <div className="cp-compose-row">
              <label className="cp-sr" htmlFor="cp-input">Ask Copilot</label>
              <textarea id="cp-input" rows={2} placeholder="Ask about a project, client or period" value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); } }} />
              <button type="button" className="cp-btn cp-btn-primary" onClick={() => send()} disabled={!input.trim() || !!stage} aria-label="Send question"><Send size={16} aria-hidden /> Ask</button>
            </div>
            <div className="cp-hint">Enter to send, Shift and Enter for a new line. Copilot proposes. A person approves. It never sends or runs anything itself.</div>
          </div>
        </footer>
      </main>

      {deleting && (
        <div className="cp-modal-wrap" role="dialog" aria-modal="true" aria-labelledby="cp-del-t">
          <div className="cp-modal">
            <h2 id="cp-del-t">Delete this conversation?</h2>
            <p style={{ margin: 0 }}>"{deleting.title}" will be removed from your list. It is kept for 30 days under the retention policy.</p>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button type="button" className="cp-btn" autoFocus onClick={() => setDeleting(null)}>Keep it</button>
              <button type="button" className="cp-btn cp-btn-primary" onClick={del}>Delete</button>
            </div>
          </div>
        </div>
      )}

      {saveOpen && (
        <div className="cp-modal-wrap" role="dialog" aria-modal="true" aria-labelledby="cp-save-t">
          <div className="cp-modal">
            <h2 id="cp-save-t">Save a prompt</h2>
            <div className="cp-field" style={{ maxWidth: 'none' }}><label htmlFor="cp-pt">Title</label><input id="cp-pt" value={pTitle} onChange={(e) => setPTitle(e.target.value)} /></div>
            <div className="cp-field" style={{ maxWidth: 'none' }}><label htmlFor="cp-px">Prompt</label><textarea id="cp-px" rows={3} value={pText} onChange={(e) => setPText(e.target.value)} style={{ borderRadius: 12, border: '1px solid var(--cp-line-strong)', padding: 10 }} /></div>
            <div style={{ display: 'flex', gap: 10 }}>
              <div className="cp-field" style={{ maxWidth: 'none' }}><label htmlFor="cp-pc">Category</label>
                <select id="cp-pc" value={pCat} onChange={(e) => setPCat(e.target.value as PromptCategory)}>
                  {['general', 'decisions', 'projects', 'actions', 'risks', 'executive', 'reports'].map((c) => <option key={c} value={c}>{c}</option>)}
                </select></div>
              <div className="cp-field" style={{ maxWidth: 'none' }}><label htmlFor="cp-ps">Who can use it</label>
                <select id="cp-ps" value={pScope} onChange={(e) => setPScope(e.target.value as PromptScope)}>
                  {['personal', 'team', 'organization'].map((c) => <option key={c} value={c}>{c}</option>)}
                </select></div>
            </div>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button type="button" className="cp-btn" onClick={() => setSaveOpen(false)}>Cancel</button>
              <button type="button" className="cp-btn cp-btn-primary" onClick={savePrompt} disabled={!pTitle.trim() || !pText.trim()}>Save prompt</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default CopilotPage;
