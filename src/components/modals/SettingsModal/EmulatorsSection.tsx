import React, { useState, useEffect, useCallback } from 'react';
import {
  Cpu,
  Check,
  Folder,
  Download,
  RefreshCw,
  FolderOpen,
  ChevronDown,
  ChevronUp,
  AlertCircle,
  Sparkles,
  Loader2,
} from 'lucide-react';
import { listen } from '@tauri-apps/api/event';
import { AppSettings, Emulator, EmulatorCatalogItem, EmulatorDownloadProgress } from '../../../types';
import {
  getEmulatorCatalog,
  downloadEmulator,
  scanAndAutoDetectEmulators,
  openEmulatorsFolder,
  testEmulatorExe,
  updateEmulatorPath,
} from '../../../api';

interface EmulatorsSectionProps {
  settings: AppSettings;
  updateSetting: (key: keyof AppSettings, val: any) => void;
  emulators?: Emulator[];
}

export const EmulatorsSection: React.FC<EmulatorsSectionProps> = ({
  settings,
  updateSetting,
}) => {
  const [catalog, setCatalog] = useState<EmulatorCatalogItem[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [scanning, setScanning] = useState<boolean>(false);
  const [downloadingIds, setDownloadingIds] = useState<Record<string, { percent: number; status: string }>>({});
  const [expandedIds, setExpandedIds] = useState<Record<string, boolean>>({});
  const [customPaths, setCustomPaths] = useState<Record<string, string>>({});
  const [customArgs, setCustomArgs] = useState<Record<string, string>>({});
  const [testResults, setTestResults] = useState<Record<string, boolean>>({});
  const [testingPath, setTestingPath] = useState<string | null>(null);
  const [feedbackMessage, setFeedbackMessage] = useState<string | null>(null);

  // Charger le catalogue
  const loadCatalog = useCallback(async () => {
    try {
      setLoading(true);
      const items = await getEmulatorCatalog();
      setCatalog(items);
      const paths: Record<string, string> = {};
      const args: Record<string, string> = {};
      items.forEach((item) => {
        paths[item.id] = item.installed_path || item.default_exe;
        args[item.id] = item.default_args;
      });
      setCustomPaths(paths);
      setCustomArgs(args);
    } catch (err) {
      console.error('Erreur chargement catalogue émulateurs:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadCatalog();
  }, [loadCatalog]);

  // Écouteur d'événements de téléchargement en temps réel
  useEffect(() => {
    let unlistenFn: (() => void) | null = null;
    listen<EmulatorDownloadProgress>('kairo://emulator-download-progress', (event) => {
      const { id, percent, status, error } = event.payload;
      if (error) {
        setDownloadingIds((prev) => {
          const next = { ...prev };
          delete next[id];
          return next;
        });
        setFeedbackMessage(`❌ Erreur [${id}]: ${error}`);
      } else if (percent >= 100) {
        setDownloadingIds((prev) => {
          const next = { ...prev };
          delete next[id];
          return next;
        });
        loadCatalog();
      } else {
        setDownloadingIds((prev) => ({
          ...prev,
          [id]: { percent, status },
        }));
      }
    }).then((fn) => {
      unlistenFn = fn;
    });

    return () => {
      if (unlistenFn) unlistenFn();
    };
  }, [loadCatalog]);

  // Déclencher le téléchargement d'un émulateur
  const handleDownload = async (id: string) => {
    try {
      setDownloadingIds((prev) => ({
        ...prev,
        [id]: { percent: 10, status: 'Démarrage du téléchargement...' },
      }));
      setFeedbackMessage(null);
      await downloadEmulator(id);
      await loadCatalog();
    } catch (err: any) {
      console.error('Erreur téléchargement émulateur:', err);
      setFeedbackMessage(`❌ Échec : ${err?.message || err}`);
      setDownloadingIds((prev) => {
        const next = { ...prev };
        delete next[id];
        return next;
      });
    }
  };

  // Télécharger tous les émulateurs officiels manquants
  const handleDownloadAll = async () => {
    const toDownload = catalog.filter((e) => !e.is_installed && e.download_url);
    if (toDownload.length === 0) {
      setFeedbackMessage('Tous les émulateurs officiels sont déjà installés !');
      return;
    }
    for (const emu of toDownload) {
      await handleDownload(emu.id);
    }
  };

  // Scanner les dossiers
  const handleScan = async () => {
    try {
      setScanning(true);
      setFeedbackMessage(null);
      const items = await scanAndAutoDetectEmulators();
      setCatalog(items);
      const installedCount = items.filter((e) => e.is_installed).length;
      setFeedbackMessage(`✅ Scan terminé : ${installedCount} / ${items.length} émulateurs opérationnels.`);
    } catch (err) {
      console.error('Erreur scan émulateurs:', err);
    } finally {
      setScanning(false);
    }
  };

  // Tester l'exécutable
  const handleTest = async (emuId: string, path: string) => {
    setTestingPath(emuId);
    try {
      const exists = await testEmulatorExe(path);
      setTestResults((prev) => ({ ...prev, [emuId]: exists }));
    } catch {
      setTestResults((prev) => ({ ...prev, [emuId]: false }));
    } finally {
      setTestingPath(null);
    }
  };

  // Sauvegarder un chemin personnalisé
  const handleSavePath = async (emuId: string) => {
    const newPath = customPaths[emuId];
    try {
      await updateEmulatorPath(emuId, newPath);
      await loadCatalog();
      setFeedbackMessage(`✅ Configuration de ${emuId} mise à jour.`);
    } catch (err: any) {
      setFeedbackMessage(`❌ Erreur mise à jour: ${err?.message || err}`);
    }
  };

  const toggleExpand = (id: string) => {
    setExpandedIds((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  return (
    <div className="space-y-6">
      {/* 1. En-tête & Actions globales */}
      <div className="p-6 rounded-3xl bg-linear-to-r from-purple-900/90 via-indigo-900/90 to-slate-900 text-white shadow-xl relative overflow-hidden border border-purple-500/30">
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="p-2 rounded-xl bg-purple-500/20 text-purple-300 border border-purple-400/30">
                <Cpu className="w-5 h-5" />
              </span>
              <h2 className="text-base font-black tracking-wide uppercase">
                Gestionnaire d'Émulateurs Arcade
              </h2>
            </div>
            <p className="text-xs text-purple-200/80 max-w-xl">
              Téléchargement officiel en 1 clic, extraction automatique sans interface Windows, et auto-détection par simple glisser-déposer dans <code className="bg-black/30 px-1 py-0.5 rounded text-purple-300">emulators/</code>.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={handleDownloadAll}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-white text-xs font-black shadow-lg shadow-emerald-500/20 transition-all hover:scale-105 active:scale-95"
            >
              <Sparkles className="w-4 h-4" />
              Tout installer en 1 clic
            </button>

            <button
              onClick={handleScan}
              disabled={scanning}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-white text-xs font-bold border border-white/20 transition-all"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${scanning ? 'animate-spin' : ''}`} />
              Scanner
            </button>

            <button
              onClick={() => openEmulatorsFolder()}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-white text-xs font-bold border border-white/20 transition-all"
            >
              <FolderOpen className="w-3.5 h-3.5" />
              Dossier
            </button>
          </div>
        </div>

        {feedbackMessage && (
          <div className="mt-4 p-2.5 rounded-xl bg-purple-950/80 border border-purple-400/30 text-xs text-purple-200 flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-purple-400 shrink-0" />
            <span>{feedbackMessage}</span>
          </div>
        )}
      </div>

      {/* 2. Liste des Cartes d'Émulateurs */}
      <div className="space-y-4">
        {loading ? (
          <div className="p-12 text-center text-slate-400 space-y-2">
            <Loader2 className="w-6 h-6 animate-spin mx-auto text-purple-500" />
            <p className="text-xs font-bold">Inspection des dossiers et émulateurs...</p>
          </div>
        ) : (
          catalog.map((emu) => {
            const isDownloading = !!downloadingIds[emu.id];
            const downloadProgress = downloadingIds[emu.id];
            const isExpanded = !!expandedIds[emu.id];
            const testStatus = testResults[emu.id];
            const currentPath = customPaths[emu.id] || emu.installed_path || emu.default_exe;
            const currentArgs = customArgs[emu.id] || emu.default_args;

            return (
              <div
                key={emu.id}
                className={`p-5 rounded-3xl border transition-all ${
                  emu.is_installed
                    ? 'bg-white border-purple-100 shadow-xs'
                    : 'bg-slate-50/70 border-slate-200/80'
                }`}
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  {/* Titre, badges, consoles */}
                  <div className="space-y-1.5">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="text-sm font-black text-slate-900">{emu.name}</h3>

                      {/* Badge de statut */}
                      {isDownloading ? (
                        <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-amber-50 text-amber-700 border border-amber-200 flex items-center gap-1 animate-pulse">
                          <Loader2 className="w-3 h-3 animate-spin" />
                          {downloadProgress.status} ({downloadProgress.percent}%)
                        </span>
                      ) : emu.is_installed ? (
                        <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-emerald-50 text-emerald-700 border border-emerald-200 flex items-center gap-1">
                          <Check className="w-3 h-3" />
                          Installé & Prêt
                        </span>
                      ) : (
                        <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-slate-100 text-slate-500 border border-slate-200">
                          Non installé
                        </span>
                      )}
                    </div>

                    <p className="text-xs text-slate-500 leading-relaxed max-w-2xl">
                      {emu.description}
                    </p>

                    {/* Consoles prises en charge */}
                    <div className="flex items-center gap-1 flex-wrap pt-1">
                      <span className="text-[10px] uppercase font-bold text-slate-400 mr-1">Consoles :</span>
                      {emu.systems.map((sys) => (
                        <span
                          key={sys}
                          className="px-2 py-0.5 rounded-md text-[10px] font-black uppercase bg-purple-50 text-purple-700 border border-purple-100"
                        >
                          {sys}
                        </span>
                      ))}
                    </div>
                  </div>

                  {/* Boutons d'action */}
                  <div className="flex items-center gap-2 shrink-0">
                    {emu.download_url && (
                      <button
                        onClick={() => handleDownload(emu.id)}
                        disabled={isDownloading}
                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-black transition-all ${
                          emu.is_installed
                            ? 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                            : 'bg-purple-600 hover:bg-purple-500 text-white shadow-md shadow-purple-500/20'
                        } disabled:opacity-50`}
                      >
                        <Download className="w-3.5 h-3.5" />
                        {emu.is_installed ? 'Réinstaller' : 'Télécharger & Configurer'}
                      </button>
                    )}

                    <button
                      onClick={() => toggleExpand(emu.id)}
                      className="p-1.5 rounded-xl border border-slate-200 text-slate-500 hover:bg-slate-100 transition-all"
                      title="Options avancées"
                    >
                      {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                {/* Barre de progression pendant le téléchargement */}
                {isDownloading && (
                  <div className="mt-4 space-y-1.5">
                    <div className="w-full bg-slate-200 h-2 rounded-full overflow-hidden">
                      <div
                        className="bg-linear-to-r from-purple-500 to-indigo-600 h-full transition-all duration-300 rounded-full"
                        style={{ width: `${downloadProgress.percent}%` }}
                      />
                    </div>
                    <div className="flex justify-between text-[10px] text-slate-500 font-bold">
                      <span>{downloadProgress.status}</span>
                      <span>{downloadProgress.percent}%</span>
                    </div>
                  </div>
                )}

                {/* Détails et options avancées dépliables */}
                {isExpanded && (
                  <div className="mt-4 pt-4 border-t border-purple-100/60 space-y-3">
                    {emu.notes && (
                      <div className="p-3 rounded-xl bg-purple-50/50 border border-purple-100 text-xs text-purple-900 font-medium">
                        💡 {emu.notes}
                      </div>
                    )}

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                      <div>
                        <div className="flex items-center justify-between mb-1">
                          <label className="text-[10px] font-bold text-slate-500 uppercase">
                            Chemin de l'exécutable
                          </label>
                          <div className="flex items-center gap-1">
                            {testStatus !== undefined && (
                              <span
                                className={`text-[10px] font-bold px-1.5 py-0.2 rounded ${
                                  testStatus
                                    ? 'bg-emerald-50 text-emerald-700'
                                    : 'bg-rose-50 text-rose-700'
                                }`}
                              >
                                {testStatus ? 'OK' : 'Introuvable'}
                              </span>
                            )}
                            <button
                              onClick={() => handleTest(emu.id, currentPath)}
                              disabled={testingPath === emu.id}
                              className="text-[10px] text-purple-600 hover:underline font-bold"
                            >
                              Tester
                            </button>
                          </div>
                        </div>
                        <div className="flex gap-1.5">
                          <input
                            type="text"
                            value={currentPath}
                            onChange={(e) =>
                              setCustomPaths((prev) => ({ ...prev, [emu.id]: e.target.value }))
                            }
                            className="w-full text-xs font-mono p-2 rounded-xl border border-slate-200 bg-white text-slate-800"
                          />
                          <button
                            onClick={() => handleSavePath(emu.id)}
                            className="px-2.5 py-1 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-xs font-bold shrink-0"
                          >
                            Sauver
                          </button>
                        </div>
                      </div>

                      <div>
                        <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">
                          Arguments CLI par défaut
                        </label>
                        <input
                          type="text"
                          value={currentArgs}
                          onChange={(e) =>
                            setCustomArgs((prev) => ({ ...prev, [emu.id]: e.target.value }))
                          }
                          className="w-full text-xs font-mono p-2 rounded-xl border border-slate-200 bg-white text-slate-800"
                        />
                      </div>
                    </div>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* 3. Réglages des Répertoires Partagés */}
      <div className="p-5 rounded-3xl bg-white border border-purple-100 shadow-xs space-y-4">
        <div className="flex items-center gap-2">
          <Folder className="w-4 h-4 text-purple-600" />
          <h3 className="text-xs font-black uppercase tracking-wider text-slate-900">
            Dossiers Partagés (Cores, Sauvegardes, Captures d'écran)
          </h3>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
          <div>
            <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">
              Dossier des Cores RetroArch
            </label>
            <input
              type="text"
              placeholder="emulators/cores"
              value={settings.cores_dir || ''}
              onChange={(e) => updateSetting('cores_dir', e.target.value)}
              className="w-full text-xs font-mono p-2.5 rounded-xl border border-purple-100 bg-purple-50/20"
            />
          </div>

          <div>
            <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">
              Dossier des Sauvegardes (Saves)
            </label>
            <input
              type="text"
              placeholder="Par défaut: emulators/<Emu>/saves/"
              value={settings.saves_dir || ''}
              onChange={(e) => updateSetting('saves_dir', e.target.value)}
              className="w-full text-xs font-mono p-2.5 rounded-xl border border-purple-100 bg-purple-50/20"
            />
          </div>

          <div>
            <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">
              Dossier des Captures d'écran
            </label>
            <input
              type="text"
              placeholder="Par défaut: media/screenshots/"
              value={settings.screenshots_dir || ''}
              onChange={(e) => updateSetting('screenshots_dir', e.target.value)}
              className="w-full text-xs font-mono p-2.5 rounded-xl border border-purple-100 bg-purple-50/20"
            />
          </div>
        </div>
      </div>
    </div>
  );
};
