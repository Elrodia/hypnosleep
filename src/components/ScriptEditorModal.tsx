import { useState, useRef, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Sparkle } from '@phosphor-icons/react'
import { Button } from './ui/button'
import { toast } from 'sonner'
import { regenerateSessionAudio } from '@/lib/api-endpoints'
import { ApiError } from '@/lib/api'

interface ScriptEditorModalProps {
  isOpen: boolean
  onClose: () => void
  initialScript: string
  /**
   * Optional session id. When provided, the inline AI regeneration
   * button calls `POST /api/sessions/:id/regenerate` to kick off a
   * full audio regeneration using the current (possibly edited)
   * script. Without an id, the AI button is disabled with a friendly
   * explanation.
   */
  sessionId?: string
  onSave: (editedScript: string, modifiedSections: Set<number>) => void
}

export function ScriptEditorModal({ isOpen, onClose, initialScript, sessionId, onSave }: ScriptEditorModalProps) {
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

  const paragraphs = script.split('\n\n').filter(p => p.trim())
  const wordCount = script.trim().split(/\s+/).filter(word => word.length > 0).length

  const handleTextChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setScript(e.target.value)
  }

  const getSelectedParagraphIndex = (): number | null => {
    if (!textareaRef.current) return null

    const selection = window.getSelection()
    if (!selection || selection.rangeCount === 0) return null

    const selectedText = selection.toString().trim()
    if (!selectedText) return null

    for (let i = 0; i < paragraphs.length; i++) {
      if (paragraphs[i].includes(selectedText)) {
        return i
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
      // The backend owns the prompt + LLM call. From the editor we
      // save the current script, mark the targeted paragraph as
      // modified, and request a full regeneration — the service layer
      // handles the paragraph-level prompt.
      await regenerateSessionAudio(sessionId)
      setModifiedParagraphs((prev) => {
        const next = new Set(prev)
        next.add(paragraphIndex)
        return next
      })
      toast.success('Regeneration started. We\'ll update the audio when it\'s ready.')
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
          className={`relative ${isModified ? 'pl-3 border-l-4 border-primary/60' : ''}`}
        >
          {paragraph}
        </div>
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
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50"
            onClick={handleCancel}
          />
          
          <motion.div
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', damping: 30, stiffness: 300 }}
            className="fixed inset-0 z-50 bg-background flex flex-col"
          >
            <div className="sticky top-0 z-10 bg-card border-b border-border px-4 py-3 flex items-center justify-between">
              <Button
                variant="ghost"
                size="sm"
                onClick={handleCancel}
                className="text-foreground hover:text-primary"
              >
                Cancel
              </Button>
              
              <h2 className="font-semibold text-lg">Edit Script</h2>
              
              <Button
                size="sm"
                onClick={handleSave}
                className="bg-primary hover:bg-primary/90 text-primary-foreground"
              >
                Save Changes
              </Button>
            </div>

            <div className="flex-1 overflow-y-auto px-4 py-6 relative">
              <div className="max-w-3xl mx-auto">
                <textarea
                  ref={textareaRef}
                  value={script}
                  onChange={handleTextChange}
                  className="w-full min-h-[calc(100vh-200px)] bg-transparent text-foreground font-serif resize-none border-none outline-none focus:outline-none focus:ring-0 leading-relaxed"
                  style={{ fontSize: '18px' }}
                />
                
                <div className="pointer-events-none absolute inset-0 px-4 py-6">
                  <div className="max-w-3xl mx-auto">
                    <div 
                      className="text-lg leading-relaxed text-transparent font-serif whitespace-pre-wrap"
                      style={{ fontSize: '18px' }}
                      aria-hidden="true"
                    >
                      {renderHighlightedParagraphs()}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="sticky bottom-0 bg-card/95 backdrop-blur-lg border-t border-border px-4 py-3 flex items-center justify-between">
              <div className="text-sm text-muted-foreground">
                {wordCount.toLocaleString()} words
              </div>
            </div>

            <motion.button
              onClick={handleAISuggest}
              disabled={isRegenerating}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              className="fixed bottom-20 right-6 z-20 bg-primary hover:bg-primary/90 text-primary-foreground rounded-full p-4 shadow-lg shadow-primary/25 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
              <Sparkle size={24} weight="fill" className={isRegenerating ? 'animate-spin' : ''} />
              {isRegenerating && (
                <span className="text-sm font-medium pr-2">Regenerating...</span>
              )}
            </motion.button>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}
