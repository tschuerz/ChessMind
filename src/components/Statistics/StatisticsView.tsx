import React from 'react';
import { storage } from '../../services/storage';
import {
  TrendingUp,
  Award,
  Target,
  BarChart2,
  Shield,
  Lightbulb,
  AlertTriangle,
  Zap,
} from 'lucide-react';

export const StatisticsView: React.FC = () => {
  const stats = storage.getAggregateStats();
  const ratingHistory = storage.getRatingHistory();

  // SVG Rating chart math
  const minRating = Math.max(100, Math.min(...ratingHistory.map((r) => r.rating)) - 100);
  const maxRating = Math.max(minRating + 200, Math.max(...ratingHistory.map((r) => r.rating)) + 100);

  const getChartY = (rating: number) => {
    const range = maxRating - minRating;
    if (range === 0) return 30;
    // Map rating to 5 (top) to 55 (bottom)
    const ratio = (rating - minRating) / range;
    return 55 - ratio * 50;
  };

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6 space-y-6">
      {/* Title & Official Rating Disclaimer */}
      <div>
        <h1 className="text-xl sm:text-2xl font-bold text-white mb-1">
          Performance & Training Statistics
        </h1>
        <p className="text-xs text-zinc-400">
          Estimated training rating based on performance against calibrated Stockfish engine levels (not an official FIDE or Chess.com rating).
        </p>
      </div>

      {/* Top Metric Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Estimated Elo */}
        <div className="p-4 rounded-xl bg-[#141519] border border-zinc-800">
          <div className="flex items-center justify-between text-xs text-zinc-400 mb-1">
            <span>Estimated Elo</span>
            <TrendingUp className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="text-2xl font-bold font-mono text-white">
            {stats.currentElo}
          </div>
          <div className="text-[11px] text-zinc-500 mt-1">
            Peak: <span className="text-zinc-300 font-mono font-medium">{stats.highestElo}</span>
          </div>
        </div>

        {/* Win Rate */}
        <div className="p-4 rounded-xl bg-[#141519] border border-zinc-800">
          <div className="flex items-center justify-between text-xs text-zinc-400 mb-1">
            <span>Win Rate</span>
            <Target className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="text-2xl font-bold font-mono text-white">
            {stats.winRate}%
          </div>
          <div className="text-[11px] text-zinc-500 mt-1 font-mono">
            {stats.wins}W · {stats.losses}L · {stats.draws}D
          </div>
        </div>

        {/* Average Accuracy */}
        <div className="p-4 rounded-xl bg-[#141519] border border-zinc-800">
          <div className="flex items-center justify-between text-xs text-zinc-400 mb-1">
            <span>Average Accuracy</span>
            <Zap className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="text-2xl font-bold font-mono text-white">
            {stats.averageAccuracy > 0 ? `${stats.averageAccuracy}%` : '—'}
          </div>
          <div className="text-[11px] text-zinc-500 mt-1">
            Calculated across {stats.totalGames} match{stats.totalGames !== 1 ? 'es' : ''}
          </div>
        </div>

        {/* Total Games */}
        <div className="p-4 rounded-xl bg-[#141519] border border-zinc-800">
          <div className="flex items-center justify-between text-xs text-zinc-400 mb-1">
            <span>Games Played</span>
            <BarChart2 className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="text-2xl font-bold font-mono text-white">
            {stats.totalGames}
          </div>
          <div className="text-[11px] text-zinc-500 mt-1">
            {stats.whiteGames} as White · {stats.blackGames} as Black
          </div>
        </div>
      </div>

      {/* Rating Progression Chart */}
      <div className="p-5 rounded-2xl bg-[#141519] border border-zinc-800">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-sm font-bold text-white uppercase tracking-wider">
              Rating Progression
            </h2>
            <span className="text-xs text-zinc-500">
              Elo trajectory over matches played
            </span>
          </div>
          <div className="text-xs font-mono text-zinc-400">
            Current: <span className="font-bold text-emerald-400">{stats.currentElo} Elo</span>
          </div>
        </div>

        {/* SVG Chart */}
        <div className="w-full h-44 relative">
          <svg className="w-full h-full overflow-visible" preserveAspectRatio="none" viewBox="0 0 100 60">
            {/* Horizontal Grid lines */}
            <line x1="0" y1="15" x2="100" y2="15" stroke="#27272a" strokeWidth="0.5" strokeDasharray="2,2" />
            <line x1="0" y1="35" x2="100" y2="35" stroke="#27272a" strokeWidth="0.5" strokeDasharray="2,2" />
            <line x1="0" y1="55" x2="100" y2="55" stroke="#27272a" strokeWidth="0.5" strokeDasharray="2,2" />

            {/* Polyline */}
            {ratingHistory.length > 1 ? (
              <polyline
                fill="none"
                stroke="#10b981"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                points={ratingHistory
                  .map((pt, idx) => {
                    const x = (idx / (ratingHistory.length - 1)) * 100;
                    const y = getChartY(pt.rating);
                    return `${x.toFixed(1)},${y.toFixed(1)}`;
                  })
                  .join(' ')}
              />
            ) : null}

            {/* Circles for points */}
            {ratingHistory.map((pt, idx) => {
              const x = (idx / Math.max(1, ratingHistory.length - 1)) * 100;
              const y = getChartY(pt.rating);
              return (
                <circle
                  key={idx}
                  cx={x}
                  cy={y}
                  r="2.5"
                  fill="#10b981"
                  stroke="#141519"
                  strokeWidth="1"
                />
              );
            })}
          </svg>
        </div>
      </div>

      {/* Grid: Color Performance, Difficulties, and Mistakes Breakdown */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        {/* Color Performance */}
        <div className="p-4 rounded-xl bg-[#141519] border border-zinc-800">
          <h3 className="text-xs font-bold text-zinc-300 uppercase tracking-wider mb-4">
            Color Performance
          </h3>
          <div className="space-y-4">
            <div>
              <div className="flex items-center justify-between text-xs mb-1">
                <span className="text-zinc-300">As White</span>
                <span className="font-mono font-bold text-white">{stats.whiteWinRate}% Win</span>
              </div>
              <div className="w-full bg-zinc-800 rounded-full h-2 overflow-hidden">
                <div
                  className="bg-zinc-200 h-2 rounded-full transition-all"
                  style={{ width: `${stats.whiteWinRate}%` }}
                />
              </div>
              <div className="text-[11px] text-zinc-500 mt-1 font-mono">
                {stats.whiteGames} matches played
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between text-xs mb-1">
                <span className="text-zinc-300">As Black</span>
                <span className="font-mono font-bold text-white">{stats.blackWinRate}% Win</span>
              </div>
              <div className="w-full bg-zinc-800 rounded-full h-2 overflow-hidden">
                <div
                  className="bg-emerald-500 h-2 rounded-full transition-all"
                  style={{ width: `${stats.blackWinRate}%` }}
                />
              </div>
              <div className="text-[11px] text-zinc-500 mt-1 font-mono">
                {stats.blackGames} matches played
              </div>
            </div>
          </div>
        </div>

        {/* Mistakes Distribution */}
        <div className="p-4 rounded-xl bg-[#141519] border border-zinc-800">
          <h3 className="text-xs font-bold text-zinc-300 uppercase tracking-wider mb-4">
            Tactical Accuracy Flaws
          </h3>
          <div className="space-y-3 font-mono text-xs">
            <div className="flex items-center justify-between p-2 rounded-lg bg-zinc-900 border border-zinc-800">
              <span className="text-rose-400 font-semibold">Blunders (??)</span>
              <span className="font-bold text-white">{stats.totalBlunders}</span>
            </div>
            <div className="flex items-center justify-between p-2 rounded-lg bg-zinc-900 border border-zinc-800">
              <span className="text-orange-400 font-semibold">Mistakes (?)</span>
              <span className="font-bold text-white">{stats.totalMistakes}</span>
            </div>
            <div className="flex items-center justify-between p-2 rounded-lg bg-zinc-900 border border-zinc-800">
              <span className="text-amber-400 font-semibold">Inaccuracies (?!)</span>
              <span className="font-bold text-white">{stats.totalInaccuracies}</span>
            </div>
          </div>
        </div>

        {/* Performance by AI Difficulty Bracket */}
        <div className="p-4 rounded-xl bg-[#141519] border border-zinc-800">
          <h3 className="text-xs font-bold text-zinc-300 uppercase tracking-wider mb-4">
            AI Tier Record
          </h3>
          <div className="space-y-2.5">
            {Object.entries(stats.difficultyStats).map(([bracket, bStats]) => {
              const winPct = bStats.games > 0 ? Math.round((bStats.wins / bStats.games) * 100) : 0;
              return (
                <div key={bracket} className="text-xs">
                  <div className="flex items-center justify-between text-zinc-400 mb-0.5">
                    <span className="truncate max-w-[140px]">{bracket}</span>
                    <span className="font-mono text-zinc-300">
                      {bStats.wins}/{bStats.games} ({winPct}%)
                    </span>
                  </div>
                  <div className="w-full bg-zinc-800 rounded-full h-1.5 overflow-hidden">
                    <div
                      className="bg-emerald-500 h-1.5 rounded-full"
                      style={{ width: `${winPct}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Top Openings Table */}
      <div className="p-5 rounded-2xl bg-[#141519] border border-zinc-800">
        <h3 className="text-xs font-bold text-zinc-300 uppercase tracking-wider mb-3">
          Most Played Openings
        </h3>
        {stats.topOpenings.length === 0 ? (
          <div className="text-xs text-zinc-500 py-4 text-center">
            No opening data recorded yet.
          </div>
        ) : (
          <div className="divide-y divide-zinc-800">
            {stats.topOpenings.map((op, idx) => (
              <div key={idx} className="py-2.5 flex items-center justify-between text-xs">
                <span className="font-medium text-zinc-200">{op.name}</span>
                <div className="flex items-center gap-4 font-mono">
                  <span className="text-zinc-500">{op.count} game{op.count > 1 ? 's' : ''}</span>
                  <span
                    className={`font-bold ${
                      op.winRate >= 50 ? 'text-emerald-400' : 'text-zinc-400'
                    }`}
                  >
                    {op.winRate}% Win
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* AI Progression Advice Card */}
      <div className="p-5 rounded-2xl bg-emerald-950/20 border border-emerald-800/40">
        <div className="flex items-center gap-2 mb-2 text-xs font-bold text-emerald-400 uppercase tracking-wider">
          <Lightbulb className="w-4 h-4" />
          <span>Recommended Training Routine</span>
        </div>
        <p className="text-xs text-emerald-100/90 leading-relaxed mb-3">
          Based on your historical win rate of {stats.winRate}% and tactical distribution, here is your customized plan to push past {stats.currentElo} Elo:
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="p-3 rounded-xl bg-zinc-900/80 border border-zinc-800 text-xs text-zinc-300">
            <span className="font-semibold text-white block mb-1">1. Anti-Blunder Protocol</span>
            Before making every move, scan opponent's knight forks and hanging pieces.
          </div>
          <div className="p-3 rounded-xl bg-zinc-900/80 border border-zinc-800 text-xs text-zinc-300">
            <span className="font-semibold text-white block mb-1">2. Target Practice</span>
            Set Stockfish to {Math.max(400, stats.currentElo + 100)} Elo for tough tactical sparring.
          </div>
          <div className="p-3 rounded-xl bg-zinc-900/80 border border-zinc-800 text-xs text-zinc-300">
            <span className="font-semibold text-white block mb-1">3. Endgame Conversion</span>
            Practice king activation and outside passed pawns in simplified endgames.
          </div>
        </div>
      </div>
    </div>
  );
};
