import * as THREE from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";

// A city this dense is hundreds of little meshes, and every one of them is a
// draw call — twice over, once for the shadow map. Nothing in it moves, so the
// static parts are baked down to one mesh per material once the city is built.
// Only the materials the render loop animates are held back.

/**
 * Bake a group's static meshes down to one merged mesh per material, in place.
 *
 * @param animated Materials the render loop mutates; meshes using them are
 *   left as they are so each can still be lit on its own.
 * @returns How many draw calls this saved.
 */
export function batchStatic(
  group: THREE.Group,
  animated: ReadonlySet<THREE.Material> = new Set(),
): number {
  group.updateMatrixWorld(true);
  // Bake into the group's own space, not the world's, so the merged meshes
  // still move with the group if it is ever transformed.
  const toLocal = group.matrixWorld.clone().invert();
  const matrix = new THREE.Matrix4();

  const byMaterial = new Map<
    THREE.Material,
    { geometries: THREE.BufferGeometry[]; meshes: THREE.Mesh[] }
  >();

  group.traverse((node) => {
    if (!(node instanceof THREE.Mesh)) {
      return;
    }
    // Multi-material meshes (the shop signs) carry a per-face material array;
    // merging those would need matching groups, and there are few enough of
    // them that it isn't worth it.
    if (Array.isArray(node.material) || animated.has(node.material)) {
      return;
    }
    const entry = byMaterial.get(node.material) ?? {
      geometries: [],
      meshes: [],
    };
    // Non-indexed throughout: three's geometries are a mix of indexed (boxes,
    // spheres) and not (extrusions), and they cannot be merged together.
    const source = node.geometry;
    const geometry =
      source.index === null ? source.clone() : source.toNonIndexed();
    geometry.applyMatrix4(matrix.multiplyMatrices(toLocal, node.matrixWorld));
    // Merging discards anything not shared by every geometry in the batch.
    for (const name of Object.keys(geometry.attributes)) {
      if (name !== "position" && name !== "normal" && name !== "uv") {
        geometry.deleteAttribute(name);
      }
    }
    entry.geometries.push(geometry);
    entry.meshes.push(node);
    byMaterial.set(node.material, entry);
  });

  let saved = 0;
  for (const [material, { geometries, meshes }] of byMaterial) {
    if (geometries.length < 2) {
      for (const g of geometries) {
        g.dispose();
      }
      continue;
    }
    const merged = mergeGeometries(geometries, false);
    for (const g of geometries) {
      g.dispose();
    }
    if (!merged) {
      continue; // incompatible attributes; leave these meshes as they are
    }
    const batch = new THREE.Mesh(merged, material);
    // The merged geometry is already in the group's local space.
    batch.matrixAutoUpdate = false;
    batch.castShadow = meshes.some((m) => m.castShadow);
    batch.receiveShadow = meshes.some((m) => m.receiveShadow);
    for (const mesh of meshes) {
      mesh.removeFromParent();
      mesh.geometry.dispose();
    }
    group.add(batch);
    saved += meshes.length - 1;
  }
  return saved;
}
