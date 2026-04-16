import { useState } from 'react'
import { motion } from 'framer-motion'
import { ArrowLeft, Sparkle, Check, Lightning, Download, Prohibit, Waveform, Palette } from '@phosphor-icons/react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'

interface ProUpgradePageProps {
  onBack: () => void
}

const BENEFITS = [
  {
    icon: Lightning,
    title: 'Unlimited AI Sessions',
    description: 'Generate as many personalized hypnosis sessions as you need',
  },
  {
    icon: Waveform,
    title: 'All Premium Voices',
    description: 'Access all 6 professional voice options',
  },
  {
    icon: Download,
    title: 'Offline Downloads',
    description: 'Download sessions to listen anywhere, anytime',
  },
  {
    icon: Palette,
    title: 'Background Sound Library',
    description: 'Unlock all ambient sounds and binaural beats',
  },
  {
    icon: Prohibit,
    title: 'No Advertisements',
    description: 'Uninterrupted, ad-free listening experience',
  },
  {
    icon: Lightning,
    title: 'Priority Generation Speed',
    description: 'Skip the queue with faster AI generation',
  },
]

export function ProUpgradePage({ onBack }: ProUpgradePageProps) {
  const [billingCycle, setBillingCycle] = useState<'monthly' | 'yearly'>('yearly')

  const monthlyPrice = 19.99
  const yearlyPrice = 119.99
  const yearlySavings = Math.round(((monthlyPrice * 12 - yearlyPrice) / (monthlyPrice * 12)) * 100)

  const handleStartTrial = () => {
    const stripeLink = billingCycle === 'monthly'
      ? import.meta.env.VITE_STRIPE_MONTHLY_LINK
      : import.meta.env.VITE_STRIPE_ANNUAL_LINK

    if (stripeLink) {
      window.open(stripeLink, '_blank')
    } else {
      window.dispatchEvent(new CustomEvent('show-payment-success'))
      onBack()
    }
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="sticky top-0 z-10 bg-background/80 backdrop-blur-lg border-b border-border">
        <div className="flex items-center justify-between p-4">
          <button
            onClick={onBack}
            className="flex items-center gap-2 text-foreground hover:text-primary transition-colors"
          >
            <ArrowLeft size={24} weight="bold" />
          </button>
          <h2 className="text-sm font-semibold text-muted-foreground">Upgrade</h2>
          <div className="w-6" />
        </div>
      </div>

      <div className="px-6 py-8 space-y-8 max-w-2xl mx-auto">
        <div className="text-center space-y-4">
          <div className="flex items-center justify-center gap-3">
            <motion.div
              animate={{
                rotate: [0, 5, -5, 5, 0],
                scale: [1, 1.1, 1.1, 1.1, 1],
              }}
              transition={{
                duration: 2,
                ease: 'easeInOut',
                repeat: Infinity,
                repeatDelay: 3,
              }}
            >
              <Sparkle className="text-primary" size={48} weight="fill" />
            </motion.div>
            <h1 className="text-4xl font-bold tracking-tight bg-gradient-to-br from-foreground via-foreground to-primary bg-clip-text text-transparent">
              HypnoSleep Pro
            </h1>
          </div>
          <p className="text-muted-foreground text-lg max-w-md mx-auto">
            Unlock unlimited access to transform your mind and sleep better every night
          </p>
        </div>

        <div className="space-y-3">
          {BENEFITS.map((benefit, index) => {
            const Icon = benefit.icon
            return (
              <motion.div
                key={index}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: index * 0.08, duration: 0.4, ease: 'easeOut' }}
              >
                <Card className="bg-card border-border p-4 hover:border-primary/50 transition-colors">
                  <div className="flex items-start gap-4">
                    <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0">
                      <Icon className="text-primary" size={24} weight="duotone" />
                    </div>
                    <div className="flex-1 pt-1">
                      <div className="flex items-start justify-between gap-2">
                        <h3 className="font-semibold text-foreground leading-tight">
                          {benefit.title}
                        </h3>
                        <Check className="text-primary flex-shrink-0" size={20} weight="bold" />
                      </div>
                      <p className="text-sm text-muted-foreground mt-1 leading-relaxed">
                        {benefit.description}
                      </p>
                    </div>
                  </div>
                </Card>
              </motion.div>
            )
          })}
        </div>

        <div className="space-y-4 pt-4">
          <div className="flex items-center justify-center gap-3">
            <button
              onClick={() => setBillingCycle('monthly')}
              className={`px-6 py-3 rounded-xl font-semibold transition-all ${
                billingCycle === 'monthly'
                  ? 'bg-primary text-primary-foreground shadow-lg shadow-primary/25'
                  : 'bg-card border border-border text-muted-foreground hover:border-primary/50'
              }`}
            >
              Monthly
            </button>
            <button
              onClick={() => setBillingCycle('yearly')}
              className={`px-6 py-3 rounded-xl font-semibold transition-all relative ${
                billingCycle === 'yearly'
                  ? 'bg-primary text-primary-foreground shadow-lg shadow-primary/25'
                  : 'bg-card border border-border text-muted-foreground hover:border-primary/50'
              }`}
            >
              Yearly
              {billingCycle === 'yearly' && (
                <motion.div
                  initial={{ scale: 0, rotate: -12 }}
                  animate={{ scale: 1, rotate: -12 }}
                  className="absolute -top-2 -right-2 bg-gradient-to-r from-green-500 to-emerald-500 text-white text-xs font-bold px-2 py-0.5 rounded-full shadow-lg"
                >
                  Save {yearlySavings}%
                </motion.div>
              )}
            </button>
          </div>

          <Card className="bg-gradient-to-br from-primary/10 via-primary/5 to-background border-primary/30 p-6">
            <div className="text-center space-y-2">
              <div className="flex items-baseline justify-center gap-2">
                <span className="text-5xl font-bold text-foreground">
                  ${billingCycle === 'monthly' ? monthlyPrice.toFixed(2) : yearlyPrice.toFixed(2)}
                </span>
                <span className="text-xl text-muted-foreground">
                  /{billingCycle === 'monthly' ? 'month' : 'year'}
                </span>
              </div>
              {billingCycle === 'yearly' && (
                <motion.p
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="text-sm text-primary font-semibold"
                >
                  Just ${(yearlyPrice / 12).toFixed(2)}/month • Save ${(monthlyPrice * 12 - yearlyPrice).toFixed(2)}
                </motion.p>
              )}
            </div>
          </Card>
        </div>

        <div className="space-y-3 pt-2">
          <Button
            size="lg"
            onClick={handleStartTrial}
            className="w-full bg-gradient-to-r from-primary via-purple-600 to-primary bg-[length:200%_100%] hover:bg-[position:100%_0] transition-all duration-500 shadow-xl shadow-primary/30 text-lg font-bold h-14"
          >
            <Sparkle size={24} weight="fill" className="mr-2" />
            Start Free 7-Day Trial
          </Button>
          <p className="text-center text-sm text-muted-foreground px-4 leading-relaxed">
            Cancel anytime. No charge until trial ends.
          </p>
        </div>

        <div className="pt-6 border-t border-border">
          <div className="grid grid-cols-3 gap-6 text-center">
            <div>
              <div className="text-2xl font-bold text-primary mb-1">10k+</div>
              <div className="text-xs text-muted-foreground">Pro Members</div>
            </div>
            <div>
              <div className="text-2xl font-bold text-primary mb-1">4.9★</div>
              <div className="text-xs text-muted-foreground">Rating</div>
            </div>
            <div>
              <div className="text-2xl font-bold text-primary mb-1">99%</div>
              <div className="text-xs text-muted-foreground">Satisfaction</div>
            </div>
          </div>
        </div>

        <div className="text-center space-y-2 pt-4 pb-8">
          <p className="text-xs text-muted-foreground/80">
            By continuing, you agree to our Terms of Service and Privacy Policy
          </p>
          <p className="text-xs text-muted-foreground/60">
            Payments processed securely • Cancel in one tap
          </p>
        </div>
      </div>
    </div>
  )
}
