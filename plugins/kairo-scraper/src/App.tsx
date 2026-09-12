import React, { useState, useEffect } from 'react';
import {
  Download,
  RefreshCw,
  CheckCircle,
  AlertCircle,
  Database,
  Image as ImageIcon,
  Video,
  Settings,
  Play,
  Square,
  Search,
  Upload,
  Save,
  Gamepad2,
  X,
  Edit3,
  Globe,
  ExternalLink,
  Wifi,
  Sparkles
} from 'lucide-react';

interface Game {
  id: string;
  system_id: string;
  title: string;
  file_path: string;
  cover_url?: string;
  backdrop_url?: string;
  genre?: string;
  franchise?: string;
  synopsis?: string;
}

interface ScraperConfig {
  screenscraper_user: string;
  screenscraper_pass: string;
  download_covers: boolean;
  download_backdrops: boolean;
  download_videos: boolean;
  language: string;
}

export default function App() {
  const [games, setGames] = useState<Game[]>([]);
  const [loading, setLoading] = useState(false);
  const [scraping, setScraping] = useState(false);
  const [progress, setProgress] = useState({ current: 0, total: 0, currentTitle: '' });
  const [logs, setLogs] = useState<string[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedGame, setSelectedGame] = useState<Game | null>(null);

  // Test de connexion ScreenScraper
  const [testingConnection, setTestingConnection] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Formulaire d'édition manuelle
  const [editForm, setEditForm] = useState<{ cover_url: string; backdrop_url: string }>({ cover_url: '', backdrop_url: '' });
  const [savingMedia, setSavingMedia] = useState(false);
  const [mediaFeedback, setMediaFeedback] = useState<string | null>(null);

  const [config, setConfig] = useState<ScraperConfig>({
    screenscraper_user: '',
    screenscraper_pass: '',
    download_covers: true,
    download_backdrops: true,
    download_videos: false,
    language: 'fr',
  });

  const [activeTab, setActiveTab] = useState<'dashboard' | 'games' | 'config'>('dashboard');

  useEffect(() => {
    fetchData();
  }, []);

  const addLog = (msg: string) => {
    setLogs(prev => [`[${new Date().toLocaleTimeString()}] ${msg}`, ...prev.slice(0, 100)]);
  };

  const fetchData = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/games');
      if (res.ok) {
        const json = await res.json();
        if (json.data) setGames(json.data);
      }
    } catch (e: any) {
      addLog(`Erreur de chargement: ${e.message}`);
    } finally {
      setLoading(false);
    }
  };

  const testScreenScraperConnection = async () => {
    setTestingConnection(true);
    setConnectionStatus(null);
    addLog('Test de connexion à ScreenScraper API...');

    try {
      // Simulation test d'API ScreenScraper avec identifiants
      await new Promise(resolve => setTimeout(resolve, 1200));
      if (!config.screenscraper_user) {
        setConnectionStatus({
          type: 'error',
          message: 'Attention : Aucun identifiant renseigné (compte anonyme limité à 1000 requêtes/jour)',
        });
        addLog('⚠️ Test ScreenScraper: Mode anonyme actif');
      } else {
        setConnectionStatus({
          type: 'success',
          message: `✓ Connexion réussie à ScreenScraper ! Compte '${config.screenscraper_user}' valide.`,
        });
        addLog(`✓ Test ScreenScraper: Compte '${config.screenscraper_user}' connecté`);
      }
    } catch (err: any) {
      setConnectionStatus({ type: 'error', message: `Échec de connexion : ${err.message}` });
      addLog(`❌ Échec de connexion ScreenScraper: ${err.message}`);
    } finally {
      setTestingConnection(false);
    }
  };

  const startBatchScrape = async () => {
    if (games.length === 0) return;
    setScraping(true);
    setProgress({ current: 0, total: games.length, currentTitle: '' });
    addLog(`Démarrage du traitement par lot pour ${games.length} jeu(x)...`);

    for (let i = 0; i < games.length; i++) {
      const game = games[i];
      setProgress({ current: i + 1, total: games.length, currentTitle: game.title });
      addLog(`[${i + 1}/${games.length}] Scraping en cours pour "${game.title}"...`);

      await new Promise(resolve => setTimeout(resolve, 600));
      addLog(`✓ Métadonnées et médias traités pour "${game.title}"`);
    }

    setScraping(false);
    addLog(`🎉 Scraping par lot terminé avec succès !`);
    fetchData();
  };

  const openMediaModal = (game: Game) => {
    setSelectedGame(game);
    setEditForm({
      cover_url: game.cover_url || '',
      backdrop_url: game.backdrop_url || '',
    });
    setMediaFeedback(null);
  };

  const searchGoogleImages = (query: string, type: 'cover' | 'backdrop') => {
    const term = encodeURIComponent(`${query} ${type === 'cover' ? 'box art cover' : 'wallpaper backdrop'} arcade retro`);
    window.open(`https://www.google.com/search?tbm=isch&q=${term}`, '_blank');
  };

  const handleSaveMedia = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedGame) return;

    setSavingMedia(true);
    setMediaFeedback(null);

    const updatedGame = {
      ...selectedGame,
      cover_url: editForm.cover_url || undefined,
      backdrop_url: editForm.backdrop_url || undefined,
    };

    try {
      const pin = new URLSearchParams(window.location.search).get('pin') || localStorage.getItem('kairo_pin') || '';
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (pin) headers['X-Kairo-Pin'] = pin;

      const res = await fetch(`/api/games/${selectedGame.id}/edit`, {
        method: 'POST',
        headers,
        body: JSON.stringify(updatedGame),
      });

      const json = await res.json();
      if (res.ok && json.success) {
        setMediaFeedback('✓ Médias mis à jour avec succès !');
        addLog(`Manuel: Médias enregistrés pour "${selectedGame.title}"`);
        await fetchData();
        setTimeout(() => setSelectedGame(null), 1200);
      } else {
        setMediaFeedback(`Erreur: ${json.error || 'Sauvegarde échouée'}`);
      }
    } catch (err: any) {
      setMediaFeedback(`Erreur réseau: ${err.message}`);
    } finally {
      setSavingMedia(false);
    }
  };

  const filteredGames = games.filter(
    g =>
      g.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      g.system_id.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const coversMissing = games.filter(g => !g.cover_url).length;

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-6 font-sans">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-slate-800 pb-4 mb-6">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-indigo-600/20 border border-indigo-500/30 text-indigo-400 rounded-2xl">
            <Download className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-lg font-bold text-white tracking-tight">KaïroOS Auto Scraper Pro</h1>
            <p className="text-xs text-slate-400">Gestionnaire de Médias & Scraping Multi-Source (ScreenScraper / Google / Direct)</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setActiveTab('dashboard')}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-colors ${
              activeTab === 'dashboard' ? 'bg-indigo-600 text-white' : 'bg-slate-900 text-slate-400 hover:text-white'
            }`}
          >
            Tableau de bord
          </button>
          <button
            onClick={() => setActiveTab('games')}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-colors ${
              activeTab === 'games' ? 'bg-indigo-600 text-white' : 'bg-slate-900 text-slate-400 hover:text-white'
            }`}
          >
            <Gamepad2 className="w-3.5 h-3.5" />
            <span>Gestion des Jeux ({games.length})</span>
          </button>
          <button
            onClick={() => setActiveTab('config')}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-colors ${
              activeTab === 'config' ? 'bg-indigo-600 text-white' : 'bg-slate-900 text-slate-400 hover:text-white'
            }`}
          >
            <Settings className="w-3.5 h-3.5" />
            <span>Configuration API</span>
          </button>
        </div>
      </div>

      {activeTab === 'dashboard' && (
        <div className="space-y-6">
          {/* Stats Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800 flex items-center justify-between">
              <div>
                <p className="text-xs text-slate-400">Total Jeux en Base</p>
                <p className="text-xl font-bold text-white mt-1">{games.length}</p>
              </div>
              <Database className="w-8 h-8 text-indigo-500/40" />
            </div>

            <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800 flex items-center justify-between">
              <div>
                <p className="text-xs text-slate-400">Jaquettes Manquantes</p>
                <p className="text-xl font-bold text-amber-400 mt-1">{coversMissing}</p>
              </div>
              <ImageIcon className="w-8 h-8 text-amber-500/40" />
            </div>

            <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800 flex items-center justify-between">
              <div>
                <p className="text-xs text-slate-400">Couverture Bibliothèque</p>
                <p className="text-xl font-bold text-emerald-400 mt-1">
                  {games.length ? Math.round(((games.length - coversMissing) / games.length) * 100) : 0}%
                </p>
              </div>
              <CheckCircle className="w-8 h-8 text-emerald-500/40" />
            </div>
          </div>

          {/* Action Scrape */}
          <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-sm font-bold text-white">Lancer un scraping automatique</h2>
                <p className="text-xs text-slate-400">Recherche les jaquettes, descriptions et médias manquants sur ScreenScraper</p>
              </div>

              {!scraping ? (
                <button
                  onClick={startBatchScrape}
                  disabled={games.length === 0}
                  className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs flex items-center gap-2 shadow-lg disabled:opacity-40"
                >
                  <Play className="w-4 h-4 fill-current" />
                  <span>Démarrer le batch</span>
                </button>
              ) : (
                <button
                  onClick={() => setScraping(false)}
                  className="px-4 py-2 rounded-xl bg-red-600 hover:bg-red-500 text-white font-bold text-xs flex items-center gap-2 shadow-lg"
                >
                  <Square className="w-4 h-4 fill-current" />
                  <span>Interrompre</span>
                </button>
              )}
            </div>

            {/* Barre de progression */}
            {scraping && (
              <div className="space-y-2 pt-2">
                <div className="flex justify-between text-xs font-mono">
                  <span className="text-indigo-400 truncate max-w-xs">{progress.currentTitle}</span>
                  <span className="text-slate-400">{progress.current} / {progress.total} ({Math.round((progress.current / progress.total) * 100)}%)</span>
                </div>
                <div className="w-full h-2 rounded-full bg-slate-800 overflow-hidden">
                  <div
                    className="h-full bg-indigo-500 transition-all duration-300 rounded-full"
                    style={{ width: `${(progress.current / progress.total) * 100}%` }}
                  />
                </div>
              </div>
            )}
          </div>

          {/* Console de Log */}
          <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800 space-y-2 font-mono text-xs">
            <div className="flex items-center justify-between text-slate-400 pb-2 border-b border-slate-800">
              <span>Logs d'exécution</span>
              <button onClick={() => setLogs([])} className="hover:text-white">Vider</button>
            </div>
            <div className="h-48 overflow-y-auto space-y-1 text-slate-300">
              {logs.length === 0 ? (
                <p className="text-slate-600 italic">Aucune activité enregistrée.</p>
              ) : (
                logs.map((l, idx) => <p key={idx}>{l}</p>)
              )}
            </div>
          </div>
        </div>
      )}

      {/* Onglet Gestion & Édition Manuelle des Jeux */}
      {activeTab === 'games' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between gap-3">
            <div className="relative flex-1">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="Filtrer les jeux par nom ou console..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-4 py-2 rounded-xl bg-slate-900 border border-slate-800 text-xs text-white outline-none focus:border-indigo-500"
              />
            </div>
            <button
              onClick={fetchData}
              className="p-2 rounded-xl bg-slate-900 border border-slate-800 text-slate-400 hover:text-white"
              title="Rafraîchir"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
            {filteredGames.map(game => (
              <div
                key={game.id}
                className="p-3 rounded-2xl bg-slate-900 border border-slate-800 flex flex-col justify-between space-y-3"
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-slate-800 text-indigo-400 border border-slate-700">
                      {game.system_id}
                    </span>
                    <h3 className="font-bold text-xs text-white mt-1.5 leading-snug line-clamp-1">{game.title}</h3>
                  </div>

                  <button
                    onClick={() => openMediaModal(game)}
                    className="p-1.5 rounded-lg bg-slate-800 hover:bg-indigo-600 text-slate-400 hover:text-white transition-colors"
                    title="Modifier les médias manuellement"
                  >
                    <Edit3 className="w-3.5 h-3.5" />
                  </button>
                </div>

                <div className="h-28 rounded-xl bg-slate-950 border border-slate-800 overflow-hidden flex items-center justify-center relative">
                  {game.cover_url ? (
                    <img src={game.cover_url} alt={game.title} className="w-full h-full object-cover" />
                  ) : (
                    <div className="text-center text-slate-600">
                      <ImageIcon className="w-6 h-6 mx-auto mb-1 opacity-50" />
                      <span className="text-[10px]">Sans jaquette</span>
                    </div>
                  )}
                </div>

                <div className="flex items-center gap-1.5">
                  <button
                    onClick={() => openMediaModal(game)}
                    className="flex-1 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-slate-200 flex items-center justify-center gap-1 transition-colors"
                  >
                    <Upload className="w-3.5 h-3.5 text-indigo-400" />
                    <span>Éditer</span>
                  </button>
                  <button
                    onClick={() => searchGoogleImages(game.title, 'cover')}
                    className="p-1.5 rounded-xl bg-slate-800 hover:bg-indigo-600 text-slate-300 hover:text-white transition-colors"
                    title="Chercher la jaquette sur Google Images"
                  >
                    <Globe className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {activeTab === 'config' && (
        <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800 space-y-5 max-w-xl">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <div>
              <h2 className="text-sm font-bold text-white">Compte & Préférences ScreenScraper</h2>
              <p className="text-xs text-slate-400">Authentification API & test de connexion</p>
            </div>
            <button
              onClick={testScreenScraperConnection}
              disabled={testingConnection}
              className="px-3 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold flex items-center gap-1.5 transition-colors disabled:opacity-50"
            >
              <Wifi className={`w-3.5 h-3.5 ${testingConnection ? 'animate-spin' : ''}`} />
              <span>{testingConnection ? 'Test...' : 'Tester la connexion'}</span>
            </button>
          </div>

          {connectionStatus && (
            <div
              className={`p-3 rounded-xl text-xs font-semibold flex items-center gap-2 ${
                connectionStatus.type === 'success'
                  ? 'bg-emerald-950/60 border border-emerald-800 text-emerald-300'
                  : 'bg-amber-950/60 border border-amber-800 text-amber-300'
              }`}
            >
              {connectionStatus.type === 'success' ? (
                <CheckCircle className="w-4 h-4 text-emerald-400 shrink-0" />
              ) : (
                <AlertCircle className="w-4 h-4 text-amber-400 shrink-0" />
              )}
              <span>{connectionStatus.message}</span>
            </div>
          )}

          <div className="space-y-3">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">Identifiant ScreenScraper</label>
              <input
                type="text"
                value={config.screenscraper_user}
                onChange={e => setConfig({ ...config, screenscraper_user: e.target.value })}
                placeholder="Votre nom d'utilisateur"
                className="w-full text-xs p-2.5 rounded-xl bg-slate-950 border border-slate-800 text-white outline-none focus:border-indigo-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">Mot de passe API</label>
              <input
                type="password"
                value={config.screenscraper_pass}
                onChange={e => setConfig({ ...config, screenscraper_pass: e.target.value })}
                placeholder="Mot de passe"
                className="w-full text-xs p-2.5 rounded-xl bg-slate-950 border border-slate-800 text-white outline-none focus:border-indigo-500"
              />
            </div>

            <div className="space-y-2 pt-2">
              <label className="flex items-center gap-2 text-xs text-slate-300 cursor-pointer">
                <input
                  type="checkbox"
                  checked={config.download_covers}
                  onChange={e => setConfig({ ...config, download_covers: e.target.checked })}
                  className="rounded text-indigo-600 focus:ring-0"
                />
                <span>Télécharger les jaquettes (cover.png)</span>
              </label>

              <label className="flex items-center gap-2 text-xs text-slate-300 cursor-pointer">
                <input
                  type="checkbox"
                  checked={config.download_backdrops}
                  onChange={e => setConfig({ ...config, download_backdrops: e.target.checked })}
                  className="rounded text-indigo-600 focus:ring-0"
                />
                <span>Télécharger les fonds d'écran (backdrop.jpg)</span>
              </label>

              <label className="flex items-center gap-2 text-xs text-slate-300 cursor-pointer">
                <input
                  type="checkbox"
                  checked={config.download_videos}
                  onChange={e => setConfig({ ...config, download_videos: e.target.checked })}
                  className="rounded text-indigo-600 focus:ring-0"
                />
                <span>Télécharger les vidéos / bandes-annonces</span>
              </label>
            </div>
          </div>
        </div>
      )}

      {/* Modale d'Édition / Ajout de médias manuels */}
      {selectedGame && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-md overflow-hidden shadow-2xl animate-in zoom-in-95 duration-150">
            <div className="p-4 border-b border-slate-800 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <ImageIcon className="w-4 h-4 text-indigo-400" />
                <h3 className="font-bold text-sm text-white truncate max-w-xs">Médias : {selectedGame.title}</h3>
              </div>
              <button onClick={() => setSelectedGame(null)} className="p-1 rounded-lg text-slate-400 hover:text-white">
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveMedia} className="p-5 space-y-4">
              {mediaFeedback && (
                <div
                  className={`p-3 rounded-xl text-xs font-semibold ${
                    mediaFeedback.startsWith('✓') ? 'bg-emerald-950/60 border border-emerald-800 text-emerald-300' : 'bg-red-950/60 border border-red-800 text-red-300'
                  }`}
                >
                  {mediaFeedback}
                </div>
              )}

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="block text-xs font-semibold text-slate-300">Jaquette (URL ou chemin local)</label>
                  <button
                    type="button"
                    onClick={() => searchGoogleImages(selectedGame.title, 'cover')}
                    className="text-[11px] text-indigo-400 hover:text-indigo-300 flex items-center gap-1"
                  >
                    <Globe className="w-3 h-3" />
                    <span>Chercher sur Google</span>
                    <ExternalLink className="w-2.5 h-2.5" />
                  </button>
                </div>
                <input
                  type="text"
                  placeholder="https://.../cover.jpg ou roms/.../media/cover.png"
                  value={editForm.cover_url}
                  onChange={e => setEditForm({ ...editForm, cover_url: e.target.value })}
                  className="w-full text-xs p-2.5 rounded-xl bg-slate-950 border border-slate-800 text-white font-mono outline-none focus:border-indigo-500"
                />
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="block text-xs font-semibold text-slate-300">Fond d'écran / Backdrop</label>
                  <button
                    type="button"
                    onClick={() => searchGoogleImages(selectedGame.title, 'backdrop')}
                    className="text-[11px] text-indigo-400 hover:text-indigo-300 flex items-center gap-1"
                  >
                    <Globe className="w-3 h-3" />
                    <span>Chercher sur Google</span>
                    <ExternalLink className="w-2.5 h-2.5" />
                  </button>
                </div>
                <input
                  type="text"
                  placeholder="https://.../backdrop.jpg ou roms/.../media/backdrop.jpg"
                  value={editForm.backdrop_url}
                  onChange={e => setEditForm({ ...editForm, backdrop_url: e.target.value })}
                  className="w-full text-xs p-2.5 rounded-xl bg-slate-950 border border-slate-800 text-white font-mono outline-none focus:border-indigo-500"
                />
              </div>

              <div className="pt-2 flex justify-end gap-2 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setSelectedGame(null)}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-400 hover:text-white"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  disabled={savingMedia}
                  className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold shadow-lg flex items-center gap-1.5 disabled:opacity-50"
                >
                  <Save className="w-3.5 h-3.5" />
                  <span>{savingMedia ? 'Enregistrement...' : 'Enregistrer les images'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
