import { useState, useEffect, useMemo } from 'react';
import { useReactTable, getCoreRowModel, getSortedRowModel, getFilteredRowModel, flexRender, ColumnDef, SortingState } from '@tanstack/react-table';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@project/components/ui/table';
import { Card, CardContent, CardHeader, CardTitle } from '@project/components/ui/card';
import { Input } from '@project/components/ui/input';
import { Button } from '@project/components/ui/button';
import { Badge } from '@project/components/ui/badge';
import { Skeleton } from '@project/components/ui/skeleton';
import { ArrowUpDown, RefreshCw, Search, LogIn, UserX } from 'lucide-react';
import { getLoginReport, GetLoginReportOutputType } from '@/lib/api';
import { toast } from 'sonner';
import { formatDistanceToNow } from 'date-fns';

type TeamLogin = GetLoginReportOutputType['teamLogins'][0];

export default function LoginReportTab() {
  const [data, setData] = useState<TeamLogin[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [sorting, setSorting] = useState<SortingState>([]);

  const load = async () => {
    setLoading(true);
    try {
      const res = await getLoginReport({});
      setData(res.teamLogins);
    } catch {
      toast.error('Failed to load login report');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const neverLoggedIn = data.filter(d => !d.lastLogin).length;
  const loggedInLast7d = data.filter(d => {
    if (!d.lastLogin) return false;
    return Date.now() - new Date(d.lastLogin).getTime() < 7 * 24 * 60 * 60 * 1000;
  }).length;

  const columns = useMemo<ColumnDef<TeamLogin>[]>(() => [
    {
      accessorKey: 'proName',
      header: ({ column }) => (
        <Button variant="ghost" size="sm" className="-ml-3" onClick={() => column.toggleSorting()}>
          Name <ArrowUpDown className="ml-1 h-3.5 w-3.5" />
        </Button>
      ),
      cell: ({ row }) => (
        <div>
          <div className="font-medium">{row.original.displayName || row.original.proName}</div>
          <div className="text-xs text-muted-foreground">{row.original.email}</div>
        </div>
      ),
    },
    {
      accessorKey: 'role',
      header: 'Role',
      cell: ({ getValue }) => (
        <Badge variant="outline" className="text-xs">{getValue() as string}</Badge>
      ),
    },
    {
      accessorKey: 'lastLogin',
      header: ({ column }) => (
        <Button variant="ghost" size="sm" className="-ml-3" onClick={() => column.toggleSorting()}>
          Last Login <ArrowUpDown className="ml-1 h-3.5 w-3.5" />
        </Button>
      ),
      cell: ({ getValue }) => {
        const v = getValue() as string | null;
        if (!v) return <span className="text-muted-foreground italic text-xs">Never</span>;
        const d = new Date(v);
        return (
          <div>
            <div className="text-sm">{d.toLocaleDateString()}</div>
            <div className="text-xs text-muted-foreground">{formatDistanceToNow(d, { addSuffix: true })}</div>
          </div>
        );
      },
      sortingFn: (a, b) => {
        const aVal = a.original.lastLogin;
        const bVal = b.original.lastLogin;
        if (!aVal && !bVal) return 0;
        if (!aVal) return 1;
        if (!bVal) return -1;
        return new Date(aVal).getTime() - new Date(bVal).getTime();
      },
    },
    {
      accessorKey: 'loginCount30d',
      header: ({ column }) => (
        <Button variant="ghost" size="sm" className="-ml-3" onClick={() => column.toggleSorting()}>
          Logins (30d) <ArrowUpDown className="ml-1 h-3.5 w-3.5" />
        </Button>
      ),
      cell: ({ getValue }) => {
        const count = getValue() as number;
        return <span className={count === 0 ? 'text-muted-foreground' : 'font-semibold'}>{count}</span>;
      },
    },
  ], []);

  const filtered = useMemo(() => {
    if (!search) return data;
    const q = search.toLowerCase();
    return data.filter(d =>
      d.proName.toLowerCase().includes(q) ||
      d.displayName.toLowerCase().includes(q) ||
      d.email.toLowerCase().includes(q)
    );
  }, [data, search]);

  const table = useReactTable({
    data: filtered,
    columns,
    state: { sorting },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
  });

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-[400px] w-full" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Login Report</h2>
        <Button variant="outline" size="sm" onClick={load}>
          <RefreshCw className="h-3.5 w-3.5 mr-1.5" /> Refresh
        </Button>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <SummaryCard icon={<LogIn className="h-4 w-4 text-primary" />} label="Total Team" value={data.length} />
        <SummaryCard icon={<LogIn className="h-4 w-4 text-emerald-500" />} label="Active (7d)" value={loggedInLast7d} />
        <SummaryCard icon={<UserX className="h-4 w-4 text-destructive" />} label="Never Logged In" value={neverLoggedIn} />
      </div>

      {/* Search */}
      <div className="relative max-w-xs">
        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input placeholder="Search team..." className="pl-8 h-9" value={search} onChange={e => setSearch(e.target.value)} />
      </div>

      {/* Table */}
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              {table.getHeaderGroups().map(hg => (
                <TableRow key={hg.id}>
                  {hg.headers.map(h => (
                    <TableHead key={h.id}>
                      {h.isPlaceholder ? null : flexRender(h.column.columnDef.header, h.getContext())}
                    </TableHead>
                  ))}
                </TableRow>
              ))}
            </TableHeader>
            <TableBody>
              {table.getRowModel().rows.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={columns.length} className="text-center py-8 text-muted-foreground">
                    No results
                  </TableCell>
                </TableRow>
              ) : (
                table.getRowModel().rows.map(row => (
                  <TableRow key={row.id}>
                    {row.getVisibleCells().map(cell => (
                      <TableCell key={cell.id}>
                        {flexRender(cell.column.columnDef.cell, cell.getContext())}
                      </TableCell>
                    ))}
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}

function SummaryCard({ icon, label, value }: { icon: React.ReactNode; label: string; value: number }) {
  return (
    <Card>
      <CardContent className="flex items-center gap-3 py-3 px-4">
        {icon}
        <div>
          <p className="text-xs text-muted-foreground">{label}</p>
          <p className="text-lg font-bold">{value}</p>
        </div>
      </CardContent>
    </Card>
  );
}
