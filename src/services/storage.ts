import { GameRecord, UserRatingHistory, UserSettings } from '../types/chess';

const STORAGE_KEYS = {
  GAMES: 'chessmind_games_v1',
  RATING: 'chessmind_rating_v1',
  RATING_HISTORY: 'chessmind_rating_history_v1',
  SETTINGS: 'chessmind_settings_v1',
};

const DEFAULT_SETTINGS: UserSettings = {
  aiProvider: 'gemini',
  customApiKey: '',
  customEndpoint: 'https://api.openai.com/v1',
  customModel: 'gemini-3.8-flash',
  soundEnabled: true,
  showCoordinates: true,
  highlightLegalMoves: true,
  boardTheme: 'emerald',
  pieceSet: 'cburnett',
  coachPersona: 'nolan',
  coachVoiceEnabled: true,
  playCoachEnabled: true,
};

export class StorageService {
  // Get all recorded games
  public getGames(): GameRecord[] {
    if (typeof window === 'undefined') return [];
    try {
      const data = localStorage.getItem(STORAGE_KEYS.GAMES);
      return data ? JSON.parse(data) : [];
    } catch {
      return [];
    }
  }

  // Save new completed game
  public saveGame(game: GameRecord) {
    if (typeof window === 'undefined') return;
    try {
      const games = this.getGames();
      // Prepend to show most recent first
      const updated = [game, ...games.filter((g) => g.id !== game.id)];
      localStorage.setItem(STORAGE_KEYS.GAMES, JSON.stringify(updated));
    } catch (e) {
      console.error('Failed to save game to localStorage', e);
    }
  }

  // Get single game by ID
  public getGameById(id: string): GameRecord | undefined {
    return this.getGames().find((g) => g.id === id);
  }

  // Update existing game (e.g. when AI coach report finishes)
  public updateGame(game: GameRecord) {
    if (typeof window === 'undefined') return;
    try {
      const games = this.getGames();
      const idx = games.findIndex((g) => g.id === game.id);
      if (idx !== -1) {
        games[idx] = game;
        localStorage.setItem(STORAGE_KEYS.GAMES, JSON.stringify(games));
      }
    } catch (e) {
      console.error('Failed to update game', e);
    }
  }

  // User Estimated Elo
  public getPlayerRating(): number {
    if (typeof window === 'undefined') return 1000;
    try {
      const rating = localStorage.getItem(STORAGE_KEYS.RATING);
      return rating ? parseInt(rating, 10) : 1000;
    } catch {
      return 1000;
    }
  }

  public setPlayerRating(rating: number) {
    if (typeof window === 'undefined') return;
    try {
      localStorage.setItem(STORAGE_KEYS.RATING, Math.round(rating).toString());
    } catch (e) {
      console.error('Failed to save rating', e);
    }
  }

  // Rating History for graphs
  public getRatingHistory(): UserRatingHistory[] {
    if (typeof window === 'undefined') return [{ date: new Date().toISOString(), rating: 1000, gameId: 'init' }];
    try {
      const data = localStorage.getItem(STORAGE_KEYS.RATING_HISTORY);
      if (data) {
        return JSON.parse(data);
      }
      const initial: UserRatingHistory[] = [
        { date: new Date(Date.now() - 86400000 * 3).toISOString(), rating: 1000, gameId: 'init' },
      ];
      localStorage.setItem(STORAGE_KEYS.RATING_HISTORY, JSON.stringify(initial));
      return initial;
    } catch {
      return [{ date: new Date().toISOString(), rating: 1000, gameId: 'init' }];
    }
  }

  // Calculate Elo change using standard formula with provisional K-factor
  public calculateEloDelta(
    playerRating: number,
    opponentRating: number,
    result: 'win' | 'loss' | 'draw'
  ): { delta: number; newRating: number } {
    const gamesCount = this.getGames().length;
    // Provisional volatility: K=40 for first 10 games, K=32 up to 30 games, K=24 for established
    const kFactor = gamesCount < 10 ? 40 : gamesCount < 30 ? 32 : 24;

    const expectedScore = 1 / (1 + Math.pow(10, (opponentRating - playerRating) / 400));
    const actualScore = result === 'win' ? 1 : result === 'draw' ? 0.5 : 0;

    let delta = Math.round(kFactor * (actualScore - expectedScore));

    // Minimum 1 point change for a win or loss against non-extreme opponents
    if (result === 'win' && delta <= 0) delta = 1;
    if (result === 'loss' && delta >= 0) delta = -1;

    const newRating = Math.max(100, playerRating + delta);
    return { delta, newRating };
  }

  // Record rating point
  public recordRatingPoint(newRating: number, gameId: string) {
    if (typeof window === 'undefined') return;
    try {
      this.setPlayerRating(newRating);
      const history = this.getRatingHistory();
      history.push({
        date: new Date().toISOString(),
        rating: newRating,
        gameId,
      });
      localStorage.setItem(STORAGE_KEYS.RATING_HISTORY, JSON.stringify(history));
    } catch (e) {
      console.error('Failed to record rating point', e);
    }
  }

