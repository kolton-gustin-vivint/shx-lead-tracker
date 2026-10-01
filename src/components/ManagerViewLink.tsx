'use client';

/** The managers-only "Manager View" button, with instant feedback while it opens. */
import Link, { useLinkStatus } from 'next/link';
import { LayoutDashboard, Loader2 } from 'lucide-react';

function Label() {
  const { pending } = useLinkStatus();
  return pending ? (
    <>
      <Loader2 className="h-4 w-4 animate-spin" />
      Opening…
    </>
  ) : (
    <>
      <LayoutDashboard className="h-4 w-4" />
      Manager View
    </>
  );
}

export default function ManagerViewLink({ className }: { className: string }) {
  return (
    <Link href="/manage" className={className}>
      <Label />
    </Link>
  );
}
