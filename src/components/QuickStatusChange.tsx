import React, { useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@project/components/ui/dialog';
import { Button } from '@project/components/ui/button';
import { Label } from '@project/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@project/components/ui/select';
import { CheckCircle } from 'lucide-react';
import { toast } from 'sonner';
import { updateLead, GetLeadsOutputType } from '@/lib/api';
import CloseReasonDialog from './CloseReasonDialog';
import { useStatusOptions } from '../contexts/StatusOptionsContext';

type Lead = GetLeadsOutputType['leads'][0];

interface QuickStatusChangeProps {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
  lead: Lead;
  onLeadUpdated?: (updates: Partial<Lead>) => void;
  onRevert?: () => void;
}

export default function QuickStatusChange({
  open,
  onClose,
  onSuccess,
  lead,
  onLeadUpdated,
  onRevert,
}: QuickStatusChangeProps) {
  const { statusOptions } = useStatusOptions();
  const [newStatus, setNewStatus] = useState(lead.status || 'NEW');
  const [showCloseReasonDialog, setShowCloseReasonDialog] = useState(false);

  const requiresCloseReason = (status: string) => {
    return status.startsWith('CLOSED') && status !== 'CLOSED | Sold';
  };

  const formatStatusLabel = (status: string) => {
    if (status === 'NEW') return 'New';
    if (status.startsWith('IN-PROGRESS')) return status.replace('IN-PROGRESS | ', 'In Progress - ');
    if (status.startsWith('CLOSED')) return status.replace('CLOSED | ', 'Closed - ');
    return status;
  };

  const handleSubmit = async () => {
    if (requiresCloseReason(newStatus) && !requiresCloseReason(lead.status || '')) {
      setShowCloseReasonDialog(true);
      return;
    }
    await updateStatus();
  };

  const updateStatus = async (closeReason?: string) => {
    // Optimistic update — apply to UI immediately before API round-trip
    onLeadUpdated?.({ status: newStatus, ...(closeReason ? { closeReason } : {}) });
    // Close dialog right away for a snappy feel
    onSuccess();
    onClose();

    try {
      await updateLead({ id: lead.id, status: newStatus, closeReason });
      toast.success('Status updated successfully');
    } catch (error) {
      // Revert the optimistic update if save failed
      onRevert?.();
      toast.error('Failed to update status — change was reverted');
      console.error('Error updating status:', error);
    }
  };

  const handleCloseReasonSubmit = async (reason: string) => {
    setShowCloseReasonDialog(false);
    await updateStatus(reason);
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onClose}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Change Status</DialogTitle>
            <DialogDescription>
              Update the status for {lead.customerName || 'this lead'}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="status">New Status</Label>
              <Select value={newStatus} onValueChange={setNewStatus}>
                <SelectTrigger>
                  <SelectValue placeholder="Select status" />
                </SelectTrigger>
                <SelectContent>
                  {statusOptions.map(status => (
                    <SelectItem key={status} value={status}>
                      {formatStatusLabel(status)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button
              type="button"
              onClick={handleSubmit}
              disabled={newStatus === lead.status}
              className="min-w-[120px]"
            >
              <CheckCircle className="h-4 w-4 mr-2" />
              Update Status
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <CloseReasonDialog
        open={showCloseReasonDialog}
        onClose={() => setShowCloseReasonDialog(false)}
        onConfirm={handleCloseReasonSubmit}
        status={newStatus}
        customerName={lead.customerName}
        loading={false}
      />
    </>
  );
}
