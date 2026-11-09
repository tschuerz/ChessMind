export type PlayerColor = 'white' | 'black';
export type GameResult = 'win' | 'loss' | 'draw' | 'in_progress';
export type TerminationReason =
  | 'checkmate'
  | 'resignation'
  | 'stalemate'
  | 'threefold'
  | 'insufficient_material'
  | 'fifty_move'
  | 'timeout'
  | 'abandoned';

export type DifficultyElo = 400 | 600 | 800 | 1000 | 1200 | 1400 | 1600 | 1800 | 2000 | 2200 | 2400;

export type MoveClassification =
  | 'brilliant'
  | 'great'
  | 'best'
  | 'excellent'
  | 'good'
  | 'inaccuracy'
  | 'mistake'
  | 'blunder'
  | 'book';

export interface AnalyzedMove {
  ply: number;
  moveNumber: number;
  color: 'w' | 'b';
  san: string;
  from: string;
  to: string;
  promotion?: string;
  fenBefore: string;
  fenAfter: string;
  eval: number; // Centipawns from White's perspective (+150 = +1.5 for White, -200 = -2.0)
  displayEval: string; // e.g. "+1.5", "-0.8", "M3", "-M2", "0.0"
  bestMoveUci: string; // e.g. "e2e4"
  bestMoveSan: string; // e.g. "e4"
  playedMoveUci: string;
  centipawnLoss: number; // Drop for the side that moved (>= 0)
  winChance: number; // 0 to 100%
  classification: MoveClassification;
  explanation?: string;
  pv?: string[];
}

export interface CoachReport {
  source?: string;
  model?: string;
  gameOverview: string;
  biggestLesson: string;
  openingReview: string;
  keyMoments: Array<{
    moveNumber: number;
    playedMove: string;
    bestMove: string;
    classification: string;
    explanation: string;
    tacticalConcept?: string;
  }>;
  recurringPatterns: string[];
  practicalRecommendations: string[];
}

export interface GameRecord {
  id: string;
  date: string;
  playerColor: PlayerColor;
  opponentElo: DifficultyElo;
  playerEloBefore: number;
  playerEloAfter: number;
  ratingDelta: number;
  result: GameResult;
  termination: TerminationReason;
  pgn: string;
  finalFen: string;
  movesCount: number;
  durationSeconds: number;
  whiteAccuracy: number;
  blackAccuracy: number;
  openingName: string;
  eco: string;
  analyzedMoves: AnalyzedMove[];
  coachReport?: CoachReport;
}

export interface UserRatingHistory {
  date: string;
  rating: number;
  gameId: string;
}

export interface ClassificationSummary {
  brilliant: number;
  great: number;
  best: number;
  excellent: number;
  good: number;
  book: number;
  inaccuracy: number;
  mistake: number;
  blunder: number;
}

export interface FullGameAnalysis {
  analyzedMoves: AnalyzedMove[];
  whiteAccuracy: number;
  blackAccuracy: number;
  classificationBreakdown: {
    white: ClassificationSummary;
    black: ClassificationSummary;
  };
}

export type CoachPersonaId =
  | 'friendly'
  | 'strict'
  | 'analytical'
  | 'beginner'
  | 'nolan'
  | 'sasha'
  | 'viktor'
  | 'lily'
  | 'magnus';

export type GameMode = 'ai' | 'coach' | 'analysis';

export interface UserSettings {
  aiProvider: 'gemini' | 'openai_compatible';
  customApiKey: string;
  customEndpoint: string;
  customModel: string;
  soundEnabled: boolean;
  showCoordinates: boolean;
  highlightLegalMoves: boolean;
  boardTheme: 'emerald' | 'charcoal' | 'wood' | 'ocean';
  pieceSet: 'cburnett' | 'classic';
  coachPersona: CoachPersonaId;
  coachVoiceEnabled: boolean;
  playCoachEnabled: boolean;
}

export interface ActiveGameSetup {
  playerColor: PlayerColor | 'random';
  aiElo: DifficultyElo;
  gameMode?: 'ai' | 'coach';
}
