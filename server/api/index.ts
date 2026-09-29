// Registry of every endpoint exposed at POST /api/<name>.
// Add a file to server/api and list it here to expose it.
import createActivity from './createActivity.js';
import createSelfGenActivity from './createSelfGenActivity.js';
import deleteActivity from './deleteActivity.js';
import deleteCompensation from './deleteCompensation.js';
import deleteSelfGenActivity from './deleteSelfGenActivity.js';
import generateAiSummary from './generateAiSummary.js';
import getActivities from './getActivities.js';
import getAdminStats from './getAdminStats.js';
import getClosedLeads from './getClosedLeads.js';
import getCompensation from './getCompensation.js';
import getLeadCount from './getLeadCount.js';
import getLeads from './getLeads.js';
import getLeadStats from './getLeadStats.js';
import getLoginReport from './getLoginReport.js';
import getMyProfile from './getMyProfile.js';
import getReps from './getReps.js';
import getRunningTotals from './getRunningTotals.js';
import getSelfGenActivities from './getSelfGenActivities.js';
import getStatusOptions from './getStatusOptions.js';
import logAuditEvent from './logAuditEvent.js';
import recordLogin from './recordLogin.js';
import refreshAdminStats from './refreshAdminStats.js';
import resetLead from './resetLead.js';
import suggestNextAction from './suggestNextAction.js';
import triggerDistributeLeads from './triggerDistributeLeads.js';
import triggerLoadLeadsForPro from './triggerLoadLeadsForPro.js';
import triggerMarkLeftoverLeads from './triggerMarkLeftoverLeads.js';
import triggerProcessNewUploads from './triggerProcessNewUploads.js';
import updateActivity from './updateActivity.js';
import updateLead from './updateLead.js';
import updateSelfGenActivity from './updateSelfGenActivity.js';

export const endpoints = {
  createActivity,
  createSelfGenActivity,
  deleteActivity,
  deleteCompensation,
  deleteSelfGenActivity,
  generateAiSummary,
  getActivities,
  getAdminStats,
  getClosedLeads,
  getCompensation,
  getLeadCount,
  getLeads,
  getLeadStats,
  getLoginReport,
  getMyProfile,
  getReps,
  getRunningTotals,
  getSelfGenActivities,
  getStatusOptions,
  logAuditEvent,
  recordLogin,
  refreshAdminStats,
  resetLead,
  suggestNextAction,
  triggerDistributeLeads,
  triggerLoadLeadsForPro,
  triggerMarkLeftoverLeads,
  triggerProcessNewUploads,
  updateActivity,
  updateLead,
  updateSelfGenActivity,
} as const;

export type Endpoints = typeof endpoints;
export type EndpointName = keyof Endpoints;
