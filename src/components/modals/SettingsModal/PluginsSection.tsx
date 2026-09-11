import React, { useState, useEffect } from 'react';
import {
  Puzzle,
  FolderOpen,
  Check,
  RefreshCw,
  Trash2,
  Sliders,
  Globe,
  Upload,
  ExternalLink,
  Shield,
  ShieldAlert,
  ShieldCheck,
  Wifi,
  Library,
  Gamepad2,
  FileCode,
  Bell,
  Eye,
  EyeOff,
  AlertTriangle,
  Sparkles,
  Star,
  Search,
} from 'lucide-react';
import { PluginInfo, PluginDetail, PluginManifest } from '../../../types';
import {
  getPlugins,
  getPlugin,
  enablePlugin,
  disablePlugin,
  installPlugin,
  installPluginFromUrl,
  confirmInstallPlugin,
  uninstallPlugin,
  updatePluginSettings,
  runPluginCommand,
  openPluginsFolder,
} from '../../../api';

interface PluginsSectionProps {
  onNotification?: (msg: string, type?: 'info' | 'success' | 'warning' | 'error') => void;
  onPluginsChange?: (plugins: PluginInfo[]) => void;
}

const PERMISSION_DESCRIPTIONS: Record<string, { label: string; desc: string; icon: React.ReactNode }> = {
  network: {
    label: 'Accès Réseau & Ports',
    desc: "Autorise le plugin à ouvrir un port local (serveur HTTP/WS) ou à effectuer des requêtes vers Internet.",
    icon: <Wifi className="w-4 h-4 text-sky-500" />,
  },
  read_games: {
    label: 'Lecture de la Bibliothèque',
    desc: "Permet de consulter la liste des jeux installés, leurs temps de jeu, favoris et métadonnées.",
    icon: <Library className="w-4 h-4 text-emerald-500" />,
  },
  launch_games: {
    label: 'Lancement & Contrôle des Jeux',
    desc: "Autorise le plugin à lancer et fermer des jeux et émulateurs automatiquement.",
    icon: <Gamepad2 className="w-4 h-4 text-rose-500" />,
  },
  read_settings: {
    label: 'Lecture des Paramètres',
    desc: "Permet de lire la configuration de base de KaïroOS (thème, émulateurs, chemins).",
    icon: <Sliders className="w-4 h-4 text-amber-500" />,
  },
  write_settings: {
    label: 'Modification des Paramètres',
    desc: "Permet de modifier les fichiers de configuration système de KaïroOS.",
    icon: <AlertTriangle className="w-4 h-4 text-orange-500" />,
  },
  filesystem: {
    label: 'Accès aux Fichiers Locaux',
    desc: "Permet de lire et écrire des fichiers uniquement à l'intérieur du dossier propre du plugin.",
    icon: <FileCode className="w-4 h-4 text-indigo-500" />,
  },
  notifications: {
    label: 'Envoi de Notifications',
    desc: "Autorise l'affichage de messages et alertes toasts directement dans l'interface de KaïroOS.",
    icon: <Bell className="w-4 h-4 text-purple-500" />,
  },
};

