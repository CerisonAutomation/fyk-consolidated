import {
  HeadContent,
  Scripts,
  createRootRouteWithContext,
} from '@tanstack/react-router'
import { useEffect } from 'react'
import { TanStackRouterDevtoolsPanel } from '@tanstack/react-router-devtools'
import { TanStackDevtools } from '@tanstack/react-devtools'

import TanStackQueryDevtools from '../integrations/tanstack-query/devtools'
import { SupabaseSessionProvider, useSupabaseSession } from '../integrations/supabase/session-provider'
import { NavBar } from '../core/ui/organisms/NavBar'
import { useAuthStore } from '../domains/auth/store'
import { useAutoSavePreferences } from '../hooks/use-auto-save-preferences'

import StoreDevtools from '../lib/demo-store-devtools'

import appCss from '../styles.css?url'

import type { QueryClient } from '@tanstack/react-query'

interface MyRouterContext {
  queryClient: QueryClient
}

/** Routes that hide the NavBar (auth pages get full-screen treatment) */
const NAV_HIDDEN_ROUTES = ['/auth/sign-in', '/auth/sign-up', '/auth/callback'];

function isNavHiddenRoute(pathname: string): boolean {
  return NAV_HIDDEN_ROUTES.some(
    (route) => pathname === route || pathname.startsWith(route + '/'),
  );
}

/**
 * Layout wrapper: always shows NavBar except on auth pages.
 * No auth guard — the app works for everyone; protected actions
 * check auth at the point of use.
 */
function AppLayout({ children }: { children: React.ReactNode }) {
  const { session, loading, user } = useSupabaseSession();
  const setAuth = useAuthStore((s) => s.setAuth);

  useAutoSavePreferences();

  // Keep Zustand auth store in sync with Supabase session
  useEffect(() => {
    if (user) {
      setAuth({ userId: user.id, user });
    } else if (!loading && !session) {
      setAuth(null);
    }
  }, [user, session, loading, setAuth]);

  // Auth pages: no NavBar, full-screen content
  if (typeof window !== 'undefined' && isNavHiddenRoute(window.location.pathname)) {
    return <>{children}</>;
  }

  // All other pages: NavBar always visible
  return (
    <>
      <NavBar />
      <div className="pb-16 lg:pt-14 lg:pb-0 lg:pl-[240px] min-h-screen">
        {children}
      </div>
    </>
  );
}

const THEME_INIT_SCRIPT = `(function(){try{var stored=window.localStorage.getItem('theme');var mode=(stored==='light'||stored==='dark'||stored==='auto')?stored:'dark';var prefersDark=window.matchMedia('(prefers-color-scheme: dark)').matches;var resolved=mode==='auto'?(prefersDark?'dark':'light'):mode;var root=document.documentElement;root.classList.remove('light','dark');root.classList.add(resolved);if(mode==='auto'){root.removeAttribute('data-theme')}else{root.setAttribute('data-theme',mode)}root.style.colorScheme=resolved;}catch(e){}})();`

export const Route = createRootRouteWithContext<MyRouterContext>()({
  head: () => ({
    meta: [
      {
        charSet: 'utf-8',
      },
      {
        name: 'viewport',
        content:
          'width=device-width, initial-scale=1, maximum-scale=5, viewport-fit=cover',
      },
      {
        title: 'FIND YOUR KING — Premium Geosocial Discovery',
      },
      {
        name: 'description',
        content:
          'The premium dating platform for men who demand excellence. AI-powered matching, real-time chat, voice control, Right Now radar, and curated IRL events.',
      },
      {
        name: 'keywords',
        content:
          'dating,geosocial,find your king,FYK,right now,AI matching,premium dating,men dating men',
      },
      {
        name: 'theme-color',
        content: '#d4af37',
      },
      {
        name: 'mobile-web-app-capable',
        content: 'yes',
      },
      {
        name: 'apple-mobile-web-app-status-bar-style',
        content: 'black-translucent',
      },
      {
        name: 'apple-mobile-web-app-capable',
        content: 'yes',
      },
      {
        name: 'apple-mobile-web-app-title',
        content: 'FYKING',
      },
      {
        name: 'mobile-web-app-capable',
        content: 'yes',
      },
      {
        name: 'application-name',
        content: 'FYKING',
      },
      {
        property: 'og:title',
        content: 'FIND YOUR KING — Premium Geosocial Discovery',
      },
      {
        property: 'og:description',
        content:
          'The premium dating platform with Right Now radar, AI logistics, and Zero-Knowledge Vault. Find your king.',
      },
      {
        property: 'og:site_name',
        content: 'FYK',
      },
      {
        property: 'og:type',
        content: 'website',
      },
      {
        property: 'og:locale',
        content: 'en_US',
      },
      {
        name: 'twitter:card',
        content: 'summary_large_image',
      },
      {
        name: 'twitter:title',
        content: 'FIND YOUR KING — Premium Geosocial Discovery',
      },
      {
        name: 'twitter:description',
        content: 'The premium dating platform for men who demand excellence.',
      },
    ],
    links: [
      {
        rel: 'stylesheet',
        href: appCss,
      },
      {
        rel: 'preconnect',
        href: 'https://fonts.googleapis.com',
      },
      {
        rel: 'preconnect',
        href: 'https://fonts.gstatic.com',
        crossOrigin: 'anonymous',
      },
      {
        rel: 'stylesheet',
        href: 'https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@300;400;500;600;700&family=Bebas+Neue&family=JetBrains+Mono:wght@400;500;600;700&display=swap',
      },
      {
        rel: 'apple-touch-icon',
        href: '/logo-square.svg',
        sizes: 'any',
      },
      {
        rel: 'icon',
        type: 'image/svg+xml',
        href: '/logo-square.svg',
      },
      {
        rel: 'manifest',
        href: '/manifest.json',
      },
    ],
  }),
  shellComponent: RootDocument,
})

function RootDocument({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="en"
      className="dark"
      suppressHydrationWarning
      data-scroll-behavior="smooth"
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
        <HeadContent />
      </head>
      <body className="antialiased bg-background text-foreground min-h-screen font-[family-name:var(--font-sans)] safe-area-top">
        <SupabaseSessionProvider>
          <AppLayout>{children}</AppLayout>
          <TanStackDevtools
            config={{
              position: 'bottom-right',
            }}
            plugins={[
              {
                name: 'Tanstack Router',
                render: <TanStackRouterDevtoolsPanel />,
              },
              TanStackQueryDevtools,
              StoreDevtools,
            ]}
          />
        </SupabaseSessionProvider>
        <Scripts />
      </body>
    </html>
  )
}
