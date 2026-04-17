import { Brain, Mic, CloudRain, BarChart3, WifiOff, Lock, type LucideIcon } from 'lucide-react'

export interface Feature {
  icon: LucideIcon
  title: string
  description: string
}

// 6 features, 3x2 grid on desktop. Order is intentional: the first three
// speak to the core product promise (personalization + voice + atmosphere),
// the last three handle common objections (progress, offline, privacy).
export const features: Feature[] = [
  { icon: Brain, title: 'Personalized AI Scripts', description: 'Every session unique to your goals.' },
  { icon: Mic, title: '6 Soothing Voices', description: 'Find the voice that helps you drift away.' },
  { icon: CloudRain, title: 'Background Sound Mixer', description: 'Layer rain, ocean, forest sounds.' },
  { icon: BarChart3, title: 'Track Your Progress', description: 'Streaks, mood trends, weekly insights.' },
  { icon: WifiOff, title: 'Works Offline', description: 'Download sessions for travel, flights, off-grid sleep.' },
  { icon: Lock, title: 'Private by Design', description: 'Your sessions never leave your account.' },
]
