// The exact feature schema supplied by the precomputed JSON dataset.
// Every visible behavior in the experience is driven by one of these fields.
export interface FeatureFrame {
  frame: number
  time_s: number
  height: number
  energy: number
  bass: number
  mid: number
  high: number
  centroid: number
  onset: number
}

export interface FeatureDataset {
  frames: FeatureFrame[]
  duration: number
  /** True when the real supplied JSON was loaded, false when using the synthetic fallback. */
  real: boolean
}

// Fixed asset paths. Drop your own files at these locations in /public.
export const ASSET_PATHS = {
  audio: "/audio/track.wav",
  features: "/data/features.json",
  spectrogram: "/textures/spectrogram.png",
} as const

export const TRACK_SECONDS = 30