  // User Settings
  public getSettings(): UserSettings {
    if (typeof window === 'undefined') return DEFAULT_SETTINGS;
    try {
      const data = localStorage.getItem(STORAGE_KEYS.SETTINGS);
      return data ? { ...DEFAULT_SETTINGS, ...JSON.parse(data) } : DEFAULT_SETTINGS;
    } catch {
      return DEFAULT_SETTINGS;
    }
  }

  public saveSettings(settings: UserSettings) {
    if (typeof window === 'undefined') return;
    try {
      localStorage.setItem(STORAGE_KEYS.SETTINGS, JSON.stringify(settings));
    } catch (e) {
      console.error('Failed to save settings', e);
    }
  }

  // Aggregate user statistics
  public getAggregateStats() {
    const games = this.getGames();
    const currentElo = this.getPlayerRating();
    const history = this.getRatingHistory();

    const highestElo = history.reduce((max, h) => Math.max(max, h.rating), currentElo);
    const lowestElo = history.reduce((min, h) => Math.min(min, h.rating), currentElo);

    const totalGames = games.length;
    const wins = games.filter((g) => g.result === 'win').length;
    const losses = games.filter((g) => g.result === 'loss').length;
    const draws = games.filter((g) => g.result === 'draw').length;
    const winRate = totalGames > 0 ? Math.round((wins / totalGames) * 100) : 0;

    // White vs Black
    const whiteGames = games.filter((g) => g.playerColor === 'white');
    const blackGames = games.filter((g) => g.playerColor === 'black');
    const whiteWins = whiteGames.filter((g) => g.result === 'win').length;
    const blackWins = blackGames.filter((g) => g.result === 'win').length;

    const whiteWinRate = whiteGames.length > 0 ? Math.round((whiteWins / whiteGames.length) * 100) : 0;
    const blackWinRate = blackGames.length > 0 ? Math.round((blackWins / blackGames.length) * 100) : 0;

    // Accuracy average
    let totalAccuracy = 0;
    let accuracyGamesCount = 0;
    let totalBlunders = 0;
    let totalMistakes = 0;
    let totalInaccuracies = 0;

    // Openings tracking
    const openingCounts: Record<string, { count: number; wins: number; name: string }> = {};

    // Difficulty breakdown
    const difficultyStats: Record<string, { games: number; wins: number }> = {
      'Beginner (400-800)': { games: 0, wins: 0 },
      'Intermediate (1000-1400)': { games: 0, wins: 0 },
      'Advanced (1600-2000)': { games: 0, wins: 0 },
      'Master (2200-2400)': { games: 0, wins: 0 },
    };

    games.forEach((g) => {
      const playerAcc = g.playerColor === 'white' ? g.whiteAccuracy : g.blackAccuracy;
      if (playerAcc > 0) {
        totalAccuracy += playerAcc;
        accuracyGamesCount++;
      }

      // Count classifications
      if (g.analyzedMoves) {
        g.analyzedMoves.forEach((m) => {
          const isPlayerMove = (g.playerColor === 'white' && m.color === 'w') || (g.playerColor === 'black' && m.color === 'b');
          if (isPlayerMove) {
            if (m.classification === 'blunder') totalBlunders++;
            if (m.classification === 'mistake') totalMistakes++;
            if (m.classification === 'inaccuracy') totalInaccuracies++;
          }
        });
      }

      // Opening performance
      const opName = g.openingName || 'Standard Opening';
      if (!openingCounts[opName]) {
        openingCounts[opName] = { count: 0, wins: 0, name: opName };
      }
      openingCounts[opName].count++;
      if (g.result === 'win') openingCounts[opName].wins++;

      // Difficulty bracket
      let bracket = 'Intermediate (1000-1400)';
      if (g.opponentElo <= 800) bracket = 'Beginner (400-800)';
      else if (g.opponentElo <= 1400) bracket = 'Intermediate (1000-1400)';
      else if (g.opponentElo <= 2000) bracket = 'Advanced (1600-2000)';
      else bracket = 'Master (2200-2400)';

      difficultyStats[bracket].games++;
      if (g.result === 'win') difficultyStats[bracket].wins++;
    });

    const averageAccuracy = accuracyGamesCount > 0 ? Math.round((totalAccuracy / accuracyGamesCount) * 10) / 10 : 0;

    const topOpenings = Object.values(openingCounts)
      .sort((a, b) => b.count - a.count)
      .slice(0, 5)
      .map((op) => ({
        name: op.name,
        count: op.count,
        winRate: Math.round((op.wins / op.count) * 100),
      }));

    return {
      totalGames,
      wins,
      losses,
      draws,
      winRate,
      currentElo,
      highestElo,
      lowestElo,
      averageAccuracy,
      whiteGames: whiteGames.length,
      whiteWinRate,
      blackGames: blackGames.length,
      blackWinRate,
      totalBlunders,
      totalMistakes,
      totalInaccuracies,
      topOpenings,
      difficultyStats,
    };
  }

  // Clear data for testing / reset
  public resetAllData() {
    if (typeof window === 'undefined') return;
    localStorage.removeItem(STORAGE_KEYS.GAMES);
    localStorage.removeItem(STORAGE_KEYS.RATING);
    localStorage.removeItem(STORAGE_KEYS.RATING_HISTORY);
  }
}

export const storage = new StorageService();
