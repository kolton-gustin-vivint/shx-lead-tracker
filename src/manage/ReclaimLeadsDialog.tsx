'use client';

/**
 * Team → "Reclaim Leads" (still NEW 14+ days after assignment) and
 * "FORCE Reclaim" (every NEW lead, any age). Lists what would be taken back
 * (nothing is written), then confirms.
 */
import { useEffect, useRef, useState } from 'react';
import { api, errorMessage, type OutputOf } from './api';
import { Spinner } from './ManageLoading';
import { formatDate, describeAge, parseDateValue } from './format';

type Result = OutputOf<'reclaimLeads'>;
export type ReclaimMode = 'stale' | 'force';

export default function ReclaimLeadsDialog({
  mode, pro, onClose, onDone,
}: {
  mode: ReclaimMode;
  pro: { id: string; name: string };
  onClose: () => void;
  onDone: (message: string) => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const [preview, setPreview] = useState<Result | null>(null);
  const [previewing, setPreviewing] = useState(true);
  const [reclaiming, setReclaiming] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const force = mode === 'force';
  const call = (dryRun: boolean) => api(force ? 'forceReclaimLeads' : 'reclaimLeads', { proId: pro.id, dryRun });

  useEffect(() => {
    ref.current?.showModal();
    call(true)
      .then(setPreview)
      .catch(err => setError(errorMessage(err)))
      .finally(() => setPreviewing(false));
  }, [pro.id, mode]); // eslint-disable-line react-hooks/exhaustive-deps

  const reclaim = async () => {
    setReclaiming(true);
    setError(null);
    try {
      const res = await call(false);
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
          <h2>{force ? 'FORCE Reclaim' : 'Reclaim Leads'}</h2>
          <p className="muted">{pro.name}</p>
        </div>
        <button className="m-dialog-x" onClick={close} disabled={reclaiming} aria-label="Close">×</button>
      </div>

      {force ? (
        <p className="error m-dialog-hint">
          Takes back <b>every</b> lead this rep still has at <b>NEW</b> — no matter how recently it was assigned — and puts them back in the pool as Ready to Assign. Use for offboarding or immediate lead recovery.
        </p>
      ) : (
        <p className="muted m-dialog-hint">
          Takes back leads this rep hasn't touched — still <b>NEW</b> more than 14 days after they were assigned — and puts them back in the pool as Ready to Assign.
        </p>
      )}

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
        <button className={force ? 'btn-danger' : undefined} onClick={reclaim} disabled={!count || previewing || reclaiming}>
          {reclaiming ? 'Reclaiming…' : count ? `${force ? 'Force reclaim' : 'Reclaim'} ${count} lead${count === 1 ? '' : 's'}` : 'Reclaim'}
        </button>
      </div>
    </dialog>
  );
}
