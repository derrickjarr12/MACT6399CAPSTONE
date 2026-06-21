"use client"

import { useMemo } from "react"
import * as THREE from "three"
import type { FeatureDataset } from "@/lib/feature-types"
import { COURSE } from "@/lib/course-config"
import { courseZ, elevationAt, halfWidthAt } from "@/lib/terrain-math"

// Builds the three-band terrain ribbon from the complete dataset.
// Time runs along +Z; the cross-ribbon coordinate (band) runs across X.
function buildGeometry(dataset: FeatureDataset): THREE.BufferGeometry {
  const { frames } = dataset

  // decimate to a manageable number of rows while keeping the full time span
  const step = Math.max(1, Math.ceil(frames.length / COURSE.maxRows))
  const rows: typeof frames = []
  for (let i = 0; i < frames.length; i += step) rows.push(frames[i])
  if (rows[rows.length - 1] !== frames[frames.length - 1]) rows.push(frames[frames.length - 1])

  const cols = COURSE.widthSegments + 1
  const count = rows.length * cols

  const positions = new Float32Array(count * 3)
  const uvs = new Float32Array(count * 2)
  const aElevation = new Float32Array(count)
  const aEnergy = new Float32Array(count)
  const aHigh = new Float32Array(count)
  const aCentroid = new Float32Array(count)
  const aOnset = new Float32Array(count)
  const aBand = new Float32Array(count)

  for (let r = 0; r < rows.length; r++) {
    const f = rows[r]
    const hw = halfWidthAt(f)
    const z = courseZ(f.time_s)
    for (let c = 0; c < cols; c++) {
      const band = (c / (cols - 1)) * 2 - 1
      const idx = r * cols + c

      positions[idx * 3 + 0] = band * hw
      positions[idx * 3 + 1] = 0
      positions[idx * 3 + 2] = z

      uvs[idx * 2 + 0] = c / (cols - 1)
      uvs[idx * 2 + 1] = r / (rows.length - 1)

      aElevation[idx] = elevationAt(f, band)
      aEnergy[idx] = f.energy
      aHigh[idx] = f.high
      aCentroid[idx] = f.centroid
      aOnset[idx] = f.onset
      aBand[idx] = band
    }
  }

  const indices: number[] = []
  for (let r = 0; r < rows.length - 1; r++) {
    for (let c = 0; c < cols - 1; c++) {
      const a = r * cols + c
      const b = a + 1
      const d = a + cols
      const e = d + 1
      indices.push(a, d, b, b, d, e)
    }
  }

  const geo = new THREE.BufferGeometry()
  geo.setAttribute("position", new THREE.BufferAttribute(positions, 3))
  geo.setAttribute("uv", new THREE.BufferAttribute(uvs, 2))
  geo.setAttribute("aElevation", new THREE.BufferAttribute(aElevation, 1))
  geo.setAttribute("aEnergy", new THREE.BufferAttribute(aEnergy, 1))
  geo.setAttribute("aHigh", new THREE.BufferAttribute(aHigh, 1))
  geo.setAttribute("aCentroid", new THREE.BufferAttribute(aCentroid, 1))
  geo.setAttribute("aOnset", new THREE.BufferAttribute(aOnset, 1))
  geo.setAttribute("aBand", new THREE.BufferAttribute(aBand, 1))
  geo.setIndex(indices)
  geo.computeBoundingSphere()
  return geo
}

export function CourseGeometry({
  dataset,
  material,
}: {
  dataset: FeatureDataset
  material: THREE.ShaderMaterial
}) {
  const geometry = useMemo(() => buildGeometry(dataset), [dataset])
  return <mesh geometry={geometry} material={material} frustumCulled={false} />
}
