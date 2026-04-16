import { useState, useEffect } from 'react'
import { useKV } from '@github/spark/hooks'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Slider } from '@/components/ui/slider'
import { Switch } from '@/components/ui/switch'
import { Sparkle, Play, Drop, Waves, Tree, Wind, SpeakerSlash, CaretDown } from '@phosphor-icons/react'
import { toast } from 'sonner'
import { motion, AnimatePresence } from 'framer-motion'
import { GenerationLoadingOverlay } from '@/components/GenerationLoadingOverlay'

interface LibrarySession {
  id: string
  title: string
  category: 'Sleep' | 'Confidence' | 'Fears' | 'Habits' | 'Focus' | 'Custom'
  duration: string
  gradient: string
  playCount: number
  createdAt: number
  isFavorited?: boolean
}

const PLACEHOLDER_EXAMPLES = [
  'Help me fall asleep in 10 minutes',
  'Boost my confidence for a job interview',
  'Release my fear of public speaking',
]

const MAX_CHARS = 500

const VOICE_OPTIONS = [
  { id: 'calm-female', label: 'Calm Female' },
  { id: 'deep-male', label: 'Deep Male' },
  { id: 'soft-whisper', label: 'Soft Whisper' },
  { id: 'gentle-british', label: 'Gentle British' },
  { id: 'warm-australian', label: 'Warm Australian' },
]

const BACKGROUND_SOUNDS = [
  { id: 'rain', label: 'Rain', icon: Drop },
  { id: 'ocean', label: 'Ocean', icon: Waves },
  { id: 'forest', label: 'Forest', icon: Tree },
  { id: 'wind', label: 'Wind', icon: Wind },
  { id: 'silence', label: 'Silence', icon: SpeakerSlash },
]

const INDUCTION_STYLES = [
  { id: 'progressive', label: 'Progressive Relaxation' },
  { id: 'countdown', label: 'Countdown' },
  { id: 'body-scan', label: 'Body Scan' },
]

type DepthLevel = 'light' | 'medium' | 'deep'

