import * as THREE from "three";
import type { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { GLOBE_CENTER_Y, GLOBE_RADIUS } from "./scene/constants";
import { lerp, tween } from "./util/tween";

export type ViewName = "street" | "aerial";

interface Preset {
  dist: number;
  y: number;
  targetY: number;
  next: string;
}

// Two framings the viewer toggles between: down at street level inside the
// globe, and pulled back to see the whole globe on its base.
const PRESETS: Record<ViewName, Preset> = {
  street: { dist: 8.5, y: 2.2, targetY: 2.4, next: "Zoom out" },
  aerial: {
    dist: GLOBE_RADIUS * 2.7,
    y: GLOBE_CENTER_Y + 7,
    targetY: GLOBE_CENTER_Y,
    next: "Go inside",
  },
};

export interface CameraModes {
  toggle: () => string;
  goTo: (name: ViewName) => void;
  snapTo: (name: ViewName) => void;
  nextLabel: () => string;
  readonly current: ViewName;
}

export function createCameraModes(
  camera: THREE.PerspectiveCamera,
  controls: OrbitControls,
): CameraModes {
  let current: ViewName = "street";
  let cancel: (() => void) | null = null;

  const azimuth = (): number =>
    Math.atan2(
      camera.position.x - controls.target.x,
      camera.position.z - controls.target.z,
    );

  function destinationFor(name: ViewName): {
    pos: THREE.Vector3;
    target: THREE.Vector3;
  } {
    const p = PRESETS[name];
    const az = azimuth();
    const horiz = Math.sqrt(
      Math.max(0.25, p.dist * p.dist - (p.y - p.targetY) ** 2),
    );
    return {
      pos: new THREE.Vector3(Math.sin(az) * horiz, p.y, Math.cos(az) * horiz),
      target: new THREE.Vector3(0, p.targetY, 0),
    };
  }

  function snapTo(name: ViewName): void {
    current = name;
    const dest = destinationFor(name);
    camera.position.copy(dest.pos);
    controls.target.copy(dest.target);
    controls.update();
  }

  function goTo(name: ViewName): void {
    cancel?.();
    current = name;
    const fromPos = camera.position.clone();
    const fromTarget = controls.target.clone();
    const dest = destinationFor(name);
    const wasAuto = controls.autoRotate;
    controls.autoRotate = false;

    cancel = tween({
      duration: 1400,
      onUpdate: (e) => {
        camera.position.lerpVectors(fromPos, dest.pos, e);
        controls.target.set(
          lerp(fromTarget.x, dest.target.x, e),
          lerp(fromTarget.y, dest.target.y, e),
          lerp(fromTarget.z, dest.target.z, e),
        );
        controls.update();
      },
      onComplete: () => {
        controls.autoRotate = wasAuto;
        cancel = null;
      },
    });
  }

  function toggle(): string {
    goTo(current === "street" ? "aerial" : "street");
    return PRESETS[current].next; // label for the *other* state after this toggle
  }

  // Label to show on the button for the next action.
  const nextLabel = (): string =>
    PRESETS[current === "street" ? "aerial" : "street"].next;

  return {
    toggle,
    goTo,
    snapTo,
    nextLabel,
    get current(): ViewName {
      return current;
    },
  };
}
