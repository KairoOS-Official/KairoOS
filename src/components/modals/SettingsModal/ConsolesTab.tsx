import React from 'react';
import { Gamepad2, Check, Tv, Users, Swords, Layers, Sparkles } from 'lucide-react';
import { System } from '../../../types';
import { ConsoleLogo } from '../../common/ConsoleLogo';

interface ConsolesTabProps {
  systems: System[];
  enabledSystems: string[];
  setEnabledSystems: (systems: string[]) => void;
  enabledModes?: string[];
  setEnabledModes?: (modes: string[]) => void;
  enabledFranchises?: string[];
  setEnabledFranchises?: (franchises: string[]) => void;
}

const AVAILABLE_MODES = [
  {
    id: '2-players',
    name: 'Jeux à 2 Joueurs',
    subtitle: 'Multijoueur simultané, Versus fighting & Co-op',
    icon: Users,
    color: 'from-purple-600 to-indigo-500',
  },
  {
    id: 'genre:fight',
    name: 'Jeux de Combat',
    subtitle: 'Street Fighter, Tekken, Mortal Kombat, Fatal Fury',
    icon: Swords,
    color: 'from-rose-500 to-pink-600',
  },
  {
    id: 'genre:platform',
    name: 'Jeux de Plateforme',
    subtitle: 'Mario, Sonic, Donkey Kong, Megaman, Rayman',
    icon: Gamepad2,
    color: 'from-pink-500 to-rose-400',
  },
];

const DEFAULT_FRANCHISES = [
  { id: 'mario', name: 'Super Mario', color: '#ef4444' },
  { id: 'zelda', name: 'The Legend of Zelda', color: '#10b981' },
  { id: 'pokemon', name: 'Pokémon', color: '#f59e0b' },
  { id: 'sonic', name: 'Sonic The Hedgehog', color: '#3b82f6' },
  { id: 'versus', name: 'Versus Fighting', color: '#ec4899' },
  { id: 'rpg', name: 'RPG & Aventure', color: '#8b5cf6' },
];

