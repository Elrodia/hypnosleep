export interface FAQ {
  question: string
  answer: string
}

export const faqs: FAQ[] = [
  {
    question: 'What makes HypnoSleep different from other hypnosis apps?',
    answer:
      'HypnoSleep writes a fresh hypnosis script for the goal you describe — every session, every time. Pick a voice and a length, and you have a personalised audio in about 30 seconds.',
  },
  {
    question: 'Does AI hypnosis actually work?',
    answer:
      'Hypnosis is essentially focused attention plus suggestion. The AI writes the script following the structured pattern that clinical hypnotherapists use — induction, deepening, suggestion, emergence — and a calm voice reads it to you.',
  },
  {
    question: 'Is it safe?',
    answer:
      'Yes. Listen in a quiet place where you can rest safely. Do not listen while driving or operating machinery. If you have a history of psychosis, seizures, or PTSD, talk to a qualified clinician before using any hypnosis product.',
  },
  {
    question: 'How long does session generation take?',
    answer:
      'Usually 30 to 60 seconds end to end: a few seconds to write the script, the rest for voice synthesis.',
  },
  {
    question: 'Can I cancel anytime?',
    answer:
      'Yes. One tap in Settings → Subscription. Your Pro benefits stay active until the end of the billing period, no questions asked.',
  },
  {
    question: 'Do you offer refunds?',
    answer:
      'If the app did not work for you, email us within 30 days of your first Pro charge and we will look at your case. We are a small team and we want you happy.',
  },
  {
    question: 'Is my data private?',
    answer:
      'Your goals, scripts, and listening history are encrypted and tied only to your account. We never sell data, we never train third-party models on your content, and you can export or delete everything with one tap.',
  },
  {
    question: 'What languages are supported?',
    answer:
      'English at launch. Other languages will follow once we can ship them properly.',
  },
]
