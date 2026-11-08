import React from 'react';
import { Crown, Plus } from 'lucide-react';

export type ActiveTab = 'play' | 'analysis' | 'history' | 'statistics' | 'settings';

interface NavbarProps {
  activeTab: ActiveTab;
  onSelectTab: (tab: ActiveTab) => void;
  playerElo: number;
  onNewGameClick: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  activeTab,
  onSelectTab,
  playerElo,
  onNewGameClick,
}) => {
  return (
    <header className="w-full bg-[#121316] border-b border-zinc-800/80 sticky top-0 z-40 backdrop-blur-md">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-8">
        {/* Zone 1: Brand wordmark */}
        <button
          onClick={() => onSelectTab('play')}
          className="flex items-center gap-2.5 text-zinc-100 hover:text-white transition-colors cursor-pointer shrink-0"
        >
          <div className="w-8 h-8 rounded-lg bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
            <Crown className="w-4 h-4" />
          </div>
          <span className="text-lg font-bold tracking-tight whitespace-nowrap">
            Chess<span className="text-emerald-400">Mind</span>
          </span>
        </button>

        {/* Zone 2: Navigation Links */}
        <nav className="flex items-center gap-1 sm:gap-2 text-sm font-medium overflow-x-auto py-1">
          {(
            [
              { id: 'play', label: 'Play' },
              { id: 'analysis', label: 'Analysis' },
              { id: 'history', label: 'History' },
              { id: 'statistics', label: 'Statistics' },
              { id: 'settings', label: 'Settings' },
            ] as const
          ).map((tab) => {
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => onSelectTab(tab.id)}
                className={`px-3 py-1.5 rounded-lg text-xs sm:text-sm transition-all whitespace-nowrap shrink-0 cursor-pointer ${
                  isActive
                    ? 'text-white bg-zinc-800/90 font-semibold shadow-xs'
                    : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-850'
                }`}
              >
                {tab.label}
              </button>
            );
          })}
        </nav>

        {/* Zone 3: Primary Action */}
        <div className="flex items-center gap-3 shrink-0">
          <div className="hidden sm:flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-zinc-900 border border-zinc-800 text-xs font-mono tabular-nums text-zinc-300">
            <span className="text-zinc-500 font-sans text-[11px]">Elo</span>
            <span className="font-semibold text-emerald-400">{playerElo}</span>
          </div>

          <button
            onClick={onNewGameClick}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs sm:text-sm font-medium text-white bg-emerald-600 hover:bg-emerald-500 active:scale-95 rounded-lg transition-all shadow-sm cursor-pointer whitespace-nowrap shrink-0"
          >
            <Plus className="w-4 h-4" />
            <span>New Game</span>
          </button>
        </div>
      </div>
    </header>
  );
};
