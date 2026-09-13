import * as THREE from "three";
import { quality } from "../util/device";
import {
  COTTAGE_DEPTH_RATIO,
  COTTAGE_ROOF_RATIO,
  HOUSE_DEPTH_RATIO,
  HOUSE_ROOF_RATIO,
  SHOP_DEPTH_RATIO,
} from "./layout";
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
//
// Builders that vary their walls or paintwork take the `variant` roll the
// layout made for that plot, so a given building looks the same on every
// visit rather than redecorating itself on each load.

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
  variant: number,
): THREE.Group {
  const g = new THREE.Group();
  const depth = width * SHOP_DEPTH_RATIO;
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
    variant > 0.5 ? MAT.doorGreen() : MAT.doorRed(),
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

  return g;
}

export function makeTownhouse(
  width: number,
  height: number,
  variant: number,
): THREE.Group {
  const g = new THREE.Group();
  const depth = width * HOUSE_DEPTH_RATIO;
  const body = shadowed(
    box(
      width,
      height,
      depth,
      variant > 0.5 ? MAT.stoneLight() : MAT.stoneWarm(),
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
  const roof = gableRoof(width * 1.05, depth * 1.05, width * HOUSE_ROOF_RATIO);
  roof.position.y = height;
  g.add(roof);
  return g;
}

// A squat cottage: one low storey under a steep snowy roof, with a dormer and
// a smoking chimney. The small, cheap building that fills the back lanes.
export function makeCottage(
  width: number,
  height: number,
  variant: number,
): THREE.Group {
  const g = new THREE.Group();
  const depth = width * COTTAGE_DEPTH_RATIO;
  const body = shadowed(
    box(
      width,
      height,
      depth,
      variant > 0.5 ? MAT.stoneWarm() : MAT.stoneGrey(),
    ),
  );
  body.position.y = height / 2;
  g.add(body);

  // One lit window either side of the door.
  for (const sx of [-1, 1] as const) {
    const win = box(width * 0.22, 0.45, 0.06, MAT.window());
    win.position.set(sx * width * 0.28, height * 0.55, depth / 2 + 0.01);
    g.add(win);
  }
  const door = box(width * 0.2, height * 0.62, 0.08, MAT.doorRed());
  door.position.set(0, height * 0.31, depth / 2 + 0.02);
  g.add(door);

  const roofH = width * COTTAGE_ROOF_RATIO;
  const roof = gableRoof(width * 1.08, depth * 1.08, roofH);
  roof.position.y = height;
  g.add(roof);

  // Dormer poking out of the roof, its window lit.
  const dormer = box(width * 0.3, roofH * 0.45, depth * 0.5, MAT.snow());
  dormer.position.set(0, height + roofH * 0.3, depth * 0.22);
  g.add(dormer);
  const dormerWin = box(width * 0.17, roofH * 0.24, 0.06, MAT.window());
  dormerWin.position.set(0, height + roofH * 0.3, depth * 0.47);
  g.add(dormerWin);

  // Chimney, capped with snow.
  const chimney = box(width * 0.16, roofH * 0.9, width * 0.16, MAT.roofSlate());
  chimney.position.set(-width * 0.3, height + roofH * 0.55, -depth * 0.2);
  g.add(chimney);
  const cap = box(width * 0.2, 0.1, width * 0.2, MAT.snow());
  cap.position.set(
    chimney.position.x,
    height + roofH * 1.0 + 0.05,
    chimney.position.z,
  );
  g.add(cap);
  return g;
}

// A Christmas-market stall: striped canopy, a counter and a warm bulb.
export function makeMarketStall(width: number): {
  group: THREE.Group;
  light: Twinkler;
} {
  const g = new THREE.Group();
  const depth = width * 0.84;
  const counterH = 0.85;

  const counter = shadowed(box(width, counterH, depth, MAT.timber()));
  counter.position.y = counterH / 2;
  g.add(counter);
  const top = box(width * 1.08, 0.08, depth * 1.12, MAT.stoneLight());
  top.position.y = counterH + 0.04;
  g.add(top);

  // Corner posts holding the canopy up.
  for (const sx of [-1, 1] as const) {
    for (const sz of [-1, 1] as const) {
      const post = box(0.07, 1.55, 0.07, MAT.timber());
      post.position.set(sx * width * 0.45, 0.78, sz * depth * 0.45);
      g.add(post);
    }
  }

  // Canopy in alternating stripes — cheaper and crisper than a texture.
  const stripes = 5;
  for (let i = 0; i < stripes; i++) {
    const stripe = box(
      (width * 1.15) / stripes,
      0.07,
      depth * 1.3,
      i % 2 === 0 ? MAT.canvasRed() : MAT.snow(),
    );
    stripe.position.set(
      (-(stripes - 1) / 2 + i) * ((width * 1.15) / stripes),
      1.6,
      0,
    );
    stripe.rotation.x = -0.18;
    g.add(stripe);
  }

  // Crates of wares on the counter.
  for (const sx of [-0.26, 0.24] as const) {
    const crate = box(width * 0.26, 0.2, depth * 0.4, MAT.timber());
    crate.position.set(sx * width, counterH + 0.18, 0);
    g.add(crate);
  }

  const bulbMat = new THREE.MeshStandardMaterial({
    color: 0xffd9a0,
    emissive: new THREE.Color(0xffd9a0),
    emissiveIntensity: 1.5,
  });
  const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.08, 8, 8), bulbMat);
  bulb.position.set(0, 1.45, depth * 0.4);
  g.add(bulb);

  return {
    group: g,
    light: {
      mat: bulbMat,
      phase: Math.random() * Math.PI * 2,
      base: 1.5,
      flicker: 0.2,
    },
  };
}

