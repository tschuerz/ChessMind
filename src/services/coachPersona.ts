import { Chess, Square } from 'chess.js';
import { CoachPersonaId, MoveClassification } from '../types/chess';

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
    id: 'nolan',
    name: 'Coach Nolan',
    title: 'Grandmaster Mentor',
    avatarColor: 'from-emerald-500 to-teal-700',
    badge: 'GM',
    description: 'Patient classical master who explains chess through clarity, sound strategy, and safety.',
    tagline: '“Master the fundamentals, and victory follows naturally.”',
    voicePitch: 1.0,
    voiceRate: 1.0,
  },
  {
    id: 'sasha',
    name: 'Coach Sasha',
    title: 'Aggressive Tactician',
    avatarColor: 'from-rose-500 to-orange-600',
    badge: 'IM',
    description: 'Sharp, dynamic attacker who loves sacrifices, king hunts, and punishing passive play.',
    tagline: '“Never retreat when you can attack!”',
    voicePitch: 1.1,
    voiceRate: 1.05,
  },
  {
    id: 'viktor',
    name: 'Coach Viktor',
    title: 'Strict Russian Master',
    avatarColor: 'from-amber-600 to-red-800',
    badge: 'FM',
    description: 'Tough-love veteran who hates hanging pieces and demands disciplined calculation.',
    tagline: '“Why give away a piece for free? Calculate twice, move once.”',
    voicePitch: 0.85,
    voiceRate: 0.95,
  },
  {
    id: 'lily',
    name: 'Coach Lily',
    title: 'Friendly Beginner Pal',
    avatarColor: 'from-sky-400 to-indigo-600',
    badge: 'Coach',
    description: 'Warm and encouraging coach who breaks concepts into simple everyday analogies.',
    tagline: '“Great effort! Let’s spot the fun tactics together!”',
    voicePitch: 1.25,
    voiceRate: 1.05,
  },
  {
    id: 'magnus',
    name: 'Magnus Bot',
    title: 'Endgame Virtuoso',
    avatarColor: 'from-purple-500 to-blue-700',
    badge: 'WCh',
    description: 'Calm, pragmatic genius who grinds out small advantages and converts relentlessly.',
    tagline: '“Every tiny positional edge can be squeezed into a win.”',
    voicePitch: 0.95,
    voiceRate: 1.0,
  },
];

// Speech Synthesizer for Coach Voices
class CoachVoiceService {
  private isEnabled: boolean = true;

  public setEnabled(enabled: boolean) {
    this.isEnabled = enabled;
    if (!enabled && typeof window !== 'undefined' && window.speechSynthesis) {
      window.speechSynthesis.cancel();
    }
  }

