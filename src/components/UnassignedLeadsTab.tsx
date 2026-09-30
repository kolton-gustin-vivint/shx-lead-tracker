import React, { useState, useEffect, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@project/components/ui/card';
import { Button } from '@project/components/ui/button';
import { Skeleton } from '@project/components/ui/skeleton';
import { AlertCircle, Users, TrendingUp } from 'lucide-react';
import { toast } from 'sonner';
import LeadsTable from './LeadsTable';
import LeadDetails from './LeadDetails';
import { getLeads, getLeadCount, GetLeadsOutputType, GetRepsOutputType } from '@/lib/api';
import { useReps } from '../contexts/RepsContext';
type Lead = GetLeadsOutputType['leads'][0];
type Pro = GetRepsOutputType['pros'][0];
interface User {
  id: string;
  email: string;
  proId?: string;
  proName: string;
  displayName: string;
  role: string;
}
interface UnassignedLeadsTabProps {
  user: User;
  isManager: boolean;
}
export default function UnassignedLeadsTab({
  user,
  isManager
}: UnassignedLeadsTabProps) {
  const { pros } = useReps();
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const [showLeadDetails, setShowLeadDetails] = useState(false);
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null);

  // Server-side pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  // Airtable cursors only move forward, so keep the cursor used to fetch each
  // page: cursorsRef[n] fetches page n + 1. That is what lets Previous work.
  const cursorsRef = useRef<(string | undefined)[]>([undefined]);
  const [totalCount, setTotalCount] = useState<number | null>(null);

  // Stats state
  const [unassignedCount, setUnassignedCount] = useState(0);
  const [assignedCount, setAssignedCount] = useState(0);
  const [searchTerm, setSearchTerm] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [statsLoading, setStatsLoading] = useState(false);
  const RECORDS_PER_PAGE = 50;

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(searchTerm), 500);
    return () => clearTimeout(timer);
  }, [searchTerm]);

  useEffect(() => {
    if (!isManager) return;
    setCurrentPage(1);
    loadUnassignedLeads(1, undefined, debouncedSearch);
  }, [debouncedSearch]);

  const loadUnassignedLeads = async (requestedPage: number = 1, _unused?: any, search?: string) => {
    // We only hold a cursor for pages we've already walked to; anything else
    // restarts from page 1.
    const page = requestedPage > 1 && cursorsRef.current[requestedPage - 1] === undefined ? 1 : requestedPage;
    try {
      setLoading(true);

      const requestParams = {
        unassignedOnly: true,
        offset: cursorsRef.current[page - 1],
        limit: RECORDS_PER_PAGE,
        search: search && search.trim() ? search.trim() : undefined,
      };

      // Fetch leads and total count in parallel
      const [leadsResult, countResult] = await Promise.all([getLeads(requestParams), getLeadCount({
        unassignedOnly: true
      })]);
      // Keep cursors up to this page and record the one for the next.
      cursorsRef.current = cursorsRef.current.slice(0, page);
      cursorsRef.current[page] = leadsResult.offset;

      setLeads(leadsResult.leads);
      setHasMore(leadsResult.hasMore);
      setCurrentPage(page);
      setTotalCount(countResult.totalCount);

      // Use the unassigned count we already have
      setUnassignedCount(countResult.totalCount);

      // Estimate total pages based on current page and hasMore
      if (leadsResult.hasMore) {
        setTotalPages(page + 1);
      } else {
        setTotalPages(page);
      }
    } catch (error) {
      console.error('Error loading unassigned leads:', error);
      toast.error('Failed to load unassigned leads');
    } finally {
      setLoading(false);
    }
  };

  // Lightweight stats loader — runs AFTER leads load to avoid rate limits.
  // Only fetches the total-leads count; unassigned count comes from loadUnassignedLeads.
  const loadAssignedCount = async () => {
    try {
      setStatsLoading(true);
      const totalResult = await getLeadCount({});
      setAssignedCount(totalResult.totalCount - unassignedCount);
    } catch (error) {
      console.error('Error loading assigned count:', error);
      // Non-critical — don't toast, stats card will just show 0
    } finally {
      setStatsLoading(false);
    }
  };
  useEffect(() => {
    if (isManager) {
      // Load leads first, then fetch assigned count after to avoid Airtable rate limits
      loadUnassignedLeads(1, undefined, '').then(() => {
        loadAssignedCount();
      });
    }
  }, [isManager]);
  const handleEditLead = (lead: Lead) => {
    setSelectedLead(lead);
    setShowLeadDetails(true);
  };
  const handlePageChange = (newPage: number) => {
    loadUnassignedLeads(newPage, undefined, debouncedSearch);
  };
  const handleRefresh = () => {
    setCurrentPage(1);
    loadUnassignedLeads(1, undefined, debouncedSearch).then(() => {
      loadAssignedCount();
    });
  };

  // Only show this tab for managers
  if (!isManager) {
    return <div className="flex items-center justify-center py-12">
        <div className="text-center">
          <AlertCircle className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
          <h3 className="text-lg font-semibold text-muted-foreground">Manager Access Required</h3>
          <p className="text-sm text-muted-foreground">Only managers can access unassigned leads.</p>
        </div>
      </div>;
  }
  return <div className="space-y-4">
      {/* Stats Cards */}
      <div className="grid grid-cols-2 gap-4">
        <Card>
          <CardContent className="flex items-center gap-3 p-4">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/10">
              <Users className="h-5 w-5 text-primary" />
            </div>
            <div>
              {statsLoading ? <Skeleton className="h-7 w-12 mb-1" /> : <p className="text-2xl font-bold tabular-nums">{unassignedCount}</p>}
              <p className="text-xs text-muted-foreground">Unassigned</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-3 p-4">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/10">
              <TrendingUp className="h-5 w-5 text-primary" />
            </div>
            <div>
              {statsLoading ? <Skeleton className="h-7 w-12 mb-1" /> : <p className="text-2xl font-bold tabular-nums">{assignedCount}</p>}
              <p className="text-xs text-muted-foreground">Assigned</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Instructions */}
      <div className="bg-[hsl(var(--status-new-bg))] border border-[hsl(var(--status-new))] rounded-lg p-4">
        <div className="flex items-start gap-3">
          <AlertCircle className="h-5 w-5 text-[hsl(var(--status-new))] mt-0.5" />
          <div>
            <h3 className='text-[hsl(var(--status-new-foreground))] font-bold text-base'>Assignment Workspace</h3>
            <p className="text-sm text-[hsl(var(--status-new-foreground))] mt-1">
              This tab shows leads that haven't been assigned to sales representatives. 
              Click on any lead to assign it to a rep or update its status.
            </p>
          </div>
        </div>
      </div>

      {/* Leads Table */}
      <LeadsTable leads={leads} pros={pros} loading={loading} onEditLead={handleEditLead} onRefresh={handleRefresh} onSearch={setSearchTerm}
    searchTerm={searchTerm} isManager={isManager} currentPage={currentPage} totalPages={totalPages} hasMore={hasMore} onPageChange={handlePageChange} recordsPerPage={RECORDS_PER_PAGE} autoRefreshEnabled={false}
    onToggleAutoRefresh={() => {}} lastRefreshTime={null} totalCount={totalCount} title="Unassigned Leads" hideAutoRefresh={true} />

      {/* Lead Details Modal */}
      {showLeadDetails && <LeadDetails lead={selectedLead} pros={pros} onClose={() => {
      setShowLeadDetails(false);
      setSelectedLead(null);
    }} onRefresh={handleRefresh} currentUser={user} />}
    </div>;
}
