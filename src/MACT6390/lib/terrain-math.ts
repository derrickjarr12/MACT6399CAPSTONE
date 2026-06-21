import { COURSE } from "./course-config"
import type { FeatureFrame } from "./feature-types"

const smoothstep = (e0: number, e1: number, x: number) => {
  const t = Math.min(1, Math.max(0, (x - e0) / (e1 - e0)))
  return t * t * (3 - 2 * t)
}

// Ribbon half-width: bass controls broad terrain mass and width.
export function halfWidthAt(f: FeatureFrame): number {
  return COURSE.baseHalfWidth + f.bass * COURSE.bassWidth
}

// Deterministic surface ripple. Amplitude is driven by `mid` (roughness).
function roughness(band: number, frame: number, mid: number): number {
  return Math.sin(band * 9.0 + frame * 0.25) * Math.cos(frame * 0.13 + band * 4.0) * mid
}

// The single source of truth for elevation. `band` is the cross-ribbon
// coordinate in [-1, 1]. Both the course geometry and the rider use this so
// the rider always sits exactly on the surface.
export function elevationAt(f: FeatureFrame, band: number): number {
  const base = f.height * COURSE.heightElevation + f.bass * COURSE.bassMass
  const rough = roughness(band, f.frame, f.mid) * COURSE.midRoughness
  // onset -> structural gates / ramps that rise at the ribbon edges
  const gate = COURSE.onsetGate * f.onset * smoothstep(0.55, 1.0, Math.abs(band))
  // high -> sharper, raised edges
  const edge = f.high * 1.5 * Math.pow(Math.abs(band), 3)
  return base + rough + gate + edge
}

// Z position along the course for a given time.
export function courseZ(time_s: number): number {
  return time_s * COURSE.lengthPerSecond
}
