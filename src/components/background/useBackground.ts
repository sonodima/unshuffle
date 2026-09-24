// Accent colors + intensity for the shader background. Screens set these
// (e.g. album colors on reveal); ShaderBackground lerps toward them (~1.2 s).
import { create } from 'zustand'

export const DEFAULT_ACCENT_A = '#7b5cff'
export const DEFAULT_ACCENT_B = '#ff3fd1'
/** Third light (cyan leaks). Derived from A/B when `setAccent` gets only two colors. */
const DEFAULT_ACCENT_C = '#2ee6ff'

interface BackgroundStore {
  accentA: string
  accentB: string
  /** Tertiary light, or null = derive it from accentA/accentB (default palette uses cyan). */
  accentC: string | null
  /** 0..1 overall brightness/activity of the background. */
  intensity: number
  /** Increments on every `pulse()`; ShaderBackground fires a ring when it changes. */
  pulseSeq: number
  /** Strength (0..1.5) of the last `pulse()`. */
  pulseStrength: number
  /** Hex colors (#rgb or #rrggbb). Invalid values fall back to the default accents. `c` omitted = derived from a/b. */
  setAccent(a: string, b: string, c?: string): void
  resetAccent(): void
  setIntensity(x: number): void
  /** One-shot light burst from the bottom (round start, correct reveal, podium…). */
  pulse(strength?: number): void
}

export const useBackground = create<BackgroundStore>()((set) => ({
  accentA: DEFAULT_ACCENT_A,
  accentB: DEFAULT_ACCENT_B,
  accentC: DEFAULT_ACCENT_C,
  intensity: 1,
  pulseSeq: 0,
  pulseStrength: 1,
  setAccent: (accentA, accentB, accentC) => set({ accentA, accentB, accentC: accentC ?? null }),
  resetAccent: () => set({ accentA: DEFAULT_ACCENT_A, accentB: DEFAULT_ACCENT_B, accentC: DEFAULT_ACCENT_C }),
  setIntensity: (x) => set({ intensity: Number.isFinite(x) ? Math.max(0, Math.min(1, x)) : 1 }),
  pulse: (strength = 1) =>
    set((s) => ({
      pulseSeq: s.pulseSeq + 1,
      pulseStrength: Number.isFinite(strength) ? Math.max(0, Math.min(1.5, strength)) : 1,
    })),
}))
