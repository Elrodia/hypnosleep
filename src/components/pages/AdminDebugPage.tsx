import { useCallback, useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { Copy, Check, MagnifyingGlass, ArrowClockwise, Export } from '@phosphor-icons/react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { apiFetch, ApiError } from '@/lib/api'

/**
 * Admin-only debug console at `/admin/debug`.
 *
 * Paste (or arrive with `?rid=`) a Support reference UUID to retrieve the
 * persisted debug event timeline for that request, including redacted
 * request context, resolved user id, category/reason, HTTP status, and
 * server-side error fields. Non-admin users get a 403 from the API and
 * see a lockout message.
 *
 * The same page also offers:
 *   - A one-click JSONL export for the currently filtered slice.
 *   - A "copy-as-curl" for the originating sanitized request.
 *   - Live health metrics for the debug-log subsystem itself.
 */

interface DebugEventRow {
  id: string
  rid: string
  level: string
  category: string
  reason: string | null
  userId: string | null
  message: string
  context: unknown
  errorName: string | null
  errorMessage: string | null
  errorCode: string | null
  httpStatus: number | null
  method: string | null
  path: string | null
  userAgent: string | null
  ipHash: string | null
  createdAt: string
}

interface DebugHealth {
  status: 'ok' | 'degraded'
  lastWriteAt: string | null
  lastWriteDurationMs: number | null
  totalWrites: number
  totalFailures: number
  lastPruneAt: string | null
  lastPruneDeleted: number | null
  retentionDays: number
}

const UUID_V4 =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

function levelBadgeVariant(
  level: string,
): 'default' | 'secondary' | 'destructive' | 'outline' {
  if (level === 'error' || level === 'fatal') return 'destructive'
  if (level === 'warn') return 'secondary'
  return 'outline'
}

function buildCurl(e: DebugEventRow): string {
  const method = (e.method ?? 'GET').toUpperCase()
  const path = e.path ?? '/'
  const origin =
    typeof window !== 'undefined' ? window.location.origin : 'https://app.hypnosleep.app'
  const parts = [
    `curl -i -X ${method}`,
    `  '${origin}${path}'`,
    "  -H 'Accept: application/json'",
    `  -H 'X-Request-Id: ${e.rid}'`,
  ]
  if (e.userAgent) {
    parts.push(`  -H 'User-Agent: ${e.userAgent.replace(/'/g, "'\\''")}'`)
  }
  parts.push("  # NOTE: Authorization bearer token intentionally omitted")
  return parts.join(' \\\n')
}

function CopyButton({ value, label }: { value: string; label: string }) {
  const [copied, setCopied] = useState(false)
  const onClick = async () => {
    try {
      await navigator.clipboard?.writeText(value)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 1500)
    } catch {
      /* ignore */
    }
  }
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors rounded px-2 py-1 hover:bg-muted/40 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      aria-label={label}
    >
      {copied ? (
        <>
          <Check size={12} weight="bold" /> Copied
        </>
      ) : (
        <>
          <Copy size={12} /> {label}
        </>
      )}
    </button>
  )
}

