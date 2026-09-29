import React, { useState } from 'react';
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

export default function LeadsDashboard({ user }: LeadsDashboardProps) {
  const {session} = useSession();

  const [activeTab, setActiveTab] = useState('leads');
  const { originalUser, currentUser, isProxying } = useProxy();
  const isManager = originalUser?.role === 'Manager';
  const displayUser = currentUser || user;
  const showUnassignedTab = isManager && !isProxying;

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
