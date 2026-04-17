export interface Testimonial {
  name: string
  role: string
  quote: string
}

// Intentionally "regular people" voice — no corporate titles, no fake companies.
// These are explicitly placeholders to be replaced with real testimonials once
// the app has 100+ subscribers (see PRD "Anti-Patterns").
export const testimonials: Record<string, Testimonial[]> = {
  sleep: [
    { name: 'Marta', role: 'Nurse, 34', quote: 'I used to scroll until 2am. Now I fall asleep before the session even ends.' },
    { name: 'Jonas', role: 'Dev, 29', quote: 'The background rain mix is my whole bedtime routine now. Deeper sleep, no melatonin.' },
    { name: 'Priya', role: 'Student, 22', quote: 'Exam week without panic. That alone paid for the year.' },
  ],
  confidence: [
    { name: 'Kenji', role: 'Designer, 31', quote: 'Two weeks in and I actually spoke up in our Monday standup. Small win, huge for me.' },
    { name: 'Ana', role: 'Teacher, 41', quote: 'The affirmations feel written for me because… they are.' },
  ],
  smoking: [
    { name: 'Tom', role: 'Electrician, 45', quote: 'Day 38 smoke-free. The craving scripts genuinely help at 10pm.' },
    { name: 'Lise', role: 'Barista, 27', quote: 'Tried patches, tried apps, tried willpower. This is the only thing that stuck.' },
  ],
  anxiety: [
    { name: 'Sam', role: 'PM, 36', quote: 'My Sunday-night dread is 80% quieter. I did not expect "80%". I expected "a bit".' },
    { name: 'Farah', role: 'Student, 24', quote: 'I use the 10-minute session before meetings. Gamechanger is an understatement.' },
  ],
  focus: [
    { name: 'Luka', role: 'Writer, 39', quote: 'Morning focus sessions got me back to writing 1,000 words before 9am.' },
    { name: 'Noor', role: 'Researcher, 33', quote: 'The custom script for "deep work" beats any Pomodoro I have tried.' },
  ],
}
