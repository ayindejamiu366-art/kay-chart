import { useApp } from '../hooks/useApp';

export default function PWAUpdateNotifier({ updateAvailable, applyUpdate }) {
  if (!updateAvailable) return null;

  return (
    <div className="fixed bottom-4 left-4 right-4 z-[60] flex items-center gap-3 p-4 rounded-2xl bg-surface-card border border-border-subtle shadow-[0_8px_40px_rgba(0,0,0,0.6)] press-feedback">
      <div className="flex-grow">
        <p className="font-body-sm text-body-sm text-on-surface">Kay Chart update available</p>
        <p className="font-body-xs text-body-xs text-on-surface-variant/60 mt-0.5">
          Reload to get the latest version.
        </p>
      </div>
      <button
        onClick={applyUpdate}
        className="px-4 py-2 rounded-xl bg-primary text-background font-body-sm text-body-sm font-semibold hover:bg-primary-hover transition-colors press-feedback"
      >
        Reload
      </button>
    </div>
  );
}
