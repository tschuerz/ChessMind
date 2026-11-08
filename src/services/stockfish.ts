import { Chess, Square } from 'chess.js';
import { AnalyzedMove, DifficultyElo, MoveClassification } from '../types/chess';

// Piece values in centipawns
const PIECE_VALUES: Record<string, number> = {
  p: 100,
  n: 320,
  b: 330,
  r: 500,
  q: 900,
  k: 20000,
};

// Positional piece-square tables for tactical fallback engine
const PAWN_TABLE = [
  0,  0,  0,  0,  0,  0,  0,  0,
  50, 50, 50, 50, 50, 50, 50, 50,
  10, 10, 20, 30, 30, 20, 10, 10,
   5,  5, 10, 25, 25, 10,  5,  5,
   0,  0,  0, 20, 20,  0,  0,  0,
   5, -5,-10,  0,  0,-10, -5,  5,
   5, 10, 10,-20,-20, 10, 10,  5,
   0,  0,  0,  0,  0,  0,  0,  0
];

const KNIGHT_TABLE = [
  -50,-40,-30,-30,-30,-30,-40,-50,
  -40,-20,  0,  0,  0,  0,-20,-40,
  -30,  0, 10, 15, 15, 10,  0,-30,
  -30,  5, 15, 20, 20, 15,  5,-30,
  -30,  0, 15, 20, 20, 15,  0,-30,
  -30,  5, 10, 15, 15, 10,  5,-30,
  -40,-20,  0,  5,  5,  0,-20,-40,
  -50,-40,-30,-30,-30,-30,-40,-50,
];

const BISHOP_TABLE = [
  -20,-10,-10,-10,-10,-10,-10,-20,
  -10,  0,  0,  0,  0,  0,  0,-10,
  -10,  0,  5, 10, 10,  5,  0,-10,
  -10,  5,  5, 10, 10,  5,  5,-10,
  -10,  0, 10, 10, 10, 10,  0,-10,
  -10, 10, 10, 10, 10, 10, 10,-10,
  -10,  5,  0,  0,  0,  0,  5,-10,
  -20,-10,-10,-10,-10,-10,-10,-20,
];

const ROOK_TABLE = [
  0,  0,  0,  0,  0,  0,  0,  0,
  5, 10, 10, 10, 10, 10, 10,  5,
 -5,  0,  0,  0,  0,  0,  0, -5,
 -5,  0,  0,  0,  0,  0,  0, -5,
 -5,  0,  0,  0,  0,  0,  0, -5,
 -5,  0,  0,  0,  0,  0,  0, -5,
 -5,  0,  0,  0,  0,  0,  0, -5,
  0,  0,  0,  5,  5,  0,  0,  0
];

const QUEEN_TABLE = [
  -20,-10,-10, -5, -5,-10,-10,-20,
  -10,  0,  0,  0,  0,  0,  0,-10,
  -10,  0,  5,  5,  5,  5,  0,-10,
   -5,  0,  5,  5,  5,  5,  0, -5,
    0,  0,  5,  5,  5,  5,  0, -5,
  -10,  5,  5,  5,  5,  5,  0,-10,
  -10,  0,  5,  0,  0,  0,  0,-10,
  -20,-10,-10, -5, -5,-10,-10,-20
];

const KING_TABLE_MID = [
  -30,-40,-40,-50,-50,-40,-40,-30,
  -30,-40,-40,-50,-50,-40,-40,-30,
  -30,-40,-40,-50,-50,-40,-40,-30,
  -30,-40,-40,-50,-50,-40,-40,-30,
  -20,-30,-30,-40,-40,-30,-30,-20,
  -10,-20,-20,-20,-20,-20,-20,-10,
   20, 20,  0,  0,  0,  0, 20, 20,
   20, 30, 10,  0,  0, 10, 30, 20
];

export interface EngineEvalResult {
  scoreCp: number; // Centipawns from White's perspective
  isMate?: boolean;
  mateIn?: number;
  bestMoveUci: string;
  bestMoveSan?: string;
  pv?: string[];
  depth?: number;
}

export class StockfishEngine {
  private worker: Worker | null = null;
  private isReady: boolean = false;
  private workerFailed: boolean = false;
  private pendingCommands: Array<{
    cmd: string;
    resolve: (res: EngineEvalResult) => void;
    reject: (err: unknown) => void;
    timeoutId: NodeJS.Timeout;
  }> = [];

  constructor() {
    this.initWorker();
  }

