import { z } from 'zod';

/**
 * Body schema for `POST /api/progress/mood-log`. A mood rating must be
 * tied to an existing session and falls on a 1-5 scale; the free-form
 * `note` is capped at 500 characters to keep analytics payloads small.
 */
export const moodLogSchema = z.object({
  sessionId: z.string().uuid(),
  rating: z.number().int().min(1).max(5),
  note: z.string().max(500).optional(),
});

/**
 * Query schema for `GET /api/progress/heatmap`. The window is clamped
 * to [7, 365] days with a default of 90 so clients can't ask for an
 * unbounded aggregation window.
 */
export const heatmapQuerySchema = z.object({
  days: z.coerce.number().int().min(7).max(365).default(90),
});

/**
 * Query schema for `GET /api/progress/mood-trend`. The window is
 * clamped to [7, 90] days with a default of 30 — mood charts on the
 * client render a month-at-a-glance by default.
 */
export const moodTrendQuerySchema = z.object({
  days: z.coerce.number().int().min(7).max(90).default(30),
});

export type MoodLogInput = z.infer<typeof moodLogSchema>;
export type HeatmapQuery = z.infer<typeof heatmapQuerySchema>;
export type MoodTrendQuery = z.infer<typeof moodTrendQuerySchema>;
