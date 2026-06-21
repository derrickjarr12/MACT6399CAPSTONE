"use client"

import { useRef } from "react"
import { useFrame } from "@react-three/fiber"
import * as THREE from "three"
import type { FeatureDataset } from "@/lib/feature-types"
import type { RideState } from "@/lib/ride-state"
import { COURSE } from "@/lib/course-config"
import { sampleAt } from "@/lib/sample-features"
import { courseZ, elevationAt, halfWidthAt } from "@/lib/terrain-math"

// Third-person rider. Position, elevation and banking are entirely derived from
// the dataset and the steering input; nothing is decorative or random.
export function Rider({
  dataset,
  shared,
}: {
  dataset: FeatureDataset
  shared: RideState
}) {
  const group = useRef<THREE.Group>(null)
  const craft = useRef<THREE.Mesh>(null)
  const glowMat = useRef<THREE.MeshBasicMaterial>(null)

  useFrame((_, delta) => {
    if (!group.current) return
    const t = shared.time
    const f = sampleAt(dataset, t)

    // smooth steering toward target, clamped to the rideable band
    const target = THREE.MathUtils.clamp(shared.steerTarget, -1, 1) * COURSE.maxSteer
    shared.lateral = THREE.MathUtils.damp(shared.lateral, target, COURSE.steerSpeed, delta)

    const hw = halfWidthAt(f)
    const elevScale = 1 - shared.reveal
    const x = shared.lateral * hw
    const z = courseZ(t)
    const y = elevationAt(f, shared.lateral) * elevScale + COURSE.riderLift

    shared.riderPos.set(x, y, z)

    // look slightly ahead along the course for orientation + camera aim
    const ahead = sampleAt(dataset, t + 0.18)
    const zAhead = courseZ(ahead.time_s)
    const yAhead = elevationAt(ahead, shared.lateral) * elevScale + COURSE.riderLift
    shared.riderLook.set(x, yAhead, zAhead + COURSE.riderForwardOffset)

    group.current.position.copy(shared.riderPos)
    group.current.lookAt(shared.riderLook)
    // bank into the turn; pitch with elevation change.
    // base rotation.x = PI/2 points the cone's apex along the group's +Z (forward).
    if (craft.current) {
      craft.current.rotation.z = -shared.lateral * 0.5
      const climb = THREE.MathUtils.clamp((yAhead - y) * 0.15, -0.5, 0.5)
      craft.current.rotation.x = Math.PI / 2 + climb
    }
    // pulse brightness with energy/onset; fade out as the field is revealed
    if (glowMat.current) {
      const pulse = 0.6 + f.energy * 0.5 + f.onset * 0.6
      glowMat.current.opacity = (1 - shared.reveal) * Math.min(1, pulse)
    }
  })

  return (
    <group ref={group}>
      <mesh ref={craft}>
        {/* slim, forward-pointing craft */}
        <coneGeometry args={[0.55, 1.8, 4]} />
        <meshBasicMaterial ref={glowMat} color="#cdf24e" transparent toneMapped={false} />
      </mesh>
      {/* under-glow marker so the rider reads against the dark terrain */}
      <pointLight color="#cdf24e" intensity={6} distance={14} />
    </group>
  )
}