  private initWorker() {
    if (typeof window === 'undefined') return;

    try {
      this.worker = new Worker('/stockfish.js');
      this.worker.onmessage = this.handleWorkerMessage.bind(this);
      this.worker.onerror = () => {
        console.warn('Stockfish WebWorker failed to initialize, using internal grandmaster engine.');
        this.workerFailed = true;
        this.worker = null;
      };

      this.sendCommand('uci');
      this.sendCommand('isready');
    } catch {
      this.workerFailed = true;
      this.worker = null;
    }
  }

  private sendCommand(cmd: string) {
    if (this.worker && !this.workerFailed) {
      try {
        this.worker.postMessage(cmd);
      } catch {
        this.workerFailed = true;
      }
    }
  }

  private currentEval: Partial<EngineEvalResult> = {};

  private handleWorkerMessage(e: MessageEvent) {
    const line: string = typeof e.data === 'string' ? e.data : '';
    // console.log('[Stockfish]', line);

    if (line === 'uciok' || line === 'readyok') {
      this.isReady = true;
    }

    if (line.startsWith('info') && line.includes('score')) {
      const depthMatch = line.match(/depth\s+(\d+)/);
      const cpMatch = line.match(/score\s+cp\s+(-?\d+)/);
      const mateMatch = line.match(/score\s+mate\s+(-?\d+)/);
      const pvMatch = line.match(/pv\s+(.+)/);

      if (depthMatch) this.currentEval.depth = parseInt(depthMatch[1], 10);
      if (cpMatch) {
        this.currentEval.scoreCp = parseInt(cpMatch[1], 10);
        this.currentEval.isMate = false;
      } else if (mateMatch) {
        const mate = parseInt(mateMatch[1], 10);
        this.currentEval.isMate = true;
        this.currentEval.mateIn = mate;
        this.currentEval.scoreCp = mate > 0 ? 10000 - mate * 100 : -10000 - mate * 100;
      }

      if (pvMatch) {
        this.currentEval.pv = pvMatch[1].trim().split(/\s+/);
      }
    }

    if (line.startsWith('bestmove')) {
      const parts = line.split(/\s+/);
      const bestMoveUci = parts[1] || '';
      const pending = this.pendingCommands.shift();
      if (pending) {
        clearTimeout(pending.timeoutId);
        pending.resolve({
          scoreCp: this.currentEval.scoreCp ?? 0,
          isMate: this.currentEval.isMate,
          mateIn: this.currentEval.mateIn,
          bestMoveUci,
          pv: this.currentEval.pv || (bestMoveUci ? [bestMoveUci] : []),
          depth: this.currentEval.depth ?? 10,
        });
      }
      this.currentEval = {};
    }
  }

  // Configure Elo on engine
  public configureDifficulty(elo: DifficultyElo) {
    if (this.worker && !this.workerFailed) {
      this.sendCommand('setoption name UCI_LimitStrength value true');
      this.sendCommand(`setoption name UCI_Elo value ${elo}`);
    }
  }

  // Get AI move
  public async getNextMove(
    fen: string,
    historyMovesUci: string[],
    elo: DifficultyElo,
    playerColor: 'white' | 'black'
  ): Promise<{ uci: string; san: string; evalCp: number }> {
    const chess = new Chess(fen);
    const legalMoves = chess.moves({ verbose: true });
    if (legalMoves.length === 0) {
      throw new Error('No legal moves');
    }

    // Lower ELO blundering probability to make lower Elo fun and realistic
    const blunderProbabilities: Record<DifficultyElo, number> = {
      400: 0.38,
      600: 0.28,
      800: 0.18,
      1000: 0.08,
      1200: 0.03,
      1400: 0.0,
      1600: 0.0,
      1800: 0.0,
      2000: 0.0,
      2200: 0.0,
      2400: 0.0,
    };

    if (Math.random() < blunderProbabilities[elo]) {
      // Pick a random legal move or capture for low elo flavor
      const randomMove = legalMoves[Math.floor(Math.random() * legalMoves.length)];
      return {
        uci: `${randomMove.from}${randomMove.to}${randomMove.promotion || ''}`,
        san: randomMove.san,
        evalCp: 0,
      };
    }

    // Attempt Stockfish worker
    if (this.worker && !this.workerFailed) {
      try {
        const evalResult = await this.evaluatePositionWithStockfish(fen, historyMovesUci, elo);
        if (evalResult.bestMoveUci && evalResult.bestMoveUci !== '(none)') {
          const from = evalResult.bestMoveUci.slice(0, 2) as Square;
          const to = evalResult.bestMoveUci.slice(2, 4) as Square;
          const promotion = evalResult.bestMoveUci[4] || undefined;
          const played = chess.move({ from, to, promotion });
          if (played) {
            return {
              uci: evalResult.bestMoveUci,
              san: played.san,
              evalCp: evalResult.scoreCp,
            };
          }
        }
      } catch (err) {
        console.warn('Stockfish evaluation timed out, falling back to tactical minimax engine:', err);
      }
    }

    // Fallback: Grandmaster Minimax engine
    return this.minimaxBestMove(chess, elo);
  }

