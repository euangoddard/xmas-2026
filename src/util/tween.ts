// Tiny self-contained tween/easing helpers — no external deps.

export const easeInOutCubic = (t: number): number =>
  t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2;

export const lerp = (a: number, b: number, t: number): number =>
  a + (b - a) * t;

interface TweenOptions {
  duration?: number;
  ease?: (t: number) => number;
  onUpdate?: (eased: number, raw: number) => void;
  onComplete?: () => void;
}

/**
 * Drives a value from 0→1 over `duration` ms, calling `onUpdate(eased)` each
 * frame and `onComplete()` at the end. Returns a cancel function.
 */
export function tween({
  duration = 1000,
  ease = easeInOutCubic,
  onUpdate,
  onComplete,
}: TweenOptions): () => void {
  const start = performance.now();
  let raf = 0;
  let cancelled = false;

  const step = (now: number): void => {
    if (cancelled) {
      return;
    }
    const t = Math.min(1, (now - start) / duration);
    onUpdate?.(ease(t), t);
    if (t < 1) {
      raf = requestAnimationFrame(step);
    } else {
      onComplete?.();
    }
  };

  raf = requestAnimationFrame(step);

  return () => {
    cancelled = true;
    cancelAnimationFrame(raf);
  };
}
