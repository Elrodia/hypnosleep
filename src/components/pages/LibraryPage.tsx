import { useState, useRef, useEffect, useMemo } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { motion, AnimatePresence } from 'framer-motion'
import { MagnifyingGlass, FunnelSimple, Check, Bell } from '@phosphor-icons/react'
import { toast } from 'sonner'
import { useTranslation } from 'react-i18next'
import { useAudioPlayer } from '@/contexts/AudioPlayerContext'
import { SessionCardLiminal } from '@/components/SessionCardLiminal'
import { SessionDetailPage } from './SessionDetailPage'
import {
  listSessions,
  toggleSessionFavorite,
  deleteSession,
  type ListSessionsParams,
  type SessionSummary,
} from '@/lib/api-endpoints'

type Filter = 'all' | 'favorites' | 'sleep' | 'confidence' | 'fears' | 'habits' | 'focus' | 'custom'
type SortOption = 'newest' | 'oldest' | 'most_played' | 'shortest' | 'longest'

const CATEGORY_ORDER: Filter[] = ['sleep', 'confidence', 'fears', 'habits', 'focus', 'custom']

const sortOptions: { value: SortOption; label: string }[] = [
  { value: 'newest', label: 'newest first' },
  { value: 'oldest', label: 'oldest first' },
  { value: 'most_played', label: 'most played' },
  { value: 'shortest', label: 'shortest duration' },
  { value: 'longest', label: 'longest duration' },
]

