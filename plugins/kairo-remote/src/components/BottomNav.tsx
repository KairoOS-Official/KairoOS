import React from 'react';
import { LayoutDashboard, Gamepad2, PlusCircle, Sliders, Lock, Shield, Smartphone, Terminal, Puzzle, Globe, Trophy, Sparkles, Tv, Download } from 'lucide-react';
import { ThemeMode, StatusResponse, ContributedNavItem } from '../types';

const renderContributedIcon = (iconName?: string) => {
  switch (iconName?.toLowerCase()) {
    case 'globe':
      return <Globe className="w-5 h-5 text-indigo-500" />;
    case 'trophy':
      return <Trophy className="w-5 h-5 text-amber-500" />;
    case 'sparkles':
      return <Sparkles className="w-5 h-5 text-pink-500" />;
    case 'download':
      return <Download className="w-5 h-5 text-emerald-500" />;
    case 'tv':
      return <Tv className="w-5 h-5 text-cyan-500" />;
    default:
      return <Puzzle className="w-5 h-5 text-purple-500" />;
  }
};

interface BottomNavProps {
  currentTab: string;
  onSelectTab: (tab: any) => void;
  status: StatusResponse | null;
  theme: ThemeMode;
  onOpenGamepad: () => void;
  contributedNavItems?: ContributedNavItem[];
}

export const BottomNav: React.FC<BottomNavProps> = ({
  currentTab,
  onSelectTab,
  status,
  theme,
  onOpenGamepad,
  contributedNavItems,
}) => {
  const isDark = theme === 'dark';

  const navItems = [
    { id: 'dashboard', label: 'Borne', icon: LayoutDashboard, hasDot: status?.is_running },
    { id: 'games', label: 'Jeux', icon: Gamepad2 },
    { id: 'add', label: 'Ajouter', icon: PlusCircle },
    { id: 'settings', label: 'Réglages', icon: Sliders },
    { id: 'console', label: 'Console', icon: Terminal },
  ];

  return (
    <nav className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-white border-t border-slate-200 px-2 py-1.5 flex items-center justify-around shadow-sm">
      {navItems.map((item) => {
        const Icon = item.icon;
        const isActive = currentTab === item.id;

        return (
          <button
            key={item.id}
            onClick={() => onSelectTab(item.id)}
            className={`flex flex-col items-center gap-1 p-2 rounded-lg transition-colors relative ${
              isActive ? 'text-blue-600 font-bold' : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            <div className="relative">
              <Icon className="w-5 h-5" />
              {item.hasDot && (
                <span className="absolute -top-1 -right-1 w-2 h-2 rounded-full bg-emerald-500" />
              )}
            </div>
            <span className="text-[10px] font-semibold">{item.label}</span>
          </button>
        );
      })}

      {contributedNavItems?.map((item) => {
        const isActive = currentTab === `contrib:${item.id}`;
        return (
          <button
            key={item.id}
            onClick={() => onSelectTab(`contrib:${item.id}`)}
            className={`flex flex-col items-center gap-1 p-2 rounded-lg transition-colors relative ${
              isActive ? 'text-purple-600 font-bold' : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            {renderContributedIcon(item.icon)}
            <span className="text-[10px] font-semibold truncate max-w-[50px]">{item.label}</span>
          </button>
        );
      })}

      {/* Bouton Manette Mobile direct */}
      <button
        onClick={onOpenGamepad}
        className="flex flex-col items-center gap-1 p-2 rounded-lg text-emerald-600 hover:text-emerald-700 font-bold transition-colors"
      >
        <Smartphone className="w-5 h-5" />
        <span className="text-[10px]">Manette</span>
      </button>
    </nav>
  );
};
