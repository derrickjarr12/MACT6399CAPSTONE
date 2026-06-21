"use client"

import { useMemo, useRef } from "react"
import { Canvas, useFrame } from "@react-three/fiber"
import * as THREE from "three"
import type { FeatureDataset } from "@/lib/feature-types"
import type { AudioController } from "@/lib/audio-controller"
import type { RideState } from "@/lib/ride-state"
import { COURSE } from "@/lib/course-config"
import { createTerrainMaterial } from "./terrain-material"
import { CourseGeometry } from "./course-geometry"
import { Rider } from "./rider"
import { ChaseCamera } from "./chase-camera"
import { FinalReveal } from "./final-reveal"

// Runs first each frame: advances the (fallback) clock, mirrors the audio time
// into shared state, and ramps the reveal as the track approaches its end.
function ClockDriver({
  dataset,
  controller,
  shared,
  onEnded,
}: {
  dataset: FeatureDataset
  controller: AudioController
  shared: RideState
  onEnded: () => void
}) {
  const ended = useRef(false)
  useFrame((_, delta) => {
    controller.tick(delta)
    const t = controller.time
    shared.time = t

    const revealing = t >= dataset.duration - COURSE.revealStartLead
    const targetReveal = revealing ? 1 : 0
    shared.reveal = THREE.MathUtils.damp(shared.reveal, targetReveal, 0.9, delta)

    // Re-arm the end trigger once the clock has been reset (e.g. Ride Again /
    // back to start), so the reveal fires again on subsequent rides.
    if (ended.current && t < dataset.duration - 0.5) ended.current = false

    if (!ended.current && t >= dataset.duration - 0.02) {
      ended.current = true
      onEnded()
    }
  })
  return null
}

export function Scene({
  dataset,
  controller,
  shared,
  spectrogramUrl,
  onEnded,
}: {
  dataset: FeatureDataset
  controller: AudioController
  shared: RideState
  spectrogramUrl: string
  onEnded: () => void
}) {
  const material = useMemo(() => createTerrainMaterial(), [])

  return (
    <Canvas
      gl={{ antialias: true, powerPreference: "high-performance" }}
      camera={{ fov: 62, near: 0.1, far: 2000, position: [0, 6, -10] }}
      onCreated={({ gl, scene }) => {
        gl.setClearColor(new THREE.Color("#121212"))
        scene.fog = new THREE.Fog("#121212", 60, 220)
      }}
    >
      <ClockDriver dataset={dataset} controller={controller} shared={shared} onEnded={onEnded} />
      <CourseGeometry dataset={dataset} material={material} />
      <Rider dataset={dataset} shared={shared} />
      <ChaseCamera dataset={dataset} shared={shared} />
      <FinalReveal material={material} shared={shared} spectrogramUrl={spectrogramUrl} />
    </Canvas>
  )
}
