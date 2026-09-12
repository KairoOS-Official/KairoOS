import React, { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import {
  Play,
  Heart,
  Sliders,
  Star,
  Gamepad2,
  User,
  Settings as SettingsIcon,
} from 'lucide-react';
import { convertFileSrc } from '@tauri-apps/api/core';
import { ThemeUIProps } from '../types';
import { useGamepad } from '../../hooks';
import { ConsoleLogo } from '../../components/common/ConsoleLogo';

/**
 * =========================================================================
 * UI Thème 3 : Kaïro Console Launcher (TV / Steam Big Picture / Batocera)
 * =========================================================================
 * Architecture dédiée aux écrans de salon et bornes avec navigation 100% manette :
 * - HAUT : Hero dynamique grand format avec artwork/fanart plein écran en fondu,
 *          titre percutant, étoiles de note, métadonnées et boutons d'actions rapides.
 * - MILIEU : Carrousel horizontal fluide centré sur le jeu sélectionné.
 * - BAS : Barre d'aide manette avec glyphes réels et raccourcis d'administration.
 *
 * Tout ce layout est personnalisable par les créateurs de thèmes via theme.json
 * (layout_type: "console_launcher") et custom_css sans jamais toucher au code source.
 */
export const ConsoleLauncherTheme: React.FC<ThemeUIProps> = ({
  systems,
  allGames,
  enabledSystems,
  onSelectGame,
  onLaunchGame,
  onToggleFavorite,
  onOpenSettings,
  onOpenGamepadSettings,
  gamepadConnected,
  gamepadName,
  primaryPlayerIndex = 0,
  gamepadMapping,
}) => {
  // 1. Liste des systèmes disponibles (selon filtres borne)
  const availableSystems = useMemo(() => {
    const list = systems.filter((s) => {
      if (enabledSystems === undefined || enabledSystems.length === 0) return true;
      return enabledSystems.includes(s.id);
    });
    return list;
  }, [systems, enabledSystems]);

  // Onglet système actif (null = Tous les jeux)
  const [selectedSystemId, setSelectedSystemId] = useState<string | null>(null);

  // Jeux affichés dans le carrousel selon la console sélectionnée
  const activeGames = useMemo(() => {
    if (!selectedSystemId) return allGames;
    return allGames.filter((g) => g.system_id === selectedSystemId);
  }, [allGames, selectedSystemId]);

  // Index du jeu actuellement focalisé dans le carrousel
  const [focusedIndex, setFocusedIndex] = useState<number>(0);

  // Synchronisation de l'index quand la liste des jeux change
  useEffect(() => {
    setFocusedIndex((prev) => {
      if (activeGames.length === 0) return 0;
      return Math.min(prev, activeGames.length - 1);
    });
  }, [activeGames]);

  // Jeu actuellement focalisé
  const currentFocusedGame = useMemo(() => {
    if (activeGames.length === 0) return null;
    return activeGames[focusedIndex] || activeGames[0] || null;
  }, [activeGames, focusedIndex]);

  // Horloge en temps réel (mise à jour chaque minute)
  const [currentTime, setCurrentTime] = useState<string>('');
  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      const hours = String(now.getHours()).padStart(2, '0');
      const minutes = String(now.getMinutes()).padStart(2, '0');
      setCurrentTime(`${hours}:${minutes}`);
    };
    updateTime();
    const interval = setInterval(updateTime, 10000);
    return () => clearInterval(interval);
  }, []);

  // Défilement centré automatique sur la carte sélectionnée
  const cardRefs = useRef<Record<string, HTMLDivElement | null>>({});
  useEffect(() => {
    if (currentFocusedGame) {
      const el = cardRefs.current[currentFocusedGame.id];
      if (el) {
        el.scrollIntoView({
          behavior: 'smooth',
          block: 'nearest',
          inline: 'center',
        });
      }
    }
  }, [currentFocusedGame]);

  // Résolution d'image locale avec convertFileSrc pour Tauri
  const getImageUrl = (url?: string | null) => {
    if (!url) return undefined;
    if (url.startsWith('http://') || url.startsWith('https://') || url.startsWith('data:')) return url;
    return convertFileSrc(url);
  };

  // Image d'arrière-plan du Hero (backdrop prioritaire, sinon cover)
  const heroBackdropUrl = useMemo(() => {
    if (!currentFocusedGame) return null;
    const raw = currentFocusedGame.backdrop_url || currentFocusedGame.cover_url;
    return getImageUrl(raw);
  }, [currentFocusedGame]);

  // Navigation manette & clavier
  const handleNavigate = useCallback(
    (direction: 'up' | 'down' | 'left' | 'right') => {
      if (activeGames.length === 0) return;
      if (direction === 'left') {
        setFocusedIndex((prev) => (prev > 0 ? prev - 1 : activeGames.length - 1));
      } else if (direction === 'right') {
        setFocusedIndex((prev) => (prev < activeGames.length - 1 ? prev + 1 : 0));
      }
    },
    [activeGames.length]
  );

  const handlePrevSystem = useCallback(() => {
    if (availableSystems.length === 0) return;
    const sysIds: (string | null)[] = [null, ...availableSystems.map((s) => s.id)];
    const currentIdx = sysIds.indexOf(selectedSystemId);
    const nextIdx = (currentIdx - 1 + sysIds.length) % sysIds.length;
    setSelectedSystemId(sysIds[nextIdx]);
    setFocusedIndex(0);
  }, [availableSystems, selectedSystemId]);

  const handleNextSystem = useCallback(() => {
    if (availableSystems.length === 0) return;
    const sysIds: (string | null)[] = [null, ...availableSystems.map((s) => s.id)];
    const currentIdx = sysIds.indexOf(selectedSystemId);
    const nextIdx = (currentIdx + 1) % sysIds.length;
    setSelectedSystemId(sysIds[nextIdx]);
    setFocusedIndex(0);
  }, [availableSystems, selectedSystemId]);

  const handleConfirm = useCallback(() => {
    if (currentFocusedGame) {
      onLaunchGame(currentFocusedGame);
    }
  }, [currentFocusedGame, onLaunchGame]);

  const handleToggleFav = useCallback(() => {
    if (currentFocusedGame) {
      onToggleFavorite(currentFocusedGame);
    }
  }, [currentFocusedGame, onToggleFavorite]);

  const handleOpenDetails = useCallback(() => {
    if (currentFocusedGame) {
      onSelectGame(currentFocusedGame);
    }
  }, [currentFocusedGame, onSelectGame]);

  const gamepadActions = useMemo(
    () => ({
      onNavigate: handleNavigate,
      onConfirm: handleConfirm,
      onBack: onOpenSettings,
      onToggleFavorite: handleToggleFav,
      onDetails: handleOpenDetails,
      onPrevSystem: handlePrevSystem,
      onNextSystem: handleNextSystem,
      onMenu: onOpenSettings,
    }),
    [handleNavigate, handleConfirm, handleToggleFav, handleOpenDetails, handlePrevSystem, handleNextSystem, onOpenSettings]
  );

  useGamepad(gamepadActions, true, primaryPlayerIndex, gamepadMapping);

  // Métadonnées du jeu actif
  const activeSystem = useMemo(() => {
    if (!currentFocusedGame) return null;
    return systems.find((s) => s.id === currentFocusedGame.system_id) || null;
  }, [currentFocusedGame, systems]);

  const activeGenre = currentFocusedGame?.genre || 'Arcade';
  const activePlayers = currentFocusedGame?.players || 1;
  const activeRating = currentFocusedGame?.rating || 4.5;
  const ratingStars = Math.min(5, Math.max(1, Math.round(activeRating > 5 ? activeRating / 2 : activeRating)));

  return (
    <div
      style={{
        backgroundColor: 'var(--bg-primary, #0b0f19)',
        color: 'var(--text-primary, #f8fafc)',
      }}
      className="kairo-console-launcher w-screen h-screen overflow-hidden flex flex-col relative select-none"
    >
      {/* ========================================================================= */}
      {/* 1. TOP BAR : Logo / Statut / Horloge / Profil                           */}
      {/* ========================================================================= */}
      <header className="kairo-launcher-topbar absolute top-0 inset-x-0 z-30 px-8 py-5 flex items-center justify-between pointer-events-none">
        {/* Marque / Titre Kaïro */}
        <div className="flex items-center gap-3 pointer-events-auto">
          <img src="/logo.png" alt="KaïroOS" className="w-8 h-8 object-contain drop-shadow-md" />
          <span className="text-xl font-black tracking-wider drop-shadow-md text-white">
            Kaïro
          </span>
          {activeSystem && (
            <span
              style={{
                backgroundColor: 'rgba(255,255,255,0.15)',
                borderColor: 'rgba(255,255,255,0.2)',
              }}
              className="px-2.5 py-0.5 rounded-full border text-[11px] font-mono font-bold uppercase tracking-wider backdrop-blur-md"
            >
              {activeSystem.name}
            </span>
          )}
        </div>

        {/* Profil & Horloge temps réel */}
        <div className="flex items-center gap-4 pointer-events-auto">
          {/* Indicateur manette */}
          <button
            onClick={onOpenGamepadSettings}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-black/40 hover:bg-black/60 border border-white/10 backdrop-blur-md text-xs font-bold text-slate-200 transition-all cursor-pointer"
            title="Configuration Manettes"
          >
            <Gamepad2
              className={`w-3.5 h-3.5 ${
                gamepadConnected ? 'text-emerald-400' : 'text-slate-400'
              }`}
            />
            <span className="hidden sm:inline">
              {gamepadConnected ? gamepadName || 'Manette 1' : 'Clavier'}
            </span>
          </button>

          {/* Raccourci Paramètres */}
          <button
            onClick={onOpenSettings}
            className="p-2 rounded-full bg-black/40 hover:bg-black/60 border border-white/10 backdrop-blur-md text-slate-200 transition-all cursor-pointer"
            title="Paramètres Kaïro"
          >
            <SettingsIcon className="w-4 h-4" />
          </button>

          {/* Avatar & Horloge */}
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-black/40 border border-white/10 backdrop-blur-md text-xs font-mono font-bold text-white shadow-sm">
            <User className="w-3.5 h-3.5 text-slate-300" />
            <span>{currentTime || '12:00'}</span>
          </div>
        </div>
      </header>

      {/* ========================================================================= */}
      {/* 2. ZONE HERO SUPÉRIEURE (Image Géante + Titre + Étoiles + Actions)        */}
      {/* ========================================================================= */}
      <section
        style={{
          height: 'var(--hero-height, 56vh)',
        }}
        className="kairo-hero relative w-full flex flex-col justify-end px-8 sm:px-12 pb-6 shrink-0 overflow-hidden"
      >
        {/* Artwork HD / Backdrop géant avec transition en fondu */}
        <div className="kairo-hero-backdrop absolute inset-0 z-0 overflow-hidden pointer-events-none">
          {heroBackdropUrl ? (
            <img
              key={currentFocusedGame?.id}
              src={heroBackdropUrl}
              alt={currentFocusedGame?.title || 'Hero'}
              style={{
                filter: 'blur(var(--hero-backdrop-blur, 0px))',
              }}
              className="w-full h-full object-cover object-center scale-105 animate-fadeIn transition-all duration-500"
            />
          ) : (
            <div
              style={{
                background:
                  'radial-gradient(circle at 75% 30%, var(--accent-primary, #6366f1) 0%, #0a0e17 70%)',
              }}
              className="w-full h-full"
            />
          )}

          {/* Masque dégradé sombre horizontal et vertical */}
          <div
            style={{
              background: `linear-gradient(to top, var(--bg-primary, #0b0f19) 0%, rgba(11, 15, 25, var(--hero-gradient-opacity, 0.75)) 50%, rgba(11, 15, 25, 0.3) 100%)`,
            }}
            className="absolute inset-0"
          />
          <div
            style={{
              background: `linear-gradient(to right, var(--bg-primary, #0b0f19) 0%, rgba(11, 15, 25, 0.8) 45%, transparent 100%)`,
            }}
            className="absolute inset-0"
          />
        </div>

        {/* Contenu textuel et boutons d'action du Hero */}
        <div className="kairo-hero-content relative z-10 max-w-2xl space-y-3 drop-shadow-lg animate-fadeIn">
          {/* Titre du jeu actif */}
          <h1 className="kairo-hero-title text-3xl sm:text-4xl md:text-5xl font-black uppercase tracking-tight text-white leading-none line-clamp-2">
            {currentFocusedGame ? currentFocusedGame.title : 'Aucun jeu sélectionné'}
          </h1>

          {/* Étoiles & Métadonnées */}
          <div className="kairo-hero-meta flex flex-wrap items-center gap-3 pt-1">
            {/* Étoiles */}
            <div className="flex items-center gap-1">
              {[...Array(5)].map((_, i) => (
                <Star
                  key={i}
                  className={`w-4 h-4 ${
                    i < ratingStars
                      ? 'text-amber-400 fill-amber-400'
                      : 'text-white/20'
                  }`}
                />
              ))}
              <span className="text-xs font-mono font-bold text-slate-200 ml-1">
                {activeRating.toFixed(1)}
              </span>
            </div>

            <span className="text-white/30">•</span>

            {/* Console / Genre / Joueurs */}
            <div className="flex items-center gap-2 text-xs font-bold font-sans tracking-wider uppercase text-slate-300">
              {activeSystem && <span>{activeSystem.name}</span>}
              <span>•</span>
              <span>{activeGenre}</span>
              <span>•</span>
              <span>{activePlayers} {activePlayers > 1 ? 'Joueurs' : 'Joueur'}</span>
            </div>
          </div>

          {/* Synopsis court si présent */}
          {currentFocusedGame?.synopsis && (
            <p className="text-xs sm:text-sm text-slate-300 line-clamp-2 leading-relaxed opacity-90 max-w-xl">
              {currentFocusedGame.synopsis}
            </p>
          )}

          {/* Boutons d'action du Hero (reliés aux actions réelles) */}
          <div className="kairo-hero-actions flex items-center gap-3 pt-2">
            {/* Bouton Principal [A JOUER] */}
            <button
              onClick={handleConfirm}
              style={{
                backgroundColor: 'var(--accent-primary, #f43f5e)',
              }}
              className="kairo-hero-btn-play flex items-center gap-2.5 px-7 py-3 rounded-2xl text-white font-black text-sm uppercase tracking-wider shadow-xl hover:scale-105 active:scale-95 transition-all cursor-pointer group"
            >
              <span className="w-5 h-5 rounded-full bg-white/20 flex items-center justify-center text-[11px] font-mono font-black group-hover:bg-white group-hover:text-black transition-colors">
                A
              </span>
              <Play className="w-4 h-4 fill-white" />
              <span>JOUER</span>
            </button>

            {/* Bouton [X] Favori */}
            <button
              onClick={handleToggleFav}
              style={{
                backgroundColor: currentFocusedGame?.favorite
                  ? 'rgba(244, 63, 94, 0.25)'
                  : 'rgba(255, 255, 255, 0.1)',
                borderColor: currentFocusedGame?.favorite
                  ? 'var(--accent-primary, #f43f5e)'
                  : 'rgba(255, 255, 255, 0.15)',
              }}
              className="kairo-hero-btn-action flex items-center gap-2 px-4 py-3 rounded-2xl border text-white font-bold text-xs hover:bg-white/20 active:scale-95 transition-all cursor-pointer backdrop-blur-md"
              title="Ajouter ou retirer des favoris"
            >
              <span className="w-4 h-4 rounded-full bg-white/20 flex items-center justify-center text-[10px] font-mono font-black">
                X
              </span>
              <Heart
                className={`w-3.5 h-3.5 ${
                  currentFocusedGame?.favorite ? 'fill-rose-400 text-rose-400' : 'text-white'
                }`}
              />
              <span>{currentFocusedGame?.favorite ? 'Favori' : 'Favori'}</span>
            </button>

            {/* Bouton [Y] Options */}
            <button
              onClick={handleOpenDetails}
              className="kairo-hero-btn-action flex items-center gap-2 px-4 py-3 rounded-2xl border border-white/15 bg-white/10 hover:bg-white/20 active:scale-95 text-white font-bold text-xs transition-all cursor-pointer backdrop-blur-md"
              title="Afficher les détails et options du jeu"
            >
              <span className="w-4 h-4 rounded-full bg-white/20 flex items-center justify-center text-[10px] font-mono font-black">
                Y
              </span>
              <Sliders className="w-3.5 h-3.5 text-white" />
              <span>Options</span>
            </button>
          </div>
        </div>
      </section>

      {/* ========================================================================= */}
      {/* 3. CARROUSEL HORIZONTAL DE JEUX                                          */}
      {/* ========================================================================= */}
      <section className="kairo-carousel-area flex-1 flex flex-col justify-center px-8 sm:px-12 min-h-0 overflow-hidden">
        {/* Sélecteur de plateformes / consoles rapide (LB / RB) */}
        {availableSystems.length > 1 && (
          <div className="flex items-center gap-2 mb-3 shrink-0">
            <span className="px-1.5 py-0.5 rounded text-[10px] font-mono font-black bg-white/10 text-white border border-white/15">
              LB
            </span>
            <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-none py-1">
              <button
                onClick={() => {
                  setSelectedSystemId(null);
                  setFocusedIndex(0);
                }}
                style={{
                  backgroundColor:
                    selectedSystemId === null
                      ? 'var(--accent-primary, #f43f5e)'
                      : 'rgba(255,255,255,0.08)',
                  borderColor:
                    selectedSystemId === null
                      ? 'var(--accent-primary, #f43f5e)'
                      : 'transparent',
                }}
                className="px-3 py-1 rounded-xl text-xs font-bold text-white transition-all hover:bg-white/20 shrink-0"
              >
                TOUS LES JEUX ({allGames.length})
              </button>

              {availableSystems.map((sys) => {
                const isSelected = selectedSystemId === sys.id;
                const count = allGames.filter((g) => g.system_id === sys.id).length;
                return (
                  <button
                    key={sys.id}
                    onClick={() => {
                      setSelectedSystemId(sys.id);
                      setFocusedIndex(0);
                    }}
                    style={{
                      backgroundColor: isSelected
                        ? 'var(--accent-primary, #f43f5e)'
                        : 'rgba(255,255,255,0.08)',
                      borderColor: isSelected
                        ? 'var(--accent-primary, #f43f5e)'
                        : 'transparent',
                    }}
                    className="flex items-center gap-1.5 px-3 py-1 rounded-xl text-xs font-bold text-white transition-all hover:bg-white/20 shrink-0"
                  >
                    <ConsoleLogo systemId={sys.id} className="w-3.5 h-3.5 object-contain" />
                    <span>{sys.name}</span>
                    <span className="text-[10px] opacity-75 font-mono">({count})</span>
                  </button>
                );
              })}
            </div>
            <span className="px-1.5 py-0.5 rounded text-[10px] font-mono font-black bg-white/10 text-white border border-white/15">
              RB
            </span>
          </div>
        )}

        {/* Rangée défilante horizontale */}
        <div className="kairo-carousel flex items-center gap-5 overflow-x-auto py-4 scrollbar-none">
          {activeGames.map((game, idx) => {
            const isFocused = idx === focusedIndex;
            const coverUrl = getImageUrl(game.cover_url || game.backdrop_url);

            return (
              <div
                key={game.id}
                ref={(el) => {
                  cardRefs.current[game.id] = el;
                }}
                onClick={() => {
                  setFocusedIndex(idx);
                  onSelectGame(game);
                }}
                data-active={isFocused ? 'true' : 'false'}
                style={{
                  width: 'clamp(150px, 16vw, 220px)',
                  aspectRatio: 'var(--card-aspect, 3/4)',
                  borderRadius: 'var(--card-radius, 18px)',
                  borderColor: isFocused
                    ? 'var(--accent-primary, #f43f5e)'
                    : 'rgba(255, 255, 255, 0.12)',
                }}
                className={`kairo-carousel-card shrink-0 relative overflow-hidden border-2 cursor-pointer transition-all duration-300 group shadow-lg ${
                  isFocused
                    ? 'kairo-carousel-card-focused scale-110 z-20 shadow-2xl ring-4 ring-offset-2 ring-offset-black'
                    : 'scale-95 opacity-75 hover:opacity-100 hover:scale-100'
                }`}
              >
                {/* Image de jaquette */}
                {coverUrl ? (
                  <img
                    src={coverUrl}
                    alt={game.title}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                    loading="lazy"
                  />
                ) : (
                  <div className="w-full h-full flex flex-col items-center justify-center p-3 bg-slate-800 text-center">
                    <span className="text-xs font-black uppercase line-clamp-3 text-slate-200">
                      {game.title}
                    </span>
                  </div>
                )}

                {/* Badge Favori */}
                {game.favorite && (
                  <div className="absolute top-2.5 right-2.5 z-10">
                    <div className="p-1 rounded-full bg-rose-500 text-white shadow-md">
                      <Heart className="w-3 h-3 fill-current" />
                    </div>
                  </div>
                )}

                {/* Bandeau inférieur avec titre au focus */}
                <div
                  className={`absolute inset-x-0 bottom-0 p-2.5 bg-gradient-to-t from-black/90 via-black/60 to-transparent transition-opacity ${
                    isFocused ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'
                  }`}
                >
                  <div className="text-xs font-black text-white truncate text-center">
                    {game.title}
                  </div>
                </div>
              </div>
            );
          })}

          {activeGames.length === 0 && (
            <div className="w-full text-center py-12 text-slate-400 font-bold text-sm">
              Aucun jeu trouvé pour cette console.
            </div>
          )}
        </div>
      </section>

      {/* ========================================================================= */}
      {/* 4. BARRE DE CONTRÔLE INFÉRIEURE (Aide Manette & Raccourcis)                */}
      {/* ========================================================================= */}
      <footer className="kairo-controller-bar shrink-0 px-8 py-3.5 bg-black/60 backdrop-blur-md border-t border-white/10 flex items-center justify-between z-30">
        <div className="flex flex-wrap items-center gap-5 text-xs font-bold text-slate-300 font-mono">
          <div className="flex items-center gap-1.5">
            <span className="w-5 h-5 rounded-full bg-white/20 text-white flex items-center justify-center text-[11px] font-black">
              A
            </span>
            <span className="text-white">OUVRIR / JOUER</span>
          </div>

          <div className="flex items-center gap-1.5">
            <span className="w-5 h-5 rounded-full bg-white/20 text-white flex items-center justify-center text-[11px] font-black">
              X
            </span>
            <span>FAVORI</span>
          </div>

          <div className="flex items-center gap-1.5">
            <span className="px-2 py-0.5 rounded-md bg-white/20 text-white text-[10px] font-black">
              LB / RB
            </span>
            <span>SYSTÈMES</span>
          </div>

          <div className="flex items-center gap-1.5">
            <span className="w-5 h-5 rounded-full bg-white/20 text-white flex items-center justify-center text-[11px] font-black">
              B
            </span>
            <span>PARAMÈTRES</span>
          </div>

          <div className="flex items-center gap-1.5">
            <span className="w-5 h-5 rounded-full bg-white/20 text-white flex items-center justify-center text-[11px] font-black">
              Y
            </span>
            <span>OPTIONS</span>
          </div>
        </div>

        {/* Compteur de jeux */}
        <div className="text-xs font-mono font-bold text-slate-400">
          {activeGames.length > 0 ? `${focusedIndex + 1} / ${activeGames.length} JEUX` : '0 JEU'}
        </div>
      </footer>
    </div>
  );
};
