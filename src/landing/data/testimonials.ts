import type { Testimonial } from './useCases'

/**
 * Testimonials are intentionally empty until the product has real,
 * named users who have given written permission to publish their
 * quote. Fabricated personas were removed in prompt 16a to avoid
 * misleading-commercial-communication exposure under EU consumer
 * law (Belgium: livre VI Code de droit économique).
 */
export const testimonials: Record<string, Testimonial[]> = {}
