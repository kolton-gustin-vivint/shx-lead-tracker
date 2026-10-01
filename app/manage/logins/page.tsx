'use client';

import { useEffect, useMemo, useState } from 'react';
import { api, errorMessage, type OutputOf } from '@/manage/api';
import { Spinner } from '@/manage/ManageLoading';
import { describeAge, parseDateValue } from '@/manage/format';

type Row = OutputOf<'getLoginReport'>['teamLogins'][number];

const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

export default function LoginsPage() {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      setRows((await api('getLoginReport')).teamLogins);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const shown = useMemo(() => {
    const q = search.trim().toLowerCase();
    return q ? rows.filter(r => [r.displayName, r.proName, r.email].some(v => v.toLowerCase().includes(q))) : rows;
  }, [rows, search]);

  const never = rows.filter(r => !r.lastLogin).length;
  const active7d = rows.filter(r => r.lastLogin && Date.now() - parseDateValue(r.lastLogin).date.getTime() < WEEK_MS).length;

  return (
    <>
      <div className="row" style={{ marginBottom: 12 }}>
        <div>
          <h1>Login report</h1>
          <p className="muted">When each person last opened the SHX Lead Tracker. A refresh isn't a login.</p>
        </div>
        <span className="spacer" />
        <input type="search" placeholder="Search name or email…" value={search} onChange={e => setSearch(e.target.value)} />
        <button onClick={load} disabled={loading}>Refresh</button>
      </div>

      {error && <p className="error">{error}</p>}

      <div className="stats">
        <div className="stat"><span className="muted">Team</span><b>{rows.length}</b></div>
        <div className="stat"><span className="muted">Active in last 7 days</span><b>{active7d}</b></div>
        <div className="stat"><span className="muted">Never logged in</span><b>{never}</b></div>
      </div>

      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Name</th>
              <th>Role</th>
              <th>Last login</th>
              <th className="num">Logins (30d)</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={4} className="muted"><span className="loading-row"><Spinner /> Loading…</span></td></tr>
            ) : shown.length === 0 ? (
              <tr><td colSpan={4} className="muted">No results.</td></tr>
            ) : (
              shown.map(r => {
                const parsed = r.lastLogin ? parseDateValue(r.lastLogin) : null;
                return (
                  <tr key={r.airtableId}>
                    <td>
                      <div>{r.displayName || r.proName}</div>
                      <div className="muted">{r.email}</div>
                    </td>
                    <td>{r.role}</td>
                    <td>
                      {parsed ? (
                        <>
                          <div>{parsed.date.toLocaleDateString()}</div>
                          <div className="muted">{describeAge(parsed)}</div>
                        </>
                      ) : (
                        <span className="muted">Never</span>
                      )}
                    </td>
                    <td className="num">{r.loginCount30d}</td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </>
  );
}
