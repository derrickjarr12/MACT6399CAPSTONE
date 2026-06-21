import { ASSET_PATHS, TRACK_SECONDS, type FeatureDataset, type FeatureFrame } from "./feature-types"

const clamp01 = (n: number) => (Number.isFinite(n) ? Math.min(1, Math.max(0, n)) : 0)

// Accepts either an array of frame objects or an object of parallel arrays,
// and normalizes everything into the canonical FeatureFrame[] shape.
function normalize(raw: unknown): FeatureFrame[] {
  let rows: Record<string, number>[] = []

  if (Array.isArray(raw)) {
    rows = raw as Record<string, number>[]
  } else if (raw && typeof raw === "object") {
    const obj = raw as Record<string, unknown>
    const cols = (obj.frames ?? obj.data ?? obj) as Record<string, number[]>
    const len = Array.isArray(cols.time_s) ? cols.time_s.length : 0
    for (let i = 0; i < len; i++) {
      rows.push({
        frame: cols.frame?.[i] ?? i,
        time_s: cols.time_s?.[i] ?? 0,
        height: cols.height?.[i] ?? 0,
        energy: cols.energy?.[i] ?? 0,
        bass: cols.bass?.[i] ?? 0,
        mid: cols.mid?.[i] ?? 0,
        high: cols.high?.[i] ?? 0,
        centroid: cols.centroid?.[i] ?? 0,
        onset: cols.onset?.[i] ?? 0,
      })
    }
  }

  return rows
    .map((r, i) => ({
      frame: Number.isFinite(r.frame) ? r.frame : i,
      time_s: Number.isFinite(r.time_s) ? r.time_s : 0,
      height: clamp01(r.height),
      energy: clamp01(r.energy),
      bass: clamp01(r.bass),
      mid: clamp01(r.mid),
      high: clamp01(r.high),
      centroid: clamp01(r.centroid),
      onset: clamp01(r.onset),
    }))
    .sort((a, b) => a.time_s - b.time_s)
}

// Deterministic synthetic dataset used until the real JSON is supplied.
// It is fully reproducible (no randomness at runtime) so the course is stable.
function syntheticFrames(): FeatureFrame[] {
  const fps = 30
  const total = TRACK_SECONDS * fps
  const frames: FeatureFrame[] = []
  // simple seeded hash for stable per-frame variation
  const h = (n: number) => {
    const x = Math.sin(n * 12.9898) * 43758.5453
    return x - Math.floor(x)
  }
  for (let i = 0; i < total; i++) {
    const t = i / fps
    const phase = t / TRACK_SECONDS // 0..1 over the track
    // a slow build-drop-build arc for energy
    const arc = 0.5 - 0.5 * Math.cos(phase * Math.PI * 2)
    const bass = clamp01(0.35 + 0.45 * Math.sin(t * 1.7) * arc + 0.12 * h(i))
    const mid = clamp01(0.3 + 0.4 * Math.abs(Math.sin(t * 3.1 + 1)) + 0.15 * h(i * 2))
    const high = clamp01(0.2 + 0.5 * Math.pow(Math.abs(Math.sin(t * 6.2)), 3) + 0.1 * h(i * 3))
    const energy = clamp01(0.25 + 0.6 * arc + 0.2 * (bass + high) * 0.5)
    const height = clamp01(0.3 + 0.5 * Math.sin(t * 0.9) * 0.5 + 0.5 * arc)
    const centroid = clamp01(0.3 + 0.6 * high + 0.1 * mid)
    // onset spikes roughly on a beat grid (~2 Hz) gated by energy
    const beat = Math.sin(t * Math.PI * 2 * 2)
    const onset = beat > 0.92 && h(i * 7) > 0.4 ? clamp01(0.6 + 0.4 * energy) : 0
    frames.push({ frame: i, time_s: t, height, energy, bass, mid, high, centroid, onset })
  }
  return frames
}

// Tries the supplied URLs in order (Blob URL first, then the local /public
// fallback), and finally falls back to the deterministic synthetic dataset.
export async function loadFeatures(blobUrl?: string | null): Promise<FeatureDataset> {
  const candidates = [blobUrl, ASSET_PATHS.features].filter(Boolean) as string[]

  for (const url of candidates) {
    try {
      const res = await fetch(url, { cache: "no-store" })
      if (!res.ok) continue
      const json = await res.json()
      const frames = normalize(json)
      if (frames.length > 1) {
        return {
          frames,
          duration: frames[frames.length - 1].time_s || TRACK_SECONDS,
          real: true,
        }
      }
    } catch {
      // try next candidate
    }
  }

  const frames = syntheticFrames()
  return { frames, duration: TRACK_SECONDS, real: false }
}
