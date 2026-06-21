// Central tuning constants for the course. Keeping these in one place makes the
// mapping from "dataset field -> visible behavior" explicit and adjustable.
export const COURSE = {
  // World units travelled per second of audio. Time runs along +Z.
  lengthPerSecond: 7,
  // Half-width of the ribbon before bass modulation.
  baseHalfWidth: 9,
  // How much bass widens the ribbon (mass / width).
  bassWidth: 7,
  // Cross-ribbon resolution (columns). Higher = smoother surface.
  widthSegments: 48,
  // Cap on length rows used for geometry (dataset is decimated to this).
  maxRows: 1100,

  // Elevation mapping.
  heightElevation: 7, // `height` -> broad elevation
  bassMass: 3.5, // `bass` -> terrain mass lift
  midRoughness: 2.6, // `mid` -> surface roughness amplitude
  onsetGate: 6.5, // `onset` -> edge walls / structural gates

  // Rider.
  riderForwardOffset: 4, // how far ahead of the rider the camera looks
  riderLift: 1.1, // hover height above the surface
  maxSteer: 0.78, // max lateral position as fraction of half-width
  steerSpeed: 1.8,
  // Speed control via audio playbackRate. A fixed ladder (rather than
  // add-then-clamp) guarantees 1.00x is always reachable.
  rateLadder: [0.5, 0.75, 1, 1.25, 1.5, 1.75, 2] as number[],
  defaultRate: 1,

  // Final reveal.
  revealStartLead: 0.4, // seconds before track end to begin the reveal
} as const
