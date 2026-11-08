import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Chess, Square, Move } from 'chess.js';
import { Piece } from './Piece';
import { PlayerColor } from '../../types/chess';
import { sounds } from '../../services/sound';

interface ChessboardProps {
  chess: Chess;
  orientation?: PlayerColor;
  isInteractive?: boolean;
  onMove?: (move: { from: Square; to: Square; promotion?: string }) => boolean | void;
  lastMove?: { from: string; to: string } | null;
  highlightSquares?: Record<string, string>; // square -> color / class
  bestMoveArrow?: { from: string; to: string } | null;
  theme?: 'emerald' | 'charcoal' | 'wood' | 'ocean';
  showCoordinates?: boolean;
}

const THEME_COLORS: Record<string, { light: string; dark: string; lightText: string; darkText: string }> = {
  emerald: {
    light: '#ebecd0',
    dark: '#779952',
    lightText: '#779952',
    darkText: '#ebecd0',
  },
  charcoal: {
    light: '#71717a',
    dark: '#3f3f46',
    lightText: '#3f3f46',
    darkText: '#a1a1aa',
  },
  wood: {
    light: '#f0d9b5',
    dark: '#b58863',
    lightText: '#b58863',
    darkText: '#f0d9b5',
  },
  ocean: {
    light: '#dae3ed',
    dark: '#587ca8',
    lightText: '#587ca8',
    darkText: '#dae3ed',
  },
};

