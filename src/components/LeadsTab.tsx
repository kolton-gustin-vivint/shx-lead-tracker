import React, { useState, useEffect, useRef } from 'react';
import { toast } from 'sonner';
import { useDebouncedCallback } from 'use-debounce';
import LeadsTable from './LeadsTable';
import LeadDetails from './LeadDetails';
import LeadsTableSkeleton from './LeadsTableSkeleton';
import { getLeads, GetLeadsOutputType, GetRepsOutputType } from '@/lib/api';
import { useReps } from '../contexts/RepsContext';
import { useProxy } from '../contexts/ProxyContext';
import { useStatusOptions } from '../contexts/StatusOptionsContext';

type Lead = GetLeadsOutputType['leads'][0];
type Pro = GetRepsOutputType['pros'][0];

interface LeadsTabProps {
  isManager: boolean;
}

const AUTO_REFRESH_INTERVAL = 60000;
const STATUS_DEBOUNCE_MS = 300;
const RECORDS_PER_PAGE = 50;

const SUB_STATUSES: Record<string, { value: string; label: string }[]> = {
  'IN-PROGRESS': [
    { value: 'IN-PROGRESS | No Answer', label: 'No Answer' },
    { value: 'IN-PROGRESS | Follow-Up', label: 'Follow-Up' },
    { value: 'IN-PROGRESS | Appointment Set', label: 'Appointment Set' },
  ],
};

const BUCKET_ALL_LABELS: Record<string, string> = {
  'IN-PROGRESS': 'All In-Progress',
};

