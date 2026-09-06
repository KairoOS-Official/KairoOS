import React from 'react';
import { Gamepad2, KeyRound, LogOut } from 'lucide-react';
import { ThemeMode } from '../types';

interface HeaderProps {
  connected: boolean;
  theme?: ThemeMode;
  onToggleTheme?: () => void;
  pin: string;
  onOpenPinModal: () => void;
  appMode: 'admin' | 'gamepad';
  onToggleAppMode: () => void;
  onLogout: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  connected,
  onOpenPinModal,
  appMode,
  onToggleAppMode,
  onLogout,
}) => {
  return (
    <header className="sticky top-0 z-40 bg-white border-b border-slate-200 px-4 sm:px-6 py-3 flex items-center justify-between shadow-xs">
      {/* Marque & Statut de Connexion */}
      <div className="flex items-center gap-3">
        <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center text-white font-bold text-xs shadow-xs">
          K
        </div>
        <div>
          <div className="flex items-center gap-1.5">
            <span className="font-bold text-sm tracking-tight text-slate-900">
              KaïroOS <span className="text-blue-600 font-semibold">Console d'Admin</span>
            </span>
            <span className="text-[10px] px-1.5 py-0.5 rounded font-mono font-medium bg-slate-100 text-slate-600 border border-slate-200">
              REMOTE
            </span>
          </div>

          <div className="flex items-center gap-1.5 text-[11px]">
            {connected ? (
              <>
                <span className="w-2 h-2 rounded-full bg-emerald-500" />
                <span className="text-emerald-700 font-medium">Borne Connectée</span>
              </>
            ) : (
              <>
                <span className="w-2 h-2 rounded-full bg-red-500" />
                <span className="text-red-600 font-medium">Borne Hors-ligne</span>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Contrôles Header : Manette Virtuelle / PIN / Logout */}
      <div className="flex items-center gap-2">
        <button
          onClick={onToggleAppMode}
          title={appMode === 'admin' ? 'Ouvrir la Manette Virtuelle' : 'Ouvrir le Panneau Admin'}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 text-xs font-semibold shadow-xs transition-colors"
        >
          <Gamepad2 className="w-4 h-4" />
          <span className="hidden sm:inline">Manette Virtuelle</span>
        </button>

        <button
          onClick={onOpenPinModal}
          title="Modifier le Code PIN de session"
          className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-slate-200 bg-slate-50 hover:bg-slate-100 text-xs font-mono font-semibold text-slate-700 transition-colors"
        >
          <KeyRound className="w-3.5 h-3.5 text-amber-600" />
          <span>••••</span>
        </button>

        <button
          onClick={onLogout}
          title="Se déconnecter"
          className="p-1.5 rounded-lg border border-slate-200 text-slate-500 hover:text-red-600 hover:bg-red-50 hover:border-red-200 transition-colors"
        >
          <LogOut className="w-4 h-4" />
        </button>
      </div>
    </header>
  );
};
