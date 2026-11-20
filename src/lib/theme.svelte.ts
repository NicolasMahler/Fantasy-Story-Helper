/**
 * Light/dark theme. The preference ('system' follows the device) is saved on this device, and the
 * resolved mode is written to <html data-theme>, which app.css keys its colors on. index.html runs the
 * same logic inline before the app loads, so the page never flashes the wrong theme.
 */
export type ThemePref = 'system' | 'light' | 'dark';

const KEY = 'fh.theme';
/** Browser bar color for each mode; matches --bg in app.css. */
const BAR = { light: '#ece5da', dark: '#211b16' } as const;

function readPref(): ThemePref {
  try {
    const v = localStorage.getItem(KEY);
    return v === 'light' || v === 'dark' ? v : 'system';
  } catch {
    return 'system';
  }
}

const media = typeof matchMedia === 'function' ? matchMedia('(prefers-color-scheme: dark)') : null;

export const theme = $state({ pref: readPref(), dark: false });

function apply() {
  theme.dark = theme.pref === 'dark' || (theme.pref === 'system' && !!media?.matches);
  if (typeof document === 'undefined') return;
  const mode = theme.dark ? 'dark' : 'light';
  document.documentElement.dataset.theme = mode;
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', BAR[mode]);
}

export function setTheme(pref: ThemePref) {
  theme.pref = pref;
  try {
    if (pref === 'system') localStorage.removeItem(KEY);
    else localStorage.setItem(KEY, pref);
  } catch { /* storage unavailable: still applies for this visit */ }
  apply();
}

/** The header button: flip to the opposite of what's showing now. */
export const toggleTheme = () => setTheme(theme.dark ? 'light' : 'dark');

media?.addEventListener('change', apply);
apply();
