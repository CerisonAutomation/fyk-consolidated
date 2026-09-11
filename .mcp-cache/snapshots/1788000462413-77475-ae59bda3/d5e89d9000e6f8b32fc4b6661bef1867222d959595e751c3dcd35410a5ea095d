import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useState, useCallback } from 'react'
import { supabase } from '#/integrations/supabase/client'
import {
  Eye,
  EyeOff,
  Mail,
  Lock,
  User,
  ArrowRight,
  ArrowLeft,
  KeyRound,
  Sparkles,
  Shield,
  LockKeyhole,
} from 'lucide-react'

export const Route = createFileRoute('/auth/sign-in/')({
  component: SignInPage,
})

/* ── FYKLogo using the actual logo asset ── */
function FYKLogoInline() {
  return (
    <div className="flex items-center justify-center">
      <img
        src="/logo-horizontal.svg"
        alt="FYKING"
        className="h-8 sm:h-9 w-auto"
        style={{ filter: 'drop-shadow(0 0 20px rgba(234,179,8,0.2))' }}
      />
    </div>
  )
}

/* ── Types ── */
type AuthMode = 'login' | 'signup' | 'forgot' | 'reset' | 'magic-link'

const PASSWORD_STRENGTH_LABELS = ['', 'Very Weak', 'Weak', 'Fair', 'Good', 'Strong', 'Very Strong']
const PASSWORD_STRENGTH_COLORS = [
  '',
  'var(--accent-secondary)',
  'var(--accent-fire)',
  'var(--accent-primary)',
  'var(--accent-cyan)',
  'var(--accent-success)',
  'var(--accent-success)',
]

function getPasswordStrength(pw: string) {
  let score = 0
  if (pw.length >= 8) score++
  if (pw.length >= 12) score++
  if (/[A-Z]/.test(pw)) score++
  if (/[a-z]/.test(pw)) score++
  if (/[0-9]/.test(pw)) score++
  if (/[^A-Za-z0-9]/.test(pw)) score++
  return score
}

/* ── Inline styles for glass inputs (matching ZENITH exactly) ── */
const GLASS_INPUT_STYLE: React.CSSProperties = {
  background: 'rgba(255,255,255,0.05)',
  border: '1px solid rgba(255,255,255,0.1)',
}

const GOLD_BUTTON_STYLE: React.CSSProperties = {
  background: 'linear-gradient(135deg, #EAAB08, #F5D76E, #D4AF37)',
  color: '#000',
  boxShadow: '0 0 30px rgba(234,179,8,0.3), 0 4px 20px rgba(234,179,8,0.15)',
}

const GLASS_CARD_STYLE: React.CSSProperties = {
  background: 'rgba(255,255,255,0.04)',
  border: '1px solid rgba(255,255,255,0.08)',
  backdropFilter: 'blur(32px)',
  boxShadow: '0 20px 60px rgba(0,0,0,0.5), 0 0 1px rgba(255,255,255,0.05)',
}

