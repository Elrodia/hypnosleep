export interface FAQ {
  question: string
  answer: string
}

export const faqs: FAQ[] = [
  {
    question: 'What makes HypnoSleep different from other hypnosis apps?',
    answer:
      'Most hypnosis apps give everyone the same 50 pre-recorded tracks. HypnoSleep writes a new script for you every time — based on your goal, your preferred voice, and how your last sessions went. It is the difference between a generic relaxation tape and a therapist who remembers what you talked about last week.',
  },
  {
    question: 'Does AI hypnosis actually work?',
    answer:
      'Hypnosis is essentially focused attention plus suggestion. The AI handles the writing; the state of relaxation you reach is yours. We use the same structured patterns (induction → deepening → suggestion → emergence) that clinical hypnotherapists use, and iterate scripts based on what users rate as effective.',
  },
  {
    question: 'Is it safe?',
    answer:
      'Yes. Listen in a quiet place where you can rest safely. Do not listen while driving or operating machinery. If you have a history of psychosis, seizures, or PTSD, talk to a qualified clinician before using any hypnosis product.',
  },
  {
    question: 'How long does session generation take?',
    answer:
      'Usually 20 to 30 seconds. Pro users get priority generation during peak hours, which typically keeps it under 15 seconds.',
  },
  {
    question: 'Can I cancel anytime?',
    answer:
      'Yes. One tap in Settings → Subscription. Your Pro benefits stay active until the end of the billing period, no questions asked.',
  },
  {
    question: 'Do you offer refunds?',
    answer:
      'If the app did not work for you, email us within 30 days of your first Pro charge and we will refund it. No forms, no "please explain".',
  },
  {
    question: 'Is my data private?',
    answer:
      'Your goals, scripts, and listening history are encrypted and tied only to your account. We never sell data, we never train third-party models on your content, and you can export or delete everything with one tap.',
  },
  {
    question: 'What languages are supported?',
    answer:
      'English, Dutch, French, German, Spanish, and Italian at launch. More coming based on user requests.',
  },
]
