import type { NisLeadsRecordType } from '../airtable/index.js';

export function passesSearch(record: NisLeadsRecordType, search: string | undefined): boolean {
  if (!search || !search.trim()) return true;
  const term = search.toLowerCase().trim();
  return (
    (record.customerName || '').toLowerCase().includes(term) ||
    (record.opportunityName || '').toLowerCase().includes(term) ||
    (record.customerPhone || '').toLowerCase().includes(term) ||
    (record.customerEmail || '').toLowerCase().includes(term) ||
    (record.customerCity || '').toLowerCase().includes(term) ||
    (record.customerState || '').toLowerCase().includes(term) ||
    (record.leadDetails || '').toLowerCase().includes(term)
  );
}

export function mapLead(record: NisLeadsRecordType) {
  return {
    id: record.id,
    leadId: record.leadId,
    status: record.status,
    assignedPro: Array.isArray(record.assignedPro)
      ? record.assignedPro
      : record.assignedPro
      ? [record.assignedPro]
      : undefined,
    assignedDate: record.dateAssigned,
    opportunityName: record.opportunityName,
    customerName: record.customerName,
    customerPhone: record.customerPhone,
    customerEmail: record.customerEmail,
    customerAddressLine1: record.customerAddressLine1,
    customerAddressLine2: record.customerAddressLine2,
    customerCity: record.customerCity,
    customerState: record.customerState,
    customerZip: record.customerZip,
    salesOffice: record.salesOffice,
    leadDetails: record.leadDetails,
    lastInteractionDate: record.lastInteractionDate,
    daysSinceLastInteraction: record.daysSinceLastInteraction,
    totalInteractions: record.totalInteractions,
    assignmentNeeded: record.assignmentNeeded,
  };
}