const STYLES = `
.ls-library{--ls-bg-base:#0a0a0f;--ls-bg-deep:#050507;--ls-bg-card:#0e0e14;--ls-fg-primary:#e8e6e1;--ls-fg-muted:#6b6a6f;--ls-fg-faint:#2a2a30;--ls-accent:#c9b6a3;--ls-glow:rgba(201,182,163,0.08);background:var(--ls-bg-base);color:var(--ls-fg-primary);font-family:'Inter',system-ui,sans-serif;min-height:100vh;position:relative;overflow:hidden;}
.ls-library__ambient{position:fixed;inset:-25%;background:radial-gradient(circle at 30% 20%,rgba(201,182,163,0.06),transparent 55%),radial-gradient(circle at 70% 80%,rgba(80,90,120,0.08),transparent 60%),radial-gradient(circle at 50% 50%,rgba(40,30,50,0.05),transparent 70%);animation:ls-lib-ambient 240s linear infinite;pointer-events:none;z-index:0;}
.ls-library__grain{position:fixed;inset:0;background-image:url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='160' height='160'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2' stitchTiles='stitch'/></filter><rect width='100%' height='100%' filter='url(%23n)' opacity='0.6'/></svg>");opacity:0.03;mix-blend-mode:overlay;pointer-events:none;z-index:1;}
.ls-library__vignette{position:fixed;inset:0;box-shadow:inset 0 0 200px var(--ls-bg-deep);pointer-events:none;z-index:2;}
.ls-library__content{position:relative;z-index:3;}
.ls-library__brand{font-weight:400;font-size:0.75rem;letter-spacing:0.15em;text-transform:uppercase;color:var(--ls-fg-primary);}
.ls-library__title{font-family:'Fraunces','Cormorant Garamond',serif;font-style:italic;font-weight:300;font-size:clamp(2rem,5vw,3rem);letter-spacing:-0.02em;line-height:1.1;text-transform:lowercase;color:var(--ls-fg-primary);margin:0;}
.ls-library__meta{font-family:'Inter',system-ui,sans-serif;font-weight:400;font-size:0.75rem;letter-spacing:0.1em;text-transform:uppercase;color:var(--ls-fg-muted);}
.ls-library__search-wrap{position:relative;display:flex;align-items:center;gap:14px;}
.ls-library__search{position:relative;flex:1;display:flex;align-items:center;border-bottom:1px solid var(--ls-fg-faint);transition:border-color 250ms ease;padding:8px 0;}
.ls-library__search:focus-within{border-bottom-color:var(--ls-accent);}
.ls-library__search-icon{color:var(--ls-fg-muted);margin-right:10px;flex-shrink:0;}
.ls-library__search-input{flex:1;background:transparent;border:none;outline:none;color:var(--ls-fg-primary);font-family:'Inter',system-ui,sans-serif;font-weight:400;font-size:0.875rem;text-transform:lowercase;letter-spacing:0.02em;}
.ls-library__search-input::placeholder{color:var(--ls-fg-muted);text-transform:lowercase;}
.ls-library__sort-btn{background:transparent;border:none;cursor:pointer;color:var(--ls-fg-muted);padding:6px;display:flex;align-items:center;justify-content:center;transition:color 200ms ease;}
.ls-library__sort-btn:hover{color:var(--ls-fg-primary);}
.ls-library__sort-menu{position:absolute;right:0;top:44px;width:220px;background:var(--ls-bg-card);border:1px solid var(--ls-fg-faint);border-radius:12px;overflow:hidden;z-index:50;box-shadow:0 10px 30px rgba(0,0,0,0.45);}
.ls-library__sort-item{width:100%;padding:12px 16px;background:transparent;border:none;cursor:pointer;display:flex;align-items:center;justify-content:space-between;color:var(--ls-fg-primary);font-family:'Inter',system-ui,sans-serif;font-weight:400;font-size:0.8125rem;text-transform:lowercase;letter-spacing:0.03em;text-align:left;transition:background 180ms ease,color 180ms ease;}
.ls-library__sort-item:hover{background:rgba(255,255,255,0.03);}
.ls-library__sort-item[data-active="true"]{color:var(--ls-accent);}
.ls-library__filters{display:flex;gap:0;align-items:center;overflow-x:auto;scrollbar-width:none;-ms-overflow-style:none;}
.ls-library__filters::-webkit-scrollbar{display:none;}
.ls-library__pill{position:relative;padding:6px 14px;background:transparent;border:none;cursor:pointer;color:var(--ls-fg-muted);font-family:'Inter',system-ui,sans-serif;font-weight:400;font-size:0.8125rem;letter-spacing:0.05em;text-transform:lowercase;flex-shrink:0;transition:color 220ms ease;}
.ls-library__pill:hover{color:var(--ls-fg-primary);}
.ls-library__pill[data-active="true"]{color:var(--ls-fg-primary);}
.ls-library__pill-underline{position:absolute;left:14px;right:14px;bottom:-2px;height:1px;background:var(--ls-accent);}
.ls-library__sep{color:var(--ls-fg-faint);font-size:0.8125rem;flex-shrink:0;user-select:none;}
.ls-library__skeleton{height:88px;background:var(--ls-bg-card);border:1px solid var(--ls-fg-faint);border-radius:14px;margin-bottom:12px;position:relative;overflow:hidden;}
.ls-library__skeleton::after{content:"";position:absolute;inset:0;background:linear-gradient(90deg,transparent,rgba(232,230,225,0.04),transparent);animation:ls-lib-shimmer 1.6s linear infinite;}
.ls-library__empty{display:flex;flex-direction:column;align-items:center;justify-content:center;padding:80px 24px;gap:18px;text-align:center;}
.ls-library__empty-line{font-family:'Fraunces','Cormorant Garamond',serif;font-style:italic;font-weight:300;font-size:1.25rem;color:var(--ls-fg-muted);text-transform:lowercase;margin:0;}
.ls-library__link{position:relative;background:transparent;border:none;cursor:pointer;color:var(--ls-accent);font-family:'Inter',system-ui,sans-serif;font-weight:400;font-size:0.875rem;letter-spacing:0.05em;text-transform:lowercase;padding:4px 0;}
.ls-library__link::after{content:"";position:absolute;left:0;right:0;bottom:0;height:1px;background:var(--ls-accent);transform:scaleX(0);transform-origin:left;transition:transform 280ms ease;}
.ls-library__link:hover::after{transform:scaleX(1);}
@keyframes ls-lib-ambient{from{transform:rotate(0deg);}to{transform:rotate(360deg);}}
@keyframes ls-lib-shimmer{from{transform:translateX(-100%);}to{transform:translateX(100%);}}
@media (prefers-reduced-motion:reduce){.ls-library__ambient{animation:none;}.ls-library__skeleton::after{animation:none;}}
`

function fireNavigateToCreate() {
  window.dispatchEvent(new CustomEvent('navigate-to-tab', { detail: 'create' }))
}