/* ── Main page component ── */
function SignInPage() {
  const navigate = useNavigate()

  const [mode, setMode] = useState<AuthMode>('login')
  const [loading, setLoading] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  // Form state
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [name, setName] = useState('')
  const [handle, setHandle] = useState('')
  const [newPassword, setNewPassword] = useState('')

  const passwordStrength = getPasswordStrength(password)

  /* ── Focus / blur helpers for glass inputs ── */
  const onFocus = useCallback((e: React.FocusEvent<HTMLInputElement>) => {
    e.currentTarget.style.borderColor = 'rgba(234,179,8,0.5)'
    e.currentTarget.style.boxShadow = '0 0 20px rgba(234,179,8,0.1)'
  }, [])
  const onBlur = useCallback((e: React.FocusEvent<HTMLInputElement>) => {
    e.currentTarget.style.borderColor = 'rgba(255,255,255,0.1)'
    e.currentTarget.style.boxShadow = 'none'
  }, [])

  /* ── Auth handlers via Supabase ── */
  const handleLogin = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault()
      setLoading(true)
      setError(null)
      try {
        const { data, error: authError } = await supabase.auth.signInWithPassword({
          email,
          password,
        })
        if (authError) {
          setError(authError.message)
          return
        }
        if (data.session) {
          navigate({ to: '/grid', replace: true })
        }
      } catch {
        setError('Network error — try again')
      } finally {
        setLoading(false)
      }
    },
    [email, password, navigate],
  )

  const handleSignup = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault()
      setLoading(true)
      setError(null)
      setSuccess(null)
      try {
        const { data, error: authError } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: {
              first_name: name || undefined,
              handle: handle || undefined,
            },
          },
        })
        if (authError) {
          setError(authError.message)
          return
        }
        // If auto-confirmed (email confirm disabled), go to onboarding
        if (data.session) {
          navigate({ to: '/onboarding', replace: true })
          return
        }
        // Email confirmation required
        setSuccess(`We sent a confirmation link to ${email}. Check your inbox!`)
      } catch {
        setError('Network error — try again')
      } finally {
        setLoading(false)
      }
    },
    [email, password, name, handle, navigate],
  )

  const handleForgotPassword = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault()
      setLoading(true)
      setError(null)
      setSuccess(null)
      try {
        const { error: authError } = await supabase.auth.resetPasswordForEmail(email, {
          redirectTo: `${window.location.origin}/auth/callback`,
        })
        if (authError) {
          setError(authError.message)
          return
        }
        setSuccess('Check your email for the password reset link!')
      } catch {
        setError('Network error — try again')
      } finally {
        setLoading(false)
      }
    },
    [email],
  )

  const handleResetPassword = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault()
      setLoading(true)
      setError(null)
      try {
        const { error: authError } = await supabase.auth.updateUser({
          password: newPassword,
        })
        if (authError) {
          setError(authError.message)
          return
        }
        setSuccess('Password updated! You can now sign in.')
        setMode('login')
        setPassword('')
      } catch {
        setError('Network error — try again')
      } finally {
        setLoading(false)
      }
    },
    [newPassword],
  )

  const handleMagicLink = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault()
      setLoading(true)
      setError(null)
      setSuccess(null)
      try {
        const { error: authError } = await supabase.auth.signInWithOtp({
          email,
          options: {
            emailRedirectTo: `${window.location.origin}/auth/callback`,
          },
        })
        if (authError) {
          setError(authError.message)
          return
        }
        setSuccess('Check your email for the magic link!')
      } catch {
        setError('Network error — try again')
      } finally {
        setLoading(false)
      }
    },
    [email],
  )

  const modeLabels: Record<AuthMode, string> = {
    login: 'WELCOME BACK',
    signup: 'JOIN THE KINGDOM',
    forgot: 'RESET PASSWORD',
    reset: 'NEW PASSWORD',
    'magic-link': 'MAGIC LINK',
  }

  return (
    <>
      <div
        className="min-h-screen flex flex-col items-center justify-center p-6 relative overflow-hidden"
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
              'radial-gradient(ellipse 80% 50% at 50% 0%, rgba(234,179,8,0.06) 0%, transparent 60%)',
          }}
        />
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            background:
              'radial-gradient(ellipse 60% 40% at 20% 80%, rgba(168,85,247,0.05) 0%, transparent 60%)',
          }}
        />

        {/* Floating orbs */}
        <div
          className="absolute w-[250px] h-[250px] top-[5%] right-[-5%] rounded-full pointer-events-none"
          style={{
            background:
              'radial-gradient(circle, rgba(234,179,8,0.12) 0%, transparent 70%)',
            filter: 'blur(60px)',
            animation: 'auth-floatOrb1 14s ease-in-out infinite',
          }}
        />
        <div
          className="absolute w-[200px] h-[200px] bottom-[10%] left-[-3%] rounded-full pointer-events-none"
          style={{
            background:
              'radial-gradient(circle, rgba(168,85,247,0.08) 0%, transparent 70%)',
            filter: 'blur(60px)',
            animation: 'auth-floatOrb2 18s ease-in-out infinite',
          }}
        />

        {/* Top gold line */}
        <div
          className="absolute top-0 left-0 right-0 h-px"
          style={{
            background:
              'linear-gradient(90deg, transparent, rgba(234,179,8,0.3), transparent)',
          }}
        />

        <div className="w-full max-w-md space-y-6 relative z-10">
          {/* Crown + Logo */}
          <div
            className="flex flex-col items-center gap-4"
            style={{ animation: 'auth-slideUp 0.6s ease-out 0.1s both' }}
          >
            <div
              className="w-14 h-14 rounded-2xl flex items-center justify-center relative overflow-hidden"
              style={{
                background:
                  'linear-gradient(135deg, rgba(234,179,8,0.15), rgba(234,179,8,0.05))',
                border: '1px solid rgba(234,179,8,0.25)',
                boxShadow: '0 0 30px rgba(234,179,8,0.1)',
                animation: 'auth-crownFloat 4s ease-in-out infinite',
              }}
            >
              <img
                src="/logo-square.svg"
                alt=""
                className="w-10 h-10"
              />
            </div>
            <FYKLogoInline />
          </div>

          {/* Mode label */}
          <div
            className="text-center"
            style={{ animation: 'auth-slideUp 0.6s ease-out 0.2s both' }}
          >
            <p
              className="font-mono uppercase tracking-[0.3em] text-amber-400"
              style={{ fontSize: 'var(--fs-3xs)' }}
            >
              {modeLabels[mode]}
            </p>
          </div>

          {/* ── Glass auth card ── */}
          <div
            className="rounded-2xl p-6 sm:p-7 relative overflow-hidden"
            style={{
              ...GLASS_CARD_STYLE,
              animation: 'auth-slideUp 0.6s ease-out 0.3s both',
            }}
          >
            {/* Error / Success messages */}
            {error && (
              <div className="mb-4 rounded-lg p-3 text-sm text-red-400" role="alert"
                style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)' }}>
                {error}
              </div>
            )}
            {success && (
              <div className="mb-4 rounded-lg p-3 text-sm text-emerald-400"
                style={{ background: 'rgba(34,197,94,0.1)', border: '1px solid rgba(34,197,94,0.2)' }}>
                {success}
              </div>
            )}

            {/* ── Quick-login test accounts ── */}
            {mode === 'login' && (
              <div className="mb-4 space-y-2">
                <p className="font-mono text-[10px] uppercase tracking-wider text-white/30 text-center">
                  Quick test accounts
                </p>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { email: 'king1@fyk.app', label: 'King 1', color: '#EAAB08' },
                    { email: 'king2@fyk.app', label: 'King 2', color: '#a855f7' },
                    { email: 'king3@fyk.app', label: 'King 3', color: '#06b6d4' },
                  ].map((t) => (
                    <button
                      key={t.email}
                      type="button"
                      onClick={() => {
                        setEmail(t.email)
                        setPassword('TestPass123!')
                        setMode('login')
                      }}
                      className="rounded-lg px-2 py-2 text-center transition-all duration-200 hover:scale-105 active:scale-95"
                      style={{
                        background: 'rgba(255,255,255,0.04)',
                        border: `1px solid ${t.color}30`,
                      }}
                    >
                      <div className="w-6 h-6 rounded-full mx-auto mb-1 flex items-center justify-center text-[10px] font-bold"
                        style={{ background: `${t.color}20`, color: t.color }}>
                        {t.label.slice(-1)}
                      </div>
                      <span className="text-[10px] font-mono" style={{ color: t.color }}>
                        {t.label}
                      </span>
                    </button>
                  ))}
                </div>
                <div className="relative">
                  <div className="absolute inset-0 flex items-center">
                    <div className="w-full" style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }} />
                  </div>
                  <div className="relative flex justify-center">
                    <span className="px-3 text-[9px] font-mono text-white/20 uppercase tracking-wider"
                      style={{ background: 'rgba(15,15,25,1)' }}>
                      or sign in below
                    </span>
                  </div>
                </div>
              </div>
            )}

            {/* ── LOGIN FORM ── */}
            {mode === 'login' && (
              <form onSubmit={handleLogin} className="space-y-4">
                <div className="space-y-2">
                  <label className="text-xs font-medium text-white/60 uppercase tracking-wider font-mono">
                    Email
                  </label>
                  <div className="relative">
                    <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-white/30" />
                    <input
                      type="email"
                      placeholder="king@fyk.app"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="w-full h-12 pl-11 pr-4 rounded-xl text-white placeholder:text-white/25 transition-all duration-300 text-sm"
                      style={GLASS_INPUT_STYLE}
                      onFocus={onFocus}
                      onBlur={onBlur}
                      required
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-medium text-white/60 uppercase tracking-wider font-mono">
                      Password
                    </label>
                    <button
                      type="button"
                      onClick={() => setMode('forgot')}
                      className="text-[11px] text-amber-400/70 hover:text-amber-400 transition font-medium"
                    >
                      Forgot?
                    </button>
                  </div>
                  <div className="relative">
                    <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-white/30" />
                    <input
                      type={showPassword ? 'text' : 'password'}
                      placeholder="Enter your password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="w-full h-12 pl-11 pr-11 rounded-xl text-white placeholder:text-white/25 transition-all duration-300 text-sm"
                      style={GLASS_INPUT_STYLE}
                      onFocus={onFocus}
                      onBlur={onBlur}
                      required
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3.5 top-1/2 -translate-y-1/2"
                    >
                      {showPassword ? (
                        <EyeOff className="h-4 w-4 text-white/30 hover:text-white/50 transition" />
                      ) : (
                        <Eye className="h-4 w-4 text-white/30 hover:text-white/50 transition" />
                      )}
                    </button>
                  </div>
                </div>
                <button
                  type="submit"
                  className="w-full h-12 rounded-xl font-display tracking-widest text-sm flex items-center justify-center gap-2 transition-all duration-300 hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50 disabled:hover:scale-100"
                  style={GOLD_BUTTON_STYLE}
                  disabled={loading}
                >
                  {loading ? (
                    <span className="flex items-center gap-2">
                      <span className="w-4 h-4 border-2 border-black/30 border-t-black rounded-full animate-spin" />
                      Signing in...
                    </span>
                  ) : (
                    <>
                      SIGN IN
                      <ArrowRight className="w-4 h-4" />
                    </>
                  )}
                </button>
                <button
                  type="button"
                  onClick={() => setMode('magic-link')}
                  className="w-full text-center text-xs text-amber-400/60 hover:text-amber-400 transition font-medium flex items-center justify-center gap-1.5 py-1"
                >
                  <Sparkles className="w-3 h-3" /> Sign in with magic link
                </button>
              </form>
            )}

            {/* ── SIGNUP FORM ── */}
            {mode === 'signup' && (
              <form onSubmit={handleSignup} className="space-y-4">
                <div className="space-y-2">
                  <label className="text-xs font-medium text-white/60 uppercase tracking-wider font-mono">
                    Name
                  </label>
                  <div className="relative">
                    <User className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-white/30" />
                    <input
                      placeholder="Your name"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      className="w-full h-12 pl-11 pr-4 rounded-xl text-white placeholder:text-white/25 transition-all duration-300 text-sm"
                      style={GLASS_INPUT_STYLE}
                      onFocus={onFocus}
                      onBlur={onBlur}
                      required
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-medium text-white/60 uppercase tracking-wider font-mono">
                    Email
                  </label>
                  <div className="relative">
                    <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-white/30" />
                    <input
                      type="email"
                      placeholder="king@fyk.app"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="w-full h-12 pl-11 pr-4 rounded-xl text-white placeholder:text-white/25 transition-all duration-300 text-sm"
                      style={GLASS_INPUT_STYLE}
                      onFocus={onFocus}
                      onBlur={onBlur}
                      required
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-medium text-white/60 uppercase tracking-wider font-mono">
                    Handle (optional)
                  </label>
                  <div className="relative">
                    <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-white/30 text-sm">
                      @
                    </span>
                    <input
                      placeholder="yourhandle"
                      value={handle}
                      onChange={(e) =>
                        setHandle(e.target.value.replace(/[^a-zA-Z0-9_]/g, ''))
                      }
                      className="w-full h-12 pl-9 pr-4 rounded-xl text-white placeholder:text-white/25 transition-all duration-300 text-sm"
                      style={GLASS_INPUT_STYLE}
                      onFocus={onFocus}
                      onBlur={onBlur}
                      maxLength={20}
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-medium text-white/60 uppercase tracking-wider font-mono">
                    Password
                  </label>
                  <div className="relative">
                    <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-white/30" />
                    <input
                      type={showPassword ? 'text' : 'password'}
                      placeholder="Min 8 chars, upper + lower + number"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="w-full h-12 pl-11 pr-11 rounded-xl text-white placeholder:text-white/25 transition-all duration-300 text-sm"
                      style={GLASS_INPUT_STYLE}
                      onFocus={onFocus}
                      onBlur={onBlur}
                      required
                      minLength={8}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3.5 top-1/2 -translate-y-1/2"
                    >
                      {showPassword ? (
                        <EyeOff className="h-4 w-4 text-white/30 hover:text-white/50 transition" />
                      ) : (
                        <Eye className="h-4 w-4 text-white/30 hover:text-white/50 transition" />
                      )}
                    </button>
                  </div>
                  {password.length > 0 && (
                    <div className="space-y-1">
                      <div className="flex gap-1">
                        {[1, 2, 3, 4, 5, 6].map((i) => (
                          <div
                            key={i}
                            className="h-1 flex-1 rounded-full transition-colors duration-300"
                            style={{
                              backgroundColor:
                                i <= passwordStrength
                                  ? PASSWORD_STRENGTH_COLORS[passwordStrength]
                                  : 'rgba(255,255,255,0.08)',
                            }}
                          />
                        ))}
                      </div>
                      <p
                        className="text-[11px]"
                        style={{ color: PASSWORD_STRENGTH_COLORS[passwordStrength] }}
                      >
                        {PASSWORD_STRENGTH_LABELS[passwordStrength]}
                      </p>
                    </div>
                  )}
                </div>
                <button
                  type="submit"
                  className="w-full h-12 rounded-xl font-display tracking-widest text-sm flex items-center justify-center gap-2 transition-all duration-300 hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50 disabled:hover:scale-100"
                  style={GOLD_BUTTON_STYLE}
                  disabled={loading}
                >
                  {loading ? (
                    <span className="flex items-center gap-2">
                      <span className="w-4 h-4 border-2 border-black/30 border-t-black rounded-full animate-spin" />
                      Creating account...
                    </span>
                  ) : (
                    <>
                      CREATE ACCOUNT
                      <ArrowRight className="w-4 h-4" />
                    </>
                  )}
                </button>
              </form>
            )}

            {/* ── FORGOT PASSWORD ── */}
            {mode === 'forgot' && (
              <form onSubmit={handleForgotPassword} className="space-y-4">
                <div className="space-y-2">
                  <label className="text-xs font-medium text-white/60 uppercase tracking-wider font-mono">
                    Email address
                  </label>
                  <div className="relative">
                    <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-white/30" />
                    <input
                      type="email"
                      placeholder="king@fyk.app"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="w-full h-12 pl-11 pr-4 rounded-xl text-white placeholder:text-white/25 transition-all duration-300 text-sm"
                      style={GLASS_INPUT_STYLE}
                      onFocus={onFocus}
                      onBlur={onBlur}
                      required
                    />
                  </div>
                </div>
                <button
                  type="submit"
                  className="w-full h-12 rounded-xl font-display tracking-widest text-sm flex items-center justify-center gap-2 transition-all duration-300 hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50 disabled:hover:scale-100"
                  style={GOLD_BUTTON_STYLE}
                  disabled={loading}
                >
                  {loading ? (
                    <span className="flex items-center gap-2">
                      <span className="w-4 h-4 border-2 border-black/30 border-t-black rounded-full animate-spin" />
                      Sending...
                    </span>
                  ) : (
                    <>
                      SEND RESET LINK
                      <ArrowRight className="w-4 h-4" />
                    </>
                  )}
                </button>
                <button
                  type="button"
                  onClick={() => setMode('login')}
                  className="w-full text-center text-xs text-white/40 hover:text-white/70 flex items-center justify-center gap-1 transition"
                >
                  <ArrowLeft className="h-3 w-3" /> Back to sign in
                </button>
              </form>
            )}

            {/* ── RESET PASSWORD ── */}
            {mode === 'reset' && (
              <form onSubmit={handleResetPassword} className="space-y-4">
                <div className="space-y-2">
                  <label className="text-xs font-medium text-white/60 uppercase tracking-wider font-mono">
                    New Password
                  </label>
                  <div className="relative">
                    <KeyRound className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-white/30" />
                    <input
                      type={showPassword ? 'text' : 'password'}
                      placeholder="Min 8 chars"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      className="w-full h-12 pl-11 pr-4 rounded-xl text-white placeholder:text-white/25 transition-all duration-300 text-sm"
                      style={GLASS_INPUT_STYLE}
                      onFocus={onFocus}
                      onBlur={onBlur}
                      required
                      minLength={8}
                    />
                  </div>
                </div>
                <button
                  type="submit"
                  className="w-full h-12 rounded-xl font-display tracking-widest text-sm flex items-center justify-center gap-2 transition-all duration-300 hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50 disabled:hover:scale-100"
                  style={GOLD_BUTTON_STYLE}
                  disabled={loading}
                >
                  {loading ? (
                    <span className="flex items-center gap-2">
                      <span className="w-4 h-4 border-2 border-black/30 border-t-black rounded-full animate-spin" />
                      Resetting...
                    </span>
                  ) : (
                    <>
                      RESET PASSWORD
                      <ArrowRight className="w-4 h-4" />
                    </>
                  )}
                </button>
              </form>
            )}

            {/* ── MAGIC LINK ── */}
            {mode === 'magic-link' && (
              <form onSubmit={handleMagicLink} className="space-y-4">
                <div className="space-y-2">
                  <label className="text-xs font-medium text-white/60 uppercase tracking-wider font-mono">
                    Email address
                  </label>
                  <div className="relative">
                    <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-white/30" />
                    <input
                      type="email"
                      placeholder="king@fyk.app"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="w-full h-12 pl-11 pr-4 rounded-xl text-white placeholder:text-white/25 transition-all duration-300 text-sm"
                      style={GLASS_INPUT_STYLE}
                      onFocus={onFocus}
                      onBlur={onBlur}
                      required
                    />
                  </div>
                  <p className="text-[11px] text-white/30">
                    We&apos;ll send you a secure link &mdash; no password needed.
                  </p>
                </div>
                <button
                  type="submit"
                  className="w-full h-12 rounded-xl font-display tracking-widest text-sm flex items-center justify-center gap-2 transition-all duration-300 hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50 disabled:hover:scale-100"
                  style={GOLD_BUTTON_STYLE}
                  disabled={loading}
                >
                  {loading ? (
                    <span className="flex items-center gap-2">
                      <span className="w-4 h-4 border-2 border-black/30 border-t-black rounded-full animate-spin" />
                      Sending magic link...
                    </span>
                  ) : (
                    <>
                      SEND MAGIC LINK
                      <Sparkles className="w-4 h-4" />
                    </>
                  )}
                </button>
                <button
                  type="button"
                  onClick={() => setMode('login')}
                  className="w-full text-center text-xs text-white/40 hover:text-white/70 flex items-center justify-center gap-1 transition"
                >
                  <ArrowLeft className="h-3 w-3" /> Back to sign in
                </button>
              </form>
            )}

            {/* ── Divider + Google social (login only) ── */}
            {mode === 'login' && (
              <div className="mt-6 space-y-3">
                <div className="relative">
                  <div className="absolute inset-0 flex items-center">
                    <div
                      className="w-full"
                      style={{ borderTop: '1px solid rgba(255,255,255,0.08)' }}
                    />
                  </div>
                  <div className="relative flex justify-center text-[10px] uppercase">
                    <span
                      className="px-3 text-white/30 font-mono tracking-wider"
                      style={{ background: 'rgba(15,15,25,1)' }}
                    >
                      Or continue with
                    </span>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={async () => {
                    const { error: authError } = await supabase.auth.signInWithOAuth({
                      provider: 'google',
                      options: { redirectTo: `${window.location.origin}/auth/callback` },
                    })
                    if (authError) {
                      setError(authError.message)
                    }
                  }}
                  className="w-full h-12 flex items-center justify-center gap-2.5 rounded-xl text-sm transition-all duration-300 hover:scale-[1.02] active:scale-[0.98]"
                  style={{
                    background: 'rgba(255,255,255,0.05)',
                    border: '1px solid rgba(255,255,255,0.1)',
                    color: 'rgba(255,255,255,0.7)',
                  }}
                >
                  <svg className="w-4 h-4" viewBox="0 0 24 24">
                    <path
                      d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"
                      fill="#4285F4"
                    />
                    <path
                      d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                      fill="#34A853"
                    />
                    <path
                      d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                      fill="#FBBC05"
                    />
                    <path
                      d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                      fill="#EA4335"
                    />
                  </svg>
                  Continue with Google
                </button>
              </div>
            )}
          </div>

          {/* ── Mode switcher ── */}
          <div
            className="text-center"
            style={{ animation: 'auth-slideUp 0.6s ease-out 0.5s both' }}
          >
            {mode === 'login' && (
              <p className="text-xs text-white/40">
                Don&apos;t have an account?{' '}
                <button
                  type="button"
                  onClick={() => setMode('signup')}
                  className="text-amber-400 hover:text-amber-300 transition font-medium"
                >
                  Sign up
                </button>
              </p>
            )}
            {mode === 'signup' && (
              <p className="text-xs text-white/40">
                Already have an account?{' '}
                <button
                  type="button"
                  onClick={() => setMode('login')}
                  className="text-amber-400 hover:text-amber-300 transition font-medium"
                >
                  Sign in
                </button>
              </p>
            )}
          </div>

          {/* ── Trust strip ── */}
          <div
            className="flex items-center justify-center gap-5"
            style={{ animation: 'auth-slideUp 0.6s ease-out 0.6s both' }}
          >
            {[
              { icon: LockKeyhole, text: 'E2E ENCRYPTED' },
              { icon: Shield, text: 'GDPR' },
            ].map((t) => (
              <div key={t.text} className="flex items-center gap-1.5">
                <t.icon className="w-3 h-3 text-amber-400/25" />
                <span
                  className="text-white/25 font-mono uppercase tracking-wider"
                  style={{ fontSize: '0.55rem' }}
                >
                  {t.text}
                </span>
              </div>
            ))}
          </div>

          {/* ── Skip to browse ── */}
          <div
            className="flex justify-center"
            style={{ animation: 'auth-slideUp 0.6s ease-out 0.7s both' }}
          >
            <button
              onClick={() => navigate({ to: '/' })}
              className="text-[11px] text-white/20 hover:text-amber-400/60 transition font-medium"
            >
              Skip &mdash; browse without signing up &rarr;
            </button>
          </div>
        </div>
      </div>

      {/* ── Auth-specific keyframes (self-contained) ── */}
      <style>{`
        @keyframes auth-slideUp {
          from { opacity: 0; transform: translateY(20px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes auth-crownFloat {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-4px); }
        }
        @keyframes auth-floatOrb1 {
          0%, 100% { transform: translate(0, 0) scale(1); }
          33% { transform: translate(20px, -15px) scale(1.05); }
          66% { transform: translate(-10px, 10px) scale(0.95); }
        }
        @keyframes auth-floatOrb2 {
          0%, 100% { transform: translate(0, 0) scale(1); }
          33% { transform: translate(-15px, 20px) scale(1.08); }
          66% { transform: translate(10px, -10px) scale(0.92); }
        }
      `}</style>
    </>
  )
}
