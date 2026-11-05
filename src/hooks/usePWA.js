let registrationPromise = null;

function isNativeCapacitor() {
  try {
    const bridge = typeof window !== 'undefined' ? window.Capacitor : null;
    if (!bridge) return false;
    if (typeof bridge.isNativePlatform === 'function') return Boolean(bridge.isNativePlatform());
    const platform = bridge.getPlatform ? bridge.getPlatform() : bridge.platform;
    return platform === 'android' || platform === 'ios';
  } catch {
    return false;
  }
}

export function usePWA() {
  const [updateAvailable, setUpdateAvailable] = useState(false);
  const [installPrompt, setInstallPrompt] = useState(null);
  const [isIOS, setIsIOS] = useState(false);
  const [isAndroid, setIsAndroid] = useState(false);

  const registerSW = useCallback(async () => {
    if (!('serviceWorker' in navigator)) return null;
    if (isNativeCapacitor()) return null;
    if (registrationPromise) return registrationPromise;

    registrationPromise = (async () => {
      try {
        const registration = await navigator.serviceWorker.register('/sw.js', {
          scope: '/',
        });

        registration.addEventListener('updatefound', () => {
          const newWorker = registration.installing;
          if (!newWorker) return;
          newWorker.addEventListener('statechange', () => {
            if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
              setUpdateAvailable(true);
            }
          });
        });

        return registration;
      } catch (err) {
        console.error('[KayChart] Service worker registration failed:', err);
        return null;
      }
    })();

    return registrationPromise;
  }, []);

  const applyUpdate = useCallback(() => {
    if (!registrationPromise) return;
    registrationPromise.then((reg) => {
      if (reg?.waiting) {
        reg.waiting.postMessage({ type: 'SKIP_WAITING' });
        window.location.reload();
      }
    });
  }, []);

  const dismissInstallPrompt = useCallback(() => {
    try {
      localStorage.setItem('kaychart_install_dismissed', 'true');
    } catch {}
    setInstallPrompt(null);
  }, []);

  useEffect(() => {
    const ua = navigator.userAgent;
    setIsIOS(/iPad|iPhone|iPod/.test(ua) && !window.MSStream);
    setIsAndroid(/Android/.test(ua));
  }, []);

  useEffect(() => {
    let deferredPrompt = null;

    const handleBeforeInstallPrompt = (e) => {
      e.preventDefault();
      deferredPrompt = e;
      const dismissed = localStorage.getItem('kaychart_install_dismissed');
      const isStandalone = window.matchMedia('(display-mode: standalone)').matches;
      if (!dismissed && !isStandalone && isAndroid) {
        setInstallPrompt(deferredPrompt);
      }
    };

    const handleAppInstalled = () => {
      setInstallPrompt(null);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    window.addEventListener('appinstalled', handleAppInstalled);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('appinstalled', handleAppInstalled);
    };
  }, [isAndroid]);

  useEffect(() => {
    registerSW();
  }, [registerSW]);

  return {
    updateAvailable,
    applyUpdate,
    installPrompt,
    dismissInstallPrompt,
    isIOS,
    isAndroid,
    isStandalone: window.matchMedia('(display-mode: standalone)').matches,
  };
}
