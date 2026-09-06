import React from 'react';
import { Sliders, Gamepad2, Tv, Shield, ArrowRight, Smartphone, LogOut } from 'lucide-react';
import { ThemeMode, StatusResponse } from '../types';

interface ModeSelectorProps {
  onSelectMode: (mode: 'admin' | 'gamepad') => void;
  status: StatusResponse | null;
  onLogout: () => void;
  theme: ThemeMode;
}

export const ModeSelector: React.FC<ModeSelectorProps> = ({
  onSelectMode,
  status,
  onLogout,
  theme,
}) => {
  const isDark = theme === 'dark';

  return (
    <div
      className={`min-h-screen w-full flex items-center justify-center p-4 sm:p-6 select-none transition-colors ${
        isDark ? 'bg-slate-950 text-slate-100' : 'bg-slate-100 text-slate-800'
      }`}
    >
      <div className="w-full max-w-xl space-y-6">
        {/* En-tête */}
        <div className="flex items-center justify-between pb-4 border-b border-slate-200 dark:border-slate-800">
          <div>
            <h1 className="text-xl font-bold font-sans">
              KaïroOS <span className="text-indigo-600 dark:text-indigo-400">Remote Hub</span>
            </h1>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Borne connectée sur <span className="font-mono font-bold text-slate-700 dark:text-slate-200">{status?.local_ip}:{status?.port}</span>
            </p>
          </div>

          <button
            onClick={onLogout}
            title="Déconnexion"
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-800 text-xs font-semibold text-slate-500 hover:text-red-500 hover:border-red-300 transition-all"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span>Quitter</span>
          </button>
        </div>

        {/* 2 Choix Principaux */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {/* Choix 1 : Panneau d'Administration */}
          <button
            onClick={() => onSelectMode('admin')}
            className={`p-6 rounded-3xl border text-left flex flex-col justify-between space-y-4 transition-all group hover:scale-[1.02] shadow-sm hover:shadow-md ${
              isDark
                ? 'bg-slate-900 border-slate-800 hover:border-indigo-500'
                : 'bg-white border-slate-200 hover:border-indigo-500'
            }`}
          >
            <div className="flex items-center justify-between w-full">
              <div className="p-3 rounded-2xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-800/50">
                <Sliders className="w-6 h-6" />
              </div>
              <ArrowRight className="w-5 h-5 text-slate-400 group-hover:text-indigo-600 group-hover:translate-x-1 transition-all" />
            </div>

            <div>
              <h2 className="text-base font-bold text-slate-900 dark:text-white">
                Panneau d'Administration
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 leading-relaxed">
                Gestion des jeux, lancement à distance, réglages réseau, émulateurs et mode salle.
              </p>
            </div>

            <div className="pt-2 flex items-center gap-2 text-[11px] font-semibold text-indigo-600 dark:text-indigo-400">
              <span>Accéder à l'Admin</span>
              <span>→</span>
            </div>
          </button>

          {/* Choix 2 : Manette Virtuelle (Gamepad Téléphone) */}
          <button
            onClick={() => onSelectMode('gamepad')}
            className={`p-6 rounded-3xl border text-left flex flex-col justify-between space-y-4 transition-all group hover:scale-[1.02] shadow-sm hover:shadow-md ${
              isDark
                ? 'bg-slate-900 border-slate-800 hover:border-emerald-500'
                : 'bg-white border-slate-200 hover:border-emerald-500'
            }`}
          >
            <div className="flex items-center justify-between w-full">
              <div className="p-3 rounded-2xl bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800/50">
                <Gamepad2 className="w-6 h-6" />
              </div>
              <ArrowRight className="w-5 h-5 text-slate-400 group-hover:text-emerald-600 group-hover:translate-x-1 transition-all" />
            </div>

            <div>
              <h2 className="text-base font-bold text-slate-900 dark:text-white">
                Manette Virtuelle (Gamepad)
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 leading-relaxed">
                Transformez ce smartphone en manette sans-fil. Choisissez votre joueur (J1, J2, J3, J4...).
              </p>
            </div>

            <div className="pt-2 flex items-center gap-2 text-[11px] font-semibold text-emerald-600 dark:text-emerald-400">
              <span>Ouvrir la Manette</span>
              <span>→</span>
            </div>
          </button>
        </div>

        {/* Statut rapide en bas */}
        <div
          className={`p-4 rounded-2xl border text-xs flex items-center justify-between ${
            isDark ? 'bg-slate-900/60 border-slate-800 text-slate-400' : 'bg-white border-slate-200 text-slate-600'
          }`}
        >
          <div className="flex items-center gap-2">
            <span
              className={`w-2.5 h-2.5 rounded-full ${
                status?.is_running ? 'bg-emerald-500 animate-pulse' : 'bg-slate-400'
              }`}
            />
            <span className="font-semibold">
              {status?.is_running
                ? `Jeu en cours : ${status.current_game_title}`
                : 'Borne prête et disponible'}
            </span>
          </div>

          <span className="font-mono text-[11px] font-bold">
            {status?.kiosk_mode ? 'Mode Kiosk 🔒' : 'Admin 🔓'}
          </span>
        </div>
      </div>
    </div>
  );
};
