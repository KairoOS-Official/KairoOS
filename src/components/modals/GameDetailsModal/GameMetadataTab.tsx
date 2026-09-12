import React, { useState } from 'react';
import { Check, Search, Sparkles, Download, Loader2, Globe, ExternalLink, AlertCircle, CheckCircle } from 'lucide-react';
import { Game, LocalGameMetadata } from '../../../types';

import { searchOnlineGameMetadata, downloadGameMedia } from '../../../utils/scraper';
import { openExternalUrl } from '../../../utils';

interface GameMetadataTabProps {
  game: Game;
  onSaveMetadata: (gameId: string, metadata: LocalGameMetadata) => Promise<void>;
}

export const GameMetadataTab: React.FC<GameMetadataTabProps> = ({ game, onSaveMetadata }) => {
  const [metaTitle, setMetaTitle] = useState(game.title);
  const [metaFranchise, setMetaFranchise] = useState(game.franchise || '');
  const [metaReleaseDate, setMetaReleaseDate] = useState(game.release_date || '');
  const [metaDeveloper, setMetaDeveloper] = useState(game.developer || '');
  const [metaPublisher, setMetaPublisher] = useState(game.publisher || '');
  const [metaGenre, setMetaGenre] = useState(game.genre || '');
  const [metaRating, setMetaRating] = useState<string>(game.rating ? game.rating.toString() : '');
  const [metaPlayers, setMetaPlayers] = useState<string>(game.players ? game.players.toString() : '');
  const [metaSynopsis, setMetaSynopsis] = useState(game.synopsis || '');
  const [metaCoverUrl, setMetaCoverUrl] = useState(game.cover_url || '');
  const [metaBackdropUrl, setMetaBackdropUrl] = useState(game.backdrop_url || '');
  
  const [isSearching, setIsSearching] = useState(false);
  const [savedSuccess, setSavedSuccess] = useState(false);
  const [fetchStatus, setFetchStatus] = useState<{ type: 'success' | 'not_found' | 'error'; message: string } | null>(null);

  // Media download states
  const [scrapedMedia, setScrapedMedia] = useState<{ cover?: string; backdrop?: string; screenshots?: string[]; video?: string } | null>(null);
  const [dlCover, setDlCover] = useState(false);
  const [dlBackdrop, setDlBackdrop] = useState(false);
  const [dlScreenshots, setDlScreenshots] = useState(false);
  const [dlVideo, setDlVideo] = useState(false);
  const [isDownloadingMedia, setIsDownloadingMedia] = useState(false);

  const handleAutoFetch = async () => {
    setIsSearching(true);
    setScrapedMedia(null);
    setFetchStatus(null);
    try {
      const scraped = await searchOnlineGameMetadata(metaTitle || game.title, game.system_id);
      
      if (!scraped.found) {
        setFetchStatus({
          type: 'not_found',
          message: 'Introuvable : Aucun résultat ou jaquette trouvé en ligne pour ce jeu.',
        });
        return;
      }

      setFetchStatus({
        type: 'success',
        message: '✓ Informations et médias trouvés ! Vérifiez les champs et cliquez sur Enregistrer ci-dessous.',
      });

      if (scraped.title) setMetaTitle(scraped.title);
      if (scraped.release_date) setMetaReleaseDate(scraped.release_date);
      if (scraped.developer) setMetaDeveloper(scraped.developer);
      if (scraped.publisher) setMetaPublisher(scraped.publisher);
      if (scraped.genre) setMetaGenre(scraped.genre);
      if (scraped.rating) setMetaRating(scraped.rating.toString());
      if (scraped.players) setMetaPlayers(scraped.players.toString());
      if (scraped.synopsis) setMetaSynopsis(scraped.synopsis);
      if (scraped.cover_url) setMetaCoverUrl(scraped.cover_url);
      if (scraped.backdrop_url) setMetaBackdropUrl(scraped.backdrop_url);

      if (scraped.cover_url || scraped.backdrop_url || scraped.screenshots?.length || scraped.video_url) {
        setScrapedMedia({
          cover: scraped.cover_url,
          backdrop: scraped.backdrop_url,
          screenshots: scraped.screenshots,
          video: scraped.video_url,
        });
        setDlCover(!!scraped.cover_url);
        setDlBackdrop(!!scraped.backdrop_url);
        setDlScreenshots(!!scraped.screenshots?.length);
        setDlVideo(!!scraped.video_url);
      }
    } catch (err: any) {
      console.warn('Erreur auto scrape:', err);
      setFetchStatus({
        type: 'error',
        message: `Erreur lors de la recherche : ${err?.message || 'Échec réseau'}`,
      });
    } finally {
      setIsSearching(false);
    }
  };

  const saveMetadata = async (mediaUrls?: { cover_url?: string; backdrop_url?: string; screenshots?: string[]; video_url?: string }) => {
    const parsedRating = parseFloat(metaRating);
    const parsedPlayers = parseInt(metaPlayers, 10);

    const metadata: LocalGameMetadata = {
      title: metaTitle.trim() || game.title,
      franchise: metaFranchise.trim() ? metaFranchise.trim() : undefined,
      system_id: game.system_id,
      release_date: metaReleaseDate.trim() ? metaReleaseDate.trim() : undefined,
      developer: metaDeveloper.trim() ? metaDeveloper.trim() : undefined,
      publisher: metaPublisher.trim() ? metaPublisher.trim() : undefined,
      genre: metaGenre.trim() ? metaGenre.trim() : undefined,
      rating: isNaN(parsedRating) ? undefined : parsedRating,
      players: isNaN(parsedPlayers) ? undefined : parsedPlayers,
      synopsis: metaSynopsis.trim() ? metaSynopsis.trim() : undefined,
      cover_url: mediaUrls?.cover_url || (metaCoverUrl.trim() ? metaCoverUrl.trim() : game.cover_url),
      backdrop_url: mediaUrls?.backdrop_url || (metaBackdropUrl.trim() ? metaBackdropUrl.trim() : game.backdrop_url),
      screenshots: mediaUrls?.screenshots,
      video_url: mediaUrls?.video_url,
    };

    await onSaveMetadata(game.id, metadata);
    setSavedSuccess(true);
    setTimeout(() => setSavedSuccess(false), 2000);
  };

  const handleSave = async () => {
    await saveMetadata();
  };

  const handleDownloadMedia = async () => {
    if (!scrapedMedia || !game.file_path) return;
    setIsDownloadingMedia(true);
    try {
      const downloaded = await downloadGameMedia(game.file_path, {
        cover: dlCover ? scrapedMedia.cover : undefined,
        backdrop: dlBackdrop ? scrapedMedia.backdrop : undefined,
        screenshots: dlScreenshots ? scrapedMedia.screenshots : undefined,
        video: dlVideo ? scrapedMedia.video : undefined,
      });
      await saveMetadata(downloaded);
      setScrapedMedia(null); // hide media download panel after successful download
    } catch (err) {
      console.error("Erreur lors du téléchargement des médias:", err);
    } finally {
      setIsDownloadingMedia(false);
    }
  };

  return (
    <div className="space-y-5 max-w-3xl">
      {/* 1. Bloc de Recherche Automatique */}
      <div className="p-4 rounded-2xl bg-gradient-to-r from-purple-50 to-pink-50 border border-purple-100 flex flex-col sm:flex-row items-center justify-between gap-3 shadow-xs">
        <div className="text-xs">
          <span className="font-bold text-slate-900 flex items-center gap-1.5">
            <Sparkles className="w-4 h-4 text-rose-500" />
            Actualiser automatiquement les informations
          </span>
          <span className="text-[11px] text-slate-500">
            Recherche en ligne le titre officiel, l'année, le développeur, le genre, la description et les médias.
          </span>
        </div>

        <button
          type="button"
          onClick={handleAutoFetch}
          disabled={isSearching}
          className="px-4 py-2 rounded-xl bg-gradient-to-r from-rose-500 to-pink-600 hover:from-rose-600 hover:to-pink-700 text-white text-xs font-black uppercase tracking-wider shadow-md shadow-rose-500/20 flex items-center gap-1.5 active:scale-95 transition-all shrink-0 disabled:opacity-50"
        >
          {isSearching ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Search className="w-3.5 h-3.5" />}
          <span>{isSearching ? 'Recherche...' : 'Rechercher Infos'}</span>
        </button>
      </div>

      {/* Bannière de résultat de recherche */}
      {fetchStatus && (
        <div
          className={`p-3.5 rounded-2xl border text-xs font-bold flex items-center gap-2.5 transition-all ${
            fetchStatus.type === 'not_found'
              ? 'bg-rose-50 border-rose-200 text-rose-800'
              : fetchStatus.type === 'success'
              ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
              : 'bg-amber-50 border-amber-200 text-amber-800'
          }`}
        >
          {fetchStatus.type === 'not_found' ? (
            <AlertCircle className="w-4 h-4 shrink-0 text-rose-500" />
          ) : fetchStatus.type === 'success' ? (
            <CheckCircle className="w-4 h-4 shrink-0 text-emerald-500" />
          ) : (
            <AlertCircle className="w-4 h-4 shrink-0 text-amber-500" />
          )}
          <span>{fetchStatus.message}</span>
        </div>
      )}

      {scrapedMedia && (
        <div className="p-4 rounded-2xl bg-white border border-indigo-100 shadow-sm space-y-3">
          <h4 className="text-xs font-bold text-indigo-900 flex items-center gap-1.5">
            <Download className="w-4 h-4 text-indigo-500" />
            Médias trouvés
          </h4>
          <div className="grid grid-cols-2 gap-2 text-xs">
            {scrapedMedia.cover && (
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={dlCover} onChange={(e) => setDlCover(e.target.checked)} className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500" />
                <span>Télécharger la jaquette (cover)</span>
              </label>
            )}
            {scrapedMedia.backdrop && (
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={dlBackdrop} onChange={(e) => setDlBackdrop(e.target.checked)} className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500" />
                <span>Télécharger le backdrop</span>
              </label>
            )}
            {scrapedMedia.screenshots && scrapedMedia.screenshots.length > 0 && (
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={dlScreenshots} onChange={(e) => setDlScreenshots(e.target.checked)} className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500" />
                <span>Télécharger les captures d'écran</span>
              </label>
            )}
            {scrapedMedia.video && (
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={dlVideo} onChange={(e) => setDlVideo(e.target.checked)} className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500" />
                <span>Télécharger la vidéo</span>
              </label>
            )}
          </div>
          <div className="pt-2">
            <button
              type="button"
              onClick={handleDownloadMedia}
              disabled={isDownloadingMedia || (!dlCover && !dlBackdrop && !dlScreenshots && !dlVideo)}
              className="w-full px-4 py-2 rounded-xl bg-indigo-50 hover:bg-indigo-100 text-indigo-700 text-xs font-bold uppercase tracking-wider flex items-center justify-center gap-2 transition-colors disabled:opacity-50"
            >
              {isDownloadingMedia ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
              <span>{isDownloadingMedia ? 'Téléchargement en cours...' : 'Télécharger les médias sélectionnés'}</span>
            </button>
          </div>
        </div>
      )}

      <div className="p-3.5 rounded-2xl bg-amber-50 border border-amber-200 text-amber-900 text-xs leading-relaxed">
        💾 L'enregistrement créera ou mettra à jour directement le fichier{' '}
        <code className="font-mono font-bold">.json</code> adjacent à votre ROM pour une portabilité 100% autonome.
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1">
            Titre du Jeu
          </label>
          <input
            type="text"
            value={metaTitle}
            onChange={(e) => setMetaTitle(e.target.value)}
            className="w-full px-3.5 py-2 rounded-xl bg-white border border-purple-100 text-xs font-bold text-slate-800 focus:outline-none focus:border-rose-500 shadow-xs"
          />
        </div>

        <div>
          <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1">
            Franchise / Saga
          </label>
          <input
            type="text"
            value={metaFranchise}
            onChange={(e) => setMetaFranchise(e.target.value)}
            placeholder="ex: Super Mario, Zelda, Sonic..."
            className="w-full px-3.5 py-2 rounded-xl bg-white border border-purple-100 text-xs font-bold text-slate-800 focus:outline-none focus:border-rose-500 shadow-xs"
          />
        </div>

        <div>
          <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1">
            Date de Sortie (YYYY ou YYYY-MM-DD)
          </label>
          <input
            type="text"
            value={metaReleaseDate}
            onChange={(e) => setMetaReleaseDate(e.target.value)}
            placeholder="ex: 1991-11-21"
            className="w-full px-3.5 py-2 rounded-xl bg-white border border-purple-100 text-xs font-mono text-slate-800 focus:outline-none focus:border-rose-500 shadow-xs"
          />
        </div>

        <div>
          <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1">
            Genre / Type de Jeu
          </label>
          <input
            type="text"
            value={metaGenre}
            onChange={(e) => setMetaGenre(e.target.value)}
            placeholder="ex: Plateforme, Combat, RPG..."
            className="w-full px-3.5 py-2 rounded-xl bg-white border border-purple-100 text-xs font-bold text-slate-800 focus:outline-none focus:border-rose-500 shadow-xs"
          />
        </div>

        <div>
          <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1">
            Développeur
          </label>
          <input
            type="text"
            value={metaDeveloper}
            onChange={(e) => setMetaDeveloper(e.target.value)}
            placeholder="ex: Capcom, Nintendo EAD, Konami"
            className="w-full px-3.5 py-2 rounded-xl bg-white border border-purple-100 text-xs text-slate-800 focus:outline-none focus:border-rose-500 shadow-xs"
          />
        </div>

        <div>
          <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1">
            Éditeur
          </label>
          <input
            type="text"
            value={metaPublisher}
            onChange={(e) => setMetaPublisher(e.target.value)}
            placeholder="ex: Capcom, Sega, Nintendo"
            className="w-full px-3.5 py-2 rounded-xl bg-white border border-purple-100 text-xs text-slate-800 focus:outline-none focus:border-rose-500 shadow-xs"
          />
        </div>

        <div>
          <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1">
            Note (sur 5.0)
          </label>
          <input
            type="number"
            step="0.1"
            min="0"
            max="5"
            value={metaRating}
            onChange={(e) => setMetaRating(e.target.value)}
            placeholder="ex: 4.8"
            className="w-full px-3.5 py-2 rounded-xl bg-white border border-purple-100 text-xs font-mono text-slate-800 focus:outline-none focus:border-rose-500 shadow-xs"
          />
        </div>

        <div>
          <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1">
            Nombre de Joueurs
          </label>
          <input
            type="number"
            min="1"
            max="8"
            value={metaPlayers}
            onChange={(e) => setMetaPlayers(e.target.value)}
            placeholder="ex: 2"
            className="w-full px-3.5 py-2 rounded-xl bg-white border border-purple-100 text-xs font-mono text-slate-800 focus:outline-none focus:border-rose-500 shadow-xs"
          />
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <div className="flex items-center justify-between mb-1">
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-700">
              Jaquette (Cover URL ou chemin)
            </label>
            <button
              type="button"
              onClick={() => {
                const q = encodeURIComponent(`${metaTitle || game.title} ${game.system_id || ''} box art cover arcade`);
                openExternalUrl(`https://www.google.com/search?tbm=isch&q=${q}`);
              }}
              className="text-[11px] font-bold text-rose-500 hover:text-rose-600 flex items-center gap-1 cursor-pointer"
            >
              <Globe className="w-3 h-3" />
              <span>Google Images</span>
              <ExternalLink className="w-2.5 h-2.5" />
            </button>
          </div>
          <input
            type="text"
            value={metaCoverUrl}
            onChange={(e) => setMetaCoverUrl(e.target.value)}
            placeholder="https://... ou media/cover.png"
            className="w-full px-3.5 py-2 rounded-xl bg-white border border-purple-100 text-xs font-mono text-slate-800 focus:outline-none focus:border-rose-500 shadow-xs"
          />
        </div>

        <div>
          <div className="flex items-center justify-between mb-1">
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-700">
              Fond d'écran (Backdrop)
            </label>
            <button
              type="button"
              onClick={() => {
                const q = encodeURIComponent(`${metaTitle || game.title} ${game.system_id || ''} wallpaper backdrop`);
                openExternalUrl(`https://www.google.com/search?tbm=isch&q=${q}`);
              }}
              className="text-[11px] font-bold text-rose-500 hover:text-rose-600 flex items-center gap-1 cursor-pointer"
            >
              <Globe className="w-3 h-3" />
              <span>Google Images</span>
              <ExternalLink className="w-2.5 h-2.5" />
            </button>
          </div>
          <input
            type="text"
            value={metaBackdropUrl}
            onChange={(e) => setMetaBackdropUrl(e.target.value)}
            placeholder="https://... ou media/backdrop.jpg"
            className="w-full px-3.5 py-2 rounded-xl bg-white border border-purple-100 text-xs font-mono text-slate-800 focus:outline-none focus:border-rose-500 shadow-xs"
          />
        </div>
      </div>

      <div>
        <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1">
          Synopsis / Description
        </label>
        <textarea
          rows={3}
          value={metaSynopsis}
          onChange={(e) => setMetaSynopsis(e.target.value)}
          placeholder="Résumé ou histoire du jeu..."
          className="w-full px-3.5 py-2.5 rounded-xl bg-white border border-purple-100 text-xs font-sans text-slate-800 focus:outline-none focus:border-rose-500 shadow-xs"
        />
      </div>

      <div className="flex items-center justify-between pt-2">
        {savedSuccess ? (
          <div className="flex items-center gap-1.5 text-xs font-bold text-emerald-600">
            <Check className="w-4 h-4" />
            <span>Métadonnées enregistrées avec succès !</span>
          </div>
        ) : (
          <span className="text-[11px] text-slate-400">Fichier .json prêt à être mis à jour</span>
        )}

        <button
          type="button"
          onClick={handleSave}
          className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-rose-500 to-pink-600 hover:from-rose-600 hover:to-pink-700 text-white text-xs font-black uppercase tracking-wider shadow-md shadow-rose-500/20 active:scale-95 transition-all flex items-center gap-2"
        >
          <Check className="w-4 h-4" />
          <span>Enregistrer les Métadonnées</span>
        </button>
      </div>
    </div>
  );
};