function EventRow({ event }: { event: DebugEventRow }) {
  const [showContext, setShowContext] = useState(false)
  const [showCurl, setShowCurl] = useState(false)
  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-2 flex-wrap">
            <Badge variant={levelBadgeVariant(event.level)}>{event.level}</Badge>
            <Badge variant="outline">{event.category}</Badge>
            {event.reason && <Badge variant="outline">{event.reason}</Badge>}
            {event.httpStatus !== null && (
              <Badge variant="outline">HTTP {event.httpStatus}</Badge>
            )}
          </div>
          <time className="text-xs text-muted-foreground font-mono">
            {new Date(event.createdAt).toISOString()}
          </time>
        </div>
        <CardTitle className="text-base font-medium">{event.message}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2 text-sm">
        <dl className="grid grid-cols-[max-content_1fr] gap-x-3 gap-y-1 text-xs">
          {event.method && event.path && (
            <>
              <dt className="text-muted-foreground">Request</dt>
              <dd className="font-mono break-all">
                {event.method} {event.path}
              </dd>
            </>
          )}
          {event.userId && (
            <>
              <dt className="text-muted-foreground">User</dt>
              <dd className="font-mono break-all">{event.userId}</dd>
            </>
          )}
          {event.ipHash && (
            <>
              <dt className="text-muted-foreground">IP hash</dt>
              <dd className="font-mono break-all text-[10px]">{event.ipHash}</dd>
            </>
          )}
          {event.errorName && (
            <>
              <dt className="text-muted-foreground">Error</dt>
              <dd className="font-mono break-all">
                {event.errorName}
                {event.errorCode ? ` (${event.errorCode})` : ''}
                {event.errorMessage ? `: ${event.errorMessage}` : ''}
              </dd>
            </>
          )}
        </dl>
        <div className="flex gap-2 flex-wrap pt-1">
          <button
            type="button"
            className="text-xs text-primary hover:underline"
            onClick={() => setShowContext((v) => !v)}
          >
            {showContext ? 'Hide context' : 'Show context'}
          </button>
          <button
            type="button"
            className="text-xs text-primary hover:underline"
            onClick={() => setShowCurl((v) => !v)}
          >
            {showCurl ? 'Hide curl' : 'Copy as curl'}
          </button>
        </div>
        {showContext && (
          <pre className="text-xs bg-muted/40 rounded p-2 overflow-auto max-h-72 font-mono">
            {JSON.stringify(event.context, null, 2)}
          </pre>
        )}
        {showCurl && (
          <div className="space-y-1">
            <pre className="text-xs bg-muted/40 rounded p-2 overflow-auto font-mono whitespace-pre-wrap">
              {buildCurl(event)}
            </pre>
            <CopyButton value={buildCurl(event)} label="Copy curl" />
          </div>
        )}
      </CardContent>
    </Card>
  )
}

interface ListResponse {
  events: DebugEventRow[]
  count: number
  rid?: string
}

