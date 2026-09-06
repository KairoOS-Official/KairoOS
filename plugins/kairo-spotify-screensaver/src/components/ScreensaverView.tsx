import React, { useEffect, useRef, useState, useMemo } from 'react';
import { SpotifyTrack } from '../services/spotify';
import { LyricLine } from '../services/lyrics';
import { extractDominantColor, ExtractedColor } from '../services/color';
import { useKairoTheme } from '../services/theme';
import {
  Disc,
  Music,
  Wifi,
  X,
  Volume2,
  Minimize2,
  Sparkles,
  Radio,
  Play,
  Pause,
  SkipBack,
  SkipForward,
  Heart,
  Shuffle,
  Gamepad2,
} from 'lucide-react';

export interface ScreensaverDisplaySettings {
  showCover?: boolean;
  showLyrics?: boolean;
  overlayBrightness?: number; // 10 to 100
  displayLayout?: 'karaoke' | 'immersive';
  lyricsFontSize?: 'small' | 'medium' | 'large' | 'xlarge';
  coverSize?: 'small' | 'medium' | 'large';
  vinylRotation?: boolean;
  blurBackground?: boolean;
  showControls?: boolean;
  showProgressBar?: boolean;
  showPlaylistName?: boolean;
  transitionSpeed?: 'instant' | 'fast' | 'smooth';
  lyricsHighlightColor?: string;
}

interface ScreensaverViewProps {
  track: SpotifyTrack | null;
  lyrics: LyricLine[];
  currentProgressMs: number;
  onExit: () => void;
  onMinimize?: () => void;
  isBornePlaying?: boolean;
  isDemo?: boolean;
  displaySettings?: ScreensaverDisplaySettings;
  onTogglePlay?: () => void;
  onNext?: () => void;
  onPrevious?: () => void;
  onToggleFavorite?: () => void;
  onToggleShuffle?: () => void;
  isFavorite?: boolean;
  isShuffle?: boolean;
}

