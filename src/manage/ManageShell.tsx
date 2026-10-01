'use client';

/**
 * Manager View chrome — same structure as the Lead Tracker's: a green sidebar
 * on desktop (AppSidebar), a slim header + bottom tab bar on mobile (MobileNav).
 * Access is checked in app/manage/layout.tsx.
 */
import { useEffect, useState, type MouseEvent, type ReactNode } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ArrowLeft, LogIn, Shield, UserMinus, Users } from 'lucide-react';
import ManageLoading from './ManageLoading';

const NAV = [
  { href: '/manage/unassigned', label: 'Unassigned', short: 'Unassigned', Icon: UserMinus },
  { href: '/manage/team', label: 'Team', short: 'Team', Icon: Users },
  { href: '/manage/admin', label: 'Admin', short: 'Admin', Icon: Shield },
  { href: '/manage/logins', label: 'Login Report', short: 'Logins', Icon: LogIn },
];

function initialsOf(name: string): string {
  return name.split(/\s+/).filter(Boolean).map(n => n[0]).join('').toUpperCase().slice(0, 2) || 'U';
}

export default function ManageShell({ name, email, children }: { name: string; email: string; children: ReactNode }) {
  const pathname = usePathname();
  const initials = initialsOf(name);
  // "Back to Lead Tracker" is a full page load; cover the wait with the loader.
  const [leaving, setLeaving] = useState(false);
  const leave = (e: MouseEvent<HTMLAnchorElement>) => {
    // Cmd/Ctrl/Shift/middle-click opens a new tab — this one isn't leaving.
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) return;
    setLeaving(true);
  };
  // Coming back with the browser's Back button can restore this page from the
  // back/forward cache with the loader still showing; clear it.
  useEffect(() => {
    const onShow = (e: PageTransitionEvent) => { if (e.persisted) setLeaving(false); };
    window.addEventListener('pageshow', onShow);
    return () => window.removeEventListener('pageshow', onShow);
  }, []);
  if (leaving) return <ManageLoading label="Opening Lead Tracker…" />;

  return (
    <div className="manage manage-layout">
      {/* Desktop sidebar */}
      <aside className="sidebar">
        <div className="sidebar-logo">
          <span className="logo">SHX</span>
          <span className="sidebar-title">Manager View</span>
        </div>

        <nav className="sidebar-nav">
          {NAV.map(({ href, label, Icon }) => (
            <Link key={href} href={href} className={`sidebar-item${pathname === href ? ' active' : ''}`}>
              <Icon size={16} />
              {label}
            </Link>
          ))}
        </nav>

        <div className="sidebar-section">
          {/* A full page load, so the Pro app starts fresh. */}
          <a className="sidebar-back" href="/" onClick={leave} title="Back to the Lead Tracker">
            <ArrowLeft size={16} />
            Lead Tracker
          </a>
        </div>

        <div className="sidebar-user">
          <span className="avatar">{initials}</span>
          <div className="sidebar-user-text">
            <p className="sidebar-user-name">{name}</p>
            <p className="sidebar-user-email">{email}</p>
          </div>
        </div>
      </aside>

      {/* Mobile header */}
      <header className="mobile-header">
        <span className="logo logo-sm">SHX</span>
        <span className="sidebar-title">Manager View</span>
        <span className="spacer" />
        <a className="mobile-back" href="/" onClick={leave}>Lead Tracker</a>
        <span className="avatar avatar-sm" title={`${name} · ${email}`}>{initials}</span>
      </header>

      <main className="manage-main">{children}</main>

      {/* Mobile bottom tab bar */}
      <nav className="mobile-tabs">
        {NAV.map(({ href, short, Icon }) => (
          <Link key={href} href={href} className={`mobile-tab${pathname === href ? ' active' : ''}`}>
            <Icon size={20} />
            <span>{short}</span>
          </Link>
        ))}
      </nav>
    </div>
  );
}
