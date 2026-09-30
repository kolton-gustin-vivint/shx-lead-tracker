import type { NisLeadsRecordType } from '../airtable/index';

/**
 * Fields the lead search looks at. Shared so the Airtable-side search (manager
 * views) and the in-memory search (pro views, over an already-fetched set)
 * always agree on what "matching" means.
 */
export const LEAD_SEARCH_FIELDS = [
  'customerName',
  'opportunityName',
  'customerPhone',
  'customerEmail',
  'customerCity',
  'customerState',
  'leadDetails',
] as const;

/** `searchAny` option for NisLeads.findAll, or undefined when there's no term. */
export function leadSearchAny(search: string | undefined) {
  const term = search?.trim();
  return term ? { fields: [...LEAD_SEARCH_FIELDS], term } : undefined;
}

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