export const ConsolesTab: React.FC<ConsolesTabProps> = ({
  systems,
  enabledSystems,
  setEnabledSystems,
  enabledModes,
  setEnabledModes,
  enabledFranchises,
  setEnabledFranchises,
}) => {
  const safeEnabledSystems = Array.isArray(enabledSystems)
    ? enabledSystems
    : (systems ? systems.map((s) => s.id) : []);
  const safeEnabledModes = Array.isArray(enabledModes)
    ? enabledModes
    : ['2-players', 'genre:fight', 'genre:platform'];
  const safeEnabledFranchises = Array.isArray(enabledFranchises)
    ? enabledFranchises
    : ['mario', 'zelda', 'pokemon', 'sonic', 'versus', 'rpg'];

  // 1. Gestion des Modes & Genres
  const isModeEnabled = (modeId: string) => {
    return safeEnabledModes.includes(modeId);
  };

  const toggleMode = (modeId: string) => {
    if (!setEnabledModes) return;
    if (safeEnabledModes.includes(modeId)) {
      setEnabledModes(safeEnabledModes.filter((id) => id !== modeId));
    } else {
      setEnabledModes([...safeEnabledModes, modeId]);
    }
  };

  // 2. Gestion des Consoles
  const isSystemEnabled = (sysId: string) => {
    return safeEnabledSystems.includes(sysId);
  };

  const toggleSystem = (sysId: string) => {
    if (!setEnabledSystems) return;
    if (safeEnabledSystems.includes(sysId)) {
      setEnabledSystems(safeEnabledSystems.filter((id) => id !== sysId));
    } else {
      setEnabledSystems([...safeEnabledSystems, sysId]);
    }
  };

  // 3. Gestion des Franchises
  const isFranchiseEnabled = (fId: string) => {
    return safeEnabledFranchises.includes(fId);
  };

  const toggleFranchise = (fId: string) => {
    if (!setEnabledFranchises) return;
    if (safeEnabledFranchises.includes(fId)) {
      setEnabledFranchises(safeEnabledFranchises.filter((id) => id !== fId));
    } else {
      setEnabledFranchises([...safeEnabledFranchises, fId]);
    }
  };

  return (
    <div className="space-y-8">
      {/* SECTION 1: Modes & Genres Arcade Intelligents */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-purple-600" />
            <h3 className="text-xs font-black uppercase tracking-wider text-slate-900 font-sans">
              MODES & GENRES ARCADE (SIDEBAR)
            </h3>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setEnabledModes?.(AVAILABLE_MODES.map((m) => m.id))}
              className="px-2.5 py-1 rounded-lg bg-white border border-purple-200 text-purple-700 text-[11px] font-bold hover:bg-purple-50 shadow-2xs transition-all active:scale-95 cursor-pointer"
            >
              Tout Activer
            </button>
            <button
              type="button"
              onClick={() => setEnabledModes?.([])}
              className="px-2.5 py-1 rounded-lg bg-white border border-slate-200 text-slate-600 text-[11px] font-bold hover:bg-slate-50 shadow-2xs transition-all active:scale-95 cursor-pointer"
            >
              Tout Masquer
            </button>
            <span className="text-[11px] text-slate-400 font-mono ml-1">
              {safeEnabledModes.length}/{AVAILABLE_MODES.length} ACTIVÉS
            </span>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {AVAILABLE_MODES.map((mode) => {
            const active = isModeEnabled(mode.id);
            const Icon = mode.icon;

            return (
              <div
                key={mode.id}
                role="button"
                tabIndex={0}
                onClick={() => toggleMode(mode.id)}
                className={`p-4 rounded-2xl border-2 transition-all cursor-pointer flex items-center justify-between shadow-xs ${
                  active
                    ? 'bg-white border-purple-500 shadow-purple-500/10'
                    : 'bg-slate-50 border-slate-200 opacity-50'
                }`}
              >
                <div className="flex items-center gap-3">
                  <div
                    className={`w-9 h-9 rounded-xl flex items-center justify-center text-white shadow-xs bg-gradient-to-tr ${mode.color}`}
                  >
                    <Icon className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="font-extrabold text-xs text-slate-900">{mode.name}</div>
                    <div className="text-[10px] text-slate-500 line-clamp-1">{mode.subtitle}</div>
                  </div>
                </div>

                <div
                  className={`w-5 h-5 rounded-md flex items-center justify-center transition-all ${
                    active ? 'bg-purple-600 text-white shadow-xs' : 'border border-slate-300 bg-white'
                  }`}
                >
                  {active && <Check className="w-3 h-3 stroke-[3]" />}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* SECTION 2: Consoles & Systèmes */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Tv className="w-4 h-4 text-rose-500" />
            <h3 className="text-xs font-black uppercase tracking-wider text-slate-900 font-sans">
              CONSOLES & SYSTÈMES VISIBLES
            </h3>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setEnabledSystems(systems.map((s) => s.id))}
              className="px-2.5 py-1 rounded-lg bg-white border border-purple-200 text-purple-700 text-[11px] font-bold hover:bg-purple-50 shadow-2xs transition-all active:scale-95"
            >
              Tout Activer
            </button>
            <button
              type="button"
              onClick={() => setEnabledSystems([])}
              className="px-2.5 py-1 rounded-lg bg-white border border-slate-200 text-slate-600 text-[11px] font-bold hover:bg-slate-50 shadow-2xs transition-all active:scale-95"
            >
              Tout Masquer
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {systems.map((system) => {
            const active = isSystemEnabled(system.id);

            return (
              <div
                key={system.id}
                role="button"
                tabIndex={0}
                onClick={() => toggleSystem(system.id)}
                className={`p-3.5 rounded-2xl border-2 transition-all cursor-pointer flex items-center justify-between shadow-2xs ${
                  active
                    ? 'bg-white border-rose-500 shadow-rose-500/5'
                    : 'bg-slate-50 border-slate-200 opacity-50'
                }`}
              >
                <div className="flex items-center gap-3">
                  <div className="shrink-0 flex items-center justify-center">
                    <ConsoleLogo systemId={system.id} size="md" />
                  </div>

                  <div>
                    <div className="font-extrabold text-xs text-slate-900">{system.name}</div>
                    <div className="text-[10px] font-mono text-slate-400 uppercase">
                      {system.id} • {system.extensions.slice(0, 2).join(', ')}
                    </div>
                  </div>
                </div>

                <div
                  className={`w-5 h-5 rounded-md flex items-center justify-center transition-all ${
                    active ? 'bg-rose-500 text-white shadow-xs' : 'border border-slate-300 bg-white'
                  }`}
                >
                  {active && <Check className="w-3 h-3 stroke-[3]" />}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* SECTION 3: Franchises Populaires */}
      {setEnabledFranchises && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Layers className="w-4 h-4 text-indigo-500" />
              <h3 className="text-xs font-black uppercase tracking-wider text-slate-900 font-sans">
                FRANCHISES & COLLECTIONS CÉLÈBRES
              </h3>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setEnabledFranchises(DEFAULT_FRANCHISES.map((f) => f.id))}
                className="px-2.5 py-1 rounded-lg bg-white border border-indigo-200 text-indigo-700 text-[11px] font-bold hover:bg-indigo-50 shadow-2xs transition-all active:scale-95"
              >
                Tout Activer
              </button>
              <button
                type="button"
                onClick={() => setEnabledFranchises([])}
                className="px-2.5 py-1 rounded-lg bg-white border border-slate-200 text-slate-600 text-[11px] font-bold hover:bg-slate-50 shadow-2xs transition-all active:scale-95"
              >
                Tout Masquer
              </button>
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
            {DEFAULT_FRANCHISES.map((franchise) => {
              const active = isFranchiseEnabled(franchise.id);

              return (
                <div
                  key={franchise.id}
                  role="button"
                  tabIndex={0}
                  onClick={() => toggleFranchise(franchise.id)}
                  className={`p-3 rounded-xl border-2 transition-all cursor-pointer flex items-center justify-between ${
                    active
                      ? 'bg-white border-indigo-500 shadow-2xs'
                      : 'bg-slate-50 border-slate-200 opacity-50'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <span
                      className="w-3 h-3 rounded-full"
                      style={{ backgroundColor: franchise.color }}
                    />
                    <span className="text-xs font-bold text-slate-800">{franchise.name}</span>
                  </div>

                  <div
                    className={`w-4 h-4 rounded flex items-center justify-center ${
                      active ? 'bg-indigo-600 text-white' : 'border border-slate-300 bg-white'
                    }`}
                  >
                    {active && <Check className="w-2.5 h-2.5 stroke-[3]" />}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};
