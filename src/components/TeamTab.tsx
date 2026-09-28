import React, { useState, useMemo, useEffect } from 'react';
import { useReactTable, getCoreRowModel, getSortedRowModel, flexRender, ColumnDef, SortingState } from '@tanstack/react-table';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@project/components/ui/table';
import { Button } from '@project/components/ui/button';
import { Input } from '@project/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@project/components/ui/card';
import { ArrowUpDown, RefreshCw, Search, User, Users, TrendingUp } from 'lucide-react';
import { getReps, GetRepsOutputType, triggerLoadLeadsForPro } from '@/lib/api';
import { toast } from 'sonner';
import EmptyState from './EmptyState';
import { Skeleton } from '@project/components/ui/skeleton';

type Pro = GetRepsOutputType['pros'][0];

export default function TeamTab() {
  const [pros, setPros] = useState<Pro[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [loadingProId, setLoadingProId] = useState<string | null>(null);
  const [sorting, setSorting] = useState<SortingState>([{ id: 'proName', desc: false }]);

  const loadPros = async () => {
    try {
      setLoading(true);
      const result = await getReps({});
      // Filter to only show Pros (not Managers)
      const filteredPros = result.pros.filter(pro => pro.role === 'Pro');
      setPros(filteredPros);
    } catch (error) {
      console.error('Error loading pros:', error);
      toast.error('Failed to load team members');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadPros();
  }, []);

  const handleLoadLeads = async (pro: Pro) => {
    if (!pro.id) return;
    
    setLoadingProId(pro.id);
    try {
      await triggerLoadLeadsForPro({ proId: pro.id });
      toast.success(`Load Leads triggered for ${pro.displayName || pro.proName}`);
      // Refresh the data after a short delay
      setTimeout(() => {
        loadPros();
      }, 1000);
    } catch (error) {
      console.error('Error triggering load leads:', error);
      toast.error('Failed to trigger load leads');
    } finally {
      setLoadingProId(null);
    }
  };

  const filteredPros = useMemo(() => {
    if (!searchTerm) return pros;
    
    const lowerSearch = searchTerm.toLowerCase();
    return pros.filter(pro => 
      (pro.displayName?.toLowerCase().includes(lowerSearch)) ||
      (pro.proName?.toLowerCase().includes(lowerSearch)) ||
      (pro.email?.toLowerCase().includes(lowerSearch))
    );
  }, [pros, searchTerm]);

  const columns = useMemo<ColumnDef<Pro>[]>(() => [
    {
      accessorKey: 'proName',
      header: ({ column }) => (
        <Button 
          variant="ghost" 
          onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')} 
          className={`h-auto p-0 ${column.getIsSorted() ? 'font-bold text-primary' : 'font-medium'}`}
        >
          Pro Name
          <ArrowUpDown className="ml-2 h-4 w-4" />
        </Button>
      ),
      cell: ({ row }) => (
        <div className="flex items-center gap-2">
          <User className="h-4 w-4 text-muted-foreground" />
          <span className="font-medium">{row.original.displayName || row.original.proName}</span>
        </div>
      )
    },
    {
      accessorKey: 'activeLeadCount',
      header: ({ column }) => (
        <Button 
          variant="ghost" 
          onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')} 
          className={`h-auto p-0 ${column.getIsSorted() ? 'font-bold text-primary' : 'font-medium'}`}
        >
          Assigned Leads
          <ArrowUpDown className="ml-2 h-4 w-4" />
        </Button>
      ),
      cell: ({ row }) => (
        <div className="flex items-center gap-2">
          <Users className="h-4 w-4 text-muted-foreground" />
          <span>{row.original.activeLeadCount || 0}</span>
        </div>
      )
    },
    {
      accessorKey: 'todaysLeads',
      header: 'Daily New Leads',
      cell: ({ row }) => (
        <div className="flex items-center gap-2">
          <TrendingUp className="h-4 w-4 text-muted-foreground" />
          <span>{row.original.todaysLeads || 0}</span>
        </div>
      )
    },
    {
      id: 'actions',
      header: 'Actions',
      cell: ({ row }) => (
        <Button 
          variant="default" 
          size="sm" 
          onClick={() => handleLoadLeads(row.original)}
          disabled={loadingProId === row.original.id}
        >
          <RefreshCw className={`h-4 w-4 mr-2 ${loadingProId === row.original.id ? 'animate-spin' : ''}`} />
          {loadingProId === row.original.id ? 'Loading...' : 'Load Leads'}
        </Button>
      )
    }
  ], [loadingProId]);

  const table = useReactTable({
    data: filteredPros,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    onSortingChange: setSorting,
    state: {
      sorting
    }
  });

  if (loading) {
    return (
      <Card className="shadow-premium">
        <CardHeader className="border-b border-border px-5 py-4">
          <Skeleton className="h-5 w-48 mb-3" />
          <Skeleton className="h-9 w-72" />
        </CardHeader>
        <CardContent className="p-0">
          <div className="p-4 space-y-3">
            {[1, 2, 3, 4].map(i => (
              <Skeleton key={i} className="h-14 w-full" />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="shadow-premium">
      <CardHeader className="border-b border-border px-5 py-4">
        <div className="flex items-center justify-between gap-2 mb-3">
          <CardTitle className="font-bold text-lg">Team Management</CardTitle>
          <Button 
            onClick={loadPros} 
            variant="outline" 
            size="sm" 
            disabled={loading}
            className="h-8 gap-1.5 text-xs"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
            <span className="hidden sm:inline">Refresh</span>
          </Button>
        </div>
        <div className="relative w-full sm:w-72">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
          <Input 
            placeholder="Search team members..." 
            value={searchTerm} 
            onChange={e => setSearchTerm(e.target.value)} 
            className="pl-9 h-9 text-sm" 
          />
        </div>
      </CardHeader>
      <CardContent className="p-0">
        {/* Desktop Table View */}
        <div className="hidden lg:block">
          <Table>
            <TableHeader>
              {table.getHeaderGroups().map(headerGroup => (
                <TableRow key={headerGroup.id} className="bg-muted/40 hover:bg-muted/40">
                  {headerGroup.headers.map((header, i) => (
                    <TableHead key={header.id} className={`text-xs font-semibold uppercase tracking-wide text-muted-foreground h-10 px-4 ${i === 0 ? 'pl-6' : ''}`}>
                      {header.isPlaceholder ? null : flexRender(header.column.columnDef.header, header.getContext())}
                    </TableHead>
                  ))}
                </TableRow>
              ))}
            </TableHeader>
            <TableBody>
              {table.getRowModel().rows?.length ? (
                table.getRowModel().rows.map(row => (
                  <TableRow key={row.id} className="hover:bg-muted/30 transition-colors">
                    {row.getVisibleCells().map((cell, i) => (
                      <TableCell key={cell.id} className={`py-3 px-4 ${i === 0 ? 'pl-6' : ''}`}>
                        {flexRender(cell.column.columnDef.cell, cell.getContext())}
                      </TableCell>
                    ))}
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={columns.length} className="h-24">
                    <EmptyState 
                      icon={Users}
                      title={searchTerm ? "No team members found" : "No team members available"}
                      description={searchTerm ? "Try adjusting your search terms." : "There are no team members to display at this time."}
                    />
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>

          {filteredPros.length > 0 && (
            <div className="px-6 py-3 border-t border-border">
              <span className="text-xs text-muted-foreground">
                {filteredPros.length} team member{filteredPros.length !== 1 ? 's' : ''}
              </span>
            </div>
          )}
        </div>

        {/* Mobile Card View */}
        <div className="lg:hidden divide-y divide-border">
          {table.getRowModel().rows?.length ? (
            table.getRowModel().rows.map(row => (
              <div key={row.id} className="p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <User className="h-4 w-4 text-muted-foreground" />
                    <span className="font-medium">{row.original.displayName || row.original.proName}</span>
                  </div>
                </div>
                
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <div className="flex items-center gap-2">
                      <Users className="h-4 w-4 text-muted-foreground" />
                      <span>Assigned Leads:</span>
                    </div>
                    <span className="font-medium">{row.original.activeLeadCount || 0}</span>
                  </div>
                  
                  <div className="flex items-center justify-between text-sm">
                    <div className="flex items-center gap-2">
                      <TrendingUp className="h-4 w-4 text-muted-foreground" />
                      <span>Daily New Leads:</span>
                    </div>
                    <span className="font-medium">{row.original.todaysLeads || 0}</span>
                  </div>
                </div>
                
                <div className="pt-2 border-t">
                  <Button 
                    variant="default" 
                    size="sm" 
                    onClick={() => handleLoadLeads(row.original)}
                    disabled={loadingProId === row.original.id}
                    className="w-full"
                  >
                    <RefreshCw className={`h-4 w-4 mr-2 ${loadingProId === row.original.id ? 'animate-spin' : ''}`} />
                    {loadingProId === row.original.id ? 'Loading...' : 'Load Leads'}
                  </Button>
                </div>
              </div>
            ))
          ) : (
            <EmptyState 
              icon={Users}
              title={searchTerm ? "No team members found" : "No team members available"}
              description={searchTerm ? "Try adjusting your search terms." : "There are no team members to display at this time."}
            />
          )}
        </div>
      </CardContent>
    </Card>
  );
}