export function CreatePage() {
  const [sessions, setSessions] = useKV<LibrarySession[]>('library-sessions', [])
  const [inputValue, setInputValue] = useState('')
  const [placeholderIndex, setPlaceholderIndex] = useState(0)
  const [isGenerating, setIsGenerating] = useState(false)
  const [selectedVoice, setSelectedVoice] = useState('calm-female')
  const [sessionLength, setSessionLength] = useState([15])
  const [backgroundSound, setBackgroundSound] = useState('rain')
  const [isAdvancedOpen, setIsAdvancedOpen] = useState(false)
  const [inductionStyle, setInductionStyle] = useState('progressive')
  const [depthLevel, setDepthLevel] = useState<DepthLevel>('medium')
  const [wakeUpEnding, setWakeUpEnding] = useState(true)

  useEffect(() => {
    const interval = setInterval(() => {
      setPlaceholderIndex((prev) => (prev + 1) % PLACEHOLDER_EXAMPLES.length)
    }, 3000)

    return () => clearInterval(interval)
  }, [])

  const handleGenerate = async () => {
    if (!inputValue.trim()) return

    setIsGenerating(true)

    setTimeout(() => {
      const newSession: LibrarySession = {
        id: `session-${Date.now()}`,
        title: inputValue.slice(0, 50),
        category: 'Custom',
        duration: '15 min',
        gradient: 'from-purple-600 to-indigo-600',
        playCount: 0,
        createdAt: Date.now(),
        isFavorited: false,
      }

      setSessions((currentSessions) => [newSession, ...(currentSessions || [])])
      toast.success('Session created successfully!')
      setInputValue('')
      setIsGenerating(false)
    }, 28000)
  }

  const handleCancelGeneration = () => {
    setIsGenerating(false)
    toast.info('Session generation cancelled')
  }

  const charCount = inputValue.length
  const isOverLimit = charCount > MAX_CHARS
  const isEmpty = inputValue.trim().length === 0

  return (
    <>
      <div className="min-h-[calc(100vh-14rem)] flex items-center justify-center p-6">
        <div className="w-full max-w-2xl space-y-6">
          <div className="relative">
            <Textarea
              id="session-description"
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              className="min-h-[240px] text-base resize-none bg-card/50 backdrop-blur-sm border-2 focus-visible:ring-2 focus-visible:ring-primary/50"
              maxLength={MAX_CHARS}
            />
            
            {isEmpty && (
              <div className="absolute top-3 left-3 pointer-events-none">
                <div className="text-muted-foreground/60">
                  <div className="mb-1">Describe what you want to work on...</div>
                  <AnimatePresence mode="wait">
                    <motion.div
                      key={placeholderIndex}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -10 }}
                      transition={{ duration: 0.3 }}
                      className="text-sm italic text-primary/40"
                    >
                      {PLACEHOLDER_EXAMPLES[placeholderIndex]}
                    </motion.div>
                  </AnimatePresence>
                </div>
              </div>
            )}

            <div
              className={`absolute bottom-3 right-3 text-xs font-medium transition-colors ${
                isOverLimit
                  ? 'text-destructive'
                  : charCount > MAX_CHARS * 0.9
                  ? 'text-yellow-500'
                  : 'text-muted-foreground'
              }`}
            >
              {charCount}/{MAX_CHARS}
            </div>
          </div>

          <div className="space-y-6">
            <div className="space-y-3">
              <h3 className="text-sm font-medium text-foreground">Voice</h3>
              <div className="flex gap-3 overflow-x-auto scrollbar-hide pb-2">
                {VOICE_OPTIONS.map((voice) => (
                  <button
                    key={voice.id}
                    onClick={() => setSelectedVoice(voice.id)}
                    className={`flex items-center gap-2 px-4 py-2.5 rounded-full whitespace-nowrap transition-all shrink-0 ${
                      selectedVoice === voice.id
                        ? 'bg-primary text-primary-foreground shadow-lg shadow-primary/20'
                        : 'bg-card/50 text-foreground hover:bg-card border border-border'
                    }`}
                  >
                    <span className="text-sm font-medium">{voice.label}</span>
                    <Play
                      weight="fill"
                      size={14}
                      className={selectedVoice === voice.id ? 'opacity-100' : 'opacity-50'}
                    />
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-4">
              <h3 className="text-sm font-medium text-foreground">Session Length</h3>
              <div className="relative pt-8 pb-2">
                <Slider
                  value={sessionLength}
                  onValueChange={setSessionLength}
                  min={5}
                  max={30}
                  step={5}
                  className="[&_[data-slot=slider-track]]:h-2 [&_[data-slot=slider-thumb]]:size-7 [&_[data-slot=slider-thumb]]:border-4"
                />
                <div
                  className="absolute -top-1 text-2xl font-bold text-primary transition-all duration-200 pointer-events-none"
                  style={{
                    left: `calc(${((sessionLength[0] - 5) / (30 - 5)) * 100}% - 20px)`,
                  }}
                >
                  {sessionLength[0]} min
                </div>
              </div>
              <div className="flex justify-between text-xs text-muted-foreground px-1">
                <span>5 min</span>
                <span>30 min</span>
              </div>
            </div>

            <div className="space-y-3">
              <h3 className="text-sm font-medium text-foreground">Background Sound</h3>
              <div className="flex gap-3 justify-between">
                {BACKGROUND_SOUNDS.map((sound) => {
                  const Icon = sound.icon
                  return (
                    <button
                      key={sound.id}
                      onClick={() => setBackgroundSound(sound.id)}
                      className={`flex flex-col items-center justify-center gap-2 p-4 rounded-xl transition-all aspect-square flex-1 ${
                        backgroundSound === sound.id
                          ? 'bg-primary text-primary-foreground shadow-lg shadow-primary/20'
                          : 'bg-card/50 text-foreground hover:bg-card border border-border'
                      }`}
                      title={sound.label}
                    >
                      <Icon
                        weight={backgroundSound === sound.id ? 'fill' : 'regular'}
                        size={24}
                      />
                      <span className="text-xs font-medium">{sound.label}</span>
                    </button>
                  )
                })}
              </div>
            </div>

            <div className="border-t border-border pt-4">
              <button
                onClick={() => setIsAdvancedOpen(!isAdvancedOpen)}
                className="flex items-center justify-between w-full text-left group"
              >
                <h3 className="text-sm font-medium text-foreground group-hover:text-primary transition-colors">
                  Advanced Settings
                </h3>
                <CaretDown
                  size={18}
                  weight="bold"
                  className={`text-muted-foreground group-hover:text-primary transition-all duration-300 ${
                    isAdvancedOpen ? 'rotate-180' : ''
                  }`}
                />
              </button>

              <AnimatePresence initial={false}>
                {isAdvancedOpen && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.3, ease: 'easeInOut' }}
                    className="overflow-hidden"
                  >
                    <div className="pt-4 space-y-5">
                      <div className="space-y-3">
                        <h4 className="text-sm font-medium text-foreground">Induction Style</h4>
                        <div className="flex gap-2">
                          {INDUCTION_STYLES.map((style) => (
                            <button
                              key={style.id}
                              onClick={() => setInductionStyle(style.id)}
                              className={`flex-1 px-3 py-2.5 rounded-lg text-xs font-medium transition-all ${
                                inductionStyle === style.id
                                  ? 'bg-primary text-primary-foreground shadow-md shadow-primary/20'
                                  : 'bg-card/50 text-foreground hover:bg-card border border-border'
                              }`}
                            >
                              {style.label}
                            </button>
                          ))}
                        </div>
                      </div>

                      <div className="space-y-3">
                        <h4 className="text-sm font-medium text-foreground">Depth Level</h4>
                        <div className="flex gap-4 justify-center items-center py-2">
                          <button
                            onClick={() => setDepthLevel('light')}
                            className="flex flex-col items-center gap-2 group"
                          >
                            <div
                              className={`w-12 h-12 rounded-full border-2 transition-all ${
                                depthLevel === 'light'
                                  ? 'border-primary bg-primary/10 scale-110'
                                  : 'border-border hover:border-primary/50'
                              }`}
                            />
                            <span
                              className={`text-xs font-medium transition-colors ${
                                depthLevel === 'light' ? 'text-primary' : 'text-muted-foreground'
                              }`}
                            >
                              Light
                            </span>
                          </button>

                          <button
                            onClick={() => setDepthLevel('medium')}
                            className="flex flex-col items-center gap-2 group"
                          >
                            <div
                              className={`w-12 h-12 rounded-full border-2 relative overflow-hidden transition-all ${
                                depthLevel === 'medium'
                                  ? 'border-primary scale-110'
                                  : 'border-border hover:border-primary/50'
                              }`}
                            >
                              <div
                                className={`absolute inset-0 transition-colors ${
                                  depthLevel === 'medium' ? 'bg-primary' : 'bg-border'
                                }`}
                                style={{
                                  clipPath: 'polygon(0 50%, 100% 50%, 100% 100%, 0 100%)',
                                }}
                              />
                            </div>
                            <span
                              className={`text-xs font-medium transition-colors ${
                                depthLevel === 'medium' ? 'text-primary' : 'text-muted-foreground'
                              }`}
                            >
                              Medium
                            </span>
                          </button>

                          <button
                            onClick={() => setDepthLevel('deep')}
                            className="flex flex-col items-center gap-2 group"
                          >
                            <div
                              className={`w-12 h-12 rounded-full border-2 transition-all ${
                                depthLevel === 'deep'
                                  ? 'border-primary bg-primary scale-110'
                                  : 'border-border bg-border hover:border-primary/50'
                              }`}
                            />
                            <span
                              className={`text-xs font-medium transition-colors ${
                                depthLevel === 'deep' ? 'text-primary' : 'text-muted-foreground'
                              }`}
                            >
                              Deep
                            </span>
                          </button>
                        </div>
                      </div>

                      <div className="flex items-center justify-between py-2">
                        <div className="flex-1">
                          <h4 className="text-sm font-medium text-foreground">Wake-Up Ending</h4>
                          <p className="text-xs text-muted-foreground mt-1">
                            Gently bring me back at the end
                          </p>
                        </div>
                        <Switch checked={wakeUpEnding} onCheckedChange={setWakeUpEnding} />
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>

          <Button
            size="lg"
            onClick={handleGenerate}
            disabled={isEmpty || isOverLimit || isGenerating}
            className="w-full gap-2 text-base font-medium h-12"
          >
            <Sparkle weight="fill" size={20} />
            {isGenerating ? 'Generating...' : 'Generate Session'}
          </Button>
        </div>
      </div>

      <GenerationLoadingOverlay isOpen={isGenerating} onCancel={handleCancelGeneration} />
    </>
  )
}
