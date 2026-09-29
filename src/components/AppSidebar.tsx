import { Users, XCircle, UserMinus, DollarSign, Clock, Shield, LogIn } from 'lucide-react';
import ProxySelector from './ProxySelector';

interface NavItem {
  id: string;
  label: string;
  icon: React.ReactNode;
}

interface AppSidebarProps {
  activeTab: string;
  onTabChange: (tab: string) => void;
  isManager: boolean;
  showUnassigned: boolean;
  displayName: string;
  email: string;
  initials: string;
}

export default function AppSidebar({
  activeTab,
  onTabChange,
  isManager,
  showUnassigned,
  displayName,
  email,
  initials,
}: AppSidebarProps) {
  const navItems: NavItem[] = [
    { id: 'leads', label: 'Leads', icon: <Users className="h-4 w-4" /> },
    { id: 'closed', label: 'Closed', icon: <XCircle className="h-4 w-4" /> },
    ...(showUnassigned ? [{ id: 'unassigned', label: 'Unassigned', icon: <UserMinus className="h-4 w-4" /> }] : []),
    { id: 'compensation', label: 'Compensation', icon: <DollarSign className="h-4 w-4" /> },
    { id: 'selfgen', label: 'Self-Gen', icon: <Clock className="h-4 w-4" /> },
    ...(isManager ? [{ id: 'team', label: 'Team', icon: <Users className="h-4 w-4" /> }] : []),
    ...(isManager ? [{ id: 'admin', label: 'Admin', icon: <Shield className="h-4 w-4" /> }] : []),
    ...(isManager ? [{ id: 'logins', label: 'Login Report', icon: <LogIn className="h-4 w-4" /> }] : []),
  ];

  return (
    <aside className="hidden md:flex w-52 flex-shrink-0 flex-col bg-[hsl(var(--header-bg))] border-r border-[hsl(var(--header-border))] h-screen sticky top-0">
      {/* Logo */}
      <div className="px-4 py-4 flex items-center gap-2.5 border-b border-[hsl(var(--header-border))]">
        <div className="h-8 w-8 rounded-lg bg-primary flex items-center justify-center shrink-0">
          <span className="text-primary-foreground font-bold text-sm">SHX</span>
        </div>
        <span className="font-bold text-base text-[hsl(var(--header-foreground))] truncate">
          Lead Tracker
        </span>
      </div>

      {/* Nav items */}
      <nav className="flex-1 py-3 px-2 space-y-0.5 overflow-y-auto">
        {navItems.map(item => {
          const isActive = activeTab === item.id;
          return (
            <button
              key={item.id}
              onClick={() => onTabChange(item.id)}
              className={`flex items-center gap-3 w-full px-3 py-2.5 rounded-md text-sm font-medium relative transition-colors ${
                isActive
                  ? 'bg-[hsl(var(--header-border))] text-[hsl(var(--header-foreground))]'
                  : 'text-[hsl(var(--header-muted))] hover:text-[hsl(var(--header-foreground))] hover:bg-[hsl(var(--header-border)/0.5)]'
              }`}
            >
              {isActive && (
                <div className="absolute left-0 top-1.5 bottom-1.5 w-[3px] rounded-r-full bg-primary" />
              )}
              {item.icon}
              {item.label}
            </button>
          );
        })}
      </nav>

      {/* Proxy selector (managers only) */}
      {isManager && (
        <div className="px-3 py-2.5 border-t border-[hsl(var(--header-border))]">
          <p className="text-[10px] uppercase tracking-wider mb-1.5 text-[hsl(var(--header-muted))]">
            View as
          </p>
          <ProxySelector isManager={isManager} variant="sidebar" />
        </div>
      )}

      {/* User + sign out */}
      <div className="px-3 py-3 border-t border-[hsl(var(--header-border))] flex items-center gap-2.5">
        <div className="h-8 w-8 rounded-full bg-primary flex items-center justify-center text-xs font-semibold text-primary-foreground shrink-0">
          {initials}
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-xs font-medium truncate text-[hsl(var(--header-foreground))]">{displayName}</p>
          <p className="text-[10px] truncate text-[hsl(var(--header-muted))]">{email}</p>
        </div>
      </div>
    </aside>
  );
}
