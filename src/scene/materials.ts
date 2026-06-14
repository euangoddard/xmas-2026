import * as THREE from "three";

// Shared palette + materials so the whole city reads as one cohesive,
// low-poly, Cotswold-stone Oxford under snow.
export const PALETTE = {
  stoneLight: 0xe7dcc4,
  stoneWarm: 0xd8c79f,
  stoneGrey: 0xc9c4b6,
  roofSlate: 0x4a5066,
  roofRed: 0x7c3b35,
  snow: 0xf3f7ff,
  gold: 0xd9b25a,
  doorGreen: 0x244a35,
  doorRed: 0x6a2330,
  windowGlow: 0xffd591,
  tree: 0x1f5c3a,
} as const;

const cache = new Map<string, THREE.MeshStandardMaterial>();
function std(
  color: number,
  opts: THREE.MeshStandardMaterialParameters = {},
): THREE.MeshStandardMaterial {
  const key = color + JSON.stringify(opts);
  let mat = cache.get(key);
  if (!mat) {
    mat = new THREE.MeshStandardMaterial({
      color,
      roughness: 0.85,
      metalness: 0,
      ...opts,
    });
    cache.set(key, mat);
  }
  return mat;
}

export const MAT = {
  stoneLight: () => std(PALETTE.stoneLight),
  stoneWarm: () => std(PALETTE.stoneWarm),
  stoneGrey: () => std(PALETTE.stoneGrey),
  roofSlate: () => std(PALETTE.roofSlate, { roughness: 0.7 }),
  roofRed: () => std(PALETTE.roofRed, { roughness: 0.75 }),
  snow: () =>
    std(PALETTE.snow, {
      roughness: 0.95,
      emissive: new THREE.Color(0x1c2845),
      emissiveIntensity: 0.12,
    }),
  gold: () => std(PALETTE.gold, { roughness: 0.3, metalness: 0.7 }),
  doorGreen: () => std(PALETTE.doorGreen, { roughness: 0.6 }),
  doorRed: () => std(PALETTE.doorRed, { roughness: 0.6 }),
  tree: () => std(PALETTE.tree, { roughness: 0.9 }),
  window: () =>
    new THREE.MeshStandardMaterial({
      color: PALETTE.windowGlow,
      emissive: new THREE.Color(PALETTE.windowGlow),
      emissiveIntensity: 0.9,
      roughness: 0.4,
    }),
};
