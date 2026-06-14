import * as THREE from "three";
import { quality } from "../util/device";
import {
  makeChristmasTree,
  makeRadcliffeCamera,
  makeShop,
  makeSpire,
  makeTower,
  makeTownhouse,
  type Twinkler,
} from "./buildings";
import { CITY_RADIUS } from "./constants";
import { MAT } from "./materials";
import { createSignTexture, FESTIVE_MESSAGES } from "./signTexture";

const TAU = Math.PI * 2;

export interface City {
  city: THREE.Group;
  update: (dt: number, t: number) => void;
}

interface Hero {
  make: () => THREE.Group;
  x: number;
  z: number;
  clearance: number;
}

interface Footprint {
  x: number;
  z: number;
  r: number;
}

// Orient an object so its +Z (front) faces the centre of the globe.
function faceCentre(obj: THREE.Object3D): void {
  obj.rotation.y = Math.atan2(-obj.position.x, -obj.position.z);
}

// The camera opens at +Z looking toward the centre. Keep a clear avenue there
// so the establishing shot always looks down an open street, never into the
// back of a randomly-placed building.
const FRONT_ANGLE = Math.PI / 2; // +Z direction in (cos a, sin a) placement
const AVENUE_HALF = 0.62; // radians of clearance either side
function inAvenue(a: number): boolean {
  const d = Math.atan2(Math.sin(a - FRONT_ANGLE), Math.cos(a - FRONT_ANGLE));
  return Math.abs(d) < AVENUE_HALF;
}

// Hand-placed hero landmarks within the city footprint.
const HEROES: Hero[] = [
  { make: () => makeRadcliffeCamera(), x: 0, z: -2.8, clearance: 3.4 },
  {
    make: () => makeTower(7.5, 2.4, { clock: true }),
    x: -5.2,
    z: 3.0,
    clearance: 2.2,
  },
  { make: () => makeTower(8.5, 2.0), x: 5.6, z: -3.6, clearance: 2.0 },
  { make: () => makeSpire(7.5, 1.3), x: -4.6, z: -5.2, clearance: 1.6 },
  { make: () => makeSpire(8.5, 1.4), x: 2.4, z: -6.6, clearance: 1.7 },
  { make: () => makeSpire(6.5, 1.2), x: -6.8, z: -0.8, clearance: 1.5 },
];

function snowyFir(height: number): THREE.Group {
  const g = new THREE.Group();
  const trunk = new THREE.Mesh(
    new THREE.CylinderGeometry(0.12, 0.16, 0.5, 6),
    new THREE.MeshStandardMaterial({ color: 0x5a3a22, roughness: 0.9 }),
  );
  trunk.position.y = 0.25;
  g.add(trunk);
  for (let i = 0; i < 3; i++) {
    const t = i / 3;
    const r = (1 - t) * 0.7 + 0.25;
    const cone = new THREE.Mesh(
      new THREE.ConeGeometry(r, height / 3 + 0.4, 7),
      MAT.tree(),
    );
    cone.position.y = 0.5 + i * (height / 3.4) + 0.3;
    g.add(cone);
    const snow = new THREE.Mesh(
      new THREE.ConeGeometry(r * 1.02, (height / 3 + 0.4) * 0.3, 7),
      MAT.snow(),
    );
    snow.position.y = cone.position.y + (height / 3 + 0.4) * 0.32;
    g.add(snow);
  }
  return g;
}

function streetLamp(): { group: THREE.Group; mat: THREE.MeshStandardMaterial } {
  const g = new THREE.Group();
  const post = new THREE.Mesh(
    new THREE.CylinderGeometry(0.06, 0.08, 1.8, 8),
    new THREE.MeshStandardMaterial({
      color: 0x2a2a30,
      roughness: 0.6,
      metalness: 0.4,
    }),
  );
  post.position.y = 0.9;
  g.add(post);
  const lampMat = new THREE.MeshStandardMaterial({
    color: 0xffdf9e,
    emissive: new THREE.Color(0xffdf9e),
    emissiveIntensity: 1.6,
  });
  const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.13, 10, 10), lampMat);
  lamp.position.y = 1.85;
  g.add(lamp);
  return { group: g, mat: lampMat };
}

