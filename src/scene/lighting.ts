import * as THREE from "three";
import { quality } from "../util/device";
import { GLOBE_CENTER_Y, GLOBE_RADIUS } from "./constants";

export interface Lighting {
  hemi: THREE.HemisphereLight;
  moon: THREE.DirectionalLight;
  glow: THREE.PointLight;
  square: THREE.PointLight;
}

// A wintry night-time rig: cool moonlight key, warm bounce from the snow, and a
// soft hemisphere fill so the low-poly facets read clearly.
export function createLighting(scene: THREE.Scene): Lighting {
  // Cool sky fill warmed from below by lamplight bouncing off the snow.
  const hemi = new THREE.HemisphereLight(0xaec6ff, 0x4a3320, 0.5);
  scene.add(hemi);

  const moon = new THREE.DirectionalLight(0xd7e3ff, 0.95);
  moon.position.set(
    -GLOBE_RADIUS,
    GLOBE_CENTER_Y + GLOBE_RADIUS * 1.4,
    GLOBE_RADIUS * 0.6,
  );
  moon.target.position.set(0, GLOBE_CENTER_Y - 2, 0);
  scene.add(moon.target);

  if (quality.shadows) {
    moon.castShadow = true;
    moon.shadow.mapSize.set(1024, 1024);
    const s = GLOBE_RADIUS * 1.2;
    moon.shadow.camera.left = -s;
    moon.shadow.camera.right = s;
    moon.shadow.camera.top = s;
    moon.shadow.camera.bottom = -s;
    moon.shadow.camera.near = 1;
    moon.shadow.camera.far = GLOBE_RADIUS * 5;
    moon.shadow.bias = -0.0006;
  }
  scene.add(moon);

  // Warm festive glow rising from the city centre — the cosy heart of the scene.
  const glow = new THREE.PointLight(0xffa64d, 1.5, GLOBE_RADIUS * 2.6, 1.5);
  glow.position.set(0, GLOBE_CENTER_Y - 0.6, 0);
  scene.add(glow);

  // A second low amber light by the Christmas-tree square for foreground warmth.
  const square = new THREE.PointLight(0xffc06a, 1.1, GLOBE_RADIUS * 1.4, 1.8);
  square.position.set(3.4, 2.0, 4.8);
  scene.add(square);

  return { hemi, moon, glow, square };
}
