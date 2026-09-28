import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@project/components/ui/dialog';
import { Badge } from '@project/components/ui/badge';
import { Separator } from '@project/components/ui/separator';
import { CheckCircle2, Circle, Paperclip, ExternalLink, Calendar, Clock, FileText, Tag } from 'lucide-react';
import type { SelfGenActivity } from './types';

interface SelfGenViewDialogProps {
  activity: SelfGenActivity;
  open: boolean;
  onClose: () => void;
  proName?: string;
}

function formatDate(iso?: string) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

export default function SelfGenViewDialog({ activity, open, onClose, proName }: SelfGenViewDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {activity.completed ? (
              <CheckCircle2 className="h-5 w-5 text-primary shrink-0" />
            ) : (
              <Circle className="h-5 w-5 text-muted-foreground shrink-0" />
            )}
            Self-Gen Activity
          </DialogTitle>
          <DialogDescription>
            {activity.completed ? 'Completed' : 'Open'} activity details
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 pt-1">
          {/* Pro Name */}
          {proName && (
            <DetailRow icon={<Tag className="h-4 w-4" />} label="Pro" value={proName} />
          )}

          {/* Date */}
          <DetailRow
            icon={<Calendar className="h-4 w-4" />}
            label="Date"
            value={formatDate(activity.dateOfActivity)}
          />

          {/* Time Slot */}
          <DetailRow
            icon={<Clock className="h-4 w-4" />}
            label="Time Slot"
            value={activity.timeSlot || '—'}
          />

          {/* Activity Types */}
          <div className="flex items-start gap-3">
            <div className="mt-0.5 text-muted-foreground shrink-0">
              <FileText className="h-4 w-4" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-medium text-muted-foreground mb-1.5">Activity Type</p>
              <div className="flex flex-wrap gap-1.5">
                {(activity.activityType || []).length > 0 ? (
                  activity.activityType!.map(t => (
                    <Badge key={t} variant="secondary" className="text-xs font-normal">
                      {t}
                    </Badge>
                  ))
                ) : (
                  <span className="text-sm text-muted-foreground">—</span>
                )}
              </div>
            </div>
          </div>

          <Separator />

          {/* Notes */}
          <div className="space-y-1.5">
            <p className="text-xs font-medium text-muted-foreground">Notes</p>
            <p className="text-sm whitespace-pre-wrap leading-relaxed">
              {activity.notes || 'No notes'}
            </p>
          </div>

          {/* Attachments */}
          {activity.attachments && activity.attachments.length > 0 && (
            <div className="space-y-1.5">
              <p className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
                <Paperclip className="h-3.5 w-3.5" />
                Attachments
              </p>
              <div className="flex flex-wrap gap-1.5">
                {activity.attachments.map((a, i) => (
                  <a
                    key={i}
                    href={a.url}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md border border-border bg-muted/50 hover:bg-accent transition-colors text-xs"
                  >
                    <span className="truncate max-w-[140px]">{a.filename}</span>
                    <ExternalLink className="h-3 w-3 shrink-0 text-muted-foreground" />
                  </a>
                ))}
              </div>
            </div>
          )}

          {/* Status */}
          <div className="flex items-center gap-2 pt-1 px-3 py-2.5 rounded-lg bg-muted/50">
            {activity.completed ? (
              <CheckCircle2 className="h-4 w-4 text-primary" />
            ) : (
              <Circle className="h-4 w-4 text-muted-foreground" />
            )}
            <span className="text-sm font-medium">
              {activity.completed ? 'Completed' : 'In Progress'}
            </span>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function DetailRow({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="flex items-start gap-3">
      <div className="mt-0.5 text-muted-foreground shrink-0">{icon}</div>
      <div className="flex-1 min-w-0">
        <p className="text-xs font-medium text-muted-foreground">{label}</p>
        <p className="text-sm font-medium">{value}</p>
      </div>
    </div>
  );
}
