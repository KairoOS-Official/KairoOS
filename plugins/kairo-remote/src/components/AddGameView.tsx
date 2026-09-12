import React, { useState } from 'react';
import { PlusCircle, Gamepad2, Folder, CheckCircle2, Sparkles } from 'lucide-react';
import { ThemeMode, System } from '../types';

interface AddGameViewProps {
  systems: System[];
  onAddGame: (path: string, systemId: string, title?: string) => Promise<void>;
  loading: boolean;
  theme: ThemeMode;
}

export const AddGameView: React.FC<AddGameViewProps> = ({
  systems,
  onAddGame,
  loading,
  theme,
}) => {
  const isDark = theme === 'dark';
  const [path, setPath] = useState('');
  const [systemId, setSystemId] = useState(systems[0]?.id || 'snes');
  const [title, setTitle] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!path.trim()) return;
    await onAddGame(path.trim(), systemId, title.trim() ? title.trim() : undefined);
    setPath('');
    setTitle('');
  };

  return (
    <div className="max-w-xl mx-auto space-y-6 animate-in fade-in duration-200">
      <div
        className={`p-6 sm:p-8 rounded-3xl border space-y-6 shadow-md ${
          isDark ? 'bg-retro-card border-retro-border text-white' : 'bg-white border-retro-border text-retro-text'
        }`}
      >
        <div className="flex items-center gap-3 pb-4 border-b border-retro-border/50">
          <div className="p-3 rounded-2xl bg-retro-primary/20 text-retro-primary border border-retro-primary/30">
            <PlusCircle className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-base font-black font-arcade uppercase tracking-wider">
              Ajouter un Jeu à la Borne
            </h2>
            <p className="text-xs text-slate-400">
              Enregistrez manuellement une ROM située sur le disque dur de la borne.
            </p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="text-xs font-bold uppercase tracking-wider block mb-1.5 text-slate-400">
              Chemin d'accès au fichier ROM *
            </label>
            <input
              type="text"
              placeholder="ex: ./roms/snes/Super Mario World (Europe).sfc"
              value={path}
              onChange={(e) => setPath(e.target.value)}
              required
              className={`w-full px-4 py-3 rounded-2xl text-xs font-mono font-bold border transition-all focus:outline-none ${
                isDark
                  ? 'bg-retro-panel border-retro-border text-white placeholder-slate-600 focus:border-retro-cyan'
                  : 'bg-retro-warm border-retro-border text-retro-text placeholder-slate-400 focus:border-retro-primary'
              }`}
            />
          </div>

          <div>
            <label className="text-xs font-bold uppercase tracking-wider block mb-1.5 text-slate-400">
              Console / Système Associé *
            </label>
            <select
              value={systemId}
              onChange={(e) => setSystemId(e.target.value)}
              className={`w-full px-4 py-3 rounded-2xl text-xs font-bold border transition-all focus:outline-none ${
                isDark
                  ? 'bg-retro-panel border-retro-border text-white focus:border-retro-cyan'
                  : 'bg-retro-warm border-retro-border text-retro-text focus:border-retro-primary'
              }`}
            >
              {systems.map((sys) => (
                <option key={sys.id} value={sys.id}>
                  {sys.name} ({sys.id})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="text-xs font-bold uppercase tracking-wider block mb-1.5 text-slate-400">
              Titre Personnalisé (Optionnel)
            </label>
            <input
              type="text"
              placeholder="Laisser vide pour un nettoyage automatique du nom de fichier"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className={`w-full px-4 py-3 rounded-2xl text-xs font-sans border transition-all focus:outline-none ${
                isDark
                  ? 'bg-retro-panel border-retro-border text-white placeholder-slate-600 focus:border-retro-cyan'
                  : 'bg-retro-warm border-retro-border text-retro-text placeholder-slate-400 focus:border-retro-primary'
              }`}
            />
          </div>

          <button
            type="submit"
            disabled={loading || !path.trim()}
            className={`w-full py-4 rounded-2xl font-black font-arcade text-xs tracking-wider uppercase transition-all shadow-lg flex items-center justify-center gap-2 active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed ${
              isDark
                ? 'bg-gradient-to-r from-retro-primary to-retro-purple text-white shadow-retro-primary/20 hover:shadow-retro-primary/40'
                : 'bg-gradient-to-r from-retro-primary to-retro-orange text-white shadow-retro'
            }`}
          >
            <PlusCircle className="w-4 h-4" />
            <span>AJOUTER À LA BIBLIOTHÈQUE KAÏROOS</span>
          </button>
        </form>
      </div>
    </div>
  );
};