export const PluginsSection: React.FC<PluginsSectionProps> = ({ onNotification, onPluginsChange }) => {
  const [activeTab, setActiveTab] = useState<'installed' | 'official' | 'community' | 'unverified'>('installed');
  const [plugins, setPlugins] = useState<PluginInfo[]>([]);
  const [loading, setLoading] = useState(false);
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);

  // Modal de configuration d'un plugin
  const [configuringPlugin, setConfiguringPlugin] = useState<PluginDetail | null>(null);
  const [settingsForm, setSettingsForm] = useState<Record<string, any>>({});
  const [savingSettings, setSavingSettings] = useState(false);
  const [showSecrets, setShowSecrets] = useState<Record<string, boolean>>({});

  // Modale sandbox d'approbation des permissions
  const [pendingInstallManifest, setPendingInstallManifest] = useState<PluginManifest | null>(null);
  const [installing, setInstalling] = useState(false);

  // Store Store Officiel, Communauté & Non Vérifiés
  const [storePlugins, setStorePlugins] = useState<any[]>([]);
  const [unverifiedPlugins, setUnverifiedPlugins] = useState<any[]>([]);
  const [loadingStore, setLoadingStore] = useState(false);
  const [storeError, setStoreError] = useState<string | null>(null);

  // Saisie URL GitHub & recherche pour plugins non vérifiés
  const [githubUrl, setGithubUrl] = useState<string>('');
  const [unverifiedSearchQuery, setUnverifiedSearchQuery] = useState<string>('');
  const [analyzingUrl, setAnalyzingUrl] = useState<boolean>(false);
  const [urlError, setUrlError] = useState<string | null>(null);
  const [analyzedManifest, setAnalyzedManifest] = useState<PluginManifest | null>(null);

  // Toast de commande
  const [commandFeedback, setCommandFeedback] = useState<{ id: string; msg: string } | null>(null);

  const fetchInstalledPlugins = async () => {
    try {
      setLoading(true);
      const list = await getPlugins();
      setPlugins(list);
      if (onPluginsChange) {
        onPluginsChange(list);
      }
    } catch (err: any) {
      console.error('[PluginsSection] Erreur chargement plugins:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchInstalledPlugins();
  }, []);

  const fetchStorePlugins = async (type: 'official' | 'community') => {
    try {
      setLoadingStore(true);
      setStoreError(null);
      const res = await fetch(`https://api.github.com/repos/KairoOS-Official/kairos-plugins/contents/${type}`);
      if (!res.ok) {
        if (res.status === 404) {
          setStorePlugins([]);
          return;
        }
        throw new Error('Dépôt inaccessible ou aucun plugin disponible.');
      }
      const contents = await res.json();
      if (!Array.isArray(contents)) {
        setStorePlugins([]);
        return;
      }
      const dirs = contents.filter((item: any) => item.type === 'dir');

      const loaded = await Promise.all(
        dirs.map(async (folder: any) => {
          try {
            const rawJson = await fetch(
              `https://raw.githubusercontent.com/KairoOS-Official/kairos-plugins/main/${type}/${folder.name}/plugin.json`
            );
            if (rawJson.ok) {
              const manifest = await rawJson.json();
              return {
                ...manifest,
                plugin_type: manifest.plugin_type || manifest.type || type,
                folder_name: folder.name,
                git_url: folder.html_url || `https://github.com/KairoOS-Official/kairos-plugins.git`,
                preview_url: `https://raw.githubusercontent.com/KairoOS-Official/kairos-plugins/main/${type}/${folder.name}/preview.png`,
              };
            }
          } catch {
            // ignore
          }
          return null;
        })
      );

      setStorePlugins(loaded.filter(Boolean));
    } catch (err: any) {
      setStoreError(err?.message || 'Impossible de joindre le catalogue de plugins.');
      setStorePlugins([]);
    } finally {
      setLoadingStore(false);
    }
  };

  const fetchUnverifiedFromTopics = async () => {
    try {
      setLoadingStore(true);
      setStoreError(null);
      const res = await fetch(
        'https://api.github.com/search/repositories?q=topic:kairo-plugins&sort=stars&per_page=20'
      );
      if (res.status === 403 || res.status === 429) {
        throw new Error('Trop de requêtes, réessayez dans 1 minute');
      }
      if (!res.ok) {
        throw new Error(`Erreur GitHub API (${res.status})`);
      }
      const data = await res.json();
      const items = Array.isArray(data.items) ? data.items : [];

      const loaded = await Promise.all(
        items.map(async (repo: any) => {
          let manifest: any = null;
          for (const branch of ['main', 'master']) {
            try {
              const rawJson = await fetch(
                `https://raw.githubusercontent.com/${repo.full_name}/${branch}/plugin.json`
              );
              if (rawJson.ok) {
                manifest = await rawJson.json();
                break;
              }
            } catch {
              // ignore
            }
          }

          if (manifest) {
            return {
              ...manifest,
              id: manifest.id || repo.name,
              name: manifest.name || repo.name,
              author: manifest.author || repo.owner?.login || 'Auteur tiers',
              description: manifest.description || repo.description || 'Plugin communautaire KaïroOS',
              plugin_type: 'unverified',
              github_url: repo.html_url,
              stars: repo.stargazers_count ?? 0,
              owner: repo.owner?.login,
              preview_url: `https://raw.githubusercontent.com/${repo.full_name}/main/preview.png`,
            };
          }
          return null;
        })
      );

      // Compléter également avec les plugins du dossier /unverified du store officiel s'il y en a
      let catalogPlugins: any[] = [];
      try {
        const catRes = await fetch('https://api.github.com/repos/KairoOS-Official/kairos-plugins/contents/unverified');
        if (catRes.ok) {
          const catContents = await catRes.json();
          if (Array.isArray(catContents)) {
            const dirs = catContents.filter((item: any) => item.type === 'dir');
            catalogPlugins = (
              await Promise.all(
                dirs.map(async (folder: any) => {
                  try {
                    const raw = await fetch(
                      `https://raw.githubusercontent.com/KairoOS-Official/kairos-plugins/main/unverified/${folder.name}/plugin.json`
                    );
                    if (raw.ok) {
                      const m = await raw.json();
                      return {
                        ...m,
                        plugin_type: 'unverified',
                        folder_name: folder.name,
                        github_url: folder.html_url || `https://github.com/KairoOS-Official/kairos-plugins/tree/main/unverified/${folder.name}`,
                        stars: 0,
                        owner: 'KairoOS-Official',
                        preview_url: `https://raw.githubusercontent.com/KairoOS-Official/kairos-plugins/main/unverified/${folder.name}/preview.png`,
                      };
                    }
                  } catch {}
                  return null;
                })
              )
            ).filter(Boolean);
          }
        }
      } catch {}

      const allUnverified = [...loaded.filter(Boolean), ...catalogPlugins];
      const seen = new Set<string>();
      const unique = allUnverified.filter((p) => {
        if (!p || seen.has(p.id)) return false;
        seen.add(p.id);
        return true;
      });

      setUnverifiedPlugins(unique);
    } catch (err: any) {
      if (err?.message?.includes('rate limit') || err?.message?.includes('Trop de requêtes')) {
        setStoreError('Trop de requêtes, réessayez dans 1 minute');
      } else {
        setStoreError(err?.message || 'Impossible de charger les dépôts GitHub par topic.');
      }
      setUnverifiedPlugins([]);
    } finally {
      setLoadingStore(false);
    }
  };

  const fetchUnverifiedPlugins = fetchUnverifiedFromTopics;

  const filteredUnverifiedPlugins = unverifiedPlugins.filter((item) => {
    if (!unverifiedSearchQuery.trim()) return true;
    const q = unverifiedSearchQuery.toLowerCase();
    return (
      item.name?.toLowerCase().includes(q) ||
      item.id?.toLowerCase().includes(q) ||
      item.description?.toLowerCase().includes(q) ||
      item.author?.toLowerCase().includes(q) ||
      item.owner?.toLowerCase().includes(q)
    );
  });

  useEffect(() => {
    if (activeTab === 'official' || activeTab === 'community') {
      fetchStorePlugins(activeTab);
    } else if (activeTab === 'unverified') {
      fetchUnverifiedPlugins();
    }
  }, [activeTab]);

  const handleAnalyzeGithubUrl = async () => {
    const trimmed = githubUrl.trim();
    if (!trimmed) {
      setUrlError("Veuillez renseigner l'URL d'un dépôt GitHub.");
      return;
    }

    const githubRegex = /^https?:\/\/(?:www\.)?github\.com\/([^\/]+)\/([^\/\?#]+)/i;
    const match = trimmed.match(githubRegex);
    if (!match) {
      setUrlError("Format d'URL invalide. Exemple attendu : https://github.com/auteur/mon-plugin");
      return;
    }

    const owner = match[1];
    const repo = match[2].replace(/\.git$/, '');

    setAnalyzingUrl(true);
    setUrlError(null);
    setAnalyzedManifest(null);

    try {
      let res = await fetch(`https://raw.githubusercontent.com/${owner}/${repo}/main/plugin.json`);
      if (!res.ok) {
        res = await fetch(`https://raw.githubusercontent.com/${owner}/${repo}/master/plugin.json`);
      }
      if (!res.ok) {
        res = await fetch(`https://api.github.com/repos/${owner}/${repo}/contents/plugin.json`);
        if (res.ok) {
          const fileData = await res.json();
          if (fileData.content) {
            const decoded = atob(fileData.content.replace(/\s/g, ''));
            const manifest = JSON.parse(decoded);
            manifest.plugin_type = 'unverified';
            (manifest as any)._git_url = trimmed;
            setAnalyzedManifest(manifest);
            return;
          }
        }
        throw new Error('Fichier plugin.json introuvable à la racine de ce dépôt GitHub.');
      }

      const manifest = await res.json();
      manifest.plugin_type = 'unverified';
      (manifest as any)._git_url = trimmed;
      setAnalyzedManifest(manifest);
    } catch (err: any) {
      setUrlError(err.message || "Impossible d'analyser le dépôt GitHub.");
    } finally {
      setAnalyzingUrl(false);
    }
  };

  const handleInstallFromAnalyzed = async () => {
    if (!analyzedManifest) return;
    const targetUrl = (analyzedManifest as any)._git_url || githubUrl.trim();
    if (!targetUrl) return;

    setInstalling(true);
    try {
      const stagedManifest = await installPluginFromUrl(targetUrl);
      stagedManifest.type = 'unverified';
      stagedManifest.plugin_type = 'unverified';
      setPendingInstallManifest(stagedManifest);
    } catch (err: any) {
      if (onNotification) onNotification(err.message || 'Échec du clonage du plugin', 'error');
    } finally {
      setInstalling(false);
    }
  };

  const handleTogglePlugin = async (p: PluginInfo) => {
    setActionLoadingId(p.id);
    try {
      if (p.enabled) {
        await disablePlugin(p.id);
      } else {
        await enablePlugin(p.id);
      }
      await fetchInstalledPlugins();
    } catch (err: any) {
      console.error(err);
      if (onNotification) onNotification(err.message || 'Erreur bascule plugin', 'error');
    } finally {
      setActionLoadingId(null);
    }
  };

  const handleOpenConfig = async (id: string) => {
    try {
      const detail = await getPlugin(id);
      setConfiguringPlugin(detail);
      setSettingsForm(detail.settings || {});
    } catch (err) {
      console.error(err);
    }
  };

  const handleSaveConfig = async () => {
    if (!configuringPlugin) return;
    setSavingSettings(true);
    try {
      await updatePluginSettings(configuringPlugin.manifest.id, settingsForm);
      setConfiguringPlugin(null);
      await fetchInstalledPlugins();
      if (onNotification) onNotification('Paramètres du plugin sauvegardés', 'success');
    } catch (err: any) {
      if (onNotification) onNotification(err.message || 'Erreur sauvegarde', 'error');
    } finally {
      setSavingSettings(false);
    }
  };

  const handleRunCommand = async (pluginId: string, cmd: string) => {
    try {
      const res = await runPluginCommand(pluginId, cmd);
      setCommandFeedback({ id: pluginId, msg: res || `Commande '${cmd}' exécutée` });
      setTimeout(() => setCommandFeedback(null), 3500);
      await fetchInstalledPlugins();
    } catch (err: any) {
      setCommandFeedback({ id: pluginId, msg: `Erreur: ${err}` });
      setTimeout(() => setCommandFeedback(null), 4000);
    }
  };

  const handleUninstall = async (p: PluginInfo) => {
    if (p.plugin_type === 'builtin') {
      alert('Impossible de désinstaller un plugin système builtin.');
      return;
    }
    if (window.confirm(`Êtes-vous sûr de vouloir supprimer définitivement le plugin "${p.name}" ?`)) {
      try {
        await uninstallPlugin(p.id);
        await fetchInstalledPlugins();
        if (onNotification) onNotification(`Plugin ${p.name} supprimé`, 'info');
      } catch (err: any) {
        if (onNotification) onNotification(err.message || 'Erreur suppression', 'error');
      }
    }
  };

  const handleInstallZipDialog = async () => {
    try {
      const { open } = await import('@tauri-apps/plugin-dialog');
      const selected = await open({
        title: 'Sélectionner une archive de plugin KaïroOS (.zip)',
        multiple: false,
        filters: [{ name: 'Plugin ZIP', extensions: ['zip'] }],
      });
      if (selected && typeof selected === 'string') {
        const manifest = await installPlugin(selected);
        setPendingInstallManifest(manifest);
      }
    } catch (err: any) {
      console.error(err);
      if (onNotification) onNotification(err.message || 'Échec de lecture du plugin', 'error');
    }
  };

  const handleConfirmInstall = async () => {
    if (!pendingInstallManifest) return;
    setInstalling(true);
    try {
      const gitUrl = (pendingInstallManifest as any)._git_url;
      if (gitUrl) {
        await installPluginFromUrl(gitUrl);
      }
      await confirmInstallPlugin(pendingInstallManifest.id);
      setPendingInstallManifest(null);
      setAnalyzedManifest(null);
      setGithubUrl('');
      await fetchInstalledPlugins();
      if (onNotification) onNotification(`Plugin "${pendingInstallManifest.name}" installé avec succès !`, 'success');
    } catch (err: any) {
      if (onNotification) onNotification(err.message || "Échec de l'installation", 'error');
    } finally {
      setInstalling(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Barre de navigation principale des plugins */}
      <div
        style={{ borderColor: 'var(--border-color)' }}
        className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 border-b pb-3"
      >
        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={() => setActiveTab('installed')}
            style={{
              backgroundColor: activeTab === 'installed' ? 'var(--accent-primary)' : 'transparent',
              color: activeTab === 'installed' ? '#ffffff' : 'var(--text-secondary)',
            }}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-black transition-all shadow-xs cursor-pointer"
          >
            <Puzzle className="w-3.5 h-3.5" />
            <span>Installés ({plugins.length})</span>
          </button>

          <button
            onClick={() => setActiveTab('official')}
            style={{
              backgroundColor: activeTab === 'official' ? 'var(--accent-primary)' : 'transparent',
              color: activeTab === 'official' ? '#ffffff' : 'var(--text-secondary)',
            }}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-black transition-all shadow-xs cursor-pointer"
          >
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
            <span>Store Officiel</span>
          </button>

          <button
            onClick={() => setActiveTab('community')}
            style={{
              backgroundColor: activeTab === 'community' ? 'var(--accent-primary)' : 'transparent',
              color: activeTab === 'community' ? '#ffffff' : 'var(--text-secondary)',
            }}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-black transition-all shadow-xs cursor-pointer"
          >
            <Globe className="w-3.5 h-3.5 text-amber-400" />
            <span>Communauté</span>
          </button>

          <button
            onClick={() => setActiveTab('unverified')}
            style={{
              backgroundColor: activeTab === 'unverified' ? 'var(--accent-primary)' : 'transparent',
              color: activeTab === 'unverified' ? '#ffffff' : 'var(--text-secondary)',
            }}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-black transition-all shadow-xs cursor-pointer"
          >
            <ShieldAlert className="w-3.5 h-3.5 text-red-400" />
            <span>Non Vérifiés</span>
          </button>
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
          <button
            onClick={fetchInstalledPlugins}
            disabled={loading}
            style={{
              backgroundColor: 'var(--bg-card)',
              borderColor: 'var(--border-color)',
              color: 'var(--text-primary)',
            }}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs font-bold hover:border-[var(--accent-primary)]/40 transition-all shadow-2xs cursor-pointer disabled:opacity-50"
            title="Analyser et rafraîchir les plugins installés"
          >
            <RefreshCw className={`w-3.5 h-3.5 text-blue-500 ${loading ? 'animate-spin' : ''}`} />
            <span>Rafraîchir</span>
          </button>

          <button
            onClick={handleInstallZipDialog}
            style={{
              backgroundColor: 'var(--bg-card)',
              borderColor: 'var(--border-color)',
              color: 'var(--text-primary)',
            }}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs font-bold hover:border-[var(--accent-primary)]/40 transition-all shadow-2xs cursor-pointer"
            title="Installer un plugin depuis une archive zip"
          >
            <Upload className="w-3.5 h-3.5 text-indigo-500" />
            <span>Installer (.zip)</span>
          </button>

          <button
            onClick={() => openPluginsFolder()}
            style={{
              backgroundColor: 'var(--bg-card)',
              borderColor: 'var(--border-color)',
              color: 'var(--text-secondary)',
            }}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border hover:opacity-80 text-xs font-bold transition-all shadow-2xs cursor-pointer"
            title="Ouvrir le dossier plugins/ dans l'Explorateur Windows"
          >
            <FolderOpen className="w-3.5 h-3.5" style={{ color: 'var(--accent-primary)' }} />
            <span>Dossier Plugins</span>
          </button>
        </div>
      </div>

      {/* ========================================================= */}
      {/* VUE 1 : PLUGINS INSTALLÉS                                 */}
      {/* ========================================================= */}
      {activeTab === 'installed' && (
        <div className="space-y-4">
          {loading && plugins.length === 0 ? (
            <div className="p-12 text-center text-xs text-slate-400">
              <RefreshCw className="w-6 h-6 mx-auto animate-spin mb-2 text-rose-500" />
              <span>Chargement des plugins...</span>
            </div>
          ) : plugins.length === 0 ? (
            <div
              style={{ backgroundColor: 'var(--bg-secondary)', borderColor: 'var(--border-color)' }}
              className="p-8 rounded-3xl border text-center space-y-2"
            >
              <Puzzle className="w-8 h-8 mx-auto text-slate-400 opacity-60" />
              <div style={{ color: 'var(--text-primary)' }} className="text-sm font-bold">
                Aucun plugin installé
              </div>
              <p style={{ color: 'var(--text-muted)' }} className="text-xs">
                Explorez le Store Officiel ou le catalogue Communautaire pour enrichir KaïroOS.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {plugins.map((p) => {
                const isBuiltin = p.plugin_type === 'builtin' || (p as any).type === 'builtin';
                const isOfficial = p.plugin_type === 'official' || (p as any).type === 'official';

                return (
                  <div
                    key={p.id}
                    style={{
                      backgroundColor: 'var(--bg-card)',
                      borderColor: p.enabled ? 'var(--accent-primary)' : 'var(--border-color)',
                    }}
                    className="p-5 rounded-3xl border-2 flex flex-col justify-between gap-4 transition-all shadow-xs"
                  >
                    {/* En-tête du plugin */}
                    <div className="space-y-2">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <h4
                              style={{ color: 'var(--text-primary)' }}
                              className="text-sm font-black truncate"
                            >
                              {p.name}
                            </h4>

                            {/* Badge type */}
                            {p.plugin_type === 'unverified' && (
                              <span className="px-2 py-0.5 rounded-md text-[9px] font-black bg-red-600 text-white shadow-2xs">
                                NON VÉRIFIÉ
                              </span>
                            )}
                            {isBuiltin && (
                              <span className="px-2 py-0.5 rounded-md text-[9px] font-black bg-purple-600 text-white shadow-2xs">
                                SYSTÈME
                              </span>
                            )}
                            {isOfficial && (
                              <span className="px-2 py-0.5 rounded-md text-[9px] font-black bg-emerald-600 text-white shadow-2xs">
                                OFFICIEL
                              </span>
                            )}
                            {!isBuiltin && !isOfficial && p.plugin_type !== 'unverified' && (
                              <span className="px-2 py-0.5 rounded-md text-[9px] font-black bg-amber-500 text-white shadow-2xs">
                                COMMUNAUTÉ
                              </span>
                            )}

                            <span
                              style={{ color: 'var(--text-muted)' }}
                              className="text-[10px] font-mono font-bold"
                            >
                              v{p.version}
                            </span>
                          </div>

                          <div style={{ color: 'var(--text-muted)' }} className="text-[11px] mt-0.5">
                            Par {p.author}
                          </div>
                        </div>

                        {/* Toggle switch Actif / Inactif */}
                        <div className="flex items-center gap-2 shrink-0">
                          <div className="flex items-center gap-1.5">
                            <span
                              className={`w-2 h-2 rounded-full ${
                                p.running ? 'bg-emerald-500 animate-pulse' : 'bg-slate-400'
                              }`}
                            />
                            <span style={{ color: 'var(--text-muted)' }} className="text-[10px] font-bold">
                              {p.running ? 'En cours' : 'Arrêté'}
                            </span>
                          </div>

                          <button
                            onClick={() => handleTogglePlugin(p)}
                            disabled={actionLoadingId === p.id}
                            style={{
                              backgroundColor: p.enabled ? 'var(--accent-primary)' : 'var(--bg-secondary)',
                            }}
                            className="w-11 h-6 rounded-full p-1 transition-colors relative cursor-pointer"
                            title={p.enabled ? 'Désactiver le plugin' : 'Activer le plugin'}
                          >
                            <div
                              className={`w-4 h-4 rounded-full bg-white transition-transform ${
                                p.enabled ? 'translate-x-5' : 'translate-x-0'
                              }`}
                            />
                          </button>
                        </div>
                      </div>

                      <p
                        style={{ color: 'var(--text-secondary)' }}
                        className="text-xs leading-relaxed line-clamp-2"
                      >
                        {p.description}
                      </p>

                      {/* Badges de permissions requises */}
                      {p.permissions.length > 0 && (
                        <div className="flex items-center gap-1 flex-wrap pt-1">
                          {p.permissions.map((perm) => (
                            <span
                              key={perm}
                              style={{
                                backgroundColor: 'var(--bg-secondary)',
                                borderColor: 'var(--border-color)',
                                color: 'var(--text-secondary)',
                              }}
                              className="px-2 py-0.5 rounded-lg border text-[9px] font-mono font-bold"
                            >
                              {perm}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Feedback commande éventuel */}
                    {commandFeedback?.id === p.id && (
                      <div className="p-2.5 rounded-xl bg-slate-900 text-white text-[11px] font-mono flex items-start gap-1.5 break-words">
                        <Sparkles className="w-3.5 h-3.5 text-amber-400 shrink-0 mt-0.5" />
                        <span className="break-all">{commandFeedback.msg}</span>
                      </div>
                    )}

                    {/* Actions : Configurer, Commandes rapides, Désinstaller */}
                    <div
                      style={{ borderColor: 'var(--border-color)' }}
                      className="pt-3 border-t flex items-center justify-between gap-2"
                    >
                      <div className="flex items-center gap-1.5 flex-wrap">

                        {p.has_settings && (
                          <button
                            onClick={() => handleOpenConfig(p.id)}
                            style={{
                              backgroundColor: 'var(--bg-secondary)',
                              borderColor: 'var(--border-color)',
                              color: 'var(--text-primary)',
                            }}
                            className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl border text-[11px] font-bold hover:border-[var(--accent-primary)]/40 transition-all cursor-pointer"
                          >
                            <Sliders className="w-3 h-3 text-amber-500" />
                            <span>Configurer</span>
                          </button>
                        )}

                        {/* Raccourcis commandes (start, restart, etc.) */}
                        {p.commands.map((cmd) => (
                          <button
                            key={cmd}
                            onClick={() => handleRunCommand(p.id, cmd)}
                            style={{
                              backgroundColor: 'var(--bg-secondary)',
                              borderColor: 'var(--border-color)',
                              color: 'var(--text-secondary)',
                            }}
                            className="px-2 py-1.5 rounded-xl border text-[10px] font-bold uppercase hover:text-[var(--accent-primary)] transition-all cursor-pointer"
                            title={`Exécuter la commande '${cmd}'`}
                          >
                            {cmd}
                          </button>
                        ))}
                      </div>

                      <div>
                        {!isBuiltin ? (
                          <button
                            onClick={() => handleUninstall(p)}
                            className="p-1.5 rounded-xl text-rose-500 hover:bg-rose-500/10 transition-colors cursor-pointer"
                            title="Désinstaller le plugin"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        ) : (
                          <span
                            style={{ color: 'var(--text-muted)' }}
                            className="text-[10px] italic font-bold"
                            title="Les plugins système sont protégés"
                          >
                            Protégé
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ========================================================= */}
      {/* VUE 2 & 3 : STORE OFFICIEL & COMMUNAUTÉ                  */}
      {/* ========================================================= */}
      {(activeTab === 'official' || activeTab === 'community') && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 style={{ color: 'var(--text-primary)' }} className="text-xs font-black uppercase tracking-wider">
                {activeTab === 'official' ? 'Plugins Officiels Certifiés' : 'Plugins Communautaires'}
              </h3>
              <p style={{ color: 'var(--text-muted)' }} className="text-[11px]">
                {activeTab === 'official'
                  ? 'Maintenus et validés par l\'équipe KaïroOS pour une compatibilité garantie.'
                  : 'Créés par les membres de la communauté. Chaque installation est soumise à approbation sandbox.'}
              </p>
            </div>

            {activeTab === 'community' && (
              <a
                href="https://github.com/KairoOS-Official/kairos-plugins#soumettre-un-plugin"
                target="_blank"
                rel="noreferrer"
                style={{
                  backgroundColor: 'var(--bg-secondary)',
                  borderColor: 'var(--border-color)',
                  color: 'var(--accent-primary)',
                }}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs font-bold hover:scale-102 transition-all cursor-pointer"
              >
                <ExternalLink className="w-3.5 h-3.5" />
                <span>Soumettre mon plugin</span>
              </a>
            )}
          </div>

          {loadingStore ? (
            <div className="p-12 text-center text-xs text-slate-400">
              <RefreshCw className="w-6 h-6 mx-auto animate-spin mb-2 text-rose-500" />
              <span>Interrogation du catalogue GitHub...</span>
            </div>
          ) : storeError ? (
            <div
              style={{ backgroundColor: 'var(--bg-secondary)', borderColor: 'var(--border-color)' }}
              className="p-8 rounded-3xl border text-center space-y-2"
            >
              <AlertTriangle className="w-8 h-8 mx-auto text-amber-500" />
              <div style={{ color: 'var(--text-primary)' }} className="text-sm font-bold">
                {storeError}
              </div>
              <p style={{ color: 'var(--text-muted)' }} className="text-xs">
                Vérifiez votre connexion Internet ou réessayez ultérieurement.
              </p>
            </div>
          ) : storePlugins.length === 0 ? (
            <div
              style={{ backgroundColor: 'var(--bg-secondary)', borderColor: 'var(--border-color)' }}
              className="p-8 rounded-3xl border text-center space-y-2"
            >
              <Puzzle className="w-8 h-8 mx-auto text-slate-400 opacity-60" />
              <div style={{ color: 'var(--text-primary)' }} className="text-sm font-bold">
                Aucun plugin disponible pour le moment
              </div>
              <p style={{ color: 'var(--text-muted)' }} className="text-xs">
                Les plugins validés apparaîtront automatiquement ici dès leur publication sur GitHub.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {storePlugins.map((item) => {
                const isInstalled = plugins.some((p) => p.id === item.id);

                return (
                  <div
                    key={item.id}
                    style={{
                      backgroundColor: 'var(--bg-card)',
                      borderColor: 'var(--border-color)',
                    }}
                    className="p-5 rounded-3xl border-2 flex flex-col justify-between gap-4 transition-all shadow-xs hover:border-[var(--accent-primary)]/40"
                  >
                    <div className="space-y-2">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <div className="flex items-center gap-2">
                            <h4
                              style={{ color: 'var(--text-primary)' }}
                              className="text-sm font-black truncate"
                            >
                              {item.name}
                            </h4>
                            <span
                              style={{ color: 'var(--text-muted)' }}
                              className="text-[10px] font-mono font-bold"
                            >
                              v{item.version}
                            </span>
                          </div>
                          <div style={{ color: 'var(--text-muted)' }} className="text-[11px]">
                            Par {item.author}
                          </div>
                        </div>

                        {isInstalled ? (
                          <span className="flex items-center gap-1 px-2.5 py-1 rounded-xl bg-emerald-500/10 text-emerald-600 text-[10px] font-black border border-emerald-500/20">
                            <Check className="w-3 h-3 stroke-[3]" />
                            <span>INSTALLÉ</span>
                          </span>
                        ) : (
                          <button
                            onClick={() => setPendingInstallManifest(item)}
                            style={{
                              backgroundColor: 'var(--accent-primary)',
                              color: '#ffffff',
                            }}
                            className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-black shadow-xs hover:scale-102 active:scale-98 transition-all cursor-pointer"
                          >
                            <span>Installer</span>
                          </button>
                        )}
                      </div>

                      <p
                        style={{ color: 'var(--text-secondary)' }}
                        className="text-xs leading-relaxed line-clamp-3"
                      >
                        {item.description}
                      </p>

                      {/* Permissions déclarées */}
                      {item.permissions && item.permissions.length > 0 && (
                        <div className="flex items-center gap-1 flex-wrap pt-1">
                          {item.permissions.map((perm: string) => (
                            <span
                              key={perm}
                              style={{
                                backgroundColor: 'var(--bg-secondary)',
                                borderColor: 'var(--border-color)',
                                color: 'var(--text-secondary)',
                              }}
                              className="px-2 py-0.5 rounded-lg border text-[9px] font-mono font-bold"
                            >
                              {perm}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ========================================================= */}
      {/* VUE 4 : PLUGINS NON VÉRIFIÉS & INSTALLATION PAR GITHUB    */}
      {/* ========================================================= */}
      {activeTab === 'unverified' && (
        <div className="space-y-6">
          {/* Bandeau d'avertissement rouge en haut de la vue */}
          <div className="p-4 rounded-2xl bg-red-500/10 border-2 border-red-500/30 text-red-400 flex items-start gap-3 shadow-xs">
            <AlertTriangle className="w-5 h-5 shrink-0 mt-0.5 text-red-500" />
            <div className="space-y-0.5">
              <h4 className="text-xs font-black uppercase tracking-wider text-red-500">
                Avertissement de Sécurité
              </h4>
              <p className="text-xs text-red-300/90 leading-relaxed">
                Les plugins non vérifiés n'ont pas été validés par l'équipe KaïroOS.
                Installez-les uniquement si vous faites confiance à l'auteur.
              </p>
            </div>
          </div>

          {/* Section 1 : Découvrir des plugins (GitHub Topics) */}
          <div className="space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h3 style={{ color: 'var(--text-primary)' }} className="text-xs font-black uppercase tracking-wider flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-amber-400" />
                  <span>Découvrir des plugins populaires</span>
                </h3>
                <p style={{ color: 'var(--text-muted)' }} className="text-[11px]">
                  Dépôts GitHub avec le topic <code className="font-mono text-red-400">kairo-plugins</code> triés par étoiles.
                </p>
              </div>

              <div className="flex items-center gap-2">
                <div className="relative">
                  <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                  <input
                    type="text"
                    value={unverifiedSearchQuery}
                    onChange={(e) => setUnverifiedSearchQuery(e.target.value)}
                    placeholder="Filtrer les plugins..."
                    style={{
                      backgroundColor: 'var(--bg-secondary)',
                      borderColor: 'var(--border-color)',
                      color: 'var(--text-primary)',
                    }}
                    className="pl-8 pr-3 py-1.5 text-xs rounded-xl border focus:outline-none focus:border-red-500/60 transition-all placeholder:text-slate-500 w-44 sm:w-56"
                  />
                  {unverifiedSearchQuery && (
                    <button
                      type="button"
                      onClick={() => setUnverifiedSearchQuery('')}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white text-xs cursor-pointer"
                    >
                      ✕
                    </button>
                  )}
                </div>

                <button
                  type="button"
                  onClick={fetchUnverifiedPlugins}
                  disabled={loadingStore}
                  style={{
                    backgroundColor: 'var(--bg-secondary)',
                    borderColor: 'var(--border-color)',
                    color: 'var(--text-secondary)',
                  }}
                  className="p-2 rounded-xl border hover:text-white transition-all cursor-pointer disabled:opacity-50 shrink-0"
                  title="Rafraîchir la liste GitHub"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${loadingStore ? 'animate-spin' : ''}`} />
                </button>
              </div>
            </div>

            {loadingStore ? (
              <div className="p-12 text-center text-xs text-slate-400">
                <RefreshCw className="w-6 h-6 mx-auto animate-spin mb-2 text-red-500" />
                <span>Interrogation des dépôts GitHub (topic:kairo-plugins)...</span>
              </div>
            ) : storeError ? (
              <div
                style={{ backgroundColor: 'var(--bg-secondary)', borderColor: 'var(--border-color)' }}
                className="p-8 rounded-3xl border text-center space-y-2"
              >
                <AlertTriangle className="w-8 h-8 mx-auto text-amber-500" />
                <div style={{ color: 'var(--text-primary)' }} className="text-sm font-bold">
                  {storeError}
                </div>
                <p style={{ color: 'var(--text-muted)' }} className="text-xs">
                  {storeError.includes('Trop de requêtes')
                    ? 'Le quota de requêtes non authentifiées de GitHub a été atteint. Patientez un instant.'
                    : 'Vérifiez votre connexion Internet ou installez directement par URL ci-dessous.'}
                </p>
              </div>
            ) : filteredUnverifiedPlugins.length === 0 ? (
              <div
                style={{ backgroundColor: 'var(--bg-secondary)', borderColor: 'var(--border-color)' }}
                className="p-8 rounded-3xl border text-center space-y-2"
              >
                <Puzzle className="w-8 h-8 mx-auto text-slate-400 opacity-60" />
                <div style={{ color: 'var(--text-primary)' }} className="text-sm font-bold">
                  {unverifiedSearchQuery ? 'Aucun résultat pour cette recherche' : 'Aucun plugin trouvé avec le topic kairo-plugins'}
                </div>
                <p style={{ color: 'var(--text-muted)' }} className="text-xs">
                  Vous pouvez ajouter le topic <code>kairo-plugins</code> à votre dépôt GitHub ou coller son URL ci-dessous.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {filteredUnverifiedPlugins.map((item) => {
                  const isInstalled = plugins.some((p) => p.id === item.id);
                  return (
                    <div
                      key={item.id}
                      style={{
                        backgroundColor: 'var(--bg-card)',
                        borderColor: 'rgba(239, 68, 68, 0.3)',
                      }}
                      className="p-5 rounded-3xl border-2 flex flex-col justify-between gap-4 transition-all shadow-xs hover:border-red-500/50"
                    >
                      <div className="space-y-2">
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <div className="flex items-center gap-2 flex-wrap">
                              <h4 style={{ color: 'var(--text-primary)' }} className="text-sm font-black truncate">
                                {item.name}
                              </h4>
                              <span className="px-2 py-0.5 rounded-md text-[9px] font-black bg-red-600 text-white shadow-2xs">
                                NON VÉRIFIÉ
                              </span>
                              <span style={{ color: 'var(--text-muted)' }} className="text-[10px] font-mono font-bold">
                                v{item.version || '1.0.0'}
                              </span>
                              {item.stars !== undefined && (
                                <div className="flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold bg-amber-500/10 text-amber-400 border border-amber-500/20">
                                  <Star className="w-3 h-3 fill-amber-400 text-amber-400" />
                                  <span>{item.stars}</span>
                                </div>
                              )}
                            </div>
                            <div style={{ color: 'var(--text-muted)' }} className="text-[11px] mt-0.5">
                              Par {item.author || item.owner}
                            </div>
                          </div>

                          {isInstalled ? (
                            <span className="flex items-center gap-1 px-2.5 py-1 rounded-xl bg-emerald-500/10 text-emerald-600 text-[10px] font-black border border-emerald-500/20 shrink-0">
                              <Check className="w-3 h-3 stroke-[3]" />
                              <span>INSTALLÉ</span>
                            </span>
                          ) : (
                            <button
                              type="button"
                              onClick={() => {
                                setPendingInstallManifest({
                                  ...item,
                                  plugin_type: 'unverified',
                                  _git_url: item.github_url || item.git_url,
                                });
                              }}
                              className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-black text-white bg-red-600 hover:bg-red-500 shadow-xs hover:scale-102 active:scale-98 transition-all cursor-pointer shrink-0"
                            >
                              <span>Installer</span>
                            </button>
                          )}
                        </div>

                        <p style={{ color: 'var(--text-secondary)' }} className="text-xs leading-relaxed line-clamp-3">
                          {item.description}
                        </p>

                        {item.permissions && item.permissions.length > 0 && (
                          <div className="flex items-center gap-1 flex-wrap pt-1">
                            {item.permissions.map((perm: string) => (
                              <span
                                key={perm}
                                style={{
                                  backgroundColor: 'var(--bg-secondary)',
                                  borderColor: 'var(--border-color)',
                                  color: 'var(--text-secondary)',
                                }}
                                className="px-2 py-0.5 rounded-lg border text-[9px] font-mono font-bold"
                              >
                                {perm}
                              </span>
                            ))}
                          </div>
                        )}

                        {item.github_url && (
                          <div className="pt-2 border-t border-white/5 flex items-center justify-between">
                            <a
                              href={item.github_url}
                              target="_blank"
                              rel="noreferrer"
                              className="inline-flex items-center gap-1 text-[11px] text-slate-400 hover:text-white transition-colors"
                            >
                              <ExternalLink className="w-3 h-3" />
                              <span>Voir le dépôt GitHub</span>
                            </a>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Séparateur visuel */}
          <div className="relative flex py-2 items-center">
            <div className="flex-grow border-t border-slate-700/60" />
            <span className="flex-shrink mx-4 text-xs font-bold uppercase tracking-wider text-slate-400">
              Ou installer par URL GitHub
            </span>
            <div className="flex-grow border-t border-slate-700/60" />
          </div>

          {/* Section 2 : Installation par URL de dépôt GitHub */}
          <div
            style={{
              backgroundColor: 'var(--bg-card)',
              borderColor: 'var(--border-color)',
            }}
            className="p-5 rounded-3xl border-2 space-y-4 shadow-xs"
          >
            <div>
              <h3 style={{ color: 'var(--text-primary)' }} className="text-xs font-black uppercase tracking-wider flex items-center gap-2">
                <ShieldAlert className="w-4 h-4 text-red-500" />
                <span>Installer un plugin depuis un dépôt GitHub</span>
              </h3>
              <p style={{ color: 'var(--text-muted)' }} className="text-[11px] mt-0.5">
                Collez l'URL d'un dépôt GitHub public contenant un fichier <code className="font-mono text-red-400">plugin.json</code> à la racine.
              </p>
            </div>

            {/* Input URL + Bouton Analyser */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5">
              <div className="relative flex-1">
                <input
                  type="text"
                  value={githubUrl}
                  onChange={(e) => {
                    setGithubUrl(e.target.value);
                    setUrlError(null);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleAnalyzeGithubUrl();
                  }}
                  placeholder="https://github.com/auteur/mon-plugin-kairo"
                  style={{
                    backgroundColor: 'var(--bg-secondary)',
                    borderColor: urlError ? '#ef4444' : 'var(--border-color)',
                    color: 'var(--text-primary)',
                  }}
                  className="w-full px-4 py-2.5 rounded-xl border text-xs font-mono outline-none focus:border-red-500/60 transition-all placeholder:text-slate-500"
                />
              </div>

              <button
                type="button"
                onClick={handleAnalyzeGithubUrl}
                disabled={analyzingUrl || !githubUrl.trim()}
                style={{
                  backgroundColor: 'var(--accent-primary)',
                  color: '#ffffff',
                }}
                className="flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl text-xs font-black shadow-xs hover:scale-102 active:scale-98 transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed shrink-0"
              >
                {analyzingUrl ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    <span>Analyse en cours...</span>
                  </>
                ) : (
                  <>
                    <Sparkles className="w-3.5 h-3.5" />
                    <span>Analyser</span>
                  </>
                )}
              </button>
            </div>

            {/* Feedback d'erreur d'analyse */}
            {urlError && (
              <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-xs flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 shrink-0" />
                <span>{urlError}</span>
              </div>
            )}

            {/* Carte du plugin analysé avec ses permissions */}
            {analyzedManifest && (
              <div
                style={{
                  backgroundColor: 'var(--bg-secondary)',
                  borderColor: 'rgba(239, 68, 68, 0.4)',
                }}
                className="p-4 rounded-2xl border-2 space-y-3 animate-in fade-in slide-in-from-top-2 duration-200"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <h4 style={{ color: 'var(--text-primary)' }} className="text-sm font-black">
                        {analyzedManifest.name}
                      </h4>
                      <span className="px-2 py-0.5 rounded-md text-[9px] font-black bg-red-600 text-white shadow-2xs">
                        NON VÉRIFIÉ
                      </span>
                      <span style={{ color: 'var(--text-muted)' }} className="text-[10px] font-mono font-bold">
                        v{analyzedManifest.version}
                      </span>
                    </div>
                    <div style={{ color: 'var(--text-muted)' }} className="text-[11px] mt-0.5">
                      Par {analyzedManifest.author}
                    </div>
                  </div>

                  {plugins.some((p) => p.id === analyzedManifest.id) ? (
                    <span className="flex items-center gap-1 px-2.5 py-1 rounded-xl bg-emerald-500/10 text-emerald-600 text-[10px] font-black border border-emerald-500/20">
                      <Check className="w-3 h-3 stroke-[3]" />
                      <span>DÉJÀ INSTALLÉ</span>
                    </span>
                  ) : (
                    <button
                      type="button"
                      onClick={handleInstallFromAnalyzed}
                      disabled={installing}
                      className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-black text-white bg-red-600 hover:bg-red-500 shadow-md hover:scale-102 active:scale-98 transition-all cursor-pointer disabled:opacity-50"
                    >
                      {installing ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <ShieldAlert className="w-3.5 h-3.5" />}
                      <span>Installer (Git Clone)</span>
                    </button>
                  )}
                </div>

                <p style={{ color: 'var(--text-secondary)' }} className="text-xs leading-relaxed">
                  {analyzedManifest.description || 'Aucune description fournie.'}
                </p>

                {/* Permissions demandées */}
                <div className="pt-2 border-t border-white/5 space-y-2">
                  <div className="text-[10px] font-black uppercase tracking-wider text-amber-500 flex items-center gap-1.5">
                    <Shield className="w-3 h-3" />
                    <span>Permissions demandées par ce plugin :</span>
                  </div>

                  {!analyzedManifest.permissions || analyzedManifest.permissions.length === 0 ? (
                    <div className="text-xs text-emerald-400 flex items-center gap-1.5 italic">
                      <ShieldCheck className="w-3.5 h-3.5" />
                      <span>Ce plugin ne demande aucune permission spéciale sur votre système.</span>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {analyzedManifest.permissions.map((perm) => {
                        const info = PERMISSION_DESCRIPTIONS[perm] || {
                          label: perm,
                          desc: `Permission système: ${perm}`,
                          icon: <Shield className="w-4 h-4 text-slate-400" />,
                        };
                        return (
                          <div
                            key={perm}
                            style={{
                              backgroundColor: 'var(--bg-card)',
                              borderColor: 'var(--border-color)',
                            }}
                            className="p-2.5 rounded-xl border flex items-start gap-2 text-left"
                          >
                            <div className="p-1.5 rounded-lg bg-black/10 shrink-0">
                              {info.icon}
                            </div>
                            <div className="min-w-0 flex-1">
                              <div style={{ color: 'var(--text-primary)' }} className="text-[11px] font-bold">
                                {info.label}
                              </div>
                              <div style={{ color: 'var(--text-muted)' }} className="text-[10px] line-clamp-1">
                                {info.desc}
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* MODAL 1 : CONFIGURATION DYNAMIQUE D'UN PLUGIN             */}
      {/* ========================================================= */}
      {configuringPlugin && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <div
            style={{
              backgroundColor: 'var(--bg-primary)',
              borderColor: 'var(--border-color)',
            }}
            className="w-full max-w-lg rounded-3xl border shadow-2xl overflow-hidden flex flex-col max-h-[85vh] animate-in fade-in zoom-in-95 duration-200"
          >
            {/* Header */}
            <div
              style={{
                backgroundColor: 'var(--sidebar-bg)',
                borderColor: 'var(--border-color)',
              }}
              className="p-4 border-b flex items-center justify-between"
            >
              <div className="flex items-center gap-2">
                <Sliders className="w-4 h-4 text-amber-500" />
                <h3 style={{ color: 'var(--text-primary)' }} className="text-sm font-black">
                  Configuration — {configuringPlugin.manifest.name}
                </h3>
              </div>
              <button
                onClick={() => setConfiguringPlugin(null)}
                className="w-8 h-8 rounded-xl border border-slate-300 dark:border-slate-700 flex items-center justify-center text-slate-500 hover:text-slate-900 dark:hover:text-white transition-all cursor-pointer font-bold text-sm"
              >
                ✕
              </button>
            </div>

            {/* Formulaire généré dynamiquement depuis settings_schema */}
            <div className="p-5 overflow-y-auto space-y-4 flex-1">
              {Object.keys(configuringPlugin.manifest.settings_schema || {}).length === 0 ? (
                <div style={{ color: 'var(--text-muted)' }} className="text-xs italic text-center py-4">
                  Ce plugin ne requiert aucun paramètre personnalisable.
                </div>
              ) : (
                Object.entries(configuringPlugin.manifest.settings_schema).map(([key, schema]) => {
                  const currentVal = settingsForm[key] !== undefined ? settingsForm[key] : schema.default;
                  const isSecret = Boolean(schema.secret);
                  const isRevealed = showSecrets[key];

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
                        <label
                          style={{ color: 'var(--text-primary)' }}
                          className="text-xs font-bold"
                        >
                          {schema.label || key}
                        </label>
                        <span style={{ color: 'var(--text-muted)' }} className="text-[10px] font-mono">
                          {key}
                        </span>
                      </div>

                      {schema.type === 'boolean' ? (
                        <label className="flex items-center justify-between pt-1 cursor-pointer">
                          <span style={{ color: 'var(--text-muted)' }} className="text-xs">
                            {currentVal ? 'Activé' : 'Désactivé'}
                          </span>
                          <input
                            type="checkbox"
                            checked={Boolean(currentVal)}
                            onChange={(e) => setSettingsForm({ ...settingsForm, [key]: e.target.checked })}
                            className="w-4 h-4 rounded text-rose-500 focus:ring-rose-400"
                          />
                        </label>
                      ) : schema.type === 'number' ? (
                        <input
                          type="number"
                          value={currentVal}
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
                            value={currentVal || ''}
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
                })
              )}
            </div>

            {/* Footer */}
            <div
              style={{
                backgroundColor: 'var(--sidebar-bg)',
                borderColor: 'var(--border-color)',
              }}
              className="p-4 border-t flex items-center justify-end gap-2"
            >
              <button
                onClick={() => setConfiguringPlugin(null)}
                style={{
                  backgroundColor: 'var(--bg-secondary)',
                  color: 'var(--text-secondary)',
                }}
                className="px-4 py-2 rounded-xl text-xs font-bold hover:opacity-80 transition-all cursor-pointer"
              >
                Annuler
              </button>

              <button
                onClick={handleSaveConfig}
                disabled={savingSettings}
                style={{
                  backgroundColor: 'var(--accent-primary)',
                  color: '#ffffff',
                }}
                className="px-5 py-2 rounded-xl text-xs font-black shadow-md hover:opacity-90 transition-all cursor-pointer flex items-center gap-1.5"
              >
                {savingSettings ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                <span>Enregistrer</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* MODAL 2 : SANDBOX DE PERMISSIONS (STYLE ANDROID)          */}
      {/* ========================================================= */}
      {pendingInstallManifest && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-xs">
          <div
            style={{
              backgroundColor: 'var(--bg-primary)',
              borderColor: 'var(--border-color)',
            }}
            className="w-full max-w-lg rounded-3xl border-2 shadow-2xl overflow-hidden flex flex-col max-h-[85vh] animate-in fade-in zoom-in-95 duration-200"
          >
            {/* Header sécurité */}
            <div className="p-5 bg-gradient-to-r from-amber-500/20 via-rose-500/20 to-purple-500/20 border-b border-amber-500/20 flex items-start gap-3.5">
              <div className="w-10 h-10 rounded-2xl bg-amber-500/20 border border-amber-500/40 flex items-center justify-center shrink-0">
                <ShieldAlert className="w-5 h-5 text-amber-500" />
              </div>
              <div className="flex-1">
                <div className="text-[11px] font-black uppercase tracking-wider text-amber-500">
                  Sécurité & Bac à Sable (Sandbox)
                </div>
                <h3 style={{ color: 'var(--text-primary)' }} className="text-base font-black leading-tight mt-0.5">
                  Installer "{pendingInstallManifest.name}" ?
                </h3>
                <p style={{ color: 'var(--text-muted)' }} className="text-xs mt-1">
                  Ce plugin requiert l'accès explicite aux fonctionnalités listées ci-dessous :
                </p>
              </div>
            </div>

            {/* Corps de la liste des permissions */}
            <div className="p-5 overflow-y-auto space-y-3 flex-1">
              {(!pendingInstallManifest.permissions || pendingInstallManifest.permissions.length === 0) ? (
                <div className="p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-xs text-emerald-600 flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4 shrink-0" />
                  <span>Ce plugin ne demande aucune permission spéciale sur votre système.</span>
                </div>
              ) : (
                pendingInstallManifest.permissions.map((perm) => {
                  const info = PERMISSION_DESCRIPTIONS[perm] || {
                    label: perm,
                    desc: `Permission système spécifique: ${perm}`,
                    icon: <Shield className="w-4 h-4 text-slate-400" />,
                  };

                  return (
                    <div
                      key={perm}
                      style={{
                        backgroundColor: 'var(--bg-secondary)',
                        borderColor: 'var(--border-color)',
                      }}
                      className="p-3.5 rounded-2xl border flex items-start gap-3"
                    >
                      <div className="p-2 rounded-xl bg-black/10 shrink-0 mt-0.5">
                        {info.icon}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div style={{ color: 'var(--text-primary)' }} className="text-xs font-black">
                          {info.label}
                        </div>
                        <div style={{ color: 'var(--text-muted)' }} className="text-[11px] leading-relaxed mt-0.5">
                          {info.desc}
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {/* Actions Consentement */}
            <div
              style={{
                backgroundColor: 'var(--sidebar-bg)',
                borderColor: 'var(--border-color)',
              }}
              className="p-4 border-t flex items-center justify-between gap-3"
            >
              <button
                onClick={() => setPendingInstallManifest(null)}
                style={{
                  backgroundColor: 'var(--bg-secondary)',
                  color: 'var(--text-secondary)',
                }}
                className="px-4 py-2 rounded-xl text-xs font-bold hover:opacity-80 transition-all cursor-pointer"
              >
                Refuser et Annuler
              </button>

              <button
                onClick={handleConfirmInstall}
                disabled={installing}
                style={{
                  backgroundColor: 'var(--accent-primary)',
                  color: '#ffffff',
                }}
                className="px-5 py-2 rounded-xl text-xs font-black shadow-md hover:scale-102 active:scale-98 transition-all cursor-pointer flex items-center gap-1.5"
              >
                {installing ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <ShieldCheck className="w-3.5 h-3.5" />}
                <span>Accepter et Installer</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
