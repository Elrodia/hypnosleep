import { Gift, Copy, WhatsappLogo, XLogo, EnvelopeSimple } from '@phosphor-icons/react'
import { useKV } from '@/hooks/use-kv'
import { toast } from 'sonner'
import { motion } from 'framer-motion'

export function ReferralCard() {
  const [referralCount] = useKV<number>('referral-count', 0)
  const [userId] = useKV<string>('user-id', 'USER123')

  const safeReferralCount = referralCount ?? 0
  const safeUserId = userId ?? 'USER123'
  
  const referralLink = `https://hypnosleep.app/join/${safeUserId}`
  const referralMessage = "Try HypnoSleep - AI-powered hypnosis for better sleep. Get 7 days free with my link!"

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(referralLink)
      toast.success('Copied!', {
        duration: 2000,
      })
    } catch (err) {
      toast.error('Failed to copy link')
    }
  }

  const handleWhatsApp = () => {
    const url = `https://wa.me/?text=${encodeURIComponent(referralMessage + ' ' + referralLink)}`
    window.open(url, '_blank')
  }

  const handleTwitter = () => {
    const url = `https://twitter.com/intent/tweet?text=${encodeURIComponent(referralMessage)}&url=${encodeURIComponent(referralLink)}`
    window.open(url, '_blank')
  }

  const handleEmail = () => {
    const subject = 'Try HypnoSleep - Get 7 Days Free'
    const body = `${referralMessage}\n\n${referralLink}`
    window.location.href = `mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`
  }

  return (
    <div className="relative overflow-hidden rounded-xl">
      <div className="absolute inset-0 bg-gradient-to-br from-primary via-[#9b7cfc] to-[#c77cfc] opacity-90" />
      
      <div 
        className="absolute inset-0 opacity-30"
        style={{
          background: 'linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.3) 50%, transparent 100%)',
          backgroundSize: '200% 100%',
          animation: 'shimmer 3s linear infinite'
        }}
      />
      
      <div className="relative p-6 space-y-5">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-12 h-12 rounded-xl bg-white/20 backdrop-blur-sm flex items-center justify-center">
                <Gift className="w-6 h-6 text-white" weight="bold" />
              </div>
              <h3 className="text-xl font-semibold text-white">
                Refer a Friend
              </h3>
            </div>
            <p className="text-white/90 text-base font-medium leading-relaxed">
              Give 7 days free, get 7 days free.
            </p>
          </div>
        </div>

        <div className="space-y-3">
          <div className="bg-white/15 backdrop-blur-sm rounded-lg p-3 border border-white/20">
            <p className="text-white/70 text-xs font-medium mb-2 uppercase tracking-wide">
              Your Referral Link
            </p>
            <div className="flex items-center gap-2">
              <div className="flex-1 bg-white/10 rounded-md px-3 py-2 border border-white/20">
                <p className="text-white text-sm font-mono truncate">
                  {referralLink}
                </p>
              </div>
              <motion.button
                whileTap={{ scale: 0.95 }}
                onClick={handleCopyLink}
                className="px-4 py-2 bg-white rounded-md flex items-center gap-2 hover:bg-white/90 transition-colors active:scale-95"
              >
                <Copy className="w-4 h-4 text-primary" weight="bold" />
                <span className="text-sm font-semibold text-primary">
                  Copy
                </span>
              </motion.button>
            </div>
          </div>

          <div className="flex items-center justify-center gap-1 text-white/90 text-sm">
            <span className="font-semibold">{safeReferralCount}</span>
            <span>friend{safeReferralCount !== 1 ? 's' : ''} referred</span>
          </div>
        </div>

        <div className="space-y-3">
          <p className="text-white/70 text-xs font-medium uppercase tracking-wide text-center">
            Share Via
          </p>
          <div className="flex items-center justify-center gap-3">
            <motion.button
              whileTap={{ scale: 0.95 }}
              onClick={handleWhatsApp}
              className="flex-1 bg-white/15 backdrop-blur-sm hover:bg-white/25 border border-white/20 rounded-lg p-3 flex flex-col items-center justify-center gap-2 transition-colors"
              aria-label="Share on WhatsApp"
            >
              <WhatsappLogo className="w-6 h-6 text-white" weight="fill" />
              <span className="text-xs text-white/90 font-medium">WhatsApp</span>
            </motion.button>

            <motion.button
              whileTap={{ scale: 0.95 }}
              onClick={handleTwitter}
              className="flex-1 bg-white/15 backdrop-blur-sm hover:bg-white/25 border border-white/20 rounded-lg p-3 flex flex-col items-center justify-center gap-2 transition-colors"
              aria-label="Share on X"
            >
              <XLogo className="w-6 h-6 text-white" weight="fill" />
              <span className="text-xs text-white/90 font-medium">X</span>
            </motion.button>

            <motion.button
              whileTap={{ scale: 0.95 }}
              onClick={handleEmail}
              className="flex-1 bg-white/15 backdrop-blur-sm hover:bg-white/25 border border-white/20 rounded-lg p-3 flex flex-col items-center justify-center gap-2 transition-colors"
              aria-label="Share via Email"
            >
              <EnvelopeSimple className="w-6 h-6 text-white" weight="fill" />
              <span className="text-xs text-white/90 font-medium">Email</span>
            </motion.button>

            <motion.button
              whileTap={{ scale: 0.95 }}
              onClick={handleCopyLink}
              className="flex-1 bg-white/15 backdrop-blur-sm hover:bg-white/25 border border-white/20 rounded-lg p-3 flex flex-col items-center justify-center gap-2 transition-colors"
              aria-label="Copy link"
            >
              <Copy className="w-6 h-6 text-white" weight="bold" />
              <span className="text-xs text-white/90 font-medium">Copy</span>
            </motion.button>
          </div>
        </div>
      </div>
    </div>
  )
}
