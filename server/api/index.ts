// Registry of every endpoint exposed at POST /api/<name>.
// Add a file to server/api and list it here to expose it.
import createActivity from './createActivity';
import createSelfGenActivity from './createSelfGenActivity';
import deleteActivity from './deleteActivity';
import deleteCompensation from './deleteCompensation';
import deleteSelfGenActivity from './deleteSelfGenActivity';
import generateAiSummary from './generateAiSummary';
import getActivities from './getActivities';
import getClosedLeads from './getClosedLeads';
import getCompensation from './getCompensation';
import getLeads from './getLeads';
import getLeadStats from './getLeadStats';
import getMyProfile from './getMyProfile';
import getReps from './getReps';
import getRunningTotals from './getRunningTotals';
import getSelfGenActivities from './getSelfGenActivities';
import getStatusOptions from './getStatusOptions';
import logAuditEvent from './logAuditEvent';
import recordLogin from './recordLogin';
import suggestNextAction from './suggestNextAction';
import updateActivity from './updateActivity';
import updateLead from './updateLead';
import updateSelfGenActivity from './updateSelfGenActivity';

export const endpoints = {
  createActivity,
  createSelfGenActivity,
  deleteActivity,
  deleteCompensation,
  deleteSelfGenActivity,
  generateAiSummary,
  getActivities,
  getClosedLeads,
  getCompensation,
  getLeads,
  getLeadStats,
  getMyProfile,
  getReps,
  getRunningTotals,
  getSelfGenActivities,
  getStatusOptions,
  logAuditEvent,
  recordLogin,
  suggestNextAction,
  updateActivity,
  updateLead,
  updateSelfGenActivity,
} as const;

export type Endpoints = typeof endpoints;
export type EndpointName = keyof Endpoints;
