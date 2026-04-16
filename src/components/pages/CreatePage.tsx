import { useState, useEffect } from 'react'
import { useKV } from '@github/spark/hooks'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Sparkle } from '@phosphor-icons/react'
import { toast } from 'sonner'
import { motion, AnimatePresence } from 'framer-motion'

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

export function CreatePage() {
  const [sessions, setSessions] = useKV<LibrarySession[]>('library-sessions', [])
  const [inputValue, setInputValue] = useState('')
  const [placeholderIndex, setPlaceholderIndex] = useState(0)
  const [isGenerating, setIsGenerating] = useState(false)

  useEffect(() => {
    const interval = setInterval(() => {
      setPlaceholderIndex((prev) => (prev + 1) % PLACEHOLDER_EXAMPLES.length)
    }, 3000)

    return () => clearInterval(interval)
  }, [])

  const handleGenerate = async () => {
    if (!inputValue.trim()) return

    setIsGenerating(true)
    toast.info('Generating your session...')

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
    }, 2000)
  }

  const charCount = inputValue.length
  const isOverLimit = charCount > MAX_CHARS
  const isEmpty = inputValue.trim().length === 0

  return (
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
  )
}
