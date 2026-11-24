import { useEffect, useState } from "react";

let _deferredPrompt: any = null;
let _showFn: ((v: boolean) => void) | null = null;

const DISMISSED_KEY = "pwa-banner-dismissed";
const PENDING_KEY = "pwa-pending-trigger";
const THREE_DAYS_MS = 3 * 24 * 60 * 60 * 1000;

function isSuppressed(): boolean {
  const standalone =
    window.matchMedia("(display-mode: standalone)").matches ||
    (window.navigator as any).standalone === true;
  if (standalone) return true;
  const ts = localStorage.getItem(DISMISSED_KEY);
  if (ts && Date.now() - Number(ts) < THREE_DAYS_MS) return true;
  return false;
}

// iOS Safari no dispara beforeinstallprompt: la instalacion es manual (Compartir > Agregar a inicio).
export const IS_IOS =
  typeof navigator !== "undefined" && /iPad|iPhone|iPod/.test(navigator.userAgent);

function canShow(): boolean {
  return !isSuppressed() && (!!_deferredPrompt || IS_IOS);
}

if (typeof window !== "undefined") {
  window.addEventListener("beforeinstallprompt", (e) => {
    e.preventDefault();
    _deferredPrompt = e;
    // Show immediately if a trigger was queued while prompt was not ready
    const pending = localStorage.getItem(PENDING_KEY);
    if (pending === "1" && _showFn && !isSuppressed()) {
      localStorage.removeItem(PENDING_KEY);
      setTimeout(() => _showFn?.(true), 300);
    }
  });
}

export function triggerPwaBanner(): void {
  if (canShow() && _showFn) {
    _showFn(true);
  } else {
    // Queue: will fire when deferredPrompt arrives or on next hook mount
    localStorage.setItem(PENDING_KEY, "1");
  }
}

export function queuePwaBannerForNextLoad(): void {
  localStorage.setItem(PENDING_KEY, "1");
}

export function usePwaTrigger() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    _showFn = setVisible;

    const pending = localStorage.getItem(PENDING_KEY);
    if (pending === "1" && canShow()) {
      localStorage.removeItem(PENDING_KEY);
      const timer = setTimeout(() => setVisible(true), 1500);
      return () => {
        clearTimeout(timer);
        if (_showFn === setVisible) _showFn = null;
      };
    }

    return () => {
      if (_showFn === setVisible) _showFn = null;
    };
  }, []);

  function handleInstall() {
    if (!_deferredPrompt) return;
    _deferredPrompt.prompt();
    _deferredPrompt.userChoice.then(() => {
      _deferredPrompt = null;
      setVisible(false);
    });
  }

  function handleDismiss() {
    localStorage.setItem(DISMISSED_KEY, String(Date.now()));
    setVisible(false);
  }

  return { visible, handleInstall, handleDismiss, isIos: IS_IOS };
}
