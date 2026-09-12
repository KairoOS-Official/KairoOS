import React from 'react';
import { Monitor, Globe, Sparkles, Maximize2, MousePointerClick } from 'lucide-react';
import { AppSettings, Theme } from '../../../types';

interface DisplaySectionProps {
  settings: AppSettings;
  updateSetting: (key: keyof AppSettings, val: any) => void;
  onNavigateToThemes: () => void;
  activeTheme: Theme;
  onToggleFullscreen?: () => Promise<boolean | void>;
}

export const DisplaySection: React.FC<DisplaySectionProps> = ({
  settings,
  updateSetting,
  onNavigateToThemes,
  activeTheme,
  onToggleFullscreen,
}) => {
  return (
    <div className="space-y-6">
      {/* 1. Thème Actif */}
      <div
        style={{
          backgroundColor: 'var(--bg-card)',
          borderColor: 'var(--border-color)',
        }}
        className="p-5 rounded-3xl border shadow-xs flex items-center justify-between"
      >
        <div className="flex items-center gap-3.5">
          <div
            className="w-12 h-12 rounded-2xl flex items-center justify-center shadow-inner border border-black/10"
            style={{ backgroundColor: activeTheme.colors?.bg_primary || '#0b0f19' }}
          >
            <Sparkles className="w-6 h-6" style={{ color: activeTheme.colors?.accent_primary || '#f43f5e' }} />
          </div>
          <div>
            <div
              style={{ color: 'var(--accent-primary)' }}
              className="text-[10px] font-black uppercase tracking-wider"
            >
              Thème Actif
            </div>
            <h3 style={{ color: 'var(--text-primary)' }} className="text-sm font-black">
              {activeTheme.name}
            </h3>
            <p style={{ color: 'var(--text-muted)' }} className="text-xs">
              Par {activeTheme.author} • v{activeTheme.version}
            </p>
          </div>
        </div>

        <button
          onClick={onNavigateToThemes}
          style={{
            backgroundColor: 'var(--bg-secondary)',
            borderColor: 'var(--border-color)',
            color: 'var(--text-primary)',
          }}
          className="px-4 py-2 rounded-xl text-xs font-bold transition-all border hover:border-[var(--accent-primary)]/40 hover:opacity-90"
        >
          Personnaliser le style & couleurs
        </button>
      </div>

      {/* 2. Fenêtrage & Écran */}
      <div className="p-5 rounded-3xl bg-white border border-purple-100 shadow-xs space-y-4">
        <div className="flex items-center gap-2">
          <Monitor className="w-4 h-4 text-purple-600" />
          <h3 className="text-xs font-black uppercase tracking-wider text-slate-900">
            Comportement de la Fenêtre & Curseur
          </h3>
        </div>

        <div className="flex items-center justify-between p-3.5 rounded-2xl bg-purple-50/30 border border-purple-100 mb-3">
          <div>
            <div className="text-xs font-black text-slate-800">Mode Plein Écran Actuel</div>
            <div className="text-[11px] text-slate-400">Basculer immédiatement la fenêtre de KaïroOS</div>
          </div>
          {onToggleFullscreen && (
            <button
              onClick={() => onToggleFullscreen()}
              className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl border border-purple-200 bg-white hover:bg-slate-50 text-xs font-bold text-slate-700 shadow-2xs"
            >
              <Maximize2 className="w-3.5 h-3.5 text-purple-600" />
              <span>Basculer</span>
            </button>
          )}
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <label className="flex items-center justify-between p-3.5 rounded-2xl border border-purple-100 hover:bg-purple-50/20 cursor-pointer transition-colors">
            <div>
              <div className="text-xs font-black text-slate-800">Plein écran au démarrage</div>
              <div className="text-[11px] text-slate-400">Lancer KaïroOS automatiquement en plein écran</div>
            </div>
            <input
              type="checkbox"
              checked={Boolean(settings.fullscreen)}
              onChange={(e) => updateSetting('fullscreen', e.target.checked)}
              className="w-4 h-4 rounded text-rose-500 focus:ring-rose-400"
            />
          </label>

          <label className="flex items-center justify-between p-3.5 rounded-2xl border border-purple-100 hover:bg-purple-50/20 cursor-pointer transition-colors">
            <div>
              <div className="text-xs font-black text-slate-800">Toujours au premier plan (Always on Top)</div>
              <div className="text-[11px] text-slate-400">Empêche les autres fenêtres de masquer KaïroOS</div>
            </div>
            <input
              type="checkbox"
              checked={Boolean(settings.always_on_top)}
              onChange={(e) => {
                const val = e.target.checked;
                updateSetting('always_on_top', val);
                import('../../../api/settings').then((m) => m.setAlwaysOnTop(val)).catch(() => {});
              }}
              className="w-4 h-4 rounded text-rose-500 focus:ring-rose-400"
            />
          </label>

          <label className="flex items-center justify-between p-3.5 rounded-2xl border border-purple-100 hover:bg-purple-50/20 cursor-pointer transition-colors">
            <div>
              <div className="text-xs font-black text-slate-800">Masquer le curseur de souris</div>
              <div className="text-[11px] text-slate-400">Recommandé pour les bornes d'arcade pures</div>
            </div>
            <input
              type="checkbox"
              checked={Boolean(settings.hide_mouse_cursor)}
              onChange={(e) => updateSetting('hide_mouse_cursor', e.target.checked)}
              className="w-4 h-4 rounded text-rose-500 focus:ring-rose-400"
            />
          </label>

          <div className="p-3.5 rounded-2xl border border-purple-100 bg-purple-50/20 flex flex-col justify-center">
            <label className="block text-xs font-bold text-slate-700 mb-1">Résolution de l'interface</label>
            <select
              value={settings.ui_resolution || 'auto'}
              onChange={(e) => updateSetting('ui_resolution', e.target.value)}
              className="w-full text-xs font-bold p-2 rounded-xl border border-purple-100 bg-white"
            >
              <option value="auto">Automatique (Résolution native écran)</option>
              <option value="720p">720p HD (1280x720)</option>
              <option value="1080p">1080p Full HD (1920x1080)</option>
              <option value="4k">4K Ultra HD (3840x2160)</option>
            </select>
          </div>
        </div>
      </div>

      {/* 3. Interaction & Sélection de Jeux */}
      <div className="p-5 rounded-3xl bg-white border border-purple-100 shadow-xs space-y-4">
        <div className="flex items-center gap-2">
          <MousePointerClick className="w-4 h-4 text-purple-600" />
          <h3 className="text-xs font-black uppercase tracking-wider text-slate-900">
            Navigation & Interaction
          </h3>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              Action au clic / touche A / ✕ sur un jeu
            </label>
            <select
              value={settings.game_select_action || 'details'}
              onChange={(e) => updateSetting('game_select_action', e.target.value)}
              className="w-full text-xs font-bold p-2.5 rounded-xl border border-purple-100 bg-purple-50/20"
            >
              <option value="details">Ouvrir la fiche du jeu (Page complète, médias, stats)</option>
              <option value="launch">Lancer directement le jeu (Mode Arcade Rapide)</option>
            </select>
            <p className="text-[11px] text-slate-400 mt-1">
              {settings.game_select_action === 'launch'
                ? "⚡ Le jeu se lance immédiatement. La touche Y (ou △) reste disponible pour voir la fiche."
                : "📄 Affiche la page de détails avec jaquette haute définition, historique et réglages."}
            </p>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              Style des invites manette (Barre d'aide)
            </label>
            <select
              value={settings.button_prompt_style || 'xbox'}
              onChange={(e) => updateSetting('button_prompt_style', e.target.value)}
              className="w-full text-xs font-bold p-2.5 rounded-xl border border-purple-100 bg-purple-50/20"
            >
              <option value="xbox">Style Xbox (A, B, X, Y)</option>
              <option value="playstation">Style PlayStation (✕, ○, □, △)</option>
            </select>
            <p className="text-[11px] text-slate-400 mt-1">
              Adapte les icônes d'aide affichées en bas d'écran selon votre manette.
            </p>
          </div>
        </div>
      </div>

      {/* 4. Langues */}
      <div className="p-5 rounded-3xl bg-white border border-purple-100 shadow-xs space-y-4">
        <div className="flex items-center gap-2">
          <Globe className="w-4 h-4 text-purple-600" />
          <h3 className="text-xs font-black uppercase tracking-wider text-slate-900">
            Langues & Localisation
          </h3>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">Langue de l'Interface</label>
            <select
              value={settings.ui_language || 'fr'}
              onChange={(e) => updateSetting('ui_language', e.target.value)}
              className="w-full text-xs font-bold p-2.5 rounded-xl border border-purple-100 bg-purple-50/20"
            >
              <option value="fr">Français (FR)</option>
              <option value="en">English (EN)</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">Langue des Métadonnées Scraping</label>
            <select
              value={settings.metadata_language || 'fr'}
              onChange={(e) => updateSetting('metadata_language', e.target.value)}
              className="w-full text-xs font-bold p-2.5 rounded-xl border border-purple-100 bg-purple-50/20"
            >
              <option value="fr">Français prioritaire</option>
              <option value="en">Anglais prioritaire</option>
              <option value="both">Français et Anglais combinés</option>
            </select>
          </div>
        </div>
      </div>
    </div>
  );
};