export const ScreensaverView: React.FC<ScreensaverViewProps> = ({
  track,
  lyrics,
  currentProgressMs,
  onExit,
  onMinimize,
  isBornePlaying = false,
  isDemo,
  displaySettings,
  onTogglePlay,
  onNext,
  onPrevious,
  onToggleFavorite,
  onToggleShuffle,
  isFavorite = false,
  isShuffle = false,
}) => {
  const lyricsContainerRef = useRef<HTMLDivElement>(null);
  const { isDark } = useKairoTheme();

  // Options graphiques
  const layout = displaySettings?.displayLayout || 'karaoke';
  const showCover = displaySettings?.showCover ?? true;
  const showLyrics = displaySettings?.showLyrics ?? true;
  const overlayBrightness = displaySettings?.overlayBrightness ?? 80;
  const lyricsFontSize = displaySettings?.lyricsFontSize || 'large';
  const coverSize = displaySettings?.coverSize || 'medium';
  const vinylRotation = displaySettings?.vinylRotation ?? true;
  const blurBackground = displaySettings?.blurBackground ?? true;
  const showControls = displaySettings?.showControls ?? true;
  const showProgressBar = displaySettings?.showProgressBar ?? true;
  const showPlaylistName = displaySettings?.showPlaylistName ?? true;
  const transitionSpeed = displaySettings?.transitionSpeed || 'smooth';
  const lyricsHighlightColor = displaySettings?.lyricsHighlightColor || 'accent';

  // Extraction couleur dominante avec ColorThief
  const [dominantColor, setDominantColor] = useState<ExtractedColor>({
    hex: '#10b981',
    rgb: [16, 185, 129],
    isDark: true,
  });

  useEffect(() => {
    if (track?.coverUrl) {
      extractDominantColor(track.coverUrl).then((c) => {
        setDominantColor(c);
      });
    }
  }, [track?.coverUrl]);

  const isTrackActive = Boolean(track && track.title && track.isPlaying);

  // Navigation manette intégrée (A = Play/Pause, Y = Favori, D-Pad = Précédent/Suivant, B = Quitter)
  useEffect(() => {
    let animFrame: number;
    let lastButtonPress = 0;

    const pollGamepad = () => {
      const gamepads = typeof navigator.getGamepads === 'function' ? navigator.getGamepads() : [];
      const gp = gamepads[0] || gamepads[1];
      if (gp) {
        const now = Date.now();
        if (now - lastButtonPress > 300) {
          // A (Bouton 0) -> Play/Pause
          if (gp.buttons[0]?.pressed && onTogglePlay) {
            lastButtonPress = now;
            onTogglePlay();
          }
          // Y (Bouton 3) -> Favori
          else if (gp.buttons[3]?.pressed && onToggleFavorite) {
            lastButtonPress = now;
            onToggleFavorite();
          }
          // D-Pad Gauche (Bouton 14 ou axe < -0.6) -> Précédent
          else if ((gp.buttons[14]?.pressed || gp.axes[0] < -0.6) && onPrevious) {
            lastButtonPress = now;
            onPrevious();
          }
          // D-Pad Droite (Bouton 15 ou axe > 0.6) -> Suivant
          else if ((gp.buttons[15]?.pressed || gp.axes[0] > 0.6) && onNext) {
            lastButtonPress = now;
            onNext();
          }
          // B (Bouton 1) -> Quitter
          else if (gp.buttons[1]?.pressed) {
            lastButtonPress = now;
            onExit();
          }
        }
      }
      animFrame = requestAnimationFrame(pollGamepad);
    };

    animFrame = requestAnimationFrame(pollGamepad);
    return () => cancelAnimationFrame(animFrame);
  }, [onTogglePlay, onToggleFavorite, onPrevious, onNext, onExit]);

  // Index de la ligne active
  const activeLyricIndex = lyrics.reduce((acc, line, idx) => {
    if (line.timeMs <= currentProgressMs) {
      return idx;
    }
    return acc;
  }, -1);

  // Défilement automatique centré
  useEffect(() => {
    if (activeLyricIndex >= 0 && lyricsContainerRef.current) {
      const activeElem = lyricsContainerRef.current.children[activeLyricIndex] as HTMLElement;
      if (activeElem) {
        activeElem.scrollIntoView({
          behavior: transitionSpeed === 'instant' ? 'auto' : 'smooth',
          block: 'center',
        });
      }
    }
  }, [activeLyricIndex, transitionSpeed]);

  const formatTime = (ms: number) => {
    const totalSeconds = Math.floor(ms / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  const progressPercent = track?.durationMs
    ? Math.min(100, Math.max(0, (currentProgressMs / track.durationMs) * 100))
    : 0;

  // Calcul des classes de taille de pochette
  const coverSizeClasses = useMemo(() => {
    switch (coverSize) {
      case 'small':
        return 'w-44 h-44 md:w-56 md:h-56';
      case 'large':
        return 'w-64 h-64 md:w-88 md:h-88';
      case 'medium':
      default:
        return 'w-56 h-56 md:w-72 md:h-72';
    }
  }, [coverSize]);

  // Classes de taille de paroles
  const lyricsFontClass = useMemo(() => {
    switch (lyricsFontSize) {
      case 'small':
        return {
          active: 'text-xl md:text-2xl',
          normal: 'text-base md:text-lg',
        };
      case 'medium':
        return {
          active: 'text-2xl md:text-3xl',
          normal: 'text-lg md:text-xl',
        };
      case 'xlarge':
        return {
          active: 'text-4xl md:text-5xl',
          normal: 'text-2xl md:text-3xl',
        };
      case 'large':
      default:
        return {
          active: 'text-3xl md:text-4xl',
          normal: 'text-xl md:text-2xl',
        };
    }
  }, [lyricsFontSize]);

  // Vitesse de transition
  const transitionClass = useMemo(() => {
    switch (transitionSpeed) {
      case 'instant':
        return 'transition-none';
      case 'fast':
        return 'transition-all duration-150';
      case 'smooth':
      default:
        return 'transition-all duration-500';
    }
  }, [transitionSpeed]);

  // Style de couleur active pour les paroles
  const activeLyricStyle = useMemo(() => {
    if (lyricsHighlightColor === 'accent') {
      return {
        color: 'var(--kairo-accent-primary, #10b981)',
        textShadow: '0 0 20px var(--kairo-accent-primary, rgba(16, 185, 129, 0.4))',
      };
    }
    return {
      color: lyricsHighlightColor,
      textShadow: `0 0 20px ${lyricsHighlightColor}66`,
    };
  }, [lyricsHighlightColor]);

  // Contrôles de lecture réutilisables
  const renderPlaybackControls = (centered = false) => {
    if (!showControls) return null;
    return (
      <div className={`flex items-center gap-3 pt-2 ${centered ? 'justify-center' : 'justify-start'}`}>
        {/* Shuffle */}
        <button
          onClick={onToggleShuffle}
          className={`p-2.5 rounded-full transition-all cursor-pointer ${
            isShuffle
              ? 'text-[var(--kairo-accent-primary,#10b981)] bg-white/15 shadow-sm'
              : 'text-[var(--kairo-text-secondary,#94a1b2)] hover:text-[var(--kairo-text-primary,#ffffff)] bg-white/5 hover:bg-white/10'
          }`}
          title="Mode Aléatoire"
        >
          <Shuffle className="w-4 h-4" />
        </button>

        {/* Précédent */}
        <button
          onClick={onPrevious}
          className="p-2.5 rounded-full text-[var(--kairo-text-primary,#ffffff)] hover:scale-110 active:scale-95 bg-white/10 hover:bg-white/20 transition-all cursor-pointer"
          title="Morceau Précédent (D-Pad Gauche)"
        >
          <SkipBack className="w-5 h-5 fill-current" />
        </button>

        {/* Play / Pause */}
        <button
          onClick={onTogglePlay}
          className="p-4 rounded-full text-slate-950 hover:scale-110 active:scale-95 transition-all cursor-pointer shadow-xl flex items-center justify-center"
          style={{ backgroundColor: 'var(--kairo-accent-primary, #10b981)' }}
          title="Lecture / Pause (Touche A)"
        >
          {track?.isPlaying ? (
            <Pause className="w-6 h-6 fill-current text-slate-950" />
          ) : (
            <Play className="w-6 h-6 fill-current text-slate-950 ml-0.5" />
          )}
        </button>

        {/* Suivant */}
        <button
          onClick={onNext}
          className="p-2.5 rounded-full text-[var(--kairo-text-primary,#ffffff)] hover:scale-110 active:scale-95 bg-white/10 hover:bg-white/20 transition-all cursor-pointer"
          title="Morceau Suivant (D-Pad Droite)"
        >
          <SkipForward className="w-5 h-5 fill-current" />
        </button>

        {/* Favori */}
        <button
          onClick={onToggleFavorite}
          className={`p-2.5 rounded-full transition-all cursor-pointer ${
            isFavorite
              ? 'text-rose-500 bg-rose-500/15 shadow-sm'
              : 'text-[var(--kairo-text-secondary,#94a1b2)] hover:text-rose-400 bg-white/5 hover:bg-white/10'
          }`}
          title="Ajouter aux favoris (Touche Y)"
        >
          <Heart className={`w-4 h-4 ${isFavorite ? 'fill-current' : ''}`} />
        </button>
      </div>
    );
  };

  return (
    <div
      className={`fixed inset-0 z-50 flex flex-col justify-between overflow-hidden select-none ${transitionClass}`}
      style={{
        backgroundColor: 'var(--kairo-bg-primary, #0b0f19)',
        color: 'var(--kairo-text-primary, #f8fafc)',
      }}
    >
      {/* Fond immersif flouté avec la pochette ou couleur dominante */}
      {isTrackActive && (
        <>
          {layout === 'immersive' && blurBackground ? (
            // Fond immersif : Dégradé radial flou basé sur la couleur dominante
            <div
              className="absolute inset-0 pointer-events-none filter blur-3xl scale-125 transition-all duration-1000"
              style={{
                background: `radial-gradient(circle at 50% 40%, ${dominantColor.hex} 0%, rgba(11, 15, 25, 0.95) 75%)`,
                opacity: Math.max(0.15, Math.min(1.0, (overlayBrightness / 100) * 0.75)),
              }}
            />
          ) : (
            // Fond standard karaoké flouté avec la jaquette
            track?.coverUrl && (
              <div
                className="absolute inset-0 bg-cover bg-center scale-110 filter blur-3xl pointer-events-none transition-all duration-1000"
                style={{
                  backgroundImage: `url(${track.coverUrl})`,
                  opacity: Math.max(0.05, Math.min(1.0, (overlayBrightness / 100) * 0.45)),
                }}
              />
            )
          )}
        </>
      )}

      {/* Voile dégradé d'assombrissement adaptatif au thème */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background: isDark
            ? 'linear-gradient(to top, rgba(11, 15, 25, 0.9) 0%, rgba(11, 15, 25, 0.6) 60%, rgba(11, 15, 25, 0.4) 100%)'
            : 'linear-gradient(to top, rgba(248, 250, 252, 0.92) 0%, rgba(248, 250, 252, 0.65) 60%, rgba(248, 250, 252, 0.4) 100%)',
        }}
      />

      {/* Barre supérieure : Indicateur Connect, Infos Playlist & Actions */}
      <header
        className="relative z-10 p-5 md:px-8 flex items-center justify-between border-b backdrop-blur-md"
        style={{
          borderColor: 'var(--kairo-border-color, rgba(255, 255, 255, 0.1))',
          backgroundColor: isDark ? 'rgba(11, 15, 25, 0.5)' : 'rgba(255, 255, 255, 0.7)',
        }}
      >
        <div className="flex items-center gap-3">
          <div
            className="w-2.5 h-2.5 rounded-full animate-pulse"
            style={{ backgroundColor: 'var(--kairo-accent-primary, #10b981)' }}
          />
          <div
            className="flex items-center gap-1.5 text-xs font-bold font-mono tracking-wider uppercase"
            style={{ color: 'var(--kairo-accent-primary, #10b981)' }}
          >
            <Wifi className="w-3.5 h-3.5" />
            <span>Spotify Connect : {track?.deviceName || 'Borne Kaïro'}</span>
          </div>
          {showPlaylistName && track?.playlistName && (
            <span
              className="px-2.5 py-0.5 rounded-full text-[10px] font-bold border"
              style={{
                borderColor: 'var(--kairo-border-color, rgba(255, 255, 255, 0.15))',
                backgroundColor: 'var(--kairo-bg-card, rgba(255, 255, 255, 0.05))',
                color: 'var(--kairo-text-secondary, #94a1b2)',
              }}
            >
              ♫ {track.playlistName}
            </span>
          )}
          {isDemo && (
            <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-purple-600 text-white shadow-xs">
              Simulation Démo Active
            </span>
          )}
        </div>

        <div className="flex items-center gap-2">
          {onMinimize && (
            <button
              onClick={onMinimize}
              className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl border text-xs font-bold transition-all cursor-pointer shadow-xs"
              style={{
                borderColor: 'var(--kairo-accent-secondary, #38bdf8)',
                color: 'var(--kairo-accent-secondary, #38bdf8)',
                backgroundColor: 'rgba(56, 189, 248, 0.1)',
              }}
              title="Réduire en mini-lecteur flottant (Touche Inser)"
            >
              <Minimize2 className="w-4 h-4" />
              <span>Minimiser</span>
            </button>
          )}

          <button
            onClick={onExit}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs font-semibold transition-all cursor-pointer"
            style={{
              borderColor: 'var(--kairo-border-color, rgba(255, 255, 255, 0.2))',
              backgroundColor: 'var(--kairo-bg-card, rgba(255, 255, 255, 0.05))',
              color: 'var(--kairo-text-primary, #f8fafc)',
            }}
          >
            <X className="w-4 h-4" />
            <span>Fermer</span>
          </button>
        </div>
      </header>

      {/* État quand AUCUNE musique n'est lancée */}
      {!isTrackActive && (
        <main className="relative z-10 flex-1 flex flex-col items-center justify-center text-center p-6 md:p-12 space-y-6">
          <div className="relative">
            <div
              className="w-32 h-32 rounded-full border flex items-center justify-center shadow-2xl animate-pulse"
              style={{
                borderColor: 'var(--kairo-border-color, rgba(255, 255, 255, 0.1))',
                backgroundColor: 'var(--kairo-bg-card, rgba(255, 255, 255, 0.05))',
              }}
            >
              <Music className="w-14 h-14" style={{ color: 'var(--kairo-accent-primary, #10b981)' }} />
            </div>
            <div
              className="absolute -bottom-1 -right-1 p-2 rounded-xl border shadow-lg"
              style={{
                borderColor: 'var(--kairo-accent-primary, #10b981)',
                backgroundColor: 'var(--kairo-bg-secondary, #111827)',
              }}
            >
              <Radio className="w-4 h-4" style={{ color: 'var(--kairo-accent-primary, #10b981)' }} />
            </div>
          </div>

          <div className="space-y-2 max-w-lg">
            <h1 className="text-2xl md:text-3xl font-black tracking-tight" style={{ color: 'var(--kairo-text-primary, #ffffff)' }}>
              Aucune musique en cours de lecture
            </h1>
            <p className="text-sm md:text-base font-medium" style={{ color: 'var(--kairo-text-secondary, #94a1b2)' }}>
              Connectez-vous à la <span className="font-bold" style={{ color: 'var(--kairo-accent-primary, #10b981)' }}>« Borne Kaïro »</span> depuis l'application Spotify de votre smartphone pour afficher les paroles karaoké en direct.
            </p>
          </div>

          <div
            className="flex items-center gap-3 p-3 rounded-2xl border text-xs font-mono"
            style={{
              borderColor: 'var(--kairo-border-color, rgba(255, 255, 255, 0.1))',
              backgroundColor: 'var(--kairo-bg-card, rgba(255, 255, 255, 0.05))',
              color: 'var(--kairo-text-secondary, #94a1b2)',
            }}
          >
            <div className="w-2 h-2 rounded-full bg-emerald-500 animate-ping" />
            <span>Appareil Spotify Connect prêt et en attente d'un flux audio</span>
          </div>
        </main>
      )}

      {/* CAS 1 : LAYOUT "IMMERSIV" (Inspiré Spotify Now Playing / Ambiance immersive) */}
      {isTrackActive && track && layout === 'immersive' && (
        <main className="relative z-10 flex-1 flex flex-col items-center justify-center p-6 md:p-10 overflow-hidden">
          <div className="w-full max-w-5xl flex flex-col md:flex-row items-center justify-center gap-8 md:gap-14 my-auto">
            {/* Centre/Gauche : Grande pochette avec ombre douce teintée par la couleur dominante */}
            {showCover && (
              <div className="flex flex-col items-center shrink-0 space-y-5">
                <div className="relative group">
                  {/* Effet vinyle optionnel */}
                  {vinylRotation && (
                    <div
                      className={`absolute -right-6 -bottom-6 ${coverSizeClasses} rounded-full border-4 shadow-2xl flex items-center justify-center ${
                        track.isPlaying ? 'animate-spin-slow' : ''
                      }`}
                      style={{
                        backgroundColor: '#0a0d14',
                        borderColor: dominantColor.hex,
                      }}
                    >
                      <div className="w-20 h-20 rounded-full border-4 border-slate-800 bg-black flex items-center justify-center">
                        <Disc className="w-8 h-8 text-slate-500" />
                      </div>
                    </div>
                  )}

                  <div
                    className={`relative ${coverSizeClasses} rounded-3xl overflow-hidden border-2 shadow-2xl transition-transform duration-500 hover:scale-[1.02]`}
                    style={{
                      borderColor: 'var(--kairo-border-color, rgba(255, 255, 255, 0.2))',
                      boxShadow: `0 20px 50px -10px ${dominantColor.hex}55`,
                      backgroundColor: 'var(--kairo-bg-card, #1e293b)',
                    }}
                  >
                    {track.coverUrl ? (
                      <img
                        src={track.coverUrl}
                        alt={track.title}
                        className="w-full h-full object-cover select-none"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-slate-600">
                        <Music className="w-16 h-16 opacity-40" />
                      </div>
                    )}
                  </div>
                </div>

                {/* Titre & Artiste en grand sous la pochette */}
                <div className="text-center space-y-1 max-w-md">
                  <h1
                    className="text-2xl md:text-3xl font-black tracking-tight line-clamp-1"
                    style={{ color: 'var(--kairo-text-primary, #ffffff)' }}
                  >
                    {track.title}
                  </h1>
                  <p
                    className="text-base md:text-lg font-bold line-clamp-1"
                    style={{ color: 'var(--kairo-accent-primary, #10b981)' }}
                  >
                    {track.artist}
                  </p>
                  <p
                    className="text-xs line-clamp-1"
                    style={{ color: 'var(--kairo-text-muted, #64748b)' }}
                  >
                    {track.album}
                  </p>
                </div>

                {/* Barre de progression & Temps */}
                {showProgressBar && (
                  <div className="w-full max-w-sm space-y-1.5 font-mono text-xs">
                    <div
                      className="w-full h-2 rounded-full overflow-hidden"
                      style={{ backgroundColor: 'rgba(255, 255, 255, 0.15)' }}
                    >
                      <div
                        className="h-full rounded-full transition-all duration-300"
                        style={{
                          width: `${progressPercent}%`,
                          backgroundColor: 'var(--kairo-accent-primary, #10b981)',
                        }}
                      />
                    </div>
                    <div
                      className="flex justify-between text-[11px]"
                      style={{ color: 'var(--kairo-text-secondary, #94a1b2)' }}
                    >
                      <span>{formatTime(currentProgressMs)}</span>
                      <span>{formatTime(track.durationMs)}</span>
                    </div>
                  </div>
                )}

                {/* Contrôles de lecture fonctionnels */}
                {renderPlaybackControls(true)}
              </div>
            )}

            {/* Droite : Paroles immersives grand format */}
            {showLyrics && (
              <div className="flex-1 w-full max-w-lg h-[340px] md:h-[480px] flex flex-col justify-center relative">
                {lyrics.length === 0 ? (
                  <div className="h-full flex flex-col items-center justify-center text-center p-6 space-y-3">
                    <Volume2
                      className="w-12 h-12 opacity-60 animate-pulse"
                      style={{ color: 'var(--kairo-text-muted, #64748b)' }}
                    />
                    <div
                      className="text-base font-bold"
                      style={{ color: 'var(--kairo-text-primary, #f8fafc)' }}
                    >
                      Ambiance Immersive • {track.deviceName}
                    </div>
                    <p
                      className="text-xs max-w-xs"
                      style={{ color: 'var(--kairo-text-muted, #64748b)' }}
                    >
                      Paroles non synchronisées pour ce morceau. Profitez de la musique dans votre espace !
                    </p>
                  </div>
                ) : (
                  <div
                    ref={lyricsContainerRef}
                    className="h-full overflow-y-auto no-scrollbar space-y-6 py-32 px-4 text-center md:text-left"
                  >
                    {lyrics.map((line, idx) => {
                      const isActive = idx === activeLyricIndex;
                      const isPast = idx < activeLyricIndex;

                      return (
                        <p
                          key={idx}
                          style={isActive ? activeLyricStyle : undefined}
                          className={`${transitionClass} font-bold leading-relaxed cursor-default ${
                            isActive
                              ? `${lyricsFontClass.active} scale-105 origin-left`
                              : isPast
                              ? `${lyricsFontClass.normal} opacity-40`
                              : `${lyricsFontClass.normal} opacity-70`
                          }`}
                        >
                          {line.text}
                        </p>
                      );
                    })}
                  </div>
                )}
              </div>
            )}
          </div>
        </main>
      )}

      {/* CAS 2 : LAYOUT "KARAOKE" (Standard épuré 2 colonnes avec focus défilement paroles) */}
      {isTrackActive && track && layout === 'karaoke' && (
        <main className="relative z-10 flex-1 flex items-center justify-center p-6 md:p-12 overflow-hidden">
          <div className="w-full max-w-7xl grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
            {/* Colonne Gauche : Pochette vinyle tournante */}
            {showCover && (
              <div className="lg:col-span-5 flex flex-col items-center justify-center text-center space-y-5">
                <div className="relative group">
                  {vinylRotation && (
                    <div
                      className={`absolute -right-6 -bottom-6 ${coverSizeClasses} rounded-full border-4 shadow-2xl flex items-center justify-center ${
                        track.isPlaying ? 'animate-spin-slow' : ''
                      }`}
                      style={{
                        backgroundColor: '#0f172a',
                        borderColor: '#1e293b',
                      }}
                    >
                      <div className="w-20 h-20 rounded-full border-4 border-slate-700 bg-black flex items-center justify-center">
                        <Disc className="w-8 h-8 text-slate-600" />
                      </div>
                    </div>
                  )}

                  <div
                    className={`relative ${coverSizeClasses} rounded-3xl overflow-hidden border-2 shadow-2xl`}
                    style={{
                      borderColor: 'var(--kairo-border-color, rgba(255, 255, 255, 0.2))',
                      backgroundColor: 'var(--kairo-bg-card, #1e293b)',
                    }}
                  >
                    {track.coverUrl ? (
                      <img
                        src={track.coverUrl}
                        alt={track.title}
                        className="w-full h-full object-cover select-none"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-slate-600">
                        <Music className="w-16 h-16 opacity-40" />
                      </div>
                    )}
                  </div>
                </div>

                <div className="space-y-1.5 max-w-sm">
                  <h1
                    className="text-xl md:text-2xl font-black tracking-tight line-clamp-1"
                    style={{ color: 'var(--kairo-text-primary, #ffffff)' }}
                  >
                    {track.title}
                  </h1>
                  <p
                    className="text-sm md:text-base font-bold line-clamp-1"
                    style={{ color: 'var(--kairo-accent-primary, #10b981)' }}
                  >
                    {track.artist}
                  </p>
                  <p
                    className="text-xs line-clamp-1"
                    style={{ color: 'var(--kairo-text-muted, #64748b)' }}
                  >
                    {track.album}
                  </p>
                </div>

                {showProgressBar && (
                  <div className="w-full max-w-xs space-y-1.5 font-mono text-xs">
                    <div
                      className="w-full h-1.5 rounded-full overflow-hidden"
                      style={{ backgroundColor: 'rgba(255, 255, 255, 0.1)' }}
                    >
                      <div
                        className="h-full rounded-full transition-all duration-300"
                        style={{
                          width: `${progressPercent}%`,
                          backgroundColor: 'var(--kairo-accent-primary, #10b981)',
                        }}
                      />
                    </div>
                    <div
                      className="flex justify-between text-[10px]"
                      style={{ color: 'var(--kairo-text-secondary, #94a1b2)' }}
                    >
                      <span>{formatTime(currentProgressMs)}</span>
                      <span>{formatTime(track.durationMs)}</span>
                    </div>
                  </div>
                )}

                {/* Contrôles Karaoké */}
                {renderPlaybackControls(true)}
              </div>
            )}

            {/* Colonne Droite : Paroles Karaoké Défilantes */}
            {showLyrics && (
              <div
                className={`${
                  showCover ? 'lg:col-span-7' : 'lg:col-span-12 max-w-4xl mx-auto'
                } h-[380px] md:h-[520px] flex flex-col justify-center relative`}
              >
                {lyrics.length === 0 ? (
                  <div className="h-full flex flex-col items-center justify-center text-center p-8 space-y-3">
                    <Volume2
                      className="w-12 h-12 opacity-60 animate-pulse"
                      style={{ color: 'var(--kairo-text-muted, #64748b)' }}
                    />
                    <div
                      className="text-base font-bold"
                      style={{ color: 'var(--kairo-text-primary, #f8fafc)' }}
                    >
                      Lecture en cours sur {track.deviceName}
                    </div>
                    <p
                      className="text-xs max-w-sm"
                      style={{ color: 'var(--kairo-text-muted, #64748b)' }}
                    >
                      Pas de paroles synchronisées disponibles sur LRCLIB pour ce titre. Profitez de la musique !
                    </p>
                  </div>
                ) : (
                  <div
                    ref={lyricsContainerRef}
                    className="h-full overflow-y-auto no-scrollbar space-y-6 py-36 px-4"
                  >
                    {lyrics.map((line, idx) => {
                      const isActive = idx === activeLyricIndex;
                      const isPast = idx < activeLyricIndex;

                      return (
                        <p
                          key={idx}
                          style={isActive ? activeLyricStyle : undefined}
                          className={`${transitionClass} font-bold leading-relaxed cursor-default ${
                            isActive
                              ? `${lyricsFontClass.active} scale-105 origin-left`
                              : isPast
                              ? `${lyricsFontClass.normal} opacity-40`
                              : `${lyricsFontClass.normal} opacity-75`
                          }`}
                        >
                          {line.text}
                        </p>
                      );
                    })}
                  </div>
                )}
              </div>
            )}
          </div>
        </main>
      )}

      {/* Footer sobre avec Raccourcis Manette explicites */}
      <footer
        className="relative z-10 p-4 border-t backdrop-blur-md flex items-center justify-between text-[11px] font-mono"
        style={{
          borderColor: 'var(--kairo-border-color, rgba(255, 255, 255, 0.1))',
          backgroundColor: isDark ? 'rgba(11, 15, 25, 0.6)' : 'rgba(255, 255, 255, 0.7)',
          color: 'var(--kairo-text-secondary, #94a1b2)',
        }}
      >
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5 text-xs font-bold" style={{ color: 'var(--kairo-accent-primary, #10b981)' }}>
            <Gamepad2 className="w-4 h-4" />
            <span>Manette :</span>
          </div>
          <span className="hidden sm:inline">
            <kbd className="px-1.5 py-0.5 rounded bg-white/10 font-bold">A</kbd> Play/Pause •{' '}
            <kbd className="px-1.5 py-0.5 rounded bg-white/10 font-bold">Y</kbd> Favori •{' '}
            <kbd className="px-1.5 py-0.5 rounded bg-white/10 font-bold">◄ / ►</kbd> Piste •{' '}
            <kbd className="px-1.5 py-0.5 rounded bg-white/10 font-bold">B</kbd> Fermer
          </span>
        </div>

        <div
          className="font-bold flex items-center gap-1.5"
          style={{ color: 'var(--kairo-accent-primary, #10b981)' }}
        >
          <Sparkles className="w-3.5 h-3.5" />
          <span>Synchronisation Paroles LRCLIB</span>
        </div>
      </footer>
    </div>
  );
};
