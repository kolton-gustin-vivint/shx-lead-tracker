import React, { useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@project/components/ui/dialog';
import { Button } from '@project/components/ui/button';
import { Label } from '@project/components/ui/label';
import { Textarea } from '@project/components/ui/textarea';
import { AlertCircle, Loader2, X } from 'lucide-react';

interface CloseReasonDialogProps {
  open: boolean;
  onClose: () => void;
  onConfirm: (reason: string) => void;
  status: string;
  customerName?: string;
  loading?: boolean;
}

export default function CloseReasonDialog({ 
  open, 
  onClose, 
  onConfirm, 
  status, 
  customerName,
  loading = false
}: CloseReasonDialogProps) {
  const [reason, setReason] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = () => {
    if (!reason.trim()) {
      setError('Close reason is required for this status');
      return;
    }
    onConfirm(reason.trim());
    setReason('');
    setError('');
  };

  const handleClose = () => {
    if (loading) return; // Prevent closing during loading
    setReason('');
    setError('');
    onClose();
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'CLOSED | Not Interested':
        return 'Not Interested';
      case 'CLOSED | Blocked by Objection(s)':
        return 'Blocked by Objection(s)';
      case 'CLOSED | Appointment Set, No Sale':
        return 'Appointment Set, No Sale';
      case 'CLOSED | Missing Contact Info':
        return 'Missing Contact Info';
      default:
        return status;
    }
  };

  return (
    <Dialog open={open} onOpenChange={loading ? undefined : handleClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertCircle className="h-5 w-5 text-destructive" />
            Close Reason Required
          </DialogTitle>
          <DialogDescription>
            You are closing this lead as "{getStatusLabel(status)}" for{' '}
            <span className="font-medium">{customerName || 'this customer'}</span>.
            Please provide a reason for closing this lead.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="closeReason">
              Close Reason <span className="text-destructive">*</span>
            </Label>
            <Textarea
              id="closeReason"
              value={reason}
              onChange={(e) => {
                setReason(e.target.value);
                if (error) setError('');
              }}
              placeholder="Please explain why this lead is being closed..."
              rows={4}
              disabled={loading}
              className={error ? 'border-destructive focus:border-destructive' : ''}
            />
            {error && (
              <p className="text-sm text-destructive flex items-center gap-1">
                <AlertCircle className="h-3 w-3" />
                {error}
              </p>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button 
            type="button" 
            variant="outline" 
            onClick={handleClose}
            disabled={loading}
          >
            <X className="h-4 w-4 mr-2" />
            Cancel
          </Button>
          <Button 
            type="button" 
            onClick={handleSubmit}
            disabled={loading || !reason.trim()}
            className="min-w-[120px]"
          >
            {loading ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Closing...
              </>
            ) : (
              <>
                <AlertCircle className="h-4 w-4 mr-2" />
                Close Lead
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
