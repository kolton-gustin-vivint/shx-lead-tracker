import React, { useState, useRef } from 'react';
import { Card, CardContent } from '@project/components/ui/card';
import { Button } from '@project/components/ui/button';
import { Input } from '@project/components/ui/input';
import { Label } from '@project/components/ui/label';
import { Textarea } from '@project/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue, SelectGroup, SelectLabel, SelectSeparator } from '@project/components/ui/select';
import { Badge } from '@project/components/ui/badge';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@project/components/ui/collapsible';
import { Plus, Upload, X, Loader2, ChevronDown } from 'lucide-react';
import { toast } from 'sonner';
import { createSelfGenActivity } from '@/lib/api';
import { uploadFile } from '@/lib/upload';
import { TIME_SLOTS, ACTIVITY_TYPES } from './constants';

interface Pro {
  id: string;
  displayName?: string;
  proName?: string;
  role?: string;
}

interface SelfGenFormProps {
  onCreated: () => void;
  /** When provided, shows a Pro selector dropdown (manager mode) */
  pros?: Pro[];
}

export default function SelfGenForm({ onCreated, pros }: SelfGenFormProps) {
  const today = new Date().toISOString().split('T')[0];
  const [open, setOpen] = useState(false);
  const [date, setDate] = useState(today);
  const [timeSlot, setTimeSlot] = useState('');
  const [selectedTypes, setSelectedTypes] = useState<string[]>([]);
  const [notes, setNotes] = useState('');
  const [files, setFiles] = useState<{ file: File; name: string }[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [selectedProId, setSelectedProId] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const showProPicker = !!pros && pros.length > 0;

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
    const newFiles = Array.from(e.target.files || []);
    setFiles(prev => [...prev, ...newFiles.map(f => ({ file: f, name: f.name }))]);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const removeFile = (index: number) => {
    setFiles(prev => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = async () => {
    if (!date || !timeSlot || selectedTypes.length === 0) {
      toast.error('Please fill in date, time slot, and at least one activity type');
      return;
    }
    if (showProPicker && !selectedProId) {
      toast.error('Please select a Pro');
      return;
    }
    setSubmitting(true);
    try {
      let attachments: { url: string; filename: string }[] | undefined;
      if (files.length > 0) {
        const uploaded = await Promise.all(
          files.map(f => uploadFile({ data: f.file, filename: f.name }))
        );
        attachments = uploaded.map((u, i) => ({ url: u.fileUrl, filename: files[i].name }));
      }

      await createSelfGenActivity({
        dateOfActivity: new Date(date + 'T00:00:00').toISOString(),
        timeSlot,
        activityType: selectedTypes,
        notes: notes || undefined,
        attachments,
        proId: showProPicker ? selectedProId : undefined,
      });

      toast.success('Activity logged!');
      setTimeSlot('');
      setSelectedTypes([]);
      setNotes('');
      setFiles([]);
      setSelectedProId('');
      setOpen(false);
      onCreated();
    } catch (error) {
      console.error(error);
      toast.error('Failed to log activity');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <Card className="shadow-premium overflow-hidden">
        <CollapsibleTrigger asChild>
          <button className="w-full flex items-center justify-between px-5 py-3.5 text-left hover:bg-muted/30 transition-colors">
            <div className="flex items-center gap-2.5">
              <div className="flex items-center justify-center h-8 w-8 rounded-lg bg-primary/10">
                <Plus className="h-4 w-4 text-primary" />
              </div>
              <div>
                <span className="text-sm font-semibold block">Log Self-Gen Activity</span>
                {!open && <span className="text-xs text-muted-foreground">Tap to expand</span>}
              </div>
            </div>
            <ChevronDown className={`h-4 w-4 text-muted-foreground transition-transform duration-200 ${open ? 'rotate-180' : ''}`} />
          </button>
        </CollapsibleTrigger>

        <CollapsibleContent>
          <CardContent className="pt-0 pb-5 px-5 space-y-5 border-t border-border">
            {/* Row 1: Date, Time Slot */}
            <div className={`grid grid-cols-1 sm:grid-cols-2 ${showProPicker ? 'lg:grid-cols-5' : 'lg:grid-cols-4'} gap-4 pt-4`}>
              {showProPicker && (
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium text-muted-foreground">Pro</Label>
                  <Select value={selectedProId} onValueChange={setSelectedProId}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select person…" />
                    </SelectTrigger>
                    <SelectContent>
                      {(() => {
                        const managers = pros!.filter(p => p.role === 'Manager');
                        const reps = pros!.filter(p => p.role !== 'Manager');
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
              )}
              <div className="space-y-1.5">
                <Label className="text-xs font-medium text-muted-foreground">Date</Label>
                <Input type="date" value={date} onChange={e => setDate(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-medium text-muted-foreground">Time Slot</Label>
                <Select value={timeSlot} onValueChange={setTimeSlot}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select slot…" />
                  </SelectTrigger>
                  <SelectContent>
                    {TIME_SLOTS.map(slot => (
                      <SelectItem key={slot} value={slot}>{slot}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Activity Type multi-select */}
              <div className="sm:col-span-2 space-y-1.5">
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
            </div>

            {/* Row 2: Notes, Attachments */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label className="text-xs font-medium text-muted-foreground">Notes</Label>
                <Textarea
                  value={notes}
                  onChange={e => setNotes(e.target.value)}
                  placeholder="Optional notes…"
                  rows={3}
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-medium text-muted-foreground">Attachments</Label>
                <div
                  className="h-[82px] rounded-md border border-dashed border-border bg-muted/50 flex flex-col items-center justify-center cursor-pointer hover:bg-muted transition-colors"
                  onClick={() => fileInputRef.current?.click()}
                >
                  <Upload className="h-4 w-4 text-muted-foreground mb-1" />
                  <span className="text-xs text-muted-foreground">Click to upload files</span>
                  <input
                    ref={fileInputRef}
                    type="file"
                    multiple
                    className="hidden"
                    onChange={handleFileChange}
                  />
                </div>
                {files.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 mt-1.5">
                    {files.map((f, i) => (
                      <Badge key={i} variant="secondary" className="gap-1 pr-1">
                        <span className="truncate max-w-[120px] text-xs">{f.name}</span>
                        <button onClick={() => removeFile(i)} className="hover:text-destructive">
                          <X className="h-3 w-3" />
                        </button>
                      </Badge>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Submit */}
            <div className="flex justify-end">
              <Button onClick={handleSubmit} disabled={submitting} className="min-w-[140px]">
                {submitting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Plus className="h-4 w-4 mr-2" />}
                Log Activity
              </Button>
            </div>
          </CardContent>
        </CollapsibleContent>
      </Card>
    </Collapsible>
  );
}
