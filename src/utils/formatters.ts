/**
 * Formats a raw phone string into (XXX) XXX-XXXX for US numbers.
 * Returns the original string unchanged if it doesn't contain exactly 10 or 11 digits.
 */
export function formatPhone(raw: string | undefined | null): string {
  if (!raw) return '';
  const digits = raw.replace(/\D/g, '');
  // Strip leading "1" for 11-digit US numbers
  const d = digits.length === 11 && digits.startsWith('1') ? digits.slice(1) : digits;
  if (d.length !== 10) return raw; // Not a standard US number — return as-is
  return `(${d.slice(0, 3)}) ${d.slice(3, 6)}-${d.slice(6)}`;
}

/**
 * Returns just the digits of a phone number for use in tel: links.
 */
export function phoneHref(raw: string | undefined | null): string {
  if (!raw) return '';
  const digits = raw.replace(/\D/g, '');
  return digits.length === 10 ? `1${digits}` : digits;
}

/**
 * Utility function to format last refresh time in a human-readable format
 * Used across multiple components for consistent time display
 */
export const formatLastRefreshTime = (time: Date | null): string => {
  if (!time) return '';
  
  const now = new Date();
  const diffMs = now.getTime() - time.getTime();
  const diffSeconds = Math.floor(diffMs / 1000);
  const diffMinutes = Math.floor(diffSeconds / 60);
  
  if (diffSeconds < 60) {
    return `${diffSeconds}s ago`;
  } else if (diffMinutes < 60) {
    return `${diffMinutes}m ago`;
  } else {
    return time.toLocaleTimeString([], {
      hour: '2-digit',
      minute: '2-digit'
    });
  }
};
