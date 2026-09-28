import React, { useState } from 'react';
import { Card, CardContent } from '@project/components/ui/card';
import { Button } from '@project/components/ui/button';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@project/components/ui/alert-dialog';
import { Skeleton } from '@project/components/ui/skeleton';
import { Upload, Share2, Flag, AlertTriangle, Users, FileStack, RefreshCw, DatabaseZap, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { triggerProcessNewUploads, triggerDistributeLeads, triggerMarkLeftoverLeads, getAdminStats, refreshAdminStats } from '@/lib/api';
import { GetAdminStatsOutputType } from '@/lib/api';

export default function AdminTab() {
  const [showConfirm, setShowConfirm] = useState(false);
  const [selectedAction, setSelectedAction] = useState<{
    title: string;
    description: string;
    action: () => Promise<void>;
  } | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [stats, setStats] = useState<GetAdminStatsOutputType | null>(null);
  const [statsLoading, setStatsLoading] = useState(false);
  const [statsLoaded, setStatsLoaded] = useState(false);
  const [isRecomputing, setIsRecomputing] = useState(false);

  // Fast load — reads cached values from Control Panel (1 API call)
  const loadStats = async () => {
    setStatsLoading(true);
    try {
      const data = await getAdminStats({});
      setStats(data);
      setStatsLoaded(true);
    } catch {
      toast.error('Failed to load pipeline stats');
    } finally {
      setStatsLoading(false);
    }
  };

  // Slow recompute — paginates through all leads, saves back to Control Panel
  const recomputeStats = async () => {
    setIsRecomputing(true);
    toast.info('Recomputing counts… this may take a minute or two.');
    try {
      const data = await refreshAdminStats({});
      setStats({ unassignedCount: data.unassignedCount, rawIntakeCount: data.rawIntakeCount, isCached: false });
      setStatsLoaded(true);
      toast.success('Counts updated and saved to Airtable.');
    } catch {
      toast.error('Failed to recompute stats. Try again in a moment.');
    } finally {
      setIsRecomputing(false);
    }
  };

  const handleProcessNewUploads = async () => {
    setIsProcessing(true);
    try {
      await triggerProcessNewUploads({});
      toast.success('New Lead Intake automation triggered successfully');
    } catch {
      toast.error('Failed to trigger New Lead Intake automation');
    } finally {
      setIsProcessing(false);
      setShowConfirm(false);
    }
  };

  const handleDistributeLeads = async () => {
    setIsProcessing(true);
    try {
      await triggerDistributeLeads({});
      toast.success('Run Lead Distribution automation triggered successfully');
    } catch {
      toast.error('Failed to trigger Run Lead Distribution automation');
    } finally {
      setIsProcessing(false);
      setShowConfirm(false);
    }
  };

  const handleMarkLeftoverLeads = async () => {
    setIsProcessing(true);
    try {
      await triggerMarkLeftoverLeads({});
      toast.success('Mark Leftover Leads automation triggered successfully');
    } catch {
      toast.error('Failed to trigger Mark Leftover Leads automation');
    } finally {
      setIsProcessing(false);
      setShowConfirm(false);
    }
  };

  const openConfirmDialog = (title: string, description: string, action: () => Promise<void>) => {
    setSelectedAction({ title, description, action });
    setShowConfirm(true);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <Card className="border-[hsl(var(--warning-border))] bg-[hsl(var(--warning-bg))]">
        <CardContent className="flex items-start gap-3 p-4">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[hsl(var(--warning-border))]/40">
            <AlertTriangle className="h-4 w-4 text-[hsl(var(--warning-text))]" />
          </div>
          <div>
            <h3 className="text-[hsl(var(--warning-text))] font-semibold text-sm">Lead Command Center</h3>
            <p className="text-xs text-[hsl(var(--warning-text))]/80 mt-0.5 leading-relaxed">
              Trigger automated processes for lead management. Each run processes up to 500 records.
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Automation Cards */}
      <div className="grid gap-4 grid-cols-1 md:grid-cols-3">
        {[
          { icon: Upload, title: 'Process Uploads', desc: 'Process and import new lead data from uploaded files.', btnLabel: 'Process Uploads', confirmTitle: 'Process New Uploads', confirmDesc: 'This will run the New Lead Intake automation, processing all pending uploaded files. Continue?', action: handleProcessNewUploads },
          { icon: Share2, title: 'Distribute Leads', desc: 'Assign unassigned leads to reps based on capacity and location.', btnLabel: 'Distribute Leads', confirmTitle: 'Distribute Leads', confirmDesc: 'This will assign unassigned leads to available sales reps. Continue?', action: handleDistributeLeads },
          { icon: Flag, title: 'Mark Leftovers', desc: 'Flag leads that remain unassigned after distribution.', btnLabel: 'Mark Leftovers', confirmTitle: 'Mark Leftover Leads', confirmDesc: 'This will flag all leads not assigned during the last distribution run. Continue?', action: handleMarkLeftoverLeads },
        ].map((item, i) => (
          <Card key={i} className="shadow-premium flex flex-col">
            <CardContent className="p-5 flex flex-col flex-1 gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10">
                <item.icon className="h-4.5 w-4.5 text-primary" />
              </div>
              <div className="flex-1">
                <p className="font-semibold text-sm">{item.title}</p>
                <p className="text-xs text-muted-foreground mt-1 leading-relaxed">{item.desc}</p>
              </div>
              <Button
                onClick={() => openConfirmDialog(item.confirmTitle, item.confirmDesc, item.action)}
                className="w-full mt-auto"
                size="sm"
                disabled={isProcessing}
              >
                <item.icon className="h-3.5 w-3.5 mr-1.5" />
                {item.btnLabel}
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Lead Pipeline Totals */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-base font-semibold text-foreground">Lead Pipeline Overview</h3>
          {statsLoaded && (
            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={loadStats}
                disabled={statsLoading || isRecomputing}
                className="gap-1.5 text-muted-foreground"
              >
                <RefreshCw className={`h-3.5 w-3.5 ${statsLoading ? 'animate-spin' : ''}`} />
                Refresh
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={recomputeStats}
                disabled={isRecomputing || statsLoading}
                className="gap-1.5 text-muted-foreground"
              >
                <DatabaseZap className={`h-3.5 w-3.5 ${isRecomputing ? 'animate-pulse' : ''}`} />
                {isRecomputing ? 'Recomputing…' : 'Recount'}
              </Button>
            </div>
          )}
        </div>

        {!statsLoaded && !statsLoading ? (
          <Card className="border border-dashed border-border bg-card">
            <CardContent className="flex flex-col items-center justify-center gap-4 py-8">
              <div className="text-center space-y-1">
                <p className="text-sm font-medium">Load cached pipeline counts</p>
                <p className="text-xs text-muted-foreground">Reads last saved values — instant. Use "Recount" to recompute fresh numbers.</p>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={loadStats} disabled={statsLoading}>
                  <RefreshCw className="h-4 w-4 mr-2" />
                  Load Stats
                </Button>
                <Button variant="ghost" size="sm" onClick={recomputeStats} disabled={isRecomputing} className="text-muted-foreground">
                  <DatabaseZap className="h-4 w-4 mr-2" />
                  {isRecomputing ? 'Recomputing…' : 'Recount from Airtable'}
                </Button>
              </div>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4 grid-cols-1 sm:grid-cols-2">
            <Card className="border border-border bg-card">
              <CardContent className="flex items-center gap-4 p-5">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-[hsl(var(--status-new-bg)/0.15)]">
                  <Users className="h-6 w-6 text-[hsl(var(--status-new-bg))]" />
                </div>
                <div className="min-w-0">
                  {statsLoading || isRecomputing ? (
                    <>
                      <Skeleton className="h-8 w-16 mb-1" />
                      <Skeleton className="h-4 w-40" />
                    </>
                  ) : (
                    <>
                      <p className="text-3xl font-bold tabular-nums">{stats?.unassignedCount ?? '—'}</p>
                      <p className="text-sm text-muted-foreground leading-tight mt-0.5">Leads ready to be assigned</p>
                      <p className="text-xs text-muted-foreground/70 mt-0.5">Unassigned Leads view</p>
                    </>
                  )}
                </div>
              </CardContent>
            </Card>

            <Card className="border border-border bg-card">
              <CardContent className="flex items-center gap-4 p-5">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-[hsl(var(--status-progress-bg)/0.15)]">
                  <FileStack className="h-6 w-6 text-[hsl(var(--status-progress-bg))]" />
                </div>
                <div className="min-w-0">
                  {statsLoading || isRecomputing ? (
                    <>
                      <Skeleton className="h-8 w-16 mb-1" />
                      <Skeleton className="h-4 w-40" />
                    </>
                  ) : (
                    <>
                      <p className="text-3xl font-bold tabular-nums">{stats?.rawIntakeCount ?? '—'}</p>
                      <p className="text-sm text-muted-foreground leading-tight mt-0.5">New uploads pending intake</p>
                      <p className="text-xs text-muted-foreground/70 mt-0.5">_SYSTEM_RAW_INTAKE view</p>
                    </>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        )}
      </div>

      {/* Confirmation Dialog */}
      <AlertDialog open={showConfirm} onOpenChange={setShowConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{selectedAction?.title}</AlertDialogTitle>
            <AlertDialogDescription>
              {selectedAction?.description}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isProcessing}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => selectedAction?.action()} disabled={isProcessing}>
              {isProcessing && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              {isProcessing ? 'Processing…' : 'Continue'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
