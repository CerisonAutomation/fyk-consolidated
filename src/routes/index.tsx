import { createFileRoute, Link } from '@tanstack/react-router'
import { useState, useEffect, useRef } from 'react'
import {
	Crown,
	ArrowRight,
	BrainCircuit,
	Shield,
	MessageCircle,
	Compass,
	CalendarHeart,
	ChevronDown,
	CheckCircle2,
	Sparkles,
	Bot,
	Mic,
	Star,
	Heart,
	TrendingUp,
	Quote,
} from 'lucide-react'

export const Route = createFileRoute('/')({
  component: LandingPage,
})

/* ═══════════════════════════════════════════════════════════════
   FYK PREMIUM LANDING PAGE
   Extracted from ZENITH, adapted for TanStack Router
   ═══════════════════════════════════════════════════════════════ */

/* ─── Intersection Observer Hook ─── */
function useInView(threshold = 0.15) {
  const ref = useRef<HTMLDivElement>(null)
  const [inView, setInView] = useState(false)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    const obs = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) setInView(true)
      },
      { threshold },
    )
    obs.observe(el)
    return () => obs.disconnect()
  }, [threshold])

  return { ref, inView }
}

/* ─── Animated Section Wrapper ─── */
function AnimatedSection({
  children,
  className = '',
}: {
  children: React.ReactNode
  className?: string
}) {
  const { ref, inView } = useInView(0.1)
  return (
    <div
      ref={ref}
      className={`transition-all duration-1000 ease-out ${
        inView ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'
      } ${className}`}
    >
      {children}
    </div>
  )
}

/* ─── Staggered Letter Component ─── */
function StaggeredText({
  text,
  className = '',
  delay = 0,
  staggerMs = 60,
  goldGradient = false,
}: {
  text: string
  className?: string
  delay?: number
  staggerMs?: number
  goldGradient?: boolean
}) {
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    const t = setTimeout(() => setVisible(true), delay)
    return () => clearTimeout(t)
  }, [delay])

  return (
    <div className={`inline-flex overflow-hidden ${className}`} aria-label={text}>
      {text.split('').map((char, i) => (
        <span
          key={i}
          className="inline-block transition-all duration-700 ease-out"
          style={{
            opacity: visible ? 1 : 0,
            transform: visible ? 'translateY(0) scale(1)' : 'translateY(40px) scale(0.8)',
            transitionDelay: `${i * staggerMs}ms`,
            ...(goldGradient
              ? {
                  background:
                    'linear-gradient(135deg, #EAAB08 0%, #F5D76E 40%, #D4AF37 60%, #B8960C 100%)',
                  backgroundSize: '200% 200%',
                  WebkitBackgroundClip: 'text',
                  backgroundClip: 'text',
                  WebkitTextFillColor: 'transparent',
                  animation: 'fyk-shimmer 3s ease-in-out infinite',
                }
              : {}),
          }}
        >
          {char === ' ' ? '\u00A0' : char}
        </span>
      ))}
    </div>
  )
}

/* ─── Animated Counter ─── */
function AnimatedCounter({
  target,
  suffix = '',
  prefix = '',
  duration = 2000,
}: {
  target: number
  suffix?: string
  prefix?: string
  duration?: number
}) {
  const [count, setCount] = useState(0)
  const [started, setStarted] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    const obs = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) setStarted(true)
      },
      { threshold: 0.3 },
    )
    obs.observe(el)
    return () => obs.disconnect()
  }, [])

  useEffect(() => {
    if (!started) return
    const start = performance.now()
    const step = (now: number) => {
      const progress = Math.min((now - start) / duration, 1)
      const eased = 1 - Math.pow(1 - progress, 3)
      setCount(Math.floor(eased * target))
      if (progress < 1) requestAnimationFrame(step)
    }
    requestAnimationFrame(step)
  }, [started, target, duration])

  return (
    <div ref={ref}>
      {prefix}
      {count.toLocaleString()}
      {suffix}
    </div>
  )
}

