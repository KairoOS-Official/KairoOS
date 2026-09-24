import React from 'react';
import { System } from '../../../types';
import { ConsoleLogo } from '../../common/ConsoleLogo';

interface SidebarSystemsProps {
  systems: System[];
  selectedCategory: string;
  onSelectCategory: (category: string) => void;
  gamesCountBySystem: Record<string, number>;
  enabledSystems?: string[];
}

export const SidebarSystems: React.FC<SidebarSystemsProps> = ({
  systems,
  selectedCategory,
  onSelectCategory,
  gamesCountBySystem,
  enabledSystems,
}) => {
  const visibleSystems = systems.filter((s) => {
    if (!enabledSystems || !Array.isArray(enabledSystems) || enabledSystems.length === 0) return true;
    return enabledSystems.includes(s.id);
  });

  if (visibleSystems.length === 0) {
    return null;
  }

  return (
    <div className="space-y-1">
      <h3
        style={{ color: 'var(--text-muted)' }}
        className="px-3 text-[11px] font-black uppercase tracking-wider font-sans mb-2"
      >
        CONSOLES & SYSTÈMES
      </h3>

      <div className="space-y-0.5">
        {visibleSystems.map((system) => {
          const isSelected = selectedCategory === system.id;
          const count = gamesCountBySystem[system.id] || 0;

          return (
            <button
              key={system.id}
              onClick={() => onSelectCategory(system.id)}
              style={{
                backgroundColor: isSelected ? 'var(--accent-primary)' : 'transparent',
                color: isSelected ? '#ffffff' : 'var(--text-primary)',
                borderColor: isSelected ? 'var(--accent-primary)' : 'transparent',
              }}
              className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-semibold transition-all border ${
                isSelected ? 'shadow-sm font-bold' : 'hover:bg-black/5'
              }`}
            >
              <div className="flex items-center gap-2.5 min-w-0">
                <ConsoleLogo systemId={system.id} size="sm" className="shrink-0" />
                <span className="truncate">{system.name}</span>
              </div>

              {count > 0 && (
                <span
                  style={{
                    backgroundColor: isSelected ? 'rgba(255, 255, 255, 0.25)' : 'var(--bg-card)',
                    color: isSelected ? '#ffffff' : 'var(--text-muted)',
                    borderColor: 'var(--border-color)',
                  }}
                  className="text-[10px] font-bold px-1.5 py-0.2 rounded-md font-mono border"
                >
                  {count}
                </span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
};