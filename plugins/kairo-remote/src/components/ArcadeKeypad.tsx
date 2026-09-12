import React, { useEffect } from 'react';
import { KeyRound, Delete, RotateCcw, Check } from 'lucide-react';

interface ArcadeKeypadProps {
  value: string;
  onChange: (val: string) => void;
  onConfirm?: () => void;
  maxLength?: number;
  theme?: 'dark' | 'light';
  confirmLabel?: string;
  confirmDisabled?: boolean;
}

export const ArcadeKeypad: React.FC<ArcadeKeypadProps> = ({
  value,
  onChange,
  onConfirm,
  maxLength = 6,
  theme = 'dark',
  confirmLabel = 'VALIDER',
  confirmDisabled = false,
}) => {
  const isDark = theme === 'dark';

  const handleDigit = (digit: string) => {
    if (value.length < maxLength) {
      onChange(value + digit);
    }
  };

  const handleBackspace = () => {
    onChange(value.slice(0, -1));
  };

  const handleClear = () => {
    onChange('');
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (document.activeElement?.tagName === 'INPUT' || document.activeElement?.tagName === 'TEXTAREA') {
        return;
      }

      if (e.key >= '0' && e.key <= '9' && value.length < maxLength) {
        onChange(value + e.key);
      } else if (e.key === 'Backspace') {
        onChange(value.slice(0, -1));
      } else if (e.key === 'Enter' && onConfirm) {
        onConfirm();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [value, maxLength, onChange, onConfirm]);

  return (
    <div className="flex flex-col items-center w-full max-w-xs mx-auto space-y-4 select-none">
      {/* Visual Dot Indicators */}
      <div className="flex items-center justify-center gap-3 py-2">
        {Array.from({ length: 4 }).map((_, i) => {
          const isFilled = i < value.length;
          return (
            <div
              key={i}
              className={`w-4 h-4 rounded-full transition-all duration-150 border-2 ${
                isFilled
                  ? isDark
                    ? 'bg-retro-cyan border-white shadow-[0_0_10px_#00f0ff] scale-110'
                    : 'bg-retro-primary border-retro-primary shadow-md scale-110'
                  : isDark
                  ? 'bg-retro-panel border-retro-border'
                  : 'bg-retro-warm border-retro-border'
              }`}
            />
          );
        })}
      </div>

      {/* Grid of Keypad Buttons */}
      <div className="grid grid-cols-3 gap-2.5 w-full">
        {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((d) => (
          <button
            key={d}
            type="button"
            onClick={() => handleDigit(d)}
            className={`py-3.5 rounded-2xl text-xl font-black font-arcade transition-all active:scale-90 shadow-sm flex items-center justify-center ${
              isDark
                ? 'bg-retro-card hover:bg-retro-panel border border-retro-border text-white hover:border-retro-cyan hover:shadow-[0_0_12px_rgba(0,240,255,0.3)]'
                : 'bg-white hover:bg-retro-warm border border-retro-border text-retro-text hover:border-retro-primary hover:text-retro-primary'
            }`}
          >
            {d}
          </button>
        ))}

        {/* Clear Button */}
        <button
          type="button"
          onClick={handleClear}
          title="Effacer tout"
          className={`py-3.5 rounded-2xl text-xs font-bold font-arcade transition-all active:scale-90 shadow-sm flex items-center justify-center ${
            isDark
              ? 'bg-retro-card/60 hover:bg-retro-panel text-slate-400 hover:text-white border border-retro-border'
              : 'bg-white/80 hover:bg-retro-warm text-slate-500 hover:text-retro-text border border-retro-border'
          }`}
        >
          <RotateCcw className="w-4 h-4" />
        </button>

        {/* 0 Button */}
        <button
          type="button"
          onClick={() => handleDigit('0')}
          className={`py-3.5 rounded-2xl text-xl font-black font-arcade transition-all active:scale-90 shadow-sm flex items-center justify-center ${
            isDark
              ? 'bg-retro-card hover:bg-retro-panel border border-retro-border text-white hover:border-retro-cyan hover:shadow-[0_0_12px_rgba(0,240,255,0.3)]'
              : 'bg-white hover:bg-retro-warm border border-retro-border text-retro-text hover:border-retro-primary hover:text-retro-primary'
          }`}
        >
          0
        </button>

        {/* Backspace Button */}
        <button
          type="button"
          onClick={handleBackspace}
          title="Effacer un chiffre"
          className={`py-3.5 rounded-2xl text-xs font-bold font-arcade transition-all active:scale-90 shadow-sm flex items-center justify-center ${
            isDark
              ? 'bg-retro-card/60 hover:bg-retro-panel text-slate-400 hover:text-white border border-retro-border'
              : 'bg-white/80 hover:bg-retro-warm text-slate-500 hover:text-retro-text border border-retro-border'
          }`}
        >
          <Delete className="w-5 h-5" />
        </button>
      </div>

      {/* Optional Confirm Button */}
      {onConfirm && (
        <button
          type="button"
          onClick={onConfirm}
          disabled={confirmDisabled || value.length === 0}
          className={`w-full py-3.5 rounded-2xl font-bold font-arcade text-xs tracking-wider uppercase transition-all shadow-lg flex items-center justify-center gap-2 active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed ${
            isDark
              ? 'bg-gradient-to-r from-retro-primary to-retro-purple text-white shadow-retro-primary/20 hover:shadow-retro-primary/40'
              : 'bg-gradient-to-r from-retro-primary to-retro-orange text-white shadow-retro'
          }`}
        >
          <KeyRound className="w-4 h-4" />
          <span>{confirmLabel}</span>
        </button>
      )}
    </div>
  );
};
