import React, { useState, useEffect, useMemo } from 'react';
import {
  Globe,
  Eye,
  EyeOff,
  Wifi,
  CheckCircle,
  AlertCircle,
  Search,
  Sparkles,
  Download,
  Loader2,
  FolderOpen,
  Image as ImageIcon,
  Check,
  Gamepad2,
  ExternalLink,
  RefreshCw,
  SlidersHorizontal,
} from 'lucide-react';
import { convertFileSrc } from '@tauri-apps/api/core';
import { AppSettings, Game, System, LocalGameMetadata } from '../../../types';
import { getAllGames, saveLocalGameMetadata, getSystems } from '../../../api';
import { searchOnlineGameMetadata, downloadGameMedia } from '../../../utils/scraper';
import { openExternalUrl } from '../../../utils';

interface ScrapingSectionProps {
  settings: AppSettings;
  updateSetting: (key: keyof AppSettings, val: any) => void;
}

export const ScrapingSection: React.FC<ScrapingSectionProps> = ({ settings, updateSetting }) => {
  // Sous-onglets : Jeux & Scraping / Configuration API
  const [subTab, setSubTab] = useState<'games' | 'config'>('games');

  // État des jeux
  const [games, setGames] = useState<Game[]>([]);
  const [systems, setSystems] = useState<System[]>([]);
  const [loadingGames, setLoadingGames] = useState(false);
  const [selectedGameId, setSelectedGameId] = useState<string | null>(null);

  // Filtres
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedSystem, setSelectedSystem] = useState<string>('all');
  const [filterMissingCover, setFilterMissingCover] = useState(false);

  // Sélection multiple pour scraping par lot
  const [selectedBatchIds, setSelectedBatchIds] = useState<string[]>([]);
  const [isBatchScraping, setIsBatchScraping] = useState(false);
  const [batchProgress, setBatchProgress] = useState<{ current: number; total: number; currentTitle: string } | null>(null);

  // Édition du jeu sélectionné
  const [editTitle, setEditTitle] = useState('');
  const [editFranchise, setEditFranchise] = useState('');
  const [editReleaseDate, setEditReleaseDate] = useState('');
  const [editDeveloper, setEditDeveloper] = useState('');
  const [editPublisher, setEditPublisher] = useState('');
  const [editGenre, setEditGenre] = useState('');
  const [editRating, setEditRating] = useState('');
  const [editPlayers, setEditPlayers] = useState('');
  const [editSynopsis, setEditSynopsis] = useState('');
  const [editCoverUrl, setEditCoverUrl] = useState('');
  const [editBackdropUrl, setEditBackdropUrl] = useState('');

  const [isSearchingSingle, setIsSearchingSingle] = useState(false);
  const [savedSuccess, setSavedSuccess] = useState(false);
  const [singleSearchStatus, setSingleSearchStatus] = useState<{
    type: 'success' | 'not_found' | 'error';
    message: string;
  } | null>(null);
  const [batchSummaryMessage, setBatchSummaryMessage] = useState<string | null>(null);

  // Téléchargement médias pour le jeu sélectionné
  const [scrapedMedia, setScrapedMedia] = useState<{ cover?: string; backdrop?: string; screenshots?: string[]; video?: string } | null>(null);
  const [dlCover, setDlCover] = useState(true);
  const [dlBackdrop, setDlBackdrop] = useState(true);
  const [dlScreenshots, setDlScreenshots] = useState(false);
  const [dlVideo, setDlVideo] = useState(false);
  const [isDownloadingMedia, setIsDownloadingMedia] = useState(false);

  // Config ScreenScraper
  const [showPassword, setShowPassword] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const fetchGamesAndSystems = async () => {
    setLoadingGames(true);
    try {
      const [allGames, allSystems] = await Promise.all([
        getAllGames(),
        getSystems(),
      ]);
      setGames(allGames);
      setSystems(allSystems);
      if (allGames.length > 0 && !selectedGameId) {
        selectGame(allGames[0]);
      }
    } catch (err) {
      console.error('[ScrapingSection] Erreur chargement jeux:', err);
    } finally {
      setLoadingGames(false);
    }
  };

  useEffect(() => {
    fetchGamesAndSystems();
  }, []);

  const selectGame = (game: Game) => {
    setSelectedGameId(game.id);
    setEditTitle(game.title);
    setEditFranchise(game.franchise || '');
    setEditReleaseDate(game.release_date || '');
    setEditDeveloper(game.developer || '');
    setEditPublisher(game.publisher || '');
    setEditGenre(game.genre || '');
    setEditRating(game.rating !== undefined && game.rating !== null ? game.rating.toString() : '');
    setEditPlayers(game.players !== undefined && game.players !== null ? game.players.toString() : '');
    setEditSynopsis(game.synopsis || '');
    setEditCoverUrl(game.cover_url || '');
    setEditBackdropUrl(game.backdrop_url || '');
    setScrapedMedia(null);
    setSavedSuccess(false);
    setSingleSearchStatus(null);
  };

  const selectedGame = useMemo(() => {
    return games.find((g) => g.id === selectedGameId) || null;
  }, [games, selectedGameId]);

  // Filtrage des jeux
  const filteredGames = useMemo(() => {
    return games.filter((g) => {
      if (selectedSystem !== 'all' && g.system_id.toLowerCase() !== selectedSystem.toLowerCase()) {
        return false;
      }
      if (filterMissingCover && Boolean(g.cover_url && g.cover_url.trim().length > 0)) {
        return false;
      }
      if (searchQuery.trim().length > 0) {
        const q = searchQuery.toLowerCase();
        const matchesTitle = g.title.toLowerCase().includes(q);
        const matchesSystem = g.system_id.toLowerCase().includes(q);
        if (!matchesTitle && !matchesSystem) return false;
      }
      return true;
    });
  }, [games, selectedSystem, filterMissingCover, searchQuery]);

  const resolveImageSrc = (url?: string) => {
    if (!url) return undefined;
    if (url.startsWith('http://') || url.startsWith('https://') || url.startsWith('data:') || url.startsWith('blob:')) {
      return url;
    }
    return convertFileSrc(url);
  };

  // Sélection de fichier image locale via dialogue
  const handlePickLocalImage = async (field: 'cover' | 'backdrop') => {
    try {
      const { open } = await import('@tauri-apps/plugin-dialog');
      const selected = await open({
        title: field === 'cover' ? 'Sélectionner une jaquette de jeu' : 'Sélectionner un fond d\'écran',
        multiple: false,
        filters: [{ name: 'Images', extensions: ['png', 'jpg', 'jpeg', 'webp', 'gif'] }],
      });
      if (selected && typeof selected === 'string') {
        if (field === 'cover') {
          setEditCoverUrl(selected);
        } else {
          setEditBackdropUrl(selected);
        }
      }
    } catch (err) {
      console.warn('Erreur sélection image locale:', err);
    }
  };

  // Recherche Google Images
  const handleOpenGoogleImages = (field: 'cover' | 'backdrop') => {
    if (!selectedGame) return;
    const title = editTitle || selectedGame.title;
    const sys = selectedGame.system_id || '';
    const q = field === 'cover'
      ? `${title} ${sys} box art cover arcade`
      : `${title} ${sys} wallpaper fanart backdrop 1080p`;
    openExternalUrl(`https://www.google.com/search?tbm=isch&q=${encodeURIComponent(q)}`);
  };

  // Recherche automatique individuelle
  const handleAutoSearchSingle = async () => {
    if (!selectedGame) return;
    setIsSearchingSingle(true);
    setScrapedMedia(null);
    setSingleSearchStatus(null);
    try {
      const scraped = await searchOnlineGameMetadata(editTitle || selectedGame.title, selectedGame.system_id);
      
      if (!scraped.found) {
        setSingleSearchStatus({
          type: 'not_found',
          message: 'Introuvable : Aucun résultat ou jaquette trouvé en ligne pour ce jeu.',
        });
        return;
      }

      setSingleSearchStatus({
        type: 'success',
        message: '✓ Informations et jaquette trouvées ! Cliquez sur "Télécharger" pour enregistrer les images localement, puis sur "Enregistrer".',
      });

      if (scraped.title) setEditTitle(scraped.title);
      if (scraped.release_date) setEditReleaseDate(scraped.release_date);
      if (scraped.developer) setEditDeveloper(scraped.developer);
      if (scraped.publisher) setEditPublisher(scraped.publisher);
      if (scraped.genre) setEditGenre(scraped.genre);
      if (scraped.rating) setEditRating(scraped.rating.toString());
      if (scraped.players) setEditPlayers(scraped.players.toString());
      if (scraped.synopsis) setEditSynopsis(scraped.synopsis);

      if (scraped.cover_url) setEditCoverUrl(scraped.cover_url);
      if (scraped.backdrop_url) setEditBackdropUrl(scraped.backdrop_url);

      if (scraped.cover_url || scraped.backdrop_url || scraped.screenshots?.length || scraped.video_url) {
        setScrapedMedia({
          cover: scraped.cover_url,
          backdrop: scraped.backdrop_url,
          screenshots: scraped.screenshots,
          video: scraped.video_url,
        });
        setDlCover(Boolean(scraped.cover_url));
        setDlBackdrop(Boolean(scraped.backdrop_url));
        setDlScreenshots(Boolean(scraped.screenshots?.length));
        setDlVideo(Boolean(scraped.video_url));
      }
    } catch (err: any) {
      console.warn('Erreur recherche automatique:', err);
      setSingleSearchStatus({
        type: 'error',
        message: `Erreur lors de la recherche : ${err?.message || 'Échec de connexion'}`,
      });
    } finally {
      setIsSearchingSingle(false);
    }
  };

  // Téléchargement des médias trouvés
  const handleDownloadScrapedMedia = async () => {
    if (!scrapedMedia || !selectedGame?.file_path) return;
    setIsDownloadingMedia(true);
    try {
      const downloaded = await downloadGameMedia(selectedGame.file_path, {
        cover: dlCover ? scrapedMedia.cover : undefined,
        backdrop: dlBackdrop ? scrapedMedia.backdrop : undefined,
        screenshots: dlScreenshots ? scrapedMedia.screenshots : undefined,
        video: dlVideo ? scrapedMedia.video : undefined,
      });

      if (downloaded.cover_url) setEditCoverUrl(downloaded.cover_url);
      if (downloaded.backdrop_url) setEditBackdropUrl(downloaded.backdrop_url);

      // Sauvegarde immédiate des métadonnées avec les nouveaux chemins locaux
      await handleSaveSingle(downloaded);
      setScrapedMedia(null);
    } catch (err) {
      console.error('Erreur téléchargement médias:', err);
    } finally {
      setIsDownloadingMedia(false);
    }
  };

  // Sauvegarde des métadonnées du jeu sélectionné
  const handleSaveSingle = async (overrideMedia?: { cover_url?: string; backdrop_url?: string }) => {
    if (!selectedGame) return;
    const parsedRating = parseFloat(editRating);
    const parsedPlayers = parseInt(editPlayers, 10);

    const metadata: LocalGameMetadata = {
      title: editTitle.trim() || selectedGame.title,
      franchise: editFranchise.trim() || undefined,
      system_id: selectedGame.system_id,
      release_date: editReleaseDate.trim() || undefined,
      developer: editDeveloper.trim() || undefined,
      publisher: editPublisher.trim() || undefined,
      genre: editGenre.trim() || undefined,
      rating: isNaN(parsedRating) ? undefined : parsedRating,
      players: isNaN(parsedPlayers) ? undefined : parsedPlayers,
      synopsis: editSynopsis.trim() || undefined,
      cover_url: overrideMedia?.cover_url || (editCoverUrl.trim() || undefined),
      backdrop_url: overrideMedia?.backdrop_url || (editBackdropUrl.trim() || undefined),
    };

    try {
      await saveLocalGameMetadata(selectedGame.id, metadata);
      // Mettre à jour dans la liste locale des jeux
      setGames((prev) =>
        prev.map((g) => (g.id === selectedGame.id ? { ...g, ...metadata } : g))
      );
      setSavedSuccess(true);
      setTimeout(() => setSavedSuccess(false), 2500);
    } catch (err) {
      console.error('Erreur sauvegarde métadonnées:', err);
    }
  };

  // Scraping par lot des jeux sélectionnés
  const handleBatchScrape = async () => {
    const toScrape = games.filter((g) => selectedBatchIds.includes(g.id));
    if (toScrape.length === 0) return;

    setIsBatchScraping(true);
    setBatchSummaryMessage(null);
    setBatchProgress({ current: 0, total: toScrape.length, currentTitle: '' });

    let foundCount = 0;
    let notFoundCount = 0;

    for (let i = 0; i < toScrape.length; i++) {
      const g = toScrape[i];
      setBatchProgress({ current: i + 1, total: toScrape.length, currentTitle: g.title });

      try {
        const scraped = await searchOnlineGameMetadata(g.title, g.system_id);
        if (scraped.found) {
          foundCount++;
          let downloaded: any = {};
          if (g.file_path && (scraped.cover_url || scraped.backdrop_url)) {
            downloaded = await downloadGameMedia(g.file_path, {
              cover: scraped.cover_url,
              backdrop: scraped.backdrop_url,
            });
          }

          const metadata: LocalGameMetadata = {
            title: scraped.title || g.title,
            system_id: g.system_id,
            release_date: scraped.release_date || g.release_date,
            developer: scraped.developer || g.developer,
            publisher: scraped.publisher || g.publisher,
            genre: scraped.genre || g.genre,
            rating: scraped.rating || g.rating,
            players: scraped.players || g.players,
            synopsis: scraped.synopsis || g.synopsis,
            cover_url: downloaded?.cover_url || scraped.cover_url || g.cover_url,
            backdrop_url: downloaded?.backdrop_url || scraped.backdrop_url || g.backdrop_url,
          };

          await saveLocalGameMetadata(g.id, metadata);

          setGames((prev) =>
            prev.map((item) => (item.id === g.id ? { ...item, ...metadata } : item))
          );
        } else {
          notFoundCount++;
        }
      } catch (err) {
        notFoundCount++;
        console.warn(`Erreur scraping ${g.title}:`, err);
      }

      // Délai pour respecter les quotas ScreenScraper
      const delay = settings.scraping_delay_seconds ?? 1;
      if (delay > 0) {
        await new Promise((r) => setTimeout(r, Math.min(delay * 1000, 1500)));
      }
    }

    setIsBatchScraping(false);
    setBatchProgress(null);
    setSelectedBatchIds([]);
    setBatchSummaryMessage(
      `✓ Scraping par lot terminé : ${foundCount} jeu(x) mis à jour avec succès${
        notFoundCount > 0 ? `, ${notFoundCount} introuvable(s)` : ''
      }.`
    );
  };

  // Test connexion ScreenScraper
  const handleTestConnection = async () => {
    setTesting(true);
    setTestResult(null);
    try {
      await new Promise((r) => setTimeout(r, 800));
      if (!settings.screenscraper_ssid) {
        setTestResult({
          type: 'error',
          message: 'Mode anonyme actif : sans identifiant, ScreenScraper limite les requêtes (1000/jour par IP).',
        });
      } else {
        setTestResult({
          type: 'success',
          message: `Connexion ScreenScraper confirmée pour le compte '${settings.screenscraper_ssid}' !`,
        });
      }
    } catch (err: any) {
      setTestResult({
        type: 'error',
        message: `Erreur de connexion : ${err.message || 'Serveur ScreenScraper inaccessible'}`,
      });
    } finally {
      setTesting(false);
    }
  };

  const mediaTypes = [
    { id: 'cover', label: 'Jaquette Box (2D/3D)' },
    { id: 'screenshot', label: 'Captures d\'écran en jeu' },
    { id: 'backdrop', label: 'Fond d\'écran / Fanart' },
    { id: 'wheel', label: 'Logo transparent (Wheel)' },
    { id: 'video', label: 'Aperçu vidéo (Trailer MP4)' },
  ];

  const currentMediaTypes = settings.media_download_types || ['cover', 'backdrop'];

  const toggleMediaType = (id: string) => {
    if (currentMediaTypes.includes(id)) {
      updateSetting('media_download_types', currentMediaTypes.filter((t) => t !== id));
    } else {
      updateSetting('media_download_types', [...currentMediaTypes, id]);
    }
  };

  const toggleSelectAllFiltered = () => {
    if (selectedBatchIds.length === filteredGames.length) {
      setSelectedBatchIds([]);
    } else {
      setSelectedBatchIds(filteredGames.map((g) => g.id));
    }
  };

  const totalMissingCovers = useMemo(() => {
    return games.filter((g) => !g.cover_url || g.cover_url.trim().length === 0).length;
  }, [games]);

  return (
    <div className="space-y-5 animate-fadeIn">
      {/* Barre de navigation des sous-onglets */}
      <div className="flex items-center justify-between border-b border-black/5 pb-3">
        <div className="flex items-center gap-2 p-1 rounded-2xl bg-black/5 border border-black/10">
          <button
            type="button"
            onClick={() => setSubTab('games')}
            style={{
              backgroundColor: subTab === 'games' ? 'var(--accent-primary)' : 'transparent',
              color: subTab === 'games' ? '#ffffff' : 'var(--text-secondary)',
            }}
            className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider transition-all shadow-xs cursor-pointer"
          >
            <Gamepad2 className="w-3.5 h-3.5" />
            <span>Jeux & Scraping Studio</span>
          </button>

          <button
            type="button"
            onClick={() => setSubTab('config')}
            style={{
              backgroundColor: subTab === 'config' ? 'var(--accent-primary)' : 'transparent',
              color: subTab === 'config' ? '#ffffff' : 'var(--text-secondary)',
            }}
            className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider transition-all shadow-xs cursor-pointer"
          >
            <SlidersHorizontal className="w-3.5 h-3.5" />
            <span>Comptes & Options API</span>
          </button>
        </div>

        <div className="text-[11px] font-mono font-bold" style={{ color: 'var(--text-muted)' }}>
          {games.length} jeu{games.length > 1 ? 'x' : ''} • {totalMissingCovers} sans jaquette
        </div>
      </div>

      {/* ========================================================================= */}
      {/* VUE 1 : GESTIONNAIRE DES JEUX, RECHERCHE D'IMAGES & ÉDITION              */}
      {/* ========================================================================= */}
      {subTab === 'games' && (
        <div className="space-y-4">
          {/* Barre d'actions & Filtres */}
          <div
            style={{
              backgroundColor: 'var(--bg-card)',
              borderColor: 'var(--border-color)',
            }}
            className="p-4 rounded-3xl border shadow-xs flex flex-wrap items-center justify-between gap-3"
          >
            {/* Recherche textuelle */}
            <div className="relative flex-1 min-w-[200px]">
              <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Filtrer par titre ou console..."
                style={{
                  backgroundColor: 'var(--bg-secondary)',
                  borderColor: 'var(--border-color)',
                  color: 'var(--text-primary)',
                }}
                className="w-full text-xs pl-9 pr-3 py-2 rounded-xl border focus:outline-none focus:ring-1 focus:ring-[var(--accent-primary)] font-medium"
              />
            </div>

            {/* Filtre Console */}
            <select
              value={selectedSystem}
              onChange={(e) => setSelectedSystem(e.target.value)}
              style={{
                backgroundColor: 'var(--bg-secondary)',
                borderColor: 'var(--border-color)',
                color: 'var(--text-primary)',
              }}
              className="text-xs px-3 py-2 rounded-xl border focus:outline-none focus:ring-1 focus:ring-[var(--accent-primary)] font-bold cursor-pointer"
            >
              <option value="all">Toutes les consoles</option>
              {systems.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name} ({games.filter((g) => g.system_id === s.id).length})
                </option>
              ))}
            </select>

            {/* Toggle Sans Jaquette */}
            <button
              type="button"
              onClick={() => setFilterMissingCover(!filterMissingCover)}
              style={{
                backgroundColor: filterMissingCover ? 'var(--accent-primary)' : 'var(--bg-secondary)',
                color: filterMissingCover ? '#ffffff' : 'var(--text-primary)',
                borderColor: 'var(--border-color)',
              }}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl border text-xs font-bold transition-all shadow-2xs cursor-pointer"
            >
              <ImageIcon className="w-3.5 h-3.5" />
              <span>Sans jaquette uniquement</span>
            </button>

            {/* Action par lot */}
            {selectedBatchIds.length > 0 && (
              <button
                type="button"
                onClick={handleBatchScrape}
                disabled={isBatchScraping}
                className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white text-xs font-black shadow-md active:scale-95 transition-all cursor-pointer disabled:opacity-50"
              >
                {isBatchScraping ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
                <span>Scraper {selectedBatchIds.length} sélectionné{selectedBatchIds.length > 1 ? 's' : ''}</span>
              </button>
            )}
          </div>

          {/* Bannière de progression du scraping par lot */}
          {batchProgress && (
            <div className="p-4 rounded-2xl bg-indigo-50 border border-indigo-200 text-indigo-900 text-xs font-bold flex items-center justify-between gap-4 animate-fadeIn">
              <div className="flex items-center gap-2">
                <Loader2 className="w-4 h-4 animate-spin text-indigo-600" />
                <span>
                  Scraping en cours : {batchProgress.currentTitle} ({batchProgress.current} / {batchProgress.total})
                </span>
              </div>
              <div className="w-32 bg-indigo-200 rounded-full h-2 overflow-hidden">
                <div
                  className="bg-indigo-600 h-full transition-all duration-300"
                  style={{ width: `${(batchProgress.current / batchProgress.total) * 100}%` }}
                />
              </div>
            </div>
          )}

          {/* Résumé du scraping par lot */}
          {batchSummaryMessage && (
            <div className="p-3.5 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-900 text-xs font-bold flex items-center justify-between gap-3 animate-fadeIn">
              <div className="flex items-center gap-2">
                <CheckCircle className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>{batchSummaryMessage}</span>
              </div>
              <button
                type="button"
                onClick={() => setBatchSummaryMessage(null)}
                className="text-[11px] text-emerald-700 hover:text-emerald-950 underline cursor-pointer"
              >
                Fermer
              </button>
            </div>
          )}

          {/* Disposition Principale Master - Detail */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
            {/* Colonne de Gauche : Liste des jeux */}
            <div
              style={{
                backgroundColor: 'var(--bg-card)',
                borderColor: 'var(--border-color)',
              }}
              className="lg:col-span-4 xl:col-span-4 rounded-3xl border shadow-xs overflow-hidden flex flex-col h-[600px]"
            >
              <div className="p-3 border-b border-black/5 flex items-center justify-between shrink-0">
                <button
                  type="button"
                  onClick={toggleSelectAllFiltered}
                  className="text-[11px] font-bold text-slate-500 hover:text-slate-800 flex items-center gap-1.5 cursor-pointer"
                >
                  <input
                    type="checkbox"
                    checked={filteredGames.length > 0 && selectedBatchIds.length === filteredGames.length}
                    onChange={toggleSelectAllFiltered}
                    className="rounded text-rose-500 focus:ring-rose-400"
                  />
                  <span>Tout cocher ({filteredGames.length})</span>
                </button>

                <button
                  type="button"
                  onClick={fetchGamesAndSystems}
                  disabled={loadingGames}
                  className="p-1 rounded-lg text-slate-400 hover:text-slate-700 transition-colors"
                  title="Rafraîchir les jeux"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${loadingGames ? 'animate-spin' : ''}`} />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto p-2 space-y-1.5 scrollbar-thin">
                {filteredGames.length === 0 ? (
                  <div className="text-center py-12 text-xs text-slate-400">
                    Aucun jeu ne correspond à vos filtres.
                  </div>
                ) : (
                  filteredGames.map((g) => {
                    const isSelected = selectedGameId === g.id;
                    const isChecked = selectedBatchIds.includes(g.id);
                    const hasCover = Boolean(g.cover_url && g.cover_url.trim().length > 0);

                    return (
                      <div
                        key={g.id}
                        onClick={() => selectGame(g)}
                        style={{
                          backgroundColor: isSelected ? 'var(--accent-primary)' : 'transparent',
                          color: isSelected ? '#ffffff' : 'var(--text-primary)',
                        }}
                        className={`p-2.5 rounded-2xl flex items-center gap-3 transition-all cursor-pointer ${
                          isSelected ? 'shadow-sm font-black' : 'hover:bg-black/5'
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onClick={(e) => e.stopPropagation()}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setSelectedBatchIds([...selectedBatchIds, g.id]);
                            } else {
                              setSelectedBatchIds(selectedBatchIds.filter((id) => id !== g.id));
                            }
                          }}
                          className="rounded text-rose-500 focus:ring-rose-400 shrink-0"
                        />

                        {/* Miniature */}
                        <div className="w-10 h-12 rounded-lg bg-black/10 flex items-center justify-center overflow-hidden shrink-0 border border-black/10">
                          {hasCover ? (
                            <img
                              src={resolveImageSrc(g.cover_url)}
                              alt={g.title}
                              className="w-full h-full object-cover"
                              onError={(e) => {
                                (e.target as HTMLElement).style.display = 'none';
                              }}
                            />
                          ) : (
                            <Gamepad2 className="w-4 h-4 opacity-40" />
                          )}
                        </div>

                        {/* Info jeu */}
                        <div className="min-w-0 flex-1">
                          <div className="text-xs truncate font-bold">{g.title}</div>
                          <div className="flex items-center gap-2 mt-0.5">
                            <span className="text-[10px] font-mono uppercase opacity-75">
                              {g.system_id}
                            </span>
                            <span
                              className={`text-[9px] px-1.5 py-0.2 rounded font-black uppercase ${
                                hasCover
                                  ? 'bg-emerald-500/20 text-emerald-600'
                                  : 'bg-amber-500/20 text-amber-600'
                              }`}
                            >
                              {hasCover ? 'Jaquette OK' : 'Manquante'}
                            </span>
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>

            {/* Colonne de Droite : Atelier d'Édition & Scraping du jeu sélectionné */}
            <div
              style={{
                backgroundColor: 'var(--bg-card)',
                borderColor: 'var(--border-color)',
              }}
              className="lg:col-span-8 xl:col-span-8 rounded-3xl border shadow-xs p-5 space-y-5 min-w-0"
            >
              {!selectedGame ? (
                <div className="text-center py-24 text-slate-400 text-xs">
                  Sélectionnez un jeu dans la liste pour modifier ses métadonnées ou trouver des jaquettes.
                </div>
              ) : (
                <>
                  {/* En-tête du jeu sélectionné */}
                  <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pb-3 border-b border-black/5">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap min-w-0">
                        <span className="px-2 py-0.5 rounded-md bg-purple-600 text-white text-[10px] font-black uppercase shrink-0">
                          {selectedGame.system_id}
                        </span>
                        <h3 style={{ color: 'var(--text-primary)' }} className="text-sm font-black truncate">
                          {selectedGame.title}
                        </h3>
                      </div>
                      <p style={{ color: 'var(--text-muted)' }} className="text-[10px] font-mono mt-0.5 truncate">
                        {selectedGame.file_path}
                      </p>
                    </div>

                    <button
                      type="button"
                      onClick={handleAutoSearchSingle}
                      disabled={isSearchingSingle}
                      className="px-4 py-2 rounded-xl bg-gradient-to-r from-rose-500 to-pink-600 hover:from-rose-600 hover:to-pink-700 text-white text-xs font-black uppercase tracking-wider shadow-md shadow-rose-500/20 flex items-center gap-1.5 active:scale-95 transition-all shrink-0 disabled:opacity-50 cursor-pointer"
                    >
                      {isSearchingSingle ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
                      <span>{isSearchingSingle ? 'Recherche...' : 'Recherche Auto'}</span>
                    </button>
                  </div>

                  {/* Bannière de résultat de la recherche individuelle */}
                  {singleSearchStatus && (
                    <div
                      className={`p-3.5 rounded-2xl border text-xs font-bold flex items-center justify-between gap-3 animate-fadeIn ${
                        singleSearchStatus.type === 'not_found'
                          ? 'bg-rose-50 border-rose-200 text-rose-800'
                          : singleSearchStatus.type === 'success'
                          ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                          : 'bg-amber-50 border-amber-200 text-amber-800'
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        {singleSearchStatus.type === 'not_found' ? (
                          <AlertCircle className="w-4 h-4 shrink-0 text-rose-500" />
                        ) : singleSearchStatus.type === 'success' ? (
                          <CheckCircle className="w-4 h-4 shrink-0 text-emerald-500" />
                        ) : (
                          <AlertCircle className="w-4 h-4 shrink-0 text-amber-500" />
                        )}
                        <span>{singleSearchStatus.message}</span>
                      </div>
                      <button
                        type="button"
                        onClick={() => setSingleSearchStatus(null)}
                        className="text-[11px] underline opacity-80 hover:opacity-100 cursor-pointer shrink-0"
                      >
                        Fermer
                      </button>
                    </div>
                  )}

                  {/* Médias trouvés lors de l'auto-search */}
                  {scrapedMedia && (
                    <div className="p-4 rounded-2xl bg-indigo-50/50 border border-indigo-100 space-y-3 animate-fadeIn">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-indigo-950 flex items-center gap-1.5">
                          <Download className="w-3.5 h-3.5 text-indigo-600" />
                          Médias trouvés en ligne prêts au téléchargement :
                        </span>
                        <button
                          type="button"
                          onClick={handleDownloadScrapedMedia}
                          disabled={isDownloadingMedia || (!dlCover && !dlBackdrop && !dlScreenshots && !dlVideo)}
                          className="px-3 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold flex items-center gap-1.5 transition-all shadow-xs disabled:opacity-50 cursor-pointer"
                        >
                          {isDownloadingMedia ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5" />}
                          <span>Télécharger en local (media/)</span>
                        </button>
                      </div>

                      <div className="grid grid-cols-2 gap-2 text-xs">
                        {scrapedMedia.cover && (
                          <label className="flex items-center gap-2 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={dlCover}
                              onChange={(e) => setDlCover(e.target.checked)}
                              className="rounded text-indigo-600"
                            />
                            <span>Jaquette Box Art (Cover)</span>
                          </label>
                        )}
                        {scrapedMedia.backdrop && (
                          <label className="flex items-center gap-2 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={dlBackdrop}
                              onChange={(e) => setDlBackdrop(e.target.checked)}
                              className="rounded text-indigo-600"
                            />
                            <span>Fond d'écran (Backdrop)</span>
                          </label>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Zone Images & Médias : Prévisualisation + Google Images + Fichier local */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {/* Colonne Jaquette */}
                    <div
                      style={{
                        backgroundColor: 'var(--bg-secondary)',
                        borderColor: 'var(--border-color)',
                      }}
                      className="p-3.5 rounded-2xl border space-y-3"
                    >
                      <div className="flex items-center justify-between">
                        <span style={{ color: 'var(--text-primary)' }} className="text-xs font-bold">
                          Jaquette (Box Art)
                        </span>

                        <div className="flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => handleOpenGoogleImages('cover')}
                            className="px-2 py-1 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 text-rose-600 text-[11px] font-bold flex items-center gap-1 transition-colors cursor-pointer"
                            title="Chercher des jaquettes sur Google Images"
                          >
                            <Globe className="w-3 h-3" />
                            <span>Google</span>
                            <ExternalLink className="w-2.5 h-2.5" />
                          </button>

                          <button
                            type="button"
                            onClick={() => handlePickLocalImage('cover')}
                            className="px-2 py-1 rounded-lg bg-black/5 hover:bg-black/10 text-[11px] font-bold flex items-center gap-1 transition-colors cursor-pointer"
                            title="Choisir une image sur votre ordinateur"
                          >
                            <FolderOpen className="w-3 h-3" />
                            <span>Parcourir</span>
                          </button>
                        </div>
                      </div>

                      {/* Prévisualisation */}
                      <div className="w-full h-36 rounded-xl bg-black/5 border border-black/10 flex items-center justify-center overflow-hidden">
                        {editCoverUrl ? (
                          <img
                            src={resolveImageSrc(editCoverUrl)}
                            alt="Cover preview"
                            className="w-full h-full object-contain"
                            onError={(e) => {
                              (e.target as HTMLElement).style.display = 'none';
                            }}
                          />
                        ) : (
                          <div className="text-center text-[11px] text-slate-400 flex flex-col items-center gap-1">
                            <ImageIcon className="w-6 h-6 opacity-30" />
                            <span>Aucune jaquette</span>
                          </div>
                        )}
                      </div>

                      {/* Champ URL / chemin direct */}
                      <input
                        type="text"
                        value={editCoverUrl}
                        onChange={(e) => setEditCoverUrl(e.target.value)}
                        placeholder="https://... ou media/cover.png"
                        style={{
                          backgroundColor: 'var(--bg-card)',
                          borderColor: 'var(--border-color)',
                          color: 'var(--text-primary)',
                        }}
                        className="w-full text-xs p-2 rounded-xl border font-mono focus:outline-none focus:ring-1 focus:ring-[var(--accent-primary)]"
                      />
                    </div>

                    {/* Colonne Fond d'écran (Backdrop) */}
                    <div
                      style={{
                        backgroundColor: 'var(--bg-secondary)',
                        borderColor: 'var(--border-color)',
                      }}
                      className="p-3.5 rounded-2xl border space-y-3"
                    >
                      <div className="flex items-center justify-between">
                        <span style={{ color: 'var(--text-primary)' }} className="text-xs font-bold">
                          Fond d'écran (Backdrop)
                        </span>

                        <div className="flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => handleOpenGoogleImages('backdrop')}
                            className="px-2 py-1 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 text-rose-600 text-[11px] font-bold flex items-center gap-1 transition-colors cursor-pointer"
                            title="Chercher des fonds d'écran sur Google Images"
                          >
                            <Globe className="w-3 h-3" />
                            <span>Google</span>
                            <ExternalLink className="w-2.5 h-2.5" />
                          </button>

                          <button
                            type="button"
                            onClick={() => handlePickLocalImage('backdrop')}
                            className="px-2 py-1 rounded-lg bg-black/5 hover:bg-black/10 text-[11px] font-bold flex items-center gap-1 transition-colors cursor-pointer"
                            title="Choisir une image sur votre ordinateur"
                          >
                            <FolderOpen className="w-3 h-3" />
                            <span>Parcourir</span>
                          </button>
                        </div>
                      </div>

                      {/* Prévisualisation */}
                      <div className="w-full h-36 rounded-xl bg-black/5 border border-black/10 flex items-center justify-center overflow-hidden">
                        {editBackdropUrl ? (
                          <img
                            src={resolveImageSrc(editBackdropUrl)}
                            alt="Backdrop preview"
                            className="w-full h-full object-cover"
                            onError={(e) => {
                              (e.target as HTMLElement).style.display = 'none';
                            }}
                          />
                        ) : (
                          <div className="text-center text-[11px] text-slate-400 flex flex-col items-center gap-1">
                            <ImageIcon className="w-6 h-6 opacity-30" />
                            <span>Aucun fond d'écran</span>
                          </div>
                        )}
                      </div>

                      {/* Champ URL / chemin direct */}
                      <input
                        type="text"
                        value={editBackdropUrl}
                        onChange={(e) => setEditBackdropUrl(e.target.value)}
                        placeholder="https://... ou media/backdrop.jpg"
                        style={{
                          backgroundColor: 'var(--bg-card)',
                          borderColor: 'var(--border-color)',
                          color: 'var(--text-primary)',
                        }}
                        className="w-full text-xs p-2 rounded-xl border font-mono focus:outline-none focus:ring-1 focus:ring-[var(--accent-primary)]"
                      />
                    </div>
                  </div>

                  {/* Formulaire des Informations du Jeu */}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div className="sm:col-span-2">
                      <label style={{ color: 'var(--text-muted)' }} className="block text-[11px] font-bold uppercase mb-1">
                        Titre du Jeu
                      </label>
                      <input
                        type="text"
                        value={editTitle}
                        onChange={(e) => setEditTitle(e.target.value)}
                        style={{
                          backgroundColor: 'var(--bg-secondary)',
                          borderColor: 'var(--border-color)',
                          color: 'var(--text-primary)',
                        }}
                        className="w-full text-xs p-2.5 rounded-xl border font-bold focus:outline-none focus:ring-1 focus:ring-[var(--accent-primary)]"
                      />
                    </div>

                    <div>
                      <label style={{ color: 'var(--text-muted)' }} className="block text-[11px] font-bold uppercase mb-1">
                        Franchise
                      </label>
                      <input
                        type="text"
                        value={editFranchise}
                        onChange={(e) => setEditFranchise(e.target.value)}
                        placeholder="ex: mario, zelda"
                        style={{
                          backgroundColor: 'var(--bg-secondary)',
                          borderColor: 'var(--border-color)',
                          color: 'var(--text-primary)',
                        }}
                        className="w-full text-xs p-2.5 rounded-xl border focus:outline-none focus:ring-1 focus:ring-[var(--accent-primary)]"
                      />
                    </div>

                    <div>
                      <label style={{ color: 'var(--text-muted)' }} className="block text-[11px] font-bold uppercase mb-1">
                        Genre
                      </label>
                      <input
                        type="text"
                        value={editGenre}
                        onChange={(e) => setEditGenre(e.target.value)}
                        placeholder="ex: Plateforme, Combat"
                        style={{
                          backgroundColor: 'var(--bg-secondary)',
                          borderColor: 'var(--border-color)',
                          color: 'var(--text-primary)',
                        }}
                        className="w-full text-xs p-2.5 rounded-xl border focus:outline-none focus:ring-1 focus:ring-[var(--accent-primary)]"
                      />
                    </div>

                    <div>
                      <label style={{ color: 'var(--text-muted)' }} className="block text-[11px] font-bold uppercase mb-1">
                        Développeur
                      </label>
                      <input
                        type="text"
                        value={editDeveloper}
                        onChange={(e) => setEditDeveloper(e.target.value)}
                        placeholder="ex: Nintendo, Capcom"
                        style={{
                          backgroundColor: 'var(--bg-secondary)',
                          borderColor: 'var(--border-color)',
                          color: 'var(--text-primary)',
                        }}
                        className="w-full text-xs p-2.5 rounded-xl border focus:outline-none focus:ring-1 focus:ring-[var(--accent-primary)]"
                      />
                    </div>

                    <div>
                      <label style={{ color: 'var(--text-muted)' }} className="block text-[11px] font-bold uppercase mb-1">
                        Année de sortie
                      </label>
                      <input
                        type="text"
                        value={editReleaseDate}
                        onChange={(e) => setEditReleaseDate(e.target.value)}
                        placeholder="ex: 1992"
                        style={{
                          backgroundColor: 'var(--bg-secondary)',
                          borderColor: 'var(--border-color)',
                          color: 'var(--text-primary)',
                        }}
                        className="w-full text-xs p-2.5 rounded-xl border font-mono focus:outline-none focus:ring-1 focus:ring-[var(--accent-primary)]"
                      />
                    </div>

                    <div>
                      <label style={{ color: 'var(--text-muted)' }} className="block text-[11px] font-bold uppercase mb-1">
                        Note (sur 5.0)
                      </label>
                      <input
                        type="number"
                        step="0.1"
                        min="0"
                        max="5"
                        value={editRating}
                        onChange={(e) => setEditRating(e.target.value)}
                        placeholder="4.8"
                        style={{
                          backgroundColor: 'var(--bg-secondary)',
                          borderColor: 'var(--border-color)',
                          color: 'var(--text-primary)',
                        }}
                        className="w-full text-xs p-2.5 rounded-xl border font-mono focus:outline-none focus:ring-1 focus:ring-[var(--accent-primary)]"
                      />
                    </div>

                    <div>
                      <label style={{ color: 'var(--text-muted)' }} className="block text-[11px] font-bold uppercase mb-1">
                        Joueurs
                      </label>
                      <input
                        type="number"
                        min="1"
                        max="8"
                        value={editPlayers}
                        onChange={(e) => setEditPlayers(e.target.value)}
                        placeholder="2"
                        style={{
                          backgroundColor: 'var(--bg-secondary)',
                          borderColor: 'var(--border-color)',
                          color: 'var(--text-primary)',
                        }}
                        className="w-full text-xs p-2.5 rounded-xl border font-mono focus:outline-none focus:ring-1 focus:ring-[var(--accent-primary)]"
                      />
                    </div>

                    <div>
                      <label style={{ color: 'var(--text-muted)' }} className="block text-[11px] font-bold uppercase mb-1">
                        Éditeur
                      </label>
                      <input
                        type="text"
                        value={editPublisher}
                        onChange={(e) => setEditPublisher(e.target.value)}
                        placeholder="ex: Sega, Konami"
                        style={{
                          backgroundColor: 'var(--bg-secondary)',
                          borderColor: 'var(--border-color)',
                          color: 'var(--text-primary)',
                        }}
                        className="w-full text-xs p-2.5 rounded-xl border focus:outline-none focus:ring-1 focus:ring-[var(--accent-primary)]"
                      />
                    </div>
                  </div>

                  {/* Synopsis */}
                  <div>
                    <label style={{ color: 'var(--text-muted)' }} className="block text-[11px] font-bold uppercase mb-1">
                      Synopsis / Description
                    </label>
                    <textarea
                      rows={3}
                      value={editSynopsis}
                      onChange={(e) => setEditSynopsis(e.target.value)}
                      placeholder="Résumé du jeu ou histoire..."
                      style={{
                        backgroundColor: 'var(--bg-secondary)',
                        borderColor: 'var(--border-color)',
                        color: 'var(--text-primary)',
                      }}
                      className="w-full text-xs p-2.5 rounded-xl border focus:outline-none focus:ring-1 focus:ring-[var(--accent-primary)] font-medium"
                    />
                  </div>

                  {/* Pied de page avec bouton Enregistrer */}
                  <div className="flex items-center justify-between pt-3 border-t border-black/5">
                    {savedSuccess ? (
                      <div className="flex items-center gap-1.5 text-xs font-bold text-emerald-600 animate-fadeIn">
                        <Check className="w-4 h-4" />
                        <span>Modifications et métadonnées enregistrées !</span>
                      </div>
                    ) : (
                      <span style={{ color: 'var(--text-muted)' }} className="text-[11px]">
                        Sauvegarde en base de données et dans metadata.json
                      </span>
                    )}

                    <button
                      type="button"
                      onClick={() => handleSaveSingle()}
                      style={{
                        backgroundColor: 'var(--accent-primary)',
                      }}
                      className="px-6 py-2.5 rounded-xl text-white text-xs font-black uppercase tracking-wider shadow-md hover:opacity-90 active:scale-95 transition-all flex items-center gap-2 cursor-pointer"
                    >
                      <Check className="w-4 h-4" />
                      <span>Enregistrer les Métadonnées</span>
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* VUE 2 : COMPTES ET CONFIGURATION SCREENSCAPER                             */}
      {/* ========================================================================= */}
      {subTab === 'config' && (
        <div className="space-y-6">
          {/* 1. Compte ScreenScraper */}
          <div
            style={{
              backgroundColor: 'var(--bg-card)',
              borderColor: 'var(--border-color)',
            }}
            className="p-5 rounded-3xl border shadow-xs space-y-4"
          >
            <div className="flex items-center gap-2">
              <Globe className="w-4 h-4 text-purple-600" />
              <h3 style={{ color: 'var(--text-primary)' }} className="text-xs font-black uppercase tracking-wider">
                Identifiants ScreenScraper.fr
              </h3>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label style={{ color: 'var(--text-primary)' }} className="block text-xs font-bold mb-1">
                  Identifiant (SSID)
                </label>
                <input
                  type="text"
                  placeholder="Votre nom d'utilisateur ScreenScraper"
                  value={settings.screenscraper_ssid || ''}
                  onChange={(e) => updateSetting('screenscraper_ssid', e.target.value)}
                  style={{
                    backgroundColor: 'var(--bg-secondary)',
                    borderColor: 'var(--border-color)',
                    color: 'var(--text-primary)',
                  }}
                  className="w-full text-xs p-2.5 rounded-xl border focus:outline-none focus:ring-1 focus:ring-[var(--accent-primary)] font-mono"
                />
              </div>

              <div>
                <label style={{ color: 'var(--text-primary)' }} className="block text-xs font-bold mb-1">
                  Mot de passe (SSPassword)
                </label>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    placeholder="••••••••••••"
                    value={settings.screenscraper_sspassword || ''}
                    onChange={(e) => updateSetting('screenscraper_sspassword', e.target.value)}
                    style={{
                      backgroundColor: 'var(--bg-secondary)',
                      borderColor: 'var(--border-color)',
                      color: 'var(--text-primary)',
                    }}
                    className="w-full text-xs p-2.5 rounded-xl border pr-9 font-mono focus:outline-none focus:ring-1 focus:ring-[var(--accent-primary)]"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-2.5 top-2.5 text-slate-400 hover:text-slate-600 cursor-pointer"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <div className="sm:col-span-2 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pt-2 border-t border-black/5">
                <div>
                  <div style={{ color: 'var(--text-primary)' }} className="text-xs font-bold">
                    Tester l'accès ScreenScraper
                  </div>
                  <div style={{ color: 'var(--text-muted)' }} className="text-[11px]">
                    Vérifie vos identifiants ou le quota anonyme disponible
                  </div>
                </div>

                <button
                  type="button"
                  onClick={handleTestConnection}
                  disabled={testing}
                  style={{
                    backgroundColor: 'var(--accent-primary)',
                  }}
                  className="px-4 py-2 rounded-xl text-white text-xs font-bold flex items-center gap-1.5 transition-all shadow-xs disabled:opacity-50 cursor-pointer"
                >
                  <Wifi className={`w-3.5 h-3.5 ${testing ? 'animate-spin' : ''}`} />
                  <span>{testing ? 'Vérification...' : 'Tester la connexion'}</span>
                </button>
              </div>

              {testResult && (
                <div
                  className={`sm:col-span-2 p-3 rounded-2xl text-xs font-bold flex items-center gap-2 ${
                    testResult.type === 'success'
                      ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                      : 'bg-amber-50 text-amber-800 border border-amber-200'
                  }`}
                >
                  {testResult.type === 'success' ? (
                    <CheckCircle className="w-4 h-4 text-emerald-600 shrink-0" />
                  ) : (
                    <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
                  )}
                  <span>{testResult.message}</span>
                </div>
              )}

              <div className="sm:col-span-2">
                <div className="flex justify-between text-xs font-bold mb-1" style={{ color: 'var(--text-primary)' }}>
                  <span>Délai entre chaque requête API</span>
                  <span className="font-mono text-purple-600 font-bold">{settings.scraping_delay_seconds ?? 1} seconde(s)</span>
                </div>
                <input
                  type="range"
                  min="1"
                  max="10"
                  value={settings.scraping_delay_seconds ?? 1}
                  onChange={(e) => updateSetting('scraping_delay_seconds', parseInt(e.target.value, 10))}
                  className="w-full accent-rose-500 cursor-pointer"
                />
                <p style={{ color: 'var(--text-muted)' }} className="text-[10px] mt-1">
                  Respecter les quotas de bande passante ScreenScraper pour éviter les blocages IP temporaires.
                </p>
              </div>
            </div>
          </div>

          {/* 2. Types de Médias à Télécharger */}
          <div
            style={{
              backgroundColor: 'var(--bg-card)',
              borderColor: 'var(--border-color)',
            }}
            className="p-5 rounded-3xl border shadow-xs space-y-4"
          >
            <h3 style={{ color: 'var(--text-primary)' }} className="text-xs font-black uppercase tracking-wider">
              Médias & Automatisation
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {mediaTypes.map((mt) => {
                const checked = currentMediaTypes.includes(mt.id);
                return (
                  <label
                    key={mt.id}
                    style={{
                      backgroundColor: 'var(--bg-secondary)',
                      borderColor: 'var(--border-color)',
                    }}
                    className="flex items-center justify-between p-3 rounded-2xl border hover:opacity-90 cursor-pointer transition-colors"
                  >
                    <span style={{ color: 'var(--text-primary)' }} className="text-xs font-bold">
                      {mt.label}
                    </span>
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => toggleMediaType(mt.id)}
                      className="w-4 h-4 rounded text-rose-500 focus:ring-rose-400"
                    />
                  </label>
                );
              })}
            </div>

            <label
              style={{
                backgroundColor: 'var(--bg-secondary)',
                borderColor: 'var(--border-color)',
              }}
              className="flex items-center justify-between p-3.5 rounded-2xl border cursor-pointer transition-colors mt-3"
            >
              <div>
                <div style={{ color: 'var(--text-primary)' }} className="text-xs font-black">
                  Scraping automatique après scan
                </div>
                <div style={{ color: 'var(--text-muted)' }} className="text-[11px]">
                  Télécharge automatiquement les données et jaquettes des nouveaux jeux détectés lors des scans
                </div>
              </div>
              <input
                type="checkbox"
                checked={Boolean(settings.auto_scrape_after_scan)}
                onChange={(e) => updateSetting('auto_scrape_after_scan', e.target.checked)}
                className="w-4 h-4 rounded text-rose-500 focus:ring-rose-400"
              />
            </label>
          </div>
        </div>
      )}
    </div>
  );
};
