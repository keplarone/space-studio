/** Brand marks used on sign-in and in the chrome. Inline SVG so they stay sharp and need no network. */

/** Roblox's tilted-square logo, traced from the official artwork. Uses currentColor. */
export function RobloxLogo({ size = 20, title }: { size?: number; title?: string }) {
  return (
    <svg viewBox="100 100 700 705" width={size} height={size} fill="currentColor" role={title ? "img" : undefined} aria-label={title} aria-hidden={title ? undefined : true} focusable="false">
      <path fillRule="evenodd" d="M248 112 L792 252 L653 795 L110 654 Z M412 386 L385 492 L491 518 L518 412 Z" />
    </svg>
  );
}

/** Google's four-colour "G". */
export function GoogleLogo({ size = 20, title }: { size?: number; title?: string }) {
  return (
    <svg viewBox="0 0 48 48" width={size} height={size} role={title ? "img" : undefined} aria-label={title} aria-hidden={title ? undefined : true} focusable="false">
      <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z" />
      <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z" />
      <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z" />
      <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z" />
    </svg>
  );
}

/** The Keplar mark (square, corner triangle, circle), from keplar.one's brand geometry. Uses currentColor. */
export function KeplarMark({ size = 20, title }: { size?: number; title?: string }) {
  return (
    <svg viewBox="0 0 398 398" width={size} height={size} fill="currentColor" role={title ? "img" : undefined} aria-label={title} aria-hidden={title ? undefined : true} focusable="false">
      <rect x="0" y="0" width="229" height="229" rx="70" />
      <path d="M204.95 11.95A7 7 0 0 1 209.9 0L362 0A16 16 0 0 1 378 16L378 168.1A7 7 0 0 1 366.05 173.05Z" />
      <circle cx="281" cy="281" r="117" />
    </svg>
  );
}