export function AdminDebugPage() {
  const initialRid = (() => {
    if (typeof window === 'undefined') return ''
    return new URLSearchParams(window.location.search).get('rid') ?? ''
  })()

  const [rid, setRid] = useState(initialRid)
  const [events, setEvents] = useState<DebugEventRow[] | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [health, setHealth] = useState<DebugHealth | null>(null)

  const loadByRid = useCallback(async (value: string) => {
    const trimmed = value.trim()
    if (!trimmed) {
      setEvents(null)
      setError(null)
      return
    }
    if (!UUID_V4.test(trimmed)) {
      setError('Enter a full UUIDv4 request id.')
      setEvents(null)
      return
    }
    setLoading(true)
    setError(null)
    try {
      const body = await apiFetch<ListResponse>(
        `/api/admin/debug/events/${encodeURIComponent(trimmed)}`,
      )
      setEvents(body.events ?? [])
    } catch (err) {
      if (err instanceof ApiError) {
        if (err.status === 404) {
          setEvents([])
          setError('No events found for this request id.')
        } else if (err.status === 403) {
          setError('Admin access required.')
          setEvents(null)
        } else if (err.status === 401) {
          setError('Please sign in first.')
          setEvents(null)
        } else {
          setError(`${err.code}: ${err.message}`)
          setEvents(null)
        }
      } else {
        setError('Network error — please retry.')
        setEvents(null)
      }
    } finally {
      setLoading(false)
    }
  }, [])

  const loadHealth = useCallback(async () => {
    try {
      const h = await apiFetch<DebugHealth>('/api/admin/debug/health')
      setHealth(h)
    } catch {
      /* non-fatal */
    }
  }, [])

  useEffect(() => {
    void loadHealth()
  }, [loadHealth])

  useEffect(() => {
    if (initialRid) void loadByRid(initialRid)
    // run once on mount
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    void loadByRid(rid)
  }

  // When the user has a rid pinned, scope the export to that rid so
  // "Export JSONL" matches what they're looking at on-screen. When no
  // rid is entered, fall back to the 200 most recent events.
  const trimmedRid = rid.trim()
  const exportJsonlUrl = trimmedRid && UUID_V4.test(trimmedRid)
    ? `/api/admin/debug/events.jsonl?limit=200&rid=${encodeURIComponent(trimmedRid)}`
    : '/api/admin/debug/events.jsonl?limit=200'

  return (
    <div className="min-h-screen bg-background text-foreground px-4 py-8">
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.25 }}
        className="max-w-3xl mx-auto space-y-6"
      >
        <header className="space-y-1">
          <h1 className="text-2xl font-serif font-semibold">Debug console</h1>
          <p className="text-sm text-muted-foreground">
            Look up a persisted debug-event timeline by its request id
            (the &ldquo;Support reference&rdquo; shown on the auth error
            page, or any <code className="font-mono text-xs">X-Request-Id</code> response header).
          </p>
        </header>

        {health && (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">System status</CardTitle>
            </CardHeader>
            <CardContent className="text-xs grid grid-cols-2 sm:grid-cols-4 gap-y-1 gap-x-3">
              <div className="text-muted-foreground">Status</div>
              <div>
                <Badge variant={health.status === 'ok' ? 'outline' : 'destructive'}>
                  {health.status}
                </Badge>
              </div>
              <div className="text-muted-foreground">Retention</div>
              <div className="font-mono">{health.retentionDays}d</div>
              <div className="text-muted-foreground">Writes</div>
              <div className="font-mono">
                {health.totalWrites} / {health.totalFailures} failed
              </div>
              <div className="text-muted-foreground">Last write</div>
              <div className="font-mono break-all">
                {health.lastWriteAt ?? '—'}
                {health.lastWriteDurationMs !== null
                  ? ` (${health.lastWriteDurationMs}ms)`
                  : ''}
              </div>
              <div className="text-muted-foreground">Last prune</div>
              <div className="font-mono break-all">
                {health.lastPruneAt ?? '—'}
                {health.lastPruneDeleted !== null
                  ? ` (–${health.lastPruneDeleted})`
                  : ''}
              </div>
            </CardContent>
          </Card>
        )}

        <form onSubmit={handleSubmit} className="flex gap-2 flex-wrap items-center">
          <Input
            value={rid}
            onChange={(e) => setRid(e.target.value)}
            placeholder="Request id (UUIDv4)"
            className="flex-1 min-w-[280px] font-mono"
            aria-label="Request id"
          />
          <Button type="submit" disabled={loading}>
            {loading ? (
              <ArrowClockwise size={16} className="animate-spin" />
            ) : (
              <MagnifyingGlass size={16} />
            )}
            <span className="ml-2">Look up</span>
          </Button>
          <Button asChild variant="outline">
            <a href={exportJsonlUrl} download>
              <Export size={16} />
              <span className="ml-2">Export JSONL</span>
            </a>
          </Button>
        </form>

        {error && (
          <div className="rounded border border-destructive/40 bg-destructive/5 text-destructive text-sm px-3 py-2">
            {error}
          </div>
        )}

        {events && events.length > 0 && (
          <div className="space-y-3">
            <p className="text-xs text-muted-foreground">
              {events.length} event{events.length === 1 ? '' : 's'} for rid{' '}
              <span className="font-mono">{rid}</span>
            </p>
            {events.map((ev) => (
              <EventRow key={ev.id} event={ev} />
            ))}
          </div>
        )}

        {events && events.length === 0 && !error && (
          <p className="text-sm text-muted-foreground">No events for this id.</p>
        )}
      </motion.div>
    </div>
  )
}
