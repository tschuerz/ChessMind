import React, { useState, useEffect, useCallback } from 'react';
import { Navbar, ActiveTab } from './components/Navigation/Navbar';
import { PlayView } from './components/Play/PlayView';
import { AnalysisView } from './components/Analysis/AnalysisView';
import { HistoryView } from './components/History/HistoryView';
import { StatisticsView } from './components/Statistics/StatisticsView';
import { SettingsView } from './components/Settings/SettingsView';
import { storage } from './services/storage';
import { sounds } from './services/sound';
import { GameRecord, UserSettings, DifficultyElo, PlayerColor } from './types/chess';
import {
  Trophy,
  Target,
  Sparkles,
  ChevronRight,
  TrendingUp,
  BarChart2,
  Clock,
  Play as PlayIcon,
} from 'lucide-react';

export default function App() {
  const [activeTab, setActiveTab] = useState<ActiveTab>('play');
  const [playerElo, setPlayerElo] = useState<number>(() => storage.getPlayerRating());
  const [settings, setSettings] = useState<UserSettings>(() => storage.getSettings());
  const [games, setGames] = useState<GameRecord[]>(() => storage.getGames());
  const [selectedGameForAnalysis, setSelectedGameForAnalysis] = useState<GameRecord | null>(null);

  const [newGameTrigger, setNewGameTrigger] = useState<{
    playerColor: PlayerColor | 'random';
    aiElo: DifficultyElo;
  } | null>(null);

  // Initialize sound settings
  useEffect(() => {
    sounds.setEnabled(settings.soundEnabled);
  }, [settings]);

  const refreshData = useCallback(() => {
    setPlayerElo(storage.getPlayerRating());
    setGames(storage.getGames());
  }, []);

  const handleGameCompleted = (record: GameRecord) => {
    refreshData();
    setSelectedGameForAnalysis(record);
  };

  const handleUpdateGameRecord = useCallback((updated: GameRecord) => {
    storage.updateGame(updated);
    setGames((prev) => prev.map((g) => (g.id === updated.id ? updated : g)));
    setSelectedGameForAnalysis(updated);
  }, []);

  const handleOpenAnalysis = (game: GameRecord) => {
    setSelectedGameForAnalysis(game);
    setActiveTab('analysis');
  };

  const handleStartNewMatch = (color: PlayerColor | 'random' = 'white', elo: DifficultyElo = 1200) => {
    setNewGameTrigger({ playerColor: color, aiElo: elo });
    setActiveTab('play');
  };

  const stats = storage.getAggregateStats();
  const recentGames = games.slice(0, 3);

  return (
    <div className="min-h-screen bg-[#0d0e11] text-[#f4f4f5] flex flex-col font-sans selection:bg-emerald-500/20 selection:text-emerald-400">
      {/* Top Bar Navigation */}
      <Navbar
        activeTab={activeTab}
        onSelectTab={(tab) => {
          setActiveTab(tab);
          // If switching to analysis without a selected game, use the latest game if available
          if (tab === 'analysis' && !selectedGameForAnalysis && games.length > 0) {
            setSelectedGameForAnalysis(games[0]);
          }
        }}
        playerElo={playerElo}
        onNewGameClick={() => handleStartNewMatch('white', 1200)}
      />

      {/* Main Content Area */}
      <main className="flex-1 pb-12">
        {/* Quick Dashboard Header on Play View */}
        {activeTab === 'play' && (
          <div className="max-w-7xl mx-auto px-4 sm:px-6 pt-4 pb-1">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-2">
              <div className="p-3 rounded-xl bg-[#141519] border border-zinc-800 flex items-center justify-between">
                <div>
                  <div className="text-[11px] text-zinc-400 font-medium">Estimated Elo</div>
                  <div className="text-xl font-bold font-mono text-white mt-0.5">
                    {stats.currentElo}
                  </div>
                </div>
                <div className="w-8 h-8 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
                  <TrendingUp className="w-4 h-4" />
                </div>
              </div>

              <div className="p-3 rounded-xl bg-[#141519] border border-zinc-800 flex items-center justify-between">
                <div>
                  <div className="text-[11px] text-zinc-400 font-medium">Matches Played</div>
                  <div className="text-xl font-bold font-mono text-white mt-0.5">
                    {stats.totalGames}
                  </div>
                </div>
                <div className="w-8 h-8 rounded-lg bg-zinc-800 border border-zinc-700 flex items-center justify-center text-zinc-300">
                  <BarChart2 className="w-4 h-4 text-emerald-400" />
                </div>
              </div>

              <div className="p-3 rounded-xl bg-[#141519] border border-zinc-800 flex items-center justify-between">
                <div>
                  <div className="text-[11px] text-zinc-400 font-medium">Win Rate</div>
                  <div className="text-xl font-bold font-mono text-white mt-0.5">
                    {stats.winRate}%
                  </div>
                </div>
                <div className="w-8 h-8 rounded-lg bg-zinc-800 border border-zinc-700 flex items-center justify-center text-zinc-300">
                  <Target className="w-4 h-4 text-emerald-400" />
                </div>
              </div>

              <div className="p-3 rounded-xl bg-[#141519] border border-zinc-800 flex items-center justify-between">
                <div>
                  <div className="text-[11px] text-zinc-400 font-medium">W / L / D</div>
                  <div className="text-sm font-bold font-mono text-white mt-1">
                    <span className="text-emerald-400">{stats.wins}W</span> ·{' '}
                    <span className="text-rose-400">{stats.losses}L</span> ·{' '}
                    <span className="text-zinc-400">{stats.draws}D</span>
                  </div>
                </div>
                <div className="w-8 h-8 rounded-lg bg-zinc-800 border border-zinc-700 flex items-center justify-center text-zinc-300">
                  <Trophy className="w-4 h-4 text-emerald-400" />
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Active Tab Views */}
        {activeTab === 'play' && (
          <PlayView
            settings={settings}
            playerElo={playerElo}
            onGameCompleted={handleGameCompleted}
            onRequestAnalysis={handleOpenAnalysis}
            onUpdateSettings={(newSettings) => {
              storage.saveSettings(newSettings);
              setSettings(newSettings);
            }}
            initialSetup={newGameTrigger}
          />
        )}

        {activeTab === 'analysis' && (
          <AnalysisView
            game={selectedGameForAnalysis || (games.length > 0 ? games[0] : null)}
            settings={settings}
            onUpdateGame={handleUpdateGameRecord}
            onUpdateSettings={(newSettings) => {
              storage.saveSettings(newSettings);
              setSettings(newSettings);
            }}
            onBackToPlay={() => setActiveTab('play')}
          />
        )}

        {activeTab === 'history' && (
          <HistoryView
            games={games}
            onSelectGame={handleOpenAnalysis}
            onRefresh={refreshData}
          />
        )}

        {activeTab === 'statistics' && <StatisticsView />}

        {activeTab === 'settings' && (
          <SettingsView
            settings={settings}
            onUpdateSettings={(newSettings) => {
              storage.saveSettings(newSettings);
              setSettings(newSettings);
            }}
          />
        )}
      </main>

      {/* Footer */}
      <footer className="w-full border-t border-zinc-900 bg-[#0e0f12] py-4 text-center text-xs text-zinc-600">
        <div className="max-w-7xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-2">
          <span>ChessMind · Local-first Stockfish engine & AI coaching</span>
          <div className="flex items-center gap-4 text-zinc-500">
            <span>Standard FIDE Rules</span>
            <span>·</span>
            <span>UCI LimitStrength Calibrated</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
