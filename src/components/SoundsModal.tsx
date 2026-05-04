import { motion, AnimatePresence } from 'framer-motion'
import { useEffect } from 'react'
import { X, Microphone, Info, Icon } from '@phosphor-icons/react'
import { useKV } from '@/hooks/use-kv'
import { Slider } from './ui/slider'
import { useAudioPlayer } from '@/contexts/AudioPlayerContext'

interface SoundsModalProps {
  isOpen: boolean
  onClose: () => void
}

interface SoundLayer {
  id: string
  label: string
  icon: Icon
  defaultVolume: number
}

const soundLayers: SoundLayer[] = [
  { id: 'voice', label: 'voice', icon: Microphone, defaultVolume: 80 },
]

const STYLES = `
.ls-sounds-modal {
  --ls-bg: #0a0a0f;
  --ls-bg-elevated: #12121a;
  --ls-text: #e8e6e1;
  --ls-text-muted: #8a8580;
  --ls-text-subtle: #5a5650;
  --ls-sand: #c9b6a3;
  --ls-sand-dim: #8a7d6e;
  --ls-border: rgba(232, 230, 225, 0.08);
  --ls-border-strong: rgba(232, 230, 225, 0.16);
  font-family: 'Inter', system-ui, sans-serif;
}
.ls-sounds-modal .font-fraunces {
  font-family: 'Fraunces', 'Cormorant Garamond', serif;
  font-weight: 400;
  letter-spacing: -0.01em;
}
`

const sliderClassName =
  '[&_[data-slot=slider-track]]:bg-[var(--ls-border-strong)] ' +
  '[&_[data-slot=slider-range]]:bg-[var(--ls-sand)] ' +
  '[&_[data-slot=slider-thumb]]:border-[var(--ls-sand)] ' +
  '[&_[data-slot=slider-thumb]]:bg-[var(--ls-bg)] ' +
  '[&_[data-slot=slider-thumb]]:shadow-none ' +
  '[&_[data-slot=slider-thumb]]:focus-visible:ring-[var(--ls-sand-dim)] ' +
  '[&_[data-slot=slider-thumb]]:hover:ring-[var(--ls-sand)]/20'

/**
 * Per-layer sound mixing is not exposed yet because generated sessions
 * are currently delivered as one pre-mixed MP3. The live player can
 * only adjust the master audio element volume. The voice row stays as
 * future-facing UI state, but it does not imply multitrack mixing.
 */
