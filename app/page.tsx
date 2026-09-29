/**
 * The whole app lives on one route.
 *
 * There is no sign-in gate here yet — see server/lib/session.ts for how the
 * current user is resolved and where authentication should be added.
 */
import AppRoot from '@/AppRoot';
import { SessionProvider } from '@FO-Enablement-Vivint/magistrate/next';

export default function Page() {
  return (
    <SessionProvider>
      <AppRoot /> 
    </SessionProvider>
  )
}
