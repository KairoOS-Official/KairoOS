import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  Gamepad2,
  Tv,
  ArrowLeft,
  Square,
  Users,
  Volume2,
  Flame,
  Power,
  ChevronUp,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Circle,
} from 'lucide-react';
import { ThemeMode, StatusResponse } from '../types';

interface VirtualGamepadProps {
  pin: string;
  status: StatusResponse | null;
  onBackToHub: () => void;
  onStopGame: () => Promise<void>;
  theme: ThemeMode;
}

export const VirtualGamepad: React.FC<VirtualGamepadProps> = ({
  pin,
  status,
  onBackToHub,
  onStopGame,
  theme,
}) => {
  const isDark = theme === 'dark';
  const [playerIndex, setPlayerIndex] = useState<number>(0); // 0 = J1, 1 = J2, 2 = J3, 3 = J4
  const [activeButtons, setActiveButtons] = useState<Record<string, boolean>>({});
  const activeButtonsRef = useRef<Record<string, boolean>>({});

  // Envoi d'un input au serveur HTTP
  const sendInput = useCallback(
    async (button: string, isDown: boolean) => {
      // Éviter d'envoyer des doublons
      if (activeButtonsRef.current[button] === isDown) return;
      activeButtonsRef.current[button] = isDown;
      setActiveButtons((prev) => ({ ...prev, [button]: isDown }));

      // Vibration haptique tactile légère
      if (isDown && typeof navigator !== 'undefined' && navigator.vibrate) {
        try {
          navigator.vibrate(15);
        } catch {}
      }

      try {
        fetch('/api/gamepad/input', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Kairo-Pin': pin,
          },
          body: JSON.stringify({
            player_index: playerIndex,
            button,
            is_down: isDown,
          }),
        }).catch(() => {});
      } catch {}
    },
    [pin, playerIndex]
  );

  // Clavier physique comme raccourci
  useEffect(() => {
    const keyMap: Record<string, string> = {
      ArrowUp: 'up',
      ArrowDown: 'down',
      ArrowLeft: 'left',
      ArrowRight: 'right',
      KeyZ: 'b',
      KeyX: 'a',
      KeyA: 'y',
      KeyS: 'x',
      KeyQ: 'l1',
      KeyW: 'r1',
      Enter: 'start',
      Space: 'select',
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (keyMap[e.code]) {
        e.preventDefault();
        sendInput(keyMap[e.code], true);
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      if (keyMap[e.code]) {
        e.preventDefault();
        sendInput(keyMap[e.code], false);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [sendInput]);

  const playerColors = [
    { label: 'J1 (Joueur 1)', color: 'border-blue-500 bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-400' },
    { label: 'J2 (Joueur 2)', color: 'border-red-500 bg-red-50 text-red-700 dark:bg-red-950/40 dark:text-red-400' },
    { label: 'J3 (Joueur 3)', color: 'border-emerald-500 bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400' },
    { label: 'J4 (Joueur 4)', color: 'border-amber-500 bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-400' },
  ];

  // Helper pour les boutons tactiles
  const renderTouchButton = (
    btnId: string,
    label: React.ReactNode,
    className: string,
    isRound = false
  ) => {
    const isPressed = !!activeButtons[btnId];

    return (
      <button
        type="button"
        onMouseDown={(e) => {
          e.preventDefault();
          sendInput(btnId, true);
        }}
        onMouseUp={(e) => {
          e.preventDefault();
          sendInput(btnId, false);
        }}
        onMouseLeave={(e) => {
          e.preventDefault();
          sendInput(btnId, false);
        }}
        onTouchStart={(e) => {
          e.preventDefault();
          sendInput(btnId, true);
        }}
        onTouchEnd={(e) => {
          e.preventDefault();
          sendInput(btnId, false);
        }}
        onTouchCancel={(e) => {
          e.preventDefault();
          sendInput(btnId, false);
        }}
        className={`touch-none select-none transition-transform font-bold font-mono active:scale-90 flex items-center justify-center shadow-md ${
          isRound ? 'rounded-full' : 'rounded-2xl'
        } ${
          isPressed
            ? 'scale-90 bg-indigo-600 text-white shadow-inner ring-4 ring-indigo-400/40'
            : className
        }`}
      >
        {label}
      </button>
    );
  };

  return (
    <div
      className={`min-h-screen w-full flex flex-col justify-between p-3 sm:p-6 select-none transition-colors ${
        isDark ? 'bg-slate-950 text-slate-100' : 'bg-slate-100 text-slate-800'
      }`}
    >
      {/* 1. Header de Contrôle & Sélecteur Multi-Joueurs */}
      <header className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-slate-200 dark:border-slate-800">
        <div className="flex items-center gap-2">
          <button
            onClick={onBackToHub}
            title="Retour au Menu Principal"
            className={`p-2.5 rounded-2xl border transition-all active:scale-90 ${
              isDark ? 'bg-slate-900 border-slate-800 text-slate-300' : 'bg-white border-slate-200 text-slate-700'
            }`}
          >
            <ArrowLeft className="w-5 h-5" />
          </button>

          {/* Sélecteur de Slot Joueur */}
          <div className="flex items-center gap-1.5 overflow-x-auto">
            {playerColors.map((p, idx) => (
              <button
                key={idx}
                onClick={() => setPlayerIndex(idx)}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold font-mono border transition-all ${
                  playerIndex === idx
                    ? `${p.color} border-2 shadow-sm scale-105`
                    : isDark
                    ? 'bg-slate-900 border-slate-800 text-slate-400'
                    : 'bg-white border-slate-200 text-slate-500'
                }`}
              >
                J{idx + 1}
              </button>
            ))}
          </div>
        </div>

        {/* Statut du Jeu */}
        <div className="flex items-center gap-3">
          {status?.is_running && (
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/60 text-emerald-700 dark:text-emerald-400 text-xs font-semibold">
              <Flame className="w-4 h-4 animate-pulse" />
              <span className="truncate max-w-[120px] sm:max-w-[200px]">
                {status.current_game_title}
              </span>
            </div>
          )}

          {status?.is_running && (
            <button
              onClick={onStopGame}
              title="Arrêter le jeu"
              className="p-2 rounded-xl bg-red-600 hover:bg-red-500 text-white shadow-sm transition-all"
            >
              <Square className="w-4 h-4 fill-white" />
            </button>
          )}
        </div>
      </header>

      {/* 2. Gâchettes Supérieures (L1 / L2 / R1 / R2) */}
      <div className="grid grid-cols-4 gap-2.5 max-w-lg mx-auto w-full my-2">
        {renderTouchButton(
          'l2',
          'L2',
          isDark
            ? 'bg-slate-900 border border-slate-800 text-slate-300 py-3 text-xs'
            : 'bg-white border border-slate-200 text-slate-700 py-3 text-xs'
        )}
        {renderTouchButton(
          'l1',
          'L1',
          isDark
            ? 'bg-slate-900 border border-slate-800 text-slate-300 py-3 text-xs'
            : 'bg-white border border-slate-200 text-slate-700 py-3 text-xs'
        )}
        {renderTouchButton(
          'r1',
          'R1',
          isDark
            ? 'bg-slate-900 border border-slate-800 text-slate-300 py-3 text-xs'
            : 'bg-white border border-slate-200 text-slate-700 py-3 text-xs'
        )}
        {renderTouchButton(
          'r2',
          'R2',
          isDark
            ? 'bg-slate-900 border border-slate-800 text-slate-300 py-3 text-xs'
            : 'bg-white border border-slate-200 text-slate-700 py-3 text-xs'
        )}
      </div>

      {/* 3. Corps Principal de la Manette : D-PAD à Gauche + BOUTONS D'ACTION à Droite */}
      <div className="flex-1 flex flex-col md:flex-row items-center justify-between gap-6 max-w-4xl mx-auto w-full my-auto py-4">
        {/* D-PAD Croix Directionnelle */}
        <div className="relative w-48 h-48 sm:w-56 sm:h-56 shrink-0 flex items-center justify-center">
          {/* Fond D-pad */}
          <div
            className={`w-36 h-36 sm:w-44 sm:h-44 rounded-full border flex items-center justify-center shadow-inner ${
              isDark ? 'bg-slate-900/60 border-slate-800' : 'bg-slate-200/60 border-slate-300'
            }`}
          >
            <div className="w-12 h-12 rounded-full bg-slate-300/40 dark:bg-slate-700/40" />
          </div>

          {/* Bouton HAUT */}
          <div className="absolute top-1 left-1/2 -translate-x-1/2">
            {renderTouchButton(
              'up',
              <ChevronUp className="w-8 h-8" />,
              isDark
                ? 'w-14 h-14 bg-slate-800 border border-slate-700 text-white'
                : 'w-14 h-14 bg-white border border-slate-300 text-slate-800'
            )}
          </div>

          {/* Bouton BAS */}
          <div className="absolute bottom-1 left-1/2 -translate-x-1/2">
            {renderTouchButton(
              'down',
              <ChevronDown className="w-8 h-8" />,
              isDark
                ? 'w-14 h-14 bg-slate-800 border border-slate-700 text-white'
                : 'w-14 h-14 bg-white border border-slate-300 text-slate-800'
            )}
          </div>

          {/* Bouton GAUCHE */}
          <div className="absolute left-1 top-1/2 -translate-y-1/2">
            {renderTouchButton(
              'left',
              <ChevronLeft className="w-8 h-8" />,
              isDark
                ? 'w-14 h-14 bg-slate-800 border border-slate-700 text-white'
                : 'w-14 h-14 bg-white border border-slate-300 text-slate-800'
            )}
          </div>

          {/* Bouton DROITE */}
          <div className="absolute right-1 top-1/2 -translate-y-1/2">
            {renderTouchButton(
              'right',
              <ChevronRight className="w-8 h-8" />,
              isDark
                ? 'w-14 h-14 bg-slate-800 border border-slate-700 text-white'
                : 'w-14 h-14 bg-white border border-slate-300 text-slate-800'
            )}
          </div>
        </div>

        {/* Boutons Centraux (Select & Start) */}
        <div className="flex items-center gap-4 my-2 shrink-0">
          <div className="text-center space-y-1">
            {renderTouchButton(
              'select',
              'SELECT',
              isDark
                ? 'px-4 py-2 bg-slate-900 border border-slate-800 text-[10px] text-slate-400'
                : 'px-4 py-2 bg-white border border-slate-300 text-[10px] text-slate-600'
            )}
            <span className="text-[9px] uppercase font-bold text-slate-400 block">Select</span>
          </div>

          <div className="text-center space-y-1">
            {renderTouchButton(
              'start',
              'START',
              isDark
                ? 'px-4 py-2 bg-slate-900 border border-slate-800 text-[10px] text-slate-400'
                : 'px-4 py-2 bg-white border border-slate-300 text-[10px] text-slate-600'
            )}
            <span className="text-[9px] uppercase font-bold text-slate-400 block">Start</span>
          </div>
        </div>

        {/* BOUTONS D'ACTION (A, B, X, Y) */}
        <div className="relative w-48 h-48 sm:w-56 sm:h-56 shrink-0 flex items-center justify-center">
          {/* Fond boutons */}
          <div
            className={`w-36 h-36 sm:w-44 sm:h-44 rounded-full border flex items-center justify-center shadow-inner ${
              isDark ? 'bg-slate-900/60 border-slate-800' : 'bg-slate-200/60 border-slate-300'
            }`}
          />

          {/* Bouton X (Haut) */}
          <div className="absolute top-1 left-1/2 -translate-x-1/2">
            {renderTouchButton(
              'x',
              'X',
              'w-14 h-14 bg-blue-600 text-white text-lg font-bold',
              true
            )}
          </div>

          {/* Bouton B (Bas) */}
          <div className="absolute bottom-1 left-1/2 -translate-x-1/2">
            {renderTouchButton(
              'b',
              'B',
              'w-14 h-14 bg-amber-500 text-white text-lg font-bold',
              true
            )}
          </div>

          {/* Bouton Y (Gauche) */}
          <div className="absolute left-1 top-1/2 -translate-y-1/2">
            {renderTouchButton(
              'y',
              'Y',
              'w-14 h-14 bg-emerald-600 text-white text-lg font-bold',
              true
            )}
          </div>

          {/* Bouton A (Droite) */}
          <div className="absolute right-1 top-1/2 -translate-y-1/2">
            {renderTouchButton(
              'a',
              'A',
              'w-14 h-14 bg-red-600 text-white text-lg font-bold',
              true
            )}
          </div>
        </div>
      </div>

      {/* 4. Footer info */}
      <footer className="pt-2 text-center text-[10px] text-slate-400 font-mono">
        Manette Sans-fil KaïroOS • Connecté en tant que{' '}
        <span className="font-bold text-indigo-600 dark:text-indigo-400">Joueur {playerIndex + 1}</span>
      </footer>
    </div>
  );
};
