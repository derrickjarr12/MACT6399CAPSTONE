"use client"

import { useRef } from "react"
import { useFrame, useThree } from "@react-three/fiber"
import * as THREE from "three"
import type { FeatureDataset } from "@/lib/feature-types"
import type { RideState } from "@/lib/ride-state"
import { courseZ } from "@/lib/terrain-math"

const smooth = (x: number) => x * x * (3 - 2 * x)

// Third-person chase camera during the ride; pulls upward and back to frame the
// whole flattened course during the final reveal.
export function ChaseCamera({
  dataset,
  shared,
}: {
  dataset: FeatureDataset
  shared: RideState
}) {
  const { camera } = useThree()
  const tmpPos = useRef(new THREE.Vector3())
  const tmpLook = useRef(new THREE.Vector3())
  const forward = useRef(new THREE.Vector3(0, 0, 1))

  useFrame((_, delta) => {
    const r = shared.reveal
    const centerZ = courseZ(dataset.duration * 0.5)
    const endZ = courseZ(dataset.duration)

    // --- ride framing: behind and above the rider, looking ahead ---
    forward.current.subVectors(shared.riderLook, shared.riderPos)
    forward.current.y = 0
    if (forward.current.lengthSq() < 1e-4) forward.current.set(0, 0, 1)
    forward.current.normalize()

    // Anchor the camera laterally at the course center (x = 0) instead of
    // tracking the rider's X. This makes the green dot visibly slide left/right
    // across the screen when steering, rather than the terrain appearing to move.
    const rideX = 0
    const rideY = shared.riderPos.y + 5.5
    const rideZ = shared.riderPos.z - forward.current.z * 11

    // --- reveal framing: high overview of the entire course ---
    const overX = 0
    const overY = 70 + endZ * 0.18
    const overZ = centerZ - endZ * 0.28

    const k = smooth(r)
    tmpPos.current.set(
      THREE.MathUtils.lerp(rideX, overX, k),
      THREE.MathUtils.lerp(rideY, overY, k),
      THREE.MathUtils.lerp(rideZ, overZ, k),
    )

    // ease the camera toward the target (snappier during the reveal pull-up)
    const lambda = THREE.MathUtils.lerp(3.5, 1.6, k)
    camera.position.x = THREE.MathUtils.damp(camera.position.x, tmpPos.current.x, lambda, delta)
    camera.position.y = THREE.MathUtils.damp(camera.position.y, tmpPos.current.y, lambda, delta)
    camera.position.z = THREE.MathUtils.damp(camera.position.z, tmpPos.current.z, lambda, delta)

    // Look at the course center line (x = 0) so steering moves the dot on
    // screen rather than panning the camera to follow it.
    tmpLook.current.set(
      0,
      THREE.MathUtils.lerp(shared.riderLook.y, 0, k),
      THREE.MathUtils.lerp(shared.riderLook.z, centerZ, k),
    )
    camera.lookAt(tmpLook.current)
  })

  return null
}
