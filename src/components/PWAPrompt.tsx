import { useState, useEffect } from 'react';
import { Download, Wifi, WifiOff, RefreshCw, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { usePWA } from '@/hooks/use-pwa';

export const PWAPrompt = () => {
  const { isInstallable, isOnline, isUpdateAvailable, install, update } = usePWA();
  const [showInstallBanner, setShowInstallBanner] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    // Show install banner after a delay if installable and not dismissed
    if (isInstallable && !dismissed) {
      const timer = setTimeout(() => {
        setShowInstallBanner(true);
      }, 30000); // 30 seconds

      return () => clearTimeout(timer);
    }
  }, [isInstallable, dismissed]);

  const handleInstall = async () => {
    const success = await install();
    if (success) {
      setShowInstallBanner(false);
    }
  };

  const handleDismiss = () => {
    setShowInstallBanner(false);
    setDismissed(true);
    // Remember dismissal for this session
    sessionStorage.setItem('pwa-install-dismissed', 'true');
  };

  return (
    <>
      {/* Offline Indicator */}
      {!isOnline && (
        <div className="fixed bottom-4 left-4 z-50 animate-in slide-in-from-left">
          <div className="flex items-center gap-2 px-4 py-2 rounded-xl bg-yellow-500/20 border border-yellow-500/50 text-yellow-400">
            <WifiOff className="w-4 h-4" />
            <span className="text-sm font-medium">You're offline</span>
          </div>
        </div>
      )}

      {/* Online Restored Indicator */}
      {isOnline && (
        <OnlineRestoredIndicator />
      )}

      {/* Update Available Banner */}
      {isUpdateAvailable && (
        <div className="fixed bottom-4 right-4 z-50 animate-in slide-in-from-right">
          <div className="glass-card-elevated rounded-xl p-4 max-w-sm">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-xl bg-primary/20 flex items-center justify-center">
                <RefreshCw className="w-5 h-5 text-primary" />
              </div>
              <div className="flex-1">
                <h4 className="font-bold text-sm">Update Available</h4>
                <p className="text-xs text-muted-foreground mt-1">
                  A new version of Draft Vault is ready.
                </p>
                <Button
                  size="sm"
                  className="mt-3 btn-premium"
                  onClick={update}
                >
                  <RefreshCw className="w-3 h-3 mr-1" />
                  Update Now
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Install Banner */}
      {showInstallBanner && !isUpdateAvailable && (
        <div className="fixed bottom-4 right-4 z-50 animate-in slide-in-from-right">
          <div className="glass-card-elevated rounded-xl p-4 max-w-sm">
            <button
              onClick={handleDismiss}
              className="absolute top-2 right-2 p-1 rounded-lg hover:bg-secondary/50 transition-colors"
            >
              <X className="w-4 h-4 text-muted-foreground" />
            </button>
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary to-accent flex items-center justify-center">
                <Download className="w-5 h-5 text-white" />
              </div>
              <div className="flex-1 pr-6">
                <h4 className="font-bold text-sm">Install Draft Vault</h4>
                <p className="text-xs text-muted-foreground mt-1">
                  Get the full experience with offline access and faster loading.
                </p>
                <div className="flex gap-2 mt-3">
                  <Button
                    size="sm"
                    className="btn-premium"
                    onClick={handleInstall}
                  >
                    <Download className="w-3 h-3 mr-1" />
                    Install
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={handleDismiss}
                  >
                    Not now
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

// Temporary indicator when coming back online
const OnlineRestoredIndicator = () => {
  const [show, setShow] = useState(false);
  const [wasOffline, setWasOffline] = useState(false);

  useEffect(() => {
    const handleOffline = () => setWasOffline(true);
    const handleOnline = () => {
      if (wasOffline) {
        setShow(true);
        setTimeout(() => setShow(false), 3000);
        setWasOffline(false);
      }
    };

    window.addEventListener('offline', handleOffline);
    window.addEventListener('online', handleOnline);

    return () => {
      window.removeEventListener('offline', handleOffline);
      window.removeEventListener('online', handleOnline);
    };
  }, [wasOffline]);

  if (!show) return null;

  return (
    <div className="fixed bottom-4 left-4 z-50 animate-in slide-in-from-left">
      <div className="flex items-center gap-2 px-4 py-2 rounded-xl bg-green-500/20 border border-green-500/50 text-green-400">
        <Wifi className="w-4 h-4" />
        <span className="text-sm font-medium">Back online</span>
      </div>
    </div>
  );
};

export default PWAPrompt;
