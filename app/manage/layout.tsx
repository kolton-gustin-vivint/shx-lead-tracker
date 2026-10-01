import { Suspense, type ReactNode } from 'react';
import { redirect } from 'next/navigation';
import { SessionProvider, getSession } from '@FO-Enablement-Vivint/magistrate/next';
import { requireRosterUser } from '@server/lib/roster';
import { isManager } from '@server/lib/access';
import ManageShell from '@/manage/ManageShell';
import ManageLoading from '@/manage/ManageLoading';
import '@/manage/manage.css';

/**
 * Manager View. SessionProvider sends signed-out visitors to Magistrate; the
 * gate below then requires an active roster member with Role = Manager and
 * sends everyone else back to the Pro app. (The API enforces the same rule on
 * every Manager View endpoint, so this is not the only line of defence.)
 *
 * The checks read cookies and the roster, so they sit inside <Suspense>: the
 * layout itself does no runtime work, the loader streams immediately, and the
 * page swaps in when the checks finish. (A loading.tsx can't cover a layout
 * that reads cookies — navigation would block until it finished.)
 */
export default function ManageLayout({ children }: { children: ReactNode }) {
  return (
    <Suspense fallback={<ManageLoading />}>
      <SessionProvider>
        <ManagerGate>{children}</ManagerGate>
      </SessionProvider>
    </Suspense>
  );
}

async function ManagerGate({ children }: { children: ReactNode }) {
  const { session } = await getSession();
  let user: Awaited<ReturnType<typeof requireRosterUser>> | null = null;
  try {
    user = session ? await requireRosterUser(session) : null;
  } catch {
    user = null; // not on the roster, or inactive
  }
  // redirect() throws, so it has to stay outside the try.
  if (!user || !isManager(user)) redirect('/');

  const name = String(user.displayName || user.proName || user.name || user.email);
  return (
    <ManageShell name={name} email={user.email}>
      {children}
    </ManageShell>
  );
}