export default function LeadsTab({ isManager }: LeadsTabProps) {
  const { currentUser, isProxying } = useProxy();
  const { loading: statusLoading } = useStatusOptions();
  const { pros, reload: loadReps } = useReps();

  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedStatus, setSelectedStatus] = useState('all');
  const [selectedSubStatus, setSelectedSubStatus] = useState('all');
  const [showLeadDetails, setShowLeadDetails] = useState(false);
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState('');
  const [autoRefreshEnabled, setAutoRefreshEnabled] = useState(true);
  const [lastRefreshTime, setLastRefreshTime] = useState<Date | null>(null);

  const [currentPage, setCurrentPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [totalCount, setTotalCount] = useState<number | null>(null);

  const autoRefreshRef = useRef<number | null>(null);
  const isUserInteractingRef = useRef(false);

  // Airtable cursors only move forward, so keep the cursor used to fetch each
  // page: cursorsRef[n] fetches page n + 1, which lets Previous work. Refs (not
  // state) because the auto-refresh interval would otherwise close over stale
  // values.
  const cursorsRef = useRef<(string | undefined)[]>([undefined]);
  const pageRef = useRef(1);
  // Bumped by every user-driven load; a response only applies if it is still
  // the latest, so a slow request can't overwrite a newer page.
  const requestSeqRef = useRef(0);
  const userLoadInFlightRef = useRef(false);

  // Safe even when currentUser is temporarily null — hooks must always be called
  const userRecordId = currentUser?.id ?? '';
  const showManagerView = isManager && !isProxying;

  // For Pros (autoLoad=false on the provider), trigger reps load once.
  // Managers already get reps via the provider's autoLoad=true.
  // The provider guards against concurrent fetches so this is safe.
  useEffect(() => {
    if (pros.length === 0) loadReps();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const getEffectiveStatus = (bucket: string, subStatus: string): string | undefined => {
    if (bucket === 'all') return undefined;
    if (subStatus !== 'all') return subStatus;
    return bucket;
  };

  const statusBuckets = [
    { value: 'all', label: 'All Active' },
    { value: 'NEW', label: 'New' },
    { value: 'IN-PROGRESS', label: 'In Progress' },
  ];

  const subStatuses = SUB_STATUSES[selectedStatus] ?? [];
  const hasSubStatuses = subStatuses.length > 0;

  const loadLeads = async (
    status?: string,
    search?: string,
    isAutoRefresh: boolean = false,
    currentSelectedLead?: Lead | null,
    page: number = 1
  ) => {
    // We only hold a cursor for pages we've already walked to; anything else
    // restarts from page 1.
    const targetPage = page > 1 && cursorsRef.current[page - 1] === undefined ? 1 : page;
    // Auto-refresh never supersedes a user-driven load.
    const requestSeq = isAutoRefresh ? requestSeqRef.current : ++requestSeqRef.current;

    try {
      if (!isAutoRefresh) {
        userLoadInFlightRef.current = true;
        setLoading(true);
      }

      const result = await getLeads({
        status: status || undefined,
        assignedPro: !showManagerView && userRecordId ? userRecordId : undefined,
        search: search && search.trim() ? search.trim() : undefined,
        unassignedOnly: false,
        offset: cursorsRef.current[targetPage - 1],
        limit: RECORDS_PER_PAGE,
      });

      if (requestSeq !== requestSeqRef.current) return;

      // The page emptied out (e.g. its last lead was just closed): step back.
      if (result.leads.length === 0 && targetPage > 1) {
        return loadLeads(status, search, isAutoRefresh, currentSelectedLead, targetPage - 1);
      }

      // Keep cursors up to this page and record the one for the next.
      cursorsRef.current = cursorsRef.current.slice(0, targetPage);
      cursorsRef.current[targetPage] = result.offset;
      pageRef.current = targetPage;

      setLeads(result.leads);
      setCurrentPage(targetPage);
      setHasMore(result.hasMore);
      setTotalCount(result.totalCount ?? null);
      setLastRefreshTime(new Date());

      // Keep the selected lead in sync if the dialog is open
      const openLead = currentSelectedLead ?? selectedLead;
      if (openLead) {
        const fresh = result.leads.find(l => l.id === openLead.id);
        if (fresh) setSelectedLead(fresh);
      }
    } catch (error) {
      console.error('Error loading leads:', error);
      if (!isAutoRefresh && requestSeq === requestSeqRef.current) toast.error('Failed to load leads');
    } finally {
      if (!isAutoRefresh && requestSeq === requestSeqRef.current) {
        userLoadInFlightRef.current = false;
        setLoading(false);
      }
    }
  };

  // Optimistic update: a lead was changed inside the detail dialog
  // Update the table row immediately without waiting for a full reload
  const handleLeadUpdated = (updatedLead: Lead) => {
    const isNowClosed = updatedLead.status?.startsWith('CLOSED');
    if (isNowClosed) {
      // Remove from active leads list and close the dialog
      setLeads(prev => prev.filter(l => l.id !== updatedLead.id));
      setShowLeadDetails(false);
      setSelectedLead(null);
    } else {
      setLeads(prev => prev.map(l => l.id === updatedLead.id ? updatedLead : l));
      setSelectedLead(updatedLead);
    }
  };

  const startAutoRefresh = () => {
    if (autoRefreshRef.current) clearInterval(autoRefreshRef.current);
    autoRefreshRef.current = window.setInterval(() => {
      if (autoRefreshEnabled && !isUserInteractingRef.current && !showLeadDetails && !userLoadInFlightRef.current) {
        const effectiveStatus = getEffectiveStatus(selectedStatus, selectedSubStatus);
        loadLeads(effectiveStatus, debouncedSearchTerm, true, undefined, pageRef.current);
      }
    }, AUTO_REFRESH_INTERVAL);
  };

  const stopAutoRefresh = () => {
    if (autoRefreshRef.current) {
      window.clearInterval(autoRefreshRef.current);
      autoRefreshRef.current = null;
    }
  };

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearchTerm(searchTerm), 500);
    return () => clearTimeout(timer);
  }, [searchTerm]);

  useEffect(() => {
    isUserInteractingRef.current = true;
    const effectiveStatus = getEffectiveStatus(selectedStatus, selectedSubStatus);
    loadLeads(effectiveStatus, debouncedSearchTerm, false);
    setTimeout(() => { isUserInteractingRef.current = false; }, 2000);
  }, [debouncedSearchTerm]);

  useEffect(() => {
    loadLeads(undefined, debouncedSearchTerm, false);
  }, [userRecordId, showManagerView, isProxying]);

  useEffect(() => {
    if (autoRefreshEnabled) {
      startAutoRefresh();
    } else {
      stopAutoRefresh();
    }
    return () => stopAutoRefresh();
  }, [autoRefreshEnabled, selectedStatus, selectedSubStatus, debouncedSearchTerm, showLeadDetails]);

  const handleEditLead = (lead: Lead) => {
    if (!showManagerView && lead.assignedPro && !lead.assignedPro.includes(userRecordId || '')) {
      toast.error('Access denied. You can only view your assigned leads.');
      return;
    }
    setSelectedLead(lead);
    setShowLeadDetails(true);
  };

  const debouncedStatusFilter = useDebouncedCallback((bucket: string, subStatus: string) => {
    isUserInteractingRef.current = true;
    const effectiveStatus = getEffectiveStatus(bucket, subStatus);
    loadLeads(effectiveStatus, debouncedSearchTerm, false);
    setTimeout(() => { isUserInteractingRef.current = false; }, 2000);
  }, STATUS_DEBOUNCE_MS);

  const handleBucketFilter = (bucket: string) => {
    setSelectedStatus(bucket);
    setSelectedSubStatus('all');
    debouncedStatusFilter(bucket, 'all');
  };

  const handleSubStatusFilter = (subStatus: string) => {
    setSelectedSubStatus(subStatus);
    isUserInteractingRef.current = true;
    const effectiveStatus = getEffectiveStatus(selectedStatus, subStatus);
    loadLeads(effectiveStatus, debouncedSearchTerm, false);
    setTimeout(() => { isUserInteractingRef.current = false; }, 2000);
  };

  const handleRefresh = () => {
    const effectiveStatus = getEffectiveStatus(selectedStatus, selectedSubStatus);
    loadLeads(effectiveStatus, debouncedSearchTerm, false, undefined, pageRef.current);
  };

  const handlePageChange = (page: number) => {
    const effectiveStatus = getEffectiveStatus(selectedStatus, selectedSubStatus);
    loadLeads(effectiveStatus, debouncedSearchTerm, false, undefined, page);
  };

  const toggleAutoRefresh = () => {
    setAutoRefreshEnabled(prev => {
      toast.success(prev ? 'Auto-refresh disabled' : 'Auto-refresh enabled');
      return !prev;
    });
  };

  if (!currentUser) return null;

  return (
    <div className="space-y-3">
      {/* Primary bucket filter row */}
      <div className="flex items-center gap-2 -mx-4 sm:-mx-6 px-4 sm:px-6">
        <span className="text-sm font-medium text-muted-foreground shrink-0">Filter:</span>
        <div className="filter-scroll">
          {statusBuckets.map(bucket => (
            <button
              key={bucket.value}
              onClick={() => handleBucketFilter(bucket.value)}
              disabled={statusLoading}
              className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors border shrink-0 ${
                selectedStatus === bucket.value
                  ? 'bg-primary text-primary-foreground border-primary'
                  : 'bg-card text-card-foreground border-border hover:bg-muted'
              }`}
            >
              {bucket.label}
            </button>
          ))}
        </div>
      </div>

      {/* Sub-status filter row */}
      {hasSubStatuses && (
        <div className="flex items-center gap-2 -mx-4 sm:-mx-6 px-4 sm:px-6 pl-6 sm:pl-8">
          <span className="text-xs font-medium text-muted-foreground shrink-0">↳</span>
          <div className="filter-scroll">
            <button
              onClick={() => handleSubStatusFilter('all')}
              className={`px-2.5 py-1 rounded-full text-xs font-medium transition-colors border shrink-0 ${
                selectedSubStatus === 'all'
                  ? 'bg-foreground text-background border-foreground'
                  : 'bg-muted/50 text-muted-foreground border-border hover:bg-muted hover:text-foreground'
              }`}
            >
              {BUCKET_ALL_LABELS[selectedStatus]}
            </button>
            {subStatuses.map(sub => (
              <button
                key={sub.value}
                onClick={() => handleSubStatusFilter(sub.value)}
                className={`px-2.5 py-1 rounded-full text-xs font-medium transition-colors border shrink-0 ${
                  selectedSubStatus === sub.value
                    ? 'bg-foreground text-background border-foreground'
                    : 'bg-muted/50 text-muted-foreground border-border hover:bg-muted hover:text-foreground'
                }`}
              >
                {sub.label}
              </button>
            ))}
          </div>
        </div>
      )}

      {loading ? (
        <LeadsTableSkeleton />
      ) : (
        <LeadsTable
          leads={leads}
          pros={pros}
          loading={loading}
          onEditLead={handleEditLead}
          onRefresh={handleRefresh}
          onSearch={(s) => setSearchTerm(s)}
          searchTerm={searchTerm}
          isManager={showManagerView}
          currentPage={currentPage}
          totalPages={hasMore ? currentPage + 1 : currentPage}
          hasMore={hasMore}
          onPageChange={handlePageChange}
          recordsPerPage={RECORDS_PER_PAGE}
          autoRefreshEnabled={autoRefreshEnabled}
          onToggleAutoRefresh={toggleAutoRefresh}
          lastRefreshTime={lastRefreshTime}
          totalCount={totalCount}
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
