/**
 * Utility function to get status badge color classes.
 *
 * Bucketing rules:
 *  - NEW                          → blue   (badge-status-new)
 *  - CLOSED | SOLD or INSTALLED   → green  (badge-status-success)
 *  - IN-PROGRESS | *              → orange (badge-status-progress)
 *  - CLOSED | *                   → red    (badge-status-closed)
 *  - anything else                → dark gray (badge-status-default)
 */

const CLOSED_WON_STATUSES = ['CLOSED | SOLD', 'CLOSED | INSTALLED'];

export const getStatusColor = (status?: string): string => {
  if (!status) return 'badge-status-default';
  if (status === 'NEW') return 'badge-status-new';
  if (CLOSED_WON_STATUSES.some(s => status.toUpperCase().includes(s))) return 'badge-status-success';
  if (status.startsWith('IN-PROGRESS')) return 'badge-status-progress';
  if (status.startsWith('CLOSED')) return 'badge-status-closed';
  return 'badge-status-default';
};

/**
 * Same bucketing logic with an added hover:opacity-80 for interactive badges.
 */
export const getStatusColorWithHover = (status?: string): string => {
  if (!status) return 'badge-status-default hover:opacity-80';
  if (status === 'NEW') return 'badge-status-new hover:opacity-80';
  if (CLOSED_WON_STATUSES.some(s => status.toUpperCase().includes(s))) return 'badge-status-success hover:opacity-80';
  if (status.startsWith('IN-PROGRESS')) return 'badge-status-progress hover:opacity-80';
  if (status.startsWith('CLOSED')) return 'badge-status-closed hover:opacity-80';
  return 'badge-status-default hover:opacity-80';
};
