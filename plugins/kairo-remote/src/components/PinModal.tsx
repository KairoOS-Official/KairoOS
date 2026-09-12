import React, { useState } from 'react';
import { X, KeyRound, Shield, AlertCircle, CheckCircle2 } from 'lucide-react';
import { ArcadeKeypad } from './ArcadeKeypad';
import { ThemeMode } from '../types';

interface PinModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (pin: string) => Promise<boolean | void>;
  title?: string;
  description?: string;
  initialPin?: string;
  theme?: ThemeMode;
}

export const PinModal: React.FC<PinModalProps> = ({
  isOpen,
  onClose,
  onConfirm,
  title = 'Code PIN de Sécurité',
  description = 'Saisissez votre code PIN pour valider cette action',
  initialPin = '',
  theme = 'dark',
}) => {
  const [pin, setPin] = useState(initialPin);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  if (!isOpen) return null;

  const isDark = theme === 'dark';

  const handleValidate = async () => {
    if (!pin) {
      setError('Veuillez saisir un code PIN');
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const res = await onConfirm(pin);
      if (res === false) {
        setError('Code PIN incorrect');
        setPin('');
      } else {
        setSuccess(true);
        setTimeout(() => {
          setSuccess(false);
          onClose();
        }, 500);
      }
    } catch (e: any) {
      setError(e.message || 'Erreur de validation');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-in fade-in duration-150"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className={`w-full max-w-sm rounded-3xl p-6 shadow-2xl border transition-all ${
          isDark
            ? 'bg-retro-card border-retro-border text-white shadow-[0_0_30px_rgba(0,0,0,0.8)]'
            : 'bg-white border-retro-border text-retro-text shadow-retro-lg'
        }`}
      >
        <div className="flex items-center justify-between pb-3 mb-2 border-b border-retro-border/50">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-xl bg-retro-primary/20 text-retro-primary">
              <KeyRound className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-bold font-arcade tracking-wider">{title}</h3>
              <p className="text-[11px] text-slate-400">{description}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-xl hover:bg-white/10 text-slate-400 hover:text-white transition-all"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {error && (
          <div className="mb-4 p-2.5 rounded-xl bg-red-500/20 border border-red-500/40 text-red-400 text-xs font-bold flex items-center gap-2 animate-bounce">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {success && (
          <div className="mb-4 p-2.5 rounded-xl bg-emerald-500/20 border border-emerald-500/40 text-emerald-400 text-xs font-bold flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 shrink-0" />
            <span>Code PIN validé !</span>
          </div>
        )}

        <ArcadeKeypad
          value={pin}
          onChange={(v) => {
            setPin(v);
            setError(null);
          }}
          onConfirm={handleValidate}
          theme={theme}
          confirmLabel={loading ? 'Vérification...' : 'Valider le PIN'}
          confirmDisabled={loading || !pin}
        />
      </div>
    </div>
  );
};
