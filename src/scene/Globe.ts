import * as THREE from "three";
import { quality } from "../util/device";
import {
  COLORS,
  GLOBE_CENTER_Y,
  GLOBE_RADIUS,
  GROUND_RADIUS,
} from "./constants";

export interface Globe {
  group: THREE.Group;
  glass: THREE.Mesh;
  ground: THREE.Mesh;
}

// Builds the glass dome, the snowy ground disc, and the decorative base the
// whole globe rests on.
export function createGlobe(scene: THREE.Scene): Globe {
  const group = new THREE.Group();

  // ---- Snowy ground -------------------------------------------------------
  const groundGeo = new THREE.CircleGeometry(GROUND_RADIUS, 96);
  groundGeo.rotateX(-Math.PI / 2);
  // Gentle undulation so the snow isn't a perfect flat plane.
  const pos = groundGeo.attributes.position as THREE.BufferAttribute;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const z = pos.getZ(i);
    const r = Math.hypot(x, z);
    const bump = Math.sin(x * 0.5) * Math.cos(z * 0.5) * 0.18;
    const dome = (1 - (r / GROUND_RADIUS) ** 2) * 0.5; // slightly raised centre
    pos.setY(i, bump + dome);
  }
  groundGeo.computeVertexNormals();
  const ground = new THREE.Mesh(
    groundGeo,
    new THREE.MeshStandardMaterial({
      color: COLORS.snow,
      roughness: 0.92,
      metalness: 0.0,
      emissive: new THREE.Color(0x223055),
      emissiveIntensity: 0.18,
    }),
  );
  ground.receiveShadow = quality.shadows;
  group.add(ground);

  // ---- Decorative base ----------------------------------------------------
  const base = new THREE.Group();
  const baseBody = new THREE.Mesh(
    new THREE.CylinderGeometry(
      GROUND_RADIUS + 0.35,
      GROUND_RADIUS + 1.6,
      3.4,
      64,
    ),
    new THREE.MeshStandardMaterial({
      color: 0x5a2330,
      roughness: 0.6,
      metalness: 0.15,
    }),
  );
  baseBody.position.y = -1.6;
  base.add(baseBody);

  const rim = new THREE.Mesh(
    new THREE.TorusGeometry(GROUND_RADIUS + 0.45, 0.34, 16, 80),
    new THREE.MeshStandardMaterial({
      color: 0xd9b25a,
      roughness: 0.35,
      metalness: 0.6,
    }),
  );
  rim.rotation.x = Math.PI / 2;
  rim.position.y = 0.12;
  base.add(rim);

  const plinth = new THREE.Mesh(
    new THREE.CylinderGeometry(
      GROUND_RADIUS + 1.7,
      GROUND_RADIUS + 2.1,
      0.9,
      64,
    ),
    new THREE.MeshStandardMaterial({ color: 0x3c1620, roughness: 0.7 }),
  );
  plinth.position.y = -3.4;
  base.add(plinth);
  group.add(base);

  // ---- Glass dome ---------------------------------------------------------
  const glassGeo = new THREE.SphereGeometry(GLOBE_RADIUS, 64, 48);
  let glassMat: THREE.MeshPhysicalMaterial;
  if (quality.mobile) {
    // Transmission is costly on phones — fall back to a tinted transparent shell.
    glassMat = new THREE.MeshPhysicalMaterial({
      color: COLORS.glass,
      roughness: 0.08,
      metalness: 0,
      transparent: true,
      opacity: 0.12,
      side: THREE.DoubleSide,
      depthWrite: false,
    });
  } else {
    glassMat = new THREE.MeshPhysicalMaterial({
      color: 0xffffff,
      roughness: 0.04,
      metalness: 0,
      transmission: 1.0,
      thickness: 1.2,
      ior: 1.45,
      transparent: true,
      opacity: 1,
      side: THREE.DoubleSide,
      depthWrite: false,
      clearcoat: 0.4,
      clearcoatRoughness: 0.1,
      attenuationColor: new THREE.Color(COLORS.glass),
      attenuationDistance: 18,
    });
  }
  const glass = new THREE.Mesh(glassGeo, glassMat);
  glass.position.y = GLOBE_CENTER_Y;
  glass.renderOrder = 10; // draw after the city so transparency composites right
  group.add(glass);

  // A faint specular highlight ring sells the curvature of the glass.
  const highlight = new THREE.Mesh(
    new THREE.SphereGeometry(GLOBE_RADIUS * 0.995, 48, 32),
    new THREE.MeshBasicMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 0.04,
      side: THREE.BackSide,
      depthWrite: false,
    }),
  );
  highlight.position.y = GLOBE_CENTER_Y;
  group.add(highlight);

  scene.add(group);
  return { group, glass, ground };
}
