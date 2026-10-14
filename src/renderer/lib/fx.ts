/**
 * App-wide visual events. Anything can fire them; the star field and the aura listen.
 *
 * - prompt(): a prompt was sent. The aura moves to its next colour and the star field makes a short warp jump.
 * - warp(strength, seconds): a warp jump of any size (0..1.5). Navigation uses small ones, arrival a long one.
 * - arrive(): the end of onboarding: a long warp that decelerates into the home screen.
 *
 * Reduced motion: listeners skip the movement (the aura still changes colour, instantly).
 */
export type WarpDetail = { strength: number; seconds: number };

const WARP = "space:warp";
const AURA = "space:aura";

export const fx = {
  prompt() {
    window.dispatchEvent(new CustomEvent(AURA));
    fx.warp(1, 1.7);
  },
  warp(strength: number, seconds: number) {
    window.dispatchEvent(new CustomEvent<WarpDetail>(WARP, { detail: { strength, seconds } }));
  },
  arrive() {
    window.dispatchEvent(new CustomEvent(AURA));
    fx.warp(1.5, 3.2);
  },
  onWarp(fn: (d: WarpDetail) => void) {
    const h = (e: Event) => fn((e as CustomEvent<WarpDetail>).detail);
    window.addEventListener(WARP, h);
    return () => window.removeEventListener(WARP, h);
  },
  onAura(fn: () => void) {
    window.addEventListener(AURA, fn);
    return () => window.removeEventListener(AURA, fn);
  },
};
