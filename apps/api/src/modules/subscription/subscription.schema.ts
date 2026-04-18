import { z } from 'zod';

/**
 * Billing plan shown on the upgrade page. Maps to Stripe price IDs
 * (`STRIPE_PRICE_MONTHLY` / `STRIPE_PRICE_ANNUAL`) inside the service.
 */
export const checkoutSchema = z.object({
  plan: z.enum(['monthly', 'yearly']),
});

export type CheckoutInput = z.infer<typeof checkoutSchema>;