export function LibraryPage() {
  const { t } = useTranslation()
  const [activeFilter, setActiveFilter] = useState<Filter>('all')
  const [searchQuery, setSearchQuery] = useState('')
  const [activeSortOption, setActiveSortOption] = useState<SortOption>('newest')
  const [showSortDropdown, setShowSortDropdown] = useState(false)
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null)
  const sortButtonRef = useRef<HTMLButtonElement>(null)
  const sortDropdownRef = useRef<HTMLDivElement>(null)
  const { play } = useAudioPlayer()
  const qc = useQueryClient()

  // Debounce search input by 300ms.
  const [debouncedSearch, setDebouncedSearch] = useState('')
  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(searchQuery.trim()), 300)
    return () => clearTimeout(t)
  }, [searchQuery])

  // Click-outside handler for sort dropdown.
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

  const queryParams = useMemo<ListSessionsParams>(() => {
    const isFavorites = activeFilter === 'favorites'
    const category = activeFilter === 'all' || isFavorites ? 'all' : activeFilter
    return {
      category,
      search: debouncedSearch || undefined,
      sort: activeSortOption,
      favoritesOnly: isFavorites,
      limit: 50,
    }
  }, [activeFilter, debouncedSearch, activeSortOption])

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['sessions', queryParams],
    queryFn: () => listSessions(queryParams),
  })

  // Second, parallel query: global per-category counts for the current
  // user, used to hide pills whose category has zero sessions.
  const countsQuery = useQuery({
    queryKey: ['sessions-counts'],
    queryFn: () =>
      listSessions({ limit: 50, category: 'all', favoritesOnly: false }),
  })

  const categoryCounts = useMemo<Record<string, number>>(() => {
    const map: Record<string, number> = {}
    for (const s of countsQuery.data?.data ?? []) {
      const key = (s.category || 'custom').toLowerCase()
      map[key] = (map[key] ?? 0) + 1
    }
    return map
  }, [countsQuery.data])

  const favoriteMutation = useMutation({
    mutationFn: (id: string) => toggleSessionFavorite(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['sessions'] })
      qc.invalidateQueries({ queryKey: ['sessions-counts'] })
    },
    onError: () => toast.error(t('library.favoriteError')),
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteSession(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['sessions'] })
      qc.invalidateQueries({ queryKey: ['sessions-counts'] })
      toast.success(t('library.deleteSuccess'))
    },
    onError: () => toast.error(t('library.deleteError')),
  })
  // deleteMutation is kept in scope so the cache-invalidation
  // contract (sessions + sessions-counts) survives any future wiring
  // from the list view; the detail page owns the delete UX today.
  void deleteMutation

  const sessions: SessionSummary[] = data?.data ?? []

  const totalMinutes = useMemo(
    () => sessions.reduce((sum, s) => sum + Math.max(1, Math.round(s.durationSec / 60)), 0),
    [sessions],
  )

  const handlePlaySession = (s: SessionSummary) => {
    play({
      sessionId: s.id,
      title: s.title,
      category: s.category,
      duration: s.durationSec || 600,
    })
  }

  if (selectedSessionId) {
    return (
      <SessionDetailPage
        sessionId={selectedSessionId}
        onBack={() => setSelectedSessionId(null)}
        onPlay={() => {
          const s = sessions.find((x) => x.id === selectedSessionId)
          if (s) handlePlaySession(s)
        }}
        onDeleted={() => setSelectedSessionId(null)}
      />
    )
  }

  // Build the list of visible filter pills. `all` and `favorites` are
  // always present; categories appear only if the global count is > 0.
  const visiblePills: Filter[] = ['all', 'favorites', ...CATEGORY_ORDER.filter((c) => (categoryCounts[c] ?? 0) > 0)]

  return (
    <div className="ls-library">
      <style>{STYLES}</style>
      <div className="ls-library__ambient" aria-hidden="true" />
      <div className="ls-library__grain" aria-hidden="true" />
      <div className="ls-library__vignette" aria-hidden="true" />

      <div className="ls-library__content flex flex-col min-h-screen">
        <motion.header
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.5 }}
          className="flex items-center justify-between px-6 h-14"
        >
          <span className="ls-library__brand">{t('home.brand')}</span>
          <Bell size={18} weight="thin" aria-hidden="true" style={{ color: 'var(--ls-fg-muted)' }} />
        </motion.header>

        <main className="flex-1 px-6 pt-6 pb-12 max-w-2xl w-full mx-auto">
          <motion.h1
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="ls-library__title"
          >
            {t('library.title')}
          </motion.h1>

          {sessions.length > 0 && (
            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.5, delay: 0.15 }}
              className="ls-library__meta mt-3"
            >
              {sessions.length} {sessions.length === 1 ? t('library.session') : t('library.sessions')} · {totalMinutes} {t('library.minLabel')} total
            </motion.p>
          )}

          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.5, delay: 0.25 }}
            className="ls-library__search-wrap mt-8"
          >
            <label className="ls-library__search">
              <MagnifyingGlass size={16} weight="regular" className="ls-library__search-icon" />
              <input
                type="text"
                placeholder={t('library.search')}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="ls-library__search-input"
                aria-label={t('library.search')}
              />
            </label>
            <div style={{ position: 'relative' }}>
              <button
                ref={sortButtonRef}
                type="button"
                onClick={() => setShowSortDropdown((v) => !v)}
                className="ls-library__sort-btn"
                aria-label="sort sessions"
              >
                <FunnelSimple size={18} weight="regular" />
              </button>
              <AnimatePresence>
                {showSortDropdown && (
                  <motion.div
                    ref={sortDropdownRef}
                    initial={{ opacity: 0, y: -6 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -6 }}
                    transition={{ duration: 0.18 }}
                    className="ls-library__sort-menu"
                  >
                    {sortOptions.map((option) => {
                      const isActive = activeSortOption === option.value
                      return (
                        <button
                          key={option.value}
                          type="button"
                          data-active={isActive ? 'true' : 'false'}
                          onClick={() => {
                            setActiveSortOption(option.value)
                            setShowSortDropdown(false)
                          }}
                          className="ls-library__sort-item"
                        >
                          <span>{option.label}</span>
                          {isActive && <Check size={14} weight="regular" />}
                        </button>
                      )
                    })}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.5, delay: 0.35 }}
            className="ls-library__filters mt-6"
          >
            {visiblePills.map((pill, i) => {
              const isActive = activeFilter === pill
              return (
                <div
                  key={pill}
                  style={{ display: 'flex', alignItems: 'center', flexShrink: 0 }}
                >
                  {i > 0 && <span className="ls-library__sep">·</span>}
                  <button
                    type="button"
                    data-active={isActive ? 'true' : 'false'}
                    onClick={() => setActiveFilter(pill)}
                    className="ls-library__pill"
                  >
                    {pill === 'all'
                      ? t('library.filterAll')
                      : pill === 'favorites'
                      ? t('library.filterFavorites')
                      : pill}
                    {isActive && (
                      <motion.span
                        layoutId="library-filter-underline"
                        className="ls-library__pill-underline"
                        transition={{ type: 'spring', stiffness: 400, damping: 32 }}
                      />
                    )}
                  </button>
                </div>
              )
            })}
          </motion.div>

          <div className="mt-8">
            {isLoading ? (
              <div>
                {[0, 1, 2].map((i) => (
                  <div key={i} className="ls-library__skeleton" />
                ))}
              </div>
            ) : isError ? (
              <div className="ls-library__empty">
                <p className="ls-library__empty-line">{t('library.loadingError')}</p>
                <button
                  type="button"
                  onClick={() => void refetch()}
                  className="ls-library__link"
                >
                  try again
                </button>
              </div>
            ) : sessions.length === 0 ? (
              <div className="ls-library__empty">
                <p className="ls-library__empty-line">{t('library.empty')}</p>
                <button
                  type="button"
                  onClick={fireNavigateToCreate}
                  className="ls-library__link"
                >
                  {t('library.createFirst')}
                </button>
              </div>
            ) : (
              <div>
                {sessions.map((s, index) => (
                  <motion.div
                    key={s.id}
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{
                      duration: 0.5,
                      delay: 0.5 + Math.min(index, 7) * 0.08,
                    }}
                  >
                    <SessionCardLiminal
                      id={s.id}
                      title={s.title}
                      category={s.category}
                      durationSec={s.durationSec}
                      createdAt={s.createdAt}
                      isFavorited={s.favorited}
                      onPlay={() => handlePlaySession(s)}
                      onToggleFavorite={() => favoriteMutation.mutate(s.id)}
                      onClick={() => setSelectedSessionId(s.id)}
                    />
                  </motion.div>
                ))}
              </div>
            )}
          </div>
        </main>
      </div>
    </div>
  )
}

export default LibraryPage
