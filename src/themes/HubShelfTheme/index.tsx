import React, { useState, useMemo, useCallback, useEffect } from 'react';
import {
  Gamepad2,
  Search,
  Settings as SettingsIcon,
  Star,
  Users,
  Sparkles,
  Layers,
  Clock,
  PlusCircle,
  Lock,
  Flame,
  Swords,
  ChevronRight,
  ChevronLeft,
} from 'lucide-react';
import { ThemeUIProps } from '../types';
import logoUrl from '../../assets/logo.png';
import { GameCard } from '../../components/games/GameCard';
import { ConsoleLogo } from '../../components/common/ConsoleLogo';
import { GamepadFooterBar } from '../../components/layout/GamepadFooterBar';
import { useGamepad } from '../../hooks';

/**
 * =========================================================================
 * UI Thème 2 : Kaïro Hub (Rayonnages par Catégories Plein Écran)
 * =========================================================================
 * Architecture moderne plein écran sans barre latérale :
 * - En-tête supérieur avec recherche textuelle intégrée et statut
 * - Rayon Consoles & Systèmes avec tuiles interactives et compteurs
 * - Rayon Favoris (Carrousel horizontal)
 * - Rayon Modes de Jeux (2 Joueurs, Combat, Plateforme, Récents) avec filtrage 1-clic
 * - Rayon Sagas Phares (Mario, Zelda, etc.) avec badges filtrables
 * - Rayon Bibliothèque Complète
 * - Zone de résultats instantanée lorsque des filtres sont actifs
 *
 * Tout le code de cette UI est complètement indépendant et isolé ici.
 */
