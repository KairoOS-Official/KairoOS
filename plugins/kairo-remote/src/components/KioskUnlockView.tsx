import React, { useState } from 'react';
import { Lock, Unlock, KeyRound, AlertCircle, CheckCircle2 } from 'lucide-react';
import { ArcadeKeypad } from './ArcadeKeypad';
import { ThemeMode, StatusResponse } from '../types';

interface KioskUnlockViewProps {
  status: StatusResponse | null;
  onUnlockKiosk: (pin: string) => Promise<boolean>;
  onLockKiosk: () => Promise<void>;
  loading: boolean;
  theme: ThemeMode;
}

export const KioskUnlockView: React.FC<KioskUnlockViewProps> = ({
  status,
  onUnlockKiosk,
  onLockKiosk,
  loading,
  theme,
}) => {
  const isDark = theme === 'dark';
  const [pin, setPin] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const handleUnlock = async () => {
    if (!pin) {
      setError('Veuillez saisir votre code PIN');
      return;
    }

    setError(null);
    const ok = await onUnlockKiosk(pin);
    if (ok) {
      setSuccess(true);
      setPin('');
      setTimeout(() => setSuccess(false), 2000);
    } else {
      setError('Code PIN incorrect');
      setPin('');
    }
  };

  return (
    <div className="max-w-sm mx-auto space-y-6 animate-in fade-in duration-200">
      <div
        className={`p-6 sm:p-8 rounded-3xl border text-center space-y-5 shadow-xl ${
          isDark ? 'bg-retro-card border-retro-border text-white' : 'bg-white border-retro-border text-retro-text'
        }`}
      >
        <div
          className={`w-16 h-16 rounded-3xl border flex items-center justify-center mx-auto shadow-md ${
            status?.kiosk_mode
              ? 'bg-amber-500/20 text-amber-400 border-amber-500/40'
              : 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40'
          }`}
        >
          {status?.kiosk_mode ? <Lock className="w-8 h-8" /> : <Unlock className="w-8 h-8" />}
        </div>

        <div>
          <h2 className="text-base font-black font-arcade uppercase tracking-wider">
            {status?.kiosk_mode ? 'DÉVERROUILLAGE MODE KIOSK' : 'MODE ADMIN ACTIF'}
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            {status?.kiosk_mode
              ? 'Saisissez le code PIN pour débloquer les paramètres sur la borne.'
              : 'La borne est actuellement déverrouillée.'}
          </p>
        </div>

        {error && (
          <div className="p-2.5 rounded-xl bg-red-500/20 border border-red-500/40 text-red-400 text-xs font-bold font-arcade flex items-center justify-center gap-2 animate-bounce">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {success && (
          <div className="p-2.5 rounded-xl bg-emerald-500/20 border border-emerald-500/40 text-emerald-400 text-xs font-bold font-arcade flex items-center justify-center gap-2">
            <CheckCircle2 className="w-4 h-4 shrink-0" />
            <span>Borne déverrouillée avec succès !</span>
          </div>
        )}

        {status?.kiosk_mode ? (
          <ArcadeKeypad
            value={pin}
            onChange={(v) => {
              setPin(v);
              setError(null);
            }}
            onConfirm={handleUnlock}
            theme={theme}
            confirmLabel={loading ? 'Déverrouillage...' : 'DÉVERROUILLER LA BORNE'}
            confirmDisabled={loading || !pin}
          />
        ) : (
          <button
            onClick={onLockKiosk}
            disabled={loading}
            className="w-full py-4 rounded-2xl bg-amber-500 hover:bg-amber-400 text-retro-dark font-black font-arcade text-xs tracking-wider shadow-lg flex items-center justify-center gap-2 active:scale-95 transition-all"
          >
            <Lock className="w-4 h-4" />
            <span>ACTIVER LE MODE KIOSK (VERROUILLER)</span>
          </button>
        )}
      </div>
    </div>
  );
};
