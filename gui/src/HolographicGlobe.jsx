import { useEffect, useRef } from "react";
import * as THREE from "three";

function clamp01(value) {
  return Math.max(0, Math.min(1, value));
}

function lerp(start, end, amount) {
  return start + (end - start) * amount;
}

function HolographicGlobe({ drive = 0.5, bass = 0.5, treble = 0.5, distortion = 0.5, chaosSensitivity = 0.67, reformSpeed = 1.45, flareIntensity = 0.72, colorSpeed = 0.28, insideView = false }) {
  const mountRef = useRef(null);
  const driveRef = useRef(clamp01(drive));
  const bassRef = useRef(clamp01(bass));
  const trebleRef = useRef(clamp01(treble));
  const distortionRef = useRef(clamp01(distortion));
  const chaosRef = useRef(false);
  const morphRef = useRef(0);
  const energyRef = useRef(0.3);
  const peakPulseRef = useRef(0);
  const prevEnergyRef = useRef(0.3);
  const chaosSensitivityRef = useRef(chaosSensitivity);
  const reformSpeedRef = useRef(reformSpeed);
  const flareIntensityRef = useRef(flareIntensity);
  const colorSpeedRef = useRef(colorSpeed);
  const insideViewRef = useRef(insideView);
  const insideAmountRef = useRef(0);

  useEffect(() => {
    driveRef.current = clamp01(drive);
  }, [drive]);

  useEffect(() => {
    bassRef.current = clamp01(bass);
  }, [bass]);

  useEffect(() => {
    trebleRef.current = clamp01(treble);
  }, [treble]);

  useEffect(() => {
    distortionRef.current = clamp01(distortion);
  }, [distortion]);

  useEffect(() => {
    chaosSensitivityRef.current = chaosSensitivity;
  }, [chaosSensitivity]);

  useEffect(() => {
    reformSpeedRef.current = reformSpeed;
  }, [reformSpeed]);

  useEffect(() => {
    flareIntensityRef.current = flareIntensity;
  }, [flareIntensity]);

  useEffect(() => {
    colorSpeedRef.current = colorSpeed;
  }, [colorSpeed]);

  useEffect(() => {
    insideViewRef.current = insideView;
  }, [insideView]);

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) {
      return undefined;
    }

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(42, 1, 0.1, 100);
    camera.position.set(0, 0, 3.8);

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setClearColor(0x000000, 0);
    mount.appendChild(renderer.domElement);

    const group = new THREE.Group();
    scene.add(group);

    const geometry = new THREE.SphereGeometry(1.18, 112, 112);

    const uniforms = {
      uTime: { value: 0 },
      uDrive: { value: driveRef.current },
      uBass: { value: bassRef.current },
      uTreble: { value: trebleRef.current },
      uDistortion: { value: distortionRef.current },
      uMorph: { value: 0 },
      uEnergy: { value: 0.3 },
      uPulse: { value: 0 },
      uPaletteShift: { value: 0 },
      uColorSpeed: { value: 0.28 },
      uInsideAmount: { value: 0 },
      uGlow: { value: new THREE.Color("#6ce8ff") },
      uGlow2: { value: new THREE.Color("#8f7bff") },
      uGlow3: { value: new THREE.Color("#ff7fd3") }
    };

    const material = new THREE.ShaderMaterial({
      uniforms,
      transparent: true,
      side: THREE.DoubleSide,
      vertexShader: `
        varying vec3 vNormal;
        varying vec3 vWorldPosition;
        varying vec2 vUv;
        uniform float uTime;
        uniform float uDrive;
        uniform float uBass;
        uniform float uTreble;
        uniform float uDistortion;
        uniform float uMorph;
        uniform float uEnergy;

        float hash(vec3 p) {
          p = fract(p * 0.3183099 + vec3(0.1, 0.2, 0.3));
          p *= 17.0;
          return fract(p.x * p.y * p.z * (p.x + p.y + p.z));
        }

        float noise(vec3 x) {
          vec3 i = floor(x);
          vec3 f = fract(x);
          f = f * f * (3.0 - 2.0 * f);

          float n000 = hash(i + vec3(0.0, 0.0, 0.0));
          float n100 = hash(i + vec3(1.0, 0.0, 0.0));
          float n010 = hash(i + vec3(0.0, 1.0, 0.0));
          float n110 = hash(i + vec3(1.0, 1.0, 0.0));
          float n001 = hash(i + vec3(0.0, 0.0, 1.0));
          float n101 = hash(i + vec3(1.0, 0.0, 1.0));
          float n011 = hash(i + vec3(0.0, 1.0, 1.0));
          float n111 = hash(i + vec3(1.0, 1.0, 1.0));

          float nx00 = mix(n000, n100, f.x);
          float nx10 = mix(n010, n110, f.x);
          float nx01 = mix(n001, n101, f.x);
          float nx11 = mix(n011, n111, f.x);
          float nxy0 = mix(nx00, nx10, f.y);
          float nxy1 = mix(nx01, nx11, f.y);
          return mix(nxy0, nxy1, f.z);
        }

        void main() {
          vUv = uv;
          vNormal = normalize(normalMatrix * normal);

          float t = uTime * 0.55;
          float warpA = noise(normal * 2.6 + vec3(t, -t * 0.7, t * 0.4));
          float warpB = noise(position * 1.8 + vec3(-t * 0.4, t * 0.8, -t));
          float rippleWave = sin((position.y * 9.0 + position.x * 7.5) + uTime * (2.2 + uDistortion * 4.5));
          float rippleRing = sin(length(position.xy) * 22.0 - uTime * (1.6 + uDistortion * 3.8));
          float ripple = (rippleWave * 0.02 + rippleRing * 0.016) * (0.45 + uDistortion * 1.35);
          float distortion = mix(0.05, 0.16, uDrive) * (warpA * 0.7 + warpB * 0.5);
          distortion = distortion * (0.85 + uDistortion * 0.9) + ripple;

          float morphNoiseA = noise(position * (4.4 + uTreble * 4.2) + vec3(t * 1.3, -t * 1.8, t * 1.1));
          float morphNoiseB = noise(normal * (6.2 + uBass * 4.8) + vec3(-t * 1.4, t * 1.1, -t * 1.7));
          float morphBand = sin((position.x + position.y + position.z) * 14.0 + uTime * (3.2 + uDistortion * 3.4));
          float morphChaos = (morphNoiseA - 0.5) * 0.7 + (morphNoiseB - 0.5) * 0.9 + morphBand * 0.25;
          float morphAmount = (0.12 + uEnergy * 0.23) * uMorph;
          distortion += morphChaos * morphAmount;

          vec3 displaced = position + normal * distortion;
          vec4 worldPosition = modelMatrix * vec4(displaced, 1.0);
          vWorldPosition = worldPosition.xyz;

          gl_Position = projectionMatrix * viewMatrix * worldPosition;
        }
      `,
      fragmentShader: `
        varying vec3 vNormal;
        varying vec3 vWorldPosition;
        varying vec2 vUv;
        uniform float uTime;
        uniform float uDrive;
        uniform float uBass;
        uniform float uTreble;
        uniform float uDistortion;
        uniform float uMorph;
        uniform float uEnergy;
        uniform float uPulse;
        uniform float uPaletteShift;
        uniform float uColorSpeed;
        uniform float uInsideAmount;
        uniform vec3 uGlow;
        uniform vec3 uGlow2;
        uniform vec3 uGlow3;

        void main() {
          vec3 normal = normalize(vNormal);
          vec3 viewDir = normalize(cameraPosition - vWorldPosition);
          float fresnel = pow(1.0 - max(dot(normal, viewDir), 0.0), 3.2);

          // Key light direction — upper-left, slightly behind camera plane
          vec3 keyLight = normalize(vec3(2.2, 1.8, 3.0));
          float diffuse = max(dot(normal, keyLight), 0.0);
          // Hemisphere: sky (cyan tint) vs ground (deep indigo)
          float hemi = dot(normal, vec3(0.0, 1.0, 0.0)) * 0.5 + 0.5;
          vec3 skyColor = vec3(0.12, 0.32, 0.55);
          vec3 groundColor = vec3(0.02, 0.02, 0.06);
          vec3 hemiColor = mix(groundColor, skyColor, hemi);

          // Moving specular hot spot
          vec3 specLight = normalize(vec3(
            sin(uTime * 0.22) * 2.5,
            cos(uTime * 0.17) * 1.8 + 1.0,
            3.5
          ));
          vec3 halfVec = normalize(specLight + viewDir);
          float spec = pow(max(dot(normal, halfVec), 0.0), 28.0 + uTreble * 24.0);
          spec *= 0.55 + uEnergy * 0.45;

          // Rim back-light (opposite side of key)
          vec3 rimLight = normalize(vec3(-1.8, -0.6, -2.2));
          float rim = pow(1.0 - max(dot(normal, viewDir), 0.0), 4.0);
          rim *= max(dot(normal, rimLight) * -1.0, 0.0) * 0.9;

          float cs = uColorSpeed;
          float wave1 = sin(vUv.y * 18.0 + uTime * cs * 1.4 + normal.x * 3.0);
          float wave2 = cos(vUv.x * 20.0 - uTime * cs * 1.1 + normal.y * 4.0);
          float swirl = sin((vUv.x + vUv.y) * 16.0 - uTime * cs * 1.8);
          float band = wave1 * 0.35 + wave2 * 0.35 + swirl * 0.3;
          band += sin(vUv.y * 42.0 - uTime * cs * (3.2 + uDistortion * 5.0)) * (0.08 + uDistortion * 0.2);

          float latScan = abs(sin(vUv.y * 95.0 + uTime * cs * (1.5 + uTreble * 2.2)));
          float lonScan = abs(sin(vUv.x * 130.0 - uTime * cs * (1.2 + uBass * 1.8)));
          float scanLines = pow(latScan, 18.0) * 0.45 + pow(lonScan, 22.0) * 0.32;
          scanLines *= (0.35 + uEnergy * 0.6) * (1.0 - uMorph * 0.35);

          float palettePhase = uTime * cs * (1.0 + uPaletteShift * 0.8) + (vUv.x + vUv.y) * 2.8;
          vec3 cycleA = vec3(0.38, 0.9, 1.0);
          vec3 cycleB = vec3(1.0, 0.45, 0.82);
          vec3 cycleC = vec3(1.0, 0.74, 0.32);
          vec3 triad = mix(cycleA, cycleB, 0.5 + 0.5 * sin(palettePhase));
          triad = mix(triad, cycleC, 0.5 + 0.5 * sin(palettePhase + 2.094));
          triad = mix(triad, cycleA, 0.5 + 0.5 * sin(palettePhase + 4.188));

          // Interior cinematic layer: vortex/tunnel glow when zoomed in.
          vec2 p = vUv - vec2(0.5);
          float r = length(p);
          float ang = atan(p.y, p.x);
          float vortex = sin(ang * 16.0 - uTime * cs * (4.2 + uEnergy * 5.4) + r * 44.0);
          float tunnel = exp(-r * (8.0 - uEnergy * 2.0));
          float tunnelPulse = 0.55 + 0.45 * sin(uTime * cs * (5.8 + uDistortion * 7.6) - r * 34.0);
          vec3 interiorTint = mix(vec3(0.35, 0.92, 1.0), vec3(1.0, 0.48, 0.86), 0.5 + 0.5 * sin(uTime * cs * 2.0 + ang * 2.0));
          float interiorAmt = uInsideAmount * (0.5 + uEnergy * 0.65);

          // Base color built on hemisphere + diffuse so dark side is genuinely dark
          vec3 deepCore = vec3(0.01, 0.018, 0.04);
          vec3 color = deepCore + hemiColor * 0.22;
          color += uGlow * (0.15 + 0.22 * band) * (0.4 + diffuse * 0.6);
          color += uGlow2 * (0.1 + 0.18 * sin(uTime + vUv.x * 10.0));
          color += uGlow3 * (0.08 + 0.13 * cos(uTime * 0.9 + vUv.y * 12.0));
          color = mix(color, color + triad * 0.28, 0.2 + uEnergy * 0.42);
          color += triad * scanLines;
          color += interiorTint * tunnel * tunnelPulse * (0.25 + 0.75 * abs(vortex)) * interiorAmt;

          // Apply directional shading — this is what makes it read as 3D
          color *= 0.18 + diffuse * 0.82;
          // Fresnel brightens edges
          color += uGlow * fresnel * (0.55 + uEnergy * 0.3);
          // Specular hot spot
          color += vec3(0.85, 0.97, 1.0) * spec;
          // Rim back-light adds depth separation
          color += vec3(0.55, 0.22, 0.88) * rim * (0.3 + uBass * 0.22);

          float innerMist = smoothstep(0.55, -0.1, distance(vUv, vec2(0.5)));
          color += vec3(0.05, 0.08, 0.14) * innerMist * (0.35 + uDrive * 0.25);

          float flare = smoothstep(0.4, 1.0, fresnel) * uPulse;
          color += vec3(0.8, 0.94, 1.0) * flare * (0.4 + uEnergy * 0.6);

          // Subtle chromatic aberration feel in interior mode.
          float fringe = fresnel * uInsideAmount * (0.08 + uEnergy * 0.12);
          color.r += fringe * (0.55 + 0.45 * sin(uTime * 2.3));
          color.b += fringe * (0.45 + 0.55 * cos(uTime * 2.0));

          float alpha = 0.72 + fresnel * 0.26 + uPulse * 0.06;
          gl_FragColor = vec4(color, alpha);
        }
      `
    });

    const globe = new THREE.Mesh(geometry, material);
    group.add(globe);

    const coreUniforms = {
      uTime: { value: 0 },
      uBass: { value: bassRef.current },
      uTreble: { value: trebleRef.current },
      uDistortion: { value: distortionRef.current },
      uMorph: { value: 0 },
      uEnergy: { value: 0.3 },
      uPulse: { value: 0 },
      uInsideAmount: { value: 0 }
    };

    const core = new THREE.Mesh(
      new THREE.SphereGeometry(0.76, 96, 96),
      new THREE.ShaderMaterial({
        uniforms: coreUniforms,
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        vertexShader: `
          varying vec2 vUv;
          varying vec3 vWorldPosition;
          varying vec3 vNormal;
          uniform float uTime;
          uniform float uBass;
          uniform float uTreble;
          uniform float uDistortion;
          uniform float uMorph;
          uniform float uEnergy;

          float hash(vec3 p) {
            p = fract(p * 0.3183099 + vec3(0.19, 0.43, 0.71));
            p *= 17.0;
            return fract(p.x * p.y * p.z * (p.x + p.y + p.z));
          }

          float noise(vec3 x) {
            vec3 i = floor(x);
            vec3 f = fract(x);
            f = f * f * (3.0 - 2.0 * f);

            float n000 = hash(i + vec3(0.0, 0.0, 0.0));
            float n100 = hash(i + vec3(1.0, 0.0, 0.0));
            float n010 = hash(i + vec3(0.0, 1.0, 0.0));
            float n110 = hash(i + vec3(1.0, 1.0, 0.0));
            float n001 = hash(i + vec3(0.0, 0.0, 1.0));
            float n101 = hash(i + vec3(1.0, 0.0, 1.0));
            float n011 = hash(i + vec3(0.0, 1.0, 1.0));
            float n111 = hash(i + vec3(1.0, 1.0, 1.0));

            float nx00 = mix(n000, n100, f.x);
            float nx10 = mix(n010, n110, f.x);
            float nx01 = mix(n001, n101, f.x);
            float nx11 = mix(n011, n111, f.x);
            float nxy0 = mix(nx00, nx10, f.y);
            float nxy1 = mix(nx01, nx11, f.y);
            return mix(nxy0, nxy1, f.z);
          }

          void main() {
            vUv = uv;
            vNormal = normalize(normalMatrix * normal);

            float t = uTime;
            float bassWave = sin(position.y * 6.0 + t * (1.2 + uBass * 2.4));
            float bassNoise = noise(position * 2.0 + vec3(t * 0.45, -t * 0.2, t * 0.3));
            float trebleNoise = noise(position * 11.5 + vec3(-t * 2.7, t * 2.2, -t * 1.8));

            float lowBand = (bassWave * 0.62 + bassNoise * 0.92) * (0.013 + uBass * 0.082);
            float highBand = (trebleNoise - 0.5) * (0.008 + uTreble * 0.078);
            float mixed = mix(lowBand, highBand, 0.25 + uDistortion * 0.6);
            mixed += (bassNoise - 0.5) * uMorph * (0.04 + uEnergy * 0.06);
            mixed += (trebleNoise - 0.5) * uMorph * (0.03 + uDistortion * 0.05);

            vec3 freeDir = vec3(
              noise(position * 2.8 + vec3(t * 0.58, t * 0.12, 0.0)) - 0.5,
              noise(position * 2.8 + vec3(0.0, t * 0.67, t * 0.21)) - 0.5,
              noise(position * 2.8 + vec3(t * 0.19, 0.0, t * 0.51)) - 0.5
            );
            freeDir = normalize(freeDir + normal * 0.35);
            float freeAmount = (0.05 + uBass * 0.16 + uTreble * 0.1) * (0.55 + uEnergy * 0.7) + uMorph * (0.12 + uDistortion * 0.14);

            vec3 displaced = position + normal * mixed + freeDir * freeAmount;
            vec4 worldPosition = modelMatrix * vec4(displaced, 1.0);
            vWorldPosition = worldPosition.xyz;
            gl_Position = projectionMatrix * viewMatrix * worldPosition;
          }
        `,
        fragmentShader: `
          varying vec2 vUv;
          varying vec3 vWorldPosition;
          varying vec3 vNormal;
          uniform float uTime;
          uniform float uBass;
          uniform float uTreble;
          uniform float uDistortion;
          uniform float uMorph;
          uniform float uEnergy;
          uniform float uPulse;
          uniform float uInsideAmount;

          float ringPulse(float x, float speed) {
            return 0.5 + 0.5 * sin(x + uTime * speed);
          }

          void main() {
            vec3 viewDir = normalize(cameraPosition - vWorldPosition);
            float fresnel = pow(1.0 - max(dot(normalize(vNormal), viewDir), 0.0), 2.0);

            float radial = distance(vUv, vec2(0.5));
            float basin = smoothstep(0.72, 0.02, radial);
            float bassBody = ringPulse((vUv.y + radial) * 10.5, 1.1 + uBass * 1.5);
            float trebleSpark = ringPulse((vUv.x * 44.0 + vUv.y * 38.0), 2.5 + uTreble * 6.8);
            float fogSwirl = ringPulse((vUv.x * 20.0 - vUv.y * 24.0), 1.0 + uBass * 2.2);

            vec3 bassColor = vec3(0.12, 0.45, 0.95);
            vec3 trebleColor = vec3(0.95, 0.45, 0.88);
            vec3 hotColor = vec3(1.0, 0.68, 0.38);
            vec3 mistColor = vec3(0.62, 0.92, 1.0);

            float blend = clamp(0.5 + (uTreble - uBass) * 0.4 + (trebleSpark - bassBody) * 0.24, 0.0, 1.0);
            vec3 color = mix(bassColor, trebleColor, blend);
            color = mix(color, hotColor, uDistortion * (0.2 + trebleSpark * 0.32));
            color = mix(color, mistColor, (0.1 + uEnergy * 0.25) * fogSwirl);

            float turbulence = mix(bassBody * 0.82, trebleSpark, 0.32 + uDistortion * 0.48);
            turbulence += fogSwirl * uMorph * 0.35;
            turbulence += uInsideAmount * (0.24 + 0.36 * sin(uTime * 2.7 + radial * 28.0));
            float alpha = basin * (0.2 + turbulence * 0.38 + fresnel * 0.16);
            alpha *= 0.5 + uDistortion * 0.5;
            alpha += uPulse * 0.08;

            gl_FragColor = vec4(color * (0.52 + turbulence * 0.62), alpha);
          }
        `
      })
    );
    group.add(core);

    const shell = new THREE.Mesh(
      new THREE.SphereGeometry(1.24, 80, 80),
      new THREE.MeshBasicMaterial({
        color: new THREE.Color("#95f0ff"),
        transparent: true,
        opacity: 0.06,
        side: THREE.BackSide
      })
    );
    group.add(shell);

    const glow = new THREE.Mesh(
      new THREE.SphereGeometry(1.34, 64, 64),
      new THREE.ShaderMaterial({
        transparent: true,
        side: THREE.BackSide,
        uniforms: {
          uTime: { value: 0 },
          uColor: { value: new THREE.Color("#70e4ff") },
          uColor2: { value: new THREE.Color("#ff86df") },
          uMorph: { value: 0 },
          uEnergy: { value: 0.3 },
          uPulse: { value: 0 }
        },
        vertexShader: `
          varying vec3 vNormal;
          void main() {
            vNormal = normalize(normalMatrix * normal);
            gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
          }
        `,
        fragmentShader: `
          varying vec3 vNormal;
          uniform float uTime;
          uniform vec3 uColor;
          uniform vec3 uColor2;
          uniform float uMorph;
          uniform float uEnergy;
          uniform float uPulse;
          void main() {
            float intensity = pow(0.72 - dot(vNormal, vec3(0.0, 0.0, 1.0)), 3.0);
            vec3 color = mix(uColor, uColor2, 0.5 + 0.5 * sin(uTime * 0.8));
            float pulseBoost = 1.0 + uPulse * 0.8 + uMorph * 0.45;
            gl_FragColor = vec4(color, intensity * (0.2 + uEnergy * 0.2) * pulseBoost);
          }
        `
      })
    );
    group.add(glow);

    const ambientLight = new THREE.AmbientLight(0x80dfff, 0.22);
    scene.add(ambientLight);

    const directionalLight = new THREE.DirectionalLight(0xddeeff, 1.4);
    directionalLight.position.set(2.2, 1.8, 3.0);
    scene.add(directionalLight);

    const rimLight = new THREE.DirectionalLight(0x7722cc, 0.55);
    rimLight.position.set(-2.0, -0.8, -2.5);
    scene.add(rimLight);

    const timer = typeof THREE.Timer === "function" ? new THREE.Timer() : null;
    const fallbackStart = performance.now();

    if (timer && typeof timer.start === "function") {
      timer.start();
    }

    function getElapsedSeconds() {
      if (timer) {
        if (typeof timer.update === "function") {
          timer.update();
        }
        if (typeof timer.getElapsed === "function") {
          return timer.getElapsed();
        }
        if (typeof timer.getElapsedTime === "function") {
          return timer.getElapsedTime();
        }
      }

      return (performance.now() - fallbackStart) / 1000;
    }

    let frameId = 0;
    let prevElapsed = 0;

    function resize() {
      const width = mount.clientWidth || 300;
      const height = mount.clientHeight || width;
      renderer.setSize(width, height, false);
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
    }

    function animate() {
      frameId = window.requestAnimationFrame(animate);
      const elapsed = getElapsedSeconds();
      const delta = Math.min(0.08, Math.max(0.001, elapsed - prevElapsed || 0.016));
      prevElapsed = elapsed;
      const currentDrive = driveRef.current;
      const currentBass = bassRef.current;
      const currentTreble = trebleRef.current;
      const currentDistortion = distortionRef.current;

      const targetEnergy = clamp01(
        currentDrive * 0.35 +
        currentBass * 0.25 +
        currentTreble * 0.2 +
        currentDistortion * 0.2
      );
      energyRef.current = lerp(energyRef.current, targetEnergy, Math.min(1, delta * 5.5));

      const risingEnergy = Math.max(0, targetEnergy - prevEnergyRef.current);
      prevEnergyRef.current = targetEnergy;

      const cs = chaosSensitivityRef.current;
      if (!chaosRef.current && (energyRef.current > cs || (energyRef.current > cs * 0.84 && risingEnergy > 0.08))) {
        chaosRef.current = true;
        peakPulseRef.current = Math.max(peakPulseRef.current, flareIntensityRef.current);
      } else if (chaosRef.current && energyRef.current < cs * 0.63) {
        chaosRef.current = false;
      }

      const morphTarget = chaosRef.current ? 1 : 0;
      const morphSpeed = chaosRef.current ? 2.8 : reformSpeedRef.current;
      morphRef.current = lerp(morphRef.current, morphTarget, Math.min(1, delta * morphSpeed));

      peakPulseRef.current = Math.max(0, peakPulseRef.current - delta * 0.9);
      if (risingEnergy > 0.11 && targetEnergy > cs * 0.92) {
        peakPulseRef.current = Math.min(1, peakPulseRef.current + 0.36 * flareIntensityRef.current);
      }

      const pulse = peakPulseRef.current;
      const paletteShift = clamp01(currentTreble * 0.6 + currentDistortion * 0.4);

      uniforms.uTime.value = elapsed;
      uniforms.uDrive.value = currentDrive;
      uniforms.uBass.value = currentBass;
      uniforms.uTreble.value = currentTreble;
      uniforms.uDistortion.value = currentDistortion;
      uniforms.uMorph.value = morphRef.current;
      uniforms.uEnergy.value = energyRef.current;
      uniforms.uPulse.value = pulse;
      uniforms.uPaletteShift.value = paletteShift;
      uniforms.uColorSpeed.value = colorSpeedRef.current;
      uniforms.uInsideAmount.value = insideAmountRef.current;
      coreUniforms.uTime.value = elapsed;
      coreUniforms.uBass.value = currentBass;
      coreUniforms.uTreble.value = currentTreble;
      coreUniforms.uDistortion.value = currentDistortion;
      coreUniforms.uMorph.value = morphRef.current;
      coreUniforms.uEnergy.value = energyRef.current;
      coreUniforms.uPulse.value = pulse;
      coreUniforms.uInsideAmount.value = insideAmountRef.current;
      glow.material.uniforms.uTime.value = elapsed;
      glow.material.uniforms.uMorph.value = morphRef.current;
      glow.material.uniforms.uEnergy.value = energyRef.current;
      glow.material.uniforms.uPulse.value = pulse;

      ambientLight.intensity = 0.14 + currentBass * 0.12 + (1 - morphRef.current) * 0.06;
      directionalLight.intensity = 1.1 + currentTreble * 0.55 + pulse * 0.4;
      directionalLight.color.setRGB(
        0.76 + currentTreble * 0.24,
        0.86 + currentBass * 0.14,
        0.98 - currentBass * 0.16 + currentTreble * 0.08
      );
      rimLight.intensity = 0.38 + currentBass * 0.3 + morphRef.current * 0.28 + pulse * 0.25;
      rimLight.color.setRGB(
        0.38 + currentDistortion * 0.3,
        0.12 + currentTreble * 0.18,
        0.72 + currentBass * 0.2
      );

      const inside = insideViewRef.current;
      insideAmountRef.current = lerp(insideAmountRef.current, inside ? 1 : 0, Math.min(1, delta * 2.2));
      const insideAmt = insideAmountRef.current;

      const targetZ = inside ? 0.1 : 3.8;
      const targetFov = inside ? 112 : 42;
      camera.position.z = lerp(camera.position.z, targetZ, Math.min(1, delta * 1.6));
      camera.fov = lerp(camera.fov, targetFov, Math.min(1, delta * 1.6));
      if (inside) {
        const drift = 0.34 + currentDrive * 0.2 + pulse * 0.22;
        const spiral = elapsed * (0.54 + currentTreble * 0.95 + pulse * 0.5);
        camera.position.x = Math.cos(spiral) * drift + Math.sin(elapsed * 2.1) * 0.06;
        camera.position.y = Math.sin(spiral * 1.18) * (drift * 0.76) + Math.cos(elapsed * 1.7) * 0.05;
      } else {
        camera.position.x = lerp(camera.position.x, 0, Math.min(1, delta * 2.2));
        camera.position.y = lerp(camera.position.y, 0, Math.min(1, delta * 2.2));
      }
      camera.lookAt(0, 0, 0);
      if (insideAmt > 0.02) {
        camera.rotateZ(Math.sin(elapsed * (0.52 + currentDistortion * 1.05)) * 0.0075 * insideAmt);
      }
      camera.updateProjectionMatrix();
      const rotScale = inside ? 0.05 : 1.0;
      group.rotation.y = elapsed * (0.18 + currentDrive * 0.2 + morphRef.current * 0.22) * rotScale;
      group.rotation.x = Math.sin(elapsed * (0.7 + morphRef.current * 0.65)) * (0.16 + morphRef.current * 0.18) * rotScale;
      globe.rotation.z = Math.sin(elapsed * (0.9 + currentDistortion * 1.6 + morphRef.current * 2.0)) * (0.08 + currentDistortion * 0.08 + morphRef.current * 0.16);
      core.rotation.y = -elapsed * (0.22 + currentTreble * 0.52 + morphRef.current * 0.58);
      core.rotation.x = Math.sin(elapsed * (0.78 + morphRef.current * 0.82)) * (0.1 + currentBass * 0.08 + morphRef.current * 0.12);
      core.position.x = Math.sin(elapsed * 0.31) * (0.07 + currentBass * 0.14 + morphRef.current * 0.2);
      core.position.y = Math.sin(elapsed * 0.27 + 1.1) * (0.06 + currentTreble * 0.12 + morphRef.current * 0.16);
      core.position.z = Math.sin(elapsed * 0.19 + 2.3) * (0.04 + currentDistortion * 0.09 + morphRef.current * 0.13);
      core.scale.set(
        0.985 + Math.sin(elapsed * (1.35 + currentBass * 0.9 + morphRef.current * 1.2)) * (0.014 + currentDistortion * 0.022 + morphRef.current * 0.055),
        0.985 + Math.sin(elapsed * (1.58 + currentTreble * 1.1 + morphRef.current * 0.9) + 0.82) * (0.016 + currentBass * 0.024 + morphRef.current * 0.062),
        0.985 + Math.sin(elapsed * (1.12 + currentDistortion * 0.85 + morphRef.current * 1.05) + 1.65) * (0.011 + currentDrive * 0.019 + morphRef.current * 0.048)
      );
      globe.scale.setScalar(1 + Math.sin(elapsed * (2.1 + currentDistortion * 2.8 + morphRef.current * 2.1)) * (0.018 + currentDrive * 0.022 + currentDistortion * 0.03 + morphRef.current * 0.06));
      shell.scale.setScalar(1.005 + Math.sin(elapsed * (1.7 + morphRef.current * 1.0)) * (0.01 + morphRef.current * 0.018));
      glow.scale.setScalar(1.0 + Math.sin(elapsed * (1.1 + morphRef.current * 0.75)) * (0.02 + morphRef.current * 0.04) + pulse * 0.02);

      renderer.render(scene, camera);
    }

    resize();
    animate();

    const resizeObserver = new ResizeObserver(resize);
    resizeObserver.observe(mount);

    return () => {
      window.cancelAnimationFrame(frameId);
      resizeObserver.disconnect();
      geometry.dispose();
      material.dispose();
      core.geometry.dispose();
      core.material.dispose();
      shell.geometry.dispose();
      shell.material.dispose();
      glow.geometry.dispose();
      glow.material.dispose();
      renderer.dispose();
      if (mount.contains(renderer.domElement)) {
        mount.removeChild(renderer.domElement);
      }
    };
  }, []);

  return <div className="three-globe" ref={mountRef} />;
}

export default HolographicGlobe;
