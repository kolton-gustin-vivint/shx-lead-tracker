'use client';

/**
 * Team → "Revert Pro". Shows what will change (Status → Reverted, Reversion
 * Date → now) and what the rep still holds, then confirms.
 */
import { useEffect, useRef, useState } from 'react';
import { api, errorMessage, type OutputOf } from './api';
import { Spinner } from './ManageLoading';

type Result = OutputOf<'revertPro'>;

export default function RevertProDialog({
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
    api('revertPro', { proId: pro.id, dryRun: true })
      .then(setPreview)
      .catch(err => setError(errorMessage(err)))
      .finally(() => setLoading(false));
  }, [pro.id]);

  const revert = async () => {
    setSaving(true);
    setError(null);
    try {
      onDone((await api('revertPro', { proId: pro.id, dryRun: false })).message);
    } catch (err) {
      setError(errorMessage(err));
      setSaving(false);
    }
  };

  const close = () => { if (!saving) onClose(); };
  const held = preview?.leads;

  return (
    <dialog ref={ref} className="m-dialog" onCancel={e => { e.preventDefault(); close(); }}>
      <div className="m-dialog-head">
        <div>
          <h2>Revert Pro</h2>
          <p className="muted">{pro.name}</p>
        </div>
        <button className="m-dialog-x" onClick={close} disabled={saving} aria-label="Close">×</button>
      </div>

      {error && <p className="error">{error}</p>}
      {loading && <p className="muted loading-row"><Spinner /> Checking this rep…</p>}

      {preview && !loading && (
        <div className="m-dialog-body">
          <p><strong>{preview.message}</strong></p>
          <div className="m-kv">
            <span>Status <b>{preview.pro.currentStatus || '—'}</b> → <b>Reverted</b></span>
          </div>
          <p className="muted m-small">Reverted reps stop receiving loaded leads. Their leads are <b>not</b> changed by this.</p>
          {held && held.active > 0 && (
            <p className="error m-small">
              They still hold <b>{held.active}</b> active lead{held.active === 1 ? '' : 's'}{held.activeNew ? <>, <b>{held.activeNew}</b> still NEW</> : null}. To return those to the pool, use FORCE Reclaim first.
            </p>
          )}
        </div>
      )}

      <div className="m-dialog-foot">
        <button className="btn-quiet" onClick={close} disabled={saving}>Cancel</button>
        <button className="btn-danger" onClick={revert} disabled={!preview || loading || saving}>
          {saving ? 'Reverting…' : 'Revert Pro'}
        </button>
      </div>
    </dialog>
  );
}
