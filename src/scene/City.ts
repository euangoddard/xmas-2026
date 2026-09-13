import * as THREE from "three";
import { quality } from "../util/device";
import { batchStatic } from "./batching";
import {
  makeChristmasTree,
  makeCottage,
  makeFir,
  makeMarketStall,
  makeRadcliffeCamera,
  makeShop,
  makeSnowman,
  makeSpire,
  makeStreetLamp,
  makeTower,
  makeTownhouse,
  type Twinkler,
} from "./buildings";
import { groundHeightAt } from "./constants";
import { type Placement, planCity } from "./layout";
import { createSignTexture, FESTIVE_MESSAGES } from "./signTexture";

export interface City {
  city: THREE.Group;
  update: (dt: number, t: number) => void;
}

// Turns one planned placement into meshes. Everything the layout decides —
// where a building stands, how wide it is, which way it faces — is settled by
// the time we get here; this only knows how to build each kind.
function build(
  p: Placement,
  twinklers: Twinkler[],
  nextSign: () => THREE.Texture,
): THREE.Object3D | null {
  switch (p.kind) {
    case "radcliffe":
      return makeRadcliffeCamera();
    case "tower":
      return makeTower(p.height, p.width, { clock: p.clock === true });
    case "spire":
      return makeSpire(p.height, p.width);
    case "shop":
      return makeShop(p.width, nextSign(), p.variant);
    case "townhouse":
      return makeTownhouse(p.width, p.height, p.variant);
    case "cottage":
      return makeCottage(p.width, p.height, p.variant);
    case "fir":
      return makeFir(p.height);
    case "snowman":
      return makeSnowman();
    case "tree": {
      const tree = makeChristmasTree(p.height);
      twinklers.push(...tree.lights);
      return tree.group;
    }
    case "stall": {
      const stall = makeMarketStall(p.width);
      twinklers.push(stall.light);
      return stall.group;
    }
    case "lamp": {
      const lamp = makeStreetLamp();
      twinklers.push(lamp.light);
      return lamp.group;
    }
  }
}

export function createCity(scene: THREE.Scene): City {
  const city = new THREE.Group();
  const twinklers: Twinkler[] = [];

  let sign = 0;
  const nextSign = (): THREE.Texture => {
    const message = FESTIVE_MESSAGES[sign % FESTIVE_MESSAGES.length] as string;
    return createSignTexture(message, sign++);
  };

  for (const placement of planCity({ mobile: quality.mobile })) {
    const object = build(placement, twinklers, nextSign);
    if (!object) {
      continue;
    }
    // Stand on the snow: the ground is domed and rippled, so a building left
    // at y = 0 sinks into it near the middle and floats out at the rim.
    object.position.set(
      placement.x,
      groundHeightAt(placement.x, placement.z) - 0.05,
      placement.z,
    );
    object.rotation.y = placement.rotation;
    city.add(object);
  }

  batchStatic(city, new Set(twinklers.map((light) => light.mat)));
  scene.add(city);

  function update(_dt: number, t: number): void {
    for (const light of twinklers) {
      const amplitude = light.flicker ?? 0.5;
      light.mat.emissiveIntensity =
        light.base + Math.sin(t * 3 + light.phase) * amplitude;
    }
  }

  return { city, update };
}
