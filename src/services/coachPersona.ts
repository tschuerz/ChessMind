import { Chess, Square } from 'chess.js';
import { CoachPersonaId, MoveClassification } from '../types/chess';
import { stockfish } from './stockfish';

export interface CoachPersona {
  id: CoachPersonaId;
  name: string;
  title: string;
  avatarColor: string;
  badge: string;
  description: string;
  tagline: string;
  voicePitch: number;
  voiceRate: number;
}

export const COACH_PERSONAS: CoachPersona[] = [
  {
    id: 'friendly',
    name: 'Friendly Coach',
    title: 'Encouraging & Patient',
    avatarColor: 'from-emerald-500 to-teal-700',
    badge: 'Friendly',
    description: 'Patient mentor who encourages your effort, builds confidence, and explains concepts simply without harsh criticism.',
    tagline: '“Every game is a step forward. Let’s have fun and spot the tactics together!”',
    voicePitch: 1.15,
    voiceRate: 1.0,
  },
  {
    id: 'strict',
    name: 'Strict Coach',
    title: 'Direct & Demanding',
    avatarColor: 'from-amber-600 to-red-800',
    badge: 'Strict',
    description: 'Disciplined classical veteran who holds you to a high standard, ruthlessly flags free pieces, and demands deep calculation.',
    tagline: '“No free gifts for your opponent. Calculate twice, move once, and eliminate blunders.”',
    voicePitch: 0.85,
    voiceRate: 0.95,
  },
  {
    id: 'analytical',
    name: 'Analytical Coach',
    title: 'Grandmaster Tactician',
    avatarColor: 'from-blue-600 to-indigo-800',
    badge: 'GM',
    description: 'Deep positional strategist providing concrete variations, pawn-structure analysis, piece harmony, and grandmaster terminology.',
    tagline: '“Chess is a game of small edges. Optimize piece coordination and seize the initiative.”',
    voicePitch: 1.0,
    voiceRate: 1.0,
  },
  {
    id: 'beginner',
    name: 'Beginner Coach',
    title: 'Fundamentals & Principles',
    avatarColor: 'from-sky-400 to-cyan-600',
    badge: 'Basics',
    description: 'Warm guide focused strictly on core fundamentals: controlling the center, developing knights and bishops, and protecting the king.',
    tagline: '“Keep it simple: center control, quick development, and keep your king safe!”',
    voicePitch: 1.2,
    voiceRate: 1.0,
  },
];

// Helper to normalize legacy persona IDs
export function resolveCoachPersona(personaId?: CoachPersonaId): CoachPersona {
  if (!personaId) return COACH_PERSONAS[0];
  const found = COACH_PERSONAS.find((p) => p.id === personaId);
  if (found) return found;

  // Legacy mappings
  if (personaId === 'lily') return COACH_PERSONAS[0];
  if (personaId === 'viktor' || personaId === 'sasha') return COACH_PERSONAS[1];
  if (personaId === 'nolan' || personaId === 'magnus') return COACH_PERSONAS[2];

  return COACH_PERSONAS[0];
}

// Speech Synthesizer for Coach Voices
class CoachVoiceService {
  private isEnabled: boolean = true;

  public setEnabled(enabled: boolean) {
    this.isEnabled = enabled;
    if (!enabled && typeof window !== 'undefined' && window.speechSynthesis) {
      window.speechSynthesis.cancel();
    }
  }