  // Evaluate a single position with Stockfish
  private evaluatePositionWithStockfish(
    fen: string,
    historyMovesUci: string[],
    elo: DifficultyElo
  ): Promise<EngineEvalResult> {
    return new Promise((resolve, reject) => {
      if (!this.worker || this.workerFailed) {
        return reject(new Error('Worker not available'));
      }

      const depths: Record<DifficultyElo, number> = {
        400: 2,
        600: 3,
        800: 4,
        1000: 5,
        1200: 7,
        1400: 9,
        1600: 11,
        1800: 13,
        2000: 15,
        2200: 17,
        2400: 19,
      };

      const depth = depths[elo] || 10;
      this.sendCommand('ucinewgame');
      this.sendCommand(`setoption name UCI_LimitStrength value true`);
      this.sendCommand(`setoption name UCI_Elo value ${elo}`);

      if (historyMovesUci && historyMovesUci.length > 0) {
        this.sendCommand(`position startpos moves ${historyMovesUci.join(' ')}`);
      } else {
        this.sendCommand(`position fen ${fen}`);
      }

      this.currentEval = {};

      const timeoutId = setTimeout(() => {
        const idx = this.pendingCommands.findIndex((p) => p.timeoutId === timeoutId);
        if (idx !== -1) {
          const item = this.pendingCommands.splice(idx, 1)[0];
          item.reject(new Error('Stockfish timeout'));
        }
      }, 3500);

      this.pendingCommands.push({
        cmd: `go depth ${depth}`,
        resolve,
        reject,
        timeoutId,
      });

      this.sendCommand(`go depth ${depth}`);
    });
  }

  // Pure TypeScript minimax evaluator for high responsiveness & resilient fallback
  public evaluatePositionSync(chess: Chess): number {
    if (chess.isGameOver()) {
      if (chess.isCheckmate()) {
        return chess.turn() === 'w' ? -10000 : 10000;
      }
      return 0; // Draw
    }

    let score = 0;
    const board = chess.board();

    for (let r = 0; r < 8; r++) {
      for (let c = 0; c < 8; c++) {
        const piece = board[r][c];
        if (!piece) continue;

        const val = PIECE_VALUES[piece.type] || 0;
        let psqt = 0;
        const squareIdx = r * 8 + c;
        const flipIdx = (7 - r) * 8 + c; // From White's perspective

        switch (piece.type) {
          case 'p':
            psqt = piece.color === 'w' ? PAWN_TABLE[squareIdx] : PAWN_TABLE[flipIdx];
            break;
          case 'n':
            psqt = piece.color === 'w' ? KNIGHT_TABLE[squareIdx] : KNIGHT_TABLE[flipIdx];
            break;
          case 'b':
            psqt = piece.color === 'w' ? BISHOP_TABLE[squareIdx] : BISHOP_TABLE[flipIdx];
            break;
          case 'r':
            psqt = piece.color === 'w' ? ROOK_TABLE[squareIdx] : ROOK_TABLE[flipIdx];
            break;
          case 'q':
            psqt = piece.color === 'w' ? QUEEN_TABLE[squareIdx] : QUEEN_TABLE[flipIdx];
            break;
          case 'k':
            psqt = piece.color === 'w' ? KING_TABLE_MID[squareIdx] : KING_TABLE_MID[flipIdx];
            break;
        }

        const pieceScore = val + psqt;
        if (piece.color === 'w') {
          score += pieceScore;
        } else {
          score -= pieceScore;
        }
      }
    }

    return score;
  }

  // Fast tactical search for analysis: evaluates all candidate legal moves with piece-square tables and material
  public findBestMoveFast(chess: Chess): { uci: string; san: string; evalCp: number } {
    const isWhite = chess.turn() === 'w';
    const moves = chess.moves({ verbose: true });
    if (moves.length === 0) {
      return { uci: '', san: '', evalCp: this.evaluatePositionSync(chess) };
    }

    let bestMove = moves[0];
    let bestVal = isWhite ? -Infinity : Infinity;

    for (const move of moves) {
      chess.move(move);
      let val = this.evaluatePositionSync(chess);
      // Small bonus for clean capture
      if (move.captured) {
        val += isWhite ? 30 : -30;
      }
      chess.undo();

      if (isWhite) {
        if (val > bestVal) {
          bestVal = val;
          bestMove = move;
        }
      } else {
        if (val < bestVal) {
          bestVal = val;
          bestMove = move;
        }
      }
    }

    const uci = `${bestMove.from}${bestMove.to}${bestMove.promotion || ''}`;
    return {
      uci,
      san: bestMove.san,
      evalCp: Math.max(-9999, Math.min(9999, bestVal)),
    };
  }

