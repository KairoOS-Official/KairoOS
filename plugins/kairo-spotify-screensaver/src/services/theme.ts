import { useEffect, useState } from 'react';

export interface ThemeColors {
  bg_primary: string;
  bg_secondary: string;
  bg_card: string;
  sidebar_bg: string;
  accent_primary: string;
  accent_secondary: string;
  text_primary: string;
  text_secondary: string;
  text_muted: string;
  border: string;
  success: string;
  warning: string;
  danger: string;
}

export interface KairoTheme {
  id?: string;
  name?: string;
  isDark?: boolean;
  colors?: Partial<ThemeColors>;
}

export const DEFAULT_DARK_THEME: KairoTheme = {
  id: 'kairo-default',
  name: 'Kaïro Dark',
  isDark: true,
  colors: {
    bg_primary: '#0b0f19',
    bg_secondary: '#111827',
    bg_card: '#1e293b',
    sidebar_bg: '#0f172a',
    accent_primary: '#10b981', // emerald
    accent_secondary: '#38bdf8', // sky
    text_primary: '#f8fafc',
    text_secondary: '#94a1b2',
    text_muted: '#64748b',
    border: '#334155',
    success: '#10b981',
    warning: '#f59e0b',
    danger: '#ef4444',
  },
};

export function isLuminanceDark(colorHex: string): boolean {
  if (!colorHex || typeof colorHex !== 'string') return true;
  let hex = colorHex.replace('#', '').trim();
  if (hex.length === 3) {
    hex = hex.split('').map(c => c + c).join('');
  }
  if (hex.length !== 6) return true;
  const r = parseInt(hex.substring(0, 2), 16);
  const g = parseInt(hex.substring(2, 4), 16);
  const b = parseInt(hex.substring(4, 6), 16);
  const luminance = 0.2126 * (r / 255) + 0.7152 * (g / 255) + 0.0722 * (b / 255);
  return luminance < 0.5;
}

/**
 * Applique les variables CSS sur le document racine du plugin
 */
export function applyThemeToCss(theme: KairoTheme) {
  const root = document.documentElement;
  const colors = theme.colors || {};

  const bgPrimary = colors.bg_primary || (theme.isDark ? '#0b0f19' : '#f8fafc');
  const bgSecondary = colors.bg_secondary || (theme.isDark ? '#111827' : '#ffffff');
  const bgCard = colors.bg_card || (theme.isDark ? '#1e293b' : '#f1f5f9');
  const accentPrimary = colors.accent_primary || '#10b981';
  const accentSecondary = colors.accent_secondary || '#38bdf8';
  const textPrimary = colors.text_primary || (theme.isDark ? '#f8fafc' : '#0f172a');
  const textSecondary = colors.text_secondary || (theme.isDark ? '#94a1b2' : '#475569');
  const textMuted = colors.text_muted || (theme.isDark ? '#64748b' : '#94a3b8');
  const borderColor = colors.border || (theme.isDark ? '#334155' : '#e2e8f0');

  const isDark = theme.isDark !== undefined ? theme.isDark : isLuminanceDark(bgPrimary);

  root.style.setProperty('--kairo-bg-primary', bgPrimary);
  root.style.setProperty('--kairo-bg-secondary', bgSecondary);
  root.style.setProperty('--kairo-bg-card', bgCard);
  root.style.setProperty('--kairo-accent-primary', accentPrimary);
  root.style.setProperty('--kairo-accent-secondary', accentSecondary);
  root.style.setProperty('--kairo-text-primary', textPrimary);
  root.style.setProperty('--kairo-text-secondary', textSecondary);
  root.style.setProperty('--kairo-text-muted', textMuted);
  root.style.setProperty('--kairo-border-color', borderColor);
  root.style.setProperty('--kairo-is-dark', isDark ? '1' : '0');

  if (isDark) {
    root.classList.add('dark');
    root.classList.remove('light');
  } else {
    root.classList.add('light');
    root.classList.remove('dark');
  }
}

/**
 * Hook d'adaptation automatique au thème KaïroOS
 */
export function useKairoTheme(): { theme: KairoTheme; isDark: boolean } {
  const [theme, setTheme] = useState<KairoTheme>(DEFAULT_DARK_THEME);

  useEffect(() => {
    const fetchTheme = async () => {
      try {
        // 1. Appel direct via window.kairo?.getTheme() selon spécification
        const kairoGlobal = (window as any).kairo || (window.parent as any)?.kairo;
        if (kairoGlobal && typeof kairoGlobal.getTheme === 'function') {
          const t = await kairoGlobal.getTheme();
          if (t && t.colors) {
            setTheme(t);
            applyThemeToCss(t);
            return;
          }
        }
        if (kairoGlobal && kairoGlobal.theme) {
          setTheme(kairoGlobal.theme);
          applyThemeToCss(kairoGlobal.theme);
          return;
        }

        // 2. Détection via variables CSS du parent si accessible
        try {
          if (window.parent && window.parent !== window && window.parent.document) {
            const parentComputed = window.parent.getComputedStyle(window.parent.document.documentElement);
            const parentBg = parentComputed.getPropertyValue('--bg-primary').trim();
            if (parentBg) {
              const detectedTheme: KairoTheme = {
                id: 'kairo-detected',
                isDark: isLuminanceDark(parentBg),
                colors: {
                  bg_primary: parentBg,
                  bg_secondary: parentComputed.getPropertyValue('--bg-secondary').trim() || undefined,
                  bg_card: parentComputed.getPropertyValue('--bg-card').trim() || undefined,
                  accent_primary: parentComputed.getPropertyValue('--accent-primary').trim() || '#10b981',
                  accent_secondary: parentComputed.getPropertyValue('--accent-secondary').trim() || '#38bdf8',
                  text_primary: parentComputed.getPropertyValue('--text-primary').trim() || '#ffffff',
                  text_secondary: parentComputed.getPropertyValue('--text-secondary').trim() || '#94a1b2',
                  text_muted: parentComputed.getPropertyValue('--text-muted').trim() || '#64748b',
                  border: parentComputed.getPropertyValue('--border-color').trim() || '#334155',
                },
              };
              setTheme(detectedTheme);
              applyThemeToCss(detectedTheme);
              return;
            }
          }
        } catch (_) {}

        // Fallback standard
        applyThemeToCss(DEFAULT_DARK_THEME);
      } catch (err) {
        applyThemeToCss(DEFAULT_DARK_THEME);
      }
    };

    fetchTheme();

    // Écoute des mises à jour de thème envoyées par l'hôte KaïroOS via postMessage
    const handleMessage = (e: MessageEvent) => {
      if (!e.data) return;
      if (e.data.type === 'kairo_theme_change' || e.data.type === 'theme_changed' || e.data.type === 'kairo_update_theme') {
        const newTheme = e.data.theme || e.data.payload;
        if (newTheme) {
          setTheme(newTheme);
          applyThemeToCss(newTheme);
        }
      }
    };

    window.addEventListener('message', handleMessage);
    const interval = setInterval(fetchTheme, 10000);

    return () => {
      window.removeEventListener('message', handleMessage);
      clearInterval(interval);
    };
  }, []);

  const isDark = theme.isDark !== undefined ? theme.isDark : isLuminanceDark(theme.colors?.bg_primary || '#0b0f19');
  return { theme, isDark };
}
