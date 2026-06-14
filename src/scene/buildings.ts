import * as THREE from "three";
import { quality } from "../util/device";
import { MAT } from "./materials";

// A light whose emissive intensity the render loop animates (tree bulbs, lamps).
export interface Twinkler {
  mat: THREE.MeshStandardMaterial;
  phase: number;
  base: number;
  flicker?: number;
}

// All builders return a THREE.Group whose origin sits on the ground (y = 0),
// facing +Z (the "front"). The city orients each one to face the centre.

const box = (
  w: number,
  h: number,
  d: number,
  mat: THREE.Material,
): THREE.Mesh => new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);

function shadowed<T extends THREE.Mesh>(mesh: T): T {
  if (quality.shadows) {
    mesh.castShadow = true;
    mesh.receiveShadow = true;
  }
  return mesh;
}

// Snow-laden gable roof (white) with a slate fascia under the eaves.
function gableRoof(w: number, d: number, roofH: number): THREE.Group {
  const g = new THREE.Group();
  const shape = new THREE.Shape();
  shape.moveTo(-w / 2, 0);
  shape.lineTo(w / 2, 0);
  shape.lineTo(0, roofH);
  shape.lineTo(-w / 2, 0);
  const geo = new THREE.ExtrudeGeometry(shape, {
    depth: d,
    bevelEnabled: false,
  });
  geo.translate(0, 0, -d / 2);
  const roof = shadowed(new THREE.Mesh(geo, MAT.snow()));
  g.add(roof);
  const fascia = shadowed(box(w * 1.04, 0.12, d * 1.04, MAT.roofSlate()));
  fascia.position.y = 0.02;
  g.add(fascia);
  return g;
}

interface WindowOpts {
  w: number;
  baseY?: number;
  rows?: number;
  cols?: number;
  depth: number;
}

// A grid of warm glowing windows on the +Z facade.
function addWindows(parent: THREE.Object3D, opts: WindowOpts): void {
  const { w, baseY = 0.9, rows = 2, cols = 3, depth } = opts;
  const winW = Math.min(0.5, (w * 0.7) / cols);
  const winH = 0.55;
  const gapX = (w * 0.86) / cols;
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const lit = Math.random() > 0.25;
      const m = box(winW, winH, 0.06, lit ? MAT.window() : MAT.stoneGrey());
      m.position.set(
        -((cols - 1) / 2) * gapX + c * gapX,
        baseY + r * (winH + 0.5),
        depth / 2 + 0.01,
      );
      parent.add(m);
    }
  }
}

export function makeShop(
  width: number,
  signTexture: THREE.Texture,
  msgIndex: number,
): THREE.Group {
  const g = new THREE.Group();
  const depth = width * 0.82;
  const groundH = 1.5;
  const upperH = 1.7;

  // Ground floor (shopfront)
  const ground = shadowed(box(width, groundH, depth, MAT.stoneLight()));
  ground.position.y = groundH / 2;
  g.add(ground);

  // Big shop window + door
  const shopWin = box(width * 0.5, 0.95, 0.06, MAT.window());
  shopWin.position.set(-width * 0.15, 0.85, depth / 2 + 0.01);
  g.add(shopWin);
  const door = box(
    width * 0.22,
    1.1,
    0.08,
    Math.random() > 0.5 ? MAT.doorGreen() : MAT.doorRed(),
  );
  door.position.set(width * 0.28, 0.55, depth / 2 + 0.02);
  g.add(door);

  // Festive sign board above the shopfront
  const signFace = new THREE.MeshStandardMaterial({
    map: signTexture,
    emissive: new THREE.Color(0xffffff),
    emissiveMap: signTexture,
    emissiveIntensity: 0.35,
    roughness: 0.6,
  });
  const sign = new THREE.Mesh(new THREE.BoxGeometry(width * 0.9, 0.5, 0.08), [
    MAT.doorRed(),
    MAT.doorRed(),
    MAT.doorRed(),
    MAT.doorRed(),
    signFace,
    MAT.doorRed(),
  ]);
  sign.position.set(0, groundH + 0.05, depth / 2 + 0.04);
  g.add(sign);

  // Upper floor
  const upper = shadowed(box(width, upperH, depth, MAT.stoneWarm()));
  upper.position.y = groundH + 0.3 + upperH / 2;
  g.add(upper);
  const upperGroup = new THREE.Group();
  upperGroup.position.y = groundH + 0.3;
  addWindows(upperGroup, {
    w: width,
    baseY: 0.45,
    rows: 1,
    cols: width > 2.4 ? 3 : 2,
    depth,
  });
  g.add(upperGroup);

  // Roof
  const roof = gableRoof(width * 1.04, depth * 1.04, 1.0);
  roof.position.y = groundH + 0.3 + upperH;
  g.add(roof);

  void msgIndex;
  return g;
}

