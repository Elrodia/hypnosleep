import { useState, useRef, useEffect, type ChangeEvent } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Sparkle } from '@phosphor-icons/react'
import { toast } from 'sonner'
import { editSessionScript, regenerateSessionAudio } from '@/lib/api-endpoints'
import { ApiError } from '@/lib/api'

interface ScriptEditorModalProps {
  isOpen: boolean
  onClose: () => void
  initialScript: string
  /**
   * Optional session id. When provided, the inline AI regeneration
   * button calls `POST /api/sessions/:id/regenerate` to kick off a
   * full audio regeneration using the current edited script.
   */
  sessionId?: string
  onSave: (editedScript: string, modifiedSections: Set<number>) => void
}

const STYLES = `
.ls-script-editor {
  --ls-bg: #0a0a0f;
  --ls-bg-elevated: #12121a;
  --ls-text: #e8e6e1;
  --ls-text-muted: #8a8580;
  --ls-text-subtle: #5a5650;
  --ls-sand: #c9b6a3;
  --ls-sand-dim: #8a7d6e;
  --ls-border: rgba(232, 230, 225, 0.08);
  --ls-border-strong: rgba(232, 230, 225, 0.16);
  font-family: 'Inter', system-ui, sans-serif;
}
.ls-script-editor .font-fraunces {
  font-family: 'Fraunces', 'Cormorant Garamond', serif;
  font-weight: 400;
  letter-spacing: -0.01em;
}
`

