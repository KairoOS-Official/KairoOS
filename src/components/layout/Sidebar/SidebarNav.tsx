import React from 'react';
import { LayoutGrid, Star, Clock, Users, Swords, Gamepad2 } from 'lucide-react';

interface SidebarNavProps {
  selectedCategory: string;
  onSelectCategory: (category: string) => void;
  totalAllGames: number;
  totalFavorites: number;
  totalRecent: number;
  total2Players?: number;
  totalFightGames?: number;
  totalPlatformGames?: number;
  enabledModes?: string[];
}

export const SidebarNav: React.FC<SidebarNavProps> = ({
  selectedCategory,
  onSelectCategory,
  totalAllGames,
  totalFavorites,
  totalRecent,
  total2Players = 0,
  totalFightGames = 0,
  totalPlatformGames = 0,
  enabledModes,
}) => {
  const libraryItems = [
    {
      id: 'all',
      label: 'Tous les Jeux',
      icon: LayoutGrid,
      count: totalAllGames,
    },
    {
      id: 'favorites',
      label: 'Favoris',
      icon: Star,
      count: totalFavorites,
      iconColor: 'text-amber-500',
    },
    {
      id: 'recent',
      label: 'Récemment joués',
      icon: Clock,
      count: totalRecent,
      iconColor: 'text-rose-500',
    },
  ];

  const smartCollections = [
    {
      id: '2-players',
      label: 'Jeux à 2 Joueurs',
      icon: Users,
      count: total2Players,
      iconColor: 'text-purple-500',
    },
    {
      id: 'genre:fight',
      label: 'Jeux de Combat',
      icon: Swords,
      count: totalFightGames,
      iconColor: 'text-rose-500',
    },
    {
      id: 'genre:platform',
      label: 'Plateforme',
      icon: Gamepad2,
      count: totalPlatformGames,
      iconColor: 'text-indigo-500',
    },
  ];

  const visibleModes = smartCollections.filter((m) => {
    if (!enabledModes || !Array.isArray(enabledModes) || enabledModes.length === 0) return true;
    return enabledModes.includes(m.id);
  });

  return (
    <div className="space-y-4">
      {/* 1. Bibliothèque */}
      <div className="space-y-1">
        <h3
          style={{ color: 'var(--text-muted)' }}
          className="px-3 text-[11px] font-black uppercase tracking-wider font-sans mb-1"
        >
          BIBLIOTHÈQUE
        </h3>

        <div className="space-y-1">
          {libraryItems.map((item) => {
            const Icon = item.icon;
            const isSelected = selectedCategory === item.id;

            return (
              <button
                key={item.id}
                onClick={() => onSelectCategory(item.id)}
                style={{
                  backgroundColor: isSelected ? 'var(--accent-primary)' : 'transparent',
                  color: isSelected ? '#ffffff' : 'var(--text-primary)',
                  borderColor: isSelected ? 'var(--accent-primary)' : 'transparent',
                }}
                className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-2xl text-xs font-bold transition-all border ${
                  isSelected ? 'shadow-sm scale-[1.02]' : 'hover:bg-black/5'
                }`}
              >
                <div className="flex items-center gap-3">
                  <Icon
                    className="w-4 h-4"
                    style={{ color: isSelected ? '#ffffff' : undefined }}
                  />
                  <span>{item.label}</span>
                </div>

                <span
                  style={{
                    backgroundColor: isSelected ? 'rgba(255, 255, 255, 0.25)' : 'var(--bg-card)',
                    color: isSelected ? '#ffffff' : 'var(--text-muted)',
                    borderColor: 'var(--border-color)',
                  }}
                  className="text-[10px] font-bold px-2 py-0.5 rounded-full font-mono border"
                >
                  {item.count}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* 2. Collections & Filtres Intelligents */}
      {visibleModes.length > 0 && (
        <div className="space-y-1">
          <h3
            style={{ color: 'var(--text-muted)' }}
            className="px-3 text-[11px] font-black uppercase tracking-wider font-sans mb-1"
          >
            MODES & GENRES
          </h3>

          <div className="space-y-1">
            {visibleModes.map((item) => {
              const Icon = item.icon;
              const isSelected = selectedCategory === item.id;

              return (
                <button
                  key={item.id}
                  onClick={() => onSelectCategory(item.id)}
                  style={{
                    backgroundColor: isSelected ? 'var(--accent-primary)' : 'transparent',
                    color: isSelected ? '#ffffff' : 'var(--text-primary)',
                    borderColor: isSelected ? 'var(--accent-primary)' : 'transparent',
                  }}
                  className={`w-full flex items-center justify-between px-3.5 py-2 rounded-2xl text-xs font-bold transition-all border ${
                    isSelected ? 'shadow-sm scale-[1.02]' : 'hover:bg-black/5'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <Icon
                      className="w-4 h-4"
                      style={{ color: isSelected ? '#ffffff' : undefined }}
                    />
                    <span>{item.label}</span>
                  </div>

                  <span
                    style={{
                      backgroundColor: isSelected ? 'rgba(255, 255, 255, 0.25)' : 'var(--bg-card)',
                      color: isSelected ? '#ffffff' : 'var(--text-muted)',
                      borderColor: 'var(--border-color)',
                    }}
                    className="text-[10px] font-bold px-2 py-0.5 rounded-full font-mono border"
                  >
                    {item.count}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};