import { useEffect, useState } from 'react'
import { useAudioPlayer } from '@/contexts/AudioPlayerContext'
import { useToast } from '@/contexts/ToastContext'
import { SlideUpModal } from '@/components/SlideUpModal'
import { Button } from '@/components/ui/button'
import { Play, Stop, Gift, Bell } from '@phosphor-icons/react'

export function HomePage() {
  const { player, play, stop, setProgress } = useAudioPlayer()
  const { showToast } = useToast()
  const [isModalOpen, setIsModalOpen] = useState(false)

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

        <div className="bg-card border border-border rounded-lg p-6">
          <h2 className="text-lg font-medium mb-2 flex items-center gap-2">
            <Bell weight="fill" className="text-primary" />
            Toast Notifications Demo
          </h2>
          <p className="text-muted-foreground mb-4">
            Test the toast notification system with different variants.
          </p>
          
          <div className="flex flex-wrap gap-2">
            <Button 
              onClick={() => showToast('Session saved successfully!', 'success')}
              size="sm"
              className="bg-emerald-500 hover:bg-emerald-600"
            >
              Show Success
            </Button>
            <Button 
              onClick={() => showToast('Failed to load content', 'error')}
              size="sm"
              className="bg-rose-500 hover:bg-rose-600"
            >
              Show Error
            </Button>
            <Button 
              onClick={() => showToast('New meditation available', 'info')}
              size="sm"
            >
              Show Info
            </Button>
          </div>
        </div>

        <div className="bg-card border border-border rounded-lg p-6">
          <h2 className="text-lg font-medium mb-2 flex items-center gap-2">
            <Gift weight="fill" className="text-primary" />
            Slide-Up Modal Demo
          </h2>
          <p className="text-muted-foreground mb-4">
            Drag the handle or swipe down to dismiss the modal.
          </p>
          
          <Button 
            onClick={() => setIsModalOpen(true)}
            variant="outline"
          >
            Open Modal
          </Button>
        </div>
      </div>

      <SlideUpModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title="Sleep Session Settings"
      >
        <div className="space-y-6">
          <div>
            <h3 className="font-medium mb-2">Session Duration</h3>
            <p className="text-sm text-muted-foreground mb-3">
              Choose how long you'd like your sleep session to last.
            </p>
            <div className="grid grid-cols-3 gap-2">
              <Button variant="outline" size="sm">15 min</Button>
              <Button variant="outline" size="sm">30 min</Button>
              <Button variant="outline" size="sm">60 min</Button>
            </div>
          </div>

          <div>
            <h3 className="font-medium mb-2">Background Sound</h3>
            <p className="text-sm text-muted-foreground mb-3">
              Select a relaxing background to accompany your session.
            </p>
            <div className="grid grid-cols-2 gap-2">
              <Button variant="outline" size="sm">Rain</Button>
              <Button variant="outline" size="sm">Ocean</Button>
              <Button variant="outline" size="sm">Forest</Button>
              <Button variant="outline" size="sm">White Noise</Button>
            </div>
          </div>

          <div>
            <h3 className="font-medium mb-2">Voice Guidance</h3>
            <p className="text-sm text-muted-foreground mb-3">
              Enable voice-guided meditation during your session.
            </p>
            <div className="flex gap-2">
              <Button variant="outline" size="sm">Male Voice</Button>
              <Button variant="outline" size="sm">Female Voice</Button>
              <Button variant="outline" size="sm">None</Button>
            </div>
          </div>

          <Button 
            className="w-full" 
            onClick={() => {
              setIsModalOpen(false)
              showToast('Session configured successfully!', 'success')
            }}
          >
            Start Custom Session
          </Button>
        </div>
      </SlideUpModal>
    </div>
  )
}
