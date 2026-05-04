import { Brain, Mic, CloudRain, Lock, type LucideIcon } from 'lucide-react'

export interface Feature {
  icon: LucideIcon
  title: string
  description: string
}

/**
 * Four features only — every claim here must reflect a feature that
 * is actually shipped today. "Track Your Progress" was removed in
 * prompt 13 (Progress tab deleted). "Works Offline" has no
 * implementation (no service worker, no audio pre-cache).
 */
export const features: Feature[] = [
  { icon: Brain, title: 'Personalized AI Scripts', description: 'Every session unique to your goals.' },
  { icon: Mic, title: '6 Soothing Voices', description: 'Find the voice that helps you drift away.' },
  { icon: CloudRain, title: 'Background Sounds', description: 'Rain, ocean, forest, wind, or silence.' },
  { icon: Lock, title: 'Private by Design', description: 'Your sessions never leave your account.' },
]
