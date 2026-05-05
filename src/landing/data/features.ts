import { Brain, Mic, CloudRain, Lock, type LucideIcon } from 'lucide-react'

export interface Feature {
  icon: LucideIcon
  /** i18n key fragment under `featuresGrid.*` for the title. */
  titleKey: string
  /** i18n key fragment under `featuresGrid.*` for the description. */
  descriptionKey: string
}

/**
 * Four features only — every claim here must reflect a feature that
 * is actually shipped today. "Track Your Progress" was removed in
 * prompt 13 (Progress tab deleted). "Works Offline" has no
 * implementation (no service worker, no audio pre-cache).
 *
 * Title and description copy lives in `src/i18n/locales/<lang>.json`
 * under `featuresGrid.*`; only icons + key references are stored
 * here so the JSON file is the single source of truth for
 * translatable copy.
 */
export const features: Feature[] = [
  { icon: Brain, titleKey: 'personalizedTitle', descriptionKey: 'personalizedDesc' },
  { icon: Mic, titleKey: 'voicesTitle', descriptionKey: 'voicesDesc' },
  { icon: CloudRain, titleKey: 'soundsTitle', descriptionKey: 'soundsDesc' },
  { icon: Lock, titleKey: 'privateTitle', descriptionKey: 'privateDesc' },
]
