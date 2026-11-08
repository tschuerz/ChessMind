import React, { useState } from 'react';
import { GameRecord } from '../../types/chess';
import {
  Calendar,
  Clock,
  Award,
  Download,
  Copy,
  Check,
  ChevronRight,
  Bot,
  User,
  Trash2,
  FolderOpen,
} from 'lucide-react';
import { storage } from '../../services/storage';

interface HistoryViewProps {
  games: GameRecord[];
  onSelectGame: (game: GameRecord) => void;
  onRefresh: () => void;
}

export const HistoryView: React.FC<HistoryViewProps> = ({
  games,
  onSelectGame,
  onRefresh,
}) => {
  const [filter, setFilter] = useState<'all' | 'win' | 'loss' | 'draw'>('all');
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const filteredGames = games.filter((g) => {
    if (filter === 'all') return true;
    return g.result === filter;
  });

  const handleCopyPgn = (game: GameRecord, e: React.MouseEvent) => {
    e.stopPropagation();
    navigator.clipboard.writeText(game.pgn);
    setCopiedId(game.id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleDownloadPgn = (game: GameRecord, e: React.MouseEvent) => {
    e.stopPropagation();
    const element = document.createElement('a');
    const file = new Blob([game.pgn], { type: 'text/plain' });
    element.href = URL.createObjectURL(file);
    element.download = `chessmind_${game.id}.pgn`;
    document.body.appendChild(element);
    element.click();
    document.body.removeChild(element);
  };

  const handleClearHistory = () => {
    if (window.confirm('Are you sure you want to delete all saved match history?')) {
      storage.resetAllData();
      onRefresh();
    }
  };

  const formatDuration = (seconds?: number) => {
    if (!seconds) return '< 1m';
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    if (m === 0) return `${s}s`;
    return `${m}m ${s}s`;
  };

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6">
      {/* Header and Filter Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-white mb-1">Match History</h1>
          <p className="text-xs text-zinc-400">
            Review past matches, track your rating changes, and reopen comprehensive AI analysis.
          </p>
        </div>

        <div className="flex items-center gap-2">
          {/* Filter Segmented Control */}
          <div className="flex items-center gap-1 p-1 bg-zinc-900 border border-zinc-800 rounded-xl">
            {(
              [
                { id: 'all', label: 'All' },
                { id: 'win', label: 'Wins' },
                { id: 'loss', label: 'Losses' },
                { id: 'draw', label: 'Draws' },
              ] as const
            ).map((tab) => (
              <button
                key={tab.id}
                onClick={() => setFilter(tab.id)}
                className={`px-3 py-1 text-xs font-medium rounded-lg transition-colors cursor-pointer ${
                  filter === tab.id
                    ? 'bg-zinc-800 text-white font-semibold'
                    : 'text-zinc-400 hover:text-zinc-200'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {games.length > 0 && (
            <button
              onClick={handleClearHistory}
              className="p-2 rounded-xl bg-zinc-900 border border-zinc-800 hover:bg-rose-950/30 hover:border-rose-900/50 text-zinc-400 hover:text-rose-400 transition-colors cursor-pointer"
              title="Clear all match history"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* Game List */}
      {filteredGames.length === 0 ? (
        <div className="p-12 rounded-2xl bg-[#141519] border border-zinc-800 text-center flex flex-col items-center justify-center">
          <div className="w-12 h-12 rounded-xl bg-zinc-800 border border-zinc-700 flex items-center justify-center text-zinc-500 mb-3">
            <FolderOpen className="w-6 h-6" />
          </div>
          <h3 className="text-sm font-semibold text-zinc-200 mb-1">
            No matches found
          </h3>
          <p className="text-xs text-zinc-500 max-w-sm">
            {filter === 'all'
              ? 'Complete games in Play mode to build your match history and track your rating progression.'
              : `No games matching filter "${filter}".`}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredGames.map((game) => {
            const isWin = game.result === 'win';
            const isDraw = game.result === 'draw';

            return (
              <div
                key={game.id}
                onClick={() => onSelectGame(game)}
                className="p-4 rounded-xl bg-[#141519] border border-zinc-800 hover:border-zinc-700 hover:bg-[#18191f] transition-all cursor-pointer flex flex-col sm:flex-row sm:items-center justify-between gap-4"
              >
                {/* Left: Result pill, opponent info, opening */}
                <div className="flex items-center gap-4">
                  {/* Result Badge */}
                  <div
                    className={`w-12 h-12 rounded-xl flex flex-col items-center justify-center shrink-0 border ${
                      isWin
                        ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
                        : isDraw
                        ? 'bg-zinc-800 border-zinc-700 text-zinc-300'
                        : 'bg-rose-500/10 border-rose-500/30 text-rose-400'
                    }`}
                  >
                    <span className="text-xs font-bold uppercase tracking-wider">
                      {game.result}
                    </span>
                  </div>

                  {/* Opponent & Opening */}
                  <div>
                    <div className="flex items-center gap-2 mb-0.5">
                      <span className="text-sm font-semibold text-zinc-100">
                        vs Stockfish {game.opponentElo}
                      </span>
                      <span className="text-xs text-zinc-500 capitalize">
                        ({game.playerColor})
                      </span>
                    </div>
                    <div className="flex items-center gap-2 text-xs text-zinc-400">
                      <span className="text-emerald-400 font-mono font-medium">
                        {game.eco}
                      </span>
                      <span>·</span>
                      <span className="truncate max-w-[200px] sm:max-w-[320px]">
                        {game.openingName || 'Standard Opening'}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Right: Metadata, Rating Change, Actions */}
                <div className="flex items-center justify-between sm:justify-end gap-5 border-t sm:border-t-0 pt-3 sm:pt-0 border-zinc-800/80">
                  {/* Meta stats */}
                  <div className="flex items-center gap-4 text-xs text-zinc-400 font-mono">
                    <div className="flex items-center gap-1">
                      <Calendar className="w-3.5 h-3.5 text-zinc-500" />
                      <span>
                        {new Date(game.date).toLocaleDateString(undefined, {
                          month: 'short',
                          day: 'numeric',
                        })}
                      </span>
                    </div>

                    <div className="flex items-center gap-1">
                      <Clock className="w-3.5 h-3.5 text-zinc-500" />
                      <span>{formatDuration(game.durationSeconds)}</span>
                    </div>

                    <div className="hidden md:block">
                      <span>{game.movesCount} plies</span>
                    </div>
                  </div>

                  {/* Rating Change Tag */}
                  <div className="flex items-center gap-1.5 font-mono text-xs">
                    <span className="text-zinc-500">{game.playerEloAfter}</span>
                    <span
                      className={`font-bold px-1.5 py-0.5 rounded ${
                        game.ratingDelta >= 0
                          ? 'bg-emerald-500/20 text-emerald-400'
                          : 'bg-rose-500/20 text-rose-400'
                      }`}
                    >
                      {game.ratingDelta >= 0 ? `+${game.ratingDelta}` : game.ratingDelta}
                    </span>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-1">
                    <button
                      onClick={(e) => handleCopyPgn(game, e)}
                      className="p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors"
                      title="Copy PGN"
                    >
                      {copiedId === game.id ? (
                        <Check className="w-4 h-4 text-emerald-400" />
                      ) : (
                        <Copy className="w-4 h-4" />
                      )}
                    </button>
                    <button
                      onClick={(e) => handleDownloadPgn(game, e)}
                      className="p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors"
                      title="Download PGN"
                    >
                      <Download className="w-4 h-4" />
                    </button>
                    <ChevronRight className="w-4 h-4 text-zinc-500" />
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
