import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { quality } from "../util/device";
import { COLORS, GLOBE_RADIUS } from "./constants";

export interface SceneContext {
  renderer: THREE.WebGLRenderer;
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  controls: OrbitControls;
}

export function createScene(canvas: HTMLCanvasElement): SceneContext {
  const renderer = new THREE.WebGLRenderer({
    canvas,
    antialias: quality.antialias,
    alpha: false,
    powerPreference: "high-performance",
  });
  renderer.setPixelRatio(quality.pixelRatio);
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.2;
  renderer.shadowMap.enabled = quality.shadows;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(COLORS.sky);
  // Gentle depth up close without swallowing the globe when zoomed out.
  scene.fog = new THREE.Fog(COLORS.fog, GLOBE_RADIUS * 1.8, GLOBE_RADIUS * 12);

  const camera = new THREE.PerspectiveCamera(
    55,
    window.innerWidth / window.innerHeight,
    0.1,
    400,
  );
  // Start at street level inside the globe, looking across the city.
  camera.position.set(1.2, 2.2, GLOBE_RADIUS * 0.76);

  const controls = new OrbitControls(camera, renderer.domElement);
  controls.target.set(0, 2.4, -0.5);
  controls.enableDamping = true;
  controls.dampingFactor = 0.06;
  controls.enablePan = false;
  controls.rotateSpeed = 0.6;
  controls.zoomSpeed = 0.8;
  // Full horizontal spin; clamp vertical so you can't fly under the base.
  controls.minPolarAngle = 0.18;
  controls.maxPolarAngle = Math.PI * 0.52;
  controls.minDistance = 2.2;
  controls.maxDistance = GLOBE_RADIUS * 3.4;
  controls.autoRotate = true;
  controls.autoRotateSpeed = 0.35;
  controls.update();

  function onResize(): void {
    const w = window.innerWidth;
    const h = window.innerHeight;
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    renderer.setSize(w, h);
    renderer.setPixelRatio(quality.pixelRatio);
  }
  window.addEventListener("resize", onResize);

  return { renderer, scene, camera, controls };
}
