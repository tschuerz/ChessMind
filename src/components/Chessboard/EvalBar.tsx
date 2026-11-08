import React from 'react';
import { PlayerColor } from '../../types/chess';

interface EvalBarProps {
  scoreCp: number; // Centipawns from White's perspective (+ = White, - = Black)
  orientation?: PlayerColor;
  displayEval?: string;
}

export const EvalBar: React.FC<EvalBarProps> = ({ scoreCp, orientation = 'white', displayEval }) => {
  // Convert centipawns to percentage (0% to 100% for White)
  // Win probability sigmoid formula: P(White) = 1 / (1 + 10^(-scoreCp / 400))
  let whitePercent = 50;

  if (Math.abs(scoreCp) >= 9000) {
    whitePercent = scoreCp > 0 ? 100 : 0;
  } else {
    // Sigmoid mapping: 0 cp -> 50%, +500 cp -> ~95%, -500 cp -> ~5%
    const winChance = 100 / (1 + Math.exp(-0.003682 * scoreCp));
    whitePercent = Math.max(3, Math.min(97, winChance));
  }

  // If orientation is Black, invert the bar visually so Black's pieces are at bottom
  const fillBottomPercent = orientation === 'white' ? whitePercent : 100 - whitePercent;

  const displayText =
    displayEval ||
    (Math.abs(scoreCp) >= 9000
      ? scoreCp > 0
        ? `M${Math.ceil((10000 - Math.abs(scoreCp)) / 100)}`
        : `-M${Math.ceil((10000 - Math.abs(scoreCp)) / 100)}`
      : `${scoreCp >= 0 ? '+' : ''}${(scoreCp / 100).toFixed(1)}`);

  return (
    <div className="relative w-7 h-full rounded-md overflow-hidden bg-[#27272a] border border-zinc-800 flex flex-col justify-end shadow-inner select-none">
      {/* White advantage bar */}
      <div
        className="w-full bg-[#f4f4f5] transition-all duration-300 ease-out"
        style={{ height: `${fillBottomPercent}%` }}
      />

      {/* Numerical score label */}
      <div className="absolute inset-x-0 bottom-2 text-center text-[10px] font-mono font-bold text-zinc-900 pointer-events-none z-10 drop-shadow-xs">
        {fillBottomPercent >= 50 && displayText}
      </div>
      <div className="absolute inset-x-0 top-2 text-center text-[10px] font-mono font-bold text-zinc-100 pointer-events-none z-10 drop-shadow-xs">
        {fillBottomPercent < 50 && displayText}
      </div>
    </div>
  );
};
