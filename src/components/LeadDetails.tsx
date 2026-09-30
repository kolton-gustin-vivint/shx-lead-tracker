import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@project/components/ui/dialog';
import { Button } from '@project/components/ui/button';
import { Card, CardContent } from '@project/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@project/components/ui/tabs';
import { Badge } from '@project/components/ui/badge';
import { Plus, MessageSquare, Edit, Phone, Mail, Calendar, User, MapPin, Building, Hash, Clock, RefreshCw, Sparkles, FileText } from 'lucide-react';
import { toast } from 'sonner';
import { GetLeadsOutputType, GetRepsOutputType, suggestNextAction, generateAiSummary } from '@/lib/api';
import { logAuditEvent } from '../utils/auditLogger';
import { getStatusColorWithHover } from '../utils/statusColors';
import { formatPhone, phoneHref } from '../utils/formatters';
import ActivityForm from './ActivityForm';
import LeadForm from './LeadForm';
import ActivityList from './ActivityList';
import QuickStatusChange from './QuickStatusChange';

type Lead = GetLeadsOutputType['leads'][0];
type Pro = GetRepsOutputType['pros'][0];

interface LeadDetailsProps {
  lead: Lead | null;
  pros: Pro[];
  onClose: () => void;
  onRefresh: () => void;
  onLeadUpdated?: (updatedLead: Lead) => void;
  currentUser: {
    id: string;
    email: string;
    proId?: string;
    proName: string;
    displayName: string;
    role: string;
  };
}

/* Consistent min-height for all tab panes so the dialog never jumps when switching */
const TAB_PANE = 'space-y-4 min-h-[460px]';

