import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { Chess, Square } from 'chess.js';
import { Chessboard } from '../Chessboard/Chessboard';
import { Piece } from '../Chessboard/Piece';
import { EvalBar } from '../Chessboard/EvalBar';
import {
  CoachPersonaId,
  DifficultyElo,
  GameRecord,
  MoveClassification,
  PlayerColor,
  TerminationReason,
  UserSettings,
} from '../../types/chess';
import { stockfish } from '../../services/stockfish';
import { storage } from '../../services/storage';
import { identifyOpening } from '../../services/openings';
import { sounds } from '../../services/sound';
import {
  COACH_PERSONAS,
  coachVoice,
  generateCoachComment,
  explainCurrentPosition,
  explainLastMoveDetail,
  answerCoachQuestionOffline,
} from '../../services/coachPersona';
import {
  RotateCcw,
  RotateCw,
  Flag,
  Copy,
  Download,
  Bot,
  User,
  Check,
  Sparkles,
  ChevronRight,
  Sliders,
  Volume2,
  VolumeX,
  Lightbulb,
  MessageSquare,
  Send,
  Compass,
  HelpCircle,
} from 'lucide-react';

interface PlayViewProps {
  settings: UserSettings;
  playerElo: number;
  onGameCompleted: (game: GameRecord) => void;
  onRequestAnalysis: (game: GameRecord) => void;
  onUpdateSettings?: (settings: UserSettings) => void;
  initialSetup?: { playerColor: PlayerColor | 'random'; aiElo: DifficultyElo; gameMode?: 'ai' | 'coach' } | null;
  gameMode?: 'ai' | 'coach';
}

const getInitialCoachGreeting = (personaId: CoachPersonaId) => {
  switch (personaId) {
    case 'sasha':
      return "Let's play fierce chess today! Grab the initiative from move one and never let them rest!";
    case 'viktor':
      return 'Concentrate. No gifts for the computer. Calculate twice before you make any move.';
    case 'lily':
      return 'Hi there! So excited to play! Have fun, develop your pieces, and feel free to ask for hints!';
    case 'magnus':
      return 'Clean positional chess wins matches. Control key squares, improve piece harmony, and convert.';
    default:
      return 'Welcome to the board! Keep your pieces harmonious, control the center, and watch your king safety.';
  }
};

