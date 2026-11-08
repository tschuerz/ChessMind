import React from 'react';

interface PieceProps {
  type: 'p' | 'n' | 'b' | 'r' | 'q' | 'k';
  color: 'w' | 'b';
  className?: string;
}

export const Piece: React.FC<PieceProps> = ({ type, color, className = 'w-full h-full' }) => {
  const src = `/pieces/${color}_${type}.png`;

  return (
    <img
      src={src}
      alt={`${color === 'w' ? 'White' : 'Black'} ${type}`}
      className={`${className} object-contain select-none pointer-events-none drop-shadow-sm`}
      draggable={false}
      loading="eager"
    />
  );
};
