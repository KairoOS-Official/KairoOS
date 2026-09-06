import React, { useState } from 'react';
import { Lock, Shield, KeyRound, AlertCircle, CheckCircle2, ArrowRight } from 'lucide-react';
import { ArcadeKeypad } from './ArcadeKeypad';

interface LoginScreenProps {
  onLogin: (pin: string) => Promise<boolean>;
  theme?: 'dark' | 'light';
}

export const LoginScreen: React.FC<LoginScreenProps> = ({ onLogin, theme = 'light' }) => {
  const [pin, setPin] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!pin) {
      setError('Veuillez saisir votre code PIN');
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const ok = await onLogin(pin);
      if (ok) {
        setSuccess(true);
      } else {
        setError('Code PIN incorrect. Veuillez réessayer.');
        setPin('');
      }
    } catch (err: any) {
      setError(err.message || 'Erreur de connexion');
    } finally {
      setLoading(false);
    }
  };

  const isDark = theme === 'dark';

  return (
    <div
      className={`min-h-screen w-full flex items-center justify-center p-4 sm:p-6 select-none transition-colors ${
        isDark ? 'bg-slate-950 text-slate-100' : 'bg-slate-100 text-slate-800'
      }`}
    >
      <div
        className={`w-full max-w-md rounded-3xl p-6 sm:p-8 border shadow-xl transition-all ${
          isDark
            ? 'bg-slate-900 border-slate-800 shadow-2xl'
            : 'bg-white border-slate-200 shadow-lg'
        }`}
      >
        {/* Header de Connexion */}
        <div className="text-center space-y-3 pb-6 border-b border-slate-200/80 dark:border-slate-800">
          <div className="w-14 h-14 rounded-2xl bg-indigo-600 text-white flex items-center justify-center mx-auto shadow-md">
            <Shield className="w-7 h-7" />
          </div>
          <div>
            <h1 className="text-xl font-bold font-sans tracking-tight">
              KaïroOS <span className="text-indigo-600 dark:text-indigo-400">Remote</span>
            </h1>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Authentification sécurisée — Entrez le code PIN de la borne
            </p>
          </div>
        </div>

        {/* Message d'Erreur ou Succès */}
        {error && (
          <div className="mt-4 p-3 rounded-2xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800/60 text-red-600 dark:text-red-400 text-xs font-semibold flex items-center gap-2 animate-bounce">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {success && (
          <div className="mt-4 p-3 rounded-2xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/60 text-emerald-600 dark:text-emerald-400 text-xs font-semibold flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 shrink-0" />
            <span>Connexion réussie ! Redirection...</span>
          </div>
        )}

        {/* Formulaire & Pavé Numérique */}
        <div className="mt-6 space-y-6">
          <ArcadeKeypad
            value={pin}
            onChange={(v) => {
              setPin(v);
              setError(null);
            }}
            onConfirm={() => handleSubmit()}
            theme={theme}
            confirmLabel={loading ? 'Connexion en cours...' : 'SE CONNECTER'}
            confirmDisabled={loading || pin.length === 0}
          />
        </div>

        {/* Footer simple */}
        <div className="mt-6 pt-4 border-t border-slate-200/80 dark:border-slate-800 text-center">
          <p className="text-[11px] text-slate-400">
            Code PIN par défaut : <code className="font-mono font-bold text-indigo-600 dark:text-indigo-400">1234</code>
          </p>
        </div>
      </div>
    </div>
  );
};
