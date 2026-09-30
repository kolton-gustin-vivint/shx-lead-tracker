import React, { useState, useEffect } from 'react';
import LeadsTab from './LeadsTab';
import ClosedLeadsTab from './ClosedLeadsTab';
import UnassignedLeadsTab from './UnassignedLeadsTab';
import CompensationTab from './CompensationTab';
import AdminTab from './AdminTab';
import SelfGenTab from './SelfGenTab';
import TeamTab from './TeamTab';
import LoginReportTab from './LoginReportTab';
import AppSidebar from './AppSidebar';
import MobileNav from './MobileNav';
import ProxyIndicator from './ProxyIndicator';
import { useProxy } from '../contexts/ProxyContext';
import { useSession } from '@FO-Enablement-Vivint/magistrate/next';

interface AuthenticatedUser {
  id: string;
  email: string;
  proId: string | undefined;
  proName: string;
  displayName: string;
  role: string;
}

interface LeadsDashboardProps {
  user: AuthenticatedUser;
}

// The active tab lives in the URL hash (#tab=compensation) so a refresh, a
// bookmark, or the back button lands on the same tab. This component only
// mounts after the profile has loaded on the client, so reading
// window.location during the first render is safe (no server-render mismatch).
const TAB_HASH_PREFIX = '#tab=';

function readTabFromHash(): string {
  if (typeof window === 'undefined') return 'leads';
  const { hash } = window.location;
  return hash.startsWith(TAB_HASH_PREFIX) ? decodeURIComponent(hash.slice(TAB_HASH_PREFIX.length)) : 'leads';
}

export default function LeadsDashboard({ user }: LeadsDashboardProps) {
  const {session} = useSession();

  const [requestedTab, setRequestedTab] = useState(readTabFromHash);
  const { originalUser, currentUser, isProxying } = useProxy();
  const isManager = originalUser?.role === 'Manager';
  const displayUser = currentUser || user;
  const showUnassignedTab = isManager && !isProxying;

  // Follow back/forward and manual edits to the hash.
  useEffect(() => {
    const onHashChange = () => setRequestedTab(readTabFromHash());
    window.addEventListener('hashchange', onHashChange);
    return () => window.removeEventListener('hashchange', onHashChange);
  }, []);

  // Only tabs this user can actually see. Anything else (a stale bookmark, a
  // Pro opening #tab=admin, Unassigned while proxying) falls back to Leads, so
  // the sidebar highlight always matches what is rendered.
  const visibleTabs = [
    'leads',
    'closed',
    'compensation',
    'selfgen',
    ...(showUnassignedTab ? ['unassigned'] : []),
    ...(isManager ? ['team', 'admin', 'logins'] : []),
  ];
  const activeTab = visibleTabs.includes(requestedTab) ? requestedTab : 'leads';

  // Setting the hash adds a history entry and fires `hashchange`, which
  // updates state above — the URL stays the single source of truth.
  const setActiveTab = (tab: string) => {
    if (tab === activeTab) return;
    window.location.hash = `${TAB_HASH_PREFIX}${encodeURIComponent(tab)}`;
  };

  const displayName = `${session.firstName} ${session.lastName}`;
  const email = `${session.email}`;
  const initials = displayName
    ? displayName.split(' ').map((n: string) => n[0]).join('').toUpperCase().slice(0, 2)
    : 'U';

  return (
    <div className="min-h-screen bg-background flex flex-col md:flex-row">
      {/* Desktop sidebar */}
      <AppSidebar
        activeTab={activeTab}
        onTabChange={setActiveTab}
        isManager={isManager}
        showUnassigned={showUnassignedTab}
        displayName={displayName}
        email={email}
        initials={initials}
      />

      {/* Mobile header + bottom nav */}
      <MobileNav
        activeTab={activeTab}
        onTabChange={setActiveTab}
        isManager={isManager}
        showUnassigned={showUnassignedTab}
        displayName={displayName}
        email={email}
        initials={initials}
      />

      {/* Main content area */}
      <main className="flex-1 min-w-0 flex flex-col">
        {/* Proxy indicator — inside content area, not above sidebar */}
        <ProxyIndicator />

        {/* Content — bottom padding for mobile nav bar */}
        <div className="flex-1 px-4 sm:px-6 py-5 pb-20 md:pb-5">
          <TabContent
            activeTab={activeTab}
            isManager={isManager}
            showUnassigned={showUnassignedTab}
            displayUser={displayUser}
          />
        </div>
      </main>
    </div>
  );
}

/* Renders the active tab's content — extracted to keep the main component lean */
function TabContent({
  activeTab,
  isManager,
  showUnassigned,
  displayUser,
}: {
  activeTab: string;
  isManager: boolean;
  showUnassigned: boolean;
  displayUser: any;
}) {
  switch (activeTab) {
    case 'leads':
      return <LeadsTab isManager={isManager} />;
    case 'closed':
      return <ClosedLeadsTab isManager={isManager} />;
    case 'unassigned':
      return showUnassigned ? (
        <UnassignedLeadsTab user={displayUser} isManager={isManager} />
      ) : (
        <LeadsTab isManager={isManager} />
      );
    case 'compensation':
      return <CompensationTab isManager={isManager} />;
    case 'selfgen':
      return <SelfGenTab isManager={isManager} />;
    case 'team':
      return isManager ? <TeamTab /> : <LeadsTab isManager={isManager} />;
    case 'admin':
      return isManager ? <AdminTab /> : <LeadsTab isManager={isManager} />;
    case 'logins':
      return isManager ? <LoginReportTab /> : <LeadsTab isManager={isManager} />;
    default:
      return <LeadsTab isManager={isManager} />;
  }
}
