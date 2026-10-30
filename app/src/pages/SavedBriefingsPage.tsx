import React, { useEffect, useState } from 'react';
import { PageHeader, StatePanel } from '../components/intel/IntelKit';
import { SavedBriefing, EARLIER_VERSION_LABEL, sortNewestFirst } from '../lib/intel/savedBriefings';
import '../styles/intel-bright.css';

/**
 * Briefings > Saved. Read-only archive of briefings the earlier version saved.
 * Each one carries the label that it came from fixed templates. Nothing is deleted or edited here.
 * `loader` is passed in by the route (fetchExecutiveBriefings with the signed-in scope).
 */
export const SavedBriefingsPage: React.FC<{ loader: () => Promise<SavedBriefing[]> }> = ({ loader }) => {
  const [rows, setRows] = useState<SavedBriefing[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState<string | null>(null);

  useEffect(() => {
    let live = true;
    loader().then((r) => live && setRows(sortNewestFirst(r))).catch(() => live && setError('Saved briefings could not be loaded. Try again shortly.'));
    return () => { live = false; };
  }, [loader]);

  return (
    <div>
      <PageHeader title="Saved briefings" purpose="Briefings saved earlier, kept for reference." />
      <p className="ib-note">{EARLIER_VERSION_LABEL}</p>
      {error && <StatePanel kind="error" title="Could not load" body={error} />}
      {!error && rows === null && <StatePanel kind="loading" title="Loading saved briefings" />}
      {!error && rows && rows.length === 0 && <StatePanel kind="empty" title="No saved briefings" body="Nothing was saved by the earlier version for this scope." />}
      {!error && rows && rows.length > 0 && (
        <ul className="ib-steps">
          {rows.map((b) => (
            <li key={b.id} className="ib-card">
              <h2 className="ib-card__title">{b.title}</h2>
              <p className="ib-card__body">Saved {b.created_at.slice(0, 10)}. {EARLIER_VERSION_LABEL}</p>
              <button type="button" className="ib-btn" aria-expanded={open === b.id} onClick={() => setOpen(open === b.id ? null : b.id)}>
                {open === b.id ? 'Hide text' : 'Show text'}
              </button>
              {open === b.id && (b.content?.sections || []).map((s) => (<section key={s.heading}><h3>{s.heading}</h3><p>{s.body}</p></section>))}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};
