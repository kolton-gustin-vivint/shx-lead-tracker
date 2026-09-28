import React, { useState, useRef } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@project/components/ui/dialog';
import { Button } from '@project/components/ui/button';
import { Input } from '@project/components/ui/input';
import { Label } from '@project/components/ui/label';
import { Textarea } from '@project/components/ui/textarea';
import { Checkbox } from '@project/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@project/components/ui/select';
import { Badge } from '@project/components/ui/badge';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@project/components/ui/alert-dialog';
import { Upload, X, Loader2, ExternalLink, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { updateSelfGenActivity, deleteSelfGenActivity } from '@/lib/api';
import { uploadFile } from '@/lib/upload';
import { TIME_SLOTS, ACTIVITY_TYPES } from './constants';
import type { SelfGenActivity } from './types';

interface SelfGenEditDialogProps {
  activity: SelfGenActivity;
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
  allowDelete?: boolean;
  onDeleted?: () => void;
}

export default function SelfGenEditDialog({ activity, open, onClose, onSaved, allowDelete, onDeleted }: SelfGenEditDialogProps) {
  const dateStr = activity.dateOfActivity
    ? new Date(activity.dateOfActivity).toISOString().split('T')[0]
    : '';
  const [date, setDate] = useState(dateStr);
  const [timeSlot, setTimeSlot] = useState(activity.timeSlot || '');
  const [selectedTypes, setSelectedTypes] = useState<string[]>(activity.activityType || []);
  const [notes, setNotes] = useState(activity.notes || '');
  const [completed, setCompleted] = useState(activity.completed);
  const [existingAttachments, setExistingAttachments] = useState(activity.attachments || []);
  const [newFiles, setNewFiles] = useState<{ file: File; name: string }[]>([]);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const toggleType = (type: string) => {
    setSelectedTypes(prev => {
      if (prev.includes(type)) return prev.filter(t => t !== type);
      if (prev.length >= 2) {
        toast.error('Maximum 2 activity types per time slot');
        return prev;
      }
      return [...prev, type];
    });
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    setNewFiles(prev => [...prev, ...files.map(f => ({ file: f, name: f.name }))]);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleSave = async () => {
    if (!date || !timeSlot || selectedTypes.length === 0) {
      toast.error('Date, time slot, and at least one activity type are required');
      return;
    }
    setSaving(true);
    try {
      // Upload new files
      let allAttachments: { url: string; filename: string }[] = existingAttachments.map(a => ({
        url: a.url,
        filename: a.filename,
      }));

      if (newFiles.length > 0) {
        const uploaded = await Promise.all(
          newFiles.map(f => uploadFile({ data: f.file, filename: f.name }))
        );
        allAttachments = [
          ...allAttachments,
          ...uploaded.map((u, i) => ({ url: u.fileUrl, filename: newFiles[i].name })),
        ];
      }

      await updateSelfGenActivity({
        id: activity.id,
        dateOfActivity: new Date(date + 'T00:00:00').toISOString(),
        timeSlot,
        activityType: selectedTypes,
        notes,
        completed,
        attachments: allAttachments.length > 0 ? allAttachments : undefined,
      });

      toast.success('Activity updated');
      onSaved();
      onClose();
    } catch (error) {
      console.error(error);
      toast.error('Failed to update activity');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Edit Self-Gen Activity</DialogTitle>
          <DialogDescription>Update this activity's details.</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Date + Time Slot */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-muted-foreground">Date</Label>
              <Input type="date" value={date} onChange={e => setDate(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-muted-foreground">Time Slot</Label>
              <Select value={timeSlot} onValueChange={setTimeSlot}>
                <SelectTrigger><SelectValue placeholder="Select…" /></SelectTrigger>
                <SelectContent>
                  {TIME_SLOTS.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Activity Type */}
          <div className="space-y-1.5">
            <Label className="text-xs font-medium text-muted-foreground">
              Activity Type <span className="text-muted-foreground/60">(max 2)</span>
            </Label>
            <div className="flex flex-wrap gap-1.5">
              {ACTIVITY_TYPES.map(type => {
                const isSelected = selectedTypes.includes(type);
                return (
                  <button
                    key={type}
                    type="button"
                    onClick={() => toggleType(type)}
                    className={`px-2.5 py-1 rounded-full text-xs font-medium border transition-colors ${
                      isSelected
                        ? 'bg-primary text-primary-foreground border-primary'
                        : 'bg-muted text-muted-foreground border-border hover:bg-accent hover:text-accent-foreground'
                    }`}
                  >
                    {type}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Notes */}
          <div className="space-y-1.5">
            <Label className="text-xs font-medium text-muted-foreground">Notes</Label>
            <Textarea value={notes} onChange={e => setNotes(e.target.value)} rows={3} />
          </div>

          {/* Attachments */}
          <div className="space-y-1.5">
            <Label className="text-xs font-medium text-muted-foreground">Attachments</Label>
            {existingAttachments.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mb-1.5">
                {existingAttachments.map((a, i) => (
                  <Badge key={i} variant="outline" className="gap-1 pr-1">
                    <a href={a.url} target="_blank" rel="noreferrer" className="flex items-center gap-1 text-xs" onClick={e => e.stopPropagation()}>
                      <span className="truncate max-w-[100px]">{a.filename}</span>
                      <ExternalLink className="h-2.5 w-2.5" />
                    </a>
                    <button onClick={() => setExistingAttachments(prev => prev.filter((_, j) => j !== i))} className="hover:text-destructive ml-0.5">
                      <X className="h-3 w-3" />
                    </button>
                  </Badge>
                ))}
              </div>
            )}
            {newFiles.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mb-1.5">
                {newFiles.map((f, i) => (
                  <Badge key={`new-${i}`} variant="secondary" className="gap-1 pr-1">
                    <span className="truncate max-w-[100px] text-xs">{f.name}</span>
                    <button onClick={() => setNewFiles(prev => prev.filter((_, j) => j !== i))} className="hover:text-destructive">
                      <X className="h-3 w-3" />
                    </button>
                  </Badge>
                ))}
              </div>
            )}
            <Button variant="outline" size="sm" onClick={() => fileInputRef.current?.click()}>
              <Upload className="h-3.5 w-3.5 mr-1.5" /> Add Files
            </Button>
            <input ref={fileInputRef} type="file" multiple className="hidden" onChange={handleFileChange} />
          </div>

          {/* Completed */}
          <div className="flex items-center gap-2">
            <Checkbox
              id="completed"
              checked={completed}
              onCheckedChange={v => setCompleted(v === true)}
            />
            <Label htmlFor="completed" className="text-sm cursor-pointer">Mark as completed</Label>
          </div>
        </div>

        <DialogFooter className="flex-col-reverse sm:flex-row sm:justify-between gap-2">
          {allowDelete ? (
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="destructive" size="sm" disabled={deleting} className="gap-1.5">
                  <Trash2 className="h-3.5 w-3.5" />
                  Delete
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Delete Activity</AlertDialogTitle>
                  <AlertDialogDescription>
                    This will permanently delete this Self-Gen activity. This action cannot be undone.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction
                    onClick={async () => {
                      setDeleting(true);
                      try {
                        await deleteSelfGenActivity({ id: activity.id });
                        toast.success('Activity deleted');
                        onDeleted?.();
                      } catch (error) {
                        console.error(error);
                        toast.error('Failed to delete activity');
                      } finally {
                        setDeleting(false);
                      }
                    }}
                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                  >
                    Delete
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          ) : <div />}
          <div className="flex gap-2">
            <Button variant="outline" onClick={onClose}>Cancel</Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              Save Changes
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
