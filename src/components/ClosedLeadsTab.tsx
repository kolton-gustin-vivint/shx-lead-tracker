import React, { useState, useEffect, useRef } from 'react';
import { toast } from 'sonner';
import LeadsTable from './LeadsTable';
import LeadDetails from './LeadDetails';
import LeadsTableSkeleton from './LeadsTableSkeleton';
import { getClosedLeads, GetClosedLeadsOutputType, GetRepsOutputType } from '@/lib/api';
import { useReps } from '../contexts/RepsContext';
import { useProxy } from '../contexts/ProxyContext';

type Lead = GetClosedLeadsOutputType['leads'][0];
type Pro = GetRepsOutputType['pros'][0];

interface ClosedLeadsTabProps {
  isManager: boolean;
}

const CLOSED_SUB_STATUSES = [
  { value: 'CLOSED | Not Interested', label: 'Not Interested' },
  { value: 'CLOSED | Blocked by Objection(s)', label: 'Blocked by Objection(s)' },
  { value: 'CLOSED | Appointment Set, No Sale', label: 'Appt Set, No Sale' },
  { value: 'CLOSED | Missing Contact Info', label: 'Missing Contact Info' },
  { value: 'CLOSED | Already Sold', label: 'Already Sold' },
  { value: 'CLOSED | Sold/Scheduled', label: 'Sold/Scheduled' },
  { value: 'CLOSED | Installed', label: 'Installed' },
  { value: 'CLOSED | Duplicate', label: 'Duplicate' },
  { value: 'CLOSED | Admin', label: 'Admin' },
  { value: 'CLOSED | Lead Outside Market', label: 'Lead Outside Market' },
];