export function makeTownhouse(width: number, height: number): THREE.Group {
  const g = new THREE.Group();
  const depth = width * 0.85;
  const body = shadowed(
    box(
      width,
      height,
      depth,
      Math.random() > 0.5 ? MAT.stoneLight() : MAT.stoneWarm(),
    ),
  );
  body.position.y = height / 2;
  g.add(body);
  addWindows(g, {
    w: width,
    baseY: 0.9,
    rows: Math.max(2, Math.round(height / 1.6)),
    cols: 2,
    depth,
  });
  const door = box(width * 0.26, 1.0, 0.08, MAT.doorGreen());
  door.position.set(0, 0.5, depth / 2 + 0.02);
  g.add(door);
  const roof = gableRoof(width * 1.05, depth * 1.05, width * 0.55);
  roof.position.y = height;
  g.add(roof);
  return g;
}

// Square stone tower with crenellations + corner pinnacles (Carfax / college).
export function makeTower(
  height: number,
  width = 2.4,
  opts: { clock?: boolean } = {},
): THREE.Group {
  const g = new THREE.Group();
  const body = shadowed(box(width, height, width, MAT.stoneLight()));
  body.position.y = height / 2;
  g.add(body);

  // Lit belfry windows near the top
  for (let side = 0; side < 4; side++) {
    const win = box(width * 0.22, 0.9, 0.06, MAT.window());
    const a = (side * Math.PI) / 2;
    win.position.set(
      Math.sin(a) * (width / 2 + 0.01),
      height - 1.4,
      Math.cos(a) * (width / 2 + 0.01),
    );
    win.rotation.y = a;
    g.add(win);
  }

  // Clock face on the front
  if (opts.clock) {
    const clock = new THREE.Mesh(
      new THREE.CircleGeometry(width * 0.22, 24),
      new THREE.MeshStandardMaterial({
        color: 0xf4ecd6,
        emissive: new THREE.Color(0x332b14),
        emissiveIntensity: 0.3,
      }),
    );
    clock.position.set(0, height - 0.7, width / 2 + 0.02);
    g.add(clock);
  }

  // Crenellated parapet
  const crenCount = 4;
  for (let s = 0; s < 4; s++) {
    const a = (s * Math.PI) / 2;
    for (let i = 0; i < crenCount; i++) {
      const t = (i + 0.5) / crenCount - 0.5;
      const cren = shadowed(
        box((width / crenCount) * 0.7, 0.45, 0.3, MAT.stoneGrey()),
      );
      cren.position.set(
        Math.sin(a) * (width / 2) + Math.cos(a) * t * width,
        height + 0.22,
        Math.cos(a) * (width / 2) - Math.sin(a) * t * width,
      );
      cren.rotation.y = a;
      g.add(cren);
    }
  }

  // Corner pinnacles
  for (const [sx, sz] of [
    [-1, -1],
    [1, -1],
    [-1, 1],
    [1, 1],
  ] as const) {
    const pin = new THREE.Group();
    const shaft = shadowed(box(0.32, 1.0, 0.32, MAT.stoneGrey()));
    shaft.position.y = 0.5;
    pin.add(shaft);
    const tip = shadowed(
      new THREE.Mesh(new THREE.ConeGeometry(0.26, 0.7, 4), MAT.stoneGrey()),
    );
    tip.position.y = 1.35;
    tip.rotation.y = Math.PI / 4;
    pin.add(tip);
    pin.position.set(sx * width * 0.5, height, sz * width * 0.5);
    g.add(pin);
  }

  return g;
}

