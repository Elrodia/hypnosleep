import type { Request, Response, NextFunction } from 'express';
import { regenerateParagraphSchema } from './ai.schema.js';
import { regenerateParagraph } from './ai.service.js';
import { validationFailed } from '../../utils/errors.js';

/**
 * POST /api/sessions/:id/regenerate-paragraph
 *
 * Regenerates a specific paragraph of a session's script via Gemini,
 * honouring the surrounding paragraphs as context so tone and pacing
 * stay consistent. The current full-script safety pipeline is not
 * re-run here because the change is scoped to a single paragraph — the
 * caller (frontend editor) is responsible for running another script
 * generation if they want a fresh safety review.
 *
 * Session-level generation (`POST /api/sessions/generate`) and the
 * progress SSE stream live on the sessions router (see
 * `modules/sessions/sessions.controller.ts`); this controller intentionally
 * only handles paragraph-scoped regeneration.
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
