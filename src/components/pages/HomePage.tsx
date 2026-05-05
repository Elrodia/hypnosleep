import { useEffect, useMemo, useState } from 'react'
import { motion } from 'framer-motion'
import { Bell, Play, Sparkle } from '@phosphor-icons/react'
import { useTranslation } from 'react-i18next'
import { useAudioPlayer } from '@/contexts/AudioPlayerContext'
import { useAuth } from '@/lib/auth-context'

interface RecentSession {
  id?: string
  title: string
  durationSec: number
  category?: string
  playedAt: number
}

const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000
const LAST_SESSION_KEY = 'hypnosleep:lastSession'

type TimeOfDayKey = 'morning' | 'afternoon' | 'evening'

function getTimeOfDayKey(): TimeOfDayKey {
  const hour = new Date().getHours()
  if (hour < 12) return 'morning'
  if (hour < 18) return 'afternoon'
  return 'evening'
}

function readRecentSession(): RecentSession | null {
  try {
    const raw = localStorage.getItem(LAST_SESSION_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as Partial<RecentSession>
    if (
      !parsed ||
      typeof parsed.title !== 'string' ||
      typeof parsed.durationSec !== 'number' ||
      typeof parsed.playedAt !== 'number'
    ) return null
    if (Date.now() - parsed.playedAt > SEVEN_DAYS_MS) return null
    return parsed as RecentSession
  } catch {
    return null
  }
}

const formatMinutes = (s: number) => Math.max(1, Math.round(s / 60))

const STYLES = `
.ls-home{--ls-bg-base:#0a0a0f;--ls-bg-deep:#050507;--ls-fg-primary:#e8e6e1;--ls-fg-muted:#6b6a6f;--ls-fg-faint:#2a2a30;--ls-accent:#c9b6a3;--ls-glow:rgba(201,182,163,0.08);background:var(--ls-bg-base);color:var(--ls-fg-primary);font-family:'Inter',system-ui,sans-serif;min-height:100vh;position:relative;overflow:hidden;}
.ls-home__ambient{position:fixed;inset:-25%;background:radial-gradient(circle at 30% 20%,rgba(201,182,163,0.06),transparent 55%),radial-gradient(circle at 70% 80%,rgba(80,90,120,0.08),transparent 60%),radial-gradient(circle at 50% 50%,rgba(40,30,50,0.05),transparent 70%);animation:ls-ambient 240s linear infinite;pointer-events:none;z-index:0;}
.ls-home__grain{position:fixed;inset:0;background-image:url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='160' height='160'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2' stitchTiles='stitch'/></filter><rect width='100%' height='100%' filter='url(%23n)' opacity='0.6'/></svg>");opacity:0.03;mix-blend-mode:overlay;pointer-events:none;z-index:1;}
.ls-home__vignette{position:fixed;inset:0;box-shadow:inset 0 0 200px var(--ls-bg-deep);pointer-events:none;z-index:2;}
.ls-home__content{position:relative;z-index:3;}
.ls-home__question{font-family:'Fraunces','Cormorant Garamond',serif;font-style:italic;font-weight:300;font-size:clamp(2.25rem,6vw,4rem);letter-spacing:-0.02em;line-height:1.1;text-transform:lowercase;}
.ls-home__brand{font-weight:400;font-size:0.75rem;letter-spacing:0.15em;text-transform:uppercase;color:var(--ls-fg-primary);}
.ls-home__create{width:88px;height:88px;border-radius:9999px;border:1px solid var(--ls-accent);background:transparent;color:var(--ls-accent);display:flex;align-items:center;justify-content:center;cursor:pointer;transition:box-shadow 400ms ease,transform 200ms ease;}
.ls-home__create:hover{box-shadow:0 10px 30px var(--ls-glow),0 0 30px var(--ls-glow);}
.ls-home__create:hover .ls-home__glyph{transform:scale(1.1);}
.ls-home__create:active{transform:scale(0.96);}
.ls-home__glyph{transition:transform 250ms ease;display:flex;}
.ls-home__create-label{font-weight:400;font-size:0.875rem;letter-spacing:0.1em;text-transform:lowercase;color:var(--ls-fg-muted);}
.ls-home__divider{border-top:1px solid var(--ls-fg-faint);}
.ls-home__recently-label{font-weight:400;font-size:0.75rem;letter-spacing:0.15em;text-transform:uppercase;color:var(--ls-fg-muted);}
.ls-home__recently-title{font-weight:400;font-size:0.875rem;letter-spacing:0.05em;text-transform:lowercase;color:var(--ls-fg-primary);}
.ls-home__play-btn{background:transparent;border:none;cursor:pointer;color:var(--ls-accent);display:flex;align-items:center;justify-content:center;padding:8px;transition:transform 200ms ease;}
.ls-home__play-btn:hover{transform:scale(1.1);}
@media (min-width:768px){.ls-home__create{width:104px;height:104px;}}
@keyframes ls-ambient{from{transform:rotate(0deg);}to{transform:rotate(360deg);}}
@media (prefers-reduced-motion:reduce){.ls-home__ambient{animation:none;}}
`

export function HomePage() {
  const { t } = useTranslation()
  const { play } = useAudioPlayer()
  const { user } = useAuth()
  const firstName = user?.name?.split(' ')[0]
  const timeOfDayKey = useMemo(() => getTimeOfDayKey(), [])
  const phrase = t(`timeOfDay.${timeOfDayKey}`)
  const [recent, setRecent] = useState<RecentSession | null>(null)

  useEffect(() => {
    setRecent(readRecentSession())
  }, [])

  const handleCreate = () => {
    window.dispatchEvent(new CustomEvent('navigate-to-tab', { detail: 'create' }))
  }

  const handleResume = () => {
    if (!recent) return
    play(recent.title, recent.category ?? 'Sleep', recent.durationSec)
  }

  return (
    <div className="ls-home">
      <style>{STYLES}</style>
      <div className="ls-home__ambient" aria-hidden="true" />
      <div className="ls-home__grain" aria-hidden="true" />
      <div className="ls-home__vignette" aria-hidden="true" />

      <div className="ls-home__content flex flex-col min-h-screen">
        <motion.header
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.6 }}
          className="flex items-center justify-between px-6 h-14"
        >
          <span className="ls-home__brand">{t('home.brand')}</span>
          <Bell size={18} weight="thin" style={{ color: 'var(--ls-fg-muted)' }} />
        </motion.header>

        <main className="flex-1 flex flex-col items-center justify-center px-6 py-12 gap-12 md:gap-16">
          <motion.h1
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.2 }}
            className="ls-home__question text-center max-w-2xl"
            style={{ color: 'var(--ls-fg-primary)' }}
          >
            {firstName
              ? t('home.question', { phrase, name: firstName })
              : t('home.questionAnonymous', { phrase })}
          </motion.h1>

          <motion.div
            initial={{ opacity: 0, scale: 0.92 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.7, delay: 0.6 }}
            className="flex flex-col items-center gap-5"
          >
            <button type="button" onClick={handleCreate} aria-label={t('home.ariaCreate')} className="ls-home__create">
              <span className="ls-home__glyph"><Sparkle size={28} weight="thin" /></span>
            </button>
            <span className="ls-home__create-label">{t('home.create')}</span>
          </motion.div>
        </main>

        {recent && (
          <motion.section
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.5, delay: 1.0 }}
            className="px-6 pb-10"
          >
            <div className="ls-home__divider mb-5" />
            <p className="ls-home__recently-label mb-2">{t('home.recently')}</p>
            <div className="flex items-center justify-between gap-4">
              <p className="ls-home__recently-title truncate">
                {recent.title.toLowerCase()} · {t('sessionCard.minutes', { count: formatMinutes(recent.durationSec) })}
              </p>
              <button type="button" onClick={handleResume} aria-label={t('home.ariaResume')} className="ls-home__play-btn">
                <Play size={20} weight="fill" />
              </button>
            </div>
          </motion.section>
        )}
      </div>
    </div>
  )
}

export default HomePage
