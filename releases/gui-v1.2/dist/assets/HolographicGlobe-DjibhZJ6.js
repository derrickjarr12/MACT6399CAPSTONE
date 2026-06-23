import{r as i,j as q}from"./vendor-react-B7xUVCNq.js";import{S as I,P as V,W as J,G as K,d as y,C as f,c as z,M as g,A as Q,b as X,B as _,a as Y,D as Z,T as F}from"./vendor-three-Mp8AqjRz.js";import"./vendor-misc-DYLXRpC5.js";function n(v){return Math.max(0,Math.min(1,v))}function ie({drive:v=.5,bass:b=.5,treble:T=.5,distortion:D=.5}){const U=i.useRef(null),M=i.useRef(n(v)),P=i.useRef(n(b)),C=i.useRef(n(T)),d=i.useRef(n(D));return i.useEffect(()=>{M.current=n(v)},[v]),i.useEffect(()=>{P.current=n(b)},[b]),i.useEffect(()=>{C.current=n(T)},[T]),i.useEffect(()=>{d.current=n(D)},[D]),i.useEffect(()=>{const a=U.current;if(!a)return;const p=new I,x=new V(32,1,.1,100);x.position.set(0,0,4.2);const t=new J({antialias:!0,alpha:!0});t.setPixelRatio(Math.min(window.devicePixelRatio,2)),t.setClearColor(0,0),a.appendChild(t.domElement);const r=new K;p.add(r);const N=new y(1.18,112,112),h={uTime:{value:0},uDrive:{value:M.current},uDistortion:{value:d.current},uGlow:{value:new f("#6ce8ff")},uGlow2:{value:new f("#8f7bff")},uGlow3:{value:new f("#ff7fd3")}},R=new z({uniforms:h,transparent:!0,vertexShader:`
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
      `,fragmentShader:`
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
      `}),B=new g(N,R);r.add(B);const u={uTime:{value:0},uBass:{value:P.current},uTreble:{value:C.current},uDistortion:{value:d.current}},s=new g(new y(.76,96,96),new z({uniforms:u,transparent:!0,depthWrite:!1,blending:Q,vertexShader:`
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
        `,fragmentShader:`
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
        `}));r.add(s);const w=new g(new y(1.24,80,80),new X({color:new f("#95f0ff"),transparent:!0,opacity:.06,side:_}));r.add(w);const m=new g(new y(1.34,64,64),new z({transparent:!0,side:_,uniforms:{uTime:{value:0},uColor:{value:new f("#70e4ff")},uColor2:{value:new f("#ff86df")}},vertexShader:`
          varying vec3 vNormal;
          void main() {
            vNormal = normalize(normalMatrix * normal);
            gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
          }
        `,fragmentShader:`
          varying vec3 vNormal;
          uniform float uTime;
          uniform vec3 uColor;
          uniform vec3 uColor2;
          void main() {
            float intensity = pow(0.72 - dot(vNormal, vec3(0.0, 0.0, 1.0)), 3.0);
            vec3 color = mix(uColor, uColor2, 0.5 + 0.5 * sin(uTime * 0.8));
            gl_FragColor = vec4(color, intensity * 0.28);
          }
        `}));r.add(m);const L=new Y(8445951,.6);p.add(L);const W=new Z(16777215,1.1);W.position.set(2.5,2,4),p.add(W);const o=typeof F=="function"?new F:null,H=performance.now();o&&typeof o.start=="function"&&o.start();function O(){if(o){if(typeof o.update=="function"&&o.update(),typeof o.getElapsed=="function")return o.getElapsed();if(typeof o.getElapsedTime=="function")return o.getElapsedTime()}return(performance.now()-H)/1e3}let E=0;function G(){const e=a.clientWidth||300,c=a.clientHeight||e;t.setSize(e,c,!1),x.aspect=e/c,x.updateProjectionMatrix()}function j(){E=window.requestAnimationFrame(j);const e=O(),c=M.current,S=P.current,k=C.current,l=d.current;h.uTime.value=e,h.uDrive.value=c,h.uDistortion.value=l,u.uTime.value=e,u.uBass.value=S,u.uTreble.value=k,u.uDistortion.value=l,m.material.uniforms.uTime.value=e,r.rotation.y=e*(.18+c*.2),r.rotation.x=Math.sin(e*.7)*.16,B.rotation.z=Math.sin(e*(.9+l*1.6))*(.08+l*.08),s.rotation.y=-e*(.22+k*.52),s.rotation.x=Math.sin(e*.78)*(.1+S*.08),s.scale.setScalar(.985+Math.sin(e*(1.35+S*.9))*(.012+l*.018)),B.scale.setScalar(1+Math.sin(e*(2.1+l*2.8))*(.018+c*.022+l*.03)),w.scale.setScalar(1.005+Math.sin(e*1.7)*.01),m.scale.setScalar(1+Math.sin(e*1.1)*.02),t.render(p,x)}G(),j();const A=new ResizeObserver(G);return A.observe(a),()=>{window.cancelAnimationFrame(E),A.disconnect(),N.dispose(),R.dispose(),s.geometry.dispose(),s.material.dispose(),w.geometry.dispose(),w.material.dispose(),m.geometry.dispose(),m.material.dispose(),t.dispose(),a.contains(t.domElement)&&a.removeChild(t.domElement)}},[]),q.jsx("div",{className:"three-globe",ref:U})}export{ie as default};
