import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@project/components/ui/card';
import { Button } from '@project/components/ui/button';
import { Badge } from '@project/components/ui/badge';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@project/components/ui/alert-dialog';
import { Skeleton } from '@project/components/ui/skeleton';
import { MessageSquare, Phone, User, Calendar, Edit2, FileText, Trash2, RefreshCw } from 'lucide-react';
import { getActivities, deleteActivity, GetActivitiesOutputType, GetRepsOutputType } from '@/lib/api';
import { toast } from 'sonner';

type Activity = GetActivitiesOutputType['activities'][0];
type Pro = GetRepsOutputType['pros'][0];

interface ActivityListProps {
  leadId: string;
  pros: Pro[];
  onEditActivity?: (activity: Activity) => void;
  onRefresh?: () => void;
  refreshKey?: number;
  currentUser?: {
    id: string;
    proId?: string;
    role: string;
  };
}

const getActivityIcon = (type?: string) => {
  switch (type) {
    case 'Call':
      return <Phone className="h-4 w-4" />;
    case 'Text':
      return <MessageSquare className="h-4 w-4" />;
    case 'In-Person':
      return <User className="h-4 w-4" />;
    case 'Note':
    default:
      return <FileText className="h-4 w-4" />;
  }
};

const getActivityColor = (type?: string) => {
  switch (type) {
    case 'Call':
      return 'bg-accent/15 text-accent-foreground border border-accent/30';
    case 'Text':
      return 'bg-primary/15 text-primary border border-primary/30';
    case 'In-Person':
      return 'bg-secondary/15 text-secondary border border-secondary/30';
    case 'Follow-Up':
      return 'bg-destructive/15 text-destructive border border-destructive/30';
    case 'Note':
    default:
      return 'bg-muted text-muted-foreground border border-border';
  }
};

export default function ActivityList({ leadId, pros, onEditActivity, onRefresh, refreshKey, currentUser }: ActivityListProps) {
  const [activities, setActivities] = useState<Activity[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadActivities = async (isRefresh = false) => {
    try {
      if (isRefresh) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }
      const result = await getActivities({ leadId });
      setActivities(result.activities.sort((a, b) => 
        new Date(b.date || '').getTime() - new Date(a.date || '').getTime()
      ));
    } catch (error) {
      toast.error('Failed to load activities');
      console.error('Error loading activities:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadActivities();
  }, [leadId, refreshKey]);

  const handleRefresh = async () => {
    await loadActivities(true);
    if (onRefresh) {
      onRefresh();
    }
  };

  const getProName = (proIds?: string[]) => {
    if (!proIds || proIds.length === 0) return 'Unknown';
    const pro = pros.find(p => proIds.includes(p.id));
    return pro?.displayName || pro?.proName || 'Unknown';
  };

  const canEditActivity = (activity: Activity) => {
    if (!currentUser) return false;
    // Managers can edit all activities
    if (currentUser.role === 'Manager') return true;
    // Individual contributors can only edit their own activities
    return activity.assignedPro?.includes(currentUser.proId || '');
  };

  const handleDeleteActivity = async (activityId: string) => {
    try {
      await deleteActivity({ activityId });
      toast.success('Activity deleted successfully');
      loadActivities();
    } catch (error) {
      toast.error('Failed to delete activity');
      console.error('Error deleting activity:', error);
    }
  };

  if (loading) {
    return (
      <div className="space-y-3">
        {[1, 2, 3].map(i => (
          <Card key={i}>
            <CardHeader className="pb-3">
              <div className="flex items-center gap-2">
                <Skeleton className="h-5 w-5 rounded" />
                <Skeleton className="h-5 w-16 rounded-full" />
                <Skeleton className="h-4 w-24" />
              </div>
            </CardHeader>
            <CardContent className="pt-0">
              <Skeleton className="h-4 w-full mb-2" />
              <Skeleton className="h-4 w-2/3" />
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button
          onClick={handleRefresh}
          variant="outline"
          size="sm"
          disabled={refreshing}
          className="flex items-center gap-2"
        >
          <RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>

      {activities.length === 0 ? (
        <div className="text-center py-8 text-muted-foreground">
          No activities recorded yet. Add the first activity to start tracking interactions.
        </div>
      ) : (
        activities.map((activity) => (
          <Card key={activity.id} className="hover:shadow-md transition-shadow">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  {getActivityIcon(activity.type)}
                  <Badge className={getActivityColor(activity.type)}>
                    {activity.type || 'Note'}
                  </Badge>
                  {activity.date && (
                    <div className="flex items-center gap-1 text-sm text-muted-foreground">
                      <Calendar className="h-3 w-3" />
                      {new Date(activity.date).toLocaleDateString()}
                    </div>
                  )}
                </div>
                {canEditActivity(activity) && (
                  <div className="flex items-center gap-1">
                    {onEditActivity && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => onEditActivity(activity)}
                        className="hover:bg-primary/10"
                      >
                        <Edit2 className="h-3 w-3" />
                      </Button>
                    )}
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="hover:bg-destructive/10 hover:text-destructive"
                        >
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Delete Activity</AlertDialogTitle>
                          <AlertDialogDescription>
                            Are you sure you want to delete this activity? This action cannot be undone.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancel</AlertDialogCancel>
                          <AlertDialogAction
                            onClick={() => handleDeleteActivity(activity.id)}
                            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                          >
                            Delete
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                )}
              </div>
            </CardHeader>
            <CardContent className="pt-0">
              {activity.content && (
                <p className="text-sm whitespace-pre-wrap mb-2">{activity.content}</p>
              )}
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span>By: {getProName(activity.assignedPro)}</span>
                {activity.daysSinceInteraction !== undefined && (
                  <span>{activity.daysSinceInteraction} days ago</span>
                )}
              </div>
            </CardContent>
          </Card>
        ))
      )}
    </div>
  );
}
