import type { Request, Response, NextFunction } from 'express';
import { generateSessionSchema, regenerateParagraphSchema } from './ai.schema.js';
import { generateScript, regenerateParagraph, checkScriptSafety } from './ai.service.js';
import { enqueueAudioGeneration } from '../../queues/audio-generation.queue.js';
import { validationFailed, rateLimitExceeded, generationFailed } from '../../utils/errors.js';
import { VOICES, RATE_LIMITS } from '../../config/constants.js';
import { proRequired } from '../../utils/errors.js';
import { logger } from '../../utils/logger.js';
import { getRedis } from '../../db/redis/client.js';
import { v4 as uuidv4 } from 'uuid';
import type { JwtPayload } from '../../middleware/authenticate.js';
import type { GenerateSessionInput } from './ai.types.js';

/**
 * POST /api/sessions/generate
 * Creates a new hypnosis session via AI generation.
 * Returns immediately with sessionId and status 'generating'.
 */
export async function handleGenerateSession(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const user = req.user as JwtPayload;
    const validation = generateSessionSchema.safeParse(req.body);

    if (!validation.success) {
      throw validationFailed('Invalid session parameters', {
        errors: validation.error.flatten().fieldErrors,
      });
    }

    const body = validation.data;

    // Check voice access (Pro-only voices)
    const voiceConfig = VOICES[body.voiceId as keyof typeof VOICES];
    if (voiceConfig?.pro && user.plan !== 'pro') {
      throw proRequired('This voice requires a Pro subscription');
    }

    // Check free tier generation limit
    if (user.plan !== 'pro') {
      const usageCount = await getMonthlyUsage(user.userId);
      if (usageCount >= RATE_LIMITS.AI_GENERATION_FREE) {
        throw rateLimitExceeded(
          'You have reached your free tier generation limit',
          {
            limit: RATE_LIMITS.AI_GENERATION_FREE,
            resetAt: getNextMonthReset(),
          },
        );
      }
    }

    const sessionId = uuidv4();

    // Build input for script generation
    const input: GenerateSessionInput = {
      userId: user.userId,
      sessionId,
      prompt: body.prompt,
      category: body.category,
      voiceId: body.voiceId as GenerateSessionInput['voiceId'],
      backgroundSound: body.backgroundSound,
      durationMinutes: body.durationMinutes,
      inductionStyle: body.inductionStyle,
      depthLevel: body.depthLevel,
      wakeUpEnding: body.wakeUpEnding,
    };

    // Step 1: Generate the script via Gemini
    const scriptResult = await generateScript(input);

    // Step 2: Safety check the generated script
    const safetyResult = await checkScriptSafety(scriptResult.scriptText);
    if (!safetyResult.isSafe) {
      logger.warn(
        { sessionId, reason: safetyResult.reason },
        'Script flagged as unsafe',
      );
      throw generationFailed(
        'The generated content did not pass our safety review. Please try a different prompt.',
        { reason: safetyResult.reason },
      );
    }

    // Step 3: Enqueue audio generation job
    await enqueueAudioGeneration({
      sessionId,
      userId: user.userId,
      scriptText: scriptResult.scriptText,
      title: scriptResult.title,
      voiceId: input.voiceId,
      backgroundSound: input.backgroundSound,
      durationMinutes: input.durationMinutes,
    });

    // Step 4: Increment usage counter
    await incrementMonthlyUsage(user.userId);

    logger.info(
      { sessionId, userId: user.userId, title: scriptResult.title },
      'Session generation started',
    );

    res.status(202).json({
      data: {
        sessionId,
        status: 'generating',
        title: scriptResult.title,
        scriptPreview: scriptResult.scriptText.slice(0, 200) + '...',
      },
    });
  } catch (err) {
    next(err);
  }
}

/**
 * POST /api/sessions/:id/regenerate-paragraph
 * Regenerates a specific paragraph of a session's script.
 */
export async function handleRegenerateParagraph(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const validation = regenerateParagraphSchema.safeParse({
      ...req.body,
      sessionId: req.params.id,
    });

    if (!validation.success) {
      throw validationFailed('Invalid regeneration parameters', {
        errors: validation.error.flatten().fieldErrors,
      });
    }

    const { context } = validation.data;

    const regenerated = await regenerateParagraph(
      context.currentParagraph,
      context.previousParagraph,
      context.nextParagraph,
    );

    res.json({
      data: {
        regeneratedText: regenerated,
      },
    });
  } catch (err) {
    next(err);
  }
}

/**
 * GET /api/sessions/:id/events
 * SSE endpoint for real-time generation progress.
 */
export function handleSessionEvents(
  req: Request,
  res: Response,
): void {
  const sessionId = req.params.id;

  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    Connection: 'keep-alive',
    'X-Accel-Buffering': 'no',
  });

  // Send an SSE comment as an initial connection acknowledgement without
  // emitting an out-of-contract GenerationProgressEvent payload.
  res.write(`: connected to generation stream for session ${sessionId}\n\n`);

  // In production, this would subscribe to a Redis pub/sub channel
  // keyed by sessionId and forward events to the SSE stream.
  // For now, we set up the SSE handler structure.
  const heartbeat = setInterval(() => {
    res.write(`: heartbeat\n\n`);
  }, 15000);

  req.on('close', () => {
    clearInterval(heartbeat);
  });
}

// --- Helpers ---

/**
 * Gets the current month's generation count for a user.
 * Uses Redis cache backed by the database.
 */
async function getMonthlyUsage(userId: string): Promise<number> {
  // Reads from Redis key `usage:{userId}:{yyyymm}`.
  // Falls back to 0 if Redis is unavailable.
  try {
    const redis = getRedis();
    const key = `usage:${userId}:${getCurrentPeriod()}`;
    const count = await redis.get(key);
    return count ? parseInt(count, 10) : 0;
  } catch {
    return 0;
  }
}

/**
 * Increments the monthly usage counter for a user.
 */
async function incrementMonthlyUsage(userId: string): Promise<void> {
  try {
    const redis = getRedis();
    const key = `usage:${userId}:${getCurrentPeriod()}`;
    await redis.incr(key);
    // Set TTL to end of next month (safe buffer)
    await redis.expire(key, 60 * 60 * 24 * 62);
  } catch (err) {
    logger.error({ err }, 'Failed to increment usage counter');
  }
}

function getCurrentPeriod(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  return `${year}${month}`;
}

function getNextMonthReset(): string {
  const now = new Date();
  const nextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1);
  return nextMonth.toISOString();
}
