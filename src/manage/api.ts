/** The Manager View's API helpers — thin wrappers over the app's typed client. */
export { callEndpoint as api, type OutputOf, type InputOf } from '@/lib/api';

export function errorMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}