export default function LeadDetails({
  lead,
  pros,
  onClose,
  onRefresh,
  onLeadUpdated,
  currentUser,
}: LeadDetailsProps) {
  const [currentLead, setCurrentLead] = useState<Lead | null>(lead);
  const [activityRefreshKey, setActivityRefreshKey] = useState(0);
  const [showActivityForm, setShowActivityForm] = useState(false);
  const [showEditForm, setShowEditForm] = useState(false);
  const [showQuickStatusChange, setShowQuickStatusChange] = useState(false);
  const [editingActivity, setEditingActivity] = useState<any>(null);
  const [aiSuggestion, setAiSuggestion] = useState<string | null>(null);
  const [loadingSuggestion, setLoadingSuggestion] = useState(false);
  const [aiSummary, setAiSummary] = useState<string | null>(null);
  const [loadingSummary, setLoadingSummary] = useState(false);

  useEffect(() => {
    setCurrentLead(lead);
    setAiSuggestion(null);
    setAiSummary(null);
    setActivityRefreshKey(0);
  }, [lead?.id]);

  const handleLeadFieldsUpdated = (updates: Partial<Lead>) => {
    if (!currentLead) return;
    const updated = { ...currentLead, ...updates };
    setCurrentLead(updated);
    // Notify the parent outside the state updater. A setState updater must be
    // pure — React may run it during render, and the parent's handler sets
    // state of its own, which warns about updating LeadsTab mid-render.
    onLeadUpdated?.(updated);
  };

  const handleRevertLead = () => {
    setCurrentLead(lead);
    if (lead) onLeadUpdated?.(lead);
  };

  const getProName = (proIds?: string[]) => {
    if (!proIds || proIds.length === 0) return 'Unassigned';
    const pro = pros.find(p => proIds.includes(p.id));
    return pro?.displayName || pro?.proName || 'Unknown';
  };

  const handleActivityCreated = () => {
    setShowActivityForm(false);
    toast.success('Activity added successfully');
    setActivityRefreshKey(k => k + 1);
  };

  const handleActivityUpdated = () => {
    setShowActivityForm(false);
    setEditingActivity(null);
    toast.success('Activity updated successfully');
    setActivityRefreshKey(k => k + 1);
  };

  const handleEditComplete = () => {
    logAuditEvent({
      userEmail: currentUser.email,
      userName: currentUser.displayName || currentUser.proName,
      action: 'Update Lead',
      leadId: currentLead?.id,
      details: `Updated lead: ${currentLead?.customerName} (${currentLead?.opportunityName})`,
    });
    setShowEditForm(false);
  };

  const handleEditActivity = (activity: any) => {
    setEditingActivity(activity);
    setShowActivityForm(true);
  };

  const handleActivityFormClose = () => {
    setShowActivityForm(false);
    setEditingActivity(null);
  };

  const handleGetAiSuggestion = async () => {
    if (!currentLead) return;
    setLoadingSuggestion(true);
    try {
      const result = await suggestNextAction({ leadId: currentLead.id });
      setAiSuggestion(result.text);
      toast.success('AI suggestion generated');
    } catch (error) {
      console.error('Error getting AI suggestion:', error);
      toast.error('Failed to generate AI suggestion');
    } finally {
      setLoadingSuggestion(false);
    }
  };

  const handleGetAiSummary = async () => {
    if (!currentLead) return;
    setLoadingSummary(true);
    try {
      const result = await generateAiSummary({ leadId: currentLead.id });
      setAiSummary(result.text);
      toast.success('AI summary generated');
    } catch (error) {
      console.error('Error getting AI summary:', error);
      toast.error('Failed to generate AI summary');
    } finally {
      setLoadingSummary(false);
    }
  };

  if (!currentLead) return null;

  const detailTabClass = 'data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=inactive]:text-muted-foreground data-[state=inactive]:hover:text-foreground text-sm font-medium transition-colors';

  return (
    <>
      <Dialog open={true} onOpenChange={onClose}>
        <DialogContent className="max-w-4xl max-h-[90vh] flex flex-col">
          <DialogHeader className="shrink-0">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between mr-5">
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2 mb-1">
                  <DialogTitle className="text-xl font-semibold leading-tight">
                    {currentLead.customerName || 'Unknown Customer'}
                  </DialogTitle>
                  <Badge className={getStatusColorWithHover(currentLead.status)}>
                    {currentLead.status || 'Unknown'}
                  </Badge>
                </div>
                <DialogDescription className="text-sm text-muted-foreground">
                  {currentLead.opportunityName || 'No opportunity name'}
                </DialogDescription>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowQuickStatusChange(true)}
                  className="h-8 px-3 text-xs"
                >
                  <RefreshCw className="h-3.5 w-3.5 mr-1.5" />
                  Status
                </Button>
                <Button size="sm" onClick={() => setShowEditForm(true)} className="h-8 px-3 text-xs">
                  <Edit className="h-3.5 w-3.5 mr-1.5" />
                  Edit
                </Button>
              </div>
            </div>
          </DialogHeader>

          {/* Scrollable tab area — keeps header fixed, scroll within the pane */}
          <div className="flex-1 min-h-0 overflow-y-auto -mx-6 px-6 pb-2">
            <Tabs defaultValue="overview" className="w-full">
              <TabsList
                className={`grid w-full sticky top-0 z-10 grid-cols-3 bg-muted/60 backdrop-blur-sm`}
              >
                <TabsTrigger value="overview" className={detailTabClass}>Overview</TabsTrigger>
                <TabsTrigger value="moreinfo" className={detailTabClass}>More Info</TabsTrigger>
                <TabsTrigger value="activities" className={detailTabClass}>Activities</TabsTrigger>
              </TabsList>

              {/* ── Overview ── */}
              <TabsContent value="overview" className={TAB_PANE}>
                <OverviewAiCards
                  currentLead={currentLead}
                  aiSuggestion={aiSuggestion}
                  loadingSuggestion={loadingSuggestion}
                  onGetSuggestion={handleGetAiSuggestion}
                  aiSummary={aiSummary}
                  loadingSummary={loadingSummary}
                  onGetSummary={handleGetAiSummary}
                />

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <Card className="border-border">
                    <CardContent className="p-4 space-y-3">
                      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Contact</p>
                      {currentLead.customerPhone && (
                        <div className="flex items-center gap-2">
                          <Phone className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                          <a href={`tel:${phoneHref(currentLead.customerPhone)}`} className="text-sm text-primary hover:underline font-medium">
                            {formatPhone(currentLead.customerPhone)}
                          </a>
                        </div>
                      )}
                      {currentLead.customerEmail && (
                        <div className="flex items-center gap-2">
                          <Mail className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                          <a href={`mailto:${currentLead.customerEmail}`} className="text-sm text-primary hover:underline truncate">
                            {currentLead.customerEmail}
                          </a>
                        </div>
                      )}
                      {!currentLead.customerPhone && !currentLead.customerEmail && (
                        <p className="text-sm text-muted-foreground">No contact info available</p>
                      )}
                    </CardContent>
                  </Card>

                  <Card className="border-border">
                    <CardContent className="p-4 space-y-3">
                      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Assignment</p>
                      <div className="flex items-center gap-2">
                        <User className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                        <span className="text-sm font-medium">{getProName(currentLead.assignedPro)}</span>
                      </div>
                      {currentLead.assignedDate && (
                        <div className="flex items-center gap-2">
                          <Calendar className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                          <span className="text-sm">Assigned {new Date(currentLead.assignedDate).toLocaleDateString()}</span>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                </div>

                {currentLead.leadDetails && (
                  <Card className="border-border">
                    <CardContent className="p-4 space-y-2">
                      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Lead Details</p>
                      <p className="text-sm whitespace-pre-wrap leading-relaxed">{currentLead.leadDetails}</p>
                    </CardContent>
                  </Card>
                )}

                {currentLead.lastInteractionDate && (
                  <Card className="border-border">
                    <CardContent className="p-4 space-y-2">
                      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground flex items-center gap-1.5">
                        <MessageSquare className="h-3.5 w-3.5" /> Last Interaction
                      </p>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Calendar className="h-3.5 w-3.5 text-muted-foreground" />
                          <span className="text-sm">{new Date(currentLead.lastInteractionDate).toLocaleDateString()}</span>
                        </div>
                        {currentLead.daysSinceLastInteraction !== undefined && (
                          <Badge variant="outline">{currentLead.daysSinceLastInteraction} days ago</Badge>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                )}
              </TabsContent>

              {/* ── More Info ── */}
              <TabsContent value="moreinfo" className={TAB_PANE}>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <Card className="border-border">
                    <CardContent className="p-4 space-y-2">
                      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground flex items-center gap-1.5">
                        <MapPin className="h-3.5 w-3.5" /> Address
                      </p>
                      <div className="text-sm space-y-0.5">
                        {currentLead.customerAddressLine1 && <div>{currentLead.customerAddressLine1}</div>}
                        {currentLead.customerAddressLine2 && <div>{currentLead.customerAddressLine2}</div>}
                        {(currentLead.customerCity || currentLead.customerState || currentLead.customerZip) && (
                          <div>{[currentLead.customerCity, currentLead.customerState, currentLead.customerZip].filter(Boolean).join(', ')}</div>
                        )}
                        {!currentLead.customerAddressLine1 && !currentLead.customerCity && (
                          <div className="text-muted-foreground">No address available</div>
                        )}
                      </div>
                    </CardContent>
                  </Card>

                  <Card className="border-border">
                    <CardContent className="p-4 space-y-2">
                      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground flex items-center gap-1.5">
                        <Building className="h-3.5 w-3.5" /> Sales Office
                      </p>
                      <p className="text-sm">{currentLead.salesOffice || 'Not specified'}</p>
                    </CardContent>
                  </Card>

                  <Card className="border-border">
                    <CardContent className="p-4 space-y-2">
                      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground flex items-center gap-1.5">
                        <Hash className="h-3.5 w-3.5" /> Total Interactions
                      </p>
                      <p className="text-2xl font-bold tabular-nums">{currentLead.totalInteractions || 0}</p>
                    </CardContent>
                  </Card>

                  <Card className="border-border">
                    <CardContent className="p-4 space-y-2">
                      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground flex items-center gap-1.5">
                        <Clock className="h-3.5 w-3.5" /> Days Since Last Interaction
                      </p>
                      <p className="text-2xl font-bold tabular-nums">
                        {currentLead.daysSinceLastInteraction !== undefined ? currentLead.daysSinceLastInteraction : 'N/A'}
                      </p>
                    </CardContent>
                  </Card>
                </div>
              </TabsContent>

              {/* ── Activities ── */}
              <TabsContent value="activities" className={TAB_PANE}>
                <div className="flex justify-between items-center">
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Lead Activities</p>
                  <Button onClick={() => setShowActivityForm(true)} size="sm" className="h-8 px-3 text-xs">
                    <Plus className="h-3.5 w-3.5 mr-1.5" />
                    Add Activity
                  </Button>
                </div>

                <ActivityList
                  leadId={currentLead.id}
                  pros={pros}
                  onEditActivity={handleEditActivity}
                  onRefresh={onRefresh}
                  refreshKey={activityRefreshKey}
                  currentUser={currentUser}
                />
              </TabsContent>

            </Tabs>
          </div>
        </DialogContent>
      </Dialog>

      {showActivityForm && (
        <ActivityForm
          leadId={currentLead.id}
          pros={pros}
          onClose={handleActivityFormClose}
          onActivityCreated={editingActivity ? handleActivityUpdated : handleActivityCreated}
          currentUser={currentUser}
          editingActivity={editingActivity}
        />
      )}

      {showEditForm && (
        <LeadForm
          lead={currentLead}
          pros={pros}
          onClose={handleEditComplete}
          onLeadUpdated={handleLeadFieldsUpdated}
          currentUser={currentUser}
        />
      )}

      {showQuickStatusChange && (
        <QuickStatusChange
          open={showQuickStatusChange}
          onClose={() => setShowQuickStatusChange(false)}
          onSuccess={() => setShowQuickStatusChange(false)}
          lead={currentLead}
          onLeadUpdated={handleLeadFieldsUpdated}
          onRevert={handleRevertLead}
        />
      )}

    </>
  );
}

/* ── AI cards sub-component to keep the main component lean ── */
function OverviewAiCards({
  currentLead,
  aiSuggestion,
  loadingSuggestion,
  onGetSuggestion,
  aiSummary,
  loadingSummary,
  onGetSummary,
}: {
  currentLead: Lead;
  aiSuggestion: string | null;
  loadingSuggestion: boolean;
  onGetSuggestion: () => void;
  aiSummary: string | null;
  loadingSummary: boolean;
  onGetSummary: () => void;
}) {
  const showSummary = (currentLead.totalInteractions ?? 0) >= 3;

  return (
    <div className={`grid grid-cols-1 ${showSummary ? 'md:grid-cols-2' : ''} gap-3`}>
      <div className="rounded-lg border border-border bg-muted/30 p-4 space-y-3">
        <div className="flex items-center gap-2">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary/10">
            <Sparkles className="h-3.5 w-3.5 text-primary" />
          </div>
          <span className="text-sm font-semibold">AI Next Action</span>
        </div>
        {!aiSuggestion ? (
          <Button onClick={onGetSuggestion} disabled={loadingSuggestion} variant="outline" size="sm" className="w-full">
            {loadingSuggestion ? <Sparkles className="h-3.5 w-3.5 mr-1.5 animate-pulse" /> : <Sparkles className="h-3.5 w-3.5 mr-1.5" />}
            {loadingSuggestion ? 'Analyzing…' : 'Suggest Next Action'}
          </Button>
        ) : (
          <div className="space-y-2">
            <p className="text-sm whitespace-pre-wrap leading-relaxed">{aiSuggestion}</p>
            <Button onClick={onGetSuggestion} disabled={loadingSuggestion} variant="ghost" size="sm" className="w-full text-xs">
              <RefreshCw className="h-3 w-3 mr-1.5" /> Regenerate
            </Button>
          </div>
        )}
      </div>

      {showSummary && (
        <div className="rounded-lg border border-border bg-muted/30 p-4 space-y-3">
          <div className="flex items-center gap-2">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary/10">
              <FileText className="h-3.5 w-3.5 text-primary" />
            </div>
            <span className="text-sm font-semibold">AI Summary</span>
          </div>
          {!aiSummary ? (
            <Button onClick={onGetSummary} disabled={loadingSummary} variant="outline" size="sm" className="w-full">
              {loadingSummary ? <FileText className="h-3.5 w-3.5 mr-1.5 animate-pulse" /> : <FileText className="h-3.5 w-3.5 mr-1.5" />}
              {loadingSummary ? 'Generating…' : 'Generate Summary'}
            </Button>
          ) : (
            <div className="space-y-2">
              <p className="text-sm whitespace-pre-wrap leading-relaxed">{aiSummary}</p>
              <Button onClick={onGetSummary} disabled={loadingSummary} variant="ghost" size="sm" className="w-full text-xs">
                <RefreshCw className="h-3 w-3 mr-1.5" /> Regenerate
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
