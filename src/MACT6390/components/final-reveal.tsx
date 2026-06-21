"use client"

import { useEffect } from "react"
import { useFrame } from "@react-three/fiber"
import * as THREE from "three"
import type { RideState } from "@/lib/ride-state"

// Drives the end-of-track transition: flattens the course (uElevation -> 0) and
// blends the surface into a dense monochrome full-track data field built from
// the supplied spectrogram texture (uReveal -> 1).
export function FinalReveal({
  material,
  shared,
  spectrogramUrl,
}: {
  material: THREE.ShaderMaterial
  shared: RideState
  spectrogramUrl: string
}) {
  useEffect(() => {
    const loader = new THREE.TextureLoader()
    loader.setCrossOrigin("anonymous")
    loader.load(
      spectrogramUrl,
      (tex) => {
        tex.colorSpace = THREE.SRGBColorSpace
        tex.wrapS = THREE.ClampToEdgeWrapping
        tex.wrapT = THREE.ClampToEdgeWrapping
        tex.minFilter = THREE.LinearFilter
        material.uniforms.uSpectro.value = tex
        material.uniforms.uHasSpectro.value = 1
      },
      undefined,
      () => {
        // No spectrogram supplied yet: the reveal still flattens into a grid field.
        material.uniforms.uHasSpectro.value = 0
      },
    )
  }, [material, spectrogramUrl])

  useFrame(() => {
    material.uniforms.uReveal.value = shared.reveal
    material.uniforms.uElevation.value = 1 - shared.reveal
  })

  return null
}
