import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@project/components/ui/card';
import { Badge } from '@project/components/ui/badge';
import { Button } from '@project/components/ui/button';
import { Alert, AlertDescription } from '@project/components/ui/alert';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@project/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@project/components/ui/table';
import { DollarSign, Calendar, User, Trash2, AlertCircle, Filter, ArrowUpDown, Calculator, ExternalLink, RefreshCw, ChevronLeft, ChevronRight, Loader2, Pause, Play, Clock, FileSearch } from 'lucide-react';
import { Skeleton } from '@project/components/ui/skeleton';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@project/components/ui/alert-dialog';
import { toast } from 'sonner';
import { getCompensation, getRunningTotals, deleteCompensation, GetCompensationOutputType, GetRunningTotalsOutputType, GetRepsOutputType } from '@/lib/api';
import { logAuditEvent } from '../utils/auditLogger';
import { formatLastRefreshTime } from '../utils/formatters';
import { useProxy } from '../contexts/ProxyContext';
import { useReps } from '../contexts/RepsContext';
import EmptyState from './EmptyState';

type CompensationRecord = GetCompensationOutputType['compensationRecords'][0];
type SalesRep = GetRepsOutputType['pros'][0];

interface CompensationTabProps {
  isManager: boolean;
}

type SortOption = 'date-newest' | 'date-oldest' | 'amount-highest' | 'amount-lowest';

const RECORDS_PER_PAGE = 25;
const AUTO_REFRESH_INTERVAL = 120000;
const CACHE_DURATION = 60000;

interface CacheItem<T> { data: T; timestamp: number; key: string; }
class DataCache {
  private cache = new Map<string, CacheItem<any>>();
  set<T>(key: string, data: T): void { this.cache.set(key, { data, timestamp: Date.now(), key }); }
  get<T>(key: string, maxAge: number = CACHE_DURATION): T | null {
    const item = this.cache.get(key);
    if (!item) return null;
    if (Date.now() - item.timestamp > maxAge) { this.cache.delete(key); return null; }
    return item.data as T;
  }
  clear(): void { this.cache.clear(); }
  delete(key: string): void { this.cache.delete(key); }
}
const dataCache = new DataCache();

const formatCurrency = (amount: number | undefined) => {
  if (amount == null) return '$0.00';
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount);
};

const formatDate = (dateString: any) => {
  if (!dateString) return '—';
  try { return new Date(dateString).toLocaleDateString(); } catch { return '—'; }
};

/** One-line description that expands on click, but only when it is actually cut off. */
function ExpandableDetails({ text }: { text: string }) {
  const ref = useRef<HTMLButtonElement>(null);
  const [expanded, setExpanded] = useState(false);
  const [truncated, setTruncated] = useState(false);

  // Measure while collapsed; once expanded there is nothing left to measure.
  useEffect(() => {
    const el = ref.current;
    if (el && !expanded) setTruncated(el.scrollWidth > el.clientWidth);
  }, [text, expanded]);

  const canToggle = truncated || expanded;

  return (
    <button
      ref={ref}
      type="button"
      onClick={() => canToggle && setExpanded(e => !e)}
      aria-expanded={canToggle ? expanded : undefined}
      title={canToggle && !expanded ? 'Click to expand' : undefined}
      className={`block text-left text-xs text-muted-foreground mt-0.5 max-w-[280px] ${
        expanded ? 'whitespace-pre-wrap break-words' : 'truncate'
      } ${canToggle ? 'cursor-pointer hover:text-foreground' : 'cursor-default'}`}
    >
      {text}
    </button>
  );
}

