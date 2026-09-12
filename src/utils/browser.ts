import { openUrl } from '@tauri-apps/plugin-opener';

/**
 * Ouvre une URL externe dans le navigateur par defaut du systeme (Edge, Chrome, Firefox...)
 * en utilisant le plugin officiel Tauri v2 opener.
 */
export async function openExternalUrl(url: string): Promise<boolean> {
  if (!url) return false;
  try {
    await openUrl(url);
    return true;
  } catch (err) {
    console.warn('[Browser Util] Erreur avec @tauri-apps/plugin-opener openUrl, tentative fallback window.open:', err);
    try {
      const opened = window.open(url, '_blank', 'noopener,noreferrer');
      return Boolean(opened);
    } catch (e2) {
      console.error('[Browser Util] Fallback window.open echoue:', e2);
      return false;
    }
  }
}