export function createCity(scene: THREE.Scene): City {
  const city = new THREE.Group();
  const twinklers: Twinkler[] = [];
  const occupied: Footprint[] = HEROES.map((h) => ({
    x: h.x,
    z: h.z,
    r: h.clearance,
  }));

  const tooClose = (x: number, z: number, r: number): boolean =>
    occupied.some((o) => Math.hypot(o.x - x, o.z - z) < o.r + r);

  // ---- Hero landmarks -----------------------------------------------------
  for (const hero of HEROES) {
    const obj = hero.make();
    obj.position.set(hero.x, 0, hero.z);
    faceCentre(obj);
    city.add(obj);
  }

  // ---- Christmas tree in a square near the front --------------------------
  const tree = makeChristmasTree(4.2);
  tree.group.position.set(3.4, 0, 4.8);
  city.add(tree.group);
  twinklers.push(...tree.lights);
  occupied.push({ x: 3.4, z: 4.8, r: 2.4 });

  // ---- Festive shop ring (fronts facing inward) ---------------------------
  const shopCount = quality.mobile ? 14 : 20;
  let msg = 0;
  for (let i = 0; i < shopCount; i++) {
    const a = (i / shopCount) * TAU + 0.15;
    if (inAvenue(a)) {
      continue; // keep the opening street view clear
    }
    const radius = CITY_RADIUS - 0.6 + (i % 2) * 0.5;
    const x = Math.cos(a) * radius;
    const z = Math.sin(a) * radius;
    const width = 1.9 + Math.random() * 1.1;
    if (tooClose(x, z, width * 0.6)) {
      continue;
    }
    const tex = createSignTexture(
      FESTIVE_MESSAGES[msg % FESTIVE_MESSAGES.length] as string,
      msg,
    );
    msg++;
    const shop = makeShop(width, tex, i);
    shop.position.set(x, 0, z);
    faceCentre(shop);
    city.add(shop);
    occupied.push({ x, z, r: width * 0.5 });
  }

  // ---- Mid-ring townhouses filling the gaps -------------------------------
  const houseCount = quality.mobile ? 10 : 16;
  for (let i = 0; i < houseCount; i++) {
    const a = (i / houseCount) * TAU + 0.4;
    if (inAvenue(a)) {
      continue;
    }
    const radius = CITY_RADIUS * 0.62 + (i % 3) * 0.6;
    const x = Math.cos(a) * radius;
    const z = Math.sin(a) * radius;
    const width = 1.6 + Math.random() * 0.8;
    if (tooClose(x, z, width * 0.7)) {
      continue;
    }
    const house = makeTownhouse(width, 2.6 + Math.random() * 1.6);
    house.position.set(x, 0, z);
    faceCentre(house);
    city.add(house);
    occupied.push({ x, z, r: width * 0.55 });
  }

  // ---- Scatter firs + lamps for atmosphere --------------------------------
  const decoCount = quality.mobile ? 10 : 18;
  for (let i = 0; i < decoCount; i++) {
    const a = Math.random() * TAU;
    const radius = 3.6 + Math.random() * (CITY_RADIUS - 4);
    if (inAvenue(a) && radius > 3.5) {
      continue; // don't clutter the avenue
    }
    const x = Math.cos(a) * radius;
    const z = Math.sin(a) * radius;
    if (tooClose(x, z, 0.9)) {
      continue;
    }
    if (Math.random() > 0.45) {
      const fir = snowyFir(1.6 + Math.random());
      fir.position.set(x, 0, z);
      city.add(fir);
    } else {
      const lamp = streetLamp();
      lamp.group.position.set(x, 0, z);
      city.add(lamp.group);
      twinklers.push({
        mat: lamp.mat,
        phase: Math.random() * TAU,
        base: 1.6,
        flicker: 0.15,
      });
    }
    occupied.push({ x, z, r: 0.8 });
  }

  scene.add(city);

  function update(_dt: number, t: number): void {
    for (const l of twinklers) {
      const amp = l.flicker ?? 0.5;
      l.mat.emissiveIntensity = l.base + Math.sin(t * 3 + l.phase) * amp;
    }
  }

  return { city, update };
}