// A slender "dreaming spire": a thin tower capped by a tall octagonal spire.
export function makeSpire(height: number, width = 1.4): THREE.Group {
  const g = new THREE.Group();
  const towerH = height * 0.55;
  const body = shadowed(box(width, towerH, width, MAT.stoneLight()));
  body.position.y = towerH / 2;
  g.add(body);
  for (let side = 0; side < 4; side++) {
    const win = box(width * 0.3, 0.7, 0.05, MAT.window());
    const a = (side * Math.PI) / 2;
    win.position.set(
      Math.sin(a) * (width / 2 + 0.01),
      towerH - 0.7,
      Math.cos(a) * (width / 2 + 0.01),
    );
    win.rotation.y = a;
    g.add(win);
  }
  const spire = shadowed(
    new THREE.Mesh(
      new THREE.ConeGeometry(width * 0.72, height * 0.55, 8),
      MAT.snow(),
    ),
  );
  spire.position.y = towerH + height * 0.275;
  g.add(spire);
  // Little corner pinnacles around the spire base
  for (const [sx, sz] of [
    [-1, -1],
    [1, -1],
    [-1, 1],
    [1, 1],
  ] as const) {
    const pin = new THREE.Mesh(
      new THREE.ConeGeometry(0.18, 0.8, 6),
      MAT.stoneGrey(),
    );
    pin.position.set(sx * width * 0.5, towerH + 0.4, sz * width * 0.5);
    g.add(pin);
  }
  const finial = new THREE.Mesh(
    new THREE.SphereGeometry(0.12, 8, 8),
    MAT.gold(),
  );
  finial.position.y = towerH + height * 0.55;
  g.add(finial);
  return g;
}

// Oxford's hero landmark: the Radcliffe Camera rotunda.
export function makeRadcliffeCamera(): THREE.Group {
  const g = new THREE.Group();
  const r = 2.6;

  // Rusticated square base
  const base = shadowed(
    new THREE.Mesh(
      new THREE.CylinderGeometry(r * 1.05, r * 1.1, 1.6, 16),
      MAT.stoneWarm(),
    ),
  );
  base.position.y = 0.8;
  g.add(base);

  // Columned drum
  const drumH = 3.2;
  const drum = shadowed(
    new THREE.Mesh(
      new THREE.CylinderGeometry(r, r, drumH, 32),
      MAT.stoneLight(),
    ),
  );
  drum.position.y = 1.6 + drumH / 2;
  g.add(drum);

  // Engaged columns + lit windows around the drum
  const cols = 16;
  for (let i = 0; i < cols; i++) {
    const a = (i / cols) * Math.PI * 2;
    const col = new THREE.Mesh(
      new THREE.CylinderGeometry(0.22, 0.22, drumH * 0.92, 8),
      MAT.stoneGrey(),
    );
    col.position.set(
      Math.cos(a) * (r + 0.05),
      1.6 + drumH / 2,
      Math.sin(a) * (r + 0.05),
    );
    g.add(col);
    if (i % 2 === 0) {
      const win = new THREE.Mesh(
        new THREE.PlaneGeometry(0.5, 1.4),
        MAT.window(),
      );
      win.position.set(
        Math.cos(a) * (r + 0.02),
        1.6 + drumH / 2,
        Math.sin(a) * (r + 0.02),
      );
      win.lookAt(win.position.x * 3, win.position.y, win.position.z * 3);
      g.add(win);
    }
  }

  // Balustrade ring
  const balustrade = new THREE.Mesh(
    new THREE.TorusGeometry(r + 0.1, 0.12, 8, 32),
    MAT.stoneGrey(),
  );
  balustrade.rotation.x = Math.PI / 2;
  balustrade.position.y = 1.6 + drumH;
  g.add(balustrade);

  // Dome
  const dome = shadowed(
    new THREE.Mesh(
      new THREE.SphereGeometry(
        r * 0.92,
        32,
        20,
        0,
        Math.PI * 2,
        0,
        Math.PI / 2,
      ),
      MAT.snow(),
    ),
  );
  dome.position.y = 1.6 + drumH;
  g.add(dome);

  // Lantern + finial
  const lantern = new THREE.Mesh(
    new THREE.CylinderGeometry(0.5, 0.6, 1.0, 12),
    MAT.stoneLight(),
  );
  lantern.position.y = 1.6 + drumH + r * 0.92 + 0.4;
  g.add(lantern);
  const cap = new THREE.Mesh(new THREE.ConeGeometry(0.55, 0.7, 12), MAT.snow());
  cap.position.y = lantern.position.y + 0.8;
  g.add(cap);
  const ball = new THREE.Mesh(
    new THREE.SphereGeometry(0.16, 10, 10),
    MAT.gold(),
  );
  ball.position.y = cap.position.y + 0.5;
  g.add(ball);

  return g;
}

