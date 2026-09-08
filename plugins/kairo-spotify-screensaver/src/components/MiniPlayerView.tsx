import React, { useState } from 'react';
import { SpotifyTrack } from '../services/spotify';
import { LyricLine } from '../services/lyrics';
import { useKairoTheme } from '../services/theme';
import { Maximize2, Music, X, Sparkles, Play, Pause, SkipForward } from 'lucide-react';

interface MiniPlayerViewProps {
  track: SpotifyTrack | null;
  lyrics: LyricLine[];
  currentProgressMs: number;
  onMaximize: () => void;
  onClose: () => void;
  isDemo?: boolean;
  onTogglePlay?: () => void;
  onNext?: () => void;
}

export const MiniPlayerView: React.FC<MiniPlayerViewProps> = ({
  track,
  lyrics,
  currentProgressMs,
  onMaximize,
  onClose,
  isDemo,
  onTogglePlay,
  onNext,
}) => {
  const { isDark } = useKairoTheme();
  const isPlaying = Boolean(track?.isPlaying);
  const [isExiting, setIsExiting] = useState(false);

  const handleAction = (action: 'maximize' | 'close') => {
    if (action === 'maximize') {
      onMaximize();
    } else {
      if (isExiting) return;
      setIsExiting(true);
      setTimeout(() => {
        onClose();
      }, 200);
    }
  };

  // Recherche de la ligne de parole actuelle
  const activeLyric = lyrics.reduce<LyricLine | null>((acc, line) => {
    if (line.timeMs <= currentProgressMs) {
      return line;
    }
    return acc;
  }, null);

  const progressPercent = track?.durationMs
    ? Math.min(100, Math.max(0, (currentProgressMs / track.durationMs) * 100))
    : 0;

  return (
    <div
      className="w-full h-full backdrop-blur-2xl border rounded-2xl shadow-2xl p-3 flex items-center justify-between gap-3 overflow-hidden select-none group"
      style={{
        backgroundColor: isDark ? 'rgba(11, 15, 25, 0.95)' : 'rgba(248, 250, 252, 0.95)',
        borderColor: 'var(--kairo-border-color, rgba(255, 255, 255, 0.15))',
        color: 'var(--kairo-text-primary, #ffffff)',
      }}
    >
      {/* Fond subtil teinté par la pochette */}
      {track?.coverUrl && isPlaying && (
        <div
          className="absolute inset-0 bg-cover bg-center filter blur-2xl opacity-20 pointer-events-none"
          style={{ backgroundImage: `url(${track.coverUrl})` }}
        />
      )}

      {/* Partie Gauche : Image + Infos */}
      <div className="relative z-10 flex items-center gap-3 min-w-0 flex-1">
        {/* Pochette / Icône */}
        <div
          className="relative w-14 h-14 rounded-xl overflow-hidden shrink-0 border shadow-md"
          style={{
            borderColor: 'var(--kairo-border-color, rgba(255, 255, 255, 0.1))',
            backgroundColor: 'var(--kairo-bg-card, #1e293b)',
          }}
        >
          {track?.coverUrl && isPlaying ? (
            <>
              <img
                src={track.coverUrl}
                alt={track.title}
                className="w-full h-full object-cover"
              />
              <div
                className="absolute bottom-1 right-1 w-2.5 h-2.5 rounded-full border border-slate-950 animate-pulse"
                style={{ backgroundColor: 'var(--kairo-accent-primary, #10b981)' }}
              />
            </>
          ) : (
            <div className="w-full h-full flex items-center justify-center text-slate-500">
              <Music className="w-6 h-6 opacity-60" />
            </div>
          )}
        </div>

        {/* Détails Texte */}
        <div className="min-w-0 flex-1 space-y-0.5">
          {isPlaying && track ? (
            <>
              <div className="flex items-center gap-1.5">
                <span
                  className="text-xs font-black truncate max-w-[140px]"
                  style={{ color: 'var(--kairo-text-primary, #ffffff)' }}
                >
                  {track.title}
                </span>
                {isDemo && (
                  <span className="px-1 py-0.2 rounded text-[8px] font-bold bg-purple-600 text-white">
                    Démo
                  </span>
                )}
              </div>
              <div
                className="text-[11px] font-bold truncate max-w-[150px]"
                style={{ color: 'var(--kairo-accent-primary, #10b981)' }}
              >
                {track.artist}
              </div>
              {/* Ligne de parole karaoké en direct */}
              {activeLyric ? (
                <div
                  className="text-[10px] font-medium italic truncate max-w-[160px] flex items-center gap-1"
                  style={{ color: 'var(--kairo-accent-secondary, #38bdf8)' }}
                >
                  <Sparkles className="w-2.5 h-2.5 shrink-0" />
                  <span className="truncate">{activeLyric.text}</span>
                </div>
              ) : (
                <div
                  className="text-[10px] font-mono truncate"
                  style={{ color: 'var(--kairo-text-muted, #94a1b2)' }}
                >
                  {track.deviceName || 'Borne Kaïro'}
                </div>
              )}
              {/* Petite barre de progression */}
              <div className="w-full h-1 rounded-full bg-white/10 overflow-hidden mt-1">
                <div
                  className="h-full rounded-full transition-all duration-300"
                  style={{
                    width: `${progressPercent}%`,
                    backgroundColor: 'var(--kairo-accent-primary, #10b981)',
                  }}
                />
              </div>
            </>
          ) : (
            <>
              <div
                className="text-xs font-bold"
                style={{ color: 'var(--kairo-text-primary, #ffffff)' }}
              >
                Aucune musique lancée
              </div>
              <div
                className="text-[10px] font-semibold flex items-center gap-1"
                style={{ color: 'var(--kairo-accent-primary, #10b981)' }}
              >
                <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                <span>Borne Kaïro prête (Spotify Connect)</span>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Partie Droite : Contrôles + Agrandir / Fermer */}
      <div className="relative z-10 flex items-center gap-1 shrink-0">
        {onTogglePlay && isPlaying && (
          <button
            onClick={onTogglePlay}
            className="p-1.5 rounded-lg bg-white/10 hover:bg-white/20 transition-all cursor-pointer"
            title={track?.isPlaying ? 'Pause' : 'Lecture'}
          >
            {track?.isPlaying ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
          </button>
        )}
        {onNext && isPlaying && (
          <button
            onClick={onNext}
            className="p-1.5 rounded-lg bg-white/5 hover:bg-white/15 transition-all cursor-pointer"
            title="Suivant"
          >
            <SkipForward className="w-3.5 h-3.5" />
          </button>
        )}
        <button
          onClick={() => handleAction('maximize')}
          className="p-1.5 rounded-lg bg-white/10 hover:bg-white/20 transition-all cursor-pointer"
          title="Agrandir en plein écran"
        >
          <Maximize2 className="w-3.5 h-3.5" />
        </button>
        <button
          onClick={() => handleAction('close')}
          className="p-1.5 rounded-lg bg-white/5 hover:bg-white/15 transition-all cursor-pointer"
          style={{ color: 'var(--kairo-text-muted, #94a1b2)' }}
          title="Masquer le mini-lecteur"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
};