  // Minimax tactical search with alpha-beta pruning
  private minimaxBestMove(chess: Chess, elo: DifficultyElo): { uci: string; san: string; evalCp: number } {
    const isWhite = chess.turn() === 'w';
    const moves = chess.moves({ verbose: true });

    // Order moves: captures first, then checks, then quiet
    moves.sort((a, b) => {
      const aVal = (a.captured ? PIECE_VALUES[a.captured] * 10 : 0) + (a.san.includes('+') ? 50 : 0);
      const bVal = (b.captured ? PIECE_VALUES[b.captured] * 10 : 0) + (b.san.includes('+') ? 50 : 0);
      return bVal - aVal;
    });

    const searchDepth = elo <= 800 ? 1 : elo <= 1400 ? 2 : 3;

    let bestMove = moves[0];
    let bestVal = isWhite ? -Infinity : Infinity;

    for (const move of moves) {
      chess.move(move);
      const val = this.minimax(chess, searchDepth - 1, -Infinity, Infinity, !isWhite);
      chess.undo();

      if (isWhite) {
        if (val > bestVal) {
          bestVal = val;
          bestMove = move;
        }
      } else {
        if (val < bestVal) {
          bestVal = val;
          bestMove = move;
        }
      }
    }

    const uci = `${bestMove.from}${bestMove.to}${bestMove.promotion || ''}`;
    return {
      uci,
      san: bestMove.san,
      evalCp: Math.max(-9999, Math.min(9999, bestVal)),
    };
  }

  private minimax(chess: Chess, depth: number, alpha: number, beta: number, isMaximizing: boolean): number {
    if (depth <= 0 || chess.isGameOver()) {
      return this.evaluatePositionSync(chess);
    }

    const moves = chess.moves({ verbose: true });
    if (moves.length === 0) {
      return this.evaluatePositionSync(chess);
    }

    // Move ordering
    moves.sort((a, b) => (b.captured ? 100 : 0) - (a.captured ? 100 : 0));

    if (isMaximizing) {
      let maxEval = -Infinity;
      for (const m of moves) {
        chess.move(m);
        const evalScore = this.minimax(chess, depth - 1, alpha, beta, false);
        chess.undo();
        maxEval = Math.max(maxEval, evalScore);
        alpha = Math.max(alpha, evalScore);
        if (beta <= alpha) break;
      }
      return maxEval;
    } else {
      let minEval = Infinity;
      for (const m of moves) {
        chess.move(m);
        const evalScore = this.minimax(chess, depth - 1, alpha, beta, true);
        chess.undo();
        minEval = Math.min(minEval, evalScore);
        beta = Math.min(beta, evalScore);
        if (beta <= alpha) break;
      }
      return minEval;
    }
  }

