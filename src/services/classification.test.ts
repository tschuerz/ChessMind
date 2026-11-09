import { classifyMoveQuality } from './stockfish';
import { stockfish } from './stockfish';

// Automated verification suite for ChessMind 2.0 Move Classification Engine
function runTests() {
  console.log('--- RUNNING CHESSMIND CLASSIFICATION TESTS ---');
  let passed = 0;
  let failed = 0;

  function assert(condition: boolean, testName: string) {
    if (condition) {
      console.log(`[PASS] ${testName}`);
      passed++;
    } else {
      console.error(`[FAIL] ${testName}`);
      failed++;
    }
  }

  // 1. Best move
  const bestClass = classifyMoveQuality({
    move: { san: 'Nf3', piece: 'n' },
    playedUci: 'g1f3',
    bestUci: 'g1f3',
    centipawnLoss: 0,
    evalBefore: 20,
    evalAfter: 20,
    isWhite: true,
    plyNumber: 12,
  });
  assert(bestClass === 'best', 'Identifies top engine move as best');

  // 2. Book opening move
  const bookClass = classifyMoveQuality({
    move: { san: 'e4', piece: 'p' },
    playedUci: 'e2e4',
    bestUci: 'e2e4',
    centipawnLoss: 0,
    evalBefore: 20,
    evalAfter: 25,
    isWhite: true,
    plyNumber: 1,
  });
  assert(bookClass === 'book', 'Identifies standard opening move as book in early plies');

  // 3. Brilliant move (Knight sacrifice leading to winning attack)
  const brilliantClass = classifyMoveQuality({
    move: { san: 'Nxf7', piece: 'n', captured: 'p' },
    playedUci: 'g5f7',
    bestUci: 'g5f7',
    centipawnLoss: 0,
    evalBefore: 80,
    evalAfter: 350,
    isWhite: true,
    plyNumber: 14,
  });
  assert(brilliantClass === 'brilliant', 'Identifies piece sacrifice leading to winning eval as brilliant');

  // 4. Great move (Only critical saving move in sharp evaluation)
  const greatClass = classifyMoveQuality({
    move: { san: 'Kh1', piece: 'k' },
    playedUci: 'g1h1',
    bestUci: 'g1h1',
    centipawnLoss: 0,
    evalBefore: -160,
    evalAfter: -160,
    isWhite: true,
    plyNumber: 22,
  });
  assert(greatClass === 'great', 'Identifies only critical move in sharp position as great');

  // 5. Forced Mate continuation is NEVER a blunder or mistake
  const mateContinuationClass = classifyMoveQuality({
    move: { san: 'Qh7+', piece: 'q' },
    playedUci: 'd3h7',
    bestUci: 'd3h7',
    centipawnLoss: 0,
    evalBefore: 9900,
    evalAfter: 9900,
    isWhite: true,
    plyNumber: 30,
    isForcedMateContinuation: true,
  });
  assert(
    mateContinuationClass === 'best' || mateContinuationClass === 'excellent',
    'Forced mate continuation is never penalized or treated as blunder'
  );

  // 6. Loss Graduations
  const excellent = classifyMoveQuality({
    move: { san: 'Be3', piece: 'b' },
    playedUci: 'c1e3',
    bestUci: 'f1e2',
    centipawnLoss: 18,
    evalBefore: 50,
    evalAfter: 32,
    isWhite: true,
    plyNumber: 15,
  });
  assert(excellent === 'excellent', 'Centipawn loss <= 25 classified as excellent');

  const good = classifyMoveQuality({
    move: { san: 'a3', piece: 'p' },
    playedUci: 'a2a3',
    bestUci: 'f1e2',
    centipawnLoss: 45,
    evalBefore: 50,
    evalAfter: 5,
    isWhite: true,
    plyNumber: 15,
  });
  assert(good === 'good', 'Centipawn loss <= 60 classified as good');

  const inaccuracy = classifyMoveQuality({
    move: { san: 'h3', piece: 'p' },
    playedUci: 'h2h3',
    bestUci: 'd2d4',
    centipawnLoss: 85,
    evalBefore: 30,
    evalAfter: -55,
    isWhite: true,
    plyNumber: 16,
  });
  assert(inaccuracy === 'inaccuracy', 'Centipawn loss <= 130 classified as inaccuracy');

  const mistake = classifyMoveQuality({
    move: { san: 'Bd3', piece: 'b' },
    playedUci: 'f1d3',
    bestUci: 'f1e2',
    centipawnLoss: 210,
    evalBefore: 30,
    evalAfter: -180,
    isWhite: true,
    plyNumber: 18,
  });
  assert(mistake === 'mistake', 'Centipawn loss <= 300 classified as mistake');

  const blunder = classifyMoveQuality({
    move: { san: 'Qe2??', piece: 'q' },
    playedUci: 'd1e2',
    bestUci: 'e1g1',
    centipawnLoss: 450,
    evalBefore: 50,
    evalAfter: -400,
    isWhite: true,
    plyNumber: 20,
  });
  assert(blunder === 'blunder', 'Centipawn loss > 300 classified as blunder');

  // 7. Full Game Analysis Conservation Test:
  // Verify that the breakdown sum strictly equals the total number of moves for both sides
  const samplePgn = '1. e4 e5 2. Nf3 Nc6 3. Bc4 Bc5 4. O-O Nf6 5. d3 d6 6. c3 a6 7. Bb3 Ba7';
  stockfish.analyzeFullGame(samplePgn).then((analysis) => {
    const { analyzedMoves, classificationBreakdown } = analysis;

    const whiteMoves = analyzedMoves.filter((m) => m.color === 'w').length;
    const blackMoves = analyzedMoves.filter((m) => m.color === 'b').length;

    const whiteSum = Object.values(classificationBreakdown.white).reduce((a, b) => a + b, 0);
    const blackSum = Object.values(classificationBreakdown.black).reduce((a, b) => a + b, 0);

    assert(whiteSum === whiteMoves, `White breakdown total (${whiteSum}) matches white moves count (${whiteMoves})`);
    assert(blackSum === blackMoves, `Black breakdown total (${blackSum}) matches black moves count (${blackMoves})`);
    assert(
      whiteSum + blackSum === analyzedMoves.length,
      `Total breakdown sum (${whiteSum + blackSum}) matches analyzed moves length (${analyzedMoves.length})`
    );

    console.log(`\nTests finished: ${passed} passed, ${failed} failed.`);
    if (failed > 0) {
      process.exit(1);
    }
  });
}

runTests();