// Christmas tree with a star and twinkling lights.
export function makeChristmasTree(height = 4): {
  group: THREE.Group;
  lights: Twinkler[];
} {
  const g = new THREE.Group();
  const trunk = box(
    0.4,
    0.8,
    0.4,
    new THREE.MeshStandardMaterial({ color: 0x5a3a22, roughness: 0.9 }),
  );
  trunk.position.y = 0.4;
  g.add(trunk);

  const tiers = 4;
  const lights: Twinkler[] = [];
  for (let i = 0; i < tiers; i++) {
    const t = i / tiers;
    const tierR = (1 - t) * 1.6 + 0.5;
    const tierH = height / tiers + 0.5;
    const cone = shadowed(
      new THREE.Mesh(new THREE.ConeGeometry(tierR, tierH, 8), MAT.tree()),
    );
    cone.position.y = 0.8 + i * (height / tiers) + tierH / 2 - 0.2;
    g.add(cone);
    // Snow dusting on each tier
    const snowCone = new THREE.Mesh(
      new THREE.ConeGeometry(tierR * 1.01, tierH * 0.3, 8),
      MAT.snow(),
    );
    snowCone.position.y = cone.position.y + tierH * 0.3;
    g.add(snowCone);
  }

  // Twinkling lights spiralled around the tree
  const lightCount = quality.mobile ? 22 : 40;
  const hues = [0xff5a4a, 0xffd24a, 0x4affa0, 0x4ab8ff, 0xff7adf];
  for (let i = 0; i < lightCount; i++) {
    const t = i / lightCount;
    const a = t * Math.PI * 8;
    const rad = (1 - t) * 1.7 + 0.3;
    const hue = hues[i % hues.length] as number;
    const mat = new THREE.MeshStandardMaterial({
      color: hue,
      emissive: new THREE.Color(hue),
      emissiveIntensity: 1.4,
    });
    const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.09, 8, 8), mat);
    bulb.position.set(
      Math.cos(a) * rad,
      1.0 + t * (height - 0.5),
      Math.sin(a) * rad,
    );
    g.add(bulb);
    lights.push({ mat, phase: Math.random() * Math.PI * 2, base: 1.4 });
  }

  // Star on top
  const starMat = new THREE.MeshStandardMaterial({
    color: 0xfff0a0,
    emissive: new THREE.Color(0xffe066),
    emissiveIntensity: 1.8,
  });
  const star = new THREE.Mesh(new THREE.OctahedronGeometry(0.32, 0), starMat);
  star.position.y = height + 0.7;
  star.scale.set(1, 1.5, 1);
  g.add(star);
  lights.push({ mat: starMat, phase: 0, base: 1.8 });

  return { group: g, lights };
}
