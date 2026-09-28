import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@project/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@project/components/ui/table';
import { Badge } from '@project/components/ui/badge';
import { Checkbox } from '@project/components/ui/checkbox';
import { Skeleton } from '@project/components/ui/skeleton';
import { CheckCircle2, Circle, Paperclip } from 'lucide-react';
import EmptyState from '../EmptyState';
import type { SelfGenActivity } from './types';

interface SelfGenTableProps {
  title: string;
  activities: SelfGenActivity[];
  loading: boolean;
  completed: boolean;
  onToggleComplete: (activity: SelfGenActivity) => void;
  onRowClick: (activity: SelfGenActivity) => void;
  readOnly?: boolean;
  showProColumn?: boolean;
  proNameMap?: Map<string, string>;
}

function formatDate(iso?: string) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString();
}

export default function SelfGenTable({
  title,
  activities,
  loading,
  completed,
  onToggleComplete,
  onRowClick,
  readOnly = false,
  showProColumn = false,
  proNameMap,
}: SelfGenTableProps) {
  const icon = completed
    ? <CheckCircle2 className="h-4 w-4 text-primary" />
    : <Circle className="h-4 w-4 text-muted-foreground" />;

  return (
    <Card className="shadow-premium">
      <CardHeader className="border-b border-border px-5 py-4">
        <CardTitle className="flex items-center gap-2 text-base font-bold">
          {icon}
          {title}
          {!loading && (
            <Badge variant="secondary" className="ml-1 text-xs font-normal">
              {activities.length}
            </Badge>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        {loading ? (
          <div className="p-4 space-y-3">
            {[1, 2, 3].map(i => (
              <Skeleton key={i} className="h-10 w-full" />
            ))}
          </div>
        ) : activities.length === 0 ? (
          <div className="py-10">
            <EmptyState
              icon={completed ? CheckCircle2 : Circle}
              title={completed ? 'No completed activities' : 'No open activities'}
              description={completed ? 'Completed activities will appear here.' : 'Log an activity using the form above.'}
            />
          </div>
        ) : (
          <>
            {/* Desktop */}
            <div className="hidden md:block">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/40 hover:bg-muted/40">
                    {showProColumn && (
                      <TableHead className="text-xs font-semibold uppercase tracking-wide text-muted-foreground h-10 px-4 pl-5">Pro</TableHead>
                    )}
                    <TableHead className={`text-xs font-semibold uppercase tracking-wide text-muted-foreground h-10 px-4 ${!showProColumn ? 'pl-5' : ''}`}>Date</TableHead>
                    <TableHead className="text-xs font-semibold uppercase tracking-wide text-muted-foreground h-10 px-4">Time Slot</TableHead>
                    <TableHead className="text-xs font-semibold uppercase tracking-wide text-muted-foreground h-10 px-4">Activity Type</TableHead>
                    <TableHead className="text-xs font-semibold uppercase tracking-wide text-muted-foreground h-10 px-4">Notes</TableHead>
                    <TableHead className="text-xs font-semibold uppercase tracking-wide text-muted-foreground h-10 px-4 text-center pr-5">Done</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {activities.map(a => (
                    <TableRow
                      key={a.id}
                      className={`cursor-pointer hover:bg-muted/30 transition-colors ${completed ? 'opacity-70' : ''}`}
                      onClick={() => onRowClick(a)}
                    >
                      {showProColumn && (
                        <TableCell className="py-3 px-4 pl-5 text-sm">
                          {a.shxPro?.[0] && proNameMap ? (proNameMap.get(a.shxPro[0]) || '—') : '—'}
                        </TableCell>
                      )}
                      <TableCell className={`py-3 px-4 text-sm ${!showProColumn ? 'pl-5' : ''}`}>
                        {formatDate(a.dateOfActivity)}
                      </TableCell>
                      <TableCell className="py-3 px-4 text-sm">{a.timeSlot || '—'}</TableCell>
                      <TableCell className="py-3 px-4">
                        <div className="flex flex-wrap gap-1">
                          {(a.activityType || []).map(t => (
                            <Badge key={t} variant="secondary" className="text-xs font-normal">
                              {t}
                            </Badge>
                          ))}
                        </div>
                      </TableCell>
                      <TableCell className="py-3 px-4 text-sm text-muted-foreground max-w-[200px]">
                        <div className="flex items-center gap-1.5">
                          <span className="truncate">{a.notes || '—'}</span>
                          {a.attachments && a.attachments.length > 0 && (
                            <Paperclip className="h-3 w-3 text-muted-foreground shrink-0" />
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="py-3 px-4 text-center pr-5" onClick={e => e.stopPropagation()}>
                        <Checkbox
                          checked={a.completed}
                          disabled={readOnly}
                          onCheckedChange={() => !readOnly && onToggleComplete(a)}
                        />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            {/* Mobile */}
            <div className="md:hidden divide-y divide-border">
              {activities.map(a => (
                <div
                  key={a.id}
                  className={`p-4 space-y-2 cursor-pointer hover:bg-muted/30 transition-colors ${completed ? 'opacity-70' : ''}`}
                  onClick={() => onRowClick(a)}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium">{formatDate(a.dateOfActivity)}</div>
                      <div className="text-xs text-muted-foreground mt-0.5">{a.timeSlot}</div>
                    </div>
                    <div onClick={e => e.stopPropagation()}>
                      <Checkbox
                        checked={a.completed}
                        disabled={readOnly}
                        onCheckedChange={() => !readOnly && onToggleComplete(a)}
                      />
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {(a.activityType || []).map(t => (
                      <Badge key={t} variant="secondary" className="text-xs font-normal">{t}</Badge>
                    ))}
                  </div>
                  {a.notes && <div className="text-xs text-muted-foreground truncate">{a.notes}</div>}
                  {showProColumn && a.shxPro?.[0] && proNameMap && (
                    <div className="text-xs text-muted-foreground">
                      Pro: {proNameMap.get(a.shxPro[0]) || '—'}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