// A snowman, for the squares and the corners of the greens.
export function makeSnowman(): THREE.Group {
  const g = new THREE.Group();
  const snow = MAT.snow();
  for (const [y, r] of [
    [0.36, 0.36],
    [0.82, 0.27],
    [1.16, 0.19],
  ] as const) {
    const ball = shadowed(
      new THREE.Mesh(new THREE.SphereGeometry(r, 10, 8), snow),
    );
    ball.position.y = y;
    g.add(ball);
  }
  const hat = new THREE.Mesh(
    new THREE.CylinderGeometry(0.13, 0.13, 0.18, 10),
    MAT.coal(),
  );
  hat.position.y = 1.36;
  g.add(hat);
  const brim = new THREE.Mesh(
    new THREE.CylinderGeometry(0.22, 0.22, 0.03, 10),
    MAT.coal(),
  );
  brim.position.y = 1.28;
  g.add(brim);
  const nose = new THREE.Mesh(
    new THREE.ConeGeometry(0.05, 0.22, 6),
    MAT.carrot(),
  );
  nose.position.set(0, 1.16, 0.18);
  nose.rotation.x = Math.PI / 2;
  g.add(nose);
  const scarf = new THREE.Mesh(
    new THREE.TorusGeometry(0.2, 0.05, 6, 12),
    MAT.canvasRed(),
  );
  scarf.rotation.x = Math.PI / 2;
  scarf.position.y = 1.0;
  g.add(scarf);
  return g;
}

// A snow-laden fir. Kept slim: a fir as wide as a cottage never finds a gap in
// a packed street, and the layout sizes its footprint to match.
export function makeFir(height: number): THREE.Group {
  const g = new THREE.Group();
  const trunk = new THREE.Mesh(
    new THREE.CylinderGeometry(0.08, 0.11, 0.5, 6),
    MAT.timber(),
  );
  trunk.position.y = 0.25;
  g.add(trunk);
  for (let i = 0; i < 3; i++) {
    const t = i / 3;
    const r = (1 - t) * 0.42 + 0.16;
    const tierH = height / 3 + 0.4;
    const cone = shadowed(
      new THREE.Mesh(new THREE.ConeGeometry(r, tierH, 7), MAT.tree()),
    );
    cone.position.y = 0.5 + i * (height / 3.4) + 0.3;
    g.add(cone);
    const snow = new THREE.Mesh(
      new THREE.ConeGeometry(r * 1.02, tierH * 0.3, 7),
      MAT.snow(),
    );
    snow.position.y = cone.position.y + tierH * 0.32;
    g.add(snow);
  }
  return g;
}

// A street lamp with a warm bulb the render loop makes flicker.
export function makeStreetLamp(): { group: THREE.Group; light: Twinkler } {
  const g = new THREE.Group();
  const post = new THREE.Mesh(
    new THREE.CylinderGeometry(0.06, 0.08, 1.8, 8),
    MAT.roofSlate(),
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
  return {
    group: g,
    light: {
      mat: lampMat,
      phase: Math.random() * Math.PI * 2,
      base: 1.6,
      flicker: 0.15,
    },
  };
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
