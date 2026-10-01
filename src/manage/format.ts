/**
 * A last-login value is either a full ISO timestamp or a bare calendar date
 * ("2026-09-30", which is all Airtable's date field holds). `new Date()` reads
 * a bare date as midnight UTC — the previous evening anywhere west of UTC — so
 * bare dates are built as local calendar dates instead.
 */
export function parseDateValue(value: string): { date: Date; dateOnly: boolean } {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (m) return { date: new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3])), dateOnly: true };
  return { date: new Date(value), dateOnly: false };
}

/** "5 minutes ago", "3 hours ago", "today", "2 days ago". */
export function describeAge({ date, dateOnly }: { date: Date; dateOnly: boolean }): string {
  const now = new Date();
  if (dateOnly) {
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const days = Math.round((today.getTime() - date.getTime()) / 86_400_000);
    if (days <= 0) return 'today';
    if (days === 1) return 'yesterday';
    return `${days} days ago`;
  }
  const mins = Math.max(0, Math.round((now.getTime() - date.getTime()) / 60_000));
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins} minute${mins === 1 ? '' : 's'} ago`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours} hour${hours === 1 ? '' : 's'} ago`;
  const days = Math.round(hours / 24);
  return `${days} day${days === 1 ? '' : 's'} ago`;
}

export function formatDate(value: string | null | undefined): string {
  if (!value) return '—';
  return parseDateValue(value).date.toLocaleDateString();
}

export function formatCurrency(n: number | null | undefined): string {
  return (n ?? 0).toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });
}
