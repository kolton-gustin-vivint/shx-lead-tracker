/**
 * Role checks for endpoints. `context.user.role` comes from the user's SHX Team
 * row, looked up on the server by the roster gate — never from the request —
 * so it can be trusted. The UI hides manager-only pages, but hiding a button
 * protects nothing on its own: each endpoint has to enforce it too.
 */
import { ApiError, type RequestUser } from './endpoint';

export function isManager(user: RequestUser): boolean {
  return user.role === 'Manager';
}

/** Throws FORBIDDEN (HTTP 403) unless the caller is a manager. Fails closed. */
export function requireManager(user: RequestUser): void {
  if (!isManager(user)) {
    throw new ApiError({ code: 'FORBIDDEN', message: 'This action is for managers only.' });
  }
}
