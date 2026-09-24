import React from 'react';
import { Trophy, Tag } from 'lucide-react';
import { FranchiseCollection, CustomFranchise } from '../../../types';

interface SidebarFranchisesProps {
  popularFranchises: FranchiseCollection[];
  customFranchises: CustomFranchise[];
  enabledFranchises: string[];
  selectedCategory: string;
  onSelectCategory: (cat: string) => void;
  gamesCountByFranchise: Record<string, number>;
}

export const SidebarFranchises: React.FC<SidebarFranchisesProps> = ({
  popularFranchises,
  customFranchises = [],
  enabledFranchises = [],
  selectedCategory,
  onSelectCategory,
  gamesCountByFranchise,
}) => {
  const visiblePopular = popularFranchises.filter((f) => {
    if (!enabledFranchises || !Array.isArray(enabledFranchises) || enabledFranchises.length === 0) return true;
    return enabledFranchises.includes(f.id);
  });

  const visibleCustom = (customFranchises || []).filter((f) => {
    if (!enabledFranchises || !Array.isArray(enabledFranchises) || enabledFranchises.length === 0) return true;
    return enabledFranchises.includes(f.id);
  });

  if (visiblePopular.length === 0 && visibleCustom.length === 0) {
    return null;
  }

  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between px-3 mb-2">
        <span
          style={{ color: 'var(--text-muted)' }}
          className="text-[11px] font-black uppercase tracking-wider font-sans"
        >
          FRANCHISES CULTES
        </span>
        <Trophy
          className="w-3.5 h-3.5"
          style={{ color: 'var(--accent-primary)' }}
        />
      </div>

      <div className="space-y-0.5">
        {visiblePopular.map((franchise) => {
          const count = gamesCountByFranchise[franchise.id] || 0;
          const isSelected = selectedCategory === `franchise:${franchise.id}`;

          return (
            <button
              key={franchise.id}
              onClick={() => onSelectCategory(`franchise:${franchise.id}`)}
              style={{
                backgroundColor: isSelected ? 'var(--accent-primary)' : 'transparent',
                color: isSelected ? '#ffffff' : 'var(--text-primary)',
                borderColor: isSelected ? 'var(--accent-primary)' : 'transparent',
              }}
              className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-semibold transition-all border ${
                isSelected ? 'shadow-sm font-bold scale-[1.01]' : 'hover:bg-black/5'
              }`}
            >
              <div className="flex items-center gap-2.5 truncate">
                <Tag
                  className="w-3.5 h-3.5 shrink-0"
                  style={{ color: isSelected ? '#ffffff' : 'var(--accent-primary)' }}
                />
                <span className="truncate">{franchise.name}</span>
              </div>
              {count > 0 && (
                <span
                  style={{
                    backgroundColor: isSelected ? 'rgba(255, 255, 255, 0.25)' : 'var(--bg-card)',
                    color: isSelected ? '#ffffff' : 'var(--text-secondary)',
                  }}
                  className="text-[10px] px-2 py-0.5 rounded-full font-bold ml-1 shrink-0"
                >
                  {count}
                </span>
              )}
            </button>
          );
        })}

        {visibleCustom.map((custom) => {
          const count = gamesCountByFranchise[custom.id] || 0;
          const isSelected = selectedCategory === `franchise:${custom.id}`;

          return (
            <button
              key={custom.id}
              onClick={() => onSelectCategory(`franchise:${custom.id}`)}
              style={{
                backgroundColor: isSelected ? 'var(--accent-primary)' : 'transparent',
                color: isSelected ? '#ffffff' : 'var(--text-primary)',
                borderColor: isSelected ? 'var(--accent-primary)' : 'transparent',
              }}
              className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-semibold transition-all border ${
                isSelected ? 'shadow-sm font-bold scale-[1.01]' : 'hover:bg-black/5'
              }`}
            >
              <div className="flex items-center gap-2.5 truncate">
                <Tag
                  className="w-3.5 h-3.5 shrink-0"
                  style={{ color: isSelected ? '#ffffff' : 'var(--accent-secondary)' }}
                />
                <span className="truncate">{custom.name}</span>
              </div>
              {count > 0 && (
                <span
                  style={{
                    backgroundColor: isSelected ? 'rgba(255, 255, 255, 0.25)' : 'var(--bg-card)',
                    color: isSelected ? '#ffffff' : 'var(--text-secondary)',
                  }}
                  className="text-[10px] px-2 py-0.5 rounded-full font-bold ml-1 shrink-0"
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