  // Full Post-Game Analysis of an entire game
  public async analyzeFullGame(
    pgn: string,
    onProgress?: (progressPercent: number) => void
  ): Promise<{
    analyzedMoves: AnalyzedMove[];
    whiteAccuracy: number;
    blackAccuracy: number;
  }> {
    const replayChess = new Chess();
    try {
      replayChess.loadPgn(pgn);
    } catch {
      // If PGN has issues, return empty
      return { analyzedMoves: [], whiteAccuracy: 80, blackAccuracy: 80 };
    }

    const historyVerbose = replayChess.history({ verbose: true });
    const analyzedMoves: AnalyzedMove[] = [];

    let prevEval = 20; // Start with slight initial White tempo +0.2

    let whiteCplTotal = 0;
    let whiteMovesCount = 0;
    let blackCplTotal = 0;
    let blackMovesCount = 0;

    for (let i = 0; i < historyVerbose.length; i++) {
      const move = historyVerbose[i];
      const fenBefore = move.before;
      const fenAfter = move.after;
      const isWhite = move.color === 'w';

      // Find best move in position before (fast 1-ply tactical search)
      let bestMoveUci = `${move.from}${move.to}${move.promotion || ''}`;
      let bestMoveSan = move.san;
      let currentPositionEval = prevEval;

      try {
        const chessBefore = new Chess(fenBefore);
        const best = this.findBestMoveFast(chessBefore);
        bestMoveUci = best.uci;
        bestMoveSan = best.san;
        currentPositionEval = best.evalCp;
      } catch {
        bestMoveUci = `${move.from}${move.to}${move.promotion || ''}`;
        bestMoveSan = move.san;
      }

      // Fast evaluation after played move
      let evalAfter = currentPositionEval;
      try {
        const chessAfter = new Chess(fenAfter);
        evalAfter = this.evaluatePositionSync(chessAfter);
      } catch {
        evalAfter = currentPositionEval;
      }

      // Centipawn loss calculation for the side that moved
      let centipawnLoss = 0;
      if (isWhite) {
        centipawnLoss = Math.max(0, currentPositionEval - evalAfter);
        whiteCplTotal += centipawnLoss;
        whiteMovesCount++;
      } else {
        centipawnLoss = Math.max(0, evalAfter - currentPositionEval);
        blackCplTotal += centipawnLoss;
        blackMovesCount++;
      }

      // Win chance formula
      const winChance = 100 / (1 + Math.exp(-0.003682 * evalAfter));

      // Move classification
      const playedUci = `${move.from}${move.to}${move.promotion || ''}`;
      const classification = this.classifyMove(
        move,
        playedUci,
        bestMoveUci,
        centipawnLoss,
        currentPositionEval,
        evalAfter,
        isWhite
      );

      // Display evaluation string
      let displayEval = '';
      if (Math.abs(evalAfter) >= 9000) {
        const mateInMoves = Math.ceil((10000 - Math.abs(evalAfter)) / 100);
        displayEval = evalAfter > 0 ? `M${mateInMoves}` : `-M${mateInMoves}`;
      } else {
        const pawns = (evalAfter / 100).toFixed(1);
        displayEval = evalAfter >= 0 ? `+${pawns}` : pawns;
      }

      analyzedMoves.push({
        ply: i + 1,
        moveNumber: Math.floor(i / 2) + 1,
        color: move.color,
        san: move.san,
        from: move.from,
        to: move.to,
        promotion: move.promotion,
        fenBefore,
        fenAfter,
        eval: evalAfter,
        displayEval,
        bestMoveUci,
        bestMoveSan: bestMoveSan || move.san,
        playedMoveUci: playedUci,
        centipawnLoss,
        winChance: Math.round(winChance),
        classification,
      });

      prevEval = evalAfter;
      if (onProgress) {
        onProgress(Math.round(((i + 1) / historyVerbose.length) * 100));
      }
      // Yield to event loop so browser stays responsive and progress animates
      await new Promise((resolve) => setTimeout(resolve, 8));
    }

    // Accuracy calculation: Chess.com / Lichess standard exponential formula
    // Accuracy % = 103.1668 * exp(-0.04354 * avgCPL) - 3.1668 clamped to 0-100
    const calcAccuracy = (totalCpl: number, count: number) => {
      if (count === 0) return 90;
      const avgCpl = totalCpl / count / 10; // convert to decipawns
      const raw = 103.1668 * Math.exp(-0.04354 * avgCpl) - 3.1668;
      return Math.round(Math.max(10, Math.min(99.4, raw)) * 10) / 10;
    };

    const whiteAccuracy = calcAccuracy(whiteCplTotal, whiteMovesCount);
    const blackAccuracy = calcAccuracy(blackCplTotal, blackMovesCount);

    return {
      analyzedMoves,
      whiteAccuracy,
      blackAccuracy,
    };
  }

  // Move Classification logic
  private classifyMove(
    move: { captured?: string; san: string; piece: string },
    playedUci: string,
    bestUci: string,
    centipawnLoss: number,
    evalBefore: number,
    evalAfter: number,
    isWhite: boolean
  ): MoveClassification {
    const isBest = playedUci === bestUci;

    // Brilliant move criteria: Material sacrifice that leads to winning position
    const isPieceSacrifice =
      ['n', 'b', 'r', 'q'].includes(move.piece) &&
      move.captured !== 'q' &&
      ((isWhite && evalAfter > 200) || (!isWhite && evalAfter < -200));

    if (isPieceSacrifice && isBest && centipawnLoss === 0) {
      return 'brilliant';
    }

    // Great move: Only winning move in a critical position
    if (isBest && Math.abs(evalBefore) > 150 && centipawnLoss === 0) {
      return 'great';
    }

    if (isBest) {
      return 'best';
    }

    if (centipawnLoss < 15) {
      return 'excellent';
    }

    if (centipawnLoss < 45) {
      return 'good';
    }

    if (centipawnLoss < 110) {
      return 'inaccuracy';
    }

    if (centipawnLoss < 260) {
      return 'mistake';
    }

    return 'blunder';
  }
}

export const stockfish = new StockfishEngine();
