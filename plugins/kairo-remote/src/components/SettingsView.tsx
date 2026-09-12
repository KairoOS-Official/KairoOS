import React, { useState, useEffect, useRef } from 'react';
import {
  Palette,
  Monitor,
  Cpu,
  Tv,
  Gamepad2,
  Library,
  Layers,
  Shield,
  Puzzle,
  Wifi,
  Check,
  AlertCircle,
  Eye,
  EyeOff,
  Search,
  Save,
  RotateCcw,
  Lock,
  Volume2,
  FolderOpen,
  ExternalLink,
  Globe,
  Sparkles,
  Sliders,
} from 'lucide-react';
import {
  RemoteConfig,
  AppSettings,
  Emulator,
  GamepadMapping,
  Theme,
  System,
  PluginInfo,
} from '../types';

interface SettingsViewProps {
  pin: string;
  onSaveRemoteConfig: (cfg: RemoteConfig) => Promise<void>;
  onSaveAppSettings: (settings: AppSettings) => Promise<void>;
  onSaveEmulators: (emus: Emulator[]) => Promise<void>;
  onReloadAll: () => Promise<void>;
  onNavigateToTab?: (tab: string) => void;
  loading: boolean;
}

export type SettingsTabId =
  | 'themes'
  | 'display'
  | 'emulators'
  | 'media'
  | 'gamepads'
  | 'library'
  | 'consoles'
  | 'kiosk'
  | 'plugins'
  | 'remote';