/* ─── Hero Particle Canvas ─── */
function HeroParticles() {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    let raf = 0
    canvas.width = canvas.offsetWidth * 2
    canvas.height = canvas.offsetHeight * 2
    ctx.scale(2, 2)
    const realW = canvas.offsetWidth
    const realH = canvas.offsetHeight

    const particles: Array<{
      x: number
      y: number
      vx: number
      vy: number
      r: number
      alpha: number
      color: string
    }> = []

    const colors = [
      'rgba(234,179,8,',
      'rgba(245,215,110,',
      'rgba(184,150,12,',
      'rgba(168,85,247,',
      'rgba(0,212,255,',
    ]

    const count = Math.min(60, Math.floor((realW * realH) / 8000))
    for (let i = 0; i < count; i++) {
      particles.push({
        x: Math.random() * realW,
        y: Math.random() * realH,
        vx: (Math.random() - 0.5) * 0.3,
        vy: (Math.random() - 0.5) * 0.3,
        r: Math.random() * 1.5 + 0.5,
        alpha: Math.random() * 0.5 + 0.2,
        color: colors[Math.floor(Math.random() * colors.length)],
      })
    }

    const onResize = () => {
      canvas.width = canvas.offsetWidth * 2
      canvas.height = canvas.offsetHeight * 2
      ctx.setTransform(2, 0, 0, 2, 0, 0)
    }
    window.addEventListener('resize', onResize)

    const draw = () => {
      ctx.clearRect(0, 0, realW, realH)

      // Draw connecting lines
      for (let i = 0; i < particles.length; i++) {
        for (let j = i + 1; j < particles.length; j++) {
          const dx = particles[i].x - particles[j].x
          const dy = particles[i].y - particles[j].y
          const dist = Math.sqrt(dx * dx + dy * dy)
          if (dist < 120) {
            const opacity = (1 - dist / 120) * 0.08
            ctx.strokeStyle = `rgba(234,179,8,${opacity})`
            ctx.lineWidth = 0.5
            ctx.beginPath()
            ctx.moveTo(particles[i].x, particles[i].y)
            ctx.lineTo(particles[j].x, particles[j].y)
            ctx.stroke()
          }
        }
      }

      // Draw particles
      for (const p of particles) {
        p.x += p.vx
        p.y += p.vy
        if (p.x < 0 || p.x > realW) p.vx *= -1
        if (p.y < 0 || p.y > realH) p.vy *= -1

        ctx.beginPath()
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2)
        ctx.fillStyle = `${p.color}${p.alpha})`
        ctx.fill()

        // Glow
        ctx.beginPath()
        ctx.arc(p.x, p.y, p.r * 3, 0, Math.PI * 2)
        ctx.fillStyle = `${p.color}${p.alpha * 0.15})`
        ctx.fill()
      }

      raf = requestAnimationFrame(draw)
    }
    draw()

    return () => {
      cancelAnimationFrame(raf)
      window.removeEventListener('resize', onResize)
    }
  }, [])

  return (
    <canvas
      ref={canvasRef}
      className="absolute inset-0 w-full h-full pointer-events-none"
      style={{ opacity: 0.6 }}
      aria-hidden="true"
    />
  )
}

/* ─── Feature Card Data ─── */
const FEATURES = [
	{
		icon: BrainCircuit,
		label: 'AI Matching',
		desc: 'Smart compatibility powered by deep learning',
		color: '#EAAB08',
		href: '/discover',
	},
	{
		icon: Shield,
		label: 'Verified Kings',
		desc: 'Every profile confirmed and authenticated',
		color: '#22c55e',
		href: '/profile',
	},
	{
		icon: MessageCircle,
		label: 'Real-time Chat',
		desc: 'Instant encrypted messaging',
		color: '#06b6d4',
		href: '/chat',
	},
	{
		icon: Compass,
		label: 'Right Now',
		desc: 'Live spatial radar nearby',
		color: '#a855f7',
		href: '/right-now',
	},
	{
		icon: CalendarHeart,
		label: 'IRL Events',
		desc: 'Curated meetups, dinners, and experiences',
		color: '#f97316',
		href: '/events',
	},
	{
		icon: Bot,
		label: 'AI Dating Coach',
		desc: 'Your personal wingman for icebreakers',
		color: '#EAAB08',
		href: '/chat',
	},
	{
		icon: Mic,
		label: 'Voice Control',
		desc: 'Navigate hands-free with natural language',
		color: '#06b6d4',
		href: '/settings',
	},
]

const HERO_STATS = [
  { value: 2847, suffix: '', label: 'Online Now', color: '#22c55e' },
  { value: 12400, suffix: '', label: 'Matches Today', color: '#EAAB08' },
  { value: 89000, suffix: '+', label: 'Active Kings', color: '#a855f7' },
  { value: 156, suffix: '+', label: 'Events This Month', color: '#f97316' },
]

const SOCIAL_PROOF_AVATARS = [
  { letter: 'K', gradient: 'linear-gradient(135deg, #d4a017, #f7b500)' },
  { letter: 'M', gradient: 'linear-gradient(135deg, #7c3aed, #a855f7)' },
  { letter: 'J', gradient: 'linear-gradient(135deg, #06b6d4, #22d3ee)' },
  { letter: 'R', gradient: 'linear-gradient(135deg, #f43f5e, #fb7185)' },
]

/* ═══════════════════════════════════════════════════════════════
   LANDING PAGE COMPONENT
   ═══════════════════════════════════════════════════════════════ */
