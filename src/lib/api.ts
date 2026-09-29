/**
 * Typed client for the API server. Each function POSTs its input to
 * /api/<name> and returns the endpoint's output. Input/output types are
 * inferred from the endpoint definitions in server/api, so they stay in sync.
 */
import type { z } from 'zod';
import type { Endpoints, EndpointName } from '@server/api';

export type InputOf<N extends EndpointName> = z.infer<Endpoints[N]['inputSchema']>;
export type OutputOf<N extends EndpointName> = z.infer<Endpoints[N]['outputSchema']>;

type Args<N extends EndpointName> = undefined extends InputOf<N> ? [input?: InputOf<N>] : [input: InputOf<N>];

export class ApiClientError extends Error {
  status: number;
  code: string;
  issues?: unknown;
  constructor(status: number, code: string, message: string, issues?: unknown) {
    super(message);
    this.name = 'ApiClientError';
    this.status = status;
    this.code = code;
    this.issues = issues;
  }
}

export async function callEndpoint<N extends EndpointName>(name: N, input?: InputOf<N>): Promise<OutputOf<N>> {
  const res = await fetch(`/api/${name}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'same-origin',
    body: JSON.stringify(input ?? {}),
  });

  if (!res.ok) {
    let code = 'ERROR';
    let message = `${res.status} ${res.statusText}`;
    let issues: unknown;
    try {
      const body = await res.json();
      code = body?.error?.code ?? code;
      message = body?.error?.message ?? message;
      issues = body?.error?.issues;
    } catch {
      /* non-JSON error body */
    }
    // The app has no sign-in, so a 401 means the server rejected the request
    // outright. Surface it rather than bouncing through a login route.
    throw new ApiClientError(res.status, code, message, issues);
  }

  const text = await res.text();
  return (text ? JSON.parse(text) : null) as OutputOf<N>;
}

function endpoint<N extends EndpointName>(name: N) {
  return (...args: Args<N>): Promise<OutputOf<N>> => callEndpoint(name, args[0] as InputOf<N>);
}

export const createActivity = endpoint('createActivity');
export type CreateActivityInputType = InputOf<'createActivity'>;
export type CreateActivityOutputType = OutputOf<'createActivity'>;
export const createSelfGenActivity = endpoint('createSelfGenActivity');
export type CreateSelfGenActivityInputType = InputOf<'createSelfGenActivity'>;
export type CreateSelfGenActivityOutputType = OutputOf<'createSelfGenActivity'>;
export const deleteActivity = endpoint('deleteActivity');
export type DeleteActivityInputType = InputOf<'deleteActivity'>;
export type DeleteActivityOutputType = OutputOf<'deleteActivity'>;
export const deleteCompensation = endpoint('deleteCompensation');
export type DeleteCompensationInputType = InputOf<'deleteCompensation'>;
export type DeleteCompensationOutputType = OutputOf<'deleteCompensation'>;
export const deleteSelfGenActivity = endpoint('deleteSelfGenActivity');
export type DeleteSelfGenActivityInputType = InputOf<'deleteSelfGenActivity'>;
export type DeleteSelfGenActivityOutputType = OutputOf<'deleteSelfGenActivity'>;
export const generateAiSummary = endpoint('generateAiSummary');
export type GenerateAiSummaryInputType = InputOf<'generateAiSummary'>;
export type GenerateAiSummaryOutputType = OutputOf<'generateAiSummary'>;
export const getActivities = endpoint('getActivities');
export type GetActivitiesInputType = InputOf<'getActivities'>;
export type GetActivitiesOutputType = OutputOf<'getActivities'>;
export const getAdminStats = endpoint('getAdminStats');
export type GetAdminStatsInputType = InputOf<'getAdminStats'>;
export type GetAdminStatsOutputType = OutputOf<'getAdminStats'>;
export const getClosedLeads = endpoint('getClosedLeads');
export type GetClosedLeadsInputType = InputOf<'getClosedLeads'>;
export type GetClosedLeadsOutputType = OutputOf<'getClosedLeads'>;
export const getCompensation = endpoint('getCompensation');
export type GetCompensationInputType = InputOf<'getCompensation'>;
export type GetCompensationOutputType = OutputOf<'getCompensation'>;
export const getLeadCount = endpoint('getLeadCount');
export type GetLeadCountInputType = InputOf<'getLeadCount'>;
export type GetLeadCountOutputType = OutputOf<'getLeadCount'>;
export const getLeads = endpoint('getLeads');
export type GetLeadsInputType = InputOf<'getLeads'>;
export type GetLeadsOutputType = OutputOf<'getLeads'>;
export const getLeadStats = endpoint('getLeadStats');
export type GetLeadStatsInputType = InputOf<'getLeadStats'>;
export type GetLeadStatsOutputType = OutputOf<'getLeadStats'>;
export const getLoginReport = endpoint('getLoginReport');
export type GetLoginReportInputType = InputOf<'getLoginReport'>;
export type GetLoginReportOutputType = OutputOf<'getLoginReport'>;
export const getMyProfile = endpoint('getMyProfile');
export type GetMyProfileInputType = InputOf<'getMyProfile'>;
export type GetMyProfileOutputType = OutputOf<'getMyProfile'>;
export const getReps = endpoint('getReps');
export type GetRepsInputType = InputOf<'getReps'>;
export type GetRepsOutputType = OutputOf<'getReps'>;
export const getRunningTotals = endpoint('getRunningTotals');
export type GetRunningTotalsInputType = InputOf<'getRunningTotals'>;
export type GetRunningTotalsOutputType = OutputOf<'getRunningTotals'>;
export const getSelfGenActivities = endpoint('getSelfGenActivities');
export type GetSelfGenActivitiesInputType = InputOf<'getSelfGenActivities'>;
export type GetSelfGenActivitiesOutputType = OutputOf<'getSelfGenActivities'>;
export const getStatusOptions = endpoint('getStatusOptions');
export type GetStatusOptionsInputType = InputOf<'getStatusOptions'>;
export type GetStatusOptionsOutputType = OutputOf<'getStatusOptions'>;
export const logAuditEvent = endpoint('logAuditEvent');
export type LogAuditEventInputType = InputOf<'logAuditEvent'>;
export type LogAuditEventOutputType = OutputOf<'logAuditEvent'>;
export const recordLogin = endpoint('recordLogin');
export type RecordLoginInputType = InputOf<'recordLogin'>;
export type RecordLoginOutputType = OutputOf<'recordLogin'>;
export const refreshAdminStats = endpoint('refreshAdminStats');
export type RefreshAdminStatsInputType = InputOf<'refreshAdminStats'>;
export type RefreshAdminStatsOutputType = OutputOf<'refreshAdminStats'>;
export const resetLead = endpoint('resetLead');
export type ResetLeadInputType = InputOf<'resetLead'>;
export type ResetLeadOutputType = OutputOf<'resetLead'>;
export const suggestNextAction = endpoint('suggestNextAction');
export type SuggestNextActionInputType = InputOf<'suggestNextAction'>;
export type SuggestNextActionOutputType = OutputOf<'suggestNextAction'>;
export const triggerDistributeLeads = endpoint('triggerDistributeLeads');
export type TriggerDistributeLeadsInputType = InputOf<'triggerDistributeLeads'>;
export type TriggerDistributeLeadsOutputType = OutputOf<'triggerDistributeLeads'>;
export const triggerLoadLeadsForPro = endpoint('triggerLoadLeadsForPro');
export type TriggerLoadLeadsForProInputType = InputOf<'triggerLoadLeadsForPro'>;
export type TriggerLoadLeadsForProOutputType = OutputOf<'triggerLoadLeadsForPro'>;
export const triggerMarkLeftoverLeads = endpoint('triggerMarkLeftoverLeads');
export type TriggerMarkLeftoverLeadsInputType = InputOf<'triggerMarkLeftoverLeads'>;
export type TriggerMarkLeftoverLeadsOutputType = OutputOf<'triggerMarkLeftoverLeads'>;
export const triggerProcessNewUploads = endpoint('triggerProcessNewUploads');
export type TriggerProcessNewUploadsInputType = InputOf<'triggerProcessNewUploads'>;
export type TriggerProcessNewUploadsOutputType = OutputOf<'triggerProcessNewUploads'>;
export const updateActivity = endpoint('updateActivity');
export type UpdateActivityInputType = InputOf<'updateActivity'>;
export type UpdateActivityOutputType = OutputOf<'updateActivity'>;
export const updateLead = endpoint('updateLead');
export type UpdateLeadInputType = InputOf<'updateLead'>;
export type UpdateLeadOutputType = OutputOf<'updateLead'>;
export const updateSelfGenActivity = endpoint('updateSelfGenActivity');
export type UpdateSelfGenActivityInputType = InputOf<'updateSelfGenActivity'>;
export type UpdateSelfGenActivityOutputType = OutputOf<'updateSelfGenActivity'>;
