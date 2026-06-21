import type { FeatureDataset, FeatureFrame } from "./feature-types"

const lerp = (a: number, b: number, t: number) => a + (b - a) * t

// Interpolates the dataset at an arbitrary time (the audio clock), so the rider,
// camera, and material respond continuously rather than stepping per frame.
export function sampleAt(dataset: FeatureDataset, time: number): FeatureFrame {
  const { frames } = dataset
  if (frames.length === 0) {
    return { frame: 0, time_s: time, height: 0, energy: 0, bass: 0, mid: 0, high: 0, centroid: 0, onset: 0 }
  }
  const t = Math.min(Math.max(time, frames[0].time_s), frames[frames.length - 1].time_s)

  // binary search for the bracketing frames
  let lo = 0
  let hi = frames.length - 1
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1
    if (frames[mid].time_s <= t) lo = mid
    else hi = mid
  }

  const a = frames[lo]
  const b = frames[hi]
  const span = b.time_s - a.time_s
  const f = span > 1e-6 ? (t - a.time_s) / span : 0

  return {
    frame: lerp(a.frame, b.frame, f),
    time_s: t,
    height: lerp(a.height, b.height, f),
    energy: lerp(a.energy, b.energy, f),
    bass: lerp(a.bass, b.bass, f),
    mid: lerp(a.mid, b.mid, f),
    high: lerp(a.high, b.high, f),
    centroid: lerp(a.centroid, b.centroid, f),
    // onset is impulsive: take the max in the bracket so gates don't get smoothed away
    onset: Math.max(a.onset, b.onset),
  }
}
