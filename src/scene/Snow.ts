import * as THREE from "three";
import { quality } from "../util/device";
import { GLOBE_CENTER_Y, GLOBE_RADIUS } from "./constants";

const TOP_Y = GLOBE_CENTER_Y + GLOBE_RADIUS;

export interface Snow {
  points: THREE.Points;
  update: (dt: number) => void;
  shake: () => void;
}

// Largest horizontal radius available at height y so flakes stay inside glass.
function maxRadiusAt(y: number): number {
  const dy = y - GLOBE_CENTER_Y;
  const inside = GLOBE_RADIUS * GLOBE_RADIUS - dy * dy;
  return inside > 0 ? Math.sqrt(inside) * 0.98 : 0;
}

function softFlakeTexture(): THREE.CanvasTexture {
  const size = 64;
  const c = document.createElement("canvas");
  c.width = c.height = size;
  const ctx = c.getContext("2d");
  if (!ctx) {
    throw new Error("2D canvas context unavailable");
  }
  const g = ctx.createRadialGradient(
    size / 2,
    size / 2,
    0,
    size / 2,
    size / 2,
    size / 2,
  );
  g.addColorStop(0, "rgba(255,255,255,1)");
  g.addColorStop(0.4, "rgba(255,255,255,0.85)");
  g.addColorStop(1, "rgba(255,255,255,0)");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, size, size);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

export function createSnow(scene: THREE.Scene): Snow {
  const count = quality.snowCount;
  const positions = new Float32Array(count * 3);
  const speeds = new Float32Array(count);
  const phases = new Float32Array(count);

  for (let i = 0; i < count; i++) {
    const y = Math.random() * TOP_Y;
    const r = Math.random() * maxRadiusAt(y);
    const a = Math.random() * Math.PI * 2;
    positions[i * 3] = Math.cos(a) * r;
    positions[i * 3 + 1] = y;
    positions[i * 3 + 2] = Math.sin(a) * r;
    speeds[i] = 0.6 + Math.random() * 1.1;
    phases[i] = Math.random() * Math.PI * 2;
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.BufferAttribute(positions, 3));

  const mat = new THREE.PointsMaterial({
    size: quality.mobile ? 0.16 : 0.13,
    map: softFlakeTexture(),
    transparent: true,
    opacity: 0.9,
    depthWrite: false,
    blending: THREE.NormalBlending,
    sizeAttenuation: true,
  });

  const points = new THREE.Points(geo, mat);
  points.frustumCulled = false;
  points.renderOrder = 5;
  scene.add(points);

  let swirl = 0; // 0..1, decays after a shake

  function shake(): void {
    swirl = 1;
  }

  function update(dt: number): void {
    const arr = geo.attributes.position?.array as Float32Array;
    const t = performance.now() * 0.001;
    swirl = Math.max(0, swirl - dt * 0.35);
    const swirlStrength = swirl * 3.0;

    for (let i = 0; i < count; i++) {
      const ix = i * 3;
      let x = arr[ix];
      let y = arr[ix + 1];
      let z = arr[ix + 2];

      // Fall + gentle lateral sway, plus extra turbulence right after a shake.
      const sway = Math.sin(t * 1.3 + phases[i]) * (0.25 + swirlStrength);
      y -= (speeds[i] + swirlStrength * 1.2) * dt;
      x += sway * dt;
      z += Math.cos(t * 1.1 + phases[i]) * (0.25 + swirlStrength) * dt;

      // Swirl rotates flakes around the centre when shaken.
      if (swirl > 0) {
        const ang = swirlStrength * dt * 0.4;
        const cs = Math.cos(ang);
        const sn = Math.sin(ang);
        const nx = x * cs - z * sn;
        const nz = x * sn + z * cs;
        x = nx;
        z = nz;
      }

      // Recycle below ground back to the top.
      if (y < 0.15) {
        y = TOP_Y - Math.random() * 1.5;
        const r = Math.random() * maxRadiusAt(y);
        const a = Math.random() * Math.PI * 2;
        x = Math.cos(a) * r;
        z = Math.sin(a) * r;
      }

      // Keep flakes within the glass.
      const rMax = maxRadiusAt(y);
      const r = Math.hypot(x, z);
      if (r > rMax && r > 0) {
        const k = rMax / r;
        x *= k;
        z *= k;
      }

      arr[ix] = x;
      arr[ix + 1] = y;
      arr[ix + 2] = z;
    }
    (geo.attributes.position as THREE.BufferAttribute).needsUpdate = true;
  }

  return { points, update, shake };
}
