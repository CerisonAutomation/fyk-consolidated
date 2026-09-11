export function Crown({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 44 32" className={className} aria-hidden="true" fill="none">
      <path
        d="M3.6 27.2 1 7.4c-.2-1.6 1.7-2.6 3-1.6l9.2 7.4a1.4 1.4 0 0 0 2.1-.35L20.8 2.2a1.4 1.4 0 0 1 2.4 0l5.5 10.7a1.4 1.4 0 0 0 2.1.34L40 5.8c1.3-1 3.2 0 3 1.6l-2.6 19.8a1.4 1.4 0 0 1-1.4 1.2H5a1.4 1.4 0 0 1-1.4-1.2Z"
        fill="url(#crown-g)"
      />
      <circle cx="22" cy="19.5" r="2.1" fill="currentColor" opacity=".22" />
      <defs>
        <linearGradient id="crown-g" x1="0" y1="0" x2="40" y2="30" gradientUnits="userSpaceOnUse">
          <stop stopColor="var(--c-gold-2)" />
          <stop offset=".55" stopColor="var(--c-gold)" />
          <stop offset="1" stopColor="var(--c-gold-deep)" />
        </linearGradient>
      </defs>
    </svg>
  );
}