  public speak(text: string, personaId: CoachPersonaId = 'friendly') {
    if (!this.isEnabled || typeof window === 'undefined' || !window.speechSynthesis) return;

    try {
      window.speechSynthesis.cancel();

      // Clean text of technical notation symbols for speech
      const cleanText = text
        .replace(/\b([a-h])([1-8])\b/g, '$1 $2')
        .replace(/O-O-O/g, 'queenside castle')
        .replace(/O-O/g, 'kingside castle')
        .replace(/\+/g, ' check')
        .replace(/#/g, ' checkmate');

      const utterance = new SpeechSynthesisUtterance(cleanText);
      const persona = resolveCoachPersona(personaId);

      utterance.pitch = persona.voicePitch;
      utterance.rate = persona.voiceRate;

      const voices = window.speechSynthesis.getVoices();
      const englishVoice = voices.find(
        (v) =>
          v.lang.startsWith('en') &&
          (v.name.includes('Natural') ||
            v.name.includes('Online') ||
            v.name.includes('Google') ||
            v.name.includes('Samantha') ||
            v.name.includes('Daniel') ||
            v.name.includes('Alex'))
      );

      if (englishVoice) {
        utterance.voice = englishVoice;
      }

      window.speechSynthesis.speak(utterance);
    } catch {
      // Speech synthesis failure handled gracefully
    }
  }

  public stop() {
    if (typeof window !== 'undefined' && window.speechSynthesis) {
      window.speechSynthesis.cancel();
    }
  }
}

export const coachVoice = new CoachVoiceService();

// Dynamic Coach commentary generator tailored by persona
export function generateCoachComment(
  moveSan: string,
  classification: MoveClassification,
  centipawnLoss: number,
  bestMoveSan: string,
  personaId: CoachPersonaId,
  isPlayerMove: boolean
): string {
  const p = resolveCoachPersona(personaId);

  if (!isPlayerMove) {
    // Comment on opponent move
    if (classification === 'blunder') {
      if (p.id === 'strict') {
        return `Stockfish just blundered with ${moveSan}! A major oversight. Punish them immediately!`;
      }
      if (p.id === 'analytical') {
        return `Stockfish made a tactical blunder with ${moveSan}. An anchor was severed—look for the tactical refutation.`;
      }
      if (p.id === 'beginner') {
        return `Stockfish left a piece undefended with ${moveSan}! Can you spot what you can capture?`;
      }
      return `Look! Stockfish slipped up with ${moveSan}! You have a great tactical opportunity right now.`;
    }

    if (classification === 'mistake') {
      if (p.id === 'strict') {
        return `Stockfish played an imprecise move (${moveSan}). Push your advantage and don't let them stabilize.`;
      }
      if (p.id === 'analytical') {
        return `Stockfish's ${moveSan} weakens their pawn structure. Identify the square they surrendered.`;
      }
      return `Stockfish made a small mistake with ${moveSan}. Look for how to contest their pieces.`;
    }

    // Normal opponent move
    if (p.id === 'strict') {
      return `Stockfish played ${moveSan}. Check their threats: what squares are attacked? Don't leave anything loose.`;
    }
    if (p.id === 'analytical') {
      return `Stockfish played ${moveSan}, shifting piece tension. Evaluate their tactical idea and formulate your plan.`;
    }
    if (p.id === 'beginner') {
      return `Your opponent played ${moveSan}. Check if any of your pieces are in danger before you choose your move.`;
    }
    return `Your opponent has just played ${moveSan}. Consider how you want to respond to their plan!`;
  }

  // Comments for player moves
  switch (classification) {
    case 'brilliant':
      if (p.id === 'strict') {
        return `A genuine grandmaster sacrifice with ${moveSan}! Decisive calculation. Keep your concentration.`;
      }
      if (p.id === 'analytical') {
        return `Brilliant tactical breakthrough! ${moveSan} offers material to completely overwhelm their defensive coordination.`;
      }
      if (p.id === 'beginner') {
        return `WOW! ${moveSan} is a brilliant move! Sacrificing that piece gives you a massive advantage!`;
      }
      return `Incredible move! ${moveSan} is a brilliant tactical sacrifice that opens up the win!`;

    case 'great':
    case 'best':
      if (p.id === 'strict') {
        return `Disciplined choice. ${moveSan} is the exact line of precision. Maintain this focus.`;
      }
      if (p.id === 'analytical') {
        return `Best move! ${moveSan} maximizes piece activity and holds the highest engine evaluation.`;
      }
      if (p.id === 'beginner') {
        return `Awesome move! ${moveSan} is the engine's favorite! You're following solid principles!`;
      }
      return `Nice move! ${moveSan} controls key squares and maintains your positional advantage.`;

    case 'excellent':
    case 'good':
      if (p.id === 'strict') {
        return `Solid enough with ${moveSan}, though ${bestMoveSan} had slightly sharper tactical venom.`;
      }
      if (p.id === 'analytical') {
        return `${moveSan} is sound. It preserves piece coordination across the board.`;
      }
      if (p.id === 'beginner') {
        return `Good job! ${moveSan} keeps your pieces active and protected.`;
      }
      return `Good move! ${moveSan} keeps your position healthy and develops your game plan.`;

    case 'book':
      return `${moveSan} is standard opening book theory. Smooth development so far.`;

    case 'inaccuracy':
      if (p.id === 'strict') {
        return `Passive play! ${moveSan} wastes tempo. The engine preferred ${bestMoveSan} to maintain central pressure.`;
      }
      if (p.id === 'analytical') {
        return `An inaccuracy. ${moveSan} concedes minor counterplay. ${bestMoveSan} maintained cleaner control.`;
      }
      if (p.id === 'beginner') {
        return `Careful! ${moveSan} is a bit hesitant. ${bestMoveSan} was a stronger way to improve your pieces.`;
      }
      return `A slight inaccuracy. ${moveSan} allowed your opponent some breathing room. ${bestMoveSan} was sharper.`;

    case 'mistake':
      if (p.id === 'strict') {
        return `Mistake! Why play ${moveSan}? You surrendered central initiative when ${bestMoveSan} was available.`;
      }
      if (p.id === 'analytical') {
        return `Mistake. ${moveSan} creates tactical complications. The engine required ${bestMoveSan} to hold the advantage.`;
      }
      if (p.id === 'beginner') {
        return `Oops! ${moveSan} gave away some ground. Try to spot how ${bestMoveSan} would have protected your side.`;
      }
      return `That move slips a bit. ${moveSan} conceded an opportunity that ${bestMoveSan} would have capitalized on.`;

    case 'blunder':
      if (p.id === 'strict') {
        return `Catastrophic blunder! ${moveSan} drops material or compromises king shelter! Calculate before you move!`;
      }
      if (p.id === 'analytical') {
        return `Major blunder with ${moveSan}, swinging the game evaluation. ${bestMoveSan} was vital for defense.`;
      }
      if (p.id === 'beginner') {
        return `Oh no! ${moveSan} left a piece or your king vulnerable! Remember to always check what's attacked!`;
      }
      return `That move overlooks a tactical threat. ${moveSan} allows your opponent a strong counter-strike.`;

    default:
      return `${moveSan} is played. Watch how the position evolves.`;
  }
}

// Generate positional breakdown explanation for "Explain Position" button
export function explainCurrentPosition(chess: Chess, coachId: CoachPersonaId): string {
  const p = resolveCoachPersona(coachId);
  const turn = chess.turn() === 'w' ? 'White' : 'Black';
  const evalScore = stockfish.evaluatePositionSync(chess);
  const evalPawns = (evalScore / 100).toFixed(1);
  const advantageText =
    Math.abs(evalScore) < 40
      ? 'The position is roughly balanced.'
      : evalScore > 0
      ? `White has an advantage of approximately +${evalPawns} pawns.`
      : `Black has an advantage of approximately ${evalPawns} pawns.`;

  // Check center occupancy
  const centerSquares = ['e4', 'd4', 'e5', 'd5'] as Square[];
  const whiteCenter = centerSquares.filter((sq) => chess.get(sq)?.color === 'w').length;
  const blackCenter = centerSquares.filter((sq) => chess.get(sq)?.color === 'b').length;

  let centerAssessment = '';
  if (whiteCenter > blackCenter) centerAssessment = 'White controls more of the central squares.';
  else if (blackCenter > whiteCenter) centerAssessment = 'Black is asserting greater central pawn presence.';
  else centerAssessment = 'Control of the central squares is contested evenly.';

  // Check king safety
  const inCheck = chess.inCheck();
  let checkWarning = '';
  if (inCheck) {
    checkWarning = ` Important: ${turn}'s king is currently in check!`;
  }

  if (p.id === 'strict') {
    return `${advantageText} ${centerAssessment}${checkWarning} It is ${turn}'s turn. Calculate every forcing move: checks, captures, and threats. Avoid drifting passively.`;
  }

  if (p.id === 'analytical') {
    return `Positional Breakdown: Evaluation: ${evalScore > 0 ? '+' : ''}${evalPawns} cp. ${centerAssessment}${checkWarning} Focus on piece coordination, open files, and exploiting tactical weaknesses on the ${turn === 'White' ? 'Black' : 'White'} side.`;
  }

  if (p.id === 'beginner') {
    return `${advantageText} ${centerAssessment}${checkWarning} It is ${turn}'s turn. Look at all your pieces: are they protected? Can you move a piece toward the center or improve your king's safety?`;
  }

  // Friendly Coach default
  return `${advantageText} ${centerAssessment}${checkWarning} It's ${turn} to move. Take a breath, look across the whole board, and find the move that makes your pieces happiest!`;
}

// Generate last move explanation for "Explain Last Move" button
export function explainLastMoveDetail(
  lastMove: { san: string; from: string; to: string; color: 'w' | 'b' },
  chess: Chess,
  coachId: CoachPersonaId
): string {
  const p = resolveCoachPersona(coachId);
  const bestResult = stockfish.findBestMoveFast(chess);
  const piece = chess.get(lastMove.to as Square);
  const pieceName =
    piece?.type === 'p'
      ? 'pawn'
      : piece?.type === 'n'
      ? 'knight'
      : piece?.type === 'b'
      ? 'bishop'
      : piece?.type === 'r'
      ? 'rook'
      : piece?.type === 'q'
      ? 'queen'
      : 'king';

  const isCastle = lastMove.san.includes('O-O');
  const isCapture = lastMove.san.includes('x');
  const isCheck = lastMove.san.includes('+');

  let intent = '';
  if (isCastle) {
    intent = `castles the king to safety and activates the rook toward the central files.`;
  } else if (isCapture) {
    intent = `executes a tactical capture on ${lastMove.to.toUpperCase()}, altering material and pawn structure.`;
  } else if (isCheck) {
    intent = `delivers a direct check, forcing the defending side to immediately address the king.`;
  } else {
    intent = `mobilizes the ${pieceName} from ${lastMove.from.toUpperCase()} to ${lastMove.to.toUpperCase()}, influencing key squares.`;
  }

  if (p.id === 'strict') {
    return `Move Analysis: ${lastMove.san} ${intent} Engine recommendation was ${bestResult?.san || 'similar'}. Always evaluate if this move left any square or piece unguarded.`;
  }

  if (p.id === 'analytical') {
    return `Tactical Intent: ${lastMove.san} ${intent} The engine considers ${bestResult?.san || lastMove.san} as top candidate. Examine how lines of sight for bishops and rooks were altered.`;
  }

  if (p.id === 'beginner') {
    return `The move was ${lastMove.san}: this ${intent} Keep in mind how moving this piece changes which squares are protected!`;
  }

  return `Last move: ${lastMove.san}. This ${intent} A solid tactical idea to keep your pieces coordinating well together!`;
}

// Offline Question-Answering for Coach Chat during games
export function answerCoachQuestionOffline(
  question: string,
  chess: Chess,
  lastMove: { san: string; from: string; to: string } | null,
  coachId: CoachPersonaId
): string {
  const p = resolveCoachPersona(coachId);
  const q = question.toLowerCase().trim();
  const turn = chess.turn() === 'w' ? 'White' : 'Black';
  const evalScore = stockfish.evaluatePositionSync(chess);
  const evalPawns = (evalScore / 100).toFixed(1);

  // 1. Is my king safe?
  if (q.includes('king') && (q.includes('safe') || q.includes('danger') || q.includes('attack'))) {
    if (chess.inCheck()) {
      return p.id === 'strict'
        ? `Alert! Your king is currently in check! You must eliminate the check by capturing the attacker, blocking, or moving your king.`
        : `Your king is in check right now! Protecting your king is top priority.`;
    }
    return p.id === 'strict'
      ? `Your king is not in check, but look at the pawn shield in front of it. Ensure no enemy piece can infiltrate the back rank.`
      : `Your king is currently safe from direct checks. Keep your castled pawn shield intact and don't push pawns in front of your king unnecessarily!`;
  }

  // 2. Who is winning / what is the evaluation?
  if (q.includes('who is winning') || q.includes('eval') || q.includes('advantage') || q.includes('winning')) {
    if (Math.abs(evalScore) < 50) {
      return `The game is roughly even (${evalScore > 0 ? '+' : ''}${evalPawns} pawns). Both sides have equal tactical chances.`;
    }
    const leader = evalScore > 0 ? 'White' : 'Black';
    return `${leader} holds the advantage (${evalScore > 0 ? '+' : ''}${evalPawns} pawns). Look to maintain piece coordination to convert this position.`;
  }

  // 3. Are any of my pieces hanging / in danger?
  if (q.includes('hanging') || q.includes('danger') || q.includes('undefended') || q.includes('threat')) {
    return p.id === 'strict'
      ? `Scan all your pieces systematically: Queen, rooks, minor pieces, and pawns. Count how many enemy pieces attack each square versus how many friendlies defend it.`
      : `Good question! Take a look at your knights and bishops: make sure each piece has at least one friendly pawn or piece defending it so it cannot be captured for free.`;
  }

  // 4. What should my plan be?
  if (q.includes('plan') || q.includes('what should i do') || q.includes('next move') || q.includes('idea')) {
    const bestMove = stockfish.findBestMoveFast(chess);
    if (p.id === 'beginner') {
      return `Our general plan: 1. Develop any remaining knights or bishops, 2. Castle your king to safety, 3. Connect your rooks on open files!`;
    }
    return p.id === 'analytical'
      ? `Strategic Plan: Control the central open files, restrict opponent knight outposts, and prepare pawn breaks. The engine likes the idea behind ${bestMove?.san ? bestMove.san : 'improving your worst-placed piece'}.`
      : `Focus on activating your least active piece and putting pressure on the center. Look for squares where your pieces have maximum scope!`;
  }

  // Generic chess coach answer
  return p.id === 'strict'
    ? `In this position, evaluation is ${evalScore > 0 ? '+' : ''}${evalPawns}. Focus on your candidate moves, calculate captures and checks, and do not play without purpose.`
    : `We have an interesting game! The current evaluation is ${evalScore > 0 ? '+' : ''}${evalPawns}. Look at which of your pieces is doing the least work and find an active square for it!`;
}
