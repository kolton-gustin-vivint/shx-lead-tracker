'use client';

import { useEffect, useRef, useState } from 'react';
import { api, errorMessage, type OutputOf } from '@/manage/api';
import { Spinner } from '@/manage/ManageLoading';
import { useCardMode } from '@/manage/useCardMode';
import { formatDate } from '@/manage/format';

type Lead = OutputOf<'getUnassignedLeads'>['leads'][number];
type Rep = { id: string; name: string };

const PAGE_SIZE = 50;

export default function UnassignedPage() {
  const { ref: tableRef, cards } = useCardMode();
  const [leads, setLeads] = useState<Lead[]>([]);
  const [reps, setReps] = useState<Rep[]>([]);
  const [choice, setChoice] = useState<Record<string, string>>({});
  const [busyId, setBusyId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [query, setQuery] = useState('');
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  // Airtable cursors only go forward: cursors[n] fetches page n + 1.
  const cursors = useRef<(string | undefined)[]>([undefined]);

  useEffect(() => {
    api('getReps')
      .then(res =>
        setReps(
          (res.pros as any[])
            .filter(p => p.role === 'Pro')
            .map(p => ({ id: p.id, name: p.displayName || p.proName || p.email }))
            .sort((a, b) => a.name.localeCompare(b.name)),
        ),
      )
      .catch(err => setError(errorMessage(err)));
  }, []);

  useEffect(() => {
    const t = setTimeout(() => setQuery(search.trim()), 400);
    return () => clearTimeout(t);
  }, [search]);

  const load = async (target: number) => {
    const p = target > 1 && cursors.current[target - 1] === undefined ? 1 : target;
    setLoading(true);
    setError(null);
    try {
      const res = await api('getUnassignedLeads', { limit: PAGE_SIZE, offset: cursors.current[p - 1], search: query || undefined });
      cursors.current = cursors.current.slice(0, p);
      cursors.current[p] = res.offset;
      setLeads(res.leads);
      setHasMore(res.hasMore);
      setPage(p);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  // New search → start again from page 1.
  useEffect(() => {
    cursors.current = [undefined];
    load(1);
  }, [query]); // eslint-disable-line react-hooks/exhaustive-deps

  const assign = async (lead: Lead) => {
    const proId = choice[lead.id];
    if (!proId) return;
    setBusyId(lead.id);
    setNotice(null);
    setError(null);
    try {
      await api('assignLead', { leadId: lead.id, proId });
      const rep = reps.find(r => r.id === proId);
      setLeads(prev => prev.filter(l => l.id !== lead.id));
      setNotice(`Assigned ${lead.customerName || lead.opportunityName} to ${rep?.name ?? 'rep'}.`);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusyId(null);
    }
  };

  return (
    <>
      <div className="row" style={{ marginBottom: 12 }}>
        <div>
          <h1>Unassigned leads</h1>
          <p className="muted">Leads with Lead Type “Ready to Assign”. Assigning sets Assigned Pro and Date Assigned.</p>
        </div>
        <span className="spacer" />
        <input type="search" placeholder="Search name, opportunity, phone, city…" value={search} onChange={e => setSearch(e.target.value)} />
        <button onClick={() => { cursors.current = [undefined]; load(1); }} disabled={loading}>Refresh</button>
      </div>

      {error && <p className="error">{error}</p>}
      {notice && <p className="ok">{notice}</p>}

      <div className={`table-wrap${cards ? ' as-cards' : ''}`} ref={tableRef}>
        <table className="cards cards-2">
          <thead>
            <tr>
              <th>Customer</th>
              <th>Location</th>
              <th>District / office</th>
              <th>Source</th>
              <th>Added</th>
              <th>Assign to</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={6} className="muted"><span className="loading-row"><Spinner /> Loading…</span></td></tr>
            ) : leads.length === 0 ? (
              <tr><td colSpan={6} className="muted">{query ? 'No unassigned leads match that search.' : 'No unassigned leads.'}</td></tr>
            ) : (
              leads.map(lead => (
                <tr key={lead.id}>
                  <td className="card-title">
                    <div>{lead.customerName || '—'}</div>
                    <div className="muted">{lead.opportunityName}</div>
                  </td>
                  <td data-label="Location">{[lead.city, lead.state].filter(Boolean).join(', ')} {lead.zip}</td>
                  <td data-label="District / office">
                    <div>{lead.district || '—'}</div>
                    <div className="muted">{lead.salesOffice}</div>
                  </td>
                  <td data-label="Source">{lead.leadSource || '—'}</td>
                  <td data-label="Added">{formatDate(lead.dateAdded)}</td>
                  <td className="card-wide">
                    <div className="row assign">
                      <select value={choice[lead.id] ?? ''} onChange={e => setChoice(c => ({ ...c, [lead.id]: e.target.value }))}>
                        <option value="">Choose a rep…</option>
                        {reps.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
                      </select>
                      <button className="primary" disabled={!choice[lead.id] || busyId === lead.id} onClick={() => assign(lead)}>
                        {busyId === lead.id ? 'Assigning…' : 'Assign'}
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <div className="pager">
        <button onClick={() => load(page - 1)} disabled={loading || page === 1}>← Previous</button>
        <span className="muted">Page {page}</span>
        <button onClick={() => load(page + 1)} disabled={loading || !hasMore}>Next →</button>
      </div>
    </>
  );
}
