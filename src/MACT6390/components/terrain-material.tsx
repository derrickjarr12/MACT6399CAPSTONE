import * as THREE from "three"

// Custom shader material for the course ribbon.
// - vertex: applies the per-vertex elevation, scaled by uElevation so the
//   course can be flattened during the final reveal.
// - fragment: draws a data grid whose glow is driven by `high`/`onset`,
//   brightness by `centroid`, and blends into a monochrome spectrogram field
//   on reveal.
const vertexShader = /* glsl */ `
  attribute float aElevation;
  attribute float aEnergy;
  attribute float aHigh;
  attribute float aCentroid;
  attribute float aOnset;
  attribute float aBand;

  uniform float uElevation;

  varying float vEnergy;
  varying float vHigh;
  varying float vCentroid;
  varying float vOnset;
  varying float vBand;
  varying vec2 vUv;

  void main() {
    vUv = uv;
    vEnergy = aEnergy;
    vHigh = aHigh;
    vCentroid = aCentroid;
    vOnset = aOnset;
    vBand = aBand;

    vec3 p = position;
    p.y += aElevation * uElevation;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
  }
`

const fragmentShader = /* glsl */ `
  precision highp float;

  uniform vec3 uBg;
  uniform vec3 uLine;
  uniform vec3 uGlow;
  uniform float uReveal;
  uniform float uHasSpectro;
  uniform sampler2D uSpectro;

  varying float vEnergy;
  varying float vHigh;
  varying float vCentroid;
  varying float vOnset;
  varying float vBand;
  varying vec2 vUv;

  void main() {
    // anti-aliased data grid: dense along the course, sparser across width
    vec2 g = vUv * vec2(64.0, 240.0);
    vec2 grid = abs(fract(g - 0.5) - 0.5) / fwidth(g);
    float line = 1.0 - min(min(grid.x, grid.y), 1.0);

    vec3 col = mix(uBg, uLine * 0.5, 0.2 + 0.35 * vEnergy);

    float glow = line * (0.5 + vHigh * 1.7 + vOnset * 1.3);
    vec3 lineCol = mix(uLine, uGlow, clamp(vHigh + vOnset, 0.0, 1.0));
    col = mix(col, lineCol, clamp(glow, 0.0, 1.0));

    // centroid -> overall brightness
    col *= (0.5 + vCentroid * 0.95);
    // sharpened, glowing edges driven by high band
    col += uGlow * pow(abs(vBand), 4.0) * vHigh * 0.7;

    if (uHasSpectro > 0.5) {
      vec3 s = texture2D(uSpectro, vUv).rgb;
      float lum = dot(s, vec3(0.299, 0.587, 0.114));
      vec3 mono = mix(uBg, uGlow, pow(lum, 0.8));
      col = mix(col, mono, uReveal);
    } else {
      vec3 field = mix(uBg, uGlow, line * (0.3 + vEnergy));
      col = mix(col, field, uReveal);
    }

    gl_FragColor = vec4(col, 1.0);
  }
`

export function createTerrainMaterial(): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    vertexShader,
    fragmentShader,
    side: THREE.DoubleSide,
    uniforms: {
      uElevation: { value: 1 },
      uReveal: { value: 0 },
      uHasSpectro: { value: 0 },
      uSpectro: { value: null },
      uBg: { value: new THREE.Color("#141414") },
      uLine: { value: new THREE.Color("#8fe0bd") },
      uGlow: { value: new THREE.Color("#cdf24e") },
    },
  })
}