export const HubShelfTheme: React.FC<ThemeUIProps> = ({
  systems,
  allGames,
  allFranchises,
  customFranchises = [],
  enabledSystems,
  enabledModes = ['2-players', 'genre:fight', 'genre:platform'],
  enabledFranchises = ['mario', 'zelda', 'pokemon', 'sonic', 'versus', 'rpg'],
  favoriteGames,
  twoPlayerGames,
  recentGames,
  fightGames: propFightGames,
  platformGames: propPlatformGames,
  focusedGame,
  onSelectGame,
  onLaunchGame,
  onToggleFavorite,
  onOpenSettings,
  onOpenGamepadSettings,
  onOpenAddGame,
  onOpenKioskUnlock,
  gamepadConnected,
  gamepadName,
  isGameRunning,
  appMode,
  settings,
  theme,
  primaryPlayerIndex = 0,
  gamepadMapping,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedSystemFilter, setSelectedSystemFilter] = useState<string | null>(null);
  const [selectedGenreFilter, setSelectedGenreFilter] = useState<string | null>(null);
  const [selectedModeFilter, setSelectedModeFilter] = useState<'2-players' | 'genre:fight' | 'genre:platform' | 'recent' | null>(null);

  const isKiosk = appMode === 'kiosk';
  const layout = theme.layout || {
    show_consoles_row: true,
    show_modes_row: true,
    show_genres_row: true,
    show_favorites_row: true,
    show_all_games_row: true,
  };

  // Systèmes visibles (filtrés selon enabled_systems)
  const systemsWithCounts = useMemo(() => {
    const visibleSystems = systems.filter((s) => {
      if (enabledSystems === undefined) return true;
      return enabledSystems.includes(s.id);
    });
    return visibleSystems.map((sys) => {
      const count = allGames.filter((g) => g.system_id === sys.id).length;
      return { ...sys, count };
    });
  }, [systems, allGames, enabledSystems]);

  // Franchises / Sagas visibles (filtrées selon enabled_franchises)
  const visibleFranchises = useMemo(() => {
    const list: { id: string; name: string }[] = [];
    allFranchises.forEach((f) => {
      const id = typeof f === 'string' ? f : f.id;
      const name = typeof f === 'string' ? f : f.name;
      list.push({ id, name });
    });

    if (customFranchises && customFranchises.length > 0) {
      customFranchises.forEach((cf) => {
        if (!list.some((item) => item.id === cf.id)) {
          list.push({ id: cf.id, name: cf.name });
        }
      });
    }

    if (enabledFranchises === undefined) {
      return list;
    }

    return list.filter((f) => {
      return (
        enabledFranchises.includes(f.id) ||
        enabledFranchises.includes(f.name.toLowerCase())
      );
    });
  }, [allFranchises, customFranchises, enabledFranchises]);

  // Jeux de combat
  const fightGames = useMemo(() => {
    if (propFightGames && propFightGames.length > 0) return propFightGames;
    return allGames.filter((g) => {
      const t = g.title.toLowerCase();
      const desc = (g.synopsis || '').toLowerCase();
      const genre = (g.genre || '').toLowerCase();
      return (
        t.includes('street fighter') ||
        t.includes('mortal kombat') ||
        t.includes('tekken') ||
        t.includes('kof') ||
        t.includes('fight') ||
        genre.includes('combat') ||
        genre.includes('fight') ||
        desc.includes('combat') ||
        desc.includes('fighting')
      );
    });
  }, [allGames, propFightGames]);

  // Jeux de plateforme
  const platformGames = useMemo(() => {
    if (propPlatformGames && propPlatformGames.length > 0) return propPlatformGames;
    return allGames.filter((g) => {
      const t = g.title.toLowerCase();
      const desc = (g.synopsis || '').toLowerCase();
      const genre = (g.genre || '').toLowerCase();
      return (
        t.includes('mario') ||
        t.includes('sonic') ||
        t.includes('donkey kong') ||
        t.includes('megaman') ||
        t.includes('rayman') ||
        genre.includes('platform') ||
        genre.includes('plateforme') ||
        desc.includes('platform') ||
        desc.includes('plateforme')
      );
    });
  }, [allGames, propPlatformGames]);

  // Filtrage principal
  const isFilterActive = Boolean(
    searchQuery.trim() || selectedSystemFilter || selectedGenreFilter || selectedModeFilter
  );

  const searchedGames = useMemo(() => {
    let list = allGames;

    if (selectedModeFilter === '2-players') {
      list = twoPlayerGames;
    } else if (selectedModeFilter === 'genre:fight') {
      list = fightGames;
    } else if (selectedModeFilter === 'genre:platform') {
      list = platformGames;
    } else if (selectedModeFilter === 'recent') {
      list = recentGames;
    }

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      list = list.filter(
        (g) =>
          g.title.toLowerCase().includes(q) ||
          (g.system_id && g.system_id.toLowerCase().includes(q)) ||
          (g.franchise && g.franchise.toLowerCase().includes(q))
      );
    }

    if (selectedSystemFilter) {
      list = list.filter((g) => g.system_id === selectedSystemFilter);
    }

    if (selectedGenreFilter) {
      list = list.filter(
        (g) => g.franchise?.toLowerCase() === selectedGenreFilter.toLowerCase()
      );
    }

    return list;
  }, [
    allGames,
    searchQuery,
    selectedSystemFilter,
    selectedGenreFilter,
    selectedModeFilter,
    twoPlayerGames,
    fightGames,
    platformGames,
    recentGames,
  ]);

  const clearAllFilters = () => {
    setSearchQuery('');
    setSelectedSystemFilter(null);
    setSelectedGenreFilter(null);
    setSelectedModeFilter(null);
  };

  const isModeEnabled = (modeId: string) => {
    if (enabledModes === undefined) return true;
    return enabledModes.includes(modeId);
  };

  const activeCategoryTitle = useMemo(() => {
    if (selectedSystemFilter) {
      const s = systems.find((sys) => sys.id === selectedSystemFilter);
      return s ? s.name.toUpperCase() : selectedSystemFilter.toUpperCase();
    }
    if (selectedModeFilter) {
      if (selectedModeFilter === '2-players') return 'JEUX À 2 JOUEURS (VERSUS & CO-OP)';
      if (selectedModeFilter === 'genre:fight') return 'JEUX DE COMBAT (VERSUS FIGHTING)';
      if (selectedModeFilter === 'genre:platform') return 'JEUX DE PLATEFORME';
      if (selectedModeFilter === 'recent') return 'RÉCEMMENT JOUÉS';
      return String(selectedModeFilter).toUpperCase();
    }
    if (selectedGenreFilter) {
      const f = visibleFranchises.find((item) => item.id === selectedGenreFilter);
      return `FRANCHISE : ${(f?.name || selectedGenreFilter).toUpperCase()}`;
    }
    if (searchQuery.trim()) {
      return `RECHERCHE : "${searchQuery.trim().toUpperCase()}"`;
    }
    return 'CATÉGORIE';
  }, [selectedSystemFilter, selectedModeFilter, selectedGenreFilter, searchQuery, systems, visibleFranchises]);

  const activeModesList = useMemo(() => {
    const list: { id: string; name: string; count: number; icon: any; color: string }[] = [];
    if (isModeEnabled('2-players')) list.push({ id: '2-players', name: 'Jeux à 2 Joueurs', count: twoPlayerGames.length, icon: Users, color: 'bg-rose-50 text-rose-500' });
    if (isModeEnabled('genre:fight')) list.push({ id: 'genre:fight', name: 'Combat & Versus', count: fightGames.length, icon: Swords, color: 'bg-amber-50 text-amber-500' });
    if (isModeEnabled('genre:platform')) list.push({ id: 'genre:platform', name: 'Plateformes', count: platformGames.length, icon: Gamepad2, color: 'bg-pink-50 text-pink-500' });
    list.push({ id: 'recent', name: 'Récemment Joués', count: recentGames.length, icon: Clock, color: 'bg-purple-50 text-purple-500' });
    return list;
  }, [isModeEnabled, twoPlayerGames.length, fightGames.length, platformGames.length, recentGames.length]);

  const shelves = useMemo(() => {
    const list: {
      id: string;
      type: 'consoles' | 'games' | 'modes' | 'franchises';
      title: string;
      items: any[];
    }[] = [];

    if (layout.show_consoles_row !== false && systemsWithCounts.length > 0) {
      list.push({ id: 'consoles', type: 'consoles', title: 'Consoles & Systèmes Rétro', items: systemsWithCounts });
    }
    if (layout.show_favorites_row !== false && favoriteGames.length > 0) {
      list.push({ id: 'favorites', type: 'games', title: `Vos Jeux Favoris (${favoriteGames.length})`, items: favoriteGames });
    }
    if (layout.show_modes_row !== false && activeModesList.length > 0) {
      list.push({ id: 'modes', type: 'modes', title: 'Modes de Jeu & Catégories', items: activeModesList });
    }
    if (layout.show_genres_row !== false && visibleFranchises.length > 0) {
      list.push({ id: 'franchises', type: 'franchises', title: 'Sagas & Franchises Phares', items: visibleFranchises });
    }
    if (layout.show_all_games_row !== false && allGames.length > 0) {
      list.push({ id: 'all', type: 'games', title: `Tous les Jeux de la Borne (${allGames.length})`, items: allGames });
    }
    return list;
  }, [layout, systemsWithCounts, favoriteGames, activeModesList, visibleFranchises, allGames]);

  // Navigation manette
  const [shelfIndex, setShelfIndex] = useState(0);
  const [itemIndex, setItemIndex] = useState(0);
  const [categoryFocusIndex, setCategoryFocusIndex] = useState(0);

  const activeShelf = shelves[shelfIndex];

  const handleGamepadNavigate = useCallback(
    (dir: 'up' | 'down' | 'left' | 'right') => {
      if (isFilterActive) {
        const total = searchedGames.length;
        if (total === 0) return;
        if (dir === 'left') setCategoryFocusIndex((p) => Math.max(0, p - 1));
        else if (dir === 'right') setCategoryFocusIndex((p) => Math.min(total - 1, p + 1));
        else if (dir === 'up') setCategoryFocusIndex((p) => Math.max(0, p - 4));
        else if (dir === 'down') setCategoryFocusIndex((p) => Math.min(total - 1, p + 4));
      } else {
        if (dir === 'up') {
          setShelfIndex((p) => Math.max(0, p - 1));
          setItemIndex(0);
        } else if (dir === 'down') {
          setShelfIndex((p) => Math.min(shelves.length - 1, p + 1));
          setItemIndex(0);
        } else if (dir === 'left') {
          setItemIndex((p) => Math.max(0, p - 1));
        } else if (dir === 'right') {
          const count = shelves[shelfIndex]?.items.length || 0;
          setItemIndex((p) => Math.min(Math.max(0, count - 1), p + 1));
        }
      }
    },
    [isFilterActive, searchedGames.length, shelves, shelfIndex]
  );

  const handleGamepadConfirm = useCallback(() => {
    if (isFilterActive) {
      const targetGame = searchedGames[categoryFocusIndex];
      if (targetGame) onSelectGame(targetGame);
    } else {
      const current = shelves[shelfIndex];
      if (!current) return;
      const targetItem = current.items[itemIndex];
      if (!targetItem) return;

      if (current.type === 'consoles') {
        setSelectedSystemFilter(targetItem.id);
        setCategoryFocusIndex(0);
      } else if (current.type === 'modes') {
        setSelectedModeFilter(targetItem.id);
        setCategoryFocusIndex(0);
      } else if (current.type === 'franchises') {
        setSelectedGenreFilter(targetItem.id);
        setCategoryFocusIndex(0);
      } else if (current.type === 'games') {
        onSelectGame(targetItem);
      }
    }
  }, [isFilterActive, searchedGames, categoryFocusIndex, shelves, shelfIndex, itemIndex, onSelectGame]);

  const handleGamepadBack = useCallback(() => {
    if (isFilterActive) {
      clearAllFilters();
    }
  }, [isFilterActive]);

  const handleGamepadFavorite = useCallback(() => {
    if (isFilterActive) {
      const targetGame = searchedGames[categoryFocusIndex];
      if (targetGame) onToggleFavorite(targetGame);
    } else {
      const current = shelves[shelfIndex];
      if (current && current.type === 'games') {
        const targetItem = current.items[itemIndex];
        if (targetItem) onToggleFavorite(targetItem);
      }
    }
  }, [isFilterActive, searchedGames, categoryFocusIndex, shelves, shelfIndex, itemIndex, onToggleFavorite]);

  const gamepadActions = useMemo(
    () => ({
      onNavigate: handleGamepadNavigate,
      onConfirm: handleGamepadConfirm,
      onBack: handleGamepadBack,
      onToggleFavorite: handleGamepadFavorite,
      onPrevSystem: () => {
        setShelfIndex((p) => Math.max(0, p - 1));
        setItemIndex(0);
      },
      onNextSystem: () => {
        setShelfIndex((p) => Math.min(shelves.length - 1, p + 1));
        setItemIndex(0);
      },
      onMenu: onOpenSettings,
    }),
    [handleGamepadNavigate, handleGamepadConfirm, handleGamepadBack, handleGamepadFavorite, shelves.length, onOpenSettings]
  );

  useGamepad(gamepadActions, true, primaryPlayerIndex, gamepadMapping);

  // Auto-scroll pour suivre le curseur de la manette
  useEffect(() => {
    if (isFilterActive) {
      const el = document.getElementById(`hub-category-game-${categoryFocusIndex}`);
      if (el) el.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    } else {
      const current = shelves[shelfIndex];
      if (!current) return;
      const itemEl = document.getElementById(`hub-item-${current.id}-${itemIndex}`);
      if (itemEl) {
        itemEl.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
      } else {
        const shelfEl = document.getElementById(`hub-shelf-${current.id}`);
        if (shelfEl) shelfEl.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      }
    }
  }, [isFilterActive, categoryFocusIndex, shelfIndex, itemIndex, shelves]);

  return (
    <div
      style={{
        backgroundColor: 'var(--bg-primary)',
        color: 'var(--text-primary)',
      }}
      className="flex-1 flex flex-col h-full overflow-hidden select-none"
    >
      {/* 1. Header Plein Écran Moderne (Sans Sidebar) */}
      <header
        style={{
          backgroundColor: 'var(--sidebar-bg)',
          borderColor: 'var(--border-color)',
        }}
        className="px-6 py-3.5 border-b flex items-center justify-between gap-4 shrink-0 shadow-xs z-30"
      >
        {/* Logo & Borne Status */}
        <div className="flex items-center gap-3">
          <div
            style={{ backgroundColor: 'var(--accent-primary)' }}
            className="w-10 h-10 rounded-2xl flex items-center justify-center p-1.5 text-white shadow-md shadow-black/10 shrink-0"
          >
            <img src={logoUrl} alt="KaïroOS" className="w-full h-full object-contain" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span
                className="text-base font-black tracking-tight"
                style={{ color: 'var(--text-primary)' }}
              >
                KAÏRO
              </span>
              <span
                style={{ backgroundColor: 'var(--accent-primary)' }}
                className="text-[10px] font-black px-1.5 py-0.5 rounded-md text-white font-mono uppercase"
              >
                HUB
              </span>
              <span
                style={{
                  backgroundColor: 'var(--bg-card)',
                  borderColor: 'var(--border-color)',
                  color: 'var(--text-secondary)',
                }}
                className="px-2 py-0.5 rounded-md border text-[10px] font-bold"
              >
                {allGames.length} jeux
              </span>
            </div>
            <div
              className="flex items-center gap-2 text-[11px]"
              style={{ color: 'var(--text-muted)' }}
            >
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              <span>
                {gamepadConnected
                  ? `${gamepadName || 'Manette connectée'}`
                  : 'Borne prête'}
              </span>
            </div>
          </div>
        </div>

        {/* Barre de Recherche intégrée */}
        <div className="flex-1 max-w-md mx-4">
          <div
            style={{
              backgroundColor: 'var(--bg-card)',
              borderColor: 'var(--border-color)',
            }}
            className="flex items-center gap-2 px-3.5 py-2 rounded-2xl border shadow-2xs transition-colors focus-within:border-[var(--accent-primary)]"
          >
            <Search className="w-4 h-4 text-slate-400" />
            <input
              type="text"
              placeholder="Rechercher un jeu, une console, une saga..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{ color: 'var(--text-primary)' }}
              className="bg-transparent text-xs font-semibold focus:outline-none w-full"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="text-xs text-slate-400 hover:text-slate-700 font-bold px-1"
              >
                ✕
              </button>
            )}
          </div>
        </div>

        {/* Badges de Filtres Actifs & Actions */}
        <div className="flex items-center gap-2 shrink-0">
          {selectedSystemFilter && (
            <button
              onClick={() => setSelectedSystemFilter(null)}
              style={{
                backgroundColor: 'var(--accent-primary)',
                color: '#ffffff',
              }}
              className="px-2.5 py-1 rounded-xl text-xs font-bold flex items-center gap-1 shadow-2xs hover:opacity-90"
            >
              <span>Console: {selectedSystemFilter.toUpperCase()}</span>
              <span>✕</span>
            </button>
          )}

          {selectedGenreFilter && (
            <button
              onClick={() => setSelectedGenreFilter(null)}
              style={{
                backgroundColor: 'var(--accent-primary)',
                color: '#ffffff',
              }}
              className="px-2.5 py-1 rounded-xl text-xs font-bold flex items-center gap-1 shadow-2xs hover:opacity-90"
            >
              <span>Saga: {selectedGenreFilter}</span>
              <span>✕</span>
            </button>
          )}

          {selectedModeFilter && (
            <button
              onClick={() => setSelectedModeFilter(null)}
              style={{
                backgroundColor: 'var(--accent-secondary)',
                color: '#ffffff',
              }}
              className="px-2.5 py-1 rounded-xl text-xs font-bold flex items-center gap-1 shadow-2xs hover:opacity-90"
            >
              <span>
                Mode:{' '}
                {selectedModeFilter === '2-players'
                  ? '2 Joueurs'
                  : selectedModeFilter === 'genre:fight'
                  ? 'Combat'
                  : selectedModeFilter === 'genre:platform'
                  ? 'Plateforme'
                  : 'Récents'}
              </span>
              <span>✕</span>
            </button>
          )}

          {isKiosk ? (
            <button
              onClick={onOpenKioskUnlock}
              className="px-3 py-1.5 rounded-xl border border-rose-300 bg-rose-50 text-rose-600 text-xs font-bold flex items-center gap-1.5 animate-pulse"
            >
              <Lock className="w-3.5 h-3.5" />
              <span>Kiosk</span>
            </button>
          ) : (
            <>
              {onOpenAddGame && (
                <button
                  onClick={onOpenAddGame}
                  style={{
                    backgroundColor: 'var(--bg-card)',
                    borderColor: 'var(--border-color)',
                    color: 'var(--text-secondary)',
                  }}
                  className="p-2 rounded-xl border hover:scale-105 shadow-2xs transition-all"
                  title="Ajouter un jeu"
                >
                  <PlusCircle className="w-4 h-4" />
                </button>
              )}

              <button
                onClick={onOpenGamepadSettings}
                style={{
                  backgroundColor: gamepadConnected
                    ? 'rgba(16, 185, 129, 0.12)'
                    : 'var(--bg-card)',
                  borderColor: gamepadConnected ? '#10b981' : 'var(--border-color)',
                  color: gamepadConnected ? '#10b981' : 'var(--text-secondary)',
                }}
                className="p-2 rounded-xl border hover:scale-105 shadow-2xs transition-all"
                title="Configuration manettes"
              >
                <Gamepad2 className="w-4 h-4" />
              </button>

              <button
                onClick={onOpenSettings}
                style={{
                  backgroundColor: 'var(--bg-card)',
                  borderColor: 'var(--border-color)',
                  color: 'var(--text-primary)',
                }}
                className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl border hover:scale-102 shadow-2xs transition-all text-xs font-bold"
                title="Paramètres de la borne"
              >
                <SettingsIcon
                  className="w-4 h-4"
                  style={{ color: 'var(--accent-primary)' }}
                />
                <span>Paramètres</span>
              </button>
            </>
          )}
        </div>
      </header>

      {/* 2. Contenu Défilable Plein Écran par Catégories */}
      <main className="flex-1 overflow-y-auto px-6 py-6 space-y-8 scrollbar-thin">
        {/* Si une recherche ou un filtre est actif, on affiche les résultats directs */}
        {isFilterActive ? (
          <section className="space-y-4">
            {/* Bannière de Catégorie avec Bouton RETOUR AU HUB (B) très visible */}
            <div
              style={{
                backgroundColor: 'var(--bg-card)',
                borderColor: 'var(--border-color)',
              }}
              className="flex flex-wrap items-center justify-between gap-4 p-4 sm:p-5 rounded-3xl border-2 shadow-lg"
            >
              <div className="flex items-center gap-4">
                <button
                  onClick={clearAllFilters}
                  style={{ backgroundColor: 'var(--accent-primary)' }}
                  className="flex items-center gap-2.5 px-5 py-2.5 rounded-2xl text-white text-xs font-black shadow-md hover:scale-105 active:scale-95 transition-all cursor-pointer"
                  title="Retour aux Rayons (Touche B / Échap)"
                >
                  <ChevronLeft className="w-4 h-4 stroke-[3]" />
                  <span>RETOUR AU HUB (B)</span>
                </button>

                <div>
                  <div className="flex items-center gap-2.5">
                    <h2
                      style={{ color: 'var(--text-primary)' }}
                      className="text-base font-black tracking-tight"
                    >
                      {activeCategoryTitle}
                    </h2>
                    <span className="px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold bg-purple-500/15 text-purple-600 border border-purple-500/20">
                      {searchedGames.length} JEU{searchedGames.length > 1 ? 'X' : ''}
                    </span>
                  </div>
                  <p style={{ color: 'var(--text-muted)' }} className="text-xs">
                    Sélectionnez un jeu à la manette (A) ou revenez aux rayons (B)
                  </p>
                </div>
              </div>

              <button
                onClick={clearAllFilters}
                className="px-4 py-2 rounded-xl border border-slate-300 dark:border-slate-700 text-xs font-bold hover:bg-black/5 transition-all cursor-pointer"
                style={{ color: 'var(--text-muted)' }}
              >
                Fermer la catégorie ✕
              </button>
            </div>

            <div className="flex flex-wrap gap-4">
              {searchedGames.map((game, idx) => {
                const isItemFocused = categoryFocusIndex === idx;
                return (
                  <div
                    key={game.id}
                    id={`hub-category-game-${idx}`}
                    className={`transition-transform rounded-2xl ${
                      isItemFocused
                        ? 'ring-4 ring-purple-500 ring-offset-2 ring-offset-slate-900 scale-105 shadow-2xl z-20'
                        : ''
                    }`}
                  >
                    <GameCard
                      game={game}
                      isFocused={isItemFocused}
                      onSelect={onSelectGame}
                      onLaunch={onLaunchGame}
                      onToggleFavorite={onToggleFavorite}
                    />
                  </div>
                );
              })}
              {searchedGames.length === 0 && (
                <div
                  style={{
                    backgroundColor: 'var(--bg-card)',
                    borderColor: 'var(--border-color)',
                  }}
                  className="w-full p-8 rounded-3xl border text-center text-xs text-slate-400 font-bold"
                >
                  Aucun jeu ne correspond à cette sélection.
                </div>
              )}
            </div>
          </section>
        ) : (
          <>
            {/* RAYON 1 : 🕹️ Consoles & Systèmes (Filtrés selon paramètres borne) */}
            {layout.show_consoles_row !== false && systemsWithCounts.length > 0 && (
              <section id="hub-shelf-consoles" className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Layers
                      className="w-4 h-4"
                      style={{ color: 'var(--accent-primary)' }}
                    />
                    <h3
                      style={{ color: 'var(--text-primary)' }}
                      className="text-base font-black tracking-tight"
                    >
                      Consoles & Systèmes Rétro
                    </h3>
                  </div>
                  <span
                    style={{ color: 'var(--text-muted)' }}
                    className="text-xs font-medium"
                  >
                    Sélectionnez une plateforme
                  </span>
                </div>

                <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-none">
                  {systemsWithCounts.map((sys, idx) => {
                    const isSelected = selectedSystemFilter === sys.id;
                    const isShelfActive = !isFilterActive && activeShelf?.id === 'consoles';
                    const isItemFocused = isShelfActive && itemIndex === idx;

                    return (
                      <div
                        key={sys.id}
                        id={`hub-item-consoles-${idx}`}
                        onClick={() =>
                          setSelectedSystemFilter(
                            selectedSystemFilter === sys.id ? null : sys.id
                          )
                        }
                        style={{
                          backgroundColor: isSelected
                            ? 'var(--accent-primary)'
                            : 'var(--bg-card)',
                          borderColor: isSelected
                            ? 'var(--accent-primary)'
                            : 'var(--border-color)',
                          color: isSelected ? '#ffffff' : 'var(--text-primary)',
                        }}
                        className={`min-w-[170px] p-3.5 rounded-2xl border-2 cursor-pointer transition-all hover:scale-105 shadow-2xs flex flex-col justify-between shrink-0 group ${
                          isSelected ? 'ring-2 ring-[var(--accent-primary)]/30' : ''
                        } ${
                          isItemFocused
                            ? 'ring-4 ring-purple-500 ring-offset-2 ring-offset-slate-900 scale-105 shadow-xl z-10'
                            : ''
                        }`}
                      >
                        <div className="flex items-center justify-between mb-2">
                          <div
                            style={{
                              backgroundColor: isSelected
                                ? 'rgba(255,255,255,0.2)'
                                : 'var(--bg-secondary)',
                            }}
                            className="p-2 rounded-xl flex items-center justify-center"
                          >
                            <ConsoleLogo
                              systemId={sys.id}
                              className="w-6 h-6 object-contain"
                            />
                          </div>
                          <span
                            style={{
                              backgroundColor: isSelected
                                ? 'rgba(255,255,255,0.25)'
                                : 'var(--bg-secondary)',
                              color: isSelected ? '#ffffff' : 'var(--text-secondary)',
                            }}
                            className="px-2 py-0.5 rounded-lg text-[10px] font-mono font-bold"
                          >
                            {sys.count} jeux
                          </span>
                        </div>

                        <div>
                          <div className="text-xs font-black truncate">{sys.name}</div>
                          <div
                            className="text-[10px] opacity-75 truncate"
                            style={{
                              color: isSelected ? '#ffffff' : 'var(--text-muted)',
                            }}
                          >
                            {sys.manufacturer || 'Arcade'}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </section>
            )}

            {/* RAYON 2 : ⭐ Favoris */}
            {layout.show_favorites_row !== false && favoriteGames.length > 0 && (
              <section id="hub-shelf-favorites" className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Star
                      className="w-4 h-4 text-amber-500 fill-amber-500"
                    />
                    <h3
                      style={{ color: 'var(--text-primary)' }}
                      className="text-base font-black tracking-tight"
                    >
                      Vos Jeux Favoris ({favoriteGames.length})
                    </h3>
                  </div>
                  <span
                    style={{ color: 'var(--text-muted)' }}
                    className="text-xs font-medium"
                  >
                    Accès rapide
                  </span>
                </div>

                <div className="flex gap-4 overflow-x-auto pb-3 pt-1 scrollbar-none items-center">
                  {favoriteGames.map((game, idx) => {
                    const isShelfActive = !isFilterActive && activeShelf?.id === 'favorites';
                    const isItemFocused = isShelfActive && itemIndex === idx;

                    return (
                      <div
                        key={game.id}
                        id={`hub-item-favorites-${idx}`}
                        className={`transition-transform rounded-2xl shrink-0 ${
                          isItemFocused
                            ? 'ring-4 ring-purple-500 ring-offset-2 ring-offset-slate-900 scale-105 shadow-2xl z-10'
                            : ''
                        }`}
                      >
                        <GameCard
                          game={game}
                          isFocused={isItemFocused || focusedGame?.id === game.id}
                          onSelect={onSelectGame}
                          onLaunch={onLaunchGame}
                          onToggleFavorite={onToggleFavorite}
                        />
                      </div>
                    );
                  })}
                </div>
              </section>
            )}

            {/* RAYON 3 : 👥 Modes de Jeux (Filtrés selon enabledModes) */}
            {layout.show_modes_row !== false && activeModesList.length > 0 && (
              <section id="hub-shelf-modes" className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Users
                      className="w-4 h-4"
                      style={{ color: 'var(--accent-primary)' }}
                    />
                    <h3
                      style={{ color: 'var(--text-primary)' }}
                      className="text-base font-black tracking-tight"
                    >
                      Modes de Jeu & Catégories
                    </h3>
                  </div>
                  <span
                    style={{ color: 'var(--text-muted)' }}
                    className="text-xs font-medium"
                  >
                    Cliquez pour filtrer les jeux
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
                  {activeModesList.map((mode, idx) => {
                    const isShelfActive = !isFilterActive && activeShelf?.id === 'modes';
                    const isItemFocused = isShelfActive && itemIndex === idx;
                    const isSelected = selectedModeFilter === mode.id;
                    const IconComponent = mode.icon;

                    return (
                      <div
                        key={mode.id}
                        id={`hub-item-modes-${idx}`}
                        onClick={() =>
                          setSelectedModeFilter(
                            selectedModeFilter === mode.id ? null : (mode.id as any)
                          )
                        }
                        style={{
                          backgroundColor: isSelected
                            ? 'var(--bg-secondary)'
                            : 'var(--bg-card)',
                          borderColor: isSelected
                            ? 'var(--accent-primary)'
                            : 'var(--border-color)',
                        }}
                        className={`p-4 rounded-2xl border-2 hover:border-[var(--accent-primary)] cursor-pointer transition-all shadow-2xs flex items-center justify-between group ${
                          isSelected ? 'ring-2 ring-[var(--accent-primary)]/20' : ''
                        } ${
                          isItemFocused
                            ? 'ring-4 ring-purple-500 ring-offset-2 ring-offset-slate-900 scale-105 shadow-xl z-10'
                            : ''
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <div className={`p-2.5 rounded-xl ${mode.color}`}>
                            <IconComponent className="w-5 h-5" />
                          </div>
                          <div>
                            <div
                              style={{ color: 'var(--text-primary)' }}
                              className="text-xs font-black"
                            >
                              {mode.name}
                            </div>
                            <div
                              style={{ color: 'var(--text-muted)' }}
                              className="text-[10px]"
                            >
                              {mode.id === '2-players' && `${twoPlayerGames.length} compatibles`}
                              {mode.id === 'genre:fight' && `${fightGames.length} jeux arcade`}
                              {mode.id === 'genre:platform' && `${platformGames.length} titres cultes`}
                              {mode.id === 'recent' && `${recentGames.length} sessions`}
                            </div>
                          </div>
                        </div>
                        <ChevronRight className="w-4 h-4 text-slate-400 group-hover:translate-x-0.5 transition-transform" />
                      </div>
                    );
                  })}
                </div>
              </section>
            )}

            {/* RAYON 4 : 🏷️ Sagas & Franchises Célèbres (Filtrées selon enabledFranchises) */}
            {layout.show_genres_row !== false && visibleFranchises.length > 0 && (
              <section id="hub-shelf-franchises" className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Flame
                      className="w-4 h-4"
                      style={{ color: 'var(--accent-primary)' }}
                    />
                    <h3
                      style={{ color: 'var(--text-primary)' }}
                      className="text-base font-black tracking-tight"
                    >
                      Sagas & Franchises Phares
                    </h3>
                  </div>
                  <span
                    style={{ color: 'var(--text-muted)' }}
                    className="text-xs font-medium"
                  >
                    Filtrer par univers
                  </span>
                </div>

                <div className="flex gap-2.5 overflow-x-auto pb-2 scrollbar-none">
                  {visibleFranchises.map((item, idx) => {
                    const franchiseName = item.name;
                    const franchiseId = item.id;
                    const count = allGames.filter(
                      (g) => g.franchise?.toLowerCase() === franchiseName.toLowerCase()
                    ).length;
                    const isSelected = selectedGenreFilter === franchiseName;
                    const isShelfActive = !isFilterActive && activeShelf?.id === 'franchises';
                    const isItemFocused = isShelfActive && itemIndex === idx;

                    return (
                      <button
                        key={franchiseId}
                        id={`hub-item-franchises-${idx}`}
                        onClick={() =>
                          setSelectedGenreFilter(
                            selectedGenreFilter === franchiseName ? null : franchiseName
                          )
                        }
                        style={{
                          backgroundColor: isSelected
                            ? 'var(--accent-primary)'
                            : 'var(--bg-card)',
                          color: isSelected ? '#ffffff' : 'var(--text-primary)',
                          borderColor: isSelected
                            ? 'var(--accent-primary)'
                            : 'var(--border-color)',
                        }}
                        className={`px-3.5 py-2 rounded-xl border-2 text-xs font-bold whitespace-nowrap transition-all hover:scale-105 shadow-2xs flex items-center gap-2 ${
                          isSelected ? 'ring-2 ring-[var(--accent-primary)]/20' : ''
                        } ${
                          isItemFocused
                            ? 'ring-4 ring-purple-500 ring-offset-2 ring-offset-slate-900 scale-105 shadow-xl z-10'
                            : ''
                        }`}
                      >
                        <span className="capitalize">{franchiseName}</span>
                        {count > 0 && (
                          <span
                            style={{
                              backgroundColor: isSelected
                                ? 'rgba(255,255,255,0.25)'
                                : 'var(--bg-secondary)',
                              color: isSelected ? '#ffffff' : 'var(--text-secondary)',
                            }}
                            className="px-1.5 py-0.2 rounded-md text-[10px] font-mono"
                          >
                            {count}
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              </section>
            )}

            {/* RAYON 5 : 🎮 Tous les Jeux (Bibliothèque Complète) */}
            {layout.show_all_games_row !== false && allGames.length > 0 && (
              <section id="hub-shelf-all" className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Sparkles
                      className="w-4 h-4"
                      style={{ color: 'var(--accent-primary)' }}
                    />
                    <h3
                      style={{ color: 'var(--text-primary)' }}
                      className="text-base font-black tracking-tight"
                    >
                      Bibliothèque Complète ({allGames.length} jeux)
                    </h3>
                  </div>
                  <span
                    style={{ color: 'var(--text-muted)' }}
                    className="text-xs font-medium"
                  >
                    Défilement horizontal
                  </span>
                </div>

                <div className="flex gap-4 overflow-x-auto pb-4 pt-1 scrollbar-none items-center">
                  {allGames.map((game, idx) => {
                    const isShelfActive = !isFilterActive && activeShelf?.id === 'all';
                    const isItemFocused = isShelfActive && itemIndex === idx;

                    return (
                      <div
                        key={game.id}
                        id={`hub-item-all-${idx}`}
                        className={`transition-transform rounded-2xl shrink-0 ${
                          isItemFocused
                            ? 'ring-4 ring-purple-500 ring-offset-2 ring-offset-slate-900 scale-105 shadow-2xl z-10'
                            : ''
                        }`}
                      >
                        <GameCard
                          game={game}
                          isFocused={isItemFocused || focusedGame?.id === game.id}
                          onSelect={onSelectGame}
                          onLaunch={onLaunchGame}
                          onToggleFavorite={onToggleFavorite}
                        />
                      </div>
                    );
                  })}
                </div>
              </section>
            )}
          </>
        )}
      </main>

      {/* Barre d'Aide Manette en bas */}
      <GamepadFooterBar
        buttonStyle={settings.button_prompt_style || 'xbox'}
        isGameRunning={isGameRunning}
        isDetailsModalOpen={false}
        isOtherModalOpen={false}
        gameSelectAction={settings.game_select_action || 'details'}
        isConnected={gamepadConnected}
        gamepadName={gamepadName}
      />
    </div>
  );
};
