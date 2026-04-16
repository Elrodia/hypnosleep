import { motion, AnimatePresence } from 'framer-motion'
import { X, LockKeyOpen, Check, Lightning } from '@phosphor-icons/react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'

interface PaywallModalProps {
  isOpen: boolean
  onClose: () => void
  onUpgrade: () => void
  triggerReason: 'session-limit' | 'premium-voice'
}

const FREE_FEATURES = [
  '3 AI sessions per month',
  '2 basic voices',
  'Basic background sounds',
  'Ads between sessions',
]

const PRO_FEATURES = [
  'Unlimited AI sessions',
  'All 6 premium voices',
  'All background sounds',
  'Offline downloads',
  'No ads ever',
  'Priority generation',
]

export function PaywallModal({ isOpen, onClose, onUpgrade, triggerReason }: PaywallModalProps) {
  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50"
            onClick={onClose}
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
            className="fixed inset-4 md:inset-auto md:left-1/2 md:top-1/2 md:-translate-x-1/2 md:-translate-y-1/2 md:w-full md:max-w-2xl z-50 overflow-hidden"
          >
            <Card className="h-full bg-card border-border/50 overflow-y-auto scrollbar-hide">
              <div className="p-6 space-y-6">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <motion.div
                        animate={{
                          rotate: [0, -10, 10, -10, 0],
                          scale: [1, 1.1, 1.1, 1.1, 1],
                        }}
                        transition={{
                          duration: 0.6,
                          ease: 'easeInOut',
                          times: [0, 0.2, 0.5, 0.8, 1],
                        }}
                      >
                        <LockKeyOpen className="text-primary" size={32} weight="duotone" />
                      </motion.div>
                      <h2 className="text-2xl font-semibold text-foreground">
                        Unlock Full Access
                      </h2>
                    </div>
                    {triggerReason === 'session-limit' && (
                      <p className="text-sm text-muted-foreground">
                        You've reached your monthly limit of 3 free sessions. Upgrade to Pro for unlimited AI-generated hypnosis sessions.
                      </p>
                    )}
                    {triggerReason === 'premium-voice' && (
                      <p className="text-sm text-muted-foreground">
                        This voice is only available to Pro members. Upgrade now to access all 6 premium voices.
                      </p>
                    )}
                  </div>
                  <button
                    onClick={onClose}
                    className="text-muted-foreground hover:text-foreground transition-colors"
                  >
                    <X size={24} />
                  </button>
                </div>

                <div className="grid md:grid-cols-2 gap-4">
                  <Card className="bg-muted/30 border-border/50 p-5 relative">
                    <div className="absolute top-0 left-0 right-0 h-1 bg-muted-foreground/20" />
                    <div className="space-y-4">
                      <div>
                        <h3 className="text-lg font-semibold text-muted-foreground mb-1">
                          Free
                        </h3>
                        <p className="text-3xl font-bold text-muted-foreground">
                          $0
                          <span className="text-sm font-normal">/month</span>
                        </p>
                      </div>
                      <ul className="space-y-3">
                        {FREE_FEATURES.map((feature, index) => (
                          <li key={index} className="flex items-start gap-2 text-sm">
                            <div className="mt-0.5 text-muted-foreground/50">
                              <Check size={16} weight="bold" />
                            </div>
                            <span className="text-muted-foreground">{feature}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  </Card>

                  <Card className="bg-gradient-to-br from-primary/20 via-primary/10 to-primary/5 border-primary/50 p-5 relative shadow-lg shadow-primary/10">
                    <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-primary via-purple-500 to-primary" />
                    <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                      <div className="bg-primary text-primary-foreground px-3 py-1 rounded-full text-xs font-semibold tracking-wide flex items-center gap-1 shadow-lg">
                        <Lightning size={12} weight="fill" />
                        RECOMMENDED
                      </div>
                    </div>
                    <div className="space-y-4">
                      <div>
                        <h3 className="text-lg font-semibold text-primary mb-1">
                          Pro
                        </h3>
                        <p className="text-3xl font-bold text-foreground">
                          $9.99
                          <span className="text-sm font-normal text-muted-foreground">/month</span>
                        </p>
                      </div>
                      <ul className="space-y-3">
                        {PRO_FEATURES.map((feature, index) => (
                          <motion.li
                            key={index}
                            initial={{ opacity: 0, x: -10 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ delay: index * 0.05 + 0.2 }}
                            className="flex items-start gap-2 text-sm"
                          >
                            <div className="mt-0.5 text-primary">
                              <Check size={16} weight="bold" />
                            </div>
                            <span className="text-foreground font-medium">{feature}</span>
                          </motion.li>
                        ))}
                      </ul>
                    </div>
                  </Card>
                </div>

                <div className="space-y-3 pt-2">
                  <Button
                    onClick={() => {
                      onClose()
                      onUpgrade()
                    }}
                    size="lg"
                    className="w-full bg-gradient-to-r from-primary via-purple-600 to-primary bg-[length:200%_100%] hover:bg-[position:100%_0] transition-all duration-500 shadow-lg shadow-primary/25 text-base font-semibold"
                  >
                    <Lightning size={20} weight="fill" className="mr-2" />
                    View Pro Features
                  </Button>
                  <p className="text-center text-xs text-muted-foreground">
                    7-day free trial • Cancel anytime
                  </p>
                </div>

                <div className="pt-4 border-t border-border/50">
                  <div className="grid grid-cols-3 gap-4 text-center">
                    <div>
                      <div className="text-2xl font-bold text-primary">10k+</div>
                      <div className="text-xs text-muted-foreground">Active users</div>
                    </div>
                    <div>
                      <div className="text-2xl font-bold text-primary">4.9★</div>
                      <div className="text-xs text-muted-foreground">App rating</div>
                    </div>
                    <div>
                      <div className="text-2xl font-bold text-primary">99%</div>
                      <div className="text-xs text-muted-foreground">Satisfaction</div>
                    </div>
                  </div>
                </div>
              </div>
            </Card>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}
