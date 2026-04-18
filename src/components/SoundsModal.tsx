import { motion, AnimatePresence } from 'framer-motion'
import { X, Microphone, CloudRain, Waves, Tree, Wind, RadioButton, Icon } from '@phosphor-icons/react'
import { useKV } from '@/hooks/use-kv'
import { Slider } from './ui/slider'

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
  { id: 'voice', label: 'Voice', icon: Microphone, defaultVolume: 80 },
  { id: 'rain', label: 'Rain', icon: CloudRain, defaultVolume: 30 },
  { id: 'ocean', label: 'Ocean', icon: Waves, defaultVolume: 25 },
  { id: 'forest', label: 'Forest', icon: Tree, defaultVolume: 20 },
  { id: 'wind', label: 'Wind', icon: Wind, defaultVolume: 15 },
  { id: 'whiteNoise', label: 'White Noise', icon: RadioButton, defaultVolume: 10 },
]

export function SoundsModal({ isOpen, onClose }: SoundsModalProps) {
  const [masterVolume, setMasterVolume] = useKV<number>('sound-master-volume', 100)
  const [voiceVolume, setVoiceVolume] = useKV<number>('sound-voice-volume', 80)
  const [rainVolume, setRainVolume] = useKV<number>('sound-rain-volume', 30)
  const [oceanVolume, setOceanVolume] = useKV<number>('sound-ocean-volume', 25)
  const [forestVolume, setForestVolume] = useKV<number>('sound-forest-volume', 20)
  const [windVolume, setWindVolume] = useKV<number>('sound-wind-volume', 15)
  const [whiteNoiseVolume, setWhiteNoiseVolume] = useKV<number>('sound-whitenoise-volume', 10)

  const volumes = {
    voice: voiceVolume,
    rain: rainVolume,
    ocean: oceanVolume,
    forest: forestVolume,
    wind: windVolume,
    whiteNoise: whiteNoiseVolume,
  }

  const setters = {
    voice: setVoiceVolume,
    rain: setRainVolume,
    ocean: setOceanVolume,
    forest: setForestVolume,
    wind: setWindVolume,
    whiteNoise: setWhiteNoiseVolume,
  }

  const handleVolumeChange = (id: string, value: number[]) => {
    const setter = setters[id as keyof typeof setters]
    if (setter) {
      setter(value[0])
    }
  }

  const handleResetToDefault = () => {
    setMasterVolume(100)
    soundLayers.forEach((layer) => {
      const setter = setters[layer.id as keyof typeof setters]
      if (setter) {
        setter(layer.defaultVolume)
      }
    })
  }

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50"
            onClick={onClose}
          />

          <motion.div
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', damping: 30, stiffness: 300 }}
            className="fixed inset-x-0 bottom-0 z-50 bg-card rounded-t-3xl shadow-2xl max-h-[85vh] overflow-hidden"
          >
            <div className="w-12 h-1.5 bg-muted-foreground/30 rounded-full mx-auto mt-3 mb-4" />

            <div className="flex items-center justify-between px-6 pb-4">
              <h2 className="text-2xl font-semibold text-foreground">Sound Mixer</h2>
              <button
                onClick={onClose}
                className="w-9 h-9 flex items-center justify-center rounded-full bg-muted/50 hover:bg-muted active:scale-95 transition-all"
              >
                <X weight="bold" className="w-5 h-5 text-foreground" />
              </button>
            </div>

            <div className="px-6 pb-8 overflow-y-auto max-h-[calc(85vh-80px)] scrollbar-hide">
              <div className="mb-6 p-4 rounded-xl bg-primary/10 border border-primary/20">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-sm font-medium text-foreground">Master Volume</span>
                  <span className="text-sm font-bold text-primary">{masterVolume ?? 100}%</span>
                </div>
                <Slider
                  value={[masterVolume ?? 100]}
                  onValueChange={(value) => setMasterVolume(value[0])}
                  max={100}
                  step={1}
                  className="[&_[role=slider]]:bg-primary [&_[role=slider]]:border-primary"
                />
              </div>

              <div className="space-y-5">
                {soundLayers.map((layer) => {
                  const IconComponent = layer.icon
                  const volume = volumes[layer.id as keyof typeof volumes] ?? layer.defaultVolume

                  return (
                    <div key={layer.id} className="space-y-2">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 flex items-center justify-center rounded-full bg-muted">
                          <IconComponent weight="bold" className="w-5 h-5 text-muted-foreground" />
                        </div>
                        <div className="flex-1 flex items-center justify-between">
                          <span className="text-sm font-medium text-foreground">{layer.label}</span>
                          <span className="text-sm font-semibold text-primary min-w-[42px] text-right">
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
                          className="[&_[role=slider]]:bg-primary [&_[role=slider]]:border-primary"
                        />
                      </div>
                    </div>
                  )
                })}
              </div>

              <div className="mt-8 pt-6 border-t border-border">
                <button
                  onClick={handleResetToDefault}
                  className="text-sm font-medium text-primary hover:text-primary/80 active:scale-95 transition-all"
                >
                  Reset to Default
                </button>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}
