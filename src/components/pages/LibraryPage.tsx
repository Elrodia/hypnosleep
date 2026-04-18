import { useState, useRef, useEffect, useMemo } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useAudioPlayer } from '@/contexts/AudioPlayerContext'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { PlusCircle, MagnifyingGlass, X, Heart, FunnelSimple, Check, Spinner, WarningCircle } from '@phosphor-icons/react'
import { motion, AnimatePresence } from 'framer-motion'
import { SessionCard } from '@/components/SessionCard'
import { SessionDetailPage } from './SessionDetailPage'
import { SwipeableSessionCard } from '@/components/SwipeableSessionCard'
import { toast } from 'sonner'
import {
  listSessions,
  toggleSessionFavorite,
  deleteSession,
  type ListSessionsParams,
} from '@/lib/api-endpoints'
import { toUISession } from '@/lib/session-ui'

type FilterCategory = 'All' | 'Sleep' | 'Confidence' | 'Fears' | 'Habits' | 'Focus' | 'Custom'
type ViewMode = 'all' | 'favorites'
type SortOption = 'newest' | 'oldest' | 'most_played' | 'shortest' | 'longest'

const filterCategories: FilterCategory[] = ['All', 'Sleep', 'Confidence', 'Fears', 'Habits', 'Focus', 'Custom']

const sortOptions: { value: SortOption; label: string }[] = [
  { value: 'newest', label: 'Newest First' },
  { value: 'oldest', label: 'Oldest First' },
  { value: 'most_played', label: 'Most Played' },
  { value: 'shortest', label: 'Shortest Duration' },
  { value: 'longest', label: 'Longest Duration' },
]

