// Lightweight device / capability detection for adaptive quality.

const coarse =
  typeof window !== "undefined" &&
  typeof window.matchMedia === "function" &&
  window.matchMedia("(pointer: coarse)").matches;

const smallScreen =
  typeof window !== "undefined" &&
  Math.min(window.innerWidth, window.innerHeight) < 700;

export const isMobile = coarse || smallScreen;

interface QualityProfile {
  mobile: boolean;
  pixelRatio: number;
  snowCount: number;
  shadows: boolean;
  antialias: boolean;
}

// One quality profile that everything reads from, so the whole scene scales
// together between phones and desktops.
export const quality: QualityProfile = {
  mobile: isMobile,
  pixelRatio: Math.min(window.devicePixelRatio || 1, 2),
  snowCount: isMobile ? 1400 : 3200,
  shadows: !isMobile,
  antialias: !isMobile,
};