export function ScriptEditorModal({
  isOpen,
  onClose,
  initialScript,
  sessionId,
  onSave,
}: ScriptEditorModalProps) {
  const [script, setScript] = useState(initialScript)
  const [modifiedParagraphs, setModifiedParagraphs] = useState<Set<number>>(new Set())
  const [isRegenerating, setIsRegenerating] = useState(false)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    if (isOpen) {
      setScript(initialScript)
      setModifiedParagraphs(new Set<number>())
    }
  }, [isOpen, initialScript])

  const paragraphs = script.split('\n\n').filter((p) => p.trim())
  const wordCount = script.trim().split(/\s+/).filter((word) => word.length > 0).length

  const handleTextChange = (event: ChangeEvent<HTMLTextAreaElement>) => {
    setScript(event.target.value)
  }

  const getSelectedParagraphIndex = (): number | null => {
    const textarea = textareaRef.current
    if (!textarea) return null

    const selectedText = textarea.value
      .slice(textarea.selectionStart, textarea.selectionEnd)
      .trim()

    if (!selectedText) return null

    for (let index = 0; index < paragraphs.length; index++) {
      if (paragraphs[index].includes(selectedText)) {
        return index
      }
    }

    return null
  }

  const handleAISuggest = async () => {
    if (!sessionId) {
      toast.error('AI regeneration requires a saved session.')
      return
    }

    const paragraphIndex = getSelectedParagraphIndex()
    if (paragraphIndex === null) {
      toast.error('Please select text within a paragraph to regenerate')
      return
    }

    setIsRegenerating(true)

    try {
      // Persist visible edits first so backend regeneration uses the
      // current editor state instead of the last saved script.
      if (script !== initialScript) {
        await editSessionScript(sessionId, script)
      }

      await regenerateSessionAudio(sessionId)

      setModifiedParagraphs((prev) => {
        const next = new Set(prev)
        next.add(paragraphIndex)
        return next
      })

      toast.success("Regeneration started. We'll update the audio when it's ready.")
    } catch (error) {
      if (error instanceof ApiError && error.status === 402) {
        toast.error('AI regeneration is a Pro feature.')
      } else {
        toast.error(error instanceof Error ? error.message : 'Failed to regenerate paragraph')
      }
      console.error(error)
    } finally {
      setIsRegenerating(false)
    }
  }

  const handleSave = () => {
    onSave(script, modifiedParagraphs)
    toast.success('Script saved!')
    onClose()
  }

  const handleCancel = () => {
    if (script !== initialScript) {
      const confirmed = confirm('You have unsaved changes. Are you sure you want to cancel?')
      if (!confirmed) return
    }

    onClose()
  }

  const renderHighlightedParagraphs = () => {
    const lines: React.ReactElement[] = []

    paragraphs.forEach((paragraph, index) => {
      const isModified = modifiedParagraphs.has(index)

      lines.push(
        <div
          key={index}
          className={`relative ${
            isModified ? 'pl-3 border-l-4 border-[var(--ls-sand)]/70' : ''
          }`}
        >
          {paragraph}
        </div>,
      )

      if (index < paragraphs.length - 1) {
        lines.push(<div key={`space-${index}`} className="h-4" />)
      }
    })

    return lines
  }

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="ls-script-editor">
          <style>{STYLES}</style>

          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18, ease: 'easeOut' }}
            className="fixed inset-0 z-50 bg-[var(--ls-bg)]/88"
            onClick={handleCancel}
          />

          <motion.div
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', damping: 32, stiffness: 310 }}
            className="fixed inset-0 z-50 flex flex-col bg-[var(--ls-bg)] text-[var(--ls-text)]"
            role="dialog"
            aria-modal="true"
            aria-label="edit script"
          >
            <div className="sticky top-0 z-10 flex items-center justify-between border-b border-[var(--ls-border)] bg-[var(--ls-bg)] px-4 py-3">
              <button
                type="button"
                onClick={handleCancel}
                className="h-10 rounded-md border border-transparent px-3 text-sm lowercase text-[var(--ls-text-muted)] transition-colors hover:border-[var(--ls-border-strong)] hover:text-[var(--ls-text)] focus:outline-none focus-visible:ring-1 focus-visible:ring-[var(--ls-sand-dim)]"
              >
                cancel
              </button>

              <div className="text-center">
                <p className="text-[10px] uppercase tracking-[0.22em] text-[var(--ls-text-subtle)]">
                  pro
                </p>
                <h2 className="font-fraunces text-xl italic lowercase text-[var(--ls-text)]">
                  edit script
                </h2>
              </div>

              <button
                type="button"
                onClick={handleSave}
                className="h-10 rounded-md bg-[var(--ls-sand)] px-4 text-sm lowercase text-[var(--ls-bg)] transition-colors hover:bg-[var(--ls-sand)]/90 focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ls-sand-dim)]"
              >
                save
              </button>
            </div>

            <div className="relative flex-1 overflow-y-auto px-4 py-6">
              <div className="mx-auto max-w-3xl">
                <textarea
                  ref={textareaRef}
                  value={script}
                  onChange={handleTextChange}
                  className="min-h-[calc(100vh-200px)] w-full resize-none border-none bg-transparent font-fraunces text-lg leading-relaxed text-[var(--ls-text)] outline-none placeholder:text-[var(--ls-text-subtle)] focus:outline-none focus:ring-0"
                  spellCheck
                />

                <div className="pointer-events-none absolute inset-0 px-4 py-6">
                  <div className="mx-auto max-w-3xl">
                    <div
                      className="whitespace-pre-wrap font-fraunces text-lg leading-relaxed text-transparent"
                      aria-hidden="true"
                    >
                      {renderHighlightedParagraphs()}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="sticky bottom-0 flex items-center justify-between border-t border-[var(--ls-border)] bg-[var(--ls-bg)] px-4 py-3">
              <div className="text-sm lowercase tabular-nums text-[var(--ls-text-muted)]">
                {wordCount.toLocaleString()} words
              </div>

              <div className="text-xs lowercase text-[var(--ls-text-subtle)]">
                select text, then regenerate
              </div>
            </div>

            <motion.button
              type="button"
              onClick={handleAISuggest}
              disabled={isRegenerating}
              whileHover={{ scale: isRegenerating ? 1 : 1.03 }}
              whileTap={{ scale: isRegenerating ? 1 : 0.97 }}
              className="fixed bottom-20 right-6 z-20 flex items-center gap-2 rounded-full border border-[var(--ls-sand-dim)] bg-[var(--ls-sand)] px-4 py-4 text-[var(--ls-bg)] transition-colors hover:bg-[var(--ls-sand)]/90 disabled:cursor-not-allowed disabled:border-[var(--ls-border-strong)] disabled:bg-[var(--ls-bg-elevated)] disabled:text-[var(--ls-text-subtle)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ls-sand-dim)]"
              aria-label="regenerate selected script text"
            >
              <Sparkle
                size={23}
                weight="regular"
                className={isRegenerating ? 'animate-spin' : ''}
              />

              {isRegenerating && (
                <span className="pr-1 text-sm lowercase">
                  regenerating…
                </span>
              )}
            </motion.button>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  )
}
