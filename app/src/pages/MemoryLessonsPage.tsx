import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../lib/auth/AuthContext';
import { useFeatureAccess } from '../lib/permissions/usePermissions';
import { KnowledgeClient } from '../lib/knowledge/knowledgeClient';
import { LessonLearned, KnowledgeClusterCategory, CLUSTER_CATEGORY_LABELS } from '../lib/knowledge/types';
import { PageHeader, ScopeBar, StatePanel, ProvenanceChip, ConfirmDialog } from '../components/intel/IntelKit';
import { filterLessons, countByCategory, validateLesson, describeLessonScope, formatDay, LessonErrors } from '../lib/intel/memoryView';
import '../styles/intel-bright.css';

/**
 * Memory > Lessons. One job: keep what the team learned, with the outcome as the person recorded it.
 * Uses the browser-side KnowledgeClient. No /api/knowledge/* route is called.
 * Not shown: invented "measured outcome" claims or graph clusters presented as fact.
 * Deletion is a soft delete that can be undone from this page straight after.
 */
export const MemoryLessonsPage: React.FC = () => {
  const { supabase } = useAuth();
  const access = useFeatureAccess('meeting_memory');
  const client = useMemo(() => new KnowledgeClient(supabase), [supabase]);

  const [lessons, setLessons] = useState<LessonLearned[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const [query, setQuery] = useState('');
  const [category, setCategory] = useState<KnowledgeClusterCategory | 'all'>('all');

  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState({ title: '', summary: '', outcome: '', category: 'operational_excellence' as KnowledgeClusterCategory });
  const [errors, setErrors] = useState<LessonErrors>({});
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const [toDelete, setToDelete] = useState<LessonLearned | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [undo, setUndo] = useState<LessonLearned | null>(null);

  const load = useCallback(async () => {
    if (!access.isAllowed) { setLoading(false); return; }
    setLoading(true);
    setError(null);
    try {
      setLessons(await client.fetchLessonsLearned());
    } catch (e: any) {
      setError(e?.message || 'The lessons could not be loaded.');
      setLessons([]);
    }
    setLoading(false);
  }, [client, access.isAllowed]);

  useEffect(() => { load(); }, [load]);

  const counts = useMemo(() => countByCategory(lessons), [lessons]);
  const shown = useMemo(() => filterLessons(lessons, { query, category }), [lessons, query, category]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const v = validateLesson(draft);
    setErrors(v);
    if (Object.keys(v).length) return;
    setSaving(true);
    setSaveError(null);
    try {
      const created = await client.createLessonLearned({
        title: draft.title.trim(), summary: draft.summary.trim(), outcome: draft.outcome.trim(), cluster_category: draft.category,
      });
      setLessons((p) => [created, ...p]);
      setAdding(false);
      setDraft({ title: '', summary: '', outcome: '', category: 'operational_excellence' });
      setNotice('Lesson saved.');
    } catch (err: any) {
      setSaveError(err?.message || 'The lesson could not be saved. Nothing was changed.');
    }
    setSaving(false);
  };

  const confirmDelete = async () => {
    if (!toDelete) return;
    setDeleting(true);
    try {
      await client.softDeleteLesson(toDelete.id);
      setLessons((p) => p.filter((l) => l.id !== toDelete.id));
      setUndo(toDelete);
      setNotice(null);
    } catch (err: any) {
      setNotice(`The lesson could not be removed. ${err?.message || ''}`.trim());
    }
    setDeleting(false);
    setToDelete(null);
  };

  const undoDelete = async () => {
    if (!undo) return;
    try {
      await client.restoreLesson(undo.id);
      setLessons((p) => [undo, ...p]);
      setNotice('Lesson restored.');
    } catch (err: any) {
      setNotice(`The lesson could not be restored. ${err?.message || ''}`.trim());
    }
    setUndo(null);
  };

  const header = (
    <PageHeader
      title="Lessons"
      purpose="What the team learned, and what happened as a result. Written by people, kept as written."
      crumbs={[{ label: 'Memory' }, { label: 'Lessons' }]}
      actions={access.isAllowed ? <button type="button" className="ib-btn ib-btn--primary" onClick={() => setAdding(true)}>Record a lesson</button> : undefined}
    />
  );

  if (!access.isAllowed) {
    return (
      <div className="ib">
        {header}
        <StatePanel kind="denied" title="Lessons are not part of your current plan"
          body="Prices are indicative until validated with real buyers."
          action={<Link className="ib-btn ib-btn--primary" to="/dashboard">Back to dashboard</Link>} />
      </div>
    );
  }

  return (
    <div className="ib">
      {header}

      {notice && <p className="ib-note" role="status">{notice}</p>}
      {undo && (
        <p className="ib-note" role="status">
          Removed "{undo.title}". <button type="button" className="ib-btn" onClick={undoDelete}>Undo</button>
        </p>
      )}

      <ScopeBar summary={loading ? 'waiting for the lessons to load' : error ? 'nothing yet, because the lessons did not load' : describeLessonScope({ shown: shown.length, total: lessons.length, category: category === 'all' ? 'all' : CLUSTER_CATEGORY_LABELS[category], query })}>
        <div className="ib-field ib-field--grow">
          <label className="ib-label" htmlFor="ml-search">Search</label>
          <input id="ml-search" className="ib-input" type="search" placeholder="Title, summary, outcome or tag" value={query} onChange={(e) => setQuery(e.target.value)} />
        </div>
        <div className="ib-field">
          <label className="ib-label" htmlFor="ml-cat">Theme</label>
          <select id="ml-cat" className="ib-select" value={category} onChange={(e) => setCategory(e.target.value as any)}>
            <option value="all">All themes ({lessons.length})</option>
            {Object.entries(CLUSTER_CATEGORY_LABELS).map(([k, label]) => (
              <option key={k} value={k}>{label} ({counts[k] || 0})</option>
            ))}
          </select>
        </div>
      </ScopeBar>

      {loading && <StatePanel kind="loading" title="Loading lessons" />}
      {!loading && error && <StatePanel kind="error" title="The lessons could not be loaded" body={error} action={<button type="button" className="ib-btn" onClick={load}>Try again</button>} />}
      {!loading && !error && lessons.length === 0 && (
        <StatePanel kind="empty" title="No lessons recorded yet" body="Record one after a project closes or a decision plays out." action={<button type="button" className="ib-btn ib-btn--primary" onClick={() => setAdding(true)}>Record a lesson</button>} />
      )}
      {!loading && !error && lessons.length > 0 && shown.length === 0 && (
        <StatePanel kind="empty" title="Nothing matches these filters" body="Clear the search or choose all themes."
          action={<button type="button" className="ib-btn" onClick={() => { setQuery(''); setCategory('all'); }}>Clear filters</button>} />
      )}

      {!loading && !error && shown.length > 0 && (
        <ul className="ib-list" aria-label="Lessons">
          {shown.map((l) => (
            <li key={l.id} className="ib-card">
              <div className="ib-card__meta">
                <ProvenanceChip kind="recorded" />
                <span>{CLUSTER_CATEGORY_LABELS[l.cluster_category] || l.cluster_category}</span>
                <span>{formatDay(l.created_at)}</span>
              </div>
              <h2 className="ib-card__title">{l.title}</h2>
              <p className="ib-card__body">{l.summary}</p>
              <div className="ib-why"><strong>Outcome, as recorded: </strong>{l.outcome}</div>
              <div className="ib-card__foot">
                <span>{l.tags && l.tags.length ? `Tags: ${l.tags.join(', ')}` : 'No tags'}</span>
                <button type="button" className="ib-btn" onClick={() => setToDelete(l)} aria-label={`Remove lesson: ${l.title}`}>Remove</button>
              </div>
            </li>
          ))}
        </ul>
      )}

      {adding && (
        <div className="ib-modal" role="presentation">
          <form className="ib-modal__panel ib-form" role="dialog" aria-modal="true" aria-labelledby="ml-form-title" onSubmit={submit} noValidate>
            <h2 id="ml-form-title" className="ib-modal__title">Record a lesson</h2>
            <div className="ib-field">
              <label className="ib-label" htmlFor="ml-title">Title</label>
              <input id="ml-title" className="ib-input" value={draft.title} aria-invalid={!!errors.title} aria-describedby={errors.title ? 'ml-title-err' : undefined} onChange={(e) => setDraft({ ...draft, title: e.target.value })} />
              {errors.title && <p id="ml-title-err" className="ib-note" role="alert">{errors.title}</p>}
            </div>
            <div className="ib-field">
              <label className="ib-label" htmlFor="ml-theme">Theme</label>
              <select id="ml-theme" className="ib-select" value={draft.category} onChange={(e) => setDraft({ ...draft, category: e.target.value as KnowledgeClusterCategory })}>
                {Object.entries(CLUSTER_CATEGORY_LABELS).map(([k, label]) => <option key={k} value={k}>{label}</option>)}
              </select>
            </div>
            <div className="ib-field">
              <label className="ib-label" htmlFor="ml-sum">What happened</label>
              <textarea id="ml-sum" className="ib-textarea" value={draft.summary} aria-invalid={!!errors.summary} onChange={(e) => setDraft({ ...draft, summary: e.target.value })} />
              {errors.summary && <p className="ib-note" role="alert">{errors.summary}</p>}
            </div>
            <div className="ib-field">
              <label className="ib-label" htmlFor="ml-out">Outcome</label>
              <textarea id="ml-out" className="ib-textarea" value={draft.outcome} aria-invalid={!!errors.outcome} onChange={(e) => setDraft({ ...draft, outcome: e.target.value })} />
              {errors.outcome && <p className="ib-note" role="alert">{errors.outcome}</p>}
            </div>
            {saveError && <p className="ib-note" role="alert">{saveError}</p>}
            <div className="ib-modal__actions">
              <button type="button" className="ib-btn" onClick={() => { setAdding(false); setErrors({}); setSaveError(null); }} disabled={saving}>Cancel</button>
              <button type="submit" className="ib-btn ib-btn--primary" disabled={saving}>{saving ? 'Saving' : 'Save lesson'}</button>
            </div>
          </form>
        </div>
      )}

      <ConfirmDialog
        open={!!toDelete}
        title="Remove this lesson?"
        body={toDelete ? `"${toDelete.title}" will be hidden. You can undo straight after, and it is kept for recovery.` : ''}
        confirmLabel="Remove lesson"
        busy={deleting}
        onConfirm={confirmDelete}
        onCancel={() => setToDelete(null)}
      />

      <p className="ib-note">This page shows saved lessons only. It does not score people or teams.</p>
    </div>
  );
};