export const SettingsView: React.FC<SettingsViewProps> = ({
  pin,
  onSaveRemoteConfig,
  onSaveAppSettings,
  onSaveEmulators,
  onReloadAll,
  onNavigateToTab,
  loading: parentLoading,
}) => {
  const [activeTab, setActiveTab] = useState<SettingsTabId>('themes');

  // 1. Settings State (exhaustif identique à KaïroOS)
  const [settings, setSettings] = useState<AppSettings>({
    fullscreen: true,
    always_on_top: false,
    kiosk_mode: false,
    auto_kiosk: false,
    game_select_action: 'details',
    arcade_ui_scale: 'normal',
    enabled_franchises: ['mario', 'zelda', 'pokemon', 'sonic', 'versus', 'rpg'],
    custom_franchises: [],
    roms_path: './roms',
    theme: 'retro-80s-light',
    enabled_systems: [],
    enabled_modes: ['2-players', 'genre:fight', 'genre:platform'],
    default_sort: 'title-asc',
    retroarch_shader: 'none',
    aspect_ratio: '4:3',
    brightness: 50,
    contrast: 50,
    metadata_language: 'fr',
    launch_resolution: 'native',
    forced_fullscreen: 'per_game',
    autosave_enabled: true,
    rewind_enabled: false,
    cheats_dir: '',
    saves_dir: '',
    screenshots_dir: '',
    scraping_delay_seconds: 1,
    screenscraper_ssid: '',
    screenscraper_sspassword: '',
    hide_mouse_cursor: false,
    ui_resolution: 'auto',
    ui_language: 'fr',
    startup_sound_enabled: true,
    auto_scan_on_startup: false,
    default_view: 'grid',
    show_games_without_cover: true,
    recent_games_limit: 10,
    extra_cli_args: '',
    debug_logs: false,
    button_prompt_style: 'xbox',
  });

  // 2. Thèmes
  const [themes, setThemes] = useState<Theme[]>([]);
  const [activeThemeId, setActiveThemeId] = useState<string>('retro-80s-light');

  // 3. Émulateurs
  const [emulators, setEmulators] = useState<Emulator[]>([]);
  const [pathTestResults, setPathTestResults] = useState<Record<string, { testing: boolean; exists?: boolean; error?: string }>>({});

  // 4. Manettes
  const [gamepads, setGamepads] = useState<GamepadMapping[]>([]);

  // 5. Systèmes (Consoles)
  const [systems, setSystems] = useState<System[]>([]);

  // 6. Plugins
  const [plugins, setPlugins] = useState<PluginInfo[]>([]);

  // 7. Remote Config
  const [remoteCfg, setRemoteCfg] = useState<RemoteConfig>({
    enabled: true,
    port: 8080,
    pin: '1234',
    allowed_origins: ['*'],
  });
  const [showPin, setShowPin] = useState(false);

  // Status & Notifications
  const [loading, setLoading] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const showFeedback = (message: string, type: 'success' | 'error' = 'success') => {
    setFeedback({ type, message });
    setTimeout(() => setFeedback(null), 3500);
  };

  // Synchronisation automatique temps réel (Debounce 300ms) vers la borne KaïroOS
  const isInitialMount = useRef(true);
  const isFetchingRef = useRef(false);

  // Chargement global initial
  const fetchAllData = async () => {
    isFetchingRef.current = true;
    setLoading(true);
    try {
      const [
        settingsRes,
        emulatorsRes,
        remoteRes,
        gamepadsRes,
        themesRes,
        systemsRes,
        pluginsRes,
      ] = await Promise.all([
        fetch('/api/settings'),
        fetch('/api/emulators'),
        fetch('/api/remote/config'),
        fetch('/api/gamepads').catch(() => null),
        fetch('/api/themes').catch(() => null),
        fetch('/api/systems').catch(() => null),
        fetch('/api/plugins').catch(() => null),
      ]);

      if (settingsRes && settingsRes.ok) {
        const json = await settingsRes.json();
        if (json.data) {
          setSettings((prev) => ({ ...prev, ...json.data }));
          if (json.data.theme) setActiveThemeId(json.data.theme);
        }
      }

      if (emulatorsRes && emulatorsRes.ok) {
        const json = await emulatorsRes.json();
        if (json.data) setEmulators(json.data);
      }

      if (remoteRes && remoteRes.ok) {
        const json = await remoteRes.json();
        if (json.data) setRemoteCfg(json.data);
      }

      if (gamepadsRes && gamepadsRes.ok) {
        const json = await gamepadsRes.json();
        if (json.data) setGamepads(json.data);
      }

      if (themesRes && themesRes.ok) {
        const json = await themesRes.json();
        if (json.data) setThemes(json.data);
      }

      if (systemsRes && systemsRes.ok) {
        const json = await systemsRes.json();
        if (json.data) setSystems(json.data);
      }

      if (pluginsRes && pluginsRes.ok) {
        const json = await pluginsRes.json();
        if (json.data) setPlugins(json.data);
      }
    } catch (e: any) {
      showFeedback('Erreur chargement des données: ' + e.message, 'error');
    } finally {
      setTimeout(() => {
        isFetchingRef.current = false;
      }, 200);
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAllData();
  }, []);

  // Détection des modifications pour mise à jour immédiate de la borne
  useEffect(() => {
    if (isInitialMount.current) {
      isInitialMount.current = false;
      return;
    }
    if (isFetchingRef.current) {
      return;
    }
    const timer = setTimeout(() => {
      onSaveAppSettings(settings).catch((e) => {
        console.warn('[SettingsView] Auto-save error:', e);
      });
    }, 300);
    return () => clearTimeout(timer);
  }, [settings, onSaveAppSettings]);

  // Tester un chemin d'exécutable
  const handleTestPath = async (emulatorId: string, path: string) => {
    if (!path || !path.trim()) {
      setPathTestResults((prev) => ({
        ...prev,
        [emulatorId]: { testing: false, exists: false, error: 'Chemin vide' },
      }));
      return;
    }

    setPathTestResults((prev) => ({
      ...prev,
      [emulatorId]: { testing: true },
    }));

    try {
      const res = await fetch('/api/emulators/test-path', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ path }),
      });

      if (res.ok) {
        const json = await res.json();
        setPathTestResults((prev) => ({
          ...prev,
          [emulatorId]: { testing: false, exists: json.data?.exists ?? false },
        }));
      } else {
        setPathTestResults((prev) => ({
          ...prev,
          [emulatorId]: { testing: false, exists: false, error: 'Erreur API' },
        }));
      }
    } catch (e: any) {
      setPathTestResults((prev) => ({
        ...prev,
        [emulatorId]: { testing: false, exists: false, error: e.message },
      }));
    }
  };

  // Sélection & Sauvegarde d'un thème actif
  const handleSelectTheme = async (themeId: string) => {
    setActiveThemeId(themeId);
    setSettings((prev) => ({ ...prev, theme: themeId }));

    try {
      const res = await fetch('/api/themes/active', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Kairo-Pin': pin,
        },
        body: JSON.stringify({ id: themeId }),
      });
      if (res.ok) {
        showFeedback(`Thème '${themeId}' activé avec succès !`);
      }
    } catch (e: any) {
      console.warn('Erreur activation thème:', e);
    }
  };

  // Sauvegarde des réglages généraux (settings.json)
  const handleSaveSettings = async () => {
    setLoading(true);
    try {
      await onSaveAppSettings(settings);
      showFeedback('Paramètres KaïroOS (settings.json) enregistrés !');
    } catch (e: any) {
      showFeedback('Erreur: ' + e.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  // Sauvegarde des émulateurs (emulators.json)
  const handleSaveEmulatorsTab = async () => {
    setLoading(true);
    try {
      await onSaveEmulators(emulators);
      showFeedback('Émulateurs (emulators.json) enregistrés !');
    } catch (e: any) {
      showFeedback('Erreur: ' + e.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  // Sauvegarde de la configuration distante (remote.json)
  const handleSaveRemoteTab = async () => {
    setLoading(true);
    try {
      await onSaveRemoteConfig(remoteCfg);
      showFeedback('Serveur distant (remote.json) enregistré !');
    } catch (e: any) {
      showFeedback('Erreur: ' + e.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  // Verrouillage instantané Kiosk
  const handleLockKioskNow = async () => {
    try {
      const res = await fetch('/api/kiosk/lock', {
        method: 'POST',
        headers: { 'X-Kairo-Pin': pin },
      });
      if (res.ok) {
        showFeedback('🔒 Mode Kiosk activé immédiatement sur la borne !');
      }
    } catch (e: any) {
      showFeedback('Erreur: ' + e.message, 'error');
    }
  };

  const navTabs: { id: SettingsTabId; label: string; icon: React.ReactNode }[] = [
    { id: 'themes', label: 'Thèmes & Style', icon: <Palette className="w-4 h-4" /> },
    { id: 'display', label: 'Affichage & Écran', icon: <Monitor className="w-4 h-4" /> },
    { id: 'emulators', label: 'Émulateurs & CLI', icon: <Cpu className="w-4 h-4" /> },
    { id: 'media', label: 'Image & Son', icon: <Tv className="w-4 h-4" /> },
    { id: 'gamepads', label: 'Manettes', icon: <Gamepad2 className="w-4 h-4" /> },
    { id: 'library', label: 'Bibliothèque', icon: <Library className="w-4 h-4" /> },
    { id: 'consoles', label: 'Consoles & Modes', icon: <Layers className="w-4 h-4" /> },
    { id: 'kiosk', label: 'Sécurité & Kiosk', icon: <Shield className="w-4 h-4" /> },
    { id: 'plugins', label: 'Plugins & Extensions', icon: <Puzzle className="w-4 h-4" /> },
    { id: 'remote', label: 'Serveur Distant (Remote)', icon: <Wifi className="w-4 h-4" /> },
  ];

  return (
    <div className="space-y-6">
      {/* En-tête sobre d'administration */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-slate-200 pb-4">
        <div>
          <h1 className="text-xl font-bold text-slate-900 tracking-tight">Paramètres du Système KaïroOS</h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Administration complète de la borne : thèmes, rendu, émulateurs, bibliothèque, kiosque et serveur distant.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={async () => {
              await fetchAllData();
              await onReloadAll();
              showFeedback('Configurations rafraîchies !');
            }}
            disabled={loading || parentLoading}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-300 bg-white text-xs font-semibold text-slate-700 hover:bg-slate-50 active:bg-slate-100 disabled:opacity-50 transition-colors shadow-2xs cursor-pointer"
          >
            <RotateCcw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            <span>Rafraîchir</span>
          </button>
        </div>
      </div>

      {/* Message de notification / feedback */}
      {feedback && (
        <div
          className={`p-3 rounded-xl border text-xs font-medium flex items-center gap-2 ${
            feedback.type === 'success'
              ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
              : 'bg-red-50 border-red-200 text-red-800'
          }`}
        >
          {feedback.type === 'success' ? (
            <Check className="w-4 h-4 text-emerald-600 shrink-0" />
          ) : (
            <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
          )}
          <span>{feedback.message}</span>
        </div>
      )}

      {/* Barre de navigation horizontale / onglets défilants */}
      <div className="flex border-b border-slate-200 overflow-x-auto scrollbar-none space-x-1 pb-px">
        {navTabs.map((tab) => {
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-3.5 py-2 text-xs font-semibold border-b-2 whitespace-nowrap transition-colors flex items-center gap-2 shrink-0 cursor-pointer ${
                isActive
                  ? 'border-blue-600 text-blue-600 font-bold bg-blue-50/50 rounded-t-lg'
                  : 'border-transparent text-slate-500 hover:text-slate-800 hover:bg-slate-50'
              }`}
            >
              {tab.icon}
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* ========================================================= */}
      {/* 1. ONGLET THÈMES & STYLE                                  */}
      {/* ========================================================= */}
      {activeTab === 'themes' && (
        <div className="space-y-6">
          <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs space-y-5">
            <div className="border-b border-slate-100 pb-3 flex items-center justify-between">
              <div>
                <h2 className="text-sm font-bold text-slate-900">Thèmes Visuels Disponibles</h2>
                <p className="text-xs text-slate-500">Personnalisez l'ambiance graphique de l'interface KaïroOS</p>
              </div>
              <span className="text-xs font-mono text-slate-400">{themes.length} thème(s)</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {themes.map((t) => {
                const isSelected = activeThemeId === t.id;
                const bgPrimary = t.colors?.bg_primary || '#0f172a';
                const accent = t.colors?.accent_primary || '#3b82f6';
                const cardBg = t.colors?.bg_card || '#1e293b';

                return (
                  <div
                    key={t.id}
                    onClick={() => handleSelectTheme(t.id)}
                    className={`p-4 rounded-2xl border-2 transition-all cursor-pointer flex flex-col justify-between space-y-3 ${
                      isSelected
                        ? 'border-blue-600 bg-blue-50/30 shadow-sm ring-2 ring-blue-500/20'
                        : 'border-slate-200 hover:border-slate-300 bg-white'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <div className="font-bold text-xs text-slate-900 flex items-center gap-1.5">
                          <span>{t.name}</span>
                          {t.is_builtin && (
                            <span className="text-[9px] px-1.5 py-0.2 rounded bg-slate-100 text-slate-600 font-mono">
                              Système
                            </span>
                          )}
                        </div>
                        <p className="text-[11px] text-slate-500 mt-0.5 line-clamp-1">{t.description}</p>
                      </div>

                      {isSelected && (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-600 text-white flex items-center gap-1 shrink-0">
                          <Check className="w-3 h-3" />
                          <span>Actif</span>
                        </span>
                      )}
                    </div>

                    {/* Palette de couleurs miniatures */}
                    <div className="p-3 rounded-xl border border-slate-200/80 flex items-center gap-2" style={{ backgroundColor: bgPrimary }}>
                      <div className="w-5 h-5 rounded-lg border border-white/20 shadow-xs" style={{ backgroundColor: accent }} />
                      <div className="w-5 h-5 rounded-lg border border-white/20 shadow-xs" style={{ backgroundColor: cardBg }} />
                      <span className="text-[10px] font-mono text-white/80 ml-auto">v{t.version}</span>
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="border-t border-slate-100 pt-4">
              <h3 className="text-xs font-bold text-slate-900 mb-2">Accessibilité & Échelle de l'Interface</h3>
              <div className="max-w-md">
                <select
                  value={settings.arcade_ui_scale || 'normal'}
                  onChange={(e) => setSettings({ ...settings, arcade_ui_scale: e.target.value })}
                  className="w-full text-xs p-2 rounded-xl border border-slate-300 bg-white font-medium"
                >
                  <option value="normal">Standard (100%) — Écran de bureau standard</option>
                  <option value="large">Grand (115%) — Borne d'arcade debout</option>
                  <option value="xl">Très Grand (130%) — Grand écran salon / 4K</option>
                </select>
              </div>
            </div>

            <div className="pt-3 flex justify-end border-t border-slate-100">
              <button
                onClick={handleSaveSettings}
                disabled={loading}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold shadow-xs active:scale-95 transition-all disabled:opacity-50 cursor-pointer"
              >
                <Save className="w-4 h-4" />
                <span>Enregistrer les préférences visuelles</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* 2. ONGLET AFFICHAGE & ÉCRAN                              */}
      {/* ========================================================= */}
      {activeTab === 'display' && (
        <div className="space-y-6">
          <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs space-y-5">
            <div className="border-b border-slate-100 pb-3">
              <h2 className="text-sm font-bold text-slate-900">Affichage de la Borne & Fenêtre</h2>
              <p className="text-xs text-slate-500">Paramètres de rendu de la fenêtre, curseur et interactions</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <label className="flex items-center justify-between p-3.5 rounded-xl border border-slate-200 hover:bg-slate-50 cursor-pointer transition-colors">
                <div>
                  <div className="text-xs font-bold text-slate-800">Plein écran au démarrage</div>
                  <div className="text-[11px] text-slate-500">Lancer automatiquement KaïroOS en plein écran</div>
                </div>
                <input
                  type="checkbox"
                  checked={Boolean(settings.fullscreen)}
                  onChange={(e) => setSettings({ ...settings, fullscreen: e.target.checked })}
                  className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500"
                />
              </label>

              <label className="flex items-center justify-between p-3.5 rounded-xl border border-slate-200 hover:bg-slate-50 cursor-pointer transition-colors">
                <div>
                  <div className="text-xs font-bold text-slate-800">Toujours au premier plan (Always on Top)</div>
                  <div className="text-[11px] text-slate-500">Empêche les autres fenêtres de masquer la borne</div>
                </div>
                <input
                  type="checkbox"
                  checked={Boolean(settings.always_on_top)}
                  onChange={(e) => setSettings({ ...settings, always_on_top: e.target.checked })}
                  className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500"
                />
              </label>

              <label className="flex items-center justify-between p-3.5 rounded-xl border border-slate-200 hover:bg-slate-50 cursor-pointer transition-colors">
                <div>
                  <div className="text-xs font-bold text-slate-800">Masquer le curseur de souris</div>
                  <div className="text-[11px] text-slate-500">Recommandé pour bornes d'arcade 100% manette</div>
                </div>
                <input
                  type="checkbox"
                  checked={Boolean(settings.hide_mouse_cursor)}
                  onChange={(e) => setSettings({ ...settings, hide_mouse_cursor: e.target.checked })}
                  className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500"
                />
              </label>

              <div className="p-3.5 rounded-xl border border-slate-200">
                <label className="block text-xs font-bold text-slate-800 mb-1">
                  Action au clic / touche A sur un jeu
                </label>
                <select
                  value={settings.game_select_action || 'details'}
                  onChange={(e) => setSettings({ ...settings, game_select_action: e.target.value })}
                  className="w-full text-xs p-2 rounded-lg border border-slate-300 bg-white font-medium"
                >
                  <option value="details">Ouvrir la fiche du jeu (Jaquette, synopsis, options)</option>
                  <option value="launch">Lancer directement (Mode Arcade Immédiat)</option>
                </select>
              </div>

              <div className="p-3.5 rounded-xl border border-slate-200">
                <label className="block text-xs font-bold text-slate-800 mb-1">
                  Style des invites manette (Barre d'aide)
                </label>
                <select
                  value={settings.button_prompt_style || 'xbox'}
                  onChange={(e) => setSettings({ ...settings, button_prompt_style: e.target.value })}
                  className="w-full text-xs p-2 rounded-lg border border-slate-300 bg-white font-medium"
                >
                  <option value="xbox">Style Xbox (A, B, X, Y)</option>
                  <option value="playstation">Style PlayStation (✕, ○, □, △)</option>
                </select>
              </div>

              <div className="p-3.5 rounded-xl border border-slate-200">
                <label className="block text-xs font-bold text-slate-800 mb-1">Résolution de Lancement</label>
                <select
                  value={settings.launch_resolution || 'native'}
                  onChange={(e) => setSettings({ ...settings, launch_resolution: e.target.value })}
                  className="w-full text-xs p-2 rounded-lg border border-slate-300 bg-white font-medium"
                >
                  <option value="native">Native (Selon l'émulateur et le jeu)</option>
                  <option value="720p">720p HD (1280x720)</option>
                  <option value="1080p">1080p Full HD (1920x1080)</option>
                  <option value="4k">4K Ultra HD (3840x2160)</option>
                </select>
              </div>

              <div className="p-3.5 rounded-xl border border-slate-200">
                <label className="block text-xs font-bold text-slate-800 mb-1">Langue de l'Interface</label>
                <select
                  value={settings.ui_language || 'fr'}
                  onChange={(e) => setSettings({ ...settings, ui_language: e.target.value })}
                  className="w-full text-xs p-2 rounded-lg border border-slate-300 bg-white font-medium"
                >
                  <option value="fr">Français (FR)</option>
                  <option value="en">English (EN)</option>
                </select>
              </div>

              <div className="p-3.5 rounded-xl border border-slate-200">
                <label className="block text-xs font-bold text-slate-800 mb-1">Langue Métadonnées & Synopsis</label>
                <select
                  value={settings.metadata_language || 'fr'}
                  onChange={(e) => setSettings({ ...settings, metadata_language: e.target.value })}
                  className="w-full text-xs p-2 rounded-lg border border-slate-300 bg-white font-medium"
                >
                  <option value="fr">Français (Prioritaire)</option>
                  <option value="en">English (Fallback)</option>
                  <option value="both">Français et Anglais combinés</option>
                </select>
              </div>
            </div>

            <div className="pt-3 flex justify-end border-t border-slate-100">
              <button
                onClick={handleSaveSettings}
                disabled={loading}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold shadow-xs active:scale-95 transition-all disabled:opacity-50 cursor-pointer"
              >
                <Save className="w-4 h-4" />
                <span>Enregistrer les paramètres d'affichage</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* 3. ONGLET ÉMULATEURS & CLI                                 */}
      {/* ========================================================= */}
      {activeTab === 'emulators' && (
        <div className="space-y-6">
          <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs space-y-5">
            <div className="border-b border-slate-100 pb-3 flex items-center justify-between">
              <div>
                <h2 className="text-sm font-bold text-slate-900">Émulateurs Configurés (emulators.json)</h2>
                <p className="text-xs text-slate-500">Vérifiez les chemins d'exécutables et ajustez les arguments CLI</p>
              </div>
              <span className="text-xs font-mono text-slate-400">{emulators.length} émulateur(s)</span>
            </div>

            {/* Arguments CLI globaux supplémentaires */}
            <div className="p-4 rounded-xl border border-slate-200 bg-slate-50/50">
              <label className="block text-xs font-bold text-slate-800 mb-1">
                Arguments CLI globaux supplémentaires (extra_cli_args)
              </label>
              <input
                type="text"
                placeholder="Ex: --verbose --no-splash"
                value={settings.extra_cli_args || ''}
                onChange={(e) => setSettings({ ...settings, extra_cli_args: e.target.value })}
                className="w-full text-xs p-2 rounded-lg border border-slate-300 font-mono bg-white"
              />
              <p className="text-[10px] text-slate-500 mt-1">
                Ces arguments seront injectés lors du lancement de n'importe quel émulateur.
              </p>
            </div>

            <div className="space-y-4">
              {emulators.map((emu, idx) => {
                const testResult = pathTestResults[emu.id];

                return (
                  <div key={emu.id} className="p-4 rounded-xl border border-slate-200 bg-slate-50/30 space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="font-bold text-xs text-slate-900 flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full bg-blue-600" />
                        <span>{emu.name}</span>
                        <span className="font-mono text-[10px] text-slate-400 font-normal">({emu.id})</span>
                      </div>

                      {emu.is_builtin && (
                        <span className="text-[10px] px-2 py-0.5 rounded bg-slate-200 text-slate-700 font-mono">
                          Intégré
                        </span>
                      )}
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-end">
                      <div className="md:col-span-8">
                        <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                          Chemin de l'exécutable (exe_path)
                        </label>
                        <input
                          type="text"
                          value={emu.exe_path || ''}
                          onChange={(e) => {
                            const val = e.target.value;
                            setEmulators((prev) =>
                              prev.map((item, i) => (i === idx ? { ...item, exe_path: val } : item))
                            );
                          }}
                          placeholder="Ex: emulators/RetroArch/retroarch.exe"
                          className="w-full text-xs p-2 rounded-lg border border-slate-300 font-mono bg-white"
                        />
                      </div>

                      <div className="md:col-span-4 flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => handleTestPath(emu.id, emu.exe_path || '')}
                          disabled={testResult?.testing}
                          className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-slate-300 bg-white hover:bg-slate-100 text-xs font-semibold text-slate-700 active:bg-slate-200 transition-all shrink-0 cursor-pointer"
                        >
                          <Search className={`w-3.5 h-3.5 ${testResult?.testing ? 'animate-spin' : ''}`} />
                          <span>Tester le chemin</span>
                        </button>

                        {testResult && !testResult.testing && (
                          <div className="text-xs flex items-center gap-1 font-semibold truncate">
                            {testResult.exists ? (
                              <span className="text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-1 rounded">
                                ✓ Présent
                              </span>
                            ) : (
                              <span className="text-red-700 bg-red-50 border border-red-200 px-2 py-1 rounded">
                                ✗ Introuvable
                              </span>
                            )}
                          </div>
                        )}
                      </div>
                    </div>

                    <div>
                      <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                        Arguments CLI par défaut (default_args)
                      </label>
                      <input
                        type="text"
                        value={emu.default_args || ''}
                        onChange={(e) => {
                          const val = e.target.value;
                          setEmulators((prev) =>
                            prev.map((item, i) => (i === idx ? { ...item, default_args: val } : item))
                          );
                        }}
                        className="w-full text-xs p-2 rounded-lg border border-slate-300 font-mono bg-white text-slate-800"
                      />
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="pt-3 flex justify-end gap-3 border-t border-slate-100">
              <button
                onClick={handleSaveSettings}
                disabled={loading}
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-slate-300 bg-white hover:bg-slate-50 text-xs font-semibold text-slate-700 active:scale-95 transition-all disabled:opacity-50 cursor-pointer"
              >
                <span>Enregistrer extra_cli_args</span>
              </button>
              <button
                onClick={handleSaveEmulatorsTab}
                disabled={loading}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold shadow-xs active:scale-95 transition-all disabled:opacity-50 cursor-pointer"
              >
                <Save className="w-4 h-4" />
                <span>Enregistrer emulators.json</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* 4. ONGLET IMAGE & SON (RENDU)                             */}
      {/* ========================================================= */}
      {activeTab === 'media' && (
        <div className="space-y-6">
          <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs space-y-5">
            <div className="border-b border-slate-100 pb-3">
              <h2 className="text-sm font-bold text-slate-900">Rendu Émulation, Shaders & Audio</h2>
              <p className="text-xs text-slate-500">Personnalisez le rendu visuel rétro et les sauvegardes</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-800 mb-1">Shaders d'Émulation RetroArch</label>
                <select
                  value={settings.retroarch_shader || 'none'}
                  onChange={(e) => setSettings({ ...settings, retroarch_shader: e.target.value })}
                  className="w-full text-xs p-2.5 rounded-lg border border-slate-300 bg-white font-medium"
                >
                  <option value="none">Aucun (Pixel net d'origine)</option>
                  <option value="scanlines_light">Scanlines légères</option>
                  <option value="scanlines_strong">Scanlines fortes (CRT Arcade)</option>
                  <option value="crt_curved">CRT courbé (Cathodique rétro)</option>
                  <option value="pixel_perfect">Pixel Perfect (1:1)</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-800 mb-1">Ratio d'Écran par Défaut</label>
                <select
                  value={settings.aspect_ratio || '4:3'}
                  onChange={(e) => setSettings({ ...settings, aspect_ratio: e.target.value })}
                  className="w-full text-xs p-2.5 rounded-lg border border-slate-300 bg-white font-medium"
                >
                  <option value="4:3">4:3 (Format classique rétro)</option>
                  <option value="16:9">16:9 (Plein écran étiré)</option>
                  <option value="pixel_perfect">Pixel Perfect (1:1)</option>
                  <option value="stretch">Étirer pour remplir tout l'écran</option>
                </select>
              </div>

              {/* Sliders luminosité & contraste */}
              <div className="p-3.5 rounded-xl border border-slate-200 bg-slate-50/50">
                <div className="flex justify-between text-xs font-bold text-slate-800 mb-1">
                  <span>Luminosité de l'Émulateur</span>
                  <span className="font-mono text-blue-600">{settings.brightness ?? 50}%</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="100"
                  value={settings.brightness ?? 50}
                  onChange={(e) => setSettings({ ...settings, brightness: parseInt(e.target.value, 10) })}
                  className="w-full accent-blue-600 cursor-pointer"
                />
              </div>

              <div className="p-3.5 rounded-xl border border-slate-200 bg-slate-50/50">
                <div className="flex justify-between text-xs font-bold text-slate-800 mb-1">
                  <span>Contraste de l'Émulateur</span>
                  <span className="font-mono text-blue-600">{settings.contrast ?? 50}%</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="100"
                  value={settings.contrast ?? 50}
                  onChange={(e) => setSettings({ ...settings, contrast: parseInt(e.target.value, 10) })}
                  className="w-full accent-blue-600 cursor-pointer"
                />
              </div>

              <label className="flex items-center justify-between p-3.5 rounded-xl border border-slate-200 hover:bg-slate-50 cursor-pointer transition-colors">
                <div>
                  <div className="text-xs font-bold text-slate-800">Sauvegarde automatique (Autosave)</div>
                  <div className="text-[11px] text-slate-500">Sauvegarde l'état du jeu automatiquement en quittant</div>
                </div>
                <input
                  type="checkbox"
                  checked={Boolean(settings.autosave_enabled ?? true)}
                  onChange={(e) => setSettings({ ...settings, autosave_enabled: e.target.checked })}
                  className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500"
                />
              </label>

              <label className="flex items-center justify-between p-3.5 rounded-xl border border-slate-200 hover:bg-slate-50 cursor-pointer transition-colors">
                <div>
                  <div className="text-xs font-bold text-slate-800">Rewind (Rembobinage temps réel)</div>
                  <div className="text-[11px] text-slate-500">Revient de quelques secondes (RAM accrue)</div>
                </div>
                <input
                  type="checkbox"
                  checked={Boolean(settings.rewind_enabled)}
                  onChange={(e) => setSettings({ ...settings, rewind_enabled: e.target.checked })}
                  className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500"
                />
              </label>

              <label className="md:col-span-2 flex items-center justify-between p-3.5 rounded-xl border border-slate-200 hover:bg-slate-50 cursor-pointer transition-colors">
                <div>
                  <div className="text-xs font-bold text-slate-800">Son de démarrage KaïroOS</div>
                  <div className="text-[11px] text-slate-500">Joue le jingle du thème au boot de la borne</div>
                </div>
                <input
                  type="checkbox"
                  checked={Boolean(settings.startup_sound_enabled ?? true)}
                  onChange={(e) => setSettings({ ...settings, startup_sound_enabled: e.target.checked })}
                  className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500"
                />
              </label>
            </div>

            <div className="pt-3 flex justify-end border-t border-slate-100">
              <button
                onClick={handleSaveSettings}
                disabled={loading}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold shadow-xs active:scale-95 transition-all disabled:opacity-50 cursor-pointer"
              >
                <Save className="w-4 h-4" />
                <span>Enregistrer le rendu et audio</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* 5. ONGLET MANETTES                                        */}
      {/* ========================================================= */}
      {activeTab === 'gamepads' && (
        <div className="space-y-6">
          <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs space-y-5">
            <div className="border-b border-slate-100 pb-3 flex items-center justify-between">
              <div>
                <h2 className="text-sm font-bold text-slate-900">Profils Manettes & Mappings (gamepads.json)</h2>
                <p className="text-xs text-slate-500">Affichage des mappings actifs pour chaque joueur</p>
              </div>
              <span className="text-xs font-mono text-slate-400">{gamepads.length} profil(s)</span>
            </div>

            {gamepads.length === 0 ? (
              <div className="p-8 text-center border border-dashed border-slate-300 rounded-2xl text-slate-500 text-xs">
                Aucun profil de manette personnalisé n'est encore enregistré dans la base SQLite.
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {gamepads.map((gp, i) => (
                  <div key={i} className="p-4 rounded-xl border border-slate-200 bg-slate-50 space-y-2">
                    <div className="flex items-center justify-between border-b border-slate-200 pb-2">
                      <div className="font-bold text-xs text-slate-900">
                        Joueur {gp.player_index + 1} : {gp.device_name}
                      </div>
                      <span className="text-[10px] px-2 py-0.5 bg-blue-50 text-blue-700 font-mono rounded">
                        {gp.controller_type}
                      </span>
                    </div>

                    <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-[11px] font-mono text-slate-600">
                      <div>A : <span className="font-bold text-slate-900">{gp.btn_a || '—'}</span></div>
                      <div>B : <span className="font-bold text-slate-900">{gp.btn_b || '—'}</span></div>
                      <div>X : <span className="font-bold text-slate-900">{gp.btn_x || '—'}</span></div>
                      <div>Y : <span className="font-bold text-slate-900">{gp.btn_y || '—'}</span></div>
                      <div>L1 : <span className="font-bold text-slate-900">{gp.btn_l1 || '—'}</span></div>
                      <div>R1 : <span className="font-bold text-slate-900">{gp.btn_r1 || '—'}</span></div>
                      <div>Coin : <span className="font-bold text-slate-900">{gp.btn_select || '—'}</span></div>
                      <div>Start : <span className="font-bold text-slate-900">{gp.btn_start || '—'}</span></div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* 6. ONGLET BIBLIOTHÈQUE & DOSSIERS                         */}
      {/* ========================================================= */}
      {activeTab === 'library' && (
        <div className="space-y-6">
          <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs space-y-5">
            <div className="border-b border-slate-100 pb-3">
              <h2 className="text-sm font-bold text-slate-900">Dossiers & Organisation de la Bibliothèque</h2>
              <p className="text-xs text-slate-500">Emplacements des fichiers ROMs, sauvegardes, captures et tri</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-800 mb-1">Dossier Racine des ROMs</label>
                <input
                  type="text"
                  value={settings.roms_path || './roms'}
                  onChange={(e) => setSettings({ ...settings, roms_path: e.target.value })}
                  className="w-full text-xs p-2 rounded-lg border border-slate-300 font-mono bg-white"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-800 mb-1">Dossier des Sauvegardes (Saves)</label>
                <input
                  type="text"
                  placeholder="Par défaut (laissé vide)"
                  value={settings.saves_dir || ''}
                  onChange={(e) => setSettings({ ...settings, saves_dir: e.target.value })}
                  className="w-full text-xs p-2 rounded-lg border border-slate-300 font-mono bg-white"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-800 mb-1">Dossier des Captures d'Écran</label>
                <input
                  type="text"
                  placeholder="Par défaut (laissé vide)"
                  value={settings.screenshots_dir || ''}
                  onChange={(e) => setSettings({ ...settings, screenshots_dir: e.target.value })}
                  className="w-full text-xs p-2 rounded-lg border border-slate-300 font-mono bg-white"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-800 mb-1">Dossier des Cheats</label>
                <input
                  type="text"
                  placeholder="Par défaut (laissé vide)"
                  value={settings.cheats_dir || ''}
                  onChange={(e) => setSettings({ ...settings, cheats_dir: e.target.value })}
                  className="w-full text-xs p-2 rounded-lg border border-slate-300 font-mono bg-white"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-800 mb-1">Vue par Défaut du Catalogue</label>
                <select
                  value={settings.default_view || 'grid'}
                  onChange={(e) => setSettings({ ...settings, default_view: e.target.value })}
                  className="w-full text-xs p-2 rounded-lg border border-slate-300 bg-white font-medium"
                >
                  <option value="grid">Grille de Jaquettes (Arcade Shelf)</option>
                  <option value="list">Liste Détaillée</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-800 mb-1">Tri par Défaut</label>
                <select
                  value={settings.default_sort || 'title-asc'}
                  onChange={(e) => setSettings({ ...settings, default_sort: e.target.value })}
                  className="w-full text-xs p-2 rounded-lg border border-slate-300 bg-white font-medium"
                >
                  <option value="title-asc">Nom (A → Z)</option>
                  <option value="title-desc">Nom (Z → A)</option>
                  <option value="rating-desc">Note la plus haute</option>
                  <option value="release-date-desc">Date de sortie (Récents d'abord)</option>
                  <option value="play-time-desc">Temps de jeu</option>
                </select>
              </div>

              <label className="flex items-center justify-between p-3.5 rounded-xl border border-slate-200 hover:bg-slate-50 cursor-pointer transition-colors">
                <div>
                  <div className="text-xs font-bold text-slate-800">Scan automatique au démarrage</div>
                  <div className="text-[11px] text-slate-500">Met à jour la liste des jeux au lancement de KaïroOS</div>
                </div>
                <input
                  type="checkbox"
                  checked={Boolean(settings.auto_scan_on_startup)}
                  onChange={(e) => setSettings({ ...settings, auto_scan_on_startup: e.target.checked })}
                  className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500"
                />
              </label>

              <label className="flex items-center justify-between p-3.5 rounded-xl border border-slate-200 hover:bg-slate-50 cursor-pointer transition-colors">
                <div>
                  <div className="text-xs font-bold text-slate-800">Afficher les jeux sans jaquette</div>
                  <div className="text-[11px] text-slate-500">Affiche une jaquette par défaut si le média est absent</div>
                </div>
                <input
                  type="checkbox"
                  checked={Boolean(settings.show_games_without_cover ?? true)}
                  onChange={(e) => setSettings({ ...settings, show_games_without_cover: e.target.checked })}
                  className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500"
                />
              </label>

              <div className="md:col-span-2 p-3.5 rounded-xl border border-slate-200 bg-slate-50/50">
                <div className="flex justify-between text-xs font-bold text-slate-800 mb-1">
                  <span>Limite de jeux dans la catégorie "Récents"</span>
                  <span className="font-mono text-blue-600">{settings.recent_games_limit ?? 10} jeux</span>
                </div>
                <input
                  type="range"
                  min="5"
                  max="30"
                  value={settings.recent_games_limit ?? 10}
                  onChange={(e) => setSettings({ ...settings, recent_games_limit: parseInt(e.target.value, 10) })}
                  className="w-full accent-blue-600 cursor-pointer"
                />
              </div>
            </div>

            <div className="pt-3 flex justify-end border-t border-slate-100">
              <button
                onClick={handleSaveSettings}
                disabled={loading}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold shadow-xs active:scale-95 transition-all disabled:opacity-50 cursor-pointer"
              >
                <Save className="w-4 h-4" />
                <span>Enregistrer la bibliothèque</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* 7. ONGLET CONSOLES & MODES                                */}
      {/* ========================================================= */}
      {activeTab === 'consoles' && (
        <div className="space-y-6">
          <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs space-y-5">
            <div className="border-b border-slate-100 pb-3 flex items-center justify-between">
              <div>
                <h2 className="text-sm font-bold text-slate-900">Consoles & Systèmes Visibles</h2>
                <p className="text-xs text-slate-500">Activez ou masquez les consoles sur l'écran principal</p>
              </div>
              <span className="text-xs font-mono text-slate-400">{systems.length} système(s)</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {systems.map((sys) => {
                const isEnabled =
                  !settings.enabled_systems ||
                  settings.enabled_systems.length === 0 ||
                  settings.enabled_systems.includes(sys.id);

                return (
                  <label
                    key={sys.id}
                    className={`flex items-center justify-between p-3 rounded-xl border transition-colors cursor-pointer ${
                      isEnabled ? 'border-blue-200 bg-blue-50/20' : 'border-slate-200 bg-slate-50/50 opacity-60'
                    }`}
                  >
                    <div>
                      <div className="text-xs font-bold text-slate-900">{sys.name}</div>
                      <div className="text-[10px] font-mono text-slate-500">{sys.id} • {sys.manufacturer}</div>
                    </div>
                    <input
                      type="checkbox"
                      checked={isEnabled}
                      onChange={(e) => {
                        const current = settings.enabled_systems || systems.map((s) => s.id);
                        const next = e.target.checked
                          ? [...current, sys.id]
                          : current.filter((id) => id !== sys.id);
                        setSettings({ ...settings, enabled_systems: next });
                      }}
                      className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500"
                    />
                  </label>
                );
              })}
            </div>

            <div className="pt-3 flex justify-end border-t border-slate-100">
              <button
                onClick={handleSaveSettings}
                disabled={loading}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold shadow-xs active:scale-95 transition-all disabled:opacity-50 cursor-pointer"
              >
                <Save className="w-4 h-4" />
                <span>Enregistrer les consoles actives</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* 8. ONGLET SÉCURITÉ & KIOSK                                */}
      {/* ========================================================= */}
      {activeTab === 'kiosk' && (
        <div className="space-y-6">
          <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs space-y-5">
            <div className="border-b border-slate-100 pb-3">
              <h2 className="text-sm font-bold text-slate-900">Mode Kiosque (Salle Arcade & Exposition)</h2>
              <p className="text-xs text-slate-500">Verrouillez l'accès administrateur pour les joueurs</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <label className="flex items-center justify-between p-3.5 rounded-xl border border-slate-200 hover:bg-slate-50 cursor-pointer transition-colors">
                <div>
                  <div className="text-xs font-bold text-slate-800">Mode Kiosque actif au démarrage</div>
                  <div className="text-[11px] text-slate-500">Verrouille automatiquement la borne dès l'allumage</div>
                </div>
                <input
                  type="checkbox"
                  checked={Boolean(settings.kiosk_mode)}
                  onChange={(e) => setSettings({ ...settings, kiosk_mode: e.target.checked })}
                  className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500"
                />
              </label>

              <div className="p-3.5 rounded-xl border border-red-200 bg-red-50/40 flex items-center justify-between">
                <div>
                  <div className="text-xs font-bold text-red-900">Verrouiller maintenant</div>
                  <div className="text-[11px] text-red-700">Basculer la borne en mode joueur immédiatement</div>
                </div>
                <button
                  type="button"
                  onClick={handleLockKioskNow}
                  className="px-3 py-1.5 rounded-lg bg-red-600 hover:bg-red-700 text-white text-xs font-bold shadow-xs active:scale-95 transition-all cursor-pointer"
                >
                  Verrouiller
                </button>
              </div>
            </div>

            <div className="pt-3 flex justify-end border-t border-slate-100">
              <button
                onClick={handleSaveSettings}
                disabled={loading}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold shadow-xs active:scale-95 transition-all disabled:opacity-50 cursor-pointer"
              >
                <Save className="w-4 h-4" />
                <span>Enregistrer les préférences Kiosk</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* 9. ONGLET PLUGINS & EXTENSIONS                            */}
      {/* ========================================================= */}
      {activeTab === 'plugins' && (
        <div className="space-y-6">
          <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs space-y-5">
            <div className="border-b border-slate-100 pb-3 flex items-center justify-between">
              <div>
                <h2 className="text-sm font-bold text-slate-900">Extensions Détectées (Plugins)</h2>
                <p className="text-xs text-slate-500">Modules complémentaires connectés à l'écosystème KaïroOS</p>
              </div>
              <span className="text-xs font-mono text-slate-400">{plugins.length} extension(s)</span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {plugins.map((plugin) => {
                const isBuiltin = plugin.plugin_type === 'builtin';
                const isOfficial = plugin.plugin_type === 'official';
                const isScraper = plugin.id === 'kairo-scraper';

                return (
                  <div
                    key={plugin.id}
                    className="p-4 rounded-xl border border-slate-200 bg-slate-50/50 flex flex-col justify-between space-y-3"
                  >
                    <div>
                      <div className="flex items-center justify-between gap-2">
                        <div className="font-bold text-xs text-slate-900 flex items-center gap-1.5">
                          <span>{plugin.name}</span>
                          <span className="text-[10px] font-mono text-slate-400">v{plugin.version}</span>
                        </div>
                        {isBuiltin ? (
                          <span className="text-[9px] px-2 py-0.5 rounded bg-purple-100 text-purple-700 font-bold">
                            Système
                          </span>
                        ) : isOfficial ? (
                          <span className="text-[9px] px-2 py-0.5 rounded bg-emerald-100 text-emerald-800 font-bold">
                            Officiel
                          </span>
                        ) : (
                          <span className="text-[9px] px-2 py-0.5 rounded bg-amber-100 text-amber-800 font-bold">
                            Communauté
                          </span>
                        )}
                      </div>

                      <p className="text-[11px] text-slate-600 mt-1">{plugin.description}</p>
                      <div className="text-[10px] text-slate-400 mt-0.5">Par {plugin.author}</div>
                    </div>

                    <div className="flex items-center justify-between pt-2 border-t border-slate-200/60">
                      <span className="text-[10px] font-bold text-emerald-700 flex items-center gap-1">
                        <span className="w-2 h-2 rounded-full bg-emerald-500" />
                        <span>Actif</span>
                      </span>

                      {/* Bouton d'accès direct à l'espace dédié du plugin si applicable */}
                      {isScraper && onNavigateToTab && (
                        <button
                          type="button"
                          onClick={() => onNavigateToTab('contrib:kairo-scraper')}
                          className="inline-flex items-center gap-1 px-3 py-1 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-[11px] font-bold transition-all shadow-xs cursor-pointer"
                        >
                          <Globe className="w-3 h-3" />
                          <span>Ouvrir l'espace Auto Scraper</span>
                          <ExternalLink className="w-2.5 h-2.5" />
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* 10. ONGLET SERVEUR DISTANT (REMOTE.JSON)                   */}
      {/* ========================================================= */}
      {activeTab === 'remote' && (
        <div className="space-y-6">
          <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs space-y-5">
            <div className="border-b border-slate-100 pb-3">
              <h2 className="text-sm font-bold text-slate-900">Serveur Distant KaïroOS (remote.json)</h2>
              <p className="text-xs text-slate-500">
                Configuration du port d'écoute HTTP, du code PIN de sécurité et des autorisations CORS
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <label className="md:col-span-2 flex items-center justify-between p-3.5 rounded-xl border border-slate-200 hover:bg-slate-50 cursor-pointer transition-colors">
                <div>
                  <div className="text-xs font-bold text-slate-800">Serveur Distant Activé</div>
                  <div className="text-[11px] text-slate-500">Permet le contrôle à distance via smartphone / navigateur</div>
                </div>
                <input
                  type="checkbox"
                  checked={Boolean(remoteCfg.enabled)}
                  onChange={(e) => setRemoteCfg({ ...remoteCfg, enabled: e.target.checked })}
                  className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500"
                />
              </label>

              <div>
                <label className="block text-xs font-bold text-slate-800 mb-1">Port du Serveur HTTP</label>
                <input
                  type="number"
                  value={remoteCfg.port}
                  onChange={(e) => setRemoteCfg({ ...remoteCfg, port: parseInt(e.target.value, 10) || 8080 })}
                  className="w-full text-xs p-2 rounded-lg border border-slate-300 font-mono bg-white"
                />
                <p className="text-[10px] text-amber-600 mt-1">
                  ⚠️ Modifier le port nécessite un redémarrage de KaïroOS pour se lier au nouveau socket.
                </p>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-800 mb-1">Code PIN de Sécurité</label>
                <div className="relative">
                  <input
                    type={showPin ? 'text' : 'password'}
                    value={remoteCfg.pin}
                    onChange={(e) => setRemoteCfg({ ...remoteCfg, pin: e.target.value })}
                    className="w-full text-xs p-2 rounded-lg border border-slate-300 font-mono pr-9 bg-white"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPin(!showPin)}
                    className="absolute right-2.5 top-2.5 text-slate-400 hover:text-slate-600 cursor-pointer"
                    title={showPin ? 'Masquer' : 'Afficher'}
                  >
                    {showPin ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
                <p className="text-[10px] text-slate-500 mt-1">
                  Exigé pour les requêtes web distantes (sauf si manette physique locale connectée).
                </p>
              </div>

              <div className="md:col-span-2">
                <label className="block text-xs font-bold text-slate-800 mb-1">
                  Origines CORS Autorisées (allowed_origins)
                </label>
                <input
                  type="text"
                  value={remoteCfg.allowed_origins.join(', ')}
                  onChange={(e) =>
                    setRemoteCfg({
                      ...remoteCfg,
                      allowed_origins: e.target.value.split(',').map((s) => s.trim()).filter(Boolean),
                    })
                  }
                  className="w-full text-xs p-2 rounded-lg border border-slate-300 font-mono bg-white"
                />
                <p className="text-[10px] text-slate-400 mt-1">
                  Séparez les domaines autorisés par des virgules (ex: * ou http://localhost:5173).
                </p>
              </div>
            </div>

            <div className="pt-3 flex justify-end border-t border-slate-100">
              <button
                onClick={handleSaveRemoteTab}
                disabled={loading}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold shadow-xs active:scale-95 transition-all disabled:opacity-50 cursor-pointer"
              >
                <Save className="w-4 h-4" />
                <span>Enregistrer remote.json</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
