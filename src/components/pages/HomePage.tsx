import { useEffect } from 'react'
import { useAudioPlayer } from '@/contexts/AudioPlayerContext'
import { Button } from '@/components/ui/button'
import { Play, Stop } from '@phosphor-icons/react'

export function HomePage() {
  const { player, play, stop, setProgress } = useAudioPlayer()

  useEffect(() => {
    if (!player.isPlaying) return

    const interval = setInterval(() => {
      setProgress((prev) => {
        const newProgress = prev + 1
        if (newProgress >= 100) {
          clearInterval(interval)
          return 100
        }
        return newProgress
      })
    }, 1000)

    return () => clearInterval(interval)
  }, [player.isPlaying, setProgress])

  const handlePlayDemo = () => {
    play('Deep Sleep Hypnosis - Relaxation Session', 100)
  }

  return (
    <div className="p-4">
      <h1 className="text-2xl font-semibold tracking-tight mb-6">Home</h1>
      <div className="space-y-4">
        <div className="bg-card border border-border rounded-lg p-6">
          <h2 className="text-lg font-medium mb-2">Welcome to HypnoSleep</h2>
          <p className="text-muted-foreground mb-6">
            Your personal sleep companion for better rest and relaxation.
          </p>
          
          <div className="flex gap-3">
            {!player.isActive ? (
              <Button onClick={handlePlayDemo} className="gap-2">
                <Play weight="fill" />
                Try Demo Session
              </Button>
            ) : (
              <Button onClick={stop} variant="outline" className="gap-2">
                <Stop weight="fill" />
                Stop Session
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