export default function CompensationTab({ isManager }: CompensationTabProps) {
  const { currentUser, isProxying } = useProxy();
  const { pros: salesReps } = useReps();

  const [compensationRecords, setCompensationRecords] = useState<CompensationRecord[]>([]);
  const [runningTotals, setRunningTotals] = useState<GetRunningTotalsOutputType | null>(null);
  const [runningTotalError, setRunningTotalError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingRunningTotal, setLoadingRunningTotal] = useState(false);
  const [loadingRecords, setLoadingRecords] = useState(false);
  const [deletingRecords, setDeletingRecords] = useState<Set<string>>(new Set());
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [autoRefreshEnabled, setAutoRefreshEnabled] = useState(true);
  const [lastRefreshTime, setLastRefreshTime] = useState<Date | null>(null);
  const [criticalError, setCriticalError] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalRecords, setTotalRecords] = useState(0);
  const [selectedRepId, setSelectedRepId] = useState<string>('all');
  const [sortOption, setSortOption] = useState<SortOption>('date-newest');

  const autoRefreshRef = useRef<number | null>(null);
  const isUserInteractingRef = useRef(false);
  const showManagerView = isManager && !isProxying;

  const loadRunningTotals = useCallback(async (repId?: string) => {
    try {
      setLoadingRunningTotal(true);
      setRunningTotalError(null);
      const cacheKey = `runningTotals_${repId || 'all'}`;
      const cached = dataCache.get<GetRunningTotalsOutputType>(cacheKey);
      if (cached) { setRunningTotals(cached); setLoadingRunningTotal(false); return; }
      const requestParams: { repIds?: string[] } = {};
      if (showManagerView && repId && repId !== 'all') requestParams.repIds = [repId];
      const totalsResult = await getRunningTotals(requestParams);
      setRunningTotals(totalsResult);
      dataCache.set(cacheKey, totalsResult);
    } catch (error) {
      console.error('Error loading running totals:', error);
      setRunningTotalError('Failed to load running totals');
      setRunningTotals(null);
    } finally {
      setLoadingRunningTotal(false);
    }
  }, [showManagerView]);

  const loadCompensationRecords = useCallback(async (page: number = 1, pageSize: number = RECORDS_PER_PAGE) => {
    try {
      setLoadingRecords(true);
      const offset = (page - 1) * pageSize;
      const result = await getCompensation({
        repId: showManagerView ? (selectedRepId === 'all' ? undefined : selectedRepId) : undefined,
        offset: offset.toString(),
        limit: pageSize,
      });
      return result;
    } catch (error) {
      console.error('Error loading compensation records:', error);
      throw error;
    } finally {
      setLoadingRecords(false);
    }
  }, [showManagerView, selectedRepId]);

  const loadCompensationData = useCallback(async (page: number = 1, isAutoRefresh: boolean = false) => {
    try {
      if (!isAutoRefresh) setLoading(true);
      const [recordsResult] = await Promise.all([
        loadCompensationRecords(page),
        loadRunningTotals(selectedRepId),
      ]);
      if (recordsResult) {
        setCompensationRecords(recordsResult.compensationRecords);
        setTotalRecords(recordsResult.compensationRecords.length);
      }
      setCurrentPage(page);
      setLastRefreshTime(new Date());
    } catch (error) {
      console.error('Error loading compensation data:', error);
      if (!isAutoRefresh) toast.error('Failed to load compensation data');
    } finally {
      if (!isAutoRefresh) setLoading(false);
    }
  }, [loadCompensationRecords, loadRunningTotals, selectedRepId]);

  const startAutoRefresh = useCallback(() => {
    if (autoRefreshRef.current) window.clearInterval(autoRefreshRef.current);
    autoRefreshRef.current = window.setInterval(() => {
      if (autoRefreshEnabled && !isUserInteractingRef.current) {
        dataCache.clear();
        loadCompensationData(currentPage, true);
      }
    }, AUTO_REFRESH_INTERVAL);
  }, [autoRefreshEnabled, currentPage, loadCompensationData]);

  const stopAutoRefresh = useCallback(() => {
    if (autoRefreshRef.current) { window.clearInterval(autoRefreshRef.current); autoRefreshRef.current = null; }
  }, []);

  useEffect(() => {
    if (autoRefreshEnabled) startAutoRefresh(); else stopAutoRefresh();
    return () => stopAutoRefresh();
  }, [autoRefreshEnabled, startAutoRefresh, stopAutoRefresh]);

  useEffect(() => {
    const initializeData = async () => {
      try {
        setCriticalError(null);
        await loadCompensationData();
      } catch (error) {
        console.error('Critical error:', error);
        setCriticalError(`Failed to initialize compensation data: ${error instanceof Error ? error.message : 'Unknown error'}`);
        setLoading(false);
      }
    };
    if (currentUser) initializeData();
  }, [currentUser, showManagerView, isProxying, loadCompensationData]);

  const toggleAutoRefresh = () => {
    setAutoRefreshEnabled(prev => { toast.success(prev ? 'Auto-refresh disabled' : 'Auto-refresh enabled'); return !prev; });
  };

  const handleDeleteRecord = async (recordId: string) => {
    try {
      setDeletingRecords(prev => new Set(prev).add(recordId));
      const deletedRecord = compensationRecords.find(r => r.id === recordId);
      setCompensationRecords(prev => prev.filter(r => r.id !== recordId));

      await deleteCompensation({ recordId });

      if (deletedRecord && runningTotals && deletedRecord.shxCompensationTotal) {
        setRunningTotals(prev => prev ? {
          ...prev,
          grandTotal: prev.grandTotal - (deletedRecord.shxCompensationTotal || 0),
          totals: prev.totals.map(total => {
            const matchingRep = compensationRecords.find(r => (Array.isArray(r.shxEmail) ? r.shxEmail[0] : r.shxEmail) === total.repEmail);
            if (matchingRep) return { ...total, runningCompTotal: total.runningCompTotal - (deletedRecord.shxCompensationTotal || 0) };
            return total;
          }),
        } : null);
      }
      setTotalRecords(prev => Math.max(0, prev - 1));
      dataCache.clear();
      toast.success('Record deleted');

      await logAuditEvent({
        userEmail: currentUser?.email ?? '',
        userName: currentUser?.displayName || currentUser?.proName || '',
        action: 'Delete Compensation',
        details: `Deleted compensation record: ${recordId}`,
      });
    } catch (error) {
      console.error('Error deleting:', error);
      loadCompensationData(currentPage);
      toast.error('Failed to delete record');
    } finally {
      setDeletingRecords(prev => { const s = new Set(prev); s.delete(recordId); return s; });
      setDeleteConfirmId(null);
    }
  };

  const handleRefresh = async () => { dataCache.clear(); await loadCompensationData(currentPage); };

  const handlePageChange = async (newPage: number) => {
    isUserInteractingRef.current = true;
    await loadCompensationData(newPage);
    setTimeout(() => { isUserInteractingRef.current = false; }, 2000);
  };

  const handleFilterChange = async (newRepId: string) => {
    isUserInteractingRef.current = true;
    setSelectedRepId(newRepId);
    dataCache.delete(`runningTotals_${newRepId === 'all' ? 'all' : newRepId}`);
    if (showManagerView) {
      setLoading(true);
      try {
        const [recordsResult] = await Promise.all([
          getCompensation({ repId: newRepId === 'all' ? undefined : newRepId, offset: '0', limit: RECORDS_PER_PAGE }),
          loadRunningTotals(newRepId),
        ]);
        setCompensationRecords(recordsResult.compensationRecords);
        setTotalRecords(recordsResult.compensationRecords.length);
        setCurrentPage(1);
      } catch {
        toast.error('Failed to filter compensation data');
      } finally {
        setLoading(false);
      }
    }
    setTimeout(() => { isUserInteractingRef.current = false; }, 2000);
  };

  const filteredAndSortedRecords = useMemo(() => {
    return [...compensationRecords].sort((a, b) => {
      switch (sortOption) {
        case 'date-newest': return new Date(b.createdTime || 0).getTime() - new Date(a.createdTime || 0).getTime();
        case 'date-oldest': return new Date(a.createdTime || 0).getTime() - new Date(b.createdTime || 0).getTime();
        case 'amount-highest': return (b.shxCompensationTotal || 0) - (a.shxCompensationTotal || 0);
        case 'amount-lowest': return (a.shxCompensationTotal || 0) - (b.shxCompensationTotal || 0);
        default: return 0;
      }
    });
  }, [compensationRecords, sortOption]);

  const totalPages = Math.ceil(totalRecords / RECORDS_PER_PAGE);

  // ── Guards ──
  if (!currentUser) {
    return <div className="space-y-4"><EmptyState icon={DollarSign} title="Loading user information..." description="Please wait while we fetch your details." /></div>;
  }

  if (criticalError) {
    return (
      <div className="space-y-4">
        <Alert className="border-destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            <strong>Critical Error:</strong><br />{criticalError}<br />
            <Button variant="outline" size="sm" className="mt-2" onClick={() => {
              setCriticalError(null); setLoading(true);
              loadCompensationData().catch(err => setCriticalError(`Retry failed: ${err instanceof Error ? err.message : 'Unknown'}`));
            }}>Retry</Button>
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Skeleton className="h-28 rounded-lg" />
          <Skeleton className="h-28 rounded-lg" />
        </div>
        <Skeleton className="h-96 rounded-lg" />
      </div>
    );
  }

  // Running total display value
  const runningTotalValue = runningTotals
    ? showManagerView && selectedRepId === 'all'
      ? formatCurrency(runningTotals.grandTotal)
      : showManagerView && selectedRepId !== 'all'
      ? formatCurrency(runningTotals.totals.find(t => t.repId === selectedRepId)?.runningCompTotal || 0)
      : formatCurrency(runningTotals.totals[0]?.runningCompTotal || 0)
    : null;

  const runningTotalLabel = runningTotals
    ? showManagerView && selectedRepId === 'all'
      ? 'All Pros'
      : showManagerView && selectedRepId !== 'all'
      ? runningTotals.totals.find(t => t.repId === selectedRepId)?.repName || 'Selected Rep'
      : runningTotals.totals[0]?.repName || 'Your Total'
    : null;

  return (
    <div className="space-y-4">
      {/* Summary row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {/* Running Total */}
        <Card className="shadow-premium">
          <CardContent className="p-5">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-sm font-medium text-muted-foreground mb-1">Running Total</p>
                {loadingRunningTotal ? (
                  <Skeleton className="h-9 w-32" />
                ) : runningTotalValue ? (
                  <>
                    <p className="text-3xl font-bold text-foreground tabular-nums">{runningTotalValue}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">{runningTotalLabel}</p>
                  </>
                ) : (
                  <p className="text-xl font-semibold text-muted-foreground">Not Available</p>
                )}
              </div>
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10">
                <DollarSign className="h-5 w-5 text-primary" />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Calculator link */}
        <Card className="shadow-premium">
          <CardContent className="p-5 flex flex-col justify-between h-full">
            <div>
              <p className="text-sm font-medium text-muted-foreground mb-1">Compensation Calculator</p>
              <p className="text-xs text-muted-foreground">Calculate expected compensation for any deal.</p>
            </div>
            <Button
              onClick={() => window.open('https://ashleylmartin.github.io/shx-comp-calc/', '_blank')}
              variant="outline"
              size="sm"
              className="mt-3 self-start"
            >
              <Calculator className="h-3.5 w-3.5 mr-1.5" />
              Open Calculator
              <ExternalLink className="h-3 w-3 ml-1.5" />
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* Records table card */}
      <Card className="shadow-premium">
        <CardHeader className="border-b border-border px-5 py-4">
          <div className="flex items-center justify-between gap-2 mb-3">
            <CardTitle className="font-bold text-lg">
              {showManagerView ? 'All Compensation' : 'My Compensation'}
            </CardTitle>
            <div className="flex items-center gap-2 shrink-0">
              {lastRefreshTime && (
                <span className="hidden md:flex items-center gap-1.5 text-xs text-muted-foreground mr-1">
                  <Clock className="h-3 w-3" />
                  {formatLastRefreshTime(lastRefreshTime)}
                </span>
              )}
              <Button onClick={toggleAutoRefresh} variant={autoRefreshEnabled ? 'default' : 'outline'} size="sm" className="h-8 gap-1.5 text-xs">
                {autoRefreshEnabled ? <Pause className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5" />}
                <span className="hidden sm:inline">Auto</span>
              </Button>
              <Button onClick={handleRefresh} variant="outline" size="sm" disabled={loading || loadingRecords} className="h-8 gap-1.5 text-xs">
                <RefreshCw className={`h-3.5 w-3.5 ${loading || loadingRecords ? 'animate-spin' : ''}`} />
                <span className="hidden sm:inline">Refresh</span>
              </Button>
            </div>
          </div>

          {/* Filters */}
          <div className="flex flex-wrap items-center gap-2">
            {showManagerView && (
              <Select value={selectedRepId} onValueChange={handleFilterChange}>
                <SelectTrigger className="w-48 h-9 text-sm">
                  <div className="flex items-center gap-1.5">
                    <Filter className="h-3.5 w-3.5 text-muted-foreground" />
                    <SelectValue placeholder="All Users" />
                  </div>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Users</SelectItem>
                  {salesReps.map(rep => (
                    <SelectItem key={rep.id} value={rep.id}>
                      {rep.proName || rep.displayName || 'Unknown'}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
            <Select value={sortOption} onValueChange={(value: SortOption) => setSortOption(value)}>
              <SelectTrigger className="w-48 h-9 text-sm">
                <div className="flex items-center gap-1.5">
                  <ArrowUpDown className="h-3.5 w-3.5 text-muted-foreground" />
                  <SelectValue placeholder="Sort by" />
                </div>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="date-newest">Date (Newest)</SelectItem>
                <SelectItem value="date-oldest">Date (Oldest)</SelectItem>
                <SelectItem value="amount-highest">Amount (Highest)</SelectItem>
                <SelectItem value="amount-lowest">Amount (Lowest)</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {runningTotalError && (
            <Alert className="mt-3">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription className="flex items-center justify-between gap-4">
                <span>Unable to load running total.</span>
                <Button variant="outline" size="sm" onClick={() => loadRunningTotals()}>Retry</Button>
              </AlertDescription>
            </Alert>
          )}
        </CardHeader>

        <CardContent className="p-0">
          {loadingRecords ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
              <span className="ml-2 text-sm text-muted-foreground">Loading records…</span>
            </div>
          ) : filteredAndSortedRecords.length === 0 ? (
            <div className="py-8">
              <EmptyState
                icon={FileSearch}
                title="No compensation records"
                description={compensationRecords.length === 0 ? "You don't have any compensation records yet." : "No records match the current filters."}
              />
            </div>
          ) : (
            <>
              {/* Desktop table */}
              <div className="hidden md:block">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/40 hover:bg-muted/40">
                      <TableHead className="text-xs font-semibold uppercase tracking-wide text-muted-foreground h-10 px-4 pl-6">Customer</TableHead>
                      <TableHead className="text-xs font-semibold uppercase tracking-wide text-muted-foreground h-10 px-4">Rep</TableHead>
                      <TableHead className="text-xs font-semibold uppercase tracking-wide text-muted-foreground h-10 px-4">Date</TableHead>
                      <TableHead className="text-xs font-semibold uppercase tracking-wide text-muted-foreground h-10 px-4 text-right">Amount</TableHead>
                      <TableHead className="text-xs font-semibold uppercase tracking-wide text-muted-foreground h-10 px-4 pr-6 w-16"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredAndSortedRecords.map(record => (
                      <TableRow key={record.id} className="hover:bg-muted/30 transition-colors">
                        <TableCell className="py-3 px-4 pl-6">
                          <div className="font-medium text-foreground">{record.customerName || 'Unknown'}</div>
                          {record.compensationDetails && (
                            <ExpandableDetails text={record.compensationDetails} />
                          )}
                        </TableCell>
                        <TableCell className="py-3 px-4">
                          <div className="text-sm">{record.shxName || '—'}</div>
                          <div className="text-xs text-muted-foreground">
                            <Badge variant="outline" className="text-[10px] px-1.5 py-0 font-normal">#{record.badgeId}</Badge>
                          </div>
                        </TableCell>
                        <TableCell className="py-3 px-4">
                          <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                            <Calendar className="h-3 w-3" />
                            {formatDate(record.createdTime)}
                          </div>
                        </TableCell>
                        <TableCell className="py-3 px-4 text-right">
                          <span className="text-base font-semibold text-foreground tabular-nums">
                            {formatCurrency(record.shxCompensationTotal)}
                          </span>
                        </TableCell>
                        <TableCell className="py-3 px-4 pr-6">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setDeleteConfirmId(record.id)}
                            disabled={deletingRecords.has(record.id)}
                            className="h-8 w-8 p-0 text-muted-foreground hover:text-destructive"
                          >
                            {deletingRecords.has(record.id)
                              ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                              : <Trash2 className="h-3.5 w-3.5" />}
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              {/* Mobile cards */}
              <div className="md:hidden divide-y divide-border">
                {filteredAndSortedRecords.map(record => (
                  <div key={record.id} className="p-4 space-y-2">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <p className="font-medium text-foreground truncate">{record.customerName || 'Unknown'}</p>
                        <p className="text-xs text-muted-foreground mt-0.5">{record.shxName || `Badge #${record.badgeId}`}</p>
                      </div>
                      <span className="text-base font-semibold text-foreground tabular-nums shrink-0">
                        {formatCurrency(record.shxCompensationTotal)}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-muted-foreground flex items-center gap-1">
                        <Calendar className="h-3 w-3" />
                        {formatDate(record.createdTime)}
                      </span>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setDeleteConfirmId(record.id)}
                        disabled={deletingRecords.has(record.id)}
                        className="h-7 w-7 p-0 text-muted-foreground hover:text-destructive"
                      >
                        {deletingRecords.has(record.id) ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
                      </Button>
                    </div>
                    {record.compensationDetails && (
                      <p className="text-xs text-muted-foreground bg-muted/50 rounded px-2.5 py-1.5">{record.compensationDetails}</p>
                    )}
                  </div>
                ))}
              </div>

              {/* Pagination */}
              {filteredAndSortedRecords.length > 0 && (
                <div className="flex items-center justify-between px-6 py-3 border-t border-border">
                  <span className="text-xs text-muted-foreground">
                    {filteredAndSortedRecords.length} record{filteredAndSortedRecords.length !== 1 ? 's' : ''}
                  </span>
                  {totalPages > 1 && (
                    <div className="flex items-center gap-1.5">
                      <Button variant="outline" size="sm" onClick={() => handlePageChange(currentPage - 1)} disabled={currentPage === 1 || loadingRecords} className="h-8 px-2">
                        <ChevronLeft className="h-4 w-4" />
                      </Button>
                      <span className="text-xs font-medium px-2 tabular-nums">Page {currentPage} of {totalPages}</span>
                      <Button variant="outline" size="sm" onClick={() => handlePageChange(currentPage + 1)} disabled={currentPage === totalPages || loadingRecords} className="h-8 px-2">
                        <ChevronRight className="h-4 w-4" />
                      </Button>
                    </div>
                  )}
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>

      {/* Delete confirmation */}
      <AlertDialog open={!!deleteConfirmId} onOpenChange={(open) => { if (!open) setDeleteConfirmId(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Compensation Record</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete this compensation record. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteConfirmId && handleDeleteRecord(deleteConfirmId)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