export const Chessboard: React.FC<ChessboardProps> = ({
  chess,
  orientation = 'white',
  isInteractive = true,
  onMove,
  lastMove,
  highlightSquares = {},
  bestMoveArrow,
  theme = 'emerald',
  showCoordinates = true,
}) => {
  const [selectedSquare, setSelectedSquare] = useState<Square | null>(null);
  const [legalMoves, setLegalMoves] = useState<Move[]>([]);
  const [draggedSquare, setDraggedSquare] = useState<Square | null>(null);
  const [pendingPromotion, setPendingPromotion] = useState<{ from: Square; to: Square } | null>(null);

  const boardRef = useRef<HTMLDivElement>(null);
  const colors = THEME_COLORS[theme] || THEME_COLORS.emerald;

  // Board layout according to orientation
  const files = orientation === 'white' ? ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'] : ['h', 'g', 'f', 'e', 'd', 'c', 'b', 'a'];
  const ranks = orientation === 'white' ? ['8', '7', '6', '5', '4', '3', '2', '1'] : ['1', '2', '3', '4', '5', '6', '7', '8'];

  // Check if king is in check
  const inCheck = chess.inCheck();
  let checkedKingSquare: Square | null = null;
  if (inCheck) {
    const turn = chess.turn();
    const board = chess.board();
    for (let r = 0; r < 8; r++) {
      for (let c = 0; c < 8; c++) {
        const piece = board[r][c];
        if (piece && piece.type === 'k' && piece.color === turn) {
          const file = String.fromCharCode('a'.charCodeAt(0) + c);
          const rank = (8 - r).toString();
          checkedKingSquare = `${file}${rank}` as Square;
        }
      }
    }
  }

  // Get legal moves from a square
  const getMovesForSquare = useCallback(
    (sq: Square): Move[] => {
      try {
        return chess.moves({ square: sq, verbose: true });
      } catch {
        return [];
      }
    },
    [chess]
  );

  // Clear selections when board changes
  useEffect(() => {
    setSelectedSquare(null);
    setLegalMoves([]);
    setPendingPromotion(null);
  }, [chess]);

  // Handle square click
  const handleSquareClick = (square: Square) => {
    if (!isInteractive) return;

    // If there is already a square selected
    if (selectedSquare) {
      if (selectedSquare === square) {
        // Deselect
        setSelectedSquare(null);
        setLegalMoves([]);
        return;
      }

      // Check if clicked square is a valid target
      const matchMove = legalMoves.find((m) => m.to === square);
      if (matchMove) {
        executeMove(selectedSquare, square, matchMove);
        return;
      }
    }

    // Select piece if it belongs to active turn
    const piece = chess.get(square);
    if (piece && piece.color === chess.turn()) {
      setSelectedSquare(square);
      setLegalMoves(getMovesForSquare(square));
      sounds.playClick();
    } else {
      setSelectedSquare(null);
      setLegalMoves([]);
    }
  };

  // Execute or check for promotion
  const executeMove = (from: Square, to: Square, moveObj?: Move) => {
    const piece = chess.get(from);
    if (!piece) return;

    // Check if it's a promotion
    const isPawn = piece.type === 'p';
    const targetRank = to[1];
    const isPromotion = isPawn && ((piece.color === 'w' && targetRank === '8') || (piece.color === 'b' && targetRank === '1'));

    if (isPromotion) {
      setPendingPromotion({ from, to });
      return;
    }

    if (onMove) {
      onMove({ from, to });
    }

    setSelectedSquare(null);
    setLegalMoves([]);
  };

  const handlePromotionSelect = (promotionType: 'q' | 'r' | 'b' | 'n') => {
    if (!pendingPromotion) return;
    if (onMove) {
      onMove({
        from: pendingPromotion.from,
        to: pendingPromotion.to,
        promotion: promotionType,
      });
    }
    setPendingPromotion(null);
    setSelectedSquare(null);
    setLegalMoves([]);
  };

  // Drag and drop handlers
  const handleDragStart = (e: React.DragEvent, square: Square) => {
    if (!isInteractive) return;
    const piece = chess.get(square);
    if (!piece || piece.color !== chess.turn()) {
      e.preventDefault();
      return;
    }

    setDraggedSquare(square);
    setSelectedSquare(square);
    setLegalMoves(getMovesForSquare(square));
    e.dataTransfer.setData('text/plain', square);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  };

  const handleDrop = (e: React.DragEvent, targetSquare: Square) => {
    e.preventDefault();
    if (!draggedSquare) return;

    const source = draggedSquare;
    setDraggedSquare(null);

    const matchMove = getMovesForSquare(source).find((m) => m.to === targetSquare);
    if (matchMove) {
      executeMove(source, targetSquare, matchMove);
    } else {
      setSelectedSquare(null);
      setLegalMoves([]);
    }
  };

  // SVG Arrow coordinates calculation
  const getSquareCoordinates = (square: string) => {
    const file = square[0];
    const rank = square[1];
    const colIdx = files.indexOf(file);
    const rowIdx = ranks.indexOf(rank);
    if (colIdx === -1 || rowIdx === -1) return null;
    return {
      x: (colIdx + 0.5) * 12.5, // 100% / 8 = 12.5%
      y: (rowIdx + 0.5) * 12.5,
    };
  };

  return (
    <div className="relative select-none w-full max-w-[560px] aspect-square rounded-xl overflow-hidden shadow-2xl border border-zinc-800 bg-[#141519]">
      <div
        ref={boardRef}
        className="grid grid-cols-8 grid-rows-8 w-full h-full relative"
      >
        {ranks.map((rank, rIdx) =>
          files.map((file, fIdx) => {
            const square = `${file}${rank}` as Square;
            const piece = chess.get(square);
            const isLight = (fIdx + rIdx) % 2 === 0;

            const isSelected = selectedSquare === square;
            const isLastMove = lastMove && (lastMove.from === square || lastMove.to === square);
            const isCheckedKing = checkedKingSquare === square;

            const legalMove = legalMoves.find((m) => m.to === square);
            const isLegalTarget = Boolean(legalMove);
            const isCapture = Boolean(piece && isLegalTarget);

            const customHighlight = highlightSquares[square];

            return (
              <div
                key={square}
                onClick={() => handleSquareClick(square)}
                onDragOver={handleDragOver}
                onDrop={(e) => handleDrop(e, square)}
                style={{
                  backgroundColor: isLight ? colors.light : colors.dark,
                }}
                className={`relative flex items-center justify-center cursor-pointer transition-colors duration-150 ${
                  isSelected ? 'brightness-110 ring-2 ring-emerald-400/80 inset-0 z-10' : ''
                }`}
              >
                {/* Last move indicator tint */}
                {isLastMove && (
                  <div className="absolute inset-0 bg-yellow-400/30 pointer-events-none mix-blend-multiply" />
                )}

                {/* Checked king highlight */}
                {isCheckedKing && (
                  <div className="absolute inset-0 bg-red-600/50 rounded-full animate-pulse pointer-events-none" />
                )}

                {/* Custom highlight (e.g. from analysis) */}
                {customHighlight && (
                  <div className={`absolute inset-0 pointer-events-none ${customHighlight}`} />
                )}

                {/* Rank & File Coordinates */}
                {showCoordinates && (
                  <>
                    {fIdx === 0 && (
                      <span
                        style={{ color: isLight ? colors.lightText : colors.darkText }}
                        className="absolute top-1 left-1.5 text-[11px] font-bold pointer-events-none select-none opacity-80"
                      >
                        {rank}
                      </span>
                    )}
                    {rIdx === 7 && (
                      <span
                        style={{ color: isLight ? colors.lightText : colors.darkText }}
                        className="absolute bottom-1 right-1.5 text-[11px] font-bold pointer-events-none select-none opacity-80"
                      >
                        {file}
                      </span>
                    )}
                  </>
                )}

                {/* Chess piece */}
                {piece && (
                  <div
                    draggable={isInteractive && piece.color === chess.turn()}
                    onDragStart={(e) => handleDragStart(e, square)}
                    className="w-[82%] h-[82%] z-10 flex items-center justify-center active:scale-95 transition-transform"
                  >
                    <Piece type={piece.type} color={piece.color} />
                  </div>
                )}

                {/* Legal Move Dot or Capture Ring */}
                {isLegalTarget && (
                  <div className="absolute inset-0 flex items-center justify-center z-20 pointer-events-none">
                    {isCapture ? (
                      <div className="w-[85%] h-[85%] rounded-full border-4 border-black/20 dark:border-black/30" />
                    ) : (
                      <div className="w-[28%] h-[28%] rounded-full bg-black/20 dark:bg-black/25" />
                    )}
                  </div>
                )}
              </div>
            );
          })
        )}

        {/* Engine Best Move Arrow Overlay */}
        {bestMoveArrow && (
          <svg className="absolute inset-0 w-full h-full pointer-events-none z-30" viewBox="0 0 100 100">
            <defs>
              <marker
                id="arrowhead-emerald"
                markerWidth="6"
                markerHeight="6"
                refX="4.5"
                refY="3"
                orient="auto"
              >
                <path d="M 0,0 L 6,3 L 0,6 z" fill="#10b981" />
              </marker>
            </defs>
            {(() => {
              const fromCoord = getSquareCoordinates(bestMoveArrow.from);
              const toCoord = getSquareCoordinates(bestMoveArrow.to);
              if (!fromCoord || !toCoord) return null;

              return (
                <line
                  x1={fromCoord.x}
                  y1={fromCoord.y}
                  x2={toCoord.x}
                  y2={toCoord.y}
                  stroke="#10b981"
                  strokeWidth="2.8"
                  strokeLinecap="round"
                  opacity="0.85"
                  markerEnd="url(#arrowhead-emerald)"
                />
              );
            })()}
          </svg>
        )}
      </div>

      {/* Pawn Promotion Dialog Modal */}
      {pendingPromotion && (
        <div className="absolute inset-0 bg-black/70 backdrop-blur-xs flex items-center justify-center z-50 p-4">
          <div className="bg-[#1c1d22] border border-zinc-700 rounded-xl p-4 shadow-2xl flex flex-col items-center">
            <div className="text-sm font-semibold text-zinc-200 mb-3">Choose Promotion Piece</div>
            <div className="flex gap-2">
              {(['q', 'n', 'r', 'b'] as const).map((pieceType) => {
                const isWhite = chess.turn() === 'w';
                return (
                  <button
                    key={pieceType}
                    onClick={() => handlePromotionSelect(pieceType)}
                    className="w-14 h-14 bg-zinc-800 hover:bg-emerald-600/30 hover:border-emerald-500 border border-zinc-700 rounded-lg p-2 flex items-center justify-center transition-all cursor-pointer"
                  >
                    <Piece type={pieceType} color={isWhite ? 'w' : 'b'} />
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
