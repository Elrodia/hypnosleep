import { useKV } from '@github/spark/hooks'
import { Button } from '@/components/ui/button'
import { PlusCircle } from '@phosphor-icons/react'
import { toast } from 'sonner'

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

export function CreatePage() {
  const [sessions, setSessions] = useKV<LibrarySession[]>('library-sessions', [])

  const createSampleSessions = () => {
    const sampleSessions: LibrarySession[] = [
      {
        id: 'session-1',
        title: 'Deep Sleep Journey',
        category: 'Sleep',
        duration: '20 min',
        gradient: 'from-indigo-600 to-purple-600',
        playCount: 342,
        createdAt: Date.now() - 86400000 * 3,
        isFavorited: false,
      },
      {
        id: 'session-2',
        title: 'Confidence Boost',
        category: 'Confidence',
        duration: '15 min',
        gradient: 'from-purple-600 to-pink-600',
        playCount: 128,
        createdAt: Date.now() - 86400000 * 2,
        isFavorited: true,
      },
      {
        id: 'session-3',
        title: 'Overcome Fear of Public Speaking',
        category: 'Fears',
        duration: '25 min',
        gradient: 'from-violet-600 to-indigo-600',
        playCount: 89,
        createdAt: Date.now() - 86400000 * 5,
        isFavorited: false,
      },
      {
        id: 'session-4',
        title: 'Quit Smoking Forever',
        category: 'Habits',
        duration: '30 min',
        gradient: 'from-blue-600 to-cyan-600',
        playCount: 234,
        createdAt: Date.now() - 86400000 * 7,
        isFavorited: false,
      },
      {
        id: 'session-5',
        title: 'Laser Focus',
        category: 'Focus',
        duration: '10 min',
        gradient: 'from-teal-600 to-emerald-600',
        playCount: 456,
        createdAt: Date.now() - 86400000,
        isFavorited: true,
      },
      {
        id: 'session-6',
        title: 'Morning Motivation',
        category: 'Custom',
        duration: '12 min',
        gradient: 'from-fuchsia-600 to-purple-600',
        playCount: 167,
        createdAt: Date.now() - 86400000 * 4,
        isFavorited: false,
      },
    ]

    setSessions(sampleSessions)
    toast.success('Sample sessions created!')
  }

  return (
    <div className="p-4">
      <h1 className="text-2xl font-semibold tracking-tight mb-6">Create</h1>
      <div className="space-y-4">
        <div className="bg-card border border-border rounded-lg p-6">
          <h2 className="text-lg font-medium mb-2">Create Session</h2>
          <p className="text-muted-foreground mb-4">
            Design your personalized sleep session.
          </p>
          
          <Button
            onClick={createSampleSessions}
            size="lg"
            className="gap-2"
          >
            <PlusCircle weight="fill" size={20} />
            Add Sample Sessions
          </Button>
          
          <p className="text-xs text-muted-foreground mt-4">
            {sessions?.length || 0} sessions in library
          </p>
        </div>
      </div>
    </div>
  )
}
