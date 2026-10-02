'use client';

import { useEffect, useMemo, useState } from 'react';
import { api, errorMessage } from '@/manage/api';
import { Spinner } from '@/manage/ManageLoading';
import { useCardMode } from '@/manage/useCardMode';
import { formatCurrency } from '@/manage/format';
import LoadLeadsDialog, { type LoadMode } from '@/manage/LoadLeadsDialog';
import ReclaimLeadsDialog, { type ReclaimMode } from '@/manage/ReclaimLeadsDialog';
import RevertProDialog from '@/manage/RevertProDialog';
import OffboardProDialog from '@/manage/OffboardProDialog';

type Pro = {
  id: string;
  proName?: string;
  displayName?: string;
  email?: string;
  role?: string;
  status?: string;
  activeLeadCount?: number;
  todaysLeads?: number;
  dailyCap?: number;
  activeCap?: number;
  runningCompTotal?: number;
};

// The SHX Team record buttons from Airtable, ordered everyday → destructive.
// All six run in the app, each with a preview first and an Audit Log entry
// that `npm run leads:undo` can reverse.
const ACTIONS = [
  { key: 'loadLeads', label: 'Load Leads', variant: 'blue' },
  { key: 'loadNewCap', label: 'Load NEW CAP', variant: 'cyan' },
  { key: 'reclaimLeads', label: 'Reclaim Leads', variant: 'amber' },
  { key: 'forceReclaim', label: 'FORCE Reclaim', variant: 'orange' },
  { key: 'revertPro', label: 'Revert Pro', variant: 'gray' },
  { key: 'offboardPro', label: 'Offboard Pro', variant: 'red' },
] as const;

type ActionKey = (typeof ACTIONS)[number]['key'];

const atCap = (p: Pro) => p.activeCap != null && (p.activeLeadCount ?? 0) >= p.activeCap;

export default function TeamPage() {
  const { ref: tableRef, cards } = useCardMode();
  const [pros, setPros] = useState<Pro[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [loadFor, setLoadFor] = useState<{ mode: LoadMode; pro: Pro } | null>(null);
  const [reclaimFor, setReclaimFor] = useState<{ mode: ReclaimMode; pro: Pro } | null>(null);
  const [revertFor, setRevertFor] = useState<Pro | null>(null);
  const [offboardFor, setOffboardFor] = useState<Pro | null>(null);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api('getReps');
      setPros((res.pros as Pro[]).filter(p => p.role === 'Pro'));
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const shown = useMemo(() => {
    const q = search.trim().toLowerCase();
    const list = q
      ? pros.filter(p => [p.displayName, p.proName, p.email].some(v => v?.toLowerCase().includes(q)))
      : pros;
    return [...list].sort((a, b) => (a.displayName || a.proName || '').localeCompare(b.displayName || b.proName || ''));
  }, [pros, search]);

  const runAction = (key: ActionKey, pro: Pro) => {
    setError(null);
    setNotice(null);
    switch (key) {
      case 'loadLeads':
      case 'loadNewCap': return setLoadFor({ mode: key, pro });
      case 'reclaimLeads': return setReclaimFor({ mode: 'stale', pro });
      case 'forceReclaim': return setReclaimFor({ mode: 'force', pro });
      case 'revertPro': return setRevertFor(pro);
      case 'offboardPro': return setOffboardFor(pro);
    }
  };

  return (
    <>
      <div className="row" style={{ marginBottom: 12 }}>
        <div>
          <h1>Team</h1>
          <p className="muted">Active Pros on the SHX Team roster.</p>
        </div>
        <span className="spacer" />
        <input type="search" placeholder="Search name or email…" value={search} onChange={e => setSearch(e.target.value)} />
        <button onClick={load} disabled={loading}>Refresh</button>
      </div>

      {error && <p className="error">{error}</p>}
      {notice && <p className="ok">{notice}</p>}

      <div className={`table-wrap${cards ? ' as-cards' : ''}`} ref={tableRef}>
        <table className="cards cards-3">
          <thead>
            <tr>
              <th>Name</th>
              <th className="num">Active</th>
              <th className="num">Today</th>
              <th className="num">Active cap</th>
              <th className="num">Daily cap</th>
              <th className="num">Comp</th>
              <th className="actions-col">Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={7} className="muted"><span className="loading-row"><Spinner /> Loading…</span></td></tr>
            ) : shown.length === 0 ? (
              <tr><td colSpan={7} className="muted">No team members found.</td></tr>
            ) : (
              shown.map(p => (
                <tr key={p.id}>
                  <td className="card-title">
                    <div>
                      {p.displayName || p.proName}
                      {p.status === 'Reverted' && <span className="tag-reverted" title="Status: Reverted — no longer receives loaded leads">Reverted</span>}
                    </div>
                    <div className="muted">{p.email}</div>
                  </td>
                  <td
                    data-label="Active"
                    className={`num${atCap(p) ? ' at-cap' : !p.activeLeadCount ? ' zero' : ''}`}
                    title={atCap(p) ? 'At or over their active lead cap' : undefined}
                  >
                    {p.activeLeadCount ?? 0}
                  </td>
                  <td data-label="Today" className={`num${!p.todaysLeads ? ' zero' : ''}`}>{p.todaysLeads ?? 0}</td>
                  <td data-label="Active cap" className="num">{p.activeCap ?? '—'}</td>
                  <td data-label="Daily cap" className="num">{p.dailyCap ?? '—'}</td>
                  <td data-label="Comp" className={`num${!p.runningCompTotal ? ' zero' : ''}`}>{formatCurrency(p.runningCompTotal)}</td>
                  <td className="actions-col card-wide">
                    <div className="actions">
                      {ACTIONS.map(action => (
                        <button
                          key={action.key}
                          className={`btn-sm btn-${action.variant}`}
                          onClick={() => runAction(action.key, p)}
                        >
                          {action.label}
                        </button>
                      ))}
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
      <p className="muted">{shown.length} of {pros.length} Pros</p>
      {offboardFor && (
        <OffboardProDialog
          key={offboardFor.id}
          pro={{ id: offboardFor.id, name: offboardFor.displayName || offboardFor.proName || 'Rep' }}
          onClose={() => setOffboardFor(null)}
          onDone={message => { setOffboardFor(null); setNotice(message); load(); }}
        />
      )}
      {revertFor && (
        <RevertProDialog
          key={revertFor.id}
          pro={{ id: revertFor.id, name: revertFor.displayName || revertFor.proName || 'Rep' }}
          onClose={() => setRevertFor(null)}
          onDone={message => { setRevertFor(null); setNotice(message); load(); }}
        />
      )}
      {reclaimFor && (
        <ReclaimLeadsDialog
          key={`${reclaimFor.mode}-${reclaimFor.pro.id}`}
          mode={reclaimFor.mode}
          pro={{ id: reclaimFor.pro.id, name: reclaimFor.pro.displayName || reclaimFor.pro.proName || 'Rep' }}
          onClose={() => setReclaimFor(null)}
          onDone={message => { setReclaimFor(null); setNotice(message); load(); }}
        />
      )}
      {loadFor && (
        <LoadLeadsDialog
          key={`${loadFor.mode}-${loadFor.pro.id}`}
          mode={loadFor.mode}
          pro={{ id: loadFor.pro.id, name: loadFor.pro.displayName || loadFor.pro.proName || 'Rep' }}
          defaultCap={loadFor.pro.dailyCap ?? 10}
          onClose={() => setLoadFor(null)}
          onAssigned={message => { setLoadFor(null); setNotice(message); load(); }}
        />
      )}
    </>
  );
}
