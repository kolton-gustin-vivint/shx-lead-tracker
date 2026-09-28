import React, { useState, useEffect, useCallback } from 'react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue, SelectGroup, SelectLabel, SelectSeparator } from '@project/components/ui/select';
import { Label } from '@project/components/ui/label';
import { getSelfGenActivities, updateSelfGenActivity } from '@/lib/api';
import { toast } from 'sonner';
import { useProxy } from '../contexts/ProxyContext';
import { useReps } from '../contexts/RepsContext';
import SelfGenForm from './selfgen/SelfGenForm';
import SelfGenTable from './selfgen/SelfGenTable';
import SelfGenEditDialog from './selfgen/SelfGenEditDialog';
import SelfGenViewDialog from './selfgen/SelfGenViewDialog';
import type { SelfGenActivity } from './selfgen/types';

interface SelfGenTabProps {
  isManager: boolean;
}

export default function SelfGenTab({ isManager }: SelfGenTabProps) {
  const { currentUser, isProxying } = useProxy();
  const showManagerView = isManager && !isProxying;
  const { pros } = useReps();
  const [openActivities, setOpenActivities] = useState<SelfGenActivity[]>([]);
  const [completedActivities, setCompletedActivities] = useState<SelfGenActivity[]>([]);
  const [loadingOpen, setLoadingOpen] = useState(true);
  const [loadingCompleted, setLoadingCompleted] = useState(true);
  const [editActivity, setEditActivity] = useState<SelfGenActivity | null>(null);
  const [filterProId, setFilterProId] = useState<string>('all');

  // Build pro name map for manager view
  const proNameMap = React.useMemo(() => {
    const map = new Map<string, string>();
    pros.forEach(p => map.set(p.id, p.displayName || p.proName || 'Unknown'));
    return map;
  }, [pros]);

  const fetchActivities = useCallback(async () => {
    const proId = showManagerView
      ? (filterProId === 'all' ? undefined : filterProId)
      : currentUser?.id;

    setLoadingOpen(true);
    setLoadingCompleted(true);

    try {
      const [openResult, completedResult] = await Promise.all([
        getSelfGenActivities({ proId, completed: false }),
        getSelfGenActivities({ proId, completed: true }),
      ]);
      setOpenActivities(openResult.activities);
      setCompletedActivities(completedResult.activities);
    } catch (error) {
      console.error(error);
      toast.error('Failed to load Self-Gen activities');
    } finally {
      setLoadingOpen(false);
      setLoadingCompleted(false);
    }
  }, [showManagerView, filterProId, currentUser?.id]);

  useEffect(() => {
    fetchActivities();
  }, [fetchActivities]);

  const handleToggleComplete = async (activity: SelfGenActivity) => {
    const newCompleted = !activity.completed;

    // Optimistic update
    if (activity.completed) {
      setCompletedActivities(prev => prev.filter(a => a.id !== activity.id));
      setOpenActivities(prev => [{ ...activity, completed: false }, ...prev]);
    } else {
      setOpenActivities(prev => prev.filter(a => a.id !== activity.id));
      setCompletedActivities(prev => [{ ...activity, completed: true }, ...prev]);
    }

    try {
      await updateSelfGenActivity({ id: activity.id, completed: newCompleted });
      toast.success(newCompleted ? 'Marked as completed' : 'Marked as open');
    } catch (error) {
      console.error(error);
      toast.error('Failed to update — reverting');
      fetchActivities();
    }
  };

  return (
    <div className="space-y-5">
      {/* Manager view: show form with Pro picker + filter. Pro view: show form. Proxying: read-only */}
      {showManagerView ? (
        <>
          <SelfGenForm onCreated={fetchActivities} pros={pros} />
          <div className="flex items-end gap-3">
            <div className="space-y-1.5 w-64">
              <Label className="text-xs font-medium text-muted-foreground">Filter by Pro</Label>
              <Select value={filterProId} onValueChange={setFilterProId}>
                <SelectTrigger>
                  <SelectValue placeholder="All" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All</SelectItem>
                  <SelectSeparator />
                  {(() => {
                    const managers = pros.filter(p => p.role === 'Manager');
                    const reps = pros.filter(p => p.role !== 'Manager');
                    return (
                      <>
                        {managers.length > 0 && (
                          <SelectGroup>
                            <SelectLabel className="text-xs text-muted-foreground">Managers</SelectLabel>
                            {managers.map(p => (
                              <SelectItem key={p.id} value={p.id}>
                                {p.displayName || p.proName}
                              </SelectItem>
                            ))}
                          </SelectGroup>
                        )}
                        {managers.length > 0 && reps.length > 0 && <SelectSeparator />}
                        {reps.length > 0 && (
                          <SelectGroup>
                            <SelectLabel className="text-xs text-muted-foreground">Pros</SelectLabel>
                            {reps.map(p => (
                              <SelectItem key={p.id} value={p.id}>
                                {p.displayName || p.proName}
                              </SelectItem>
                            ))}
                          </SelectGroup>
                        )}
                      </>
                    );
                  })()}
                </SelectContent>
              </Select>
            </div>
          </div>
        </>
      ) : !isProxying ? (
        <SelfGenForm onCreated={fetchActivities} />
      ) : null}

      {/* Open Activities */}
      <SelfGenTable
        title="Open Activities"
        activities={openActivities}
        loading={loadingOpen}
        completed={false}
        onToggleComplete={handleToggleComplete}
        onRowClick={a => setEditActivity(a)}
        readOnly={isProxying}
        showProColumn={showManagerView}
        proNameMap={proNameMap}
      />

      {/* Completed Activities */}
      <SelfGenTable
        title="Completed Activities"
        activities={completedActivities}
        loading={loadingCompleted}
        completed={true}
        onToggleComplete={handleToggleComplete}
        onRowClick={a => setEditActivity(a)}
        readOnly={isProxying}
        showProColumn={showManagerView}
        proNameMap={proNameMap}
      />

      {/* Edit Dialog — both Pros and Managers (managers also get delete) */}
      {editActivity && !isProxying && (
        <SelfGenEditDialog
          activity={editActivity}
          open={!!editActivity}
          onClose={() => setEditActivity(null)}
          onSaved={fetchActivities}
          allowDelete={isManager}
          onDeleted={() => {
            setEditActivity(null);
            fetchActivities();
          }}
        />
      )}

      {/* View-only Dialog — only when proxying */}
      {editActivity && isProxying && (
        <SelfGenViewDialog
          activity={editActivity}
          open={!!editActivity}
          onClose={() => setEditActivity(null)}
          proName={editActivity.shxPro?.[0] ? proNameMap.get(editActivity.shxPro[0]) : undefined}
        />
      )}
    </div>
  );
}