export function LibraryPage() {
  const [viewMode, setViewMode] = useState<ViewMode>('all')
  const [activeFilter, setActiveFilter] = useState<FilterCategory>('All')
  const [searchQuery, setSearchQuery] = useState('')
  const [activeSortOption, setActiveSortOption] = useState<SortOption>('newest')
  const [showSortDropdown, setShowSortDropdown] = useState(false)
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null)
  const sortButtonRef = useRef<HTMLButtonElement>(null)
  const sortDropdownRef = useRef<HTMLDivElement>(null)
  const { play } = useAudioPlayer()
  const qc = useQueryClient()

  // Debounce search input so we don't hammer the backend on every
  // keystroke. 300ms matches the feel of other search-as-you-type UIs.
  const [debouncedSearch, setDebouncedSearch] = useState('')
  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(searchQuery.trim()), 300)
    return () => clearTimeout(t)
  }, [searchQuery])

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        sortDropdownRef.current &&
        !sortDropdownRef.current.contains(event.target as Node) &&
        sortButtonRef.current &&
        !sortButtonRef.current.contains(event.target as Node)
      ) {
        setShowSortDropdown(false)
      }
    }
    if (showSortDropdown) {
      document.addEventListener('mousedown', handleClickOutside)
    }
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [showSortDropdown])

  const queryParams = useMemo<ListSessionsParams>(() => ({
    category: activeFilter === 'All' ? 'all' : activeFilter.toLowerCase(),
    search: debouncedSearch || undefined,
    sort: activeSortOption,
    favoritesOnly: viewMode === 'favorites',
    limit: 50,
  }), [activeFilter, debouncedSearch, activeSortOption, viewMode])

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['sessions', queryParams],
    queryFn: () => listSessions(queryParams),
  })

  const favoriteMutation = useMutation({
    mutationFn: (id: string) => toggleSessionFavorite(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['sessions'] }),
    onError: () => toast.error('Could not update favorite.'),
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteSession(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['sessions'] })
      toast.success('Session deleted')
    },
    onError: () => toast.error('Could not delete session.'),
  })

  const uiSessions = useMemo(() => (data?.data ?? []).map(toUISession), [data])

  const handlePlaySession = (session: ReturnType<typeof toUISession>) => {
    play({
      sessionId: session.status === 'ready' ? session.id : undefined,
      title: session.title,
      category: session.category,
      duration: 600,
    })
  }

  const handleToggleFavorite = (id: string, _isFavorited: boolean) => {
    favoriteMutation.mutate(id)
  }

  const handleRemoveFavorite = (id: string) => {
    favoriteMutation.mutate(id)
  }

  const handleSessionClick = (sessionId: string) => setSelectedSessionId(sessionId)
  const handleBackFromDetail = () => setSelectedSessionId(null)
  const handlePlayFromDetail = () => {
    const s = uiSessions.find((x) => x.id === selectedSessionId)
    if (s) handlePlaySession(s)
  }

  if (selectedSessionId) {
    return (
      <SessionDetailPage
        sessionId={selectedSessionId}
        onBack={handleBackFromDetail}
        onPlay={handlePlayFromDetail}
        onDeleted={() => {
          setSelectedSessionId(null)
        }}
      />
    )
  }

  return (
    <div className="p-4 pb-6">
      <h1 className="text-2xl font-semibold tracking-tight mb-6">Library</h1>

      <div className="mb-6 flex items-center justify-center">
        <div className="inline-flex items-center gap-1 p-1 bg-card rounded-lg border border-border">
          <button
            onClick={() => setViewMode('all')}
            className={`px-6 py-2 rounded-md text-sm font-medium transition-all duration-200 ${
              viewMode === 'all'
                ? 'bg-primary text-primary-foreground shadow-md'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            All
          </button>
          <button
            onClick={() => setViewMode('favorites')}
            className={`px-6 py-2 rounded-md text-sm font-medium transition-all duration-200 flex items-center gap-2 ${
              viewMode === 'favorites'
                ? 'bg-primary text-primary-foreground shadow-md'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            <Heart weight={viewMode === 'favorites' ? 'fill' : 'regular'} className="w-4 h-4" />
            Favorites
          </button>
        </div>
      </div>

      <div className="mb-6 -mx-4 px-4">
        <div className="flex gap-2 overflow-x-auto scrollbar-hide pb-2">
          {filterCategories.map((category) => {
            const isActive = activeFilter === category
            return (
              <button
                key={category}
                onClick={() => setActiveFilter(category)}
                className={`flex-shrink-0 px-4 py-2 rounded-full text-sm font-medium transition-all duration-200 ${
                  isActive
                    ? 'bg-primary text-primary-foreground shadow-lg shadow-primary/30'
                    : 'bg-transparent border border-border text-foreground hover:border-primary/50'
                }`}
              >
                {category}
              </button>
            )
          })}
        </div>
      </div>

      <div className="mb-6 flex gap-3">
        <div className="relative flex-1">
          <MagnifyingGlass
            className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground pointer-events-none"
            weight="bold"
          />
          <Input
            type="text"
            placeholder="Search sessions..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-11 pr-10 h-12 bg-card border-border focus-visible:ring-primary"
          />
          <AnimatePresence>
            {searchQuery && (
              <motion.button
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.8 }}
                transition={{ duration: 0.15 }}
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 w-6 h-6 rounded-full bg-muted hover:bg-muted/80 flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors"
              >
                <X className="w-4 h-4" weight="bold" />
              </motion.button>
            )}
          </AnimatePresence>
        </div>

        <div className="relative">
          <button
            ref={sortButtonRef}
            onClick={() => setShowSortDropdown(!showSortDropdown)}
            className="h-12 w-12 rounded-lg bg-card border border-border hover:bg-card/80 flex items-center justify-center text-foreground transition-colors"
          >
            <FunnelSimple className="w-5 h-5" weight="bold" />
          </button>

          <AnimatePresence>
            {showSortDropdown && (
              <motion.div
                ref={sortDropdownRef}
                initial={{ opacity: 0, y: -10, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -10, scale: 0.95 }}
                transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
                className="absolute right-0 top-14 w-56 bg-card border border-border rounded-xl shadow-xl overflow-hidden z-50"
              >
                {sortOptions.map((option) => {
                  const isActive = activeSortOption === option.value
                  return (
                    <button
                      key={option.value}
                      onClick={() => {
                        setActiveSortOption(option.value)
                        setShowSortDropdown(false)
                      }}
                      className={`w-full px-4 py-3 flex items-center justify-between text-left transition-colors ${
                        isActive ? 'bg-primary/10 text-primary' : 'text-foreground hover:bg-muted'
                      }`}
                    >
                      <span className="font-medium text-sm">{option.label}</span>
                      {isActive && (
                        <motion.div
                          initial={{ scale: 0, opacity: 0 }}
                          animate={{ scale: 1, opacity: 1 }}
                          transition={{ duration: 0.2, ease: 'backOut' }}
                        >
                          <Check className="w-5 h-5" weight="bold" />
                        </motion.div>
                      )}
                    </button>
                  )
                })}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {isLoading ? (
        <div className="flex flex-col items-center justify-center py-16 px-4">
          <Spinner size={32} className="text-primary animate-spin mb-4" />
          <p className="text-sm text-muted-foreground">Loading your sessions…</p>
        </div>
      ) : isError ? (
        <div className="flex flex-col items-center justify-center py-16 px-4">
          <WarningCircle size={48} className="text-destructive mb-4" />
          <h2 className="text-lg font-semibold mb-2">Couldn't load sessions</h2>
          <p className="text-sm text-muted-foreground mb-4">Please check your connection and try again.</p>
          <Button onClick={() => void refetch()}>Retry</Button>
        </div>
      ) : uiSessions.length === 0 ? (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
          className="flex flex-col items-center justify-center py-16 px-4"
        >
          {viewMode === 'favorites' ? (
            <>
              <div className="mb-6 text-8xl opacity-20">❤️</div>
              <h2 className="text-xl font-semibold mb-2 text-center">No favorites yet</h2>
              <p className="text-muted-foreground text-center mb-8 max-w-sm">
                Tap the heart on any session to save it here.
              </p>
            </>
          ) : searchQuery ? (
            <>
              <div className="mb-6 text-8xl opacity-20">🔍</div>
              <h2 className="text-xl font-semibold mb-2 text-center">No results for '{searchQuery}'</h2>
              <p className="text-muted-foreground text-center mb-8 max-w-sm">
                We couldn't find any sessions matching your search. Try different keywords or create a new session.
              </p>
              <Button
                size="lg"
                className="gap-2"
                onClick={() => window.dispatchEvent(new CustomEvent('navigate-to-tab', { detail: 'create' }))}
              >
                <PlusCircle weight="fill" className="w-5 h-5" />
                Create New Session
              </Button>
            </>
          ) : (
            <>
              <div className="mb-6 text-8xl opacity-20">📚</div>
              <h2 className="text-xl font-semibold mb-2 text-center">No sessions yet</h2>
              <p className="text-muted-foreground text-center mb-8 max-w-sm">
                Create your first session and start your journey to better sleep and self-improvement.
              </p>
              <Button
                size="lg"
                className="gap-2"
                onClick={() => window.dispatchEvent(new CustomEvent('navigate-to-tab', { detail: 'create' }))}
              >
                <PlusCircle weight="fill" className="w-5 h-5" />
                Create Your First Session
              </Button>
            </>
          )}
        </motion.div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          {uiSessions.map((session, index) => (
            <motion.div
              key={session.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, delay: index * 0.05 }}
            >
              {viewMode === 'favorites' ? (
                <SwipeableSessionCard
                  id={session.id}
                  title={session.title}
                  category={session.category}
                  duration={session.duration}
                  gradient={session.gradient}
                  isFavorited={session.isFavorited}
                  onPlay={() => handlePlaySession(session)}
                  onToggleFavorite={handleToggleFavorite}
                  onRemove={handleRemoveFavorite}
                  onClick={() => handleSessionClick(session.id)}
                  searchQuery={searchQuery}
                />
              ) : (
                <SessionCard
                  id={session.id}
                  title={session.title}
                  category={session.category}
                  duration={session.duration}
                  gradient={session.gradient}
                  isFavorited={session.isFavorited}
                  onPlay={() => handlePlaySession(session)}
                  onToggleFavorite={handleToggleFavorite}
                  onClick={() => handleSessionClick(session.id)}
                  searchQuery={searchQuery}
                />
              )}
            </motion.div>
          ))}
        </div>
      )}
    </div>
  )
}