export default function ClosedLeadsTab({ isManager }: ClosedLeadsTabProps) {
  const { currentUser, isProxying } = useProxy();
  const { pros } = useReps();

  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(false);
  const [hasFetched, setHasFetched] = useState(false);
  const [selectedSubStatus, setSelectedSubStatus] = useState('all');
  const [showLeadDetails, setShowLeadDetails] = useState(false);
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [lastRefreshTime, setLastRefreshTime] = useState<Date | null>(null);

  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  // Airtable cursors only move forward, so keep the cursor used to fetch each
  // page: cursorsRef[n] fetches page n + 1. That is what lets Previous work.
  const cursorsRef = useRef<(string | undefined)[]>([undefined]);

  const userRecordId = currentUser?.id ?? '';
  const RECORDS_PER_PAGE = 50;
  const showManagerView = isManager && !isProxying;

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(searchTerm), 500);
    return () => clearTimeout(timer);
  }, [searchTerm]);

  useEffect(() => {
    if (!hasFetched) return;
    setCurrentPage(1);
    loadPage(1, selectedSubStatus === 'all' ? undefined : selectedSubStatus, debouncedSearch);
  }, [debouncedSearch]);

  useEffect(() => {
    if (!hasFetched) return;
    setCurrentPage(1);
    setSelectedSubStatus('all');
    loadPage(1, undefined, debouncedSearch);
  }, [userRecordId, showManagerView, isProxying]);

  const loadPage = async (requestedPage: number, subStatus?: string, search?: string) => {
    // We only hold a cursor for pages we've already walked to; anything else
    // restarts from page 1.
    const page = requestedPage > 1 && cursorsRef.current[requestedPage - 1] === undefined ? 1 : requestedPage;
    try {
      setLoading(true);

      const result = await getClosedLeads({
        subStatus: subStatus || undefined,
        assignedPro: !showManagerView && userRecordId ? userRecordId : undefined,
        search: search && search.trim() ? search.trim() : undefined,
        offset: cursorsRef.current[page - 1],
        limit: RECORDS_PER_PAGE,
      });

      // Keep cursors up to this page and record the one for the next.
      cursorsRef.current = cursorsRef.current.slice(0, page);
      cursorsRef.current[page] = result.offset;

      setLeads(result.leads);
      setHasMore(result.hasMore);
      setCurrentPage(page);
      setLastRefreshTime(new Date());
      setHasFetched(true);
      setTotalPages(result.hasMore ? page + 1 : page);
    } catch (error) {
      console.error('Error loading closed leads:', error);
      toast.error('Failed to load closed leads');
    } finally {
      setLoading(false);
    }
  };

  const handleSubStatusFilter = (subStatus: string) => {
    setSelectedSubStatus(subStatus);
    setCurrentPage(1);
    loadPage(1, subStatus === 'all' ? undefined : subStatus, debouncedSearch);
  };

  const handleSearch = (search: string) => setSearchTerm(search);

  const handlePageChange = (newPage: number) => {
    const sub = selectedSubStatus === 'all' ? undefined : selectedSubStatus;
    loadPage(newPage, sub, debouncedSearch);
  };

  const handleRefresh = () => {
    const sub = selectedSubStatus === 'all' ? undefined : selectedSubStatus;
    setCurrentPage(1);
    loadPage(1, sub, debouncedSearch);
  };

  const handleLeadUpdated = (updatedLead: Lead) => {
    setLeads(prev => prev.map(l => l.id === updatedLead.id ? updatedLead : l));
    setSelectedLead(updatedLead);
  };

  const handleEditLead = (lead: Lead) => {
    if (!showManagerView && lead.assignedPro && !lead.assignedPro.includes(userRecordId || '')) {
      toast.error('Access denied. You can only view your assigned leads.');
      return;
    }
    setSelectedLead(lead);
    setShowLeadDetails(true);
  };

  useEffect(() => {
    if (!hasFetched) {
      loadPage(1, undefined, '');
    }
  }, []);

  if (!currentUser) return null;

  return (
    <div className="space-y-3">
      {/* Sub-status filter — horizontally scrollable on mobile */}
      <div className="flex items-center gap-2 -mx-4 sm:-mx-6 px-4 sm:px-6">
        <span className="text-sm font-medium text-muted-foreground shrink-0">Filter:</span>
        <div className="filter-scroll flex-1">
          <button
            onClick={() => handleSubStatusFilter('all')}
            className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors border shrink-0 ${
              selectedSubStatus === 'all'
                ? 'bg-primary text-primary-foreground border-primary'
                : 'bg-card text-card-foreground border-border hover:bg-muted'
            }`}
          >
            All Closed
          </button>
          {CLOSED_SUB_STATUSES.map(sub => (
            <button
              key={sub.value}
              onClick={() => handleSubStatusFilter(sub.value)}
              className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors border shrink-0 ${
                selectedSubStatus === sub.value
                  ? 'bg-primary text-primary-foreground border-primary'
                  : 'bg-card text-card-foreground border-border hover:bg-muted'
              }`}
            >
              {sub.label}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <LeadsTableSkeleton />
      ) : (
        <LeadsTable
          leads={leads}
          pros={pros}
          loading={loading}
          onEditLead={handleEditLead}
          onRefresh={handleRefresh}
          onSearch={handleSearch}
          searchTerm={searchTerm}
          isManager={showManagerView}
          currentPage={currentPage}
          totalPages={totalPages}
          hasMore={hasMore}
          onPageChange={handlePageChange}
          recordsPerPage={RECORDS_PER_PAGE}
          autoRefreshEnabled={false}
          onToggleAutoRefresh={() => {}}
          lastRefreshTime={lastRefreshTime}
          totalCount={null}
          title="Closed Leads"
          hideAutoRefresh={true}
        />
      )}

      {showLeadDetails && (
        <LeadDetails
          lead={selectedLead}
          pros={pros}
          onClose={() => {
            setShowLeadDetails(false);
            setSelectedLead(null);
          }}
          onRefresh={handleRefresh}
          onLeadUpdated={handleLeadUpdated}
          currentUser={currentUser}
        />
      )}
    </div>
  );
}