export const PlayView: React.FC<PlayViewProps> = ({
  settings,
  playerElo,
  onGameCompleted,
  onRequestAnalysis,
  onUpdateSettings,
  initialSetup,
}) => {
  // Chess game instance
  const [chess, setChess] = useState<Chess>(() => new Chess());
  const [playerColor, setPlayerColor] = useState<PlayerColor>('white');
  const [opponentElo, setOpponentElo] = useState<DifficultyElo>(1200);

  // Board state
  const [orientation, setOrientation] = useState<PlayerColor>('white');
  const [historyMoves, setHistoryMoves] = useState<Array<{ san: string; from: string; to: string }>>([]);
  const [lastMove, setLastMove] = useState<{ from: string; to: string } | null>(null);
  const [evalScoreCp, setEvalScoreCp] = useState<number>(20);
  const [isAiThinking, setIsAiThinking] = useState<boolean>(false);

  // Play Coach state
  const activePersona = useMemo(
    () => COACH_PERSONAS.find((p) => p.id === settings.coachPersona) || COACH_PERSONAS[0],
    [settings.coachPersona]
  );
  const [coachSpeech, setCoachSpeech] = useState<string>(() =>
    getInitialCoachGreeting(settings.coachPersona || 'nolan')
  );
  const [coachMoodTag, setCoachMoodTag] = useState<string>('Ready to Play');

  // Live Hints (Tiered Hint System: 0 = none, 1 = Strategic Idea, 2 = Highlight Piece, 3 = Show Move Arrow)
  const [hintLevel, setHintLevel] = useState<number>(0);
  const [activeHint, setActiveHint] = useState<{
    idea: string;
    from: Square;
    to: Square;
    san: string;
    pieceType: string;
  } | null>(null);
  const [hintHighlightSquares, setHintHighlightSquares] = useState<Record<string, string>>({});
  const [hintArrow, setHintArrow] = useState<{ from: string; to: string } | null>(null);

  // Live Coach Companion & Q&A states
  const [lastMoveDetail, setLastMoveDetail] = useState<{
    san: string;
    color: 'w' | 'b';
    from: string;
    to: string;
    bestSan?: string;
    classification?: MoveClassification;
  } | null>(null);
  const [coachQuestion, setCoachQuestion] = useState<string>('');
  const [isCoachThinking, setIsCoachThinking] = useState<boolean>(false);

  // Modals & UI states
  const [isSetupOpen, setIsSetupOpen] = useState<boolean>(false);
  const [gameOverData, setGameOverData] = useState<{
    result: 'win' | 'loss' | 'draw';
    termination: TerminationReason;
    ratingDelta: number;
    newRating: number;
    gameRecord?: GameRecord;
  } | null>(null);

  const [copiedPgn, setCopiedPgn] = useState<boolean>(false);
  const [startTime, setStartTime] = useState<number>(Date.now());
  const moveListEndRef = useRef<HTMLDivElement>(null);

  // Initialize game from initialSetup
  useEffect(() => {
    if (initialSetup) {
      startNewGame(initialSetup.playerColor, initialSetup.aiElo);
    }
  }, [initialSetup]);

  // Keep scroll focused on move list
  useEffect(() => {
    moveListEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [historyMoves]);

  // Start new game
  const startNewGame = useCallback((chosenColor: PlayerColor | 'random', elo: DifficultyElo) => {
    const finalColor: PlayerColor =
      chosenColor === 'random' ? (Math.random() > 0.5 ? 'white' : 'black') : chosenColor;

    const newGame = new Chess();
    setChess(newGame);
    setPlayerColor(finalColor);
    setOrientation(finalColor);
    setOpponentElo(elo);
    setHistoryMoves([]);
    setLastMove(null);
    setLastMoveDetail(null);
    setCoachQuestion('');
    setEvalScoreCp(20);
    setIsAiThinking(false);
    setGameOverData(null);
    setStartTime(Date.now());
    setIsSetupOpen(false);

    // Reset hints and Coach
    setHintLevel(0);
    setActiveHint(null);
    setHintHighlightSquares({});
    setHintArrow(null);
    const greeting = getInitialCoachGreeting(settings.coachPersona || 'friendly');
    setCoachSpeech(greeting);
    setCoachMoodTag('Game Start');
    if (settings.coachVoiceEnabled && settings.playCoachEnabled) {
      coachVoice.speak(greeting, settings.coachPersona);
    }

    stockfish.configureDifficulty(elo);

    // If player is Black, AI moves first
    if (finalColor === 'black') {
      triggerAiMove(newGame, elo, 'black');
    }
  }, [settings.coachPersona, settings.coachVoiceEnabled, settings.playCoachEnabled]);

  // Check game ending condition
  const checkGameEnd = useCallback(
    (game: Chess): { isOver: boolean; result?: 'win' | 'loss' | 'draw'; reason?: TerminationReason } => {
      if (game.isCheckmate()) {
        const winner = game.turn() === 'w' ? 'black' : 'white';
        const result = winner === playerColor ? 'win' : 'loss';
        return { isOver: true, result, reason: 'checkmate' };
      }
      if (game.isStalemate()) {
        return { isOver: true, result: 'draw', reason: 'stalemate' };
      }
      if (game.isThreefoldRepetition()) {
        return { isOver: true, result: 'draw', reason: 'threefold' };
      }
      if (game.isInsufficientMaterial()) {
        return { isOver: true, result: 'draw', reason: 'insufficient_material' };
      }
      if (game.isDraw()) {
        return { isOver: true, result: 'draw', reason: 'fifty_move' };
      }
      return { isOver: false };
    },
    [playerColor]
  );

  // Finalize completed game
  const handleGameEnd = useCallback(
    async (result: 'win' | 'loss' | 'draw', termination: TerminationReason, finalChess: Chess) => {
      sounds.playGameOver();

      const durationSeconds = Math.round((Date.now() - startTime) / 1000);
      const { delta, newRating } = storage.calculateEloDelta(playerElo, opponentElo, result);
      const gameId = `game_${Date.now()}`;

      // Record new rating in storage
      storage.recordRatingPoint(newRating, gameId);

      const sans = finalChess.history();
      const opening = identifyOpening(sans);

      const record: GameRecord = {
        id: gameId,
        date: new Date().toISOString(),
        playerColor,
        opponentElo,
        playerEloBefore: playerElo,
        playerEloAfter: newRating,
        ratingDelta: delta,
        result,
        termination,
        pgn: finalChess.pgn(),
        finalFen: finalChess.fen(),
        movesCount: sans.length,
        durationSeconds,
        whiteAccuracy: 0,
        blackAccuracy: 0,
        openingName: opening.name,
        eco: opening.eco,
        analyzedMoves: [],
      };

      storage.saveGame(record);
      onGameCompleted(record);

      setGameOverData({
        result,
        termination,
        ratingDelta: delta,
        newRating,
        gameRecord: record,
      });
    },
    [startTime, playerElo, opponentElo, playerColor, onGameCompleted]
  );

  // Trigger AI move via Stockfish
  const triggerAiMove = async (gameInstance: Chess, elo: DifficultyElo, playerCol: PlayerColor) => {
    setIsAiThinking(true);

    try {
      // Natural human-like response delay (300ms to 700ms)
      await new Promise((r) => setTimeout(r, 400 + Math.random() * 300));

      const uciHistory = gameInstance.history({ verbose: true }).map((m) => `${m.from}${m.to}${m.promotion || ''}`);
      const aiResult = await stockfish.getNextMove(
        gameInstance.fen(),
        uciHistory,
        elo,
        playerCol
      );

      const from = aiResult.uci.slice(0, 2) as Square;
      const to = aiResult.uci.slice(2, 4) as Square;
      const promotion = aiResult.uci[4] || undefined;

      const newGame = new Chess();
      try {
        newGame.loadPgn(gameInstance.pgn());
      } catch {
        newGame.load(gameInstance.fen());
      }
      const move = newGame.move({ from, to, promotion });

      if (move) {
        if (move.captured) sounds.playCapture();
        else if (move.flags.includes('k') || move.flags.includes('q')) sounds.playCastle();
        else sounds.playMove();

        if (newGame.inCheck()) sounds.playCheck();

        setChess(newGame);
        setLastMove({ from: move.from, to: move.to });
        setLastMoveDetail({
          san: move.san,
          color: move.color,
          from: move.from,
          to: move.to,
          bestSan: move.san,
          classification: 'best',
        });
        setHistoryMoves((prev) => [...prev, { san: move.san, from: move.from, to: move.to }]);

        // Update live evaluation
        const updatedEval = stockfish.evaluatePositionSync(newGame);
        setEvalScoreCp(updatedEval);

        // Coach commentary on opponent move
        if (newGame.inCheck()) {
          const checkMsg = 'Check! Your king is under attack. Look for ways to block, capture, or move your king safely.';
          setCoachMoodTag('Check!');
          setCoachSpeech(checkMsg);
          if (settings.coachVoiceEnabled && settings.playCoachEnabled) {
            coachVoice.speak(checkMsg, settings.coachPersona);
          }
        } else {
          const aiComment = `Stockfish played ${move.san}. Examine what squares opened up and find your response.`;
          setCoachMoodTag('Opponent Move');
          setCoachSpeech(aiComment);
        }

        const endState = checkGameEnd(newGame);
        if (endState.isOver && endState.result && endState.reason) {
          handleGameEnd(endState.result, endState.reason, newGame);
        }
      }
    } catch (err) {
      console.error('Failed to make AI move:', err);
    } finally {
      setIsAiThinking(false);
    }
  };

  // Player makes a move on board
  const handlePlayerMove = (moveData: { from: Square; to: Square; promotion?: string }) => {
    if (chess.isGameOver() || isAiThinking) return;

    // Check if it's player's turn
    const isPlayerTurn =
      (playerColor === 'white' && chess.turn() === 'w') ||
      (playerColor === 'black' && chess.turn() === 'b');

    if (!isPlayerTurn) return;

    try {
      const prevFen = chess.fen();
      const newGame = new Chess();
      try {
        newGame.loadPgn(chess.pgn());
      } catch {
        newGame.load(prevFen);
      }
      const move = newGame.move({
        from: moveData.from,
        to: moveData.to,
        promotion: moveData.promotion || (settings.pieceSet ? 'q' : undefined),
      });

      if (!move) return;

      // Clear any active live hint
      setHintLevel(0);
      setActiveHint(null);
      setHintHighlightSquares({});
      setHintArrow(null);

      if (move.captured) sounds.playCapture();
      else if (move.flags.includes('k') || move.flags.includes('q')) sounds.playCastle();
      else sounds.playMove();

      if (newGame.inCheck()) sounds.playCheck();

      setChess(newGame);
      setLastMove({ from: move.from, to: move.to });
      setHistoryMoves((prev) => [...prev, { san: move.san, from: move.from, to: move.to }]);

      const updatedEval = stockfish.evaluatePositionSync(newGame);
      setEvalScoreCp(updatedEval);

      // Fast player move classification for Play Coach live commentary
      let bestMoveUci = '';
      let bestMoveSan = '';
      try {
        const best = stockfish.findBestMoveFast(new Chess(prevFen));
        bestMoveUci = best.uci;
        bestMoveSan = best.san;
      } catch {
        bestMoveUci = '';
        bestMoveSan = '';
      }
      const playedUci = `${moveData.from}${moveData.to}${moveData.promotion || ''}`;

      let classification: MoveClassification = 'good';
      if (bestMoveUci && bestMoveUci === playedUci) {
        classification = historyMoves.length < 4 ? 'book' : 'best';
      } else {
        const evalBefore = stockfish.evaluatePositionSync(chess);
        const evalAfter = stockfish.evaluatePositionSync(newGame);
        const loss = playerColor === 'white' ? Math.max(0, evalBefore - evalAfter) : Math.max(0, evalAfter - evalBefore);
        if (loss > 250) classification = 'blunder';
        else if (loss > 120) classification = 'mistake';
        else if (loss > 60) classification = 'inaccuracy';
        else classification = 'good';
      }

      setLastMoveDetail({
        san: move.san,
        color: move.color,
        from: move.from,
        to: move.to,
        bestSan: bestMoveSan || move.san,
        classification,
      });

      const comment = generateCoachComment(
        move.san,
        classification,
        0,
        bestMoveSan || (bestMoveUci ? bestMoveUci.slice(0, 4) : ''),
        settings.coachPersona || 'friendly',
        true
      );

      setCoachMoodTag(
        classification === 'best'
          ? 'Best Move!'
          : classification === 'blunder'
          ? 'Blunder Alert'
          : classification === 'mistake'
          ? 'Mistake'
          : 'Move Feedback'
      );
      setCoachSpeech(comment);
      if (settings.coachVoiceEnabled && settings.playCoachEnabled) {
        coachVoice.speak(comment, settings.coachPersona);
      }

      const endState = checkGameEnd(newGame);
      if (endState.isOver && endState.result && endState.reason) {
        handleGameEnd(endState.result, endState.reason, newGame);
      } else {
        // Trigger AI reply
        triggerAiMove(newGame, opponentElo, playerColor);
      }
    } catch {
      // Illegal move handled gracefully
    }
  };

  // Interactive Coach Actions: Explain Position
  const handleExplainPosition = useCallback(() => {
    const text = explainCurrentPosition(chess, settings.coachPersona);
    setCoachMoodTag('Position Analysis');
    setCoachSpeech(text);
    if (settings.coachVoiceEnabled) {
      coachVoice.speak(text, settings.coachPersona);
    }
  }, [chess, settings.coachPersona, settings.coachVoiceEnabled]);

  // Interactive Coach Actions: Explain Last Move
  const handleExplainLastMove = useCallback(() => {
    if (!lastMoveDetail) {
      const text = 'No moves have been played yet. Establish a pawn in the center and prepare piece development.';
      setCoachMoodTag('Opening Advice');
      setCoachSpeech(text);
      if (settings.coachVoiceEnabled) {
        coachVoice.speak(text, settings.coachPersona);
      }
      return;
    }
    const text = explainLastMoveDetail(lastMoveDetail, chess, settings.coachPersona);
    setCoachMoodTag('Last Move Insight');
    setCoachSpeech(text);
    if (settings.coachVoiceEnabled) {
      coachVoice.speak(text, settings.coachPersona);
    }
  }, [lastMoveDetail, chess, settings.coachPersona, settings.coachVoiceEnabled]);

  // Interactive Coach Actions: Ask Question
  const handleAskCoach = useCallback(
    async (questionText: string) => {
      const trimmed = questionText.trim();
      if (!trimmed || isCoachThinking) return;

      setIsCoachThinking(true);
      setCoachMoodTag('Coach Answering');

      try {
        const res = await fetch('/api/coach/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            question: trimmed,
            fen: chess.fen(),
            coachPersona: settings.coachPersona,
            lastMove: lastMoveDetail,
            gameMeta: {
              playerColor,
              opponentElo,
              moveNumber: Math.floor(historyMoves.length / 2) + 1,
            },
          }),
        });

        if (res.ok) {
          const data = await res.json();
          if (data.answer) {
            setCoachSpeech(data.answer);
            if (settings.coachVoiceEnabled) {
              coachVoice.speak(data.answer, settings.coachPersona);
            }
            setCoachQuestion('');
            setIsCoachThinking(false);
            return;
          }
        }
      } catch (e) {
        console.warn('API coach chat unavailable, falling back to local coach intelligence:', e);
      }

      // Contextual offline fallback
      const answer = answerCoachQuestionOffline(trimmed, chess, lastMoveDetail, settings.coachPersona);
      setCoachSpeech(answer);
      if (settings.coachVoiceEnabled) {
        coachVoice.speak(answer, settings.coachPersona);
      }
      setCoachQuestion('');
      setIsCoachThinking(false);
    },
    [
      isCoachThinking,
      chess,
      settings.coachPersona,
      lastMoveDetail,
      playerColor,
      opponentElo,
      historyMoves.length,
      settings.coachVoiceEnabled,
    ]
  );

  // Live Hint System (Tier 1: Strategic Idea -> Tier 2: Highlight Piece -> Tier 3: Show Arrow)
  const handleClearHint = () => {
    setHintLevel(0);
    setActiveHint(null);
    setHintHighlightSquares({});
    setHintArrow(null);
  };

  const handleRequestHint = () => {
    if (chess.isGameOver() || isAiThinking || !isPlayerTurn) return;

    if (hintLevel === 0) {
      let bestResult: { uci: string; san: string; evalCp: number } | null = null;
      try {
        bestResult = stockfish.findBestMoveFast(chess);
      } catch {
        bestResult = null;
      }
      if (!bestResult || !bestResult.uci || bestResult.uci.length < 4) return;

      const from = bestResult.uci.slice(0, 2) as Square;
      const to = bestResult.uci.slice(2, 4) as Square;
      const san = bestResult.san;
      const pieceOnFrom = chess.get(from);
      const pieceType = pieceOnFrom ? pieceOnFrom.type : 'p';

      let idea = '';
      const isCapture = chess.get(to) !== null;
      const isCheck = san.includes('+');

      if (san.includes('O-O')) {
        idea = 'King Safety: Castle your king into safety and bring your rook toward the center.';
      } else if (isCapture) {
        idea = `Tactical Trade: Look for a favorable piece capture around ${to.toUpperCase()} that wins material or damages their structure.`;
      } else if (isCheck) {
        idea = "Forcing Check: Look for a direct check that limits your opponent's king choices and buys a tempo.";
      } else {
        switch (pieceType) {
          case 'p':
            idea = `Pawn Push: Consider advancing a pawn toward ${to.toUpperCase()} to fight for central space and open lines.`;
            break;
          case 'n':
            idea = 'Knight Outpost: Look to develop or reposition your knight toward an active central square.';
            break;
          case 'b':
            idea = "Diagonal Vision: Look for an open diagonal to maximize your bishop's scope across the board.";
            break;
          case 'r':
            idea = 'Rook Activity: Consider placing your rook on an open or semi-open file to control vertical lines.';
            break;
          case 'q':
            idea = 'Queen Coordination: Coordinate your queen with minor pieces to create active pressure without overextending.';
            break;
          default:
            idea = 'Piece Activity: Improve your least active piece and put pressure on key central squares.';
            break;
        }
      }

      setActiveHint({ idea, from, to, san, pieceType });
      setHintLevel(1);
      setCoachMoodTag('Strategic Idea');
      setCoachSpeech(idea);
      if (settings.coachVoiceEnabled && settings.playCoachEnabled) {
        coachVoice.speak(idea, settings.coachPersona);
      }
    } else if (hintLevel === 1 && activeHint) {
      setHintLevel(2);
      setHintHighlightSquares({
        [activeHint.from]: 'bg-emerald-500/40 ring-4 ring-emerald-400 animate-pulse',
      });
      const msg = `Focus on your piece on ${activeHint.from.toUpperCase()}! Look closely at where it can jump.`;
      setCoachMoodTag('Piece Highlight');
      setCoachSpeech(msg);
      if (settings.coachVoiceEnabled && settings.playCoachEnabled) {
        coachVoice.speak(msg, settings.coachPersona);
      }
    } else if (hintLevel === 2 && activeHint) {
      setHintLevel(3);
      setHintHighlightSquares({
        [activeHint.from]: 'bg-emerald-500/30',
        [activeHint.to]: 'bg-emerald-500/50 ring-2 ring-emerald-400',
      });
      setHintArrow({ from: activeHint.from, to: activeHint.to });
      const msg = `Best move: Play ${activeHint.san} (${activeHint.from.toUpperCase()} to ${activeHint.to.toUpperCase()}). That gives you the best position!`;
      setCoachMoodTag('Best Move Shown');
      setCoachSpeech(msg);
      if (settings.coachVoiceEnabled && settings.playCoachEnabled) {
        coachVoice.speak(msg, settings.coachPersona);
      }
    }
  };

  // Take back move (undo player and bot moves)
  const handleTakeback = () => {
    if (isAiThinking || historyMoves.length === 0) return;

    handleClearHint();

    const newGame = new Chess();
    // Replay moves except the last two (or one if AI hasn't moved yet)
    const movesToKeep = historyMoves.slice(0, Math.max(0, historyMoves.length - 2));

    for (const m of movesToKeep) {
      newGame.move(m.san);
    }

    setChess(newGame);
    setHistoryMoves(movesToKeep);
    setLastMove(
      movesToKeep.length > 0
        ? { from: movesToKeep[movesToKeep.length - 1].from, to: movesToKeep[movesToKeep.length - 1].to }
        : null
    );
    setEvalScoreCp(stockfish.evaluatePositionSync(newGame));
    sounds.playClick();

    const takebackMsg = 'Takeback allowed! Replay that position with fresh eyes and look for the stronger move.';
    setCoachMoodTag('Takeback');
    setCoachSpeech(takebackMsg);
    if (settings.coachVoiceEnabled && settings.playCoachEnabled) {
      coachVoice.speak(takebackMsg, settings.coachPersona);
    }
  };

  // Resign game
  const handleResign = () => {
    if (chess.isGameOver()) return;
    if (window.confirm('Are you sure you want to resign this game?')) {
      handleGameEnd('loss', 'resignation', chess);
    }
  };

  // Copy PGN to clipboard
  const handleCopyPgn = () => {
    navigator.clipboard.writeText(chess.pgn());
    setCopiedPgn(true);
    setTimeout(() => setCopiedPgn(false), 2000);
  };

  // Download PGN
  const handleDownloadPgn = () => {
    const element = document.createElement('a');
    const file = new Blob([chess.pgn()], { type: 'text/plain' });
    element.href = URL.createObjectURL(file);
    element.download = `chessmind_game_${Date.now()}.pgn`;
    document.body.appendChild(element);
    element.click();
    document.body.removeChild(element);
  };

  // Material evaluation and captured pieces calculation
  const getCapturedPieces = () => {
    const fullSet = {
      p: 8,
      n: 2,
      b: 2,
      r: 2,
      q: 1,
    };

    const currentCounts = {
      w: { p: 0, n: 0, b: 0, r: 0, q: 0 },
      b: { p: 0, n: 0, b: 0, r: 0, q: 0 },
    };

    const board = chess.board();
    for (let r = 0; r < 8; r++) {
      for (let c = 0; c < 8; c++) {
        const piece = board[r][c];
        if (piece && piece.type !== 'k') {
          currentCounts[piece.color][piece.type]++;
        }
      }
    }

    // Pieces captured by White (missing black pieces)
    const capturedByWhite: string[] = [];
    (Object.keys(fullSet) as Array<keyof typeof fullSet>).forEach((type) => {
      const missing = fullSet[type] - currentCounts.b[type];
      for (let i = 0; i < missing; i++) capturedByWhite.push(type);
    });

    // Pieces captured by Black (missing white pieces)
    const capturedByBlack: string[] = [];
    (Object.keys(fullSet) as Array<keyof typeof fullSet>).forEach((type) => {
      const missing = fullSet[type] - currentCounts.w[type];
      for (let i = 0; i < missing; i++) capturedByBlack.push(type);
    });

    // Material difference
    type PieceKey = 'p' | 'n' | 'b' | 'r' | 'q';
    const values: Record<PieceKey, number> = { p: 1, n: 3, b: 3, r: 5, q: 9 };
    let whiteMaterial = 0;
    let blackMaterial = 0;
    (Object.keys(values) as PieceKey[]).forEach((t) => {
      whiteMaterial += currentCounts.w[t] * values[t];
      blackMaterial += currentCounts.b[t] * values[t];
    });

    const diff = whiteMaterial - blackMaterial;

    return {
      capturedByWhite,
      capturedByBlack,
      diff,
    };
  };

  const captured = getCapturedPieces();
  const opening = identifyOpening(historyMoves.map((m) => m.san));

  // Determine whose turn it is
  const isPlayerTurn =
    (playerColor === 'white' && chess.turn() === 'w') ||
    (playerColor === 'black' && chess.turn() === 'b');

  return (
    <div className="max-w-7xl mx-auto px-3 sm:px-6 py-4 sm:py-6">
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Column: Opponent Card + Chessboard & EvalBar + Player Card */}
        <div className="lg:col-span-8 flex flex-col items-center">
          {/* Opponent Card (Top) */}
          <div className="w-full max-w-[595px] flex items-center justify-between px-3 py-2.5 mb-2 rounded-lg bg-[#16171b] border border-zinc-800">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-zinc-800 border border-zinc-700 flex items-center justify-center text-zinc-300">
                <Bot className="w-5 h-5 text-emerald-400" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-semibold text-zinc-200">Stockfish AI</span>
                  <span className="text-xs font-mono font-medium text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">
                    {opponentElo} Elo
                  </span>
                </div>
                <div className="flex items-center gap-1.5 text-xs text-zinc-500">
                  <span>{playerColor === 'white' ? 'Black' : 'White'}</span>
                  {isAiThinking && (
                    <span className="text-emerald-400 font-medium animate-pulse">
                      · Calculating best move...
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* Captured pieces by opponent */}
            <div className="flex items-center gap-2 text-xs font-mono text-zinc-400">
              <div className="flex items-center -space-x-1.5 overflow-x-auto max-w-[200px] py-0.5">
                {(playerColor === 'white' ? captured.capturedByBlack : captured.capturedByWhite).map((p, idx) => (
                  <div key={idx} className="w-5 h-5 shrink-0">
                    <Piece
                      type={p as 'p' | 'n' | 'b' | 'r' | 'q' | 'k'}
                      color={playerColor === 'white' ? 'w' : 'b'}
                    />
                  </div>
                ))}
              </div>
              {((playerColor === 'white' && captured.diff < 0) ||
                (playerColor === 'black' && captured.diff > 0)) && (
                <span className="font-bold text-zinc-300">+{Math.abs(captured.diff)}</span>
              )}
            </div>
          </div>

          {/* Central Chessboard Layout with EvalBar */}
          <div className="flex items-stretch gap-2.5 sm:gap-3 w-full max-w-[595px]">
            {/* Interactive EvalBar */}
            <EvalBar
              scoreCp={evalScoreCp}
              orientation={orientation}
            />

            {/* The Chessboard */}
            <div className="flex-1">
              <Chessboard
                chess={chess}
                orientation={orientation}
                isInteractive={!chess.isGameOver() && !isAiThinking}
                onMove={handlePlayerMove}
                lastMove={lastMove}
                highlightSquares={hintHighlightSquares}
                bestMoveArrow={hintArrow}
                theme={settings.boardTheme}
                showCoordinates={settings.showCoordinates}
              />
            </div>
          </div>

          {/* Player Card (Bottom) */}
          <div className="w-full max-w-[595px] flex items-center justify-between px-3 py-2.5 mt-2 rounded-lg bg-[#16171b] border border-zinc-800">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
                <User className="w-5 h-5" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-semibold text-zinc-200">You</span>
                  <span className="text-xs font-mono text-zinc-400 bg-zinc-800 px-2 py-0.5 rounded border border-zinc-700">
                    ~{playerElo} Elo
                  </span>
                </div>
                <div className="text-xs text-zinc-500">
                  <span>{playerColor === 'white' ? 'White' : 'Black'}</span>
                  {isPlayerTurn && !chess.isGameOver() && (
                    <span className="text-emerald-400 font-medium ml-1.5">· Your turn</span>
                  )}
                </div>
              </div>
            </div>

            {/* Captured pieces by player */}
            <div className="flex items-center gap-2 text-xs font-mono text-zinc-400">
              <div className="flex items-center -space-x-1.5 overflow-x-auto max-w-[200px] py-0.5">
                {(playerColor === 'white' ? captured.capturedByWhite : captured.capturedByBlack).map((p, idx) => (
                  <div key={idx} className="w-5 h-5 shrink-0">
                    <Piece
                      type={p as 'p' | 'n' | 'b' | 'r' | 'q' | 'k'}
                      color={playerColor === 'white' ? 'b' : 'w'}
                    />
                  </div>
                ))}
              </div>
              {((playerColor === 'white' && captured.diff > 0) ||
                (playerColor === 'black' && captured.diff < 0)) && (
                <span className="font-bold text-zinc-300">+{Math.abs(captured.diff)}</span>
              )}
            </div>
          </div>
        </div>

        {/* Right Column: Play Coach, Move History, Opening Name, and Controls */}
        <div className="lg:col-span-4 flex flex-col gap-4">
          {/* PLAY COACH COMPANION CARD */}
          <div className="rounded-xl bg-[#141519] border border-zinc-800 p-4 flex flex-col gap-3 shadow-lg relative">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2.5 min-w-0">
                <div
                  className={`w-9 h-9 rounded-xl bg-gradient-to-br ${activePersona.avatarColor} flex items-center justify-center text-white font-bold text-xs shadow-md shrink-0`}
                >
                  {activePersona.badge}
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs font-bold text-white truncate">{activePersona.name}</span>
                    <span className="text-[10px] font-mono font-semibold px-1 py-0.2 bg-zinc-800 text-zinc-300 rounded border border-zinc-700">
                      {activePersona.badge}
                    </span>
                  </div>
                  <div className="text-[11px] text-emerald-400 font-medium truncate">
                    {activePersona.title}
                  </div>
                </div>
              </div>

              {/* Persona Selector & Toggles */}
              <div className="flex items-center gap-1.5 shrink-0">
                <select
                  value={settings.coachPersona || 'nolan'}
                  onChange={(e) =>
                    onUpdateSettings?.({
                      ...settings,
                      coachPersona: e.target.value as CoachPersonaId,
                    })
                  }
                  className="text-[11px] bg-zinc-850 hover:bg-zinc-800 text-zinc-200 border border-zinc-700 rounded-lg px-2 py-1 outline-none cursor-pointer"
                  title="Switch Coach Persona"
                >
                  {COACH_PERSONAS.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>

                <button
                  type="button"
                  onClick={() => {
                    const nextVoice = !settings.coachVoiceEnabled;
                    coachVoice.setEnabled(nextVoice);
                    onUpdateSettings?.({ ...settings, coachVoiceEnabled: nextVoice });
                    if (nextVoice) {
                      coachVoice.speak('Voice enabled', settings.coachPersona);
                    }
                  }}
                  className={`p-1.5 rounded-lg border transition-colors cursor-pointer ${
                    settings.coachVoiceEnabled
                      ? 'bg-emerald-950/40 border-emerald-700/60 text-emerald-400'
                      : 'bg-zinc-850 border-zinc-750 text-zinc-400 hover:text-zinc-200'
                  }`}
                  title={settings.coachVoiceEnabled ? 'Mute Coach voice' : 'Enable Coach voice narration'}
                >
                  {settings.coachVoiceEnabled ? (
                    <Volume2 className="w-3.5 h-3.5" />
                  ) : (
                    <VolumeX className="w-3.5 h-3.5" />
                  )}
                </button>

                <button
                  type="button"
                  onClick={() =>
                    onUpdateSettings?.({
                      ...settings,
                      playCoachEnabled: !settings.playCoachEnabled,
                    })
                  }
                  className={`px-2 py-1 rounded-lg text-[10px] font-semibold border transition-colors cursor-pointer ${
                    settings.playCoachEnabled
                      ? 'bg-emerald-600/20 border-emerald-500 text-emerald-400'
                      : 'bg-zinc-800 border-zinc-700 text-zinc-500'
                  }`}
                  title="Toggle Play Coach Mode"
                >
                  {settings.playCoachEnabled ? 'ON' : 'OFF'}
                </button>
              </div>
            </div>

            {/* Coach Speech Bubble & Live Feedback */}
            {settings.playCoachEnabled ? (
              <>
                <div className="p-3 rounded-xl bg-zinc-900/90 border border-zinc-800">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-[10px] font-mono uppercase tracking-wider text-emerald-400 font-semibold flex items-center gap-1">
                      <Sparkles className="w-3 h-3" />
                      {coachMoodTag}
                    </span>
                    {coachSpeech && (
                      <button
                        type="button"
                        onClick={() => coachVoice.speak(coachSpeech, settings.coachPersona)}
                        className="text-[10px] text-zinc-400 hover:text-emerald-400 flex items-center gap-1 transition-colors cursor-pointer"
                        title="Replay Coach message aloud"
                      >
                        <Volume2 className="w-3 h-3" />
                        <span>Listen</span>
                      </button>
                    )}
                  </div>
                  <p className="text-xs text-zinc-200 leading-relaxed font-sans italic">
                    "{coachSpeech}"
                  </p>
                </div>

                {/* Coach Interactive Actions: Tiered Hint + Explain Position + Explain Last Move */}
                <div className="flex flex-col gap-2 pt-1 border-t border-zinc-800/60">
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={handleExplainPosition}
                      disabled={chess.isGameOver() || isAiThinking}
                      className="flex items-center justify-center gap-1.5 py-1.5 px-2.5 rounded-lg text-[11px] font-semibold bg-zinc-850 hover:bg-zinc-800 text-zinc-200 border border-zinc-750 transition-colors cursor-pointer disabled:opacity-40"
                      title="Get an evaluation and overview of this position"
                    >
                      <Compass className="w-3.5 h-3.5 text-emerald-400" />
                      <span>Explain Position</span>
                    </button>

                    <button
                      type="button"
                      onClick={handleExplainLastMove}
                      disabled={chess.isGameOver() || isAiThinking}
                      className="flex items-center justify-center gap-1.5 py-1.5 px-2.5 rounded-lg text-[11px] font-semibold bg-zinc-850 hover:bg-zinc-800 text-zinc-200 border border-zinc-750 transition-colors cursor-pointer disabled:opacity-40"
                      title="Understand the ideas behind the last move played"
                    >
                      <HelpCircle className="w-3.5 h-3.5 text-cyan-400" />
                      <span>Explain Last Move</span>
                    </button>
                  </div>

                  {/* Tiered Live Hints Button */}
                  <div className="flex items-center justify-between gap-2">
                    <button
                      type="button"
                      onClick={handleRequestHint}
                      disabled={chess.isGameOver() || isAiThinking || !isPlayerTurn}
                      className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 px-3 rounded-lg text-xs font-semibold transition-all cursor-pointer border ${
                        hintLevel > 0
                          ? 'bg-amber-500/20 border-amber-500/40 text-amber-300'
                          : 'bg-emerald-600/15 border-emerald-500/30 hover:bg-emerald-600/25 text-emerald-300'
                      } disabled:opacity-40 disabled:cursor-not-allowed`}
                      title="Ask your coach for tiered guidance"
                    >
                      <Lightbulb className="w-3.5 h-3.5" />
                      <span>
                        {hintLevel === 0
                          ? '💡 Ask Coach for Hint'
                          : hintLevel === 1
                          ? 'Next: Highlight Piece'
                          : hintLevel === 2
                          ? 'Next: Reveal Best Move'
                          : 'Best Move Shown'}
                      </span>
                    </button>

                    {hintLevel > 0 && (
                      <button
                        type="button"
                        onClick={handleClearHint}
                        className="py-1.5 px-2.5 rounded-lg text-xs font-medium bg-zinc-850 hover:bg-zinc-800 text-zinc-400 border border-zinc-750 transition-colors cursor-pointer"
                        title="Clear hint markers"
                      >
                        Clear
                      </button>
                    )}
                  </div>

                  {/* Quick Question Chips */}
                  <div className="pt-2 border-t border-zinc-800/60">
                    <div className="text-[10px] font-semibold uppercase text-zinc-400 mb-1.5 flex items-center gap-1">
                      <MessageSquare className="w-3 h-3 text-emerald-400" />
                      <span>Ask Your Coach</span>
                    </div>
                    <div className="flex items-center gap-1.5 overflow-x-auto pb-1 no-scrollbar">
                      {[
                        'Is my king safe?',
                        "What's the plan?",
                        'Why that move?',
                        'Any hanging pieces?',
                      ].map((chip) => (
                        <button
                          key={chip}
                          type="button"
                          onClick={() => handleAskCoach(chip)}
                          disabled={isCoachThinking}
                          className="shrink-0 px-2 py-0.5 rounded-md bg-zinc-850 hover:bg-zinc-800 text-zinc-300 hover:text-white border border-zinc-750 text-[11px] transition-colors cursor-pointer disabled:opacity-50"
                        >
                          {chip}
                        </button>
                      ))}
                    </div>

                    {/* Chat Input Form */}
                    <form
                      onSubmit={(e) => {
                        e.preventDefault();
                        handleAskCoach(coachQuestion);
                      }}
                      className="flex items-center gap-1.5 mt-2"
                    >
                      <input
                        type="text"
                        value={coachQuestion}
                        onChange={(e) => setCoachQuestion(e.target.value)}
                        placeholder="Ask coach anything about this position..."
                        disabled={isCoachThinking}
                        className="flex-1 bg-zinc-900 border border-zinc-750 rounded-lg px-2.5 py-1.5 text-xs text-zinc-200 placeholder-zinc-500 focus:outline-none focus:border-emerald-500 disabled:opacity-50"
                      />
                      <button
                        type="submit"
                        disabled={!coachQuestion.trim() || isCoachThinking}
                        className="p-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 text-white transition-colors cursor-pointer shrink-0"
                        title="Send question to coach"
                      >
                        <Send className="w-3.5 h-3.5" />
                      </button>
                    </form>
                  </div>
                </div>
              </>
            ) : (
              <div className="text-xs text-zinc-500 py-1 flex items-center justify-between">
                <span>Play Coach is paused. Turn ON for real-time guidance.</span>
              </div>
            )}
          </div>

          {/* Game Info & Opening Card */}
          <div className="p-4 rounded-xl bg-[#141519] border border-zinc-800">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-mono text-emerald-400 uppercase tracking-wider">
                {opening.eco}
              </span>
              <span className="text-xs text-zinc-500">
                {historyMoves.length} moves
              </span>
            </div>
            <h3 className="text-sm font-semibold text-zinc-100 truncate">
              {opening.name}
            </h3>
          </div>

          {/* Move History Table */}
          <div className="rounded-xl bg-[#141519] border border-zinc-800 flex flex-col h-[320px]">
            <div className="px-4 py-3 border-b border-zinc-800 flex items-center justify-between">
              <span className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">
                Move History
              </span>
              <span className="text-xs font-mono text-zinc-500">
                {chess.turn() === 'w' ? 'White to move' : 'Black to move'}
              </span>
            </div>

            <div className="flex-1 overflow-y-auto p-2 font-mono text-xs">
              {historyMoves.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-zinc-500 text-xs text-center p-4">
                  <span>Game started</span>
                  <span className="text-[11px] mt-1 text-zinc-600">
                    Make your move on the board to begin
                  </span>
                </div>
              ) : (
                <div className="grid grid-cols-12 gap-y-1">
                  {Array.from({ length: Math.ceil(historyMoves.length / 2) }).map((_, i) => {
                    const whiteMove = historyMoves[i * 2];
                    const blackMove = historyMoves[i * 2 + 1];

                    return (
                      <React.Fragment key={i}>
                        <div className="col-span-2 text-zinc-500 py-1 text-right pr-2">
                          {i + 1}.
                        </div>
                        <div className="col-span-5 px-2 py-1 rounded text-zinc-200 hover:bg-zinc-800/80 transition-colors">
                          {whiteMove ? whiteMove.san : ''}
                        </div>
                        <div className="col-span-5 px-2 py-1 rounded text-zinc-200 hover:bg-zinc-800/80 transition-colors">
                          {blackMove ? blackMove.san : ''}
                        </div>
                      </React.Fragment>
                    );
                  })}
                  <div ref={moveListEndRef} />
                </div>
              )}
            </div>
          </div>

          {/* Action Toolbar */}
          <div className="p-3 rounded-xl bg-[#141519] border border-zinc-800 flex flex-col gap-2">
            <div className="grid grid-cols-3 gap-2">
              <button
                onClick={handleTakeback}
                disabled={historyMoves.length === 0 || isAiThinking || chess.isGameOver()}
                className="flex items-center justify-center gap-1.5 py-2 px-3 rounded-lg text-xs font-medium bg-zinc-800 hover:bg-zinc-700 disabled:opacity-40 text-zinc-300 transition-colors cursor-pointer"
                title="Take back last move"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Undo</span>
              </button>

              <button
                onClick={() => setOrientation(orientation === 'white' ? 'black' : 'white')}
                className="flex items-center justify-center gap-1.5 py-2 px-3 rounded-lg text-xs font-medium bg-zinc-800 hover:bg-zinc-700 text-zinc-300 transition-colors cursor-pointer"
                title="Flip board perspective"
              >
                <RotateCw className="w-3.5 h-3.5" />
                <span>Flip</span>
              </button>

              <button
                onClick={handleResign}
                disabled={chess.isGameOver()}
                className="flex items-center justify-center gap-1.5 py-2 px-3 rounded-lg text-xs font-medium bg-zinc-800 hover:bg-rose-950/40 hover:text-rose-400 disabled:opacity-40 text-zinc-300 transition-colors cursor-pointer"
                title="Resign game"
              >
                <Flag className="w-3.5 h-3.5" />
                <span>Resign</span>
              </button>
            </div>

            <div className="grid grid-cols-2 gap-2 pt-1 border-t border-zinc-800/60">
              <button
                onClick={handleCopyPgn}
                className="flex items-center justify-center gap-1.5 py-2 px-3 rounded-lg text-xs font-medium bg-zinc-900 border border-zinc-800 hover:bg-zinc-800 text-zinc-300 transition-colors cursor-pointer"
              >
                {copiedPgn ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copiedPgn ? 'Copied PGN' : 'Copy PGN'}</span>
              </button>

              <button
                onClick={handleDownloadPgn}
                className="flex items-center justify-center gap-1.5 py-2 px-3 rounded-lg text-xs font-medium bg-zinc-900 border border-zinc-800 hover:bg-zinc-800 text-zinc-300 transition-colors cursor-pointer"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Export PGN</span>
              </button>
            </div>

            <button
              onClick={() => setIsSetupOpen(true)}
              className="w-full mt-1 flex items-center justify-center gap-2 py-2.5 px-4 rounded-lg text-xs font-semibold bg-emerald-600 hover:bg-emerald-500 text-white transition-all cursor-pointer shadow-sm"
            >
              <Sliders className="w-4 h-4" />
              <span>Change Opponent / New Match</span>
            </button>
          </div>
        </div>
      </div>

      {/* Game Over Modal */}
      {gameOverData && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-xs flex items-center justify-center z-50 p-4">
          <div className="w-full max-w-md bg-[#16171b] border border-zinc-700 rounded-2xl p-6 shadow-2xl flex flex-col items-center text-center">
            {/* Trophy or Result Icon */}
            <div
              className={`w-16 h-16 rounded-2xl flex items-center justify-center mb-4 ${
                gameOverData.result === 'win'
                  ? 'bg-emerald-500/10 border border-emerald-500/30 text-emerald-400'
                  : gameOverData.result === 'draw'
                  ? 'bg-zinc-800 border border-zinc-700 text-zinc-300'
                  : 'bg-rose-500/10 border border-rose-500/30 text-rose-400'
              }`}
            >
              <Sparkles className="w-8 h-8" />
            </div>

            <h2 className="text-2xl font-bold text-white capitalize mb-1">
              {gameOverData.result === 'win'
                ? 'Victory!'
                : gameOverData.result === 'loss'
                ? 'Defeat'
                : 'Draw'}
            </h2>

            <div className="text-xs text-zinc-400 mb-4 capitalize">
              By {gameOverData.termination.replace('_', ' ')}
            </div>

            {/* Rating Delta Box */}
            <div className="w-full bg-[#1e2026] rounded-xl p-3 border border-zinc-700/60 mb-6 flex items-center justify-between">
              <span className="text-xs text-zinc-400">Estimated Elo Rating</span>
              <div className="flex items-center gap-2">
                <span className="text-sm font-mono font-bold text-white">
                  {gameOverData.newRating}
                </span>
                <span
                  className={`text-xs font-mono font-bold px-1.5 py-0.5 rounded ${
                    gameOverData.ratingDelta >= 0
                      ? 'bg-emerald-500/20 text-emerald-400'
                      : 'bg-rose-500/20 text-rose-400'
                  }`}
                >
                  {gameOverData.ratingDelta >= 0
                    ? `+${gameOverData.ratingDelta}`
                    : gameOverData.ratingDelta}
                </span>
              </div>
            </div>

            {/* Actions */}
            <div className="w-full flex flex-col gap-2.5">
              {gameOverData.gameRecord && (
                <button
                  onClick={() => onRequestAnalysis(gameOverData.gameRecord!)}
                  className="w-full flex items-center justify-center gap-2 py-3 px-4 rounded-xl text-sm font-semibold bg-emerald-600 hover:bg-emerald-500 text-white transition-all cursor-pointer shadow-md"
                >
                  <Sparkles className="w-4 h-4" />
                  <span>Analyze Game with AI Coach</span>
                  <ChevronRight className="w-4 h-4" />
                </button>
              )}

              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={() => startNewGame(playerColor, opponentElo)}
                  className="py-2.5 px-3 rounded-xl text-xs font-medium bg-zinc-800 hover:bg-zinc-700 text-zinc-200 transition-colors cursor-pointer"
                >
                  Rematch
                </button>
                <button
                  onClick={() => setGameOverData(null)}
                  className="py-2.5 px-3 rounded-xl text-xs font-medium bg-zinc-800 hover:bg-zinc-700 text-zinc-200 transition-colors cursor-pointer"
                >
                  Review Board
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* New Game Setup Modal */}
      {isSetupOpen && (
        <GameSetupModal
          currentElo={opponentElo}
          currentColor={playerColor}
          onStart={(color, elo) => startNewGame(color, elo)}
          onClose={() => setIsSetupOpen(false)}
        />
      )}
    </div>
  );
};

// Sub-component: Game Setup Modal
interface GameSetupModalProps {
  currentElo: DifficultyElo;
  currentColor: PlayerColor | 'random';
  onStart: (color: PlayerColor | 'random', elo: DifficultyElo) => void;
  onClose: () => void;
}

const ELO_OPTIONS: Array<{ elo: DifficultyElo; title: string }> = [
  { elo: 400, title: 'Beginner' },
  { elo: 600, title: 'Novice' },
  { elo: 800, title: 'Casual' },
  { elo: 1000, title: 'Club Beginner' },
  { elo: 1200, title: 'Intermediate' },
  { elo: 1400, title: 'Intermediate+' },
  { elo: 1600, title: 'Advanced' },
  { elo: 1800, title: 'Club Expert' },
  { elo: 2000, title: 'Candidate Master' },
  { elo: 2200, title: 'Master' },
  { elo: 2400, title: 'Grandmaster' },
];

const GameSetupModal: React.FC<GameSetupModalProps> = ({
  currentElo,
  currentColor,
  onStart,
  onClose,
}) => {
  const [selectedElo, setSelectedElo] = useState<DifficultyElo>(currentElo);
  const [selectedColor, setSelectedColor] = useState<PlayerColor | 'random'>(currentColor);

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-xs flex items-center justify-center z-50 p-4">
      <div className="w-full max-w-lg bg-[#16171b] border border-zinc-700 rounded-2xl p-6 shadow-2xl flex flex-col">
        <h2 className="text-xl font-bold text-white mb-1">New Chess Match</h2>
        <p className="text-xs text-zinc-400 mb-5">
          Configure your side and select Stockfish playing strength.
        </p>

        {/* Color Selection */}
        <div className="mb-5">
          <label className="text-xs font-semibold text-zinc-300 uppercase tracking-wider block mb-2">
            Play As
          </label>
          <div className="grid grid-cols-3 gap-2">
            {(
              [
                { id: 'white', label: 'White' },
                { id: 'random', label: 'Random' },
                { id: 'black', label: 'Black' },
              ] as const
            ).map((opt) => (
              <button
                key={opt.id}
                onClick={() => setSelectedColor(opt.id)}
                className={`py-2.5 px-3 rounded-xl text-xs font-medium transition-all cursor-pointer border ${
                  selectedColor === opt.id
                    ? 'bg-emerald-600/20 border-emerald-500 text-emerald-400 font-bold'
                    : 'bg-zinc-800/80 border-zinc-700 text-zinc-300 hover:bg-zinc-800'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        {/* Difficulty Selection */}
        <div className="mb-6">
          <div className="flex items-center justify-between mb-2">
            <label className="text-xs font-semibold text-zinc-300 uppercase tracking-wider">
              Stockfish Strength
            </label>
            <span className="text-xs font-mono font-bold text-emerald-400">
              {selectedElo} Elo
            </span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 max-h-56 overflow-y-auto pr-1">
            {ELO_OPTIONS.map((opt) => (
              <button
                key={opt.elo}
                onClick={() => setSelectedElo(opt.elo)}
                className={`py-2 px-3 rounded-lg text-left transition-all cursor-pointer border flex flex-col ${
                  selectedElo === opt.elo
                    ? 'bg-emerald-600/20 border-emerald-500 text-white'
                    : 'bg-zinc-900 border-zinc-800 text-zinc-400 hover:text-zinc-200 hover:bg-zinc-850'
                }`}
              >
                <span className="text-xs font-bold font-mono text-zinc-200">
                  {opt.elo} Elo
                </span>
                <span className="text-[11px] text-zinc-500">
                  {opt.title}
                </span>
              </button>
            ))}
          </div>
        </div>

        {/* Modal Buttons */}
        <div className="flex items-center justify-end gap-3 pt-4 border-t border-zinc-800">
          <button
            onClick={onClose}
            className="py-2 px-4 rounded-lg text-xs font-medium text-zinc-400 hover:text-white transition-colors cursor-pointer"
          >
            Cancel
          </button>
          <button
            onClick={() => onStart(selectedColor, selectedElo)}
            className="py-2.5 px-6 rounded-lg text-xs font-semibold bg-emerald-600 hover:bg-emerald-500 text-white transition-all cursor-pointer shadow-sm"
          >
            Start Match
          </button>
        </div>
      </div>
    </div>
  );
};
