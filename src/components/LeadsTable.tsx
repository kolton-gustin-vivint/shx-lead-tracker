import React, { useMemo } from 'react';
import { useReactTable, getCoreRowModel, getSortedRowModel, flexRender, ColumnDef, SortingState } from '@tanstack/react-table';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@project/components/ui/table';
import { Button } from '@project/components/ui/button';
import { Badge } from '@project/components/ui/badge';
import { Input } from '@project/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@project/components/ui/card';
import { ArrowUpDown, Edit, Phone, Mail, Calendar, User, ChevronLeft, ChevronRight, RefreshCw, Search, Pause, Play, Clock, FileSearch, MapPin, AlertTriangle } from 'lucide-react';
import { GetLeadsOutputType, GetRepsOutputType } from '@/lib/api';
import EmptyState from './EmptyState';
import { getStatusColorWithHover } from '../utils/statusColors';
import { formatLastRefreshTime, formatPhone, phoneHref } from '../utils/formatters';
type Lead = GetLeadsOutputType['leads'][0];
type Pro = GetRepsOutputType['pros'][0];
interface LeadsTableProps {
  leads: Lead[];
  pros: Pro[];
  loading: boolean;
  onEditLead: (lead: Lead) => void;
  onRefresh: () => void;
  onSearch: (searchTerm: string) => void;
  searchTerm: string;
  isManager: boolean;
  currentPage: number;
  totalPages: number;
  hasMore: boolean;
  onPageChange: (page: number) => void;
  recordsPerPage: number;
  autoRefreshEnabled: boolean;
  onToggleAutoRefresh: () => void;
  lastRefreshTime: Date | null;
  totalCount: number | null;
  title?: string;
  hideAutoRefresh?: boolean;
}
function getStalenessStyle(days?: number): {
  badge: string;
  label: string;
} | null {
  if (days === undefined || days === null) return null;
  if (days >= 14) return {
    badge: 'bg-[hsl(var(--status-closed-bg))] text-[hsl(var(--status-closed-foreground))]',
    label: `${days}d`
  };
  if (days >= 7) return {
    badge: 'bg-[hsl(var(--status-progress-bg))] text-[hsl(var(--status-progress-foreground))]',
    label: `${days}d`
  };
  return null;
}
export default function LeadsTable({
  leads,
  pros,
  loading,
  onEditLead,
  onRefresh,
  onSearch,
  searchTerm,
  isManager,
  currentPage,
  totalPages,
  hasMore,
  onPageChange,
  recordsPerPage,
  autoRefreshEnabled,
  onToggleAutoRefresh,
  lastRefreshTime,
  totalCount,
  title = 'Sales Leads',
  hideAutoRefresh = false
}: LeadsTableProps) {
  const [sorting, setSorting] = React.useState<SortingState>([{
    id: 'lastInteractionDate',
    desc: true
  }]);
  const getProName = (proIds?: string[]) => {
    if (!proIds || proIds.length === 0) return 'Unassigned';
    const pro = pros.find(p => proIds.includes(p.id));
    return pro?.displayName || pro?.proName || 'Unknown';
  };
  const columns = useMemo<ColumnDef<Lead>[]>(() => [{
    accessorKey: 'customerName',
    header: ({
      column
    }) => <Button variant="ghost" onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')} className={`h-auto p-0 ${column.getIsSorted() ? 'font-bold text-primary' : 'font-medium'}`}>
          Customer <ArrowUpDown className="ml-2 h-4 w-4" />
        </Button>,
    cell: ({
      row
    }) => <div className='space-y-0.5'>
          <div className="font-medium text-foreground">{row.original.customerName || 'N/A'}</div>
          <div className="text-xs text-muted-foreground">{row.original.opportunityName}</div>
        </div>
  }, {
    accessorKey: 'status',
    header: ({
      column
    }) => <Button variant="ghost" onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')} className={`h-auto p-0 ${column.getIsSorted() ? 'font-bold text-primary' : 'font-medium'}`}>
          Status <ArrowUpDown className="ml-2 h-4 w-4" />
        </Button>,
    cell: ({
      row
    }) => <Badge className={getStatusColorWithHover(row.original.status)}>
          {row.original.status || 'Unknown'}
        </Badge>
  }, {
    accessorKey: 'assignedPro',
    header: ({
      column
    }) => <Button variant="ghost" onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')} className={`h-auto p-0 ${column.getIsSorted() ? 'font-bold text-primary' : 'font-medium'}`}>
          Assigned Pro <ArrowUpDown className="ml-2 h-4 w-4" />
        </Button>,
    cell: ({
      row
    }) => <div className="flex items-center gap-2 text-sm">
          <User className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
          <span>{getProName(row.original.assignedPro)}</span>
        </div>,
    sortingFn: (rowA, rowB) => getProName(rowA.original.assignedPro).localeCompare(getProName(rowB.original.assignedPro))
  }, {
    accessorKey: 'customerCity',
    header: ({
      column
    }) => <Button variant="ghost" onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')} className={`h-auto p-0 ${column.getIsSorted() ? 'font-bold text-primary' : 'font-medium'}`}>
          Location <ArrowUpDown className="ml-2 h-4 w-4" />
        </Button>,
    cell: ({
      row
    }) => {
      const location = [row.original.customerCity, row.original.customerState].filter(Boolean).join(', ');
      return location ? <div className="flex items-center gap-2 text-sm">
            <MapPin className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
            <span>{location}</span>
          </div> : <span className="text-muted-foreground text-sm">—</span>;
    },
    sortingFn: (rowA, rowB) => {
      const a = [rowA.original.customerCity, rowA.original.customerState].filter(Boolean).join(', ');
      const b = [rowB.original.customerCity, rowB.original.customerState].filter(Boolean).join(', ');
      return a.localeCompare(b);
    }
  }, {
    id: 'contact',
    header: 'Contact',
    cell: ({
      row
    }) => <div className="space-y-1" onClick={e => e.stopPropagation()}>
          {row.original.customerPhone && <div className="flex items-center gap-2 text-sm">
              <Phone className="h-3 w-3 text-muted-foreground shrink-0" />
              <a href={`tel:${phoneHref(row.original.customerPhone)}`} className="text-primary hover:underline">
                {formatPhone(row.original.customerPhone)}
              </a>
            </div>}
          {row.original.customerEmail && <div className="flex items-center gap-2 text-sm">
              <Mail className="h-3 w-3 text-muted-foreground shrink-0" />
              <a href={`mailto:${row.original.customerEmail}`} className="text-primary hover:underline truncate max-w-[160px]">
                {row.original.customerEmail}
              </a>
            </div>}
        </div>
  }, {
    accessorKey: 'lastInteractionDate',
    header: ({
      column
    }) => <Button variant="ghost" onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')} className={`h-auto p-0 ${column.getIsSorted() ? 'font-bold text-primary' : 'font-medium'}`}>
          Last Contact <ArrowUpDown className="ml-2 h-4 w-4" />
        </Button>,
    cell: ({
      row
    }) => {
      const staleness = getStalenessStyle(row.original.daysSinceLastInteraction);
      return <div className="space-y-1">
            {row.original.lastInteractionDate && <div className="flex items-center gap-2 text-sm">
                <Calendar className="h-3 w-3 text-muted-foreground" />
                <span>{new Date(row.original.lastInteractionDate).toLocaleDateString()}</span>
              </div>}
            {row.original.daysSinceLastInteraction !== undefined && (staleness ? <div className="flex items-center gap-1">
                  <AlertTriangle className="h-3 w-3 text-[hsl(var(--status-progress-bg))]" />
                  <span className={`text-xs font-semibold px-1.5 py-0.5 rounded-full ${staleness.badge}`}>
                    {staleness.label} ago
                  </span>
                </div> : <div className="text-xs text-muted-foreground">{row.original.daysSinceLastInteraction}d ago</div>)}
          </div>;
    }
  }, {
    id: 'actions',
    header: '',
    cell: ({
      row
    }) => <Button variant="default" size="sm" onClick={e => {
      e.stopPropagation();
      onEditLead(row.original);
    }} className="h-8 px-3 text-xs font-medium">
          <Edit className="h-3.5 w-3.5 mr-1.5" />
          Open
        </Button>
  }], [pros, onEditLead]);
  const table = useReactTable({
    data: leads,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    onSortingChange: setSorting,
    state: {
      sorting
    },
    manualPagination: true
  });
  const tableRows = table.getRowModel().rows;
  const displayedLeadsCount = tableRows.length;
  const startRow = (currentPage - 1) * recordsPerPage + 1;
  const endRow = (currentPage - 1) * recordsPerPage + displayedLeadsCount;
  return <Card className="shadow-premium">
      {/* Table toolbar */}
      <CardHeader className='border-b border-border px-5 py-4'>
        {/* Title row */}
        <div className="flex items-center justify-between gap-2 mb-3">
          <CardTitle className='font-bold text-lg'>{title}</CardTitle>
          <div className="flex items-center gap-2 shrink-0">
            {lastRefreshTime && <span className='hidden md:flex items-center gap-1.5 text-xs text-muted-foreground mr-2.5'>
                <Clock className="h-3 w-3" />
                {formatLastRefreshTime(lastRefreshTime)}
              </span>}
            {!hideAutoRefresh && <Button onClick={onToggleAutoRefresh} variant={autoRefreshEnabled ? 'default' : 'outline'} size="sm" className="h-8 gap-1.5 text-xs">
                {autoRefreshEnabled ? <Pause className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5" />}
                <span className="hidden sm:inline">Auto</span>
              </Button>}
            <Button onClick={onRefresh} variant="outline" size="sm" disabled={loading} className="h-8 gap-1.5 text-xs">
              <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
              <span className="hidden sm:inline">Refresh</span>
            </Button>
          </div>
        </div>

        {/* Search row */}
        <div className="relative w-full sm:w-72">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
          <Input placeholder="Search leads..." value={searchTerm} onChange={e => onSearch(e.target.value)} className="pl-9 h-9 text-sm" />
        </div>
      </CardHeader>

      <CardContent className="p-0">
        {/* Desktop table */}
        <div className="hidden lg:block">
          <Table>
            <TableHeader>
              {table.getHeaderGroups().map(hg => <TableRow key={hg.id} className="bg-muted/40 hover:bg-muted/40">
                  {hg.headers.map((header, i) => <TableHead key={header.id} className={`text-xs font-semibold uppercase tracking-wide text-muted-foreground h-10 px-4 ${i === 0 ? 'pl-6' : ''} ${i === hg.headers.length - 1 ? 'pr-6' : ''}`}>
                      {header.isPlaceholder ? null : flexRender(header.column.columnDef.header, header.getContext())}
                    </TableHead>)}
                </TableRow>)}
            </TableHeader>
            <TableBody>
              {tableRows.length ? tableRows.map(row => <TableRow key={row.id} className="cursor-pointer hover:bg-muted/30 transition-colors" onClick={() => onEditLead(row.original)}>
                    {row.getVisibleCells().map((cell, i) => <TableCell key={cell.id} className={`py-3 px-4 ${i === 0 ? 'pl-6' : ''} ${i === row.getVisibleCells().length - 1 ? 'pr-6' : ''}`}>
                        {flexRender(cell.column.columnDef.cell, cell.getContext())}
                      </TableCell>)}
                  </TableRow>) : <TableRow>
                  <TableCell colSpan={columns.length} className="h-32">
                    <EmptyState icon={FileSearch} title={searchTerm ? 'No leads found' : 'No leads available'} description={searchTerm ? 'Try adjusting your search or filters.' : 'There are no leads to display.'} />
                  </TableCell>
                </TableRow>}
            </TableBody>
          </Table>
        </div>

        {/* Mobile card view */}
        <div className="lg:hidden divide-y divide-border">
          {tableRows.length ? tableRows.map(row => {
          const staleness = getStalenessStyle(row.original.daysSinceLastInteraction);
          return <div key={row.id} className="p-4 space-y-3 cursor-pointer hover:bg-muted/30 transition-colors active:bg-muted/50" onClick={() => onEditLead(row.original)}>
                  <div className="flex justify-between items-start gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-foreground truncate">{row.original.customerName || 'N/A'}</div>
                      <div className="text-xs text-muted-foreground mt-0.5 truncate">{row.original.opportunityName}</div>
                    </div>
                    <Badge className={`shrink-0 ${getStatusColorWithHover(row.original.status)}`}>
                      {row.original.status || 'Unknown'}
                    </Badge>
                  </div>

                  <div className="space-y-1.5" onClick={e => e.stopPropagation()}>
                    <div className="flex items-center gap-2 text-sm">
                      <User className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                      <span>{getProName(row.original.assignedPro)}</span>
                    </div>
                    {(row.original.customerCity || row.original.customerState) && <div className="flex items-center gap-2 text-sm">
                        <MapPin className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                        <span>{[row.original.customerCity, row.original.customerState].filter(Boolean).join(', ')}</span>
                      </div>}
                    {row.original.customerPhone && <div className="flex items-center gap-2 text-sm">
                        <Phone className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                        <a href={`tel:${phoneHref(row.original.customerPhone)}`} className="text-primary hover:underline">{formatPhone(row.original.customerPhone)}</a>
                      </div>}
                    {row.original.lastInteractionDate && <div className="flex items-center gap-2 text-sm">
                        <Calendar className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                        <span>{new Date(row.original.lastInteractionDate).toLocaleDateString()}</span>
                        {staleness ? <span className={`text-xs font-semibold px-1.5 py-0.5 rounded-full ${staleness.badge}`}>{staleness.label} ago</span> : row.original.daysSinceLastInteraction !== undefined ? <span className="text-xs text-muted-foreground">({row.original.daysSinceLastInteraction}d ago)</span> : null}
                      </div>}
                  </div>

                  <Button variant="outline" size="sm" onClick={e => {
              e.stopPropagation();
              onEditLead(row.original);
            }} className="w-full h-8 text-xs">
                    <Edit className="h-3.5 w-3.5 mr-1.5" />
                    Open Lead
                  </Button>
                </div>;
        }) : <div className="p-6">
              <EmptyState icon={FileSearch} title={searchTerm ? 'No leads found' : 'No leads available'} description={searchTerm ? 'Try adjusting your search or filters.' : 'There are no leads to display.'} />
            </div>}
        </div>

        {/* Footer: record count (single page) or pagination controls (multi-page) */}
        {displayedLeadsCount > 0 && <div className="flex items-center justify-between px-6 py-3 border-t border-border">
            <div className="text-xs text-muted-foreground">
              {currentPage === 1 && !hasMore ? `${displayedLeadsCount} lead${displayedLeadsCount !== 1 ? 's' : ''}${totalCount != null && totalCount !== displayedLeadsCount ? ` of ${totalCount}` : ''}` : <>Showing {startRow}–{endRow}{hasMore && '+'}</>}
            </div>

            {(currentPage > 1 || hasMore) && <div className="flex items-center gap-1.5">
                <Button variant="outline" size="sm" onClick={() => onPageChange(currentPage - 1)} disabled={currentPage === 1} className="h-8 px-2">
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <span className="text-xs font-medium px-2 tabular-nums">Page {currentPage}</span>
                <Button variant="outline" size="sm" onClick={() => onPageChange(currentPage + 1)} disabled={!hasMore} className="h-8 px-2">
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>}
          </div>}
      </CardContent>
    </Card>;
}
