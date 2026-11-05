import { useEffect, useState } from 'react';

export default function PWAInstallPrompt({
  installPrompt,
  dismissInstallPrompt,
  isIOS,
  isStandalone,
}) {
  const [showIOS, setShowIOS] = useState(false);

  if (!installPrompt && !(isIOS && !isStandalone)) return null;

  const handleInstall = async () => {
    if (!installPrompt) return;
    try {
      await installPrompt.prompt();
      const { outcome } = await installPrompt.userChoice;
      if (outcome === 'accepted') {
        dismissInstallPrompt();
      }
    } catch {}
    installPrompt = null;
  };

  const handleIOSDismiss = () => {
    try {
      localStorage.setItem('kaychart_ios_install_dismissed', 'true');
    } catch {}
    setShowIOS(false);
    dismissInstallPrompt();
  };

  const dismissed = localStorage.getItem('kaychart_ios_install_dismissed');
  const showIOSPrompt = isIOS && !isStandalone && !dismissed && !showIOS;

  return (
    <>
      {installPrompt && (
        <div className="fixed bottom-4 left-4 right-4 z-[60] flex items-center gap-3 p-4 rounded-2xl bg-surface-card border border-border-subtle shadow-[0_8px_40px_rgba(0,0,0,0.6)] press-feedback">
          <div className="flex-grow">
            <p className="font-body-sm text-body-sm text-on-surface">Install Kay Chart</p>
            <p className="font-body-xs text-body-xs text-on-surface-variant/60 mt-0.5">
              Add Kay Chart to your home screen for a native app experience.
            </p>
          </div>
          <button
            onClick={handleInstall}
            className="px-4 py-2 rounded-xl bg-primary text-background font-body-sm text-body-sm font-semibold hover:bg-primary-hover transition-colors press-feedback"
          >
            Install
          </button>
          <button
            onClick={dismissInstallPrompt}
            className="text-on-surface-variant hover:text-on-surface press-feedback"
          >
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>
      )}

      {showIOSPrompt && (
        <div className="fixed bottom-4 left-4 right-4 z-[60] flex items-center gap-3 p-4 rounded-2xl bg-surface-card border border-border-subtle shadow-[0_8px_40px_rgba(0,0,0,0.6)] press-feedback">
          <div className="flex-grow">
            <p className="font-body-sm text-body-sm text-on-surface">Install on iPhone</p>
            <p className="font-body-xs text-body-xs text-on-surface-variant/60 mt-0.5">
              Tap <span className="font-mono text-[10px]">Share</span>, then{' '}
              <span className="font-mono text-[10px] font-semibold">Add to Home Screen</span>.
            </p>
          </div>
          <button
            onClick={() => setShowIOS(true)}
            className="px-4 py-2 rounded-xl bg-primary text-background font-body-sm text-body-sm font-semibold hover:bg-primary-hover transition-colors press-feedback"
          >
            Got it
          </button>
          <button
            onClick={handleIOSDismiss}
            className="text-on-surface-variant hover:text-on-surface press-feedback"
          >
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>
      )}

      {showIOS && (
        <div className="fixed inset-0 z-[70] bg-black/80 flex items-center justify-center" onClick={() => setShowIOS(false)}>
          <div className="bg-surface-card rounded-2xl p-6 max-w-md w-full" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-headline-md text-headline-md text-on-surface">Add to Home Screen</h2>
              <button onClick={() => setShowIOS(false)} className="text-on-surface-variant">
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>
            <div className="flex flex-col items-center gap-4">
              <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-primary to-secondary flex items-center justify-center shadow-[0_0_30px_rgba(214,255,61,0.3)]">
                <span className="material-symbols-outlined text-background text-[36px] icon-fill">share</span>
              </div>
              <p className="font-body-sm text-body-sm text-on-surface text-center mb-1">
                Tap the Share button
              </p>
              <p className="font-body-sm text-body-sm text-on-surface text-center mb-4">
                then scroll and tap <span className="font-semibold text-primary">Add to Home Screen</span>
              </p>
              <button onClick={() => setShowIOS(false)} className="px-6 py-2 rounded-xl bg-primary text-background font-body-sm text-body-sm font-semibold press-feedback">
                Got it
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
