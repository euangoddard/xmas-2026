import * as THREE from "three";
import { EffectComposer } from "three/addons/postprocessing/EffectComposer.js";
import { OutputPass } from "three/addons/postprocessing/OutputPass.js";
import { RenderPass } from "three/addons/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/addons/postprocessing/UnrealBloomPass.js";
import { quality } from "../util/device";

export interface PostFX {
  render: () => void;
  setSize: (w: number, h: number) => void;
}

// Soft bloom makes the windows, lamps and tree lights glow warmly — the heart
// of the cosy look. Skipped on mobile, where we render straight to the canvas.
export function createPostFX(
  renderer: THREE.WebGLRenderer,
  scene: THREE.Scene,
  camera: THREE.PerspectiveCamera,
): PostFX {
  if (quality.mobile) {
    return {
      render: () => renderer.render(scene, camera),
      setSize: () => {},
    };
  }

  const composer = new EffectComposer(renderer);
  composer.setPixelRatio(quality.pixelRatio);
  composer.setSize(window.innerWidth, window.innerHeight);

  composer.addPass(new RenderPass(scene, camera));

  const bloom = new UnrealBloomPass(
    new THREE.Vector2(window.innerWidth, window.innerHeight),
    0.62, // strength
    0.55, // radius
    0.58, // threshold — only the bright emissive bits glow
  );
  composer.addPass(bloom);
  composer.addPass(new OutputPass());

  return {
    render: () => composer.render(),
    setSize: (w, h) => {
      composer.setSize(w, h);
      bloom.setSize(w, h);
    },
  };
}
