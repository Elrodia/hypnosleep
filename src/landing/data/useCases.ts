export interface UseCase {
  id: string
  label: string
  description: string
}

export interface Testimonial {
  name: string
  role: string
  quote: string
}

export const useCases: UseCase[] = [
  {
    id: 'sleep',
    label: 'Sleep',
    description:
      'Hypnotic inductions calibrated to your wind-down time and preferred voice. Most users drift off before the 12-minute mark.',
  },
  {
    id: 'confidence',
    label: 'Confidence',
    description:
      'Daily affirmations rewritten around your actual goals — the interview, the conversation, the thing you keep avoiding.',
  },
  {
    id: 'smoking',
    label: 'Quit Smoking',
    description:
      'Targeted cravings-and-identity scripts. Triggered by context ("after dinner", "with coffee") so the right session is one tap away.',
  },
  {
    id: 'anxiety',
    label: 'Anxiety',
    description:
      'Grounding and regulation sessions you can run in 10 minutes. No talk therapy, no waiting list.',
  },
  {
    id: 'focus',
    label: 'Focus',
    description:
      'Short pre-work primers that help you start the thing, not just plan to start the thing.',
  },
]