export function SoundsModal({ isOpen, onClose }: SoundsModalProps) {
  const [masterVolume, setMasterVolume] = useKV<number>('sound-master-volume', 100)
  const [voiceVolume, setVoiceVolume] = useKV<number>('sound-voice-volume', 80)

  const { setVolume } = useAudioPlayer()

  useEffect(() => {
    setVolume((masterVolume ?? 100) / 100)
  }, [masterVolume, setVolume])

  const volumes: Record<string, number | undefined> = {
    voice: voiceVolume,
  }

  const setters: Record<string, ((value: number) => void) | undefined> = {
    voice: setVoiceVolume,
  }

  const handleVolumeChange = (id: string, value: number[]) => {
    const setter = setters[id]
    if (setter) {
      setter(value[0])
    }
  }

  const handleResetToDefault = () => {
    setMasterVolume(100)
    soundLayers.forEach((layer) => {
      const setter = setters[layer.id]
      if (setter) {
        setter(layer.defaultVolume)
      }
    })
  }

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="ls-sounds-modal">
          <style>{STYLES}</style>

          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18, ease: 'easeOut' }}
            className="fixed inset-0 z-50 bg-[var(--ls-bg)]/88"
            onClick={onClose}
          />

          <motion.div
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', damping: 32, stiffness: 310 }}
            className="fixed inset-x-0 bottom-0 z-50 max-h-[85vh] overflow-hidden rounded-t-md border-t border-[var(--ls-border-strong)] bg-[var(--ls-bg-elevated)] text-[var(--ls-text)]"
            role="dialog"
            aria-modal="true"
            aria-label="sound mixer"
          >
            <div className="mx-auto mb-5 mt-3 h-1.5 w-12 rounded-full bg-[var(--ls-border-strong)]" />

            <div className="max-h-[calc(85vh-2rem)] overflow-y-auto px-6 pb-8">
              <div className="mb-6 flex items-center justify-between">
                <div>
                  <p className="mb-1 text-xs uppercase tracking-[0.22em] text-[var(--ls-text-subtle)]">
                    player
                  </p>
                  <h2 className="font-fraunces text-2xl italic lowercase text-[var(--ls-text)]">
                    sound mixer
                  </h2>
                </div>

                <button
                  type="button"
                  onClick={onClose}
                  aria-label="close sound mixer"
                  className="flex h-9 w-9 items-center justify-center rounded-full border border-[var(--ls-border-strong)] text-[var(--ls-text-muted)] transition-colors hover:border-[var(--ls-sand-dim)] hover:text-[var(--ls-text)] focus:outline-none focus-visible:ring-1 focus-visible:ring-[var(--ls-sand-dim)]"
                >
                  <X className="h-4 w-4" weight="regular" />
                </button>
              </div>

              <section className="mb-6 rounded-md border border-[var(--ls-sand-dim)] bg-[var(--ls-sand)]/8 p-4">
                <div className="mb-4 flex items-center justify-between gap-3">
                  <span className="text-sm lowercase text-[var(--ls-text)]">
                    master volume
                  </span>
                  <span className="min-w-[46px] text-right text-sm tabular-nums text-[var(--ls-sand)]">
                    {masterVolume ?? 100}%
                  </span>
                </div>

                <Slider
                  value={[masterVolume ?? 100]}
                  onValueChange={(value) => setMasterVolume(value[0])}
                  max={100}
                  step={1}
                  aria-label="master volume"
                  className={sliderClassName}
                />
              </section>

              <section className="space-y-5" aria-label="sound layers">
                {soundLayers.map((layer) => {
                  const IconComponent = layer.icon
                  const volume = volumes[layer.id] ?? layer.defaultVolume

                  return (
                    <div key={layer.id} className="space-y-3">
                      <div className="flex items-center gap-3">
                        <div className="flex h-10 w-10 items-center justify-center rounded-full border border-[var(--ls-border-strong)] text-[var(--ls-sand)]">
                          <IconComponent weight="regular" className="h-5 w-5" />
                        </div>

                        <div className="flex flex-1 items-center justify-between gap-3">
                          <span className="text-sm lowercase text-[var(--ls-text)]">
                            {layer.label}
                          </span>
                          <span className="min-w-[46px] text-right text-sm tabular-nums text-[var(--ls-text-muted)]">
                            {volume}%
                          </span>
                        </div>
                      </div>

                      <div className="pl-[52px]">
                        <Slider
                          value={[volume]}
                          onValueChange={(value) => handleVolumeChange(layer.id, value)}
                          max={100}
                          step={1}
                          aria-label={`${layer.label} volume`}
                          className={sliderClassName}
                        />
                      </div>
                    </div>
                  )
                })}
              </section>

              <div className="mt-6 flex items-start gap-3 rounded-md border border-[var(--ls-border)] bg-[var(--ls-bg)]/35 p-3">
                <Info
                  weight="regular"
                  className="mt-0.5 h-4 w-4 shrink-0 text-[var(--ls-sand-dim)]"
                />
                <p className="text-xs leading-relaxed text-[var(--ls-text-muted)]">
                  background sounds are baked into each session at generation time.
                  choose a different background from the create screen to change them.
                </p>
              </div>

              <div className="mt-8 border-t border-[var(--ls-border)] pt-6">
                <button
                  type="button"
                  onClick={handleResetToDefault}
                  className="text-sm lowercase text-[var(--ls-sand)] transition-colors hover:text-[var(--ls-text)] focus:outline-none focus-visible:ring-1 focus-visible:ring-[var(--ls-sand-dim)]"
                >
                  reset to default
                </button>
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  )
}
