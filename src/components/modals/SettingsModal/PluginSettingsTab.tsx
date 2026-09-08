import React, { useState, useEffect, Component, ErrorInfo } from 'react';
import {
  Puzzle,
  RefreshCw,
  Sliders,
  Check,
  Eye,
  EyeOff,
  Play,
  Terminal,
  FolderOpen,
  AlertCircle,
} from 'lucide-react';
import { AppSettings, RemoteConfig, PluginDetail } from '../../../types';
import {
  getPlugin,
  updatePluginSettings,
  runPluginCommand,
  openPluginsFolder,
} from '../../../api';
import { ScrapingSection } from './ScrapingSection';
import { NetworkSection } from './NetworkSection';
import { SpotifySettingsSection } from './SpotifySettingsSection';

export interface PluginSettingsTabProps {
  pluginId: string;
  onNotification?: (msg: string, type?: 'info' | 'success' | 'warning' | 'error') => void;
  settings?: AppSettings;
  updateSetting?: (key: keyof AppSettings, val: any) => void;
  remoteConfig?: RemoteConfig;
  onSaveRemoteConfig?: (cfg: RemoteConfig) => Promise<void>;
}

interface ErrorBoundaryProps {
  children: React.ReactNode;
  pluginId: string;
  onRetry?: () => void;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

class PluginErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error(`[PluginSettingsTab ErrorBoundary - ${this.props.pluginId}]:`, error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div
          style={{ backgroundColor: 'var(--bg-secondary)', borderColor: 'var(--border-color)' }}
          className="p-8 rounded-3xl border text-center space-y-4 animate-fadeIn"
        >
          <div className="w-12 h-12 mx-auto rounded-2xl bg-rose-500/10 text-rose-500 flex items-center justify-center">
            <AlertCircle className="w-6 h-6" />
          </div>
          <div>
            <div style={{ color: 'var(--text-primary)' }} className="text-sm font-bold">
              Erreur d'affichage du plugin ({this.props.pluginId})
            </div>
            <div style={{ color: 'var(--text-muted)' }} className="text-xs mt-1 font-mono max-w-lg mx-auto break-words">
              {this.state.error?.message || 'Une erreur inattendue est survenue.'}
            </div>
          </div>
          <button
            type="button"
            onClick={() => {
              this.setState({ hasError: false, error: null });
              if (this.props.onRetry) this.props.onRetry();
            }}
            style={{ backgroundColor: 'var(--accent-primary)' }}
            className="px-4 py-2 rounded-xl text-white text-xs font-bold shadow-sm hover:opacity-90 active:scale-95 transition-all cursor-pointer"
          >
            Réessayer
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

const PluginSettingsContent: React.FC<PluginSettingsTabProps> = ({
  pluginId,
  onNotification,
  settings = {} as AppSettings,
  updateSetting = () => {},
  remoteConfig,
  onSaveRemoteConfig,
}) => {
  const [pluginDetail, setPluginDetail] = useState<PluginDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [savedSuccess, setSavedSuccess] = useState(false);
  const [settingsForm, setSettingsForm] = useState<Record<string, any>>({});
  const [showSecrets, setShowSecrets] = useState<Record<string, boolean>>({});
  const [commandFeedback, setCommandFeedback] = useState<{ cmd: string; msg: string } | null>(null);
  const [runningCmd, setRunningCmd] = useState<string | null>(null);

  const fetchDetail = async () => {
    try {
      setLoading(true);
      setLoadError(null);
      const detail = await getPlugin(pluginId);
      setPluginDetail(detail);
      setSettingsForm(detail.settings || {});
    } catch (err: any) {
      console.error(`[PluginSettingsTab] Erreur chargement plugin ${pluginId}:`, err);
      setLoadError(err?.message || String(err));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDetail();
  }, [pluginId]);

  const handleSave = async () => {
    if (!pluginDetail) return;
    setSaving(true);
    try {
      await updatePluginSettings(pluginId, settingsForm);
      setSavedSuccess(true);
      setTimeout(() => setSavedSuccess(false), 2000);
      if (onNotification) onNotification('Paramètres du plugin enregistrés', 'success');
      await fetchDetail();
    } catch (err: any) {
      if (onNotification) onNotification(err?.message || 'Erreur lors de la sauvegarde', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleRunCommand = async (cmd: string) => {
    setRunningCmd(cmd);
    try {
      const res = await runPluginCommand(pluginId, cmd);
      setCommandFeedback({ cmd, msg: res || `Commande '${cmd}' exécutée` });
      setTimeout(() => setCommandFeedback(null), 3500);
      await fetchDetail();
    } catch (err: any) {
      setCommandFeedback({ cmd, msg: `Erreur: ${err}` });
      setTimeout(() => setCommandFeedback(null), 4000);
    } finally {
      setRunningCmd(null);
    }
  };

  if (loading && !pluginDetail) {
    return (
      <div className="p-12 text-center text-xs text-slate-400">
        <RefreshCw className="w-6 h-6 mx-auto animate-spin mb-2 text-rose-500" />
        <span>Chargement des paramètres du plugin...</span>
      </div>
    );
  }

  if (loadError) {
    return (
      <div
        style={{ backgroundColor: 'var(--bg-secondary)', borderColor: 'var(--border-color)' }}
        className="p-8 rounded-3xl border text-center space-y-4 animate-fadeIn"
      >
        <div className="w-12 h-12 mx-auto rounded-2xl bg-rose-500/10 text-rose-500 flex items-center justify-center">
          <AlertCircle className="w-6 h-6" />
        </div>
        <div>
          <div style={{ color: 'var(--text-primary)' }} className="text-sm font-bold">
            Impossible de charger le plugin ({pluginId})
          </div>
          <div style={{ color: 'var(--text-muted)' }} className="text-xs mt-1 font-mono max-w-lg mx-auto break-words">
            {loadError}
          </div>
        </div>
        <button
          type="button"
          onClick={fetchDetail}
          style={{ backgroundColor: 'var(--accent-primary)' }}
          className="px-4 py-2 rounded-xl text-white text-xs font-bold shadow-sm hover:opacity-90 active:scale-95 transition-all cursor-pointer"
        >
          Réessayer
        </button>
      </div>
    );
  }

  if (!pluginDetail) {
    return (
      <div
        style={{ backgroundColor: 'var(--bg-secondary)', borderColor: 'var(--border-color)' }}
        className="p-8 rounded-3xl border text-center space-y-2 animate-fadeIn"
      >
        <Puzzle className="w-8 h-8 mx-auto text-slate-400 opacity-60" />
        <div style={{ color: 'var(--text-primary)' }} className="text-sm font-bold">
          Plugin introuvable ou inactif
        </div>
        <p style={{ color: 'var(--text-muted)' }} className="text-xs">
          Vérifiez que le plugin est activé dans la section Plugins & Extensions.
        </p>
      </div>
    );
  }

  const { manifest } = pluginDetail;
  const isBuiltin = manifest.type === 'builtin';
  const isOfficial = manifest.type === 'official';
  const schemaEntries = Object.entries(manifest.settings_schema || {}).sort(([a], [b]) => a.localeCompare(b));

  const isScraper =
    manifest.permissions?.includes('write_games') ||
    Boolean(manifest.settings_schema?.screenscraper_user);

  const isRemote =
    manifest.builtin_service === 'remote_server' ||
    (Boolean(manifest.settings_schema?.port) && Boolean(manifest.settings_schema?.pin));

  const isSpotify =
    manifest.id === 'kairo-spotify-screensaver' ||
    Boolean(manifest.settings_schema?.spotify_access_token) ||
    Boolean(manifest.settings_schema?.spotify_device_name);

  return (
    <div className="space-y-6 animate-fadeIn">
      {/* 1. Carte En-tête Plugin */}
      <div
        style={{
          backgroundColor: 'var(--bg-card)',
          borderColor: 'var(--border-color)',
        }}
        className="p-5 rounded-3xl border shadow-xs space-y-3"
      >
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <h3 style={{ color: 'var(--text-primary)' }} className="text-sm font-black">
                {manifest.name}
              </h3>
              {isBuiltin ? (
                <span className="px-2 py-0.5 rounded-md text-[9px] font-black bg-purple-600 text-white shadow-2xs">
                  SYSTÈME
                </span>
              ) : isOfficial ? (
                <span className="px-2 py-0.5 rounded-md text-[9px] font-black bg-emerald-600 text-white shadow-2xs">
                  OFFICIEL
                </span>
              ) : (
                <span className="px-2 py-0.5 rounded-md text-[9px] font-black bg-amber-500 text-white shadow-2xs">
                  COMMUNAUTÉ
                </span>
              )}
              <span style={{ color: 'var(--text-muted)' }} className="text-[10px] font-mono font-bold">
                v{manifest.version}
              </span>
            </div>
            <p style={{ color: 'var(--text-muted)' }} className="text-xs mt-1">
              {manifest.description}
            </p>
            <div style={{ color: 'var(--text-muted)' }} className="text-[10px] mt-0.5 opacity-75">
              Développé par <span className="font-semibold">{manifest.author}</span>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <div className="flex items-center gap-1.5 px-3 py-1 rounded-xl bg-black/5 border border-black/10">
              <span
                className={`w-2 h-2 rounded-full ${
                  pluginDetail.running ? 'bg-emerald-500 animate-pulse' : 'bg-slate-400'
                }`}
              />
              <span style={{ color: 'var(--text-primary)' }} className="text-xs font-bold">
                {pluginDetail.running ? "En cours d'exécution" : 'Arrêté'}
              </span>
            </div>

            <button
              type="button"
              onClick={() => openPluginsFolder()}
              style={{
                backgroundColor: 'var(--bg-secondary)',
                borderColor: 'var(--border-color)',
                color: 'var(--text-secondary)',
              }}
              className="p-2 rounded-xl border hover:opacity-80 transition-all cursor-pointer"
              title="Ouvrir le dossier du plugin"
            >
              <FolderOpen className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Commandes rapides si déclarées */}
        {manifest.commands && manifest.commands.length > 0 && (
          <div className="pt-2 border-t border-black/5 flex items-center gap-2 flex-wrap">
            <span style={{ color: 'var(--text-muted)' }} className="text-[11px] font-bold flex items-center gap-1">
              <Terminal className="w-3.5 h-3.5" />
              <span>Actions :</span>
            </span>
            {manifest.commands.map((cmd) => (
              <button
                key={cmd}
                type="button"
                onClick={() => handleRunCommand(cmd)}
                disabled={runningCmd === cmd}
                style={{
                  backgroundColor: 'var(--bg-secondary)',
                  borderColor: 'var(--border-color)',
                  color: 'var(--text-primary)',
                }}
                className="flex items-center gap-1 px-3 py-1 rounded-xl border text-[11px] font-bold uppercase hover:text-[var(--accent-primary)] transition-all cursor-pointer disabled:opacity-50"
              >
                <Play className={`w-3 h-3 ${runningCmd === cmd ? 'animate-spin' : ''}`} />
                <span>{cmd}</span>
              </button>
            ))}

            {commandFeedback && (
              <span className="text-[11px] font-mono text-emerald-600 animate-fadeIn ml-2">
                {commandFeedback.msg}
              </span>
            )}
          </div>
        )}
      </div>

      {/* 2. Contenu des Paramètres selon les Capacités du Plugin */}
      {isScraper ? (
        <ScrapingSection settings={settings} updateSetting={updateSetting} />
      ) : isRemote ? (
        <NetworkSection
          settings={settings}
          updateSetting={updateSetting}
          remoteConfig={remoteConfig}
          onSaveRemoteConfig={onSaveRemoteConfig}
        />
      ) : isSpotify ? (
        <SpotifySettingsSection
          settings={settingsForm}
          onSave={async (newSettings) => {
            setSaving(true);
            try {
              await updatePluginSettings(pluginId, newSettings);
              setSettingsForm(newSettings);
              setSavedSuccess(true);
              setTimeout(() => setSavedSuccess(false), 2000);
              if (onNotification) onNotification('Paramètres Spotify enregistrés avec succès', 'success');
            } catch (err: any) {
              if (onNotification) onNotification(`Erreur sauvegarde: ${err}`, 'error');
            } finally {
              setSaving(false);
            }
          }}
          saving={saving}
        />
      ) : (
        /* Formulaire générique pour tout autre plugin */
        <div
          style={{
            backgroundColor: 'var(--bg-card)',
            borderColor: 'var(--border-color)',
          }}
          className="p-5 rounded-3xl border shadow-xs space-y-4"
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Sliders className="w-4 h-4 text-purple-600" />
              <h4 style={{ color: 'var(--text-primary)' }} className="text-xs font-black uppercase tracking-wider">
                Configuration du Plugin
              </h4>
            </div>

            <div className="flex items-center gap-2">
              {savedSuccess && (
                <span className="text-xs font-bold text-emerald-600 flex items-center gap-1 animate-fadeIn">
                  <Check className="w-3.5 h-3.5" />
                  <span>Enregistré !</span>
                </span>
              )}
              <button
                type="button"
                onClick={handleSave}
                disabled={saving}
                style={{
                  backgroundColor: 'var(--accent-primary)',
                }}
                className="px-4 py-1.5 rounded-xl text-white text-xs font-bold shadow-xs hover:opacity-90 active:scale-95 transition-all cursor-pointer disabled:opacity-50"
              >
                {saving ? 'Enregistrement...' : 'Enregistrer'}
              </button>
            </div>
          </div>

          {schemaEntries.length === 0 ? (
            <div style={{ color: 'var(--text-muted)' }} className="text-xs italic text-center py-6">
              Ce plugin fonctionne de manière autonome et ne requiert aucun paramètre personnalisable.
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {schemaEntries.map(([key, schema]) => {
                const currentVal = settingsForm[key] !== undefined ? settingsForm[key] : schema.default;
                const isSecret = Boolean(schema.secret);
                const isRevealed = showSecrets[key];

                if (schema.type === 'boolean') {
                  return (
                    <div
                      key={key}
                      style={{
                        backgroundColor: 'var(--bg-secondary)',
                        borderColor: 'var(--border-color)',
                      }}
                      className="sm:col-span-2 p-3.5 rounded-2xl border flex items-center justify-between gap-3"
                    >
                      <div>
                        <div style={{ color: 'var(--text-primary)' }} className="text-xs font-bold">
                          {schema.label || key}
                        </div>
                        <div style={{ color: 'var(--text-muted)' }} className="text-[10px] font-mono">
                          {key}
                        </div>
                      </div>

                      <label className="flex items-center gap-2 cursor-pointer">
                        <span style={{ color: 'var(--text-muted)' }} className="text-xs font-bold">
                          {currentVal ? 'Activé' : 'Désactivé'}
                        </span>
                        <input
                          type="checkbox"
                          checked={Boolean(currentVal)}
                          onChange={(e) => setSettingsForm({ ...settingsForm, [key]: e.target.checked })}
                          className="w-4 h-4 rounded text-rose-500 focus:ring-rose-400"
                        />
                      </label>
                    </div>
                  );
                }

                return (
                  <div
                    key={key}
                    style={{
                      backgroundColor: 'var(--bg-secondary)',
                      borderColor: 'var(--border-color)',
                    }}
                    className="p-3.5 rounded-2xl border space-y-1.5"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <label style={{ color: 'var(--text-primary)' }} className="text-xs font-bold">
                        {schema.label || key}
                      </label>
                      <span style={{ color: 'var(--text-muted)' }} className="text-[10px] font-mono">
                        {key}
                      </span>
                    </div>

                    {schema.type === 'number' ? (
                      <input
                        type="number"
                        value={typeof currentVal === 'number' ? currentVal : (Number(currentVal) || 0)}
                        onChange={(e) => setSettingsForm({ ...settingsForm, [key]: Number(e.target.value) })}
                        style={{
                          backgroundColor: 'var(--bg-card)',
                          color: 'var(--text-primary)',
                          borderColor: 'var(--border-color)',
                        }}
                        className="w-full text-xs p-2 rounded-xl border focus:outline-none focus:ring-1 focus:ring-[var(--accent-primary)] font-mono"
                      />
                    ) : (
                      <div className="relative">
                        <input
                          type={isSecret && !isRevealed ? 'password' : 'text'}
                          value={currentVal !== undefined && currentVal !== null ? String(currentVal) : ''}
                          onChange={(e) => setSettingsForm({ ...settingsForm, [key]: e.target.value })}
                          style={{
                            backgroundColor: 'var(--bg-card)',
                            color: 'var(--text-primary)',
                            borderColor: 'var(--border-color)',
                          }}
                          className="w-full text-xs p-2 rounded-xl border focus:outline-none focus:ring-1 focus:ring-[var(--accent-primary)] pr-8 font-mono"
                        />
                        {isSecret && (
                          <button
                            type="button"
                            onClick={() => setShowSecrets({ ...showSecrets, [key]: !isRevealed })}
                            className="absolute right-2 top-2 text-slate-400 hover:text-slate-200 cursor-pointer"
                          >
                            {isRevealed ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export const PluginSettingsTab: React.FC<PluginSettingsTabProps> = (props) => {
  return (
    <PluginErrorBoundary pluginId={props.pluginId}>
      <PluginSettingsContent {...props} />
    </PluginErrorBoundary>
  );
};
