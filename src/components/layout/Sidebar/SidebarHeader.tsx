import React from 'react';
import { Gamepad2, Settings as SettingsIcon, Lock, PlusCircle } from 'lucide-react';
import { AppMode } from '../../../types';

interface SidebarHeaderProps {
  gamepadConnected: boolean;
  gamepadName: string | null;
  appMode?: AppMode;
  onOpenSettings: () => void;
  onOpenGamepadSettings?: () => void;
  onOpenKioskUnlock?: () => void;
  onOpenAddGame?: () => void;
}

export const SidebarHeader: React.FC<SidebarHeaderProps> = ({
  gamepadConnected,
  gamepadName,
  appMode = 'admin',
  onOpenSettings,
  onOpenGamepadSettings,
  onOpenKioskUnlock,
  onOpenAddGame,
}) => {

  const isKiosk = appMode === 'kiosk';

  return (
    <div className="p-4 border-b border-purple-100/70 bg-gradient-to-b from-white to-purple-50/30 flex items-center justify-between select-none">
      {/* Brand: 3D Arcade Machine + KAÏRO OS */}
      <div className="flex items-center gap-3">
        {/* Logo KaïroOS */}
        <div className="relative w-11 h-11 rounded-2xl bg-gradient-to-tr from-purple-600 via-pink-600 to-rose-500 p-0.5 shadow-md shadow-pink-500/20 flex items-center justify-center shrink-0">
          <div className="w-full h-full bg-white/10 backdrop-blur-xs rounded-[14px] flex items-center justify-center p-1.5 text-white">
            <img src="/logo.png" alt="KaïroOS" className="w-full h-full object-contain" />
          </div>
          <span className="absolute -top-1 -right-1 w-3 h-3 rounded-full bg-rose-500 border-2 border-white shadow-xs" />
        </div>

        <div>
          <div className="flex items-center gap-1.5">
            <span className="text-lg font-black tracking-tight text-slate-900 font-sans">
              KAÏRO
            </span>
            <span className="text-[10px] font-black px-1.5 py-0.5 rounded-md bg-rose-500 text-white font-sans uppercase tracking-wider">
              OS
            </span>
          </div>

          <div className="flex flex-col -mt-0.5">
            <span className="text-[10px] font-extrabold uppercase tracking-widest text-slate-400 font-sans">
              ARCADE STATION
            </span>
            <span className="text-[9px] font-bold text-rose-500 uppercase tracking-wider -mt-0.5">
              80s • 90s • NEXT GEN
            </span>
          </div>
        </div>
      </div>

      {/* Right Action: Kiosk Badge / Settings */}
      <div className="flex items-center gap-1.5">
        {isKiosk ? (
          <button
            onClick={onOpenKioskUnlock}
            title="Mode Kiosk (Cliquez ou combo LB+RB+Start pour déverrouiller)"
            className="px-2.5 py-1.5 rounded-xl border border-rose-300 bg-rose-50 text-rose-600 hover:bg-rose-100 flex items-center gap-1.5 text-[11px] font-bold tracking-wider shadow-xs animate-pulse transition-all"
          >
            <Lock className="w-3.5 h-3.5" />
            <span>KIOSK</span>
          </button>
        ) : (
          <>
            <button
              onClick={onOpenAddGame}
              title="Ajouter un jeu manuellement (ROM / Exécutable)"
              className="p-2 rounded-xl border border-purple-100 bg-white hover:bg-rose-50 text-slate-400 hover:text-rose-500 hover:border-rose-200 shadow-xs transition-all"
            >
              <PlusCircle className="w-4 h-4" />
            </button>


            <button
              onClick={onOpenGamepadSettings}
              title={
                gamepadConnected
                  ? `${gamepadName || 'Manette connectée'} (Configurer J1-J10)`
                  : 'Configurer les Manettes'
              }
              className={`p-2 rounded-xl border flex items-center justify-center transition-all ${
                gamepadConnected
                  ? 'bg-emerald-50 border-emerald-200 text-emerald-600 shadow-xs'
                  : 'bg-white border-purple-100 text-slate-400 hover:text-rose-500 hover:border-rose-200'
              }`}
            >
              <Gamepad2 className="w-4 h-4" />
            </button>

            <button
              onClick={onOpenSettings}
              title="Paramètres de la Borne"
              className="p-2 rounded-xl border border-purple-100 bg-white hover:bg-purple-50 text-slate-400 hover:text-rose-500 hover:border-rose-200 shadow-xs transition-all"
            >
              <SettingsIcon className="w-4 h-4" />
            </button>
          </>
        )}
      </div>
    </div>
  );
};

