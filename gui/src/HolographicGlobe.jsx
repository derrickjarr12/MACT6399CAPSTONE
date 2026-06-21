import { useEffect, useRef } from "react";
import * as THREE from "three";

function clamp01(value) {
  return Math.max(0, Math.min(1, value));
}

function HolographicGlobe({ drive = 0.5, bass = 0.5, treble = 0.5, distortion = 0.5 }) {
  const mountRef = useRef(null);
  const driveRef = useRef(clamp01(drive));
  const bassRef = useRef(clamp01(bass));
  const trebleRef = useRef(clamp01(treble));
  const distortionRef = useRef(clamp01(distortion));

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
    const mount = mountRef.current;
    if (!mount) {
      return undefined;
    }

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(32, 1, 0.1, 100);
    camera.position.set(0, 0, 4.2);

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setClearColor(0x000000, 0);
    mount.appendChild(renderer.domElement);

    const group = new THREE.Group();
    scene.add(group);

    const geometry = new THREE.SphereGeometry(1.18, 192, 192);

    const uniforms = {
      uTime: { value: 0 },
      uDrive: { value: driveRef.current },
      uDistortion: { value: distortionRef.current },
      uGlow: { value: new THREE.Color("#6ce8ff") },
      uGlow2: { value: new THREE.Color("#8f7bff") },
      uGlow3: { value: new THREE.Color("#ff7fd3") }
    };

    const material = new THREE.ShaderMaterial({
      uniforms,
      transparent: true,
      vertexShader: `
        varying vec3 vNormal;
        varying vec3 vWorldPosition;
        varying vec2 vUv;
        uniform float uTime;
        uniform float uDrive;
        uniform float uDistortion;

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
        uniform float uDistortion;
        uniform vec3 uGlow;
        uniform vec3 uGlow2;
        uniform vec3 uGlow3;

        void main() {
          vec3 normal = normalize(vNormal);
          vec3 viewDir = normalize(cameraPosition - vWorldPosition);
          float fresnel = pow(1.0 - max(dot(normal, viewDir), 0.0), 2.4);

          float wave1 = sin(vUv.y * 18.0 + uTime * 1.4 + normal.x * 3.0);
          float wave2 = cos(vUv.x * 20.0 - uTime * 1.1 + normal.y * 4.0);
          float swirl = sin((vUv.x + vUv.y) * 16.0 - uTime * 1.8);
          float band = wave1 * 0.35 + wave2 * 0.35 + swirl * 0.3;
          band += sin(vUv.y * 42.0 - uTime * (3.2 + uDistortion * 5.0)) * (0.08 + uDistortion * 0.2);

          vec3 deepCore = vec3(0.02, 0.035, 0.07);
          vec3 color = deepCore;
          color += uGlow * (0.18 + 0.25 * band);
          color += uGlow2 * (0.12 + 0.22 * sin(uTime + vUv.x * 10.0));
          color += uGlow3 * (0.1 + 0.16 * cos(uTime * 0.9 + vUv.y * 12.0));
          color *= 0.6 + 0.6 * fresnel;

          float innerMist = smoothstep(0.55, -0.1, distance(vUv, vec2(0.5)));
          color += vec3(0.08, 0.11, 0.16) * innerMist * (0.4 + uDrive * 0.3);

          float alpha = 0.78 + fresnel * 0.22;
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
      uDistortion: { value: distortionRef.current }
    };

    const core = new THREE.Mesh(
      new THREE.SphereGeometry(0.76, 160, 160),
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

            vec3 displaced = position + normal * mixed;
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

            vec3 bassColor = vec3(0.12, 0.45, 0.95);
            vec3 trebleColor = vec3(0.95, 0.45, 0.88);
            vec3 hotColor = vec3(1.0, 0.68, 0.38);

            float blend = clamp(0.5 + (uTreble - uBass) * 0.4 + (trebleSpark - bassBody) * 0.24, 0.0, 1.0);
            vec3 color = mix(bassColor, trebleColor, blend);
            color = mix(color, hotColor, uDistortion * (0.2 + trebleSpark * 0.32));

            float turbulence = mix(bassBody * 0.82, trebleSpark, 0.32 + uDistortion * 0.48);
            float alpha = basin * (0.2 + turbulence * 0.38 + fresnel * 0.16);
            alpha *= 0.5 + uDistortion * 0.5;

            gl_FragColor = vec4(color * (0.52 + turbulence * 0.62), alpha);
          }
        `
      })
    );
    group.add(core);

    const shell = new THREE.Mesh(
      new THREE.SphereGeometry(1.24, 128, 128),
      new THREE.MeshBasicMaterial({
        color: new THREE.Color("#95f0ff"),
        transparent: true,
        opacity: 0.06,
        side: THREE.BackSide
      })
    );
    group.add(shell);

    const glow = new THREE.Mesh(
      new THREE.SphereGeometry(1.34, 96, 96),
      new THREE.ShaderMaterial({
        transparent: true,
        side: THREE.BackSide,
        uniforms: {
          uTime: { value: 0 },
          uColor: { value: new THREE.Color("#70e4ff") },
          uColor2: { value: new THREE.Color("#ff86df") }
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
          void main() {
            float intensity = pow(0.72 - dot(vNormal, vec3(0.0, 0.0, 1.0)), 3.0);
            vec3 color = mix(uColor, uColor2, 0.5 + 0.5 * sin(uTime * 0.8));
            gl_FragColor = vec4(color, intensity * 0.28);
          }
        `
      })
    );
    group.add(glow);

    const ambientLight = new THREE.AmbientLight(0x80dfff, 0.6);
    scene.add(ambientLight);

    const directionalLight = new THREE.DirectionalLight(0xffffff, 1.1);
    directionalLight.position.set(2.5, 2, 4);
    scene.add(directionalLight);

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
      const currentDrive = driveRef.current;
      const currentBass = bassRef.current;
      const currentTreble = trebleRef.current;
      const currentDistortion = distortionRef.current;

      uniforms.uTime.value = elapsed;
      uniforms.uDrive.value = currentDrive;
      uniforms.uDistortion.value = currentDistortion;
      coreUniforms.uTime.value = elapsed;
      coreUniforms.uBass.value = currentBass;
      coreUniforms.uTreble.value = currentTreble;
      coreUniforms.uDistortion.value = currentDistortion;
      glow.material.uniforms.uTime.value = elapsed;

      group.rotation.y = elapsed * (0.18 + currentDrive * 0.2);
      group.rotation.x = Math.sin(elapsed * 0.7) * 0.16;
      globe.rotation.z = Math.sin(elapsed * (0.9 + currentDistortion * 1.6)) * (0.08 + currentDistortion * 0.08);
      core.rotation.y = -elapsed * (0.22 + currentTreble * 0.52);
      core.rotation.x = Math.sin(elapsed * 0.78) * (0.1 + currentBass * 0.08);
      core.scale.setScalar(0.985 + Math.sin(elapsed * (1.35 + currentBass * 0.9)) * (0.012 + currentDistortion * 0.018));
      globe.scale.setScalar(1 + Math.sin(elapsed * (2.1 + currentDistortion * 2.8)) * (0.018 + currentDrive * 0.022 + currentDistortion * 0.03));
      shell.scale.setScalar(1.005 + Math.sin(elapsed * 1.7) * 0.01);
      glow.scale.setScalar(1.0 + Math.sin(elapsed * 1.1) * 0.02);

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
