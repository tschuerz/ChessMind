import express, { Request, Response } from 'express';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { GoogleGenAI, Type } from '@google/genai';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.use(express.json({ limit: '2mb' }));

interface CoachAnalysisRequest {
  gameMeta: {
    playerColor: 'white' | 'black';
    opponentElo: number;
    playerElo: number;
    result: 'win' | 'loss' | 'draw';
    termination: string;
    openingName?: string;
    eco?: string;
    whiteAccuracy: number;
    blackAccuracy: number;
    totalMoves: number;
  };
  criticalMoments: Array<{
    moveNumber: number;
    color: 'w' | 'b';
    san: string;
    playedMove: string;
    bestMove: string;
    evalBefore: number | string;
    evalAfter: number | string;
    classification: string;
    centipawnLoss: number;
  }>;
  customConfig?: {
    provider?: 'gemini' | 'openai_compatible';
    apiKey?: string;
    endpoint?: string;
    model?: string;
  };
}

// Health check
app.get('/api/health', (_req: Request, res: Response) => {
  res.json({
    status: 'ok',
    hasDefaultGeminiKey: Boolean(process.env.GEMINI_API_KEY),
    timestamp: new Date().toISOString(),
  });
});

// Test API Connection
app.post('/api/coach/test', async (req: Request, res: Response) => {
  try {
    const { provider = 'gemini', apiKey, endpoint, model } = req.body || {};

    if (provider === 'gemini') {
      const activeKey = apiKey || process.env.GEMINI_API_KEY;
      if (!activeKey) {
        return res.status(400).json({
          ok: false,
          error: 'No Gemini API key found. Enter a custom key or configure secrets.',
        });
      }

      const activeModel = model || 'gemini-3.8-flash';
      const ai = new GoogleGenAI({
        apiKey: activeKey,
        httpOptions: { headers: { 'User-Agent': 'aistudio-build' } },
      });

      const response = await ai.models.generateContent({
        model: activeModel,
        contents: 'Respond with exactly: "ChessMind connection verified."',
      });

      return res.json({
        ok: true,
        message: response.text?.trim() || 'Connected successfully',
        model: activeModel,
        provider: 'gemini',
      });
    }

    if (provider === 'openai_compatible') {
      if (!apiKey) {
        return res.status(400).json({ ok: false, error: 'API key is required for OpenAI-compatible endpoint.' });
      }
      const targetEndpoint = (endpoint || 'https://api.openai.com/v1').replace(/\/+$/, '');
      const targetModel = model || 'gpt-4o-mini';

      const response = await fetch(`${targetEndpoint}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model: targetModel,
          messages: [{ role: 'user', content: 'Say "ChessMind connected"' }],
          max_tokens: 20,
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        return res.status(response.status).json({
          ok: false,
          error: `API returned HTTP ${response.status}: ${errorText.slice(0, 200)}`,
        });
      }

      const data = (await response.json()) as { choices?: Array<{ message?: { content?: string } }> };
      const reply = data.choices?.[0]?.message?.content?.trim() || 'Connected';
      return res.json({
        ok: true,
        message: reply,
        model: targetModel,
        provider: 'openai_compatible',
      });
    }

    return res.status(400).json({ ok: false, error: `Unknown provider: ${provider}` });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Connection failed';
    return res.status(500).json({ ok: false, error: message });
  }
});

// Real-Time In-Game Coach Companion Q&A
app.post('/api/coach/chat', async (req: Request, res: Response) => {
  try {
    const { question, fen, coachPersona = 'friendly', lastMove, gameMeta } = req.body || {};

    if (!question || typeof question !== 'string') {
      return res.status(400).json({ error: 'Question is required' });
    }

    const personaInstructions: Record<string, string> = {
      friendly:
        'You are the Friendly Coach: warm, encouraging, positive, and patient. Celebrate progress and explain concepts gently.',
      strict:
        'You are the Strict Coach: direct, disciplined, and uncompromising on fundamentals. Demand alertness and punish bad habits.',
      analytical:
        'You are the Analytical Coach: a Grandmaster tactician who speaks in precise tactical terms, diagonals, files, and calculating depth.',
      beginner:
        'You are the Beginner Coach: simple, clear, focusing strictly on fundamental principles (center control, king safety, active pieces).',
    };

    const effectivePersona =
      personaInstructions[coachPersona] ||
      personaInstructions['friendly'];

    if (process.env.GEMINI_API_KEY) {
      try {
        const ai = new GoogleGenAI({
          apiKey: process.env.GEMINI_API_KEY,
          httpOptions: { headers: { 'User-Agent': 'aistudio-build' } },
        });

        const prompt = `Context:
Current Board FEN: "${fen || 'startpos'}"
Last Move Played: ${lastMove?.san ? `${lastMove.color === 'w' ? 'White' : 'Black'} played ${lastMove.san} (${lastMove.classification || 'normal'})` : 'Opening position'}
Player Color: ${gameMeta?.playerColor || 'white'}
Move Number: ${gameMeta?.moveNumber || 1}

Student's Question: "${question}"

Instructions:
${effectivePersona}
Answer the student's question directly in 1-3 concise sentences.
- Base advice on real chess principles: king safety, piece coordination, central control, and pawn structure.
- Do not spoil the immediate top move unless the student asks for a direct hint; instead guide their thinking.
- Keep the response short, clear, and readable during active play.`;

        const responsePromise = ai.models.generateContent({
          model: 'gemini-3.8-flash',
          contents: prompt,
          config: {
            systemInstruction:
              'You are ChessMind In-Game AI Companion. Concise, authoritative, insightful chess coach responding in 1 to 3 sentences.',
          },
        });

        const timeoutPromise = new Promise((_, reject) =>
          setTimeout(() => reject(new Error('Gemini chat timeout')), 5000)
        );

        const response = (await Promise.race([responsePromise, timeoutPromise])) as any;
        const answer = response?.text?.trim();
        if (answer) {
          return res.json({ answer, source: 'gemini', persona: coachPersona });
        }
      } catch (geminiErr) {
        console.warn('Gemini chat fallback to heuristic companion:', geminiErr);
      }
    }

    // High-quality contextual offline fallback
    const q = question.toLowerCase();
    let answer = '';
    if (q.includes('king') || q.includes('safe')) {
      answer = 'Keep your castled king protected behind pawns. Avoid pushing the f-pawn or h-pawn unnecessarily if opponent pieces are aimed at your kingside.';
    } else if (q.includes('piece') || q.includes('hang') || q.includes('threat')) {
      answer = 'Scan for undefended pieces before moving. Check if your opponent has created any direct skewers, forks, or discovered attacks.';
    } else if (q.includes('why') || q.includes('opponent')) {
      answer = lastMove?.san
        ? `The opponent played ${lastMove.san} to increase piece pressure and contest key squares. Look at which diagonals or ranks they just opened.`
        : 'Your opponent is fighting for central influence and improving their piece mobility.';
    } else if (q.includes('plan') || q.includes('should') || q.includes('what to do')) {
      answer = 'Look at the least active piece in your camp and find an outpost for it. Control open files with your rooks and contest the center.';
    } else {
      answer = 'Focus on candidate moves: checks, captures, and threats first. Make sure every move improves your piece activity and keeps your king safe.';
    }

    return res.json({ answer, source: 'offline_coach', persona: coachPersona });
  } catch (err: unknown) {
    console.error('Error in /api/coach/chat:', err);
    return res.status(500).json({ error: 'Failed to generate coach response' });
  }
});

// Post-Game AI Coach Explanation & Analysis
app.post('/api/coach/analyze', async (req: Request, res: Response) => {
  try {
    const { gameMeta, criticalMoments, customConfig } = req.body as CoachAnalysisRequest;

    if (!gameMeta) {
      return res.status(400).json({ error: 'Missing game metadata' });
    }

    const provider = customConfig?.provider || (process.env.GEMINI_API_KEY ? 'gemini' : 'heuristic');
    const customKey = customConfig?.apiKey;
    const effectiveGeminiKey = customKey || process.env.GEMINI_API_KEY;

    // Construct detailed prompt fed with verified Stockfish evaluation data
    const prompt = `You are a Grandmaster Chess Coach analyzing a student's game for ChessMind.
You MUST base your coaching entirely on the verified engine data provided below. Do NOT invent alternate moves or hallucinate evaluations.

Student Profile & Game Overview:
- Student estimated Elo: ~${gameMeta.playerElo}
- Opponent (Stockfish AI) Elo: ~${gameMeta.opponentElo}
- Student Color: ${gameMeta.playerColor}
- Game Result: ${gameMeta.result.toUpperCase()} (${gameMeta.termination})
- Total Moves: ${gameMeta.totalMoves}
- Opening: ${gameMeta.openingName || 'Standard Opening'} (${gameMeta.eco || 'ECO'})
- Student Accuracy: ${gameMeta.playerColor === 'white' ? gameMeta.whiteAccuracy : gameMeta.blackAccuracy}%
- Opponent Accuracy: ${gameMeta.playerColor === 'white' ? gameMeta.blackAccuracy : gameMeta.whiteAccuracy}%

Verified Critical Moments (Blunders, Mistakes, Key Turning Points):
${
  criticalMoments && criticalMoments.length > 0
    ? criticalMoments
        .map(
          (m) =>
            `Move ${m.moveNumber} (${m.color === 'w' ? 'White' : 'Black'}): Played "${m.san}" [${m.classification.toUpperCase()}], Engine evaluation dropped by ${m.centipawnLoss} cp. Engine recommended: "${m.bestMove}".`
        )
        .join('\n')
    : 'No critical blunders detected; solid tactical game.'
}

Provide clear, inspiring, instructive coaching formatted in JSON matching the schema:
1. gameOverview: A 2-sentence encouraging summary of the game flow and tactical landscape.
2. biggestLesson: The single most impactful takeaway the student must learn from this game to climb higher in rating.
3. keyMoments: Array of explanations for up to 4 critical moves (explain in human chess terms why the student's move backfired or why the recommended move was superior, mentioning concepts like pin, fork, hanging piece, king safety, open file, or tempo).
4. recurringPatterns: Bullet observations of student tendencies (e.g., rushing in the endgame, neglecting piece development, king safety in the opening).
5. openingReview: 1-2 sentence advice on their opening play.
6. practicalRecommendations: 3 actionable study/practice drills tailored to a ~${gameMeta.playerElo} rating level.`;

    if (provider === 'gemini' && effectiveGeminiKey) {
      try {
        const activeModel = customConfig?.model || 'gemini-3.8-flash';
        const ai = new GoogleGenAI({
          apiKey: effectiveGeminiKey,
          httpOptions: { headers: { 'User-Agent': 'aistudio-build' } },
        });

        // 6-second timeout so the user is never left waiting indefinitely
        const geminiCall = ai.models.generateContent({
          model: activeModel,
          contents: prompt,
          config: {
            systemInstruction:
              'You are ChessMind AI Coach. You speak like an encouraging, world-class chess master: clear, direct, insightful, without patronizing jargon, prioritizing tactical clarity.',
            responseMimeType: 'application/json',
            responseSchema: {
              type: Type.OBJECT,
              properties: {
                gameOverview: { type: Type.STRING },
                biggestLesson: { type: Type.STRING },
                openingReview: { type: Type.STRING },
                keyMoments: {
                  type: Type.ARRAY,
                  items: {
                    type: Type.OBJECT,
                    properties: {
                      moveNumber: { type: Type.INTEGER },
                      playedMove: { type: Type.STRING },
                      bestMove: { type: Type.STRING },
                      classification: { type: Type.STRING },
                      explanation: { type: Type.STRING },
                      tacticalConcept: { type: Type.STRING },
                    },
                    required: ['moveNumber', 'playedMove', 'bestMove', 'explanation'],
                  },
                },
                recurringPatterns: {
                  type: Type.ARRAY,
                  items: { type: Type.STRING },
                },
                practicalRecommendations: {
                  type: Type.ARRAY,
                  items: { type: Type.STRING },
                },
              },
              required: [
                'gameOverview',
                'biggestLesson',
                'openingReview',
                'keyMoments',
                'recurringPatterns',
                'practicalRecommendations',
              ],
            },
          },
        });

        const timeoutPromise = new Promise((_, reject) =>
          setTimeout(() => reject(new Error('Gemini API timeout')), 6000)
        );

        const response = (await Promise.race([geminiCall, timeoutPromise])) as any;
        const text = response?.text || '{}';
        const parsed = JSON.parse(text);
        return res.json({ source: 'gemini', model: activeModel, ...parsed });
      } catch (geminiErr) {
        console.warn('Gemini coaching unavailable or timed out, using Grandmaster Heuristic Coach:', geminiErr);
        return res.json(buildHeuristicCoaching(gameMeta, criticalMoments));
      }
    }

    if (provider === 'openai_compatible' && customKey) {
      try {
        const targetEndpoint = (customConfig.endpoint || 'https://api.openai.com/v1').replace(/\/+$/, '');
        const targetModel = customConfig.model || 'gpt-4o-mini';

        const response = await fetch(`${targetEndpoint}/chat/completions`, {
          method: 'POST',
          signal: AbortSignal.timeout(6000),
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${customKey}`,
          },
          body: JSON.stringify({
            model: targetModel,
            messages: [
              {
                role: 'system',
                content:
                  'You are ChessMind AI Coach. Return valid JSON only with keys: gameOverview, biggestLesson, openingReview, keyMoments (array with moveNumber, playedMove, bestMove, classification, explanation, tacticalConcept), recurringPatterns (array), practicalRecommendations (array).',
              },
              { role: 'user', content: prompt },
            ],
            response_format: { type: 'json_object' },
          }),
        });

        if (response.ok) {
          const data = (await response.json()) as { choices?: Array<{ message?: { content?: string } }> };
          const reply = data.choices?.[0]?.message?.content || '{}';
          const parsed = JSON.parse(reply);
          return res.json({ source: 'openai_compatible', model: targetModel, ...parsed });
        }
      } catch (oaErr) {
        console.warn('OpenAI compatible call failed, using Grandmaster Heuristic Coach:', oaErr);
        return res.json(buildHeuristicCoaching(gameMeta, criticalMoments));
      }
    }

    // Default Fallback: Grandmaster Heuristic Coach
    return res.json(buildHeuristicCoaching(gameMeta, criticalMoments));
  } catch (err: unknown) {
    console.error('Error generating coaching:', err);
    // Graceful fallback to heuristic coach so the user never gets an error screen!
    const { gameMeta, criticalMoments } = req.body || {};
    return res.json(buildHeuristicCoaching(gameMeta, criticalMoments || []));
  }
});

