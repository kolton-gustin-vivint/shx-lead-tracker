'use client';

/**
 * Team → "Load NEW CAP". Pick a daily cap for this load, preview exactly which
 * leads it would assign (nothing is written), then confirm.
 */
import { useEffect, useRef, useState } from 'react';
import { api, errorMessage, type OutputOf } from './api';
import { Spinner } from './ManageLoading';

type Result = OutputOf<'loadNewCap'>;

/** Today in the manager's own time zone — written as Date Assigned. */
function localToday(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export default function LoadNewCapDialog({
  pro, defaultCap, onClose, onAssigned,
}: {
  pro: { id: string; name: string };
  defaultCap: number;
  onClose: () => void;
  onAssigned: (message: string) => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const [cap, setCap] = useState(String(defaultCap));
  const [preview, setPreview] = useState<Result | null>(null);
  const [previewing, setPreviewing] = useState(false);
  const [assigning, setAssigning] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => { ref.current?.showModal(); }, []);

  const capNumber = Number(cap);
  const capValid = Number.isInteger(capNumber) && capNumber >= 1 && capNumber <= 500;

  const runPreview = async () => {
    if (!capValid) return;
    setPreviewing(true);
    setError(null);
    setPreview(null);
    try {
      setPreview(await api('loadNewCap', { proId: pro.id, cap: capNumber, localDate: localToday(), dryRun: true }));
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setPreviewing(false);
    }
  };

  // Preview straight away with the default cap.
  useEffect(() => { runPreview(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const assign = async () => {
    setAssigning(true);
    setError(null);
    try {
      const res = await api('loadNewCap', { proId: pro.id, cap: capNumber, localDate: localToday(), dryRun: false });
      const skipped = res.skippedAlreadyTaken ? ` (${res.skippedAlreadyTaken} were taken meanwhile and skipped)` : '';
      onAssigned(res.status === 'assigned' ? `${res.message}${skipped}` : res.message);
    } catch (err) {
      setError(errorMessage(err));
      setAssigning(false);
    }
  };

  const busy = previewing || assigning;
  const count = preview?.leads?.length ?? 0;
  const close = () => { if (!assigning) onClose(); };

  return (
    <dialog ref={ref} className="m-dialog" onCancel={e => { e.preventDefault(); close(); }}>
      <div className="m-dialog-head">
        <div>
          <h2>Load NEW CAP</h2>
          <p className="muted">{pro.name}</p>
        </div>
        <button className="m-dialog-x" onClick={close} disabled={assigning} aria-label="Close">×</button>
      </div>

      <form className="row m-dialog-cap" onSubmit={e => { e.preventDefault(); runPreview(); }}>
        <label htmlFor="cap">Daily cap for this load</label>
        <input id="cap" type="number" min={1} max={500} value={cap} onChange={e => { setCap(e.target.value); setPreview(null); }} disabled={assigning} />
        <button type="submit" disabled={!capValid || busy}>Preview</button>
      </form>
      <p className="muted m-dialog-hint">Assigns up to this many minus what they've already received today, and never past their active lead cap.</p>

      {error && <p className="error">{error}</p>}
      {previewing && <p className="muted loading-row"><Spinner /> Checking capacity and matching leads…</p>}

      {preview && !previewing && (
        <div className="m-dialog-body">
          <p className={preview.status === 'preview' && count ? undefined : 'muted'}><strong>{preview.message}</strong></p>
          {preview.capacity && (
            <div className="m-kv">
              <span>Today <b>{preview.capacity.today}</b></span>
              <span>Active <b>{preview.capacity.active}/{preview.capacity.activeCap}</b></span>
              <span>Needed <b>{Math.max(0, preview.capacity.needed)}</b></span>
              {preview.available != null && <span>Matching <b>{preview.available}</b></span>}
            </div>
          )}
          {!!preview.buckets?.some(b => b.count) && (
            <p className="muted m-small">Matches by bucket: {preview.buckets.filter(b => b.count).map(b => `${b.name} ${b.count}`).join(' · ')}</p>
          )}
          {count > 0 && (
            <ol className="m-leadlist">
              {preview.leads!.map(l => (
                <li key={l.id}>
                  <span>{l.customerName || l.opportunityName || l.id}</span>
                  <span className="muted">{[l.city, l.state].filter(Boolean).join(', ')} · {l.bucket}</span>
                </li>
              ))}
            </ol>
          )}
          {!!preview.shortfall?.length && (
            <ul className="muted m-small m-shortfall">{preview.shortfall.map(s => <li key={s}>{s}</li>)}</ul>
          )}
        </div>
      )}

      <div className="m-dialog-foot">
        <button className="btn-quiet" onClick={close} disabled={assigning}>Cancel</button>
        <button onClick={assign} disabled={!preview || preview.status !== 'preview' || count === 0 || busy}>
          {assigning ? 'Assigning…' : count ? `Assign ${count} lead${count === 1 ? '' : 's'}` : 'Assign'}
        </button>
      </div>
    </dialog>
  );
}
