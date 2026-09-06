import React, { useState } from 'react';
import {
  Search,
  Gamepad2,
  Play,
  Star,
  Flame,
  Edit3,
  X,
  Save,
  Check,
  AlertCircle
} from 'lucide-react';
import { ThemeMode, Game, System, StatusResponse } from '../types';

interface GamesViewProps {
  games: Game[];
  systems: System[];
  status: StatusResponse | null;
  pin: string;
  onLaunchGame: (gameId: string) => Promise<void>;
  onToggleFavorite: (gameId: string) => Promise<void>;
  onReloadGames: () => Promise<void>;
  loading: boolean;
  theme: ThemeMode;
}

export const GamesView: React.FC<GamesViewProps> = ({
  games,
  systems,
  status,
  pin,
  onLaunchGame,
  onToggleFavorite,
  onReloadGames,
  loading,
  theme,
}) => {
  const isDark = theme === 'dark';
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedSystem, setSelectedSystem] = useState('all');
  const [favoritesOnly, setFavoritesOnly] = useState(false);
  const [editingGame, setEditingGame] = useState<Game | null>(null);
  const [savingEdit, setSavingEdit] = useState(false);
  const [editFeedback, setEditFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Filtrage
  const filteredGames = games.filter((game) => {
    const matchesSearch =
      !searchQuery ||
      game.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (game.franchise && game.franchise.toLowerCase().includes(searchQuery.toLowerCase())) ||
      (game.genre && game.genre.toLowerCase().includes(searchQuery.toLowerCase()));

    const matchesSystem = selectedSystem === 'all' || game.system_id === selectedSystem;
    const matchesFavorites = !favoritesOnly || game.favorite;

    return matchesSearch && matchesSystem && matchesFavorites;
  });

  const handleSaveGameEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingGame) return;

    setSavingEdit(true);
    setEditFeedback(null);

    try {
      const res = await fetch(`/api/games/${editingGame.id}/edit`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Kairo-Pin': pin,
        },
        body: JSON.stringify(editingGame),
      });

      const json = await res.json();
      if (res.ok && json.success) {
        setEditFeedback({ type: 'success', message: 'Fiche du jeu mise à jour !' });
        await onReloadGames();
        setTimeout(() => setEditingGame(null), 1000);
      } else {
        setEditFeedback({ type: 'error', message: json.error || 'Erreur lors de la sauvegarde' });
      }
    } catch (err: any) {
      setEditFeedback({ type: 'error', message: err.message });
    } finally {
      setSavingEdit(false);
    }
  };

  return (
    <div className="space-y-4 animate-in fade-in duration-150">
      {/* 1. Recherche & Filtres Propres */}
      <div
        className={`p-4 rounded-3xl border space-y-3 shadow-xs ${
          isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'
        }`}
      >
        <div className="flex flex-col sm:flex-row gap-3">
          {/* Champ Recherche */}
          <div className="relative flex-1">
            <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Rechercher par titre, genre, franchise..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className={`w-full pl-10 pr-4 py-2.5 rounded-xl text-xs border transition-all focus:outline-none ${
                isDark
                  ? 'bg-slate-800 border-slate-700 text-white placeholder-slate-500 focus:border-indigo-500'
                  : 'bg-slate-50 border-slate-200 text-slate-800 placeholder-slate-400 focus:border-indigo-500'
              }`}
            />
          </div>

          {/* Filtre Favoris */}
          <button
            onClick={() => setFavoritesOnly(!favoritesOnly)}
            className={`px-4 py-2 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 border transition-all shrink-0 ${
              favoritesOnly
                ? 'bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-400 border-amber-300 dark:border-amber-700'
                : isDark
                ? 'bg-slate-800 border-slate-700 text-slate-400 hover:text-white'
                : 'bg-slate-50 border-slate-200 text-slate-600 hover:text-slate-900'
            }`}
          >
            <Star className={`w-3.5 h-3.5 ${favoritesOnly ? 'fill-current text-amber-500' : ''}`} />
            <span>Favoris ({games.filter((g) => g.favorite).length})</span>
          </button>
        </div>

        {/* Pilules Consoles */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-thin">
          <button
            onClick={() => setSelectedSystem('all')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all ${
              selectedSystem === 'all'
                ? 'bg-indigo-600 text-white shadow-xs'
                : isDark
                ? 'bg-slate-800 text-slate-400 hover:text-white'
                : 'bg-slate-100 text-slate-600 hover:text-slate-900'
            }`}
          >
            Tous ({games.length})
          </button>

          {systems.map((sys) => {
            const count = games.filter((g) => g.system_id === sys.id).length;
            if (count === 0) return null;
            const isSelected = selectedSystem === sys.id;

            return (
              <button
                key={sys.id}
                onClick={() => setSelectedSystem(sys.id)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all ${
                  isSelected
                    ? 'bg-indigo-600 text-white shadow-xs'
                    : isDark
                    ? 'bg-slate-800 text-slate-400 hover:text-white'
                    : 'bg-slate-100 text-slate-600 hover:text-slate-900'
                }`}
              >
                {sys.short_name || sys.name} ({count})
              </button>
            );
          })}
        </div>
      </div>

      {/* 2. Grille des Jeux */}
      {filteredGames.length === 0 ? (
        <div
          className={`p-12 rounded-3xl border text-center space-y-2 ${
            isDark ? 'bg-slate-900 border-slate-800 text-slate-400' : 'bg-white border-slate-200 text-slate-500'
          }`}
        >
          <Gamepad2 className="w-8 h-8 mx-auto opacity-40" />
          <p className="text-xs font-medium">Aucun jeu trouvé.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {filteredGames.map((game) => {
            const isCurrent = status?.current_game_id === game.id;

            return (
              <div
                key={game.id}
                className={`p-4 rounded-3xl border flex flex-col justify-between transition-all shadow-xs ${
                  isCurrent
                    ? 'bg-emerald-50/50 dark:bg-emerald-950/20 border-emerald-400 ring-2 ring-emerald-200 dark:ring-emerald-900'
                    : isDark
                    ? 'bg-slate-900 border-slate-800 hover:border-slate-700'
                    : 'bg-white border-slate-200 hover:border-indigo-300'
                }`}
              >
                {/* En-tête de Carte */}
                <div className="flex items-center justify-between mb-3">
                  <span className="text-[10px] font-bold uppercase font-mono px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
                    {game.system_id}
                  </span>

                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => setEditingGame(game)}
                      title="Éditer la fiche du jeu"
                      className="p-1 rounded-lg border border-slate-200 hover:bg-slate-100 text-slate-500 hover:text-indigo-600 transition-all"
                    >
                      <Edit3 className="w-3.5 h-3.5" />
                    </button>

                    <button
                      onClick={() => onToggleFavorite(game.id)}
                      title={game.favorite ? 'Retirer des favoris' : 'Ajouter aux favoris'}
                      className={`p-1 rounded-lg border transition-all ${
                        game.favorite
                          ? 'bg-amber-50 text-amber-500 border-amber-200 dark:bg-amber-950/40 dark:border-amber-800'
                          : isDark
                          ? 'bg-slate-800 border-slate-700 text-slate-500 hover:text-amber-400'
                          : 'bg-slate-50 border-slate-200 text-slate-400 hover:text-amber-500'
                      }`}
                    >
                      <Star className={`w-3.5 h-3.5 ${game.favorite ? 'fill-current' : ''}`} />
                    </button>
                  </div>
                </div>

                {/* Jaquette & Titre */}
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-14 h-18 rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shrink-0 flex items-center justify-center overflow-hidden">
                    {game.cover_url ? (
                      <img src={game.cover_url} alt={game.title} className="w-full h-full object-cover" />
                    ) : (
                      <Gamepad2 className="w-6 h-6 text-slate-400" />
                    )}
                  </div>

                  <div className="min-w-0 flex-1 space-y-0.5">
                    <h3 className="font-bold text-xs text-slate-900 dark:text-white leading-snug line-clamp-2">
                      {game.title}
                    </h3>
                    {game.franchise && (
                      <p className="text-[11px] text-indigo-600 dark:text-indigo-400 font-medium truncate">
                        {game.franchise}
                      </p>
                    )}
                    {game.genre && (
                      <p className="text-[10px] text-slate-400 truncate">{game.genre}</p>
                    )}
                  </div>
                </div>

                {/* Bouton de Lancement */}
                {isCurrent ? (
                  <div className="w-full py-2 rounded-xl bg-emerald-500 text-white font-bold text-xs text-center flex items-center justify-center gap-1.5 shadow-xs">
                    <Flame className="w-3.5 h-3.5" />
                    <span>EN COURS DE JEU</span>
                  </div>
                ) : (
                  <button
                    onClick={() => onLaunchGame(game.id)}
                    disabled={loading || status?.is_running}
                    className="w-full py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-xs shadow-xs flex items-center justify-center gap-1.5 transition-all active:scale-95 disabled:opacity-40"
                  >
                    <Play className="w-3.5 h-3.5 fill-current" />
                    <span>Lancer sur la borne</span>
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Modale d'Édition Fiche du Jeu */}
      {editingGame && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl border border-slate-200 w-full max-w-lg overflow-hidden shadow-2xl animate-in zoom-in-95 duration-150">
            <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-slate-50">
              <div className="flex items-center gap-2">
                <Edit3 className="w-4 h-4 text-indigo-600" />
                <h3 className="font-bold text-sm text-slate-900">Édition de la fiche du jeu</h3>
              </div>
              <button
                onClick={() => setEditingGame(null)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-200/60 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveGameEdit} className="p-5 space-y-4 max-h-[80vh] overflow-y-auto">
              {editFeedback && (
                <div
                  className={`p-3 rounded-xl text-xs font-semibold flex items-center gap-2 ${
                    editFeedback.type === 'success'
                      ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                      : 'bg-red-50 text-red-800 border border-red-200'
                  }`}
                >
                  {editFeedback.type === 'success' ? (
                    <Check className="w-4 h-4 text-emerald-600 shrink-0" />
                  ) : (
                    <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
                  )}
                  <span>{editFeedback.message}</span>
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Titre du Jeu</label>
                <input
                  type="text"
                  required
                  value={editingGame.title}
                  onChange={(e) => setEditingGame({ ...editingGame, title: e.target.value })}
                  className="w-full text-xs p-2.5 rounded-xl border border-slate-300 focus:border-indigo-500 focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Genre</label>
                  <input
                    type="text"
                    value={editingGame.genre || ''}
                    onChange={(e) => setEditingGame({ ...editingGame, genre: e.target.value })}
                    className="w-full text-xs p-2.5 rounded-xl border border-slate-300 focus:border-indigo-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Franchise / Série</label>
                  <input
                    type="text"
                    value={editingGame.franchise || ''}
                    onChange={(e) => setEditingGame({ ...editingGame, franchise: e.target.value })}
                    className="w-full text-xs p-2.5 rounded-xl border border-slate-300 focus:border-indigo-500 focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Développeur</label>
                  <input
                    type="text"
                    value={editingGame.developer || ''}
                    onChange={(e) => setEditingGame({ ...editingGame, developer: e.target.value })}
                    className="w-full text-xs p-2.5 rounded-xl border border-slate-300 focus:border-indigo-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Éditeur</label>
                  <input
                    type="text"
                    value={editingGame.publisher || ''}
                    onChange={(e) => setEditingGame({ ...editingGame, publisher: e.target.value })}
                    className="w-full text-xs p-2.5 rounded-xl border border-slate-300 focus:border-indigo-500 focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">URL de la Jaquette (Cover)</label>
                <input
                  type="text"
                  value={editingGame.cover_url || ''}
                  onChange={(e) => setEditingGame({ ...editingGame, cover_url: e.target.value })}
                  placeholder="https://... ou media/cover.png"
                  className="w-full text-xs p-2.5 rounded-xl border border-slate-300 font-mono focus:border-indigo-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Synopsis / Description</label>
                <textarea
                  rows={3}
                  value={editingGame.synopsis || ''}
                  onChange={(e) => setEditingGame({ ...editingGame, synopsis: e.target.value })}
                  className="w-full text-xs p-2.5 rounded-xl border border-slate-300 focus:border-indigo-500 focus:outline-none"
                />
              </div>

              <div className="pt-2 flex justify-end gap-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setEditingGame(null)}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-100 transition-colors"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  disabled={savingEdit}
                  className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold shadow-xs flex items-center gap-1.5 transition-colors disabled:opacity-50"
                >
                  <Save className="w-3.5 h-3.5" />
                  <span>{savingEdit ? 'Enregistrement...' : 'Enregistrer'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
