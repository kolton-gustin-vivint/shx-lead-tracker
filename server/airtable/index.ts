/**
 * Typed table clients for the SHX Leader Dash base. Field keys are camelCase
 * versions of the Airtable field names (see schema.generated.ts).
 */
import { defineTable } from '../lib/airtable';
import {
  ShxTeamTable,
  NisLeadsTable,
  ActivitiesTable,
  ExportsTable,
  AuditLogTable,
  SelfGenTimeTable,
  ControlPanelTable,
  type ShxTeamRecordType,
  type NisLeadsRecordType,
  type ActivitiesRecordType,
  type ExportsRecordType,
  type AuditLogRecordType,
  type SelfGenTimeRecordType,
  type ControlPanelRecordType,
} from './schema.generated';

export const ShxTeam = defineTable<ShxTeamRecordType>(ShxTeamTable);
export const NisLeads = defineTable<NisLeadsRecordType>(NisLeadsTable);
export const Activities = defineTable<ActivitiesRecordType>(ActivitiesTable);
export const Exports = defineTable<ExportsRecordType>(ExportsTable);
export const AuditLog = defineTable<AuditLogRecordType>(AuditLogTable);
export const SelfGenTime = defineTable<SelfGenTimeRecordType>(SelfGenTimeTable);
export const ControlPanel = defineTable<ControlPanelRecordType>(ControlPanelTable);

export type {
  ShxTeamRecordType,
  NisLeadsRecordType,
  ActivitiesRecordType,
  ExportsRecordType,
  AuditLogRecordType,
  SelfGenTimeRecordType,
  ControlPanelRecordType,
  AirtableAttachment,
} from './schema.generated';
