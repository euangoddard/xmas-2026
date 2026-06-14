import * as THREE from "three";

export interface Sky {
  stars: THREE.Points;
  update: (t: number) => void;
}

// A warm vertical gradient used as the scene background: deep midnight blue up
// top easing into a soft indigo/plum near the horizon — cosy, not clinical.
function gradientBackground(): THREE.CanvasTexture {
  const c = document.createElement("canvas");
  c.width = 2;
  c.height = 512;
  const ctx = c.getContext("2d");
  if (!ctx) {
    throw new Error("2D canvas context unavailable");
  }
  const g = ctx.createLinearGradient(0, 0, 0, 512);
  g.addColorStop(0.0, "#070a1e"); // zenith
  g.addColorStop(0.45, "#121634");
  g.addColorStop(0.75, "#241a3e"); // warm plum toward horizon
  g.addColorStop(1.0, "#3a2342");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 2, 512);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

// A dome of twinkling stars, immune to fog so they stay crisp behind the globe.
export function createSky(scene: THREE.Scene, mobile: boolean): Sky {
  scene.background = gradientBackground();

  const count = mobile ? 500 : 1100;
  const radius = 150;
  const positions = new Float32Array(count * 3);
  const phases = new Float32Array(count);
  const baseSize = new Float32Array(count);

  for (let i = 0; i < count; i++) {
    // Bias toward the upper hemisphere so stars sit in the sky, not the ground.
    const u = Math.random();
    const v = Math.random() * 0.7 + 0.15;
    const theta = u * Math.PI * 2;
    const phi = Math.acos(2 * v - 1);
    const x = Math.sin(phi) * Math.cos(theta);
    const y = Math.abs(Math.cos(phi)) * 0.9 + 0.05;
    const z = Math.sin(phi) * Math.sin(theta);
    positions[i * 3] = x * radius;
    positions[i * 3 + 1] = y * radius;
    positions[i * 3 + 2] = z * radius;
    phases[i] = Math.random() * Math.PI * 2;
    baseSize[i] = 0.6 + Math.random() * 1.4;
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  geo.setAttribute("size", new THREE.BufferAttribute(baseSize, 1));
  geo.setAttribute("phase", new THREE.BufferAttribute(phases, 1));

  // Custom shader so each star can twinkle independently and scale with depth.
  const mat = new THREE.ShaderMaterial({
    uniforms: {
      uTime: { value: 0 },
      uPixelRatio: { value: Math.min(window.devicePixelRatio, 2) },
    },
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    fog: false,
    vertexShader: /* glsl */ `
      attribute float size;
      attribute float phase;
      uniform float uTime;
      uniform float uPixelRatio;
      varying float vTwinkle;
      void main() {
        vTwinkle = 0.55 + 0.45 * sin(uTime * 1.6 + phase);
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        gl_Position = projectionMatrix * mv;
        gl_PointSize = size * uPixelRatio * (300.0 / -mv.z);
      }
    `,
    fragmentShader: /* glsl */ `
      varying float vTwinkle;
      void main() {
        vec2 uv = gl_PointCoord - 0.5;
        float d = length(uv);
        float a = smoothstep(0.5, 0.0, d) * vTwinkle;
        vec3 col = mix(vec3(1.0, 0.93, 0.82), vec3(0.78, 0.86, 1.0), step(0.5, fract(vTwinkle * 7.0)));
        gl_FragColor = vec4(col, a);
      }
    `,
  });

  const stars = new THREE.Points(geo, mat);
  stars.frustumCulled = false;
  scene.add(stars);

  function update(t: number): void {
    (mat.uniforms.uTime as THREE.IUniform).value = t;
  }

  return { stars, update };
}
