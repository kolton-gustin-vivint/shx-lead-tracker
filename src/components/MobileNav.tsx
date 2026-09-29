import { useState } from 'react';
import { Users, XCircle, DollarSign, Clock, MoreHorizontal, UserMinus, Shield, LogIn } from 'lucide-react';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@project/components/ui/sheet';
import { Separator } from '@project/components/ui/separator';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@project/components/ui/dropdown-menu';
import { Button } from '@project/components/ui/button';
import ProxySelector from './ProxySelector';

interface MobileNavProps {
  activeTab: string;
  onTabChange: (tab: string) => void;
  isManager: boolean;
  showUnassigned: boolean;
  displayName: string;
  email: string;
  initials: string;
}

const PRIMARY_TABS = [
  { id: 'leads', label: 'Leads', icon: Users },
  { id: 'closed', label: 'Closed', icon: XCircle },
  { id: 'compensation', label: 'Comp', icon: DollarSign },
  { id: 'selfgen', label: 'Self-Gen', icon: Clock },
];

export default function MobileNav({
  activeTab,
  onTabChange,
  isManager,
  showUnassigned,
  displayName,
  email,
  initials,
}: MobileNavProps) {
  const [moreOpen, setMoreOpen] = useState(false);

  const isActiveInMore = ['unassigned', 'team', 'admin', 'logins'].includes(activeTab);

  const handleMoreItemClick = (tab: string) => {
    onTabChange(tab);
    setMoreOpen(false);
  };

  return (
    <>
      {/* Mobile header */}
      <header className="md:hidden sticky top-0 z-30 bg-card border-b border-border px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="h-7 w-7 rounded-lg bg-primary flex items-center justify-center shrink-0">
            <span className="text-primary-foreground font-bold text-xs">SHX</span>
          </div>
          <span className="font-semibold text-sm text-foreground">Lead Tracker</span>
        </div>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="sm" className="h-8 w-8 p-0 rounded-full">
              <div className="h-7 w-7 rounded-full bg-primary flex items-center justify-center text-xs font-semibold text-primary-foreground">
                {initials}
              </div>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <div className="px-2 py-1.5">
              <p className="text-sm font-medium">{displayName}</p>
              <p className="text-xs text-muted-foreground">{email}</p>
            </div>
          </DropdownMenuContent>
        </DropdownMenu>
      </header>

      {/* Bottom navigation bar */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-30 bg-card border-t border-border px-1 pb-[env(safe-area-inset-bottom)]">
        <div className="flex items-center justify-around">
          {PRIMARY_TABS.map(tab => {
            const isActive = activeTab === tab.id;
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => onTabChange(tab.id)}
                className={`flex flex-col items-center gap-0.5 px-2 py-2 min-w-0 flex-1 transition-colors ${
                  isActive ? 'text-primary' : 'text-muted-foreground'
                }`}
              >
                <Icon className="h-5 w-5" />
                <span className="text-[10px] font-medium leading-tight">{tab.label}</span>
              </button>
            );
          })}

          {/* More button — managers only */}
          {isManager && (
            <button
              onClick={() => setMoreOpen(true)}
              className={`flex flex-col items-center gap-0.5 px-2 py-2 min-w-0 flex-1 transition-colors ${
                isActiveInMore ? 'text-primary' : 'text-muted-foreground'
              }`}
            >
              <MoreHorizontal className="h-5 w-5" />
              <span className="text-[10px] font-medium leading-tight">More</span>
            </button>
          )}
        </div>
      </nav>

      {/* More sheet (managers) */}
      <Sheet open={moreOpen} onOpenChange={setMoreOpen}>
        <SheetContent side="bottom" className="rounded-t-2xl pb-8">
          <SheetHeader>
            <SheetTitle className="text-base">More</SheetTitle>
          </SheetHeader>

          <div className="space-y-1 mt-4">
            {showUnassigned && (
              <MoreSheetItem
                icon={<UserMinus className="h-4 w-4" />}
                label="Unassigned"
                active={activeTab === 'unassigned'}
                onClick={() => handleMoreItemClick('unassigned')}
              />
            )}
            <MoreSheetItem
              icon={<Users className="h-4 w-4" />}
              label="Team"
              active={activeTab === 'team'}
              onClick={() => handleMoreItemClick('team')}
            />
            <MoreSheetItem
              icon={<Shield className="h-4 w-4" />}
              label="Admin"
              active={activeTab === 'admin'}
              onClick={() => handleMoreItemClick('admin')}
            />
            <MoreSheetItem
              icon={<LogIn className="h-4 w-4" />}
              label="Login Report"
              active={activeTab === 'logins'}
              onClick={() => handleMoreItemClick('logins')}
            />
          </div>

          <Separator className="my-4" />

          {/* Proxy selector */}
          <div className="space-y-2">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">View as</p>
            <ProxySelector isManager={isManager} variant="default" />
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}

function MoreSheetItem({ icon, label, active, onClick }: {
  icon: React.ReactNode;
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-3 w-full px-3 py-3 rounded-md text-sm font-medium transition-colors ${
        active
          ? 'bg-primary/10 text-primary'
          : 'text-foreground hover:bg-muted'
      }`}
    >
      {icon}
      {label}
    </button>
  );
}
