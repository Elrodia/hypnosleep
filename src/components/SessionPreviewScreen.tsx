import { motion, AnimatePresence } from 'framer-motion'
import { useTranslation } from 'react-i18next'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Play, PencilSimple, ArrowsClockwise, Check } from '@phosphor-icons/react'

interface SessionPreviewScreenProps {
  isOpen: boolean
  sessionTitle: string
  category: string
  duration: string
  scriptText: string
  onListenNow: () => void
  onEditScript: () => void
  onRegenerate: () => void
  onClose: () => void
}

export function SessionPreviewScreen({
  isOpen,
  sessionTitle,
  category,
  duration,
  scriptText,
  onListenNow,
  onEditScript,
  onRegenerate,
}: SessionPreviewScreenProps) {
  const { t } = useTranslation()
  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.4 }}
          className="ls-session-preview fixed inset-0 z-50 bg-[var(--ls-bg)] text-[var(--ls-text)]"
        >
          <div className="h-full overflow-y-auto">
            <div className="min-h-full flex flex-col px-6 py-12">
              <div className="w-full max-w-2xl mx-auto space-y-8 flex-1">

                {/* ── Headline ── */}
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.2, duration: 0.5 }}
                  className="text-center pt-12"
                >
                  <p className="text-xs uppercase tracking-widest text-[var(--ls-text-subtle)] mb-3">
                    {t('sessionPreview.eyebrow')}
                  </p>
                  <h1 className="font-fraunces italic lowercase text-3xl text-[var(--ls-text)]">
                    {sessionTitle.toLowerCase()}
                  </h1>
                  <div className="flex items-center justify-center gap-2 mt-3 text-sm text-[var(--ls-text-muted)]">
                    <span className="lowercase">{category.toLowerCase()}</span>
                    <span className="text-[var(--ls-text-subtle)]">·</span>
                    <span>{duration}</span>
                  </div>
                </motion.div>

                {/* ── Script preview card ── */}
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.4, duration: 0.5 }}
                  className="rounded-md border border-[var(--ls-border)] bg-[var(--ls-bg-elevated)] overflow-hidden"
                >
                  <div className="px-5 py-3 border-b border-[var(--ls-border)]">
                    <h3 className="text-xs uppercase tracking-widest text-[var(--ls-text-subtle)]">
                      {t('sessionPreview.scriptHeader')}
                    </h3>
                  </div>
                  <ScrollArea className="h-[280px] px-6 py-5">
                    <div className="font-fraunces text-[15px] leading-loose text-[var(--ls-text)]/90 whitespace-pre-line">
                      {scriptText}
                    </div>
                  </ScrollArea>
                </motion.div>

                {/* ── Saved-to-library confirmation ── */}
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.6, duration: 0.5 }}
                  className="flex items-center justify-center gap-2 text-xs text-[var(--ls-text-muted)] lowercase"
                >
                  <Check weight="regular" size={14} className="text-[var(--ls-sand)]" />
                  <span>{t('sessionPreview.savedLibrary')}</span>
                </motion.div>

                {/* ── Primary action ── */}
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.8, duration: 0.5 }}
                  className="pt-4"
                >
                  <button
                    type="button"
                    onClick={onListenNow}
                    className="w-full h-14 flex items-center justify-center gap-3 rounded-md bg-[var(--ls-sand)] text-[var(--ls-bg)] hover:bg-[var(--ls-sand)]/90 transition-colors text-base lowercase focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ls-sand-dim)]"
                  >
                    <Play weight="fill" size={20} />
                    {t('sessionPreview.listenCta')}
                  </button>
                </motion.div>

                {/* ── Secondary actions ── */}
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 1, duration: 0.5 }}
                  className="flex items-center justify-center gap-8 pt-2 pb-8"
                >
                  <button
                    type="button"
                    onClick={onEditScript}
                    className="flex items-center gap-2 text-sm text-[var(--ls-text-muted)] hover:text-[var(--ls-text)] transition-colors lowercase focus:outline-none focus-visible:underline"
                  >
                    <PencilSimple size={16} weight="regular" />
                    {t('sessionPreview.editScript')}
                  </button>
                  <button
                    type="button"
                    onClick={onRegenerate}
                    className="flex items-center gap-2 text-sm text-[var(--ls-text-muted)] hover:text-[var(--ls-text)] transition-colors lowercase focus:outline-none focus-visible:underline"
                  >
                    <ArrowsClockwise size={16} weight="regular" />
                    {t('sessionPreview.regenerate')}
                  </button>
                </motion.div>

              </div>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