// Heuristic fallback generator when offline or no API key is attached
function buildHeuristicCoaching(
  gameMeta: CoachAnalysisRequest['gameMeta'],
  criticalMoments: CoachAnalysisRequest['criticalMoments']
) {
  const isWin = gameMeta.result === 'win';
  const isDraw = gameMeta.result === 'draw';
  const accuracy = gameMeta.playerColor === 'white' ? gameMeta.whiteAccuracy : gameMeta.blackAccuracy;

  const blunders = criticalMoments.filter((m) => m.classification === 'blunder');
  const mistakes = criticalMoments.filter((m) => m.classification === 'mistake');

  let biggestLesson = '';
  if (blunders.length > 0) {
    const firstBlunder = blunders[0];
    biggestLesson = `Look for checks, captures, and threats before finalizing your move. On move ${firstBlunder.moveNumber}, "${firstBlunder.san}" compromised your position. Playing "${firstBlunder.bestMove}" would have preserved your tactical initiative.`;
  } else if (mistakes.length > 0) {
    biggestLesson = `Focus on piece harmony and king shelter. While you avoided severe material blunders, positional inaccuracies allowed the opponent to apply sustained pressure in the center.`;
  } else if (isWin) {
    biggestLesson = `Outstanding accuracy! You converted your positional advantage cleanly. Now challenge yourself by raising the engine strength by 100-200 Elo.`;
  } else {
    biggestLesson = `Patience in equal positions. Avoid forcing complications when solid piece activity and prophylactic defense maintain balance.`;
  }

  const keyMoments = (criticalMoments || []).slice(0, 4).map((m) => ({
    moveNumber: m.moveNumber,
    playedMove: m.playedMove || m.san,
    bestMove: m.bestMove,
    classification: m.classification,
    explanation:
      m.classification === 'blunder'
        ? `Playing ${m.san} left a tactical vulnerability that shifted evaluation by ${(m.centipawnLoss / 100).toFixed(1)} pawns. The engine preferred ${m.bestMove} to maintain coordination.`
        : `While ${m.san} kept the game moving, ${m.bestMove} was more active and preserved faster piece mobilization.`,
    tacticalConcept:
      m.classification === 'blunder' ? 'Tactical Oversight & Piece Safety' : 'Positional Mobility',
  }));

  return {
    source: 'engine_heuristic',
    model: 'ChessMind Tactical Evaluator',
    gameOverview: isWin
      ? `A convincing victory as ${gameMeta.playerColor} against ${gameMeta.opponentElo} Elo Stockfish with ${accuracy}% accuracy.`
      : isDraw
      ? `A hard-fought draw against ${gameMeta.opponentElo} Elo Stockfish displaying resilient endgame defense.`
      : `A competitive game against ${gameMeta.opponentElo} Elo Stockfish that slipped away due to tactical nuances in the middle game.`,
    biggestLesson,
    openingReview: `In the ${gameMeta.openingName || 'opening phase'} (${gameMeta.eco || 'standard lines'}), you reached a playable position. Aim to complete piece development and castle before launching kingside pawn advances.`,
    keyMoments,
    recurringPatterns: [
      blunders.length > 0
        ? `Tended to miscalculate direct piece attacks under tension (${blunders.length} blunder${blunders.length > 1 ? 's' : ''}).`
        : 'Solid tactical radar; avoided severe piece hangs.',
      accuracy > 80
        ? 'High precision in tactical calculations; capitalizes well on opponent inaccuracies.'
        : 'Room to improve calculation speed and move order precision in critical positions.',
      'Active piece centralization provided strong fighting chances.',
    ],
    practicalRecommendations: [
      'Solve 15-20 daily tactical puzzles focused on pins, forks, and removing the guard.',
      `Practice against Stockfish set to ${Math.max(400, gameMeta.playerElo - 100)}–${gameMeta.playerElo + 100} Elo with a focus on zero blunders.`,
      `Review key opening ideas in the ${gameMeta.openingName || 'open game'} to reach comfortable middlegame positions without losing tempo.`,
    ],
  };
}

// Attach Vite middleware in development or static serve in production
const isProduction = process.env.NODE_ENV === 'production';

async function startServer() {
  if (!isProduction) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.resolve(__dirname, 'dist')));
    app.get('*', (_req: Request, res: Response) => {
      res.sendFile(path.resolve(__dirname, 'dist/index.html'));
    });
  }

  const PORT = Number(process.env.PORT) || 3000;
  app.listen(PORT, '0.0.0.0', () => {
    console.log(`ChessMind server active on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
