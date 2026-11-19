/**
 * App-update state. The service worker downloads a new version in the background and waits;
 * we show a banner, and "Reload" activates the new version and reloads the page.
 * Import this module early (main.ts). In dev the PWA virtual module is a no-op, so nothing shows.
 */
import { registerSW } from 'virtual:pwa-register';

export const update = $state({ ready: false });

const HOUR = 60 * 60 * 1000;

const updateSW = registerSW({
  onNeedRefresh() {
    update.ready = true;
  },
  onRegisteredSW(_url, reg) {
    if (!reg) return;
    // A home-screen app can stay open (or suspended) for days: also check when it comes back
    // to the foreground and once an hour while it's open.
    const check = () => {
      if (navigator.onLine && !reg.installing) reg.update().catch(() => {});
    };
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') check();
    });
    setInterval(check, HOUR);
  },
});

export function applyUpdate() {
  void updateSW(true);
}

export function dismissUpdate() {
  update.ready = false;
}