  public speak(text: string, personaId: CoachPersonaId = 'nolan') {
    if (!this.isEnabled || typeof window === 'undefined' || !window.speechSynthesis) return;

    try {
      window.speechSynthesis.cancel(); // Cancel any ongoing speech

      // Clean text of technical notation symbols for speech
      const cleanText = text
        .replace(/\b([a-h])([1-8])\b/g, '$1 $2')
        .replace(/O-O-O/g, 'queenside castle')
        .replace(/O-O/g, 'kingside castle')
        .replace(/\+/g, ' check')
        .replace(/#/g, ' checkmate');

      const utterance = new SpeechSynthesisUtterance(cleanText);
      const persona = COACH_PERSONAS.find((p) => p.id === personaId) || COACH_PERSONAS[0];

      utterance.pitch = persona.voicePitch;
      utterance.rate = persona.voiceRate;

      // Select natural English voice if available
      const voices = window.speechSynthesis.getVoices();
      const englishVoice = voices.find(
        (v) =>
          v.lang.startsWith('en') &&
          (v.name.includes('Natural') || v.name.includes('Online') || v.name.includes('Google') || v.name.includes('Samantha') || v.name.includes('Daniel'))
      );

      if (englishVoice) {
        utterance.voice = englishVoice;
      }

      window.speechSynthesis.speak(utterance);
    } catch (e) {
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
  const p = COACH_PERSONAS.find((item) => item.id === personaId) || COACH_PERSONAS[0];

  if (!isPlayerMove) {
    // Comment on opponent move
    if (classification === 'blunder') {
      return p.id === 'sasha'
        ? `Stockfish just blundered with ${moveSan}! Strike now while their guard is down!`
        : p.id === 'viktor'
        ? `Opponent made a grave blunder with ${moveSan}. Punish them without mercy.`
        : p.id === 'lily'
        ? `Look! Stockfish slipped up with ${moveSan}! You have a big opening here!`
        : `Stockfish blundered with ${moveSan}, dropping a critical tactical anchor. Look for the winning continuation.`;
    }
    return `Stockfish played ${moveSan}. Consider what squares they are attacking and find your response.`;
  }

  // Comments for player moves
  switch (classification) {
    case 'brilliant':
      if (p.id === 'sasha') return `INCREDIBLE SACRIFICE! ${moveSan} is pure tactical genius! You blew open their defenses!`;
      if (p.id === 'viktor') return `Hmph. A genuine grandmaster sacrifice with ${moveSan}. Even I am impressed.`;
      if (p.id === 'lily') return `WOW!! ${moveSan} is a BRILLIANT move! That piece sacrifice completely paid off!`;
      if (p.id === 'magnus') return `Brilliant tactical strike with ${moveSan}. The conversion is now in your hands.`;
      return `Brilliant move! You offered a tactical sacrifice with ${moveSan} that guarantees a decisive advantage.`;

    case 'great':
    case 'best':
      if (p.id === 'sasha') return `Perfect move! ${moveSan} maintains the attack and gives the opponent zero breathing room.`;
      if (p.id === 'viktor') return `Good. ${moveSan} is the exact line of discipline. Keep this focus.`;
      if (p.id === 'lily') return `Awesome choice! ${moveSan} is the engine's favorite move! Keep going!`;
      if (p.id === 'magnus') return `Clinical accuracy with ${moveSan}. Clean positional mastery.`;
      return `Best move! ${moveSan} is the most precise way to preserve your strategic initiative.`;

    case 'excellent':
    case 'good':
      if (p.id === 'sasha') return `Solid move with ${moveSan}. Keeps your pieces active and aggressive.`;
      if (p.id === 'lily') return `Nice and safe! ${moveSan} improves your piece activity nicely!`;
      return `Good move. ${moveSan} maintains solid piece coordination across the board.`;

    case 'inaccuracy':
      if (p.id === 'sasha') return `A bit hesitant with ${moveSan}. You could have pushed with ${bestMoveSan} instead.`;
      if (p.id === 'viktor') return `${moveSan} is passive. ${bestMoveSan} was much more active. Don't waste tempos.`;
      if (p.id === 'lily') return `Careful! ${moveSan} is a little imprecise. ${bestMoveSan} kept your pieces happier.`;
      return `A minor inaccuracy. ${moveSan} allowed counterplay. ${bestMoveSan} was cleaner.`;

    case 'mistake':
      if (p.id === 'sasha') return `Mistake! ${moveSan} surrendered the initiative. Look at ${bestMoveSan}—that was the attacking move!`;
      if (p.id === 'viktor') return `Mistake! Why play ${moveSan}? You conceded central squares when ${bestMoveSan} was available.`;
      if (p.id === 'lily') return `Oops! ${moveSan} is a mistake that gave away some ground. ${bestMoveSan} was the trick!`;
      return `Mistake. Playing ${moveSan} allowed tactical complications. The engine preferred ${bestMoveSan}.`;

    case 'blunder':
      if (p.id === 'sasha') return `BLUNDER! You let your guard down with ${moveSan}! Look how ${bestMoveSan} would have kept you winning!`;
      if (p.id === 'viktor') return `Catastrophic blunder! ${moveSan} gives away material! You MUST calculate checks and captures before moving!`;
      if (p.id === 'lily') return `Oh no! ${moveSan} is a blunder—a piece was left vulnerable! Try retrying this to find ${bestMoveSan}!`;
      if (p.id === 'magnus') return `Major blunder with ${moveSan}, swinging the game. ${bestMoveSan} was essential.`;
      return `Blunder. ${moveSan} drops critical material or king shelter. The engine insisted on ${bestMoveSan}.`;

    default:
      return `${moveSan} is a solid opening book continuation.`;
  }
}
