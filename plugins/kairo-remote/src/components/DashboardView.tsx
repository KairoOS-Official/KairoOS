import React, { useState, useEffect } from 'react';
import {
  Tv,
  Gamepad2,
  Square,
  Play,
  Lock,
  Unlock,
  Clock,
  Wifi,
  Copy,
  Check,
  Flame,
  History,
  Smartphone,
} from 'lucide-react';
import { ThemeMode, StatusResponse, Game } from '../types';

interface DashboardViewProps {
  status: StatusResponse | null;
  recentGames: Game[];
  onLaunchGame: (gameId: string) => Promise<void>;
  onStopGame: () => Promise<void>;
  onLockKiosk: () => Promise<void>;
  onOpenUnlockModal: () => void;
  onNavigateToGames: () => void;
  onOpenGamepad: () => void;
  loading: boolean;
  theme: ThemeMode;
}

export const DashboardView: React.FC<DashboardViewProps> = ({
  status,
  recentGames,
  onLaunchGame,
  onStopGame,
  onLockKiosk,
  onOpenUnlockModal,
  onNavigateToGames,
  onOpenGamepad,
  loading,
  theme,
}) => {
  const isDark = theme === 'dark';
  const [seconds, setSeconds] = useState<number>(status?.elapsed_seconds || 0);
  const [copiedIp, setCopiedIp] = useState(false);

  // Chronomètre session en temps réel
  useEffect(() => {
    if (status?.is_running) {
      setSeconds(status.elapsed_seconds || 0);
      const timer = setInterval(() => {
        setSeconds((prev) => prev + 1);
      }, 1000);
      return () => clearInterval(timer);
    } else {
      setSeconds(0);
    }
  }, [status?.is_running, status?.elapsed_seconds]);

  const formatTime = (totalSec: number) => {
    const mins = Math.floor(totalSec / 60);
    const secs = totalSec % 60;
    const hrs = Math.floor(mins / 60);
    if (hrs > 0) {
      return `${hrs}h ${mins % 60}m ${secs.toString().padStart(2, '0')}s`;
    }
    return `${mins}m ${secs.toString().padStart(2, '0')}s`;
  };

  const handleCopyIp = () => {
    if (status?.local_ip) {
      const url = `http://${status.local_ip}:${status.port || 8080}`;
      navigator.clipboard?.writeText(url);
      setCopiedIp(true);
      setTimeout(() => setCopiedIp(false), 2000);
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-150">
      {/* 1. Carte Principale : Statut en Direct (Sobre & Lisible) */}
      <div
        className={`p-6 rounded-3xl border transition-all shadow-sm ${
          status?.is_running
            ? isDark
              ? 'bg-slate-900 border-emerald-500/50'
              : 'bg-white border-emerald-300 ring-2 ring-emerald-100'
            : isDark
            ? 'bg-slate-900 border-slate-800'
            : 'bg-white border-slate-200'
        }`}
      >
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <span
              className={`w-2.5 h-2.5 rounded-full ${
                status?.is_running ? 'bg-emerald-500 animate-pulse' : 'bg-slate-400'
              }`}
            />
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              {status?.is_running ? 'Session de Jeu Active' : 'Borne Libre (En Attente)'}
            </span>
          </div>

          {status?.is_running ? (
            <span className="px-3 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 flex items-center gap-1.5">
              <Flame className="w-3.5 h-3.5" />
              <span>EN JEU</span>
            </span>
          ) : (
            <span className="px-3 py-1 rounded-full text-xs font-medium bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400">
              IDLE
            </span>
          )}
        </div>

        {status?.is_running ? (
          <div className="space-y-5">
            <div className="flex flex-col sm:flex-row items-center gap-5">
              {/* Jaquette */}
              <div className="w-24 h-32 rounded-2xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 flex items-center justify-center shrink-0 overflow-hidden shadow-xs">
                {status.current_game_cover ? (
                  <img
                    src={status.current_game_cover}
                    alt={status.current_game_title || ''}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <Gamepad2 className="w-10 h-10 text-slate-400" />
                )}
              </div>

              {/* Titre & Chronomètre */}
              <div className="flex-1 text-center sm:text-left space-y-2">
                <span className="inline-block px-2.5 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 text-[11px] font-mono font-bold uppercase">
                  {status.current_system_id || 'Arcade'}
                </span>
                <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900 dark:text-white leading-tight">
                  {status.current_game_title || 'Jeu en cours'}
                </h2>

                <div className="flex items-center justify-center sm:justify-start gap-2 text-xs font-medium text-slate-500 dark:text-slate-400 pt-1">
                  <Clock className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                  <span>Temps écoulé :</span>
                  <span className="text-indigo-600 dark:text-indigo-400 font-bold font-mono text-sm">
                    {formatTime(seconds)}
                  </span>
                </div>
              </div>
            </div>

            {/* Boutons d'Action Rapide : Arrêter + Manette */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
              <button
                onClick={onOpenGamepad}
                className="py-3 px-4 rounded-2xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs shadow-xs flex items-center justify-center gap-2 active:scale-95 transition-all"
              >
                <Smartphone className="w-4 h-4" />
                <span>OUVRIR LA MANETTE VIRTUELLE 🎮</span>
              </button>

              <button
                onClick={onStopGame}
                disabled={loading}
                className="py-3 px-4 rounded-2xl bg-red-50 hover:bg-red-100 dark:bg-red-950/40 dark:hover:bg-red-900/60 text-red-600 dark:text-red-400 border border-red-200 dark:border-red-800/60 font-bold text-xs flex items-center justify-center gap-2 active:scale-95 transition-all"
              >
                <Square className="w-4 h-4 fill-current" />
                <span>ARRÊTER LE JEU (STOP D'URGENCE)</span>
              </button>
            </div>
          </div>
        ) : (
          <div className="text-center py-8 space-y-4">
            <div className="w-14 h-14 mx-auto rounded-2xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-500">
              <Gamepad2 className="w-7 h-7" />
            </div>
            <div>
              <h3 className="font-bold text-base text-slate-900 dark:text-white">Borne Prête pour une Partie</h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 max-w-sm mx-auto">
                Lancez un jeu depuis le catalogue ou relancez directement une session précédente ci-dessous.
              </p>
            </div>
            <div className="flex flex-wrap items-center justify-center gap-3">
              <button
                onClick={onNavigateToGames}
                className="px-5 py-2.5 rounded-xl font-bold text-xs bg-indigo-600 hover:bg-indigo-700 text-white shadow-xs transition-all active:scale-95 flex items-center gap-2"
              >
                <Play className="w-3.5 h-3.5 fill-current" />
                <span>PARCOURIR LES JEUX</span>
              </button>

              <button
                onClick={onOpenGamepad}
                className="px-5 py-2.5 rounded-xl font-bold text-xs bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 transition-all active:scale-95 flex items-center gap-2"
              >
                <Smartphone className="w-3.5 h-3.5" />
                <span>MANETTE VIRTUELLE</span>
              </button>
            </div>
          </div>
        )}
      </div>

      {/* 2. Colonnes : Historique Récent + Contrôle Kiosk & Réseau */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Historique des 5 derniers jeux (col-span-7) */}
        <div
          className={`lg:col-span-7 p-6 rounded-3xl border space-y-4 shadow-xs ${
            isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'
          }`}
        >
          <div className="flex items-center justify-between pb-3 border-b border-slate-200/80 dark:border-slate-800">
            <div className="flex items-center gap-2">
              <History className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-200">
                Derniers Jeux Lancés
              </h3>
            </div>
            <span className="text-[11px] text-slate-400 font-mono">5 récents</span>
          </div>

          <div className="space-y-2">
            {recentGames.length === 0 ? (
              <div className="text-center py-6 text-xs text-slate-400">
                Aucun historique récent.
              </div>
            ) : (
              recentGames.map((game) => (
                <div
                  key={game.id}
                  className={`p-3 rounded-2xl border flex items-center justify-between gap-3 transition-all ${
                    isDark
                      ? 'bg-slate-800/40 border-slate-800 hover:border-slate-700'
                      : 'bg-slate-50 border-slate-200 hover:border-indigo-300'
                  }`}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-10 h-10 rounded-xl bg-slate-200 dark:bg-slate-800 shrink-0 flex items-center justify-center overflow-hidden">
                      {game.cover_url ? (
                        <img src={game.cover_url} alt="" className="w-full h-full object-cover" />
                      ) : (
                        <Gamepad2 className="w-5 h-5 text-slate-400" />
                      )}
                    </div>
                    <div className="min-w-0">
                      <h4 className="text-xs font-bold truncate text-slate-900 dark:text-white">
                        {game.title}
                      </h4>
                      <div className="flex items-center gap-2 text-[10px] text-slate-400">
                        <span className="font-mono uppercase font-bold text-indigo-600 dark:text-indigo-400">
                          {game.system_id}
                        </span>
                        {game.play_count > 0 && <span>• {game.play_count} partie(s)</span>}
                      </div>
                    </div>
                  </div>

                  <button
                    onClick={() => onLaunchGame(game.id)}
                    disabled={loading || status?.is_running}
                    className="px-3 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold shrink-0 flex items-center gap-1 transition-all active:scale-95 disabled:opacity-40"
                  >
                    <Play className="w-3 h-3 fill-current" />
                    <span>Lancer</span>
                  </button>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Colonne Droite : Mode Salle & IP (col-span-5) */}
        <div className="lg:col-span-5 space-y-6">
          {/* Mode Kiosk */}
          <div
            className={`p-6 rounded-3xl border space-y-4 shadow-xs ${
              isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'
            }`}
          >
            <div className="flex items-center justify-between pb-3 border-b border-slate-200/80 dark:border-slate-800">
              <div className="flex items-center gap-2">
                <span className="text-amber-500">
                  {status?.kiosk_mode ? <Lock className="w-4 h-4" /> : <Unlock className="w-4 h-4" />}
                </span>
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-200">
                  Sécurité Mode Salle
                </h3>
              </div>
              <span
                className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                  status?.kiosk_mode
                    ? 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300'
                    : 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                }`}
              >
                {status?.kiosk_mode ? 'Verrouillé 🔒' : 'Admin Libre 🔓'}
              </span>
            </div>

            <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
              {status?.kiosk_mode
                ? 'Les menus et configurations sont masqués sur la borne pour les joueurs.'
                : 'La borne est en accès libre complet.'}
            </p>

            {status?.kiosk_mode ? (
              <button
                onClick={onOpenUnlockModal}
                disabled={loading}
                className="w-full py-2.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-white font-bold text-xs shadow-xs active:scale-95 transition-all flex items-center justify-center gap-2"
              >
                <Unlock className="w-4 h-4" />
                <span>Déverrouiller avec le PIN</span>
              </button>
            ) : (
              <button
                onClick={onLockKiosk}
                disabled={loading}
                className={`w-full py-2.5 rounded-xl border text-xs font-semibold active:scale-95 transition-all flex items-center justify-center gap-2 ${
                  isDark
                    ? 'bg-slate-800 hover:bg-slate-700 text-slate-200 border-slate-700'
                    : 'bg-slate-100 hover:bg-slate-200 text-slate-700 border-slate-200'
                }`}
              >
                <Lock className="w-4 h-4" />
                <span>Activer le Mode Kiosk</span>
              </button>
            )}
          </div>

          {/* Accès Télécommande */}
          <div
            className={`p-6 rounded-3xl border space-y-3 shadow-xs ${
              isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'
            }`}
          >
            <div className="flex items-center gap-2 pb-3 border-b border-slate-200/80 dark:border-slate-800">
              <Wifi className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-200">
                Adresse Wi-Fi Borne
              </h3>
            </div>

            <div
              className={`p-3 rounded-xl border flex items-center justify-between ${
                isDark ? 'bg-slate-800/50 border-slate-700' : 'bg-slate-50 border-slate-200'
              }`}
            >
              <div className="text-xs">
                <span className="text-slate-400 block text-[10px]">URL Téléphone :</span>
                <span className="font-mono font-bold text-indigo-600 dark:text-indigo-400 text-xs">
                  http://{status?.local_ip || '127.0.0.1'}:{status?.port || 8080}
                </span>
              </div>

              <button
                onClick={handleCopyIp}
                className={`p-1.5 rounded-lg border transition-all ${
                  copiedIp
                    ? 'bg-emerald-500 text-white border-emerald-500'
                    : 'bg-white dark:bg-slate-800 text-slate-500 border-slate-200 dark:border-slate-700'
                }`}
              >
                {copiedIp ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
