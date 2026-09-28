import React, { useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@project/components/ui/dialog';
import { Button } from '@project/components/ui/button';
import { Input } from '@project/components/ui/input';
import { Label } from '@project/components/ui/label';
import { Textarea } from '@project/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@project/components/ui/select';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { updateLead, GetLeadsOutputType, GetRepsOutputType } from '@/lib/api';
import CloseReasonDialog from './CloseReasonDialog';
import { useStatusOptions } from '../contexts/StatusOptionsContext';
type Lead = GetLeadsOutputType['leads'][0];
type Pro = GetRepsOutputType['pros'][0];
interface LeadFormProps {
  lead: Lead | null;
  pros: Pro[];
  onClose: () => void;
  onLeadUpdated?: (updates: Partial<Lead>) => void;
  currentUser: {
    id: string;
    proId?: string;
    role: string;
  };
}
export default function LeadForm({
  lead,
  pros,
  onClose,
  onLeadUpdated,
  currentUser
}: LeadFormProps) {
  const {
    statusOptions
  } = useStatusOptions();
  const [formData, setFormData] = useState({
    status: lead?.status || 'NEW',
    assignedPro: lead?.assignedPro?.[0] || '',
    opportunityName: lead?.opportunityName || '',
    customerName: lead?.customerName || '',
    customerPhone: lead?.customerPhone || '',
    customerEmail: lead?.customerEmail || '',
    leadDetails: lead?.leadDetails || '',
    assignmentNeeded: lead?.assignmentNeeded || false
  });
  const [loading, setLoading] = useState(false);
  const [showCloseReasonDialog, setShowCloseReasonDialog] = useState(false);
  const [pendingStatus, setPendingStatus] = useState<string>('');
  const isManager = currentUser.role === 'Manager';

  // Define which fields are editable based on user role
  const fieldPermissions = {
    status: true,
    // All users can edit status
    assignedPro: isManager,
    // Only managers can assign pros
    opportunityName: isManager,
    // Only managers can edit opportunity details
    customerName: isManager,
    // Only managers can edit customer info
    customerPhone: isManager,
    // Only managers can edit customer info
    customerEmail: isManager,
    // Only managers can edit customer info
    leadDetails: true // All users can edit lead details/notes
  };

  // Check if status requires close reason (all CLOSED except "CLOSED | Sold")
  const requiresCloseReason = (status: string) => {
    return status.startsWith('CLOSED') && status !== 'CLOSED | Sold';
  };

  // Format status for display
  const formatStatusLabel = (status: string) => {
    if (status === 'NEW') return 'New';
    if (status.startsWith('IN-PROGRESS')) {
      return status.replace('IN-PROGRESS | ', 'In Progress - ');
    }
    if (status.startsWith('CLOSED')) {
      return status.replace('CLOSED | ', 'Closed - ');
    }
    return status;
  };
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!lead) return;
    setLoading(true);
    try {
      await updateLead({
        id: lead.id,
        status: formData.status,
        assignedPro: formData.assignedPro ? [formData.assignedPro] : undefined,
        dateAssigned: formData.assignedPro && !lead.assignedPro ? new Date().toISOString().split('T')[0] : undefined,
        opportunityName: formData.opportunityName,
        customerName: formData.customerName,
        customerPhone: formData.customerPhone,
        customerEmail: formData.customerEmail,
        leadDetails: formData.leadDetails,
        assignmentNeeded: formData.assignmentNeeded
      });
      // Surgical update — notify parent of new values instead of triggering a full table reload
      onLeadUpdated?.({
        status: formData.status,
        assignedPro: formData.assignedPro ? [formData.assignedPro] : lead.assignedPro,
        opportunityName: formData.opportunityName,
        customerName: formData.customerName,
        customerPhone: formData.customerPhone,
        customerEmail: formData.customerEmail,
        leadDetails: formData.leadDetails,
        assignmentNeeded: formData.assignmentNeeded,
      });
      toast.success('Lead updated successfully');
      onClose();
    } catch (error) {
      toast.error('Failed to update lead');
      console.error('Error updating lead:', error);
    } finally {
      setLoading(false);
    }
  };
  const handleSubmitWithCloseReason = async (closeReason: string) => {
    if (!lead) return;
    setLoading(true);
    try {
      await updateLead({
        id: lead.id,
        status: pendingStatus,
        assignedPro: formData.assignedPro ? [formData.assignedPro] : undefined,
        dateAssigned: formData.assignedPro && !lead.assignedPro ? new Date().toISOString().split('T')[0] : undefined,
        opportunityName: formData.opportunityName,
        customerName: formData.customerName,
        customerPhone: formData.customerPhone,
        customerEmail: formData.customerEmail,
        leadDetails: formData.leadDetails,
        assignmentNeeded: formData.assignmentNeeded,
        closeReason: closeReason
      });
      onLeadUpdated?.({
        status: pendingStatus,
        assignedPro: formData.assignedPro ? [formData.assignedPro] : lead.assignedPro,
        opportunityName: formData.opportunityName,
        customerName: formData.customerName,
        customerPhone: formData.customerPhone,
        customerEmail: formData.customerEmail,
        leadDetails: formData.leadDetails,
        assignmentNeeded: formData.assignmentNeeded,
      });
      toast.success('Lead updated successfully');
      setShowCloseReasonDialog(false);
      setPendingStatus('');
      onClose();
    } catch (error) {
      toast.error('Failed to update lead');
      console.error('Error updating lead:', error);
    } finally {
      setLoading(false);
    }
  };
  const handleInputChange = (field: string, value: string | boolean) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
  };
  const handleStatusChange = (newStatus: string) => {
    // If changing to a CLOSED status (except "CLOSED | Sold"), check if we need close reason
    if (requiresCloseReason(newStatus) && !requiresCloseReason(lead?.status || '')) {
      // Only prompt if we're changing FROM a non-closed status TO a closed status that requires reason
      setPendingStatus(newStatus);
      setShowCloseReasonDialog(true);
    } else {
      // For all other status changes, update immediately
      handleInputChange('status', newStatus);
    }
  };
  const handleCloseReasonCancel = () => {
    setShowCloseReasonDialog(false);
    setPendingStatus('');
  };
  if (!lead) return null;
  return <>
      <Dialog open={true} onOpenChange={onClose}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit Lead</DialogTitle>
            <DialogDescription>
              Update lead information for {lead.customerName || 'this lead'}
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Lead Status */}
              <div className="space-y-2">
                <Label htmlFor="status">Status</Label>
                <Select value={formData.status} onValueChange={handleStatusChange} disabled={!fieldPermissions.status}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select status" />
                  </SelectTrigger>
                  <SelectContent>
                    {statusOptions.map(status => <SelectItem key={status} value={status}>
                        {formatStatusLabel(status)}
                      </SelectItem>)}
                  </SelectContent>
                </Select>
              </div>

              {/* Assigned Rep */}
              <div className="space-y-2">
                <Label htmlFor="assignedPro">Assigned Pro</Label>
                <Select value={formData.assignedPro} onValueChange={value => handleInputChange('assignedPro', value)} disabled={!fieldPermissions.assignedPro}>
                  <SelectTrigger className="">
                    <SelectValue placeholder="Select pro" />
                  </SelectTrigger>
                  <SelectContent>
                    {pros.map(pro => <SelectItem key={pro.id} value={pro.id}>
                        {pro.displayName || pro.proName}
                      </SelectItem>)}
                  </SelectContent>
                </Select>
              </div>

              {/* Opportunity Name */}
              <div className="space-y-2">
                <Label htmlFor="opportunityName">Opportunity Name</Label>
                <Input id="opportunityName" value={formData.opportunityName} onChange={e => handleInputChange('opportunityName', e.target.value)} placeholder="Enter opportunity name" disabled={!fieldPermissions.opportunityName} />
              </div>

              {/* Customer Name */}
              <div className="space-y-2">
                <Label htmlFor="customerName">Customer Name</Label>
                <Input id="customerName" value={formData.customerName} onChange={e => handleInputChange('customerName', e.target.value)} placeholder="Enter customer name" disabled={!fieldPermissions.customerName} />
              </div>

              {/* Customer Phone */}
              <div className="space-y-2">
                <Label htmlFor="customerPhone">Customer Phone</Label>
                <Input id="customerPhone" value={formData.customerPhone} onChange={e => handleInputChange('customerPhone', e.target.value)} placeholder="Enter phone number" disabled={!fieldPermissions.customerPhone} />
              </div>

              {/* Customer Email */}
              <div className="space-y-2">
                <Label htmlFor="customerEmail">Customer Email</Label>
                <Input id="customerEmail" type="email" value={formData.customerEmail} onChange={e => handleInputChange('customerEmail', e.target.value)} placeholder="Enter email address" disabled={!fieldPermissions.customerEmail} className="" />
              </div>
            </div>

            {/* Lead Details */}
            <div className="space-y-2">
              <Label htmlFor="leadDetails">Lead Details</Label>
              <Textarea id="leadDetails" value={formData.leadDetails} onChange={e => handleInputChange('leadDetails', e.target.value)} placeholder="Enter lead details and notes" rows={4} disabled={!fieldPermissions.leadDetails} className="" />
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={onClose}>
                Cancel
              </Button>
              <Button type="submit" disabled={loading}>
                {loading && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                {loading ? 'Updating…' : 'Update Lead'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <CloseReasonDialog open={showCloseReasonDialog} onClose={handleCloseReasonCancel} onConfirm={handleSubmitWithCloseReason} status={pendingStatus} customerName={lead?.customerName} />
    </>;
}
