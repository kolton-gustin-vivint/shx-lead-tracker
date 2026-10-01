'use client';

import { useEffect, useState } from 'react';
import { api, errorMessage } from '@/manage/api';

type Stats = { unassignedCount?: number; rawIntakeCount?: number };

// Each action ticks a checkbox on the Airtable Control Panel record, which an
// Airtable automation watches.
const ACTIONS = [
  {
    endpoint: 'triggerProcessNewUploads',
    label: 'Process uploads',
    help: 'Process and import new lead data from uploaded files.',
    confirm: 'This will run the New Lead Intake automation, processing all pending uploaded files.',
  },
  {
    endpoint: 'triggerDistributeLeads',
    label: 'Distribute leads',
    help: 'Assign unassigned leads to reps based on capacity and location.',
    confirm: 'This will assign unassigned leads to available sales reps.',
  },
  {
    endpoint: 'triggerMarkLeftoverLeads',
    label: 'Mark leftovers',
    help: 'Flag leads that remain unassigned after distribution.',
    confirm: 'This will flag all leads not assigned during the last distribution run.',
  },
] as const;

export default function AdminPage() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    api('getAdminStats').then(setStats).catch(err => setError(errorMessage(err)));
  }, []);

  const refresh = async () => {
    setRefreshing(true);
    setError(null);
    try {
      setStats(await api('refreshAdminStats'));
      setNotice('Counts recalculated.');
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setRefreshing(false);
    }
  };

  const run = async (action: (typeof ACTIONS)[number]) => {
    if (!window.confirm(`${action.label}\n\n${action.confirm} Continue?`)) return;
    setBusy(action.endpoint);
    setError(null);
    setNotice(null);
    try {
      await api(action.endpoint);
      setNotice(`${action.label}: triggered.`);
    } catch (err) {
      setError(`${action.label} failed: ${errorMessage(err)}`);
    } finally {
      setBusy(null);
    }
  };

  return (
    <>
      <h1>Admin</h1>
      <p className="muted" style={{ marginBottom: 12 }}>Lead pipeline counts and the Airtable automations that move leads through it.</p>

      {error && <p className="error">{error}</p>}
      {notice && <p className="ok">{notice}</p>}

      <div className="stats">
        <div className="stat"><span className="muted">Leads ready to be assigned</span><b>{stats ? (stats.unassignedCount ?? 0).toLocaleString() : '…'}</b></div>
        <div className="stat"><span className="muted">New uploads pending intake</span><b>{stats ? (stats.rawIntakeCount ?? 0).toLocaleString() : '…'}</b></div>
      </div>
      <div className="row" style={{ marginBottom: 20 }}>
        <button onClick={refresh} disabled={refreshing}>{refreshing ? 'Recalculating…' : 'Recalculate counts'}</button>
        <span className="muted">Counts are cached on the Control Panel record; recalculating pages through NIS Leads.</span>
      </div>

      {ACTIONS.map(action => (
        <div className="card row" key={action.endpoint}>
          <div>
            <h2>{action.label}</h2>
            <p className="muted" style={{ margin: 0 }}>{action.help}</p>
          </div>
          <span className="spacer" />
          <button className="primary" onClick={() => run(action)} disabled={busy !== null}>
            {busy === action.endpoint ? 'Starting…' : 'Run'}
          </button>
        </div>
      ))}
    </>
  );
}
