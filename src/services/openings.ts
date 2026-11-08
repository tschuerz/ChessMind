interface OpeningEntry {
  eco: string;
  name: string;
  moves: string[]; // in UCI or SAN
}

const OPENINGS: OpeningEntry[] = [
  // King's Pawn Openings
  { eco: 'B90', name: 'Sicilian Defense: Najdorf Variation', moves: ['e4', 'c5', 'Nf3', 'd6', 'd4', 'cxd4', 'Nxd4', 'Nf6', 'Nc3', 'a6'] },
  { eco: 'B20', name: 'Sicilian Defense', moves: ['e4', 'c5'] },
  { eco: 'B21', name: 'Sicilian Defense: Smith-Morra Gambit', moves: ['e4', 'c5', 'd4', 'cxd4', 'c3'] },
  { eco: 'B30', name: 'Sicilian Defense: Old Sicilian', moves: ['e4', 'c5', 'Nf3', 'Nc6'] },
  { eco: 'C50', name: 'Italian Game', moves: ['e4', 'e5', 'Nf3', 'Nc6', 'Bc4'] },
  { eco: 'C51', name: 'Evans Gambit', moves: ['e4', 'e5', 'Nf3', 'Nc6', 'Bc4', 'Bc5', 'b4'] },
  { eco: 'C55', name: 'Two Knights Defense', moves: ['e4', 'e5', 'Nf3', 'Nc6', 'Bc4', 'Nf6'] },
  { eco: 'C60', name: 'Ruy Lopez', moves: ['e4', 'e5', 'Nf3', 'Nc6', 'Bb5'] },
  { eco: 'C65', name: 'Ruy Lopez: Berlin Defense', moves: ['e4', 'e5', 'Nf3', 'Nc6', 'Bb5', 'Nf6'] },
  { eco: 'C70', name: 'Ruy Lopez: Morphy Defense', moves: ['e4', 'e5', 'Nf3', 'Nc6', 'Bb5', 'a6'] },
  { eco: 'C00', name: 'French Defense', moves: ['e4', 'e6'] },
  { eco: 'C02', name: 'French Defense: Advance Variation', moves: ['e4', 'e6', 'd4', 'd5', 'e5'] },
  { eco: 'C10', name: 'French Defense: Paulsen Variation', moves: ['e4', 'e6', 'd4', 'd5', 'Nc3'] },
  { eco: 'B10', name: 'Caro-Kann Defense', moves: ['e4', 'c6'] },
  { eco: 'B12', name: 'Caro-Kann Defense: Advance Variation', moves: ['e4', 'c6', 'd4', 'd5', 'e5'] },
  { eco: 'B01', name: 'Scandinavian Defense', moves: ['e4', 'd5'] },
  { eco: 'B07', name: 'Pirc Defense', moves: ['e4', 'd6', 'd4', 'Nf6'] },
  { eco: 'B02', name: "Alekhine's Defense", moves: ['e4', 'Nf6'] },
  { eco: 'C42', name: 'Petrov Defense', moves: ['e4', 'e5', 'Nf3', 'Nf6'] },
  { eco: 'C45', name: 'Scotch Game', moves: ['e4', 'e5', 'Nf3', 'Nc6', 'd4'] },
  { eco: 'C40', name: "King's Knight Opening", moves: ['e4', 'e5', 'Nf3'] },
  { eco: 'C20', name: "King's Pawn Game", moves: ['e4', 'e5'] },
  { eco: 'B00', name: "King's Pawn Opening", moves: ['e4'] },

  // Queen's Pawn Openings
  { eco: 'D30', name: "Queen's Gambit Declined", moves: ['d4', 'd5', 'c4', 'e6'] },
  { eco: 'D20', name: "Queen's Gambit Accepted", moves: ['d4', 'd5', 'c4', 'dxc4'] },
  { eco: 'D02', name: 'London System', moves: ['d4', 'd5', 'Nf3', 'Nf6', 'Bf4'] },
  { eco: 'D00', name: "Queen's Pawn: Mason Attack", moves: ['d4', 'd5', 'Bf4'] },
  { eco: 'D06', name: "Queen's Gambit", moves: ['d4', 'd5', 'c4'] },
  { eco: 'E60', name: "King's Indian Defense", moves: ['d4', 'Nf6', 'c4', 'g6'] },
  { eco: 'E20', name: 'Nimzo-Indian Defense', moves: ['d4', 'Nf6', 'c4', 'e6', 'Nc3', 'Bb4'] },
  { eco: 'A56', name: 'Benoni Defense', moves: ['d4', 'Nf6', 'c4', 'c5'] },
  { eco: 'D80', name: 'Grünfeld Defense', moves: ['d4', 'Nf6', 'c4', 'g6', 'Nc3', 'd5'] },
  { eco: 'A80', name: 'Dutch Defense', moves: ['d4', 'f5'] },
  { eco: 'D00', name: "Queen's Pawn Game", moves: ['d4', 'd5'] },
  { eco: 'A40', name: "Queen's Pawn Opening", moves: ['d4'] },

  // Flank & Other Openings
  { eco: 'A10', name: 'English Opening', moves: ['c4'] },
  { eco: 'A04', name: 'Réti Opening', moves: ['Nf3'] },
  { eco: 'A00', name: "Bird's Opening", moves: ['f4'] },
  { eco: 'B06', name: 'Modern Defense', moves: ['e4', 'g6'] },
];

export function identifyOpening(moveListSans: string[]): { name: string; eco: string } {
  if (!moveListSans || moveListSans.length === 0) {
    return { name: 'Standard Opening', eco: 'A00' };
  }

  // Find the longest matching opening sequence
  let bestMatch: OpeningEntry | null = null;
  let maxMatchedMoves = 0;

  for (const opening of OPENINGS) {
    if (opening.moves.length <= moveListSans.length) {
      let matches = true;
      for (let i = 0; i < opening.moves.length; i++) {
        // Strip check / mate markers for comparison
        const m1 = moveListSans[i].replace(/[+#]/g, '');
        const m2 = opening.moves[i].replace(/[+#]/g, '');
        if (m1 !== m2) {
          matches = false;
          break;
        }
      }

      if (matches && opening.moves.length > maxMatchedMoves) {
        maxMatchedMoves = opening.moves.length;
        bestMatch = opening;
      }
    }
  }

  if (bestMatch) {
    return { name: bestMatch.name, eco: bestMatch.eco };
  }

  return { name: 'Open Chess Game', eco: 'A00' };
}
