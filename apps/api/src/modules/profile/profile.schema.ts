import { z } from 'zod';

/**
 * Body schema for `PATCH /api/profile`. All fields are optional so a
 * caller can patch any subset; `preferences` is deep-merged with the
 * existing value inside the service so partial updates don't
 * overwrite unrelated keys.
 */
export const updateProfileSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  avatarUrl: z.string().url().max(1024).optional(),
  preferences: z
    .object({
      goals: z.array(z.string().max(64)).max(10).optional(),
      preferredTime: z
        .enum(['before_sleep', 'morning', 'breaks', 'anytime'])
        .optional(),
      defaultDuration: z.number().int().min(5).max(30).optional(),
      defaultVoice: z.string().max(64).optional(),
      defaultBackground: z.string().max(32).optional(),
      theme: z.enum(['dark', 'light']).optional(),
      dailyReminderTime: z
        .string()
        .regex(/^\d{2}:\d{2}$/)
        .optional(),
      hasCompletedOnboarding: z.boolean().optional(),
      hasCompletedQuiz: z.boolean().optional(),
    })
    .optional(),
});

export type UpdateProfileInput = z.infer<typeof updateProfileSchema>;
