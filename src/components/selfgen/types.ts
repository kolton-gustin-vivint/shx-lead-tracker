export interface SelfGenActivity {
  id: string;
  selfGenId?: string;
  shxPro?: string[];
  shxProEmail?: string[];
  dateOfActivity?: string;
  timeSlot?: string;
  activityType?: string[];
  completed: boolean;
  notes?: string;
  attachments?: { id?: string; filename: string; url: string }[];
  dateCreated?: any;
}
