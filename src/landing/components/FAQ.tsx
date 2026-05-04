import { useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { ChevronDown } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { FAQ_IDS } from '../data/faqs'

export function FAQ() {
  const { t } = useTranslation()
  // Only one open at a time per spec. `-1` = none open.
  const [openIdx, setOpenIdx] = useState(-1)

  return (
    <section id="faq" className="relative py-20 sm:py-28">
      <div className="mx-auto max-w-3xl px-5 sm:px-8">
        <header className="mb-10 text-center">
          <p className="text-xs uppercase tracking-widest text-[var(--ls-text-subtle)] mb-3">{t('faq.eyebrow')}</p>
          <h2 className="font-fraunces italic lowercase text-3xl sm:text-4xl text-[var(--ls-text)]">{t('faq.title')}</h2>
        </header>

        <ul className="divide-y divide-[var(--ls-border)] rounded-2xl border border-[var(--ls-border-strong)]">
          {FAQ_IDS.map((id, i) => {
            const open = i === openIdx
            return (
              <li key={id}>
                <button
                  type="button"
                  className="flex w-full items-center justify-between gap-6 px-5 py-5 text-left"
                  aria-expanded={open}
                  aria-controls={`faq-body-${i}`}
                  id={`faq-head-${i}`}
                  onClick={() => setOpenIdx(open ? -1 : i)}
                >
                  <span className="text-[var(--ls-text)] font-medium">{t(`faq.items.${id}.question`)}</span>
                  <ChevronDown
                    size={18}
                    className={'shrink-0 transition-transform text-[var(--ls-text-muted)] ' + (open ? 'rotate-180' : '')}
                    aria-hidden
                  />
                </button>
                <AnimatePresence initial={false}>
                  {open && (
                    <motion.div
                      id={`faq-body-${i}`}
                      role="region"
                      aria-labelledby={`faq-head-${i}`}
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.25, ease: 'easeOut' }}
                      className="overflow-hidden"
                    >
                      <p className="px-5 pb-5 text-[var(--ls-text-muted)] leading-relaxed">
                        {t(`faq.items.${id}.answer`)}
                      </p>
                    </motion.div>
                  )}
                </AnimatePresence>
              </li>
            )
          })}
        </ul>
      </div>
    </section>
  )
}

export default FAQ
