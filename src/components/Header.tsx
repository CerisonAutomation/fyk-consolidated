import { Link } from '@tanstack/react-router'
import { Crown, Bell } from 'lucide-react'
import { UserDropdown } from '#/components/UserDropdown'

/**
 * Minimal glass-blur header bar for pages that need a top navigation
 * bar in addition to the bottom NavBar. Not the main nav -- use NavBar
 * for primary navigation. This component is for secondary context
 * actions (notifications, profile, crown/status).
 */
export default function Header() {
  return (
    <header className="sticky top-0 z-50 w-full border-b border-white/[0.06] bg-black/40 backdrop-blur-2xl">
      <nav className="mx-auto flex h-14 max-w-screen-xl items-center justify-between px-4 sm:px-6">
        {/* Logo / Brand */}
        <Link
          to="/"
          className="flex items-center gap-2 text-sm font-semibold tracking-tight text-white no-underline transition-opacity hover:opacity-80"
        >
          <span className="inline-flex size-6 items-center justify-center rounded-md bg-gradient-to-br from-yellow-400 to-amber-600 text-[10px] font-bold text-black">
            FK
          </span>
          <span className="hidden font-[family-name:var(--font-bebas-neue)] text-lg tracking-wider sm:inline">
            FYK
          </span>
        </Link>

        {/* Right-side actions */}
        <div className="flex items-center gap-2">
          <Link
            to="/notifications"
            className="relative flex size-9 items-center justify-center rounded-xl text-white/60 transition-colors hover:bg-white/[0.08] hover:text-white"
          >
            <Bell className="size-[18px]" />
          </Link>

          <Link
            to="/crown"
            className="flex size-9 items-center justify-center rounded-xl text-yellow-400/70 transition-colors hover:bg-yellow-400/10 hover:text-yellow-400"
          >
            <Crown className="size-[18px]" />
          </Link>

          <UserDropdown />
        </div>
      </nav>
    </header>
  )
}
