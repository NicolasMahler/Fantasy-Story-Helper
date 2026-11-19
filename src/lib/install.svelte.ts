/** PWA install state, shared app-wide. Import this module early (main.ts) so the prompt event isn't missed. */

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

const standalone = () =>
  typeof window !== 'undefined' &&
  (window.matchMedia?.('(display-mode: standalone)').matches || (navigator as unknown as { standalone?: boolean }).standalone === true);

export const install = $state({
  /** The browser offered an install prompt we can show. */
  canPrompt: false,
  installed: standalone(),
  /** iPhone/iPad Safari: no prompt API, the user installs via Share → Add to Home Screen. */
  ios: typeof navigator !== 'undefined' && /iphone|ipad|ipod/i.test(navigator.userAgent),
});

let deferred: BeforeInstallPromptEvent | null = null;

if (typeof window !== 'undefined') {
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferred = e as BeforeInstallPromptEvent;
    install.canPrompt = true;
  });
  window.addEventListener('appinstalled', () => {
    install.installed = true;
    install.canPrompt = false;
  });
}

export async function promptInstall(): Promise<boolean> {
  if (!deferred) return false;
  await deferred.prompt();
  const { outcome } = await deferred.userChoice;
  deferred = null;
  install.canPrompt = false;
  return outcome === 'accepted';
}
