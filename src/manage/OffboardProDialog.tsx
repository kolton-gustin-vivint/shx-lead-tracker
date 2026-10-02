'use client';

/**
 * Team → "Offboard Pro". Previews everything it will do — the NEW leads going
 * back to the pool and the Pro's status/caps — then confirms.
 */
import { useEffect, useRef, useState } from 'react';
import { api, errorMessage, type OutputOf } from './api';
import { Spinner } from './ManageLoading';
import { formatDate } from './format';

type Result = OutputOf<'offboardPro'>;

export default function OffboardProDialog({
  pro, onClose, onDone,
}: {
  pro: { id: string; name: string };
  onClose: () => void;
  onDone: (message: string) => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const [preview, setPreview] = useState<Result | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    ref.current?.showModal();
    api('offboardPro', { proId: pro.id, dryRun: true })
      .then(setPreview)
      .catch(err => setError(errorMessage(err)))
      .finally(() => setLoading(false));
  }, [pro.id]);

  const offboard = async () => {
    setSaving(true);
    setError(null);
    try {
      onDone((await api('offboardPro', { proId: pro.id, dryRun: false })).message);
    } catch (err) {
      setError(errorMessage(err));
      setSaving(false);
    }
  };

  const close = () => { if (!saving) onClose(); };
  const blank = (v: number | null | undefined) => (v == null ? 'blank' : String(v));

  return (
    <dialog ref={ref} className="m-dialog" onCancel={e => { e.preventDefault(); close(); }}>
      <div className="m-dialog-head">
        <div>
          <h2>Offboard Pro</h2>
          <p className="muted">{pro.name}</p>
        </div>
        <button className="m-dialog-x" onClick={close} disabled={saving} aria-label="Close">×</button>
      </div>

      {error && <p className="error">{error}</p>}
      {loading && <p className="muted loading-row"><Spinner /> Checking this rep…</p>}
      {saving && <p className="muted loading-row"><Spinner /> Offboarding — this waits for Airtable's automations, so it can take up to a minute…</p>}

      {preview && !loading && !saving && (
        <div className="m-dialog-body">
          <ol className="m-steps">
            <li>
              <b>Return {preview.leads.length} NEW lead{preview.leads.length === 1 ? '' : 's'} to the pool</b> as Ready to Assign.
              <span className="muted"> Leads they've started working stay with them.</span>
            </li>
            <li>
              <b>Deactivate them:</b> Status <b>{preview.pro.status || '—'}</b> → <b>Inactive</b>,
              daily cap {blank(preview.pro.dailyCap)} → <b>0</b>, active cap {blank(preview.pro.activeCap)} → <b>0</b>.
            </li>
          </ol>
          <p className="error m-small">
            Once Inactive they can no longer sign in to the Lead Tracker, and they disappear from this Team page.
          </p>
          {preview.leads.length > 0 && (
            <ol className="m-leadlist">
              {preview.leads.map(l => (
                <li key={l.id}>
                  <span>{l.customerName || l.opportunityName || l.id}</span>
                  <span className="muted">{[l.city, l.state].filter(Boolean).join(', ')} · assigned {formatDate(l.dateAssigned)}</span>
                </li>
              ))}
            </ol>
          )}
        </div>
      )}

      <div className="m-dialog-foot">
        <button className="btn-quiet" onClick={close} disabled={saving}>Cancel</button>
        <button className="btn-danger" onClick={offboard} disabled={!preview || loading || saving}>
          {saving ? 'Offboarding…' : `Offboard ${pro.name}`}
        </button>
      </div>
    </dialog>
  );
}
