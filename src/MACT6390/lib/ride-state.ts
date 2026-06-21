import * as THREE from "three"

// Mutable per-frame state shared between the clock driver, rider, camera, and
// course. Created once and passed by reference so we avoid React re-renders in
// the animation loop.
export interface RideState {
  /** Current audio time, mirrored each frame for convenience. */
  time: number
  /** 0 = riding, 1 = fully revealed/flattened data field. */
  reveal: number
  /** Steering target from input, -1..1. */
  steerTarget: number
  /** Smoothed lateral position, -1..1. */
  lateral: number
  /** World-space rider position, updated by the rider each frame. */
  riderPos: THREE.Vector3
  /** Point the rider is heading toward (for camera aiming). */
  riderLook: THREE.Vector3
}

export function createRideState(): RideState {
  return {
    time: 0,
    reveal: 0,
    steerTarget: 0,
    lateral: 0,
    riderPos: new THREE.Vector3(0, 2, 0),
    riderLook: new THREE.Vector3(0, 1, 10),
  }
}
