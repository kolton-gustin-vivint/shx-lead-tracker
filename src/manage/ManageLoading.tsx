/**
 * The Lead Tracker's loader (a ring with a spinning green arc), in the Manager
 * View's dark theme. Brings its own `.manage` wrapper so it can render before
 * ManageShell exists (e.g. as the layout's Suspense fallback).
 */
export default function ManageLoading({ label = 'Loading Manager View…' }: { label?: string }) {
  return (
    <div className="manage manage-loading" role="status" aria-live="polite">
      <div className="loader-ring">
        <div className="loader-arc" />
      </div>
      <p>{label}</p>
    </div>
  );
}

/** Small inline version for table rows and buttons. */
export function Spinner({ size = 16 }: { size?: number }) {
  return <span className="spinner" style={{ width: size, height: size }} aria-hidden />;
}
