import React, { useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@project/components/ui/dialog';
import { Button } from '@project/components/ui/button';
import { Input } from '@project/components/ui/input';
import { Label } from '@project/components/ui/label';
import { Textarea } from '@project/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@project/components/ui/select';
import { toast } from 'sonner';
import { createActivity, updateActivity, GetRepsOutputType } from '@/lib/api';
import { logAuditEvent } from '../utils/auditLogger';

type Pro = GetRepsOutputType['pros'][0];

interface ActivityFormProps {
  leadId: string;
  pros: Pro[];
  onClose: () => void;
  onActivityCreated: () => void;
  currentUser: {
    id: string;
    email: string;
    proId?: string;
    proName: string;
    displayName: string;
    role: string;
  };
  editingActivity?: any;
}

export default function ActivityForm({ leadId, pros, onClose, onActivityCreated, currentUser, editingActivity }: ActivityFormProps) {
  const [formData, setFormData] = useState({
    type: editingActivity?.type || 'Note',
    content: editingActivity?.content || '',
    date: editingActivity?.date ? new Date(editingActivity.date).toISOString().split('T')[0] : new Date().toISOString().split('T')[0],
    assignedPro: editingActivity?.assignedPro?.[0] || '',
    followUpDate: editingActivity?.followUpDate ? new Date(editingActivity.followUpDate).toISOString().split('T')[0] : '',
  });
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.content.trim()) {
      toast.error('Please enter activity content');
      return;
    }

    // Validate follow-up date for Follow-Up activities
    if (formData.type === 'Follow-Up' && !formData.followUpDate) {
      toast.error('Follow-up date is required for Follow-Up activities');
      return;
    }

    setLoading(true);
    try {
      if (editingActivity) {
        await updateActivity({
          activityId: editingActivity.id,
          type: formData.type,
          content: formData.content,
          date: formData.date,
          assignedPro: formData.assignedPro ? [formData.assignedPro] : undefined,
          followUpDate: formData.type === 'Follow-Up' ? formData.followUpDate : undefined,
        });
      } else {
        await createActivity({
          relatedLead: leadId,
          assignedPro: formData.assignedPro ? [formData.assignedPro] : undefined,
          date: formData.date,
          type: formData.type,
          content: formData.content,
          followUpDate: formData.type === 'Follow-Up' ? formData.followUpDate : undefined,
        });
      }
      
      // Log activity creation
      logAuditEvent({
        userEmail: currentUser.email,
        userName: currentUser.displayName || currentUser.proName,
        action: 'Create Activity',
        leadId: leadId,
        details: `${editingActivity ? 'Updated' : 'Created'} ${formData.type} activity: ${formData.content.substring(0, 100)}${formData.content.length > 100 ? '...' : ''}`
      });
      
      onActivityCreated();
    } catch (error) {
      toast.error(editingActivity ? 'Failed to update activity' : 'Failed to create activity');
      console.error('Error with activity:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({
      ...prev,
      [field]: value,
    }));
  };

  const handleTypeChange = (value: string) => {
    setFormData(prev => ({
      ...prev,
      type: value,
      // Clear follow-up date if switching away from Follow-Up
      followUpDate: value === 'Follow-Up' ? prev.followUpDate : '',
    }));
  };

  return (
    <Dialog open={true} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{editingActivity ? 'Edit Activity' : 'Add Activity'}</DialogTitle>
          <DialogDescription>
            {editingActivity ? 'Update the activity details' : 'Record a new interaction or note for this lead'}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Activity Type */}
          <div className="space-y-2">
            <Label htmlFor="type">Activity Type</Label>
            <Select value={formData.type} onValueChange={handleTypeChange}>
              <SelectTrigger>
                <SelectValue placeholder="Select activity type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Note">Note</SelectItem>
                <SelectItem value="Call">Call</SelectItem>
                <SelectItem value="Text">Text</SelectItem>
                <SelectItem value="In-Person">In-Person</SelectItem>
                <SelectItem value="Follow-Up">Follow-Up</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Date */}
          <div className="space-y-2">
            <Label htmlFor="date">Date</Label>
            <Input
              id="date"
              type="date"
              value={formData.date}
              onChange={(e) => handleInputChange('date', e.target.value)}
              required
            />
          </div>

          {/* Follow-Up Date - Only show when Follow-Up is selected */}
          {formData.type === 'Follow-Up' && (
            <div className="space-y-2">
              <Label htmlFor="followUpDate">
                Follow-Up Date <span className="text-destructive">*</span>
              </Label>
              <Input
                id="followUpDate"
                type="date"
                value={formData.followUpDate}
                onChange={(e) => handleInputChange('followUpDate', e.target.value)}
                min={new Date().toISOString().split('T')[0]}
                required
              />
            </div>
          )}

          {/* Assigned Rep - Only show for Managers */}
          {currentUser?.role === 'Manager' && (
            <div className="space-y-2">
              <Label htmlFor="assignedPro">Pro (Optional)</Label>
              <Select value={formData.assignedPro} onValueChange={(value) => handleInputChange('assignedPro', value)}>
                <SelectTrigger>
                  <SelectValue placeholder="Select pro" />
                </SelectTrigger>
                <SelectContent>
                  {pros.map((pro) => (
                    <SelectItem key={pro.id} value={pro.id}>
                      {pro.displayName || pro.proName}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Content */}
          <div className="space-y-2">
            <Label htmlFor="content">Activity Details</Label>
            <Textarea
              id="content"
              value={formData.content}
              onChange={(e) => handleInputChange('content', e.target.value)}
              placeholder="Enter activity details, notes, or conversation summary..."
              rows={4}
              required
            />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? (editingActivity ? 'Updating...' : 'Adding...') : (editingActivity ? 'Update Activity' : 'Add Activity')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