function LandingPage() {
  const [hoveredFeature, setHoveredFeature] = useState<number | null>(null)

  return (
    <div className="space-y-0 py-0">
      {/* ═══════════════════════════════════════════════════════════
         HERO SECTION
         ═══════════════════════════════════════════════════════════ */}
      <section
        className="relative min-h-screen flex flex-col items-center justify-center text-center overflow-hidden"
        style={{
          background:
            'linear-gradient(160deg, #0a0014 0%, #110022 25%, #000000 50%, #0a0a0a 70%, #110808 100%)',
        }}
      >
        {/* Animated gradient overlays */}
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            background:
              'radial-gradient(ellipse 80% 50% at 50% 0%, rgba(234,179,8,0.08) 0%, transparent 60%)',
          }}
        />
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            background:
              'radial-gradient(ellipse 60% 40% at 20% 80%, rgba(168,85,247,0.06) 0%, transparent 60%)',
          }}
        />
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            background:
              'radial-gradient(ellipse 50% 30% at 80% 60%, rgba(234,179,8,0.04) 0%, transparent 60%)',
          }}
        />

        {/* Particle Background */}
        <HeroParticles />

        {/* Decorative gold line at top */}
        <div
          className="absolute top-0 left-0 right-0 h-px"
          style={{
            background: 'linear-gradient(90deg, transparent, rgba(234,179,8,0.3), transparent)',
          }}
        />

        {/* Crown Logo */}
        <div
          className="mb-8 relative"
          style={{
            animation:
              'fyk-crownFloat 4s ease-in-out infinite, fyk-fadeIn 1s ease-out 0.2s both',
          }}
        >
          <div className="relative">
            {/* Glow ring behind crown */}
            <div
              className="absolute inset-0 rounded-full"
              style={{
                width: '120px',
                height: '120px',
                margin: 'auto',
                left: 0,
                right: 0,
                top: '-10px',
                background:
                  'radial-gradient(circle, rgba(234,179,8,0.2) 0%, transparent 70%)',
                filter: 'blur(20px)',
                animation: 'fyk-crownPulse 3s ease-in-out infinite',
              }}
            />
            <div
              className="w-24 h-24 sm:w-28 sm:h-28 rounded-2xl flex items-center justify-center relative backdrop-blur-xl overflow-hidden"
              style={{
                background:
                  'linear-gradient(135deg, rgba(234,179,8,0.15) 0%, rgba(234,179,8,0.05) 100%)',
                border: '1px solid rgba(234,179,8,0.25)',
                boxShadow:
                  '0 0 40px rgba(234,179,8,0.15), inset 0 1px 0 rgba(255,255,255,0.05)',
              }}
            >
              <img
                src="/logo-square.svg"
                alt="FYKING"
                className="w-16 h-16 sm:w-20 sm:h-20"
              />
            </div>
          </div>
        </div>

        {/* FYK Logo Text */}
        <div
          className="mb-2"
          style={{ animation: 'fyk-fadeIn 0.8s ease-out 0.3s both' }}
        >
          <img
            src="/logo-horizontal.svg"
            alt="FYKING"
            className="h-8 sm:h-10 w-auto mx-auto"
            style={{ filter: 'drop-shadow(0 0 12px rgba(234,179,8,0.2))' }}
          />
        </div>

        {/* PREMIUM GEOSOCIAL DISCOVERY mono label */}
        <p
          className="font-mono text-xs sm:text-sm uppercase tracking-[0.35em] mb-6 text-center"
          style={{
            color: 'rgba(234,179,8,0.6)',
            animation: 'fyk-fadeIn 0.8s ease-out 0.4s both',
          }}
        >
          Premium Geosocial Discovery
        </p>

        {/* Status Pill */}
        <div
          className="mb-8 inline-flex items-center gap-2 px-4 py-2 rounded-full backdrop-blur-xl"
          style={{
            background: 'rgba(34,197,94,0.08)',
            border: '1px solid rgba(34,197,94,0.2)',
            animation: 'fyk-fadeIn 0.8s ease-out 0.5s both',
          }}
        >
          <span className="relative flex items-center justify-center">
            <span
              className="w-2 h-2 rounded-full bg-emerald-400 absolute"
              style={{ animation: 'fyk-pulse 2s infinite' }}
            />
            <span className="w-2 h-2 rounded-full bg-emerald-400" />
          </span>
          <span className="font-mono text-[10px] sm:text-xs uppercase tracking-[0.25em] text-emerald-400">
            OMEGA v&#8734;.18 &middot; LIVE
          </span>
        </div>

        {/* Hero Title — Find Your */}
        <h1
          className="leading-none mb-2"
          style={{ fontFamily: "'Bebas Neue', 'Impact', 'Arial Narrow', sans-serif" }}
        >
          <StaggeredText
            text="FIND YOUR"
            className="text-5xl sm:text-6xl md:text-7xl lg:text-8xl tracking-wide text-white/90"
            delay={200}
            staggerMs={50}
          />
        </h1>

        {/* Hero Title — King */}
        <h1
          className="leading-none mb-6"
          style={{ fontFamily: "'Bebas Neue', 'Impact', 'Arial Narrow', sans-serif" }}
        >
          <StaggeredText
            text="KING"
            className="text-6xl sm:text-7xl md:text-8xl lg:text-9xl tracking-wider"
            delay={600}
            staggerMs={80}
            goldGradient
          />
          <span
            className="text-amber-400 text-6xl sm:text-7xl md:text-8xl lg:text-9xl inline-block ml-1"
            style={{ animation: 'fyk-fadeIn 0.6s ease-out 1.2s both' }}
          >
            .
          </span>
        </h1>

        {/* Subtitle */}
        <p
          className="max-w-2xl text-sm md:text-base lg:text-lg mb-10 leading-relaxed px-4 font-light"
          style={{
            color: 'rgba(255,255,255,0.5)',
            animation: 'fyk-slideUp 0.8s ease-out 1.0s both',
            fontFamily: "Georgia, 'Times New Roman', serif",
          }}
        >
          The premium dating platform for men who refuse to settle.
          <br className="hidden sm:block" />
          AI-powered matching, voice control, and curated IRL events.
        </p>

        {/* CTA Buttons */}
        <div
          className="flex flex-wrap gap-4 sm:gap-5 justify-center mb-14 px-4"
          style={{ animation: 'fyk-slideUp 0.8s ease-out 1.2s both' }}
        >
          <Link
            to="/grid"
            className="group relative h-14 px-10 rounded-xl text-sm sm:text-base tracking-widest uppercase transition-all duration-300 hover:scale-105 no-underline flex items-center"
            style={{
              fontFamily: "'Bebas Neue', 'Impact', 'Arial Narrow', sans-serif",
              background: 'linear-gradient(135deg, #EAAB08, #F5D76E, #D4AF37)',
              color: '#000',
              boxShadow: '0 0 30px rgba(234,179,8,0.3), 0 4px 20px rgba(234,179,8,0.2)',
            }}
          >
            <span className="relative z-10 flex items-center gap-2">
              ENTER THE KINGDOM
              <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
            </span>
            <div
              className="absolute inset-0 rounded-xl opacity-0 group-hover:opacity-100 transition-opacity duration-300"
              style={{
                boxShadow: '0 0 50px rgba(234,179,8,0.5), 0 0 100px rgba(234,179,8,0.2)',
              }}
            />
          </Link>
          <Link
            to="/settings/profile"
            className="h-14 px-10 rounded-xl text-sm sm:text-base tracking-widest uppercase transition-all duration-300 hover:scale-105 backdrop-blur-xl no-underline flex items-center"
            style={{
              fontFamily: "'Bebas Neue', 'Impact', 'Arial Narrow', sans-serif",
              background: 'rgba(255,255,255,0.05)',
              border: '1px solid rgba(234,179,8,0.3)',
              color: '#EAAB08',
            }}
          >
            <span className="flex items-center gap-2">
              <Crown className="w-4 h-4" />
              VIEW PROFILE
            </span>
          </Link>
        </div>

        {/* Social Proof Strip */}
        <div
          className="flex items-center gap-2 mb-10"
          style={{ animation: 'fyk-slideUp 0.8s ease-out 1.3s both' }}
        >
          <div className="flex -space-x-2">
            {SOCIAL_PROOF_AVATARS.map((a, i) => (
              <div
                key={i}
                className="w-7 h-7 rounded-full flex items-center justify-center text-[8px] font-bold border-2"
                style={{
                  background: a.gradient,
                  color: '#000',
                  borderColor: '#0a0014',
                }}
              >
                {a.letter}
              </div>
            ))}
          </div>
          <p className="text-xs" style={{ color: 'rgba(255,255,255,0.4)' }}>
            <span className="text-amber-400 font-semibold">2,847</span> kings online now
          </p>
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" style={{ animation: 'fyk-pulse 2s infinite' }} />
        </div>

        {/* Hero Stats — Animated Counters */}
        <div
          className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4 w-full max-w-3xl px-4"
          style={{ animation: 'fyk-slideUp 0.8s ease-out 1.4s both' }}
        >
          {HERO_STATS.map((s) => (
            <div
              key={s.label}
              className="rounded-2xl p-4 sm:p-5 text-center backdrop-blur-xl transition-all duration-300 hover:scale-105"
              style={{
                background: 'rgba(255,255,255,0.04)',
                border: '1px solid rgba(255,255,255,0.08)',
              }}
            >
              <div
                className="text-2xl sm:text-3xl md:text-4xl"
                style={{
                  color: s.color,
                  fontFamily: "'Bebas Neue', 'Impact', 'Arial Narrow', sans-serif",
                }}
              >
                <AnimatedCounter target={s.value} suffix={s.suffix} />
              </div>
              <div className="font-mono text-[9px] sm:text-[10px] uppercase tracking-widest mt-1" style={{ color: 'rgba(255,255,255,0.4)' }}>
                {s.label}
              </div>
            </div>
          ))}
        </div>

        {/* Trust Badges */}
        <div
          className="flex flex-wrap items-center justify-center gap-4 sm:gap-6 mt-10 px-4"
          style={{ animation: 'fyk-slideUp 0.8s ease-out 1.6s both' }}
        >
          {[
            { icon: Shield, label: 'Verified Only' },
            { icon: Star, label: '4.9\u2605 Rating' },
            { icon: Heart, label: '12K+ Matches' },
            { icon: TrendingUp, label: '5x Faster' },
          ].map((t) => (
            <div key={t.label} className="flex items-center gap-1.5 text-xs" style={{ color: 'rgba(255,255,255,0.4)' }}>
              <t.icon className="w-3.5 h-3.5" style={{ color: 'rgba(234,179,8,0.6)' }} />
              <span>{t.label}</span>
            </div>
          ))}
        </div>

        {/* Scroll Indicator */}
        <div
          className="absolute bottom-10 flex flex-col items-center gap-2"
          style={{ animation: 'fyk-fadeIn 1s ease-out 2s both' }}
        >
          <span
            className="font-mono text-[9px] uppercase tracking-[0.3em]"
            style={{ color: 'rgba(255,255,255,0.25)' }}
          >
            Scroll
          </span>
          <ChevronDown
            className="w-5 h-5"
            style={{
              color: 'rgba(234,179,8,0.5)',
              animation: 'fyk-scrollChevron 2s ease-in-out infinite',
            }}
          />
        </div>

        {/* Bottom gradient fade */}
        <div
          className="absolute bottom-0 left-0 right-0 h-32 pointer-events-none"
          style={{ background: 'linear-gradient(to top, #000000, transparent)' }}
        />
      </section>

      {/* ═══ GLAMOUR DIVIDER ═══ */}
      <div
        className="flex items-center justify-center gap-3 px-8 py-2"
        style={{ background: '#000' }}
      >
        <div
          className="flex-1 h-px"
          style={{ background: 'linear-gradient(90deg, transparent, rgba(234,179,8,0.3), transparent)' }}
        />
        <Sparkles className="w-3 h-3" style={{ color: 'rgba(234,179,8,0.4)' }} />
        <div
          className="flex-1 h-px"
          style={{ background: 'linear-gradient(90deg, transparent, rgba(234,179,8,0.3), transparent)' }}
        />
      </div>

      {/* ═══ FEATURES GRID ═══ */}
      <section className="py-20 px-4" style={{ background: '#000' }}>
        <AnimatedSection>
          <div className="mb-10 text-center">
            <p
              className="font-mono uppercase tracking-[0.25em] mb-2"
              style={{ fontSize: '0.7rem', color: 'rgba(234,179,8,0.7)' }}
            >
              Features
            </p>
            <h2
              className="tracking-wide"
              style={{
                fontSize: 'clamp(1.5rem, 4vw, 2.5rem)',
                fontFamily: "'Bebas Neue', 'Impact', 'Arial Narrow', sans-serif",
                color: 'rgba(255,255,255,0.9)',
              }}
            >
              Engineered for{' '}
              <span
                style={{
                  background: 'linear-gradient(135deg, #EAAB08, #F5D76E)',
                  WebkitBackgroundClip: 'text',
                  backgroundClip: 'text',
                  WebkitTextFillColor: 'transparent',
                }}
              >
                royalty
              </span>
            </h2>
            <p
              className="mt-2 max-w-lg mx-auto"
              style={{ color: 'rgba(255,255,255,0.4)', fontSize: '0.875rem' }}
            >
              Every feature obsessively crafted to help men find meaningful connections faster.
            </p>
          </div>
        </AnimatedSection>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-5 max-w-6xl mx-auto">
          {FEATURES.map((f, i) => (
            <AnimatedSection key={f.label}>
              <Link
                to={f.href}
                className={`group relative rounded-2xl p-6 sm:p-7 block transition-all duration-500 hover:-translate-y-2 no-underline ${
                  hoveredFeature === i ? 'border-amber-400/30' : ''
                }`}
                style={{
                  background: 'rgba(255,255,255,0.04)',
                  border: '1px solid rgba(255,255,255,0.08)',
                  backdropFilter: 'blur(24px)',
                  boxShadow:
                    hoveredFeature === i
                      ? `0 20px 60px rgba(0,0,0,0.4), 0 0 30px ${f.color}15`
                      : '0 4px 20px rgba(0,0,0,0.2)',
                }}
                onMouseEnter={() => setHoveredFeature(i)}
                onMouseLeave={() => setHoveredFeature(null)}
              >
                {/* Hover glow */}
                <div
                  className="absolute inset-0 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none"
                  style={{
                    background: `radial-gradient(circle at 50% 0%, ${f.color}15 0%, transparent 70%)`,
                  }}
                />

                <div className="relative z-10">
                  <div
                    className="w-12 h-12 rounded-xl flex items-center justify-center mb-4"
                    style={{ background: `${f.color}12` }}
                  >
                    <f.icon className="w-6 h-6" style={{ color: f.color }} />
                  </div>
                  <h3
                    className="text-xl tracking-wide mb-2"
                    style={{
                      fontFamily: "'Bebas Neue', 'Impact', 'Arial Narrow', sans-serif",
                      color: 'rgba(255,255,255,0.9)',
                    }}
                  >
                    {f.label}
                  </h3>
                  <p className="text-sm leading-relaxed mb-5" style={{ color: 'rgba(255,255,255,0.4)' }}>
                    {f.desc}
                  </p>
                  <span
                    className="inline-flex items-center gap-1.5 text-[10px] font-mono uppercase tracking-widest transition-all group-hover:gap-2.5"
                    style={{ color: 'rgba(234,179,8,0.7)' }}
                  >
                    Explore <ArrowRight className="w-3 h-3" />
                  </span>
                </div>
              </Link>
            </AnimatedSection>
          ))}
        </div>
      </section>

      {/* ═══ HOW IT WORKS ═══ */}
      <section className="py-20 px-4" style={{ background: '#000' }}>
        <AnimatedSection>
          <div className="mb-10 text-center">
            <p
              className="font-mono uppercase tracking-[0.25em] mb-2"
              style={{ fontSize: '0.7rem', color: 'rgba(234,179,8,0.7)' }}
            >
              How It Works
            </p>
            <h2
              className="tracking-wide"
              style={{
                fontSize: 'clamp(1.5rem, 4vw, 2.5rem)',
                fontFamily: "'Bebas Neue', 'Impact', 'Arial Narrow', sans-serif",
                color: 'rgba(255,255,255,0.9)',
              }}
            >
              Three steps to your{' '}
              <span
                style={{
                  background: 'linear-gradient(135deg, #a855f7, #c084fc)',
                  WebkitBackgroundClip: 'text',
                  backgroundClip: 'text',
                  WebkitTextFillColor: 'transparent',
                }}
              >
                next connection
              </span>
            </h2>
          </div>
        </AnimatedSection>

        <div className="grid md:grid-cols-3 gap-4 sm:gap-5 max-w-5xl mx-auto relative">
          <div
            className="hidden md:block absolute top-1/2 left-[20%] right-[20%] h-px -translate-y-1/2 z-0"
            style={{
              background: 'linear-gradient(90deg, #EAAB08 0%, #a855f7 50%, #22c55e 100%)',
              opacity: 0.15,
            }}
          />

          {[
            {
              step: '01',
              title: 'Build Your Profile',
              color: '#EAAB08',
              desc: 'AI-assisted bio and photo curation. Craft a profile that truly represents the king you are.',
            },
            {
              step: '02',
              title: 'Browse & Connect',
              color: '#a855f7',
              desc: 'Grid view with compatibility scores \u2014 no swiping. Find genuine connections with men who match your vibe.',
            },
            {
              step: '03',
              title: 'Meet IRL',
              color: '#22c55e',
              desc: 'Curated events and real-time radar. From brunch dates to gym sessions \u2014 meet in person.',
            },
          ].map((s) => (
            <AnimatedSection key={s.step}>
              <div
                className="p-6 sm:p-8 relative overflow-hidden rounded-2xl transition-all duration-300 hover:-translate-y-1"
                style={{
                  background: 'rgba(255,255,255,0.04)',
                  border: '1px solid rgba(255,255,255,0.08)',
                  backdropFilter: 'blur(24px)',
                }}
              >
                <div
                  className="absolute -top-4 -right-2 text-7xl sm:text-8xl opacity-[0.04] leading-none select-none"
                  style={{
                    color: s.color,
                    fontFamily: "'Bebas Neue', 'Impact', 'Arial Narrow', sans-serif",
                  }}
                >
                  {s.step}
                </div>

                <div
                  className="relative z-10 w-10 h-10 rounded-xl flex items-center justify-center text-lg mb-4"
                  style={{
                    background: `${s.color}10`,
                    color: s.color,
                    fontFamily: "'Bebas Neue', 'Impact', 'Arial Narrow', sans-serif",
                  }}
                >
                  {s.step}
                </div>

                <h3
                  className="text-xl sm:text-2xl tracking-wide mb-2 relative z-10"
                  style={{
                    color: s.color,
                    fontFamily: "'Bebas Neue', 'Impact', 'Arial Narrow', sans-serif",
                  }}
                >
                  {s.title}
                </h3>
                <p className="text-sm leading-relaxed relative z-10" style={{ color: 'rgba(255,255,255,0.4)' }}>
                  {s.desc}
                </p>
              </div>
            </AnimatedSection>
          ))}
        </div>
      </section>

      {/* ═══ TESTIMONIALS ═══ */}
      <section className="py-20 px-4" style={{ background: '#000' }}>
        <AnimatedSection>
          <div className="mb-10 text-center">
            <p
              className="font-mono uppercase tracking-[0.25em] mb-2"
              style={{ fontSize: '0.7rem', color: 'rgba(234,179,8,0.7)' }}
            >
              Success Stories
            </p>
            <h2
              className="tracking-wide"
              style={{
                fontSize: 'clamp(1.5rem, 4vw, 2.5rem)',
                fontFamily: "'Bebas Neue', 'Impact', 'Arial Narrow', sans-serif",
                color: 'rgba(255,255,255,0.9)',
              }}
            >
              Kings who found their{' '}
              <span
                style={{
                  background: 'linear-gradient(135deg, #EAAB08, #F5D76E)',
                  WebkitBackgroundClip: 'text',
                  backgroundClip: 'text',
                  WebkitTextFillColor: 'transparent',
                }}
              >
                king
              </span>
            </h2>
          </div>
        </AnimatedSection>

        <div className="grid md:grid-cols-3 gap-4 sm:gap-5 max-w-5xl mx-auto">
          {[
            {
              name: 'Alex T.',
              age: 28,
              role: 'Architect, Brooklyn',
              text: "Met the guy of my dreams at a FYK wine night. The AI coach helped me break the ice \u2014 something I always struggled with. We've been together 6 months now.",
              score: 97,
              color: '#EAAB08',
            },
            {
              name: 'Jordan M.',
              age: 31,
              role: 'Personal Trainer, West Hollywood',
              text: "The spatial radar is insane. I saw a guy at the gym I'd been eyeing for weeks, matched instantly, and now we train together every morning. Game changer.",
              score: 91,
              color: '#22c55e',
            },
            {
              name: 'Kai L.',
              age: 26,
              role: 'Software Engineer, San Francisco',
              text: "As a shy guy, the AI smart replies saved me so many awkward silences. Within two weeks I'd connected with more men than my entire last year on other apps.",
              score: 94,
              color: '#06b6d4',
            },
          ].map((t) => (
            <AnimatedSection key={t.name}>
              <div
                className="p-6 rounded-2xl relative transition-all duration-300 hover:-translate-y-1"
                style={{
                  background: 'rgba(255,255,255,0.04)',
                  border: '1px solid rgba(255,255,255,0.08)',
                  backdropFilter: 'blur(24px)',
                }}
              >
                <Quote className="w-10 h-10 absolute top-4 right-4" style={{ color: 'rgba(234,179,8,0.1)' }} />

                <div className="flex items-center gap-3 mb-4">
                  {/* Compatibility ring */}
                  <div
                    className="relative inline-flex items-center justify-center"
                    style={{ width: 52, height: 52 }}
                  >
                    <svg width={52} height={52} className="-rotate-90">
                      <circle
                        cx={26}
                        cy={26}
                        r={22}
                        fill="none"
                        stroke="rgba(255,255,255,0.05)"
                        strokeWidth="4"
                      />
                      <circle
                        cx={26}
                        cy={26}
                        r={22}
                        fill="none"
                        stroke={t.color}
                        strokeWidth="4"
                        strokeDasharray={2 * Math.PI * 22}
                        strokeDashoffset={2 * Math.PI * 22 - (t.score / 100) * 2 * Math.PI * 22}
                        strokeLinecap="round"
                      />
                    </svg>
                    <div className="absolute inset-0 flex flex-col items-center justify-center">
                      <span className="text-lg" style={{ color: t.color, fontFamily: "'Bebas Neue', 'Impact', 'Arial Narrow', sans-serif" }}>
                        {t.score}
                      </span>
                      <span className="font-mono text-[7px] uppercase tracking-widest" style={{ color: 'rgba(255,255,255,0.4)' }}>
                        match
                      </span>
                    </div>
                  </div>
                  <div>
                    <p className="text-sm font-medium" style={{ color: 'rgba(255,255,255,0.9)' }}>
                      {t.name}, {t.age}
                    </p>
                    <p className="text-[10px]" style={{ color: 'rgba(255,255,255,0.4)' }}>{t.role}</p>
                  </div>
                </div>

                <p className="text-sm leading-relaxed mb-4 relative z-10" style={{ color: 'rgba(255,255,255,0.6)' }}>
                  &ldquo;{t.text}&rdquo;
                </p>

                <div className="flex items-center gap-3">
                  <div className="flex gap-0.5">
                    {[1, 2, 3, 4, 5].map((i) => (
                      <Star key={i} className="w-3.5 h-3.5 fill-amber-400 text-amber-400" />
                    ))}
                  </div>
                  <span className="text-[10px] font-mono" style={{ color: 'rgba(255,255,255,0.4)' }}>
                    {t.score}% match
                  </span>
                </div>
              </div>
            </AnimatedSection>
          ))}
        </div>
      </section>

      {/* ═══ PRICING PREVIEW ═══ */}
      <section className="py-20 px-4" style={{ background: '#000' }}>
        <AnimatedSection>
          <div className="mb-10 text-center">
            <p
              className="font-mono uppercase tracking-[0.25em] mb-2"
              style={{ fontSize: '0.7rem', color: 'rgba(234,179,8,0.7)' }}
            >
              Membership
            </p>
            <h2
              className="tracking-wide"
              style={{
                fontSize: 'clamp(1.5rem, 4vw, 2.5rem)',
                fontFamily: "'Bebas Neue', 'Impact', 'Arial Narrow', sans-serif",
                color: 'rgba(255,255,255,0.9)',
              }}
            >
              Choose your{' '}
              <span
                style={{
                  background: 'linear-gradient(135deg, #EAAB08, #F5D76E)',
                  WebkitBackgroundClip: 'text',
                  backgroundClip: 'text',
                  WebkitTextFillColor: 'transparent',
                }}
              >
                crown
              </span>
            </h2>
            <p
              className="mt-2 max-w-lg mx-auto"
              style={{ color: 'rgba(255,255,255,0.4)', fontSize: '0.875rem' }}
            >
              Premium members match 5x faster. Cancel anytime, no hidden fees.
            </p>
          </div>
        </AnimatedSection>

        <div className="grid md:grid-cols-3 gap-4 sm:gap-5 max-w-5xl mx-auto">
          {[
            {
              name: 'NOBLE',
              price: '$9.99',
              color: '#06b6d4',
              features: ['Unlimited likes', '5 super-likes/day', 'See who liked you', 'Advanced filters'],
            },
            {
              name: 'ROYAL',
              price: '$24.99',
              color: '#a855f7',
              featured: true,
              features: ['Everything in Noble', 'Unlimited super-likes', 'Advanced analytics', 'Exclusive events', 'AI Dating Coach'],
            },
            {
              name: 'KING',
              price: '$49.99',
              color: '#EAAB08',
              features: ['Everything in Royal', 'Incognito browsing', 'Dedicated concierge', 'VIP retreats', 'Priority visibility'],
            },
          ].map((tier) => (
            <AnimatedSection key={tier.name}>
              <div
                className={`p-6 sm:p-8 relative rounded-2xl transition-all duration-300 hover:-translate-y-1 ${
                  tier.featured ? 'md:scale-105' : ''
                }`}
                style={{
                  background: tier.featured
                    ? 'linear-gradient(135deg, rgba(234,179,8,0.08), rgba(255,255,255,0.04))'
                    : 'rgba(255,255,255,0.04)',
                  border: tier.featured
                    ? '1px solid rgba(234,179,8,0.3)'
                    : '1px solid rgba(255,255,255,0.08)',
                  backdropFilter: 'blur(24px)',
                  boxShadow: tier.featured ? '0 0 40px rgba(234,179,8,0.1)' : '0 4px 20px rgba(0,0,0,0.2)',
                }}
              >
                {tier.featured && (
                  <div
                    className="absolute -top-3 left-1/2 -translate-x-1/2 px-4 py-1 rounded-full text-black text-[10px] font-mono uppercase tracking-widest whitespace-nowrap"
                    style={{ background: 'linear-gradient(135deg, #EAAB08, #F5D76E)' }}
                  >
                    Most Popular
                  </div>
                )}

                <div className="text-center mb-6">
                  <div
                    className="w-12 h-12 mx-auto rounded-xl flex items-center justify-center mb-3"
                    style={{ background: `${tier.color}15` }}
                  >
                    <Crown className="w-6 h-6" style={{ color: tier.color }} />
                  </div>
                  <h3
                    className="text-2xl sm:text-3xl tracking-widest"
                    style={{
                      color: tier.color,
                      fontFamily: "'Bebas Neue', 'Impact', 'Arial Narrow', sans-serif",
                    }}
                  >
                    {tier.name}
                  </h3>
                  <div className="mt-3 flex items-baseline justify-center gap-1">
                    <span
                      className="text-4xl sm:text-5xl"
                      style={{
                        color: tier.color,
                        fontFamily: "'Bebas Neue', 'Impact', 'Arial Narrow', sans-serif",
                      }}
                    >
                      {tier.price}
                    </span>
                    <span className="text-sm" style={{ color: 'rgba(255,255,255,0.4)' }}>/mo</span>
                  </div>
                </div>

                <div className="space-y-3 mb-6">
                  {tier.features.map((f, i) => (
                    <div key={i} className="flex items-center gap-2.5 text-sm">
                      <CheckCircle2 className="w-4 h-4 shrink-0" style={{ color: tier.color }} />
                      <span style={{ color: 'rgba(255,255,255,0.7)' }}>{f}</span>
                    </div>
                  ))}
                </div>

                <Link
                  to="/settings/profile"
                  className={`w-full py-3 rounded-xl text-sm tracking-wider transition-all duration-300 block text-center no-underline ${
                    tier.featured
                      ? 'text-black hover:shadow-[0_8px_30px_rgba(234,179,8,0.3)] hover:-translate-y-0.5'
                      : 'hover:-translate-y-0.5'
                  }`}
                  style={{
                    fontFamily: "'Bebas Neue', 'Impact', 'Arial Narrow', sans-serif",
                    ...(tier.featured
                      ? { background: 'linear-gradient(135deg, #EAAB08, #F5D76E)' }
                      : { background: 'transparent', border: '1px solid rgba(255,255,255,0.15)', color: 'white' }),
                  }}
                >
                  CHOOSE {tier.name}
                </Link>
              </div>
            </AnimatedSection>
          ))}
        </div>
      </section>

      {/* ═══ FINAL CTA ═══ */}
      <AnimatedSection>
        <section
          className="relative text-center py-20 sm:py-24 overflow-hidden"
          style={{ background: '#000' }}
        >
          <div
            className="absolute inset-0 pointer-events-none"
            style={{
              background: 'radial-gradient(ellipse at center, rgba(234,179,8,0.06) 0%, transparent 60%)',
            }}
          />

          <div
            className="inline-flex items-center gap-2 mb-6 px-4 py-2 rounded-full backdrop-blur-xl relative"
            style={{
              background: 'rgba(234,179,8,0.08)',
              border: '1px solid rgba(234,179,8,0.25)',
            }}
          >
            <Sparkles className="w-4 h-4 text-amber-400" />
            <span className="font-mono text-[10px] sm:text-xs uppercase tracking-[0.25em] text-amber-400">
              7-Day Free Trial
            </span>
          </div>

          <h2
            className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl tracking-wide mb-4 relative"
            style={{
              color: 'rgba(255,255,255,0.9)',
              fontFamily: "'Bebas Neue', 'Impact', 'Arial Narrow', sans-serif",
            }}
          >
            Ready to claim{' '}
            <span
              style={{
                background: 'linear-gradient(135deg, #EAAB08, #F5D76E)',
                WebkitBackgroundClip: 'text',
                backgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
              }}
            >
              your throne?
            </span>
          </h2>

          <p className="text-sm sm:text-base max-w-lg mx-auto mb-8 relative" style={{ color: 'rgba(255,255,255,0.4)' }}>
            Join thousands of men who've found meaningful connections on FYK. Your next great story
            starts here.
          </p>

          <div className="flex flex-wrap gap-4 justify-center relative">
            <Link
              to="/grid"
              className="group relative h-14 px-10 rounded-xl text-sm sm:text-base tracking-widest uppercase transition-all duration-300 hover:scale-105 no-underline flex items-center"
              style={{
                fontFamily: "'Bebas Neue', 'Impact', 'Arial Narrow', sans-serif",
                background: 'linear-gradient(135deg, #EAAB08, #F5D76E, #D4AF37)',
                color: '#000',
                boxShadow: '0 0 30px rgba(234,179,8,0.3)',
              }}
            >
              <span className="relative z-10 flex items-center gap-2">
                <Crown className="w-5 h-5" />
                START YOUR REIGN
              </span>
            </Link>
            <Link
              to="/chat"
              className="h-14 px-10 rounded-xl text-sm sm:text-base tracking-widest uppercase transition-all duration-300 hover:scale-105 backdrop-blur-xl no-underline flex items-center"
              style={{
                fontFamily: "'Bebas Neue', 'Impact', 'Arial Narrow', sans-serif",
                background: 'rgba(255,255,255,0.05)',
                border: '1px solid rgba(255,255,255,0.15)',
                color: 'white',
              }}
            >
              <span className="flex items-center gap-2">
                EXPLORE FOR FREE
                <ArrowRight className="w-4 h-4" />
              </span>
            </Link>
          </div>

          <p className="mt-8 text-[10px] font-mono tracking-widest uppercase relative" style={{ color: 'rgba(255,255,255,0.2)' }}>
            No credit card required &middot; Cancel anytime &middot; Verified members only
          </p>
        </section>
      </AnimatedSection>

      {/* ═══ Footer ═══ */}
      <footer
        className="py-12 px-4 text-center"
        style={{
          background: '#000',
          borderTop: '1px solid rgba(255,255,255,0.05)',
        }}
      >
        <div className="flex items-center justify-center gap-2 mb-4">
          <img
            src="/logo-horizontal.svg"
            alt="FYKING"
            className="h-5 w-auto"
            style={{ filter: 'drop-shadow(0 0 8px rgba(234,179,8,0.15))' }}
          />
        </div>
        <p className="text-[10px] font-mono tracking-widest uppercase" style={{ color: 'rgba(255,255,255,0.2)' }}>
          Find Your King &middot; Premium Dating for Men
        </p>
      </footer>

    </div>
  )
}
