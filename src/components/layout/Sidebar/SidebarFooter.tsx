import React from 'react';
import { Gamepad2, Settings as SettingsIcon, Lock, PlusCircle } from 'lucide-react';
import { AppMode } from '../../../types';

interface SidebarFooterProps {
  gamepadConnected: boolean;
  gamepadName: string | null;
  appMode?: AppMode;
  onOpenSettings: () => void;
  onOpenGamepadSettings?: () => void;
  onOpenKioskUnlock?: () => void;
  onOpenAddGame?: () => void;
}

export const SidebarFooter: React.FC<SidebarFooterProps> = ({
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
    <div
      style={{
        backgroundColor: 'var(--sidebar-bg)',
        borderColor: 'var(--border-color)',
      }}
      className="p-3 border-t flex flex-col gap-2.5 shrink-0 select-none"
    >
      {/* 1. Ligne Marque & Statut Borne */}
      <div
        style={{
          backgroundColor: 'var(--bg-card)',
          borderColor: 'var(--border-color)',
        }}
        className="p-2.5 rounded-2xl border shadow-xs flex items-center justify-between"
      >
        <div className="flex items-center gap-2.5">
          {/* Logo KaïroOS */}
          <div
            style={{ backgroundColor: 'var(--accent-primary)' }}
            className="w-9 h-9 rounded-xl flex items-center justify-center p-1 text-white shadow-sm shadow-black/10 shrink-0"
          >
            <img src="/logo.png" alt="KaïroOS" className="w-6 h-6 object-contain" />
          </div>

          <div>
            <div className="flex items-center gap-1.5 leading-tight">
              <span className="text-xs font-black tracking-tight" style={{ color: 'var(--text-primary)' }}>
                KAÏRO
              </span>
              <span
                style={{ backgroundColor: 'var(--accent-primary)' }}
                className="text-[9px] font-black px-1.5 py-0.2 rounded text-white font-mono uppercase"
              >
                OS
              </span>
            </div>
            <div className="flex items-center gap-1.5 text-[10px]" style={{ color: 'var(--text-muted)' }}>
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
              <span>Borne connectée • v2.0</span>
            </div>
          </div>
        </div>
      </div>

      {/* 2. Boutons d'Action (Kiosk ou Admin) */}
      <div>
        {isKiosk ? (
          <button
            onClick={onOpenKioskUnlock}
            title="Mode Kiosk (Cliquez ou combo LB+RB+Start pour déverrouiller)"
            className="w-full py-2 rounded-xl border border-rose-400 bg-rose-50 text-rose-600 hover:bg-rose-100 flex items-center justify-center gap-1.5 text-xs font-bold tracking-wider shadow-xs animate-pulse transition-all"
          >
            <Lock className="w-3.5 h-3.5" />
            <span>KIOSK (VERROUILLÉ)</span>
          </button>
        ) : (
          <div className="flex items-center justify-between gap-1.5">
            {onOpenAddGame && (
              <button
                onClick={onOpenAddGame}
                title="Ajouter un jeu manuellement (ROM / Exécutable)"
                style={{
                  backgroundColor: 'var(--bg-card)',
                  borderColor: 'var(--border-color)',
                  color: 'var(--text-secondary)',
                }}
                className="p-2 rounded-xl border hover:scale-105 shadow-xs transition-all flex items-center justify-center"
              >
                <PlusCircle className="w-4 h-4" />
              </button>
            )}

            {onOpenGamepadSettings && (
              <button
                onClick={onOpenGamepadSettings}
                title={
                  gamepadConnected
                    ? `${gamepadName || 'Manette connectée'} (Configurer)`
                    : 'Configurer les Manettes'
                }
                style={{
                  backgroundColor: gamepadConnected ? 'rgba(16, 185, 129, 0.12)' : 'var(--bg-card)',
                  borderColor: gamepadConnected ? '#10b981' : 'var(--border-color)',
                  color: gamepadConnected ? '#10b981' : 'var(--text-secondary)',
                }}
                className="p-2 rounded-xl border hover:scale-105 shadow-xs transition-all flex items-center justify-center"
              >
                <Gamepad2 className="w-4 h-4" />
              </button>
            )}

            <button
              onClick={onOpenSettings}
              title="Paramètres de la Borne"
              style={{
                backgroundColor: 'var(--bg-card)',
                borderColor: 'var(--border-color)',
                color: 'var(--text-primary)',
              }}
              className="flex-1 flex items-center justify-center gap-1.5 p-2 rounded-xl border hover:scale-102 shadow-xs transition-all text-xs font-bold"
            >
              <SettingsIcon className="w-4 h-4" style={{ color: 'var(--accent-primary)' }} />
              <span>Paramètres</span>
            </button>
          </div>
        )}
      </div>
    </div>
  );
};