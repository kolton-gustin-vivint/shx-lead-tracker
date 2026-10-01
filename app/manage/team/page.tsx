'use client';

import { useEffect, useMemo, useState } from 'react';
import { api, errorMessage } from '@/manage/api';
import { Spinner } from '@/manage/ManageLoading';
import { useCardMode } from '@/manage/useCardMode';
import { formatCurrency } from '@/manage/format';
import LoadNewCapDialog from '@/manage/LoadNewCapDialog';

type Pro = {
  id: string;
  proName?: string;
  displayName?: string;
  email?: string;
  role?: string;
  activeLeadCount?: number;
  todaysLeads?: number;
  dailyCap?: number;
  activeCap?: number;
  runningCompTotal?: number;
};

// The SHX Team record buttons from Airtable, ordered everyday → destructive.
// Load NEW CAP runs in the app; Load Leads still calls the old trigger; the
// rest are layout placeholders for now.
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
  const [busyId, setBusyId] = useState<string | null>(null);
  const [loadNewCapFor, setLoadNewCapFor] = useState<Pro | null>(null);

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
    if (key === 'loadLeads') return loadLeads(pro);
    if (key === 'loadNewCap') { setError(null); setNotice(null); return setLoadNewCapFor(pro); }
    const label = ACTIONS.find(a => a.key === key)?.label;
    setError(null);
    setNotice(`${label} isn't connected yet — layout only for now.`);
  };

  const loadLeads = async (pro: Pro) => {
    const name = pro.displayName || pro.proName || 'this rep';
    if (!window.confirm(`Trigger Load Leads for ${name}? This runs the Airtable automation that assigns them new leads.`)) return;
    setBusyId(pro.id);
    setNotice(null);
    setError(null);
    try {
      await api('triggerLoadLeadsForPro', { proId: pro.id });
      setNotice(`Load Leads triggered for ${name}.`);
      setTimeout(load, 1500);
    } catch (err) {
      setError(`Load Leads failed for ${name}: ${errorMessage(err)}`);
    } finally {
      setBusyId(null);
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
                    <div>{p.displayName || p.proName}</div>
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
                          disabled={action.key === 'loadLeads' && busyId === p.id}
                        >
                          {action.key === 'loadLeads' && busyId === p.id ? 'Loading…' : action.label}
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
      {loadNewCapFor && (
        <LoadNewCapDialog
          pro={{ id: loadNewCapFor.id, name: loadNewCapFor.displayName || loadNewCapFor.proName || 'Rep' }}
          defaultCap={loadNewCapFor.dailyCap ?? 10}
          onClose={() => setLoadNewCapFor(null)}
          onAssigned={message => { setLoadNewCapFor(null); setNotice(message); load(); }}
        />
      )}
    </>
  );
}
