'use client';

/**
 * Team → "Reclaim Leads". Lists the rep's leads that are still NEW more than
 * 14 days after assignment (nothing is written), then confirms.
 */
import { useEffect, useRef, useState } from 'react';
import { api, errorMessage, type OutputOf } from './api';
import { Spinner } from './ManageLoading';
import { formatDate, describeAge, parseDateValue } from './format';

type Result = OutputOf<'reclaimLeads'>;

export default function ReclaimLeadsDialog({
  pro, onClose, onDone,
}: {
  pro: { id: string; name: string };
  onClose: () => void;
  onDone: (message: string) => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const [preview, setPreview] = useState<Result | null>(null);
  const [previewing, setPreviewing] = useState(true);
  const [reclaiming, setReclaiming] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    ref.current?.showModal();
    api('reclaimLeads', { proId: pro.id, dryRun: true })
      .then(setPreview)
      .catch(err => setError(errorMessage(err)))
      .finally(() => setPreviewing(false));
  }, [pro.id]);

  const reclaim = async () => {
    setReclaiming(true);
    setError(null);
    try {
      const res = await api('reclaimLeads', { proId: pro.id, dryRun: false });
      onDone(res.message);
    } catch (err) {
      setError(errorMessage(err));
      setReclaiming(false);
    }
  };

  const count = preview?.status === 'preview' ? preview.leads.length : 0;
  const close = () => { if (!reclaiming) onClose(); };

  return (
    <dialog ref={ref} className="m-dialog" onCancel={e => { e.preventDefault(); close(); }}>
      <div className="m-dialog-head">
        <div>
          <h2>Reclaim Leads</h2>
          <p className="muted">{pro.name}</p>
        </div>
        <button className="m-dialog-x" onClick={close} disabled={reclaiming} aria-label="Close">×</button>
      </div>

      <p className="muted m-dialog-hint">
        Takes back leads this rep hasn't touched — still <b>NEW</b> more than 14 days after they were assigned — and puts them back in the pool as Ready to Assign.
      </p>

      {error && <p className="error">{error}</p>}
      {previewing && <p className="muted loading-row"><Spinner /> Looking for stale leads…</p>}
      {reclaiming && <p className="muted loading-row"><Spinner /> Reclaiming — this waits for Airtable's automations, so it can take up to a minute…</p>}

      {preview && !previewing && !reclaiming && (
        <div className="m-dialog-body">
          <p className={count ? undefined : 'muted'}><strong>{preview.message}</strong></p>
          {count > 0 && (
            <ol className="m-leadlist">
              {preview.leads.map(l => {
                const age = l.dateAssigned ? parseDateValue(l.dateAssigned) : null;
                return (
                  <li key={l.id}>
                    <span>{l.customerName || l.opportunityName || l.id}</span>
                    <span className="muted">
                      {[l.city, l.state].filter(Boolean).join(', ')} · assigned {formatDate(l.dateAssigned)}{age ? ` (${describeAge(age)})` : ''}
                    </span>
                  </li>
                );
              })}
            </ol>
          )}
        </div>
      )}

      <div className="m-dialog-foot">
        <button className="btn-quiet" onClick={close} disabled={reclaiming}>Cancel</button>
        <button onClick={reclaim} disabled={!count || previewing || reclaiming}>
          {reclaiming ? 'Reclaiming…' : count ? `Reclaim ${count} lead${count === 1 ? '' : 's'}` : 'Reclaim'}
        </button>
      </div>
    </dialog>
  );
}
