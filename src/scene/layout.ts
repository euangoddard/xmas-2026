// Plans where everything in the city stands.
//
// This module is deliberately free of three.js: it reasons only about
// footprints on the snow, which makes the packing cheap to test and lets it be
// far more aggressive than a fixed "place N things, skip on a clash" loop.
// Terraces are packed around rings by arc length, so each building consumes
// only the frontage it needs and the next one starts where it ends; anything
// that won't fit edges along and tries again rather than being thrown away.

import { maxFootprintRadius } from "./constants";

const TAU = Math.PI * 2;

export type PlacementKind =
  | "radcliffe"
  | "tower"
  | "spire"
  | "shop"
  | "townhouse"
  | "cottage"
  | "tree"
  | "stall"
  | "fir"
  | "lamp"
  | "snowman";

export interface Placement {
  kind: PlacementKind;
  x: number;
  z: number;
  rotation: number;
  /** Frontage, as handed to the mesh builder. */
  width: number;
  /** Builder-facing height: body height for houses, tower height for towers. */
  height: number;
  /** Deterministic 0..1 roll so each building varies, but always the same way. */
  variant: number;
  /** Only set for the clock tower, which its builder needs to know about. */
  clock?: boolean;
}

// Footprint and silhouette ratios, mirrored by the builders in buildings.ts so
// the packer reasons about exactly the volumes that get built.
export const SHOP_DEPTH_RATIO = 0.82;
export const SHOP_HEIGHT = 4.5;
export const HOUSE_DEPTH_RATIO = 0.85;
export const HOUSE_ROOF_RATIO = 0.55;
export const COTTAGE_DEPTH_RATIO = 0.95;
export const COTTAGE_ROOF_RATIO = 0.6;

// How deep a given frontage builds. The ring packer needs this to line the
// fronts up on a street even though the buildings vary in size.
function depthOf(kind: PlacementKind, width: number): number {
  switch (kind) {
    case "shop":
      return width * SHOP_DEPTH_RATIO;
    case "townhouse":
      return width * HOUSE_DEPTH_RATIO;
    case "cottage":
      return width * COTTAGE_DEPTH_RATIO;
    default:
      return width;
  }
}

// ---- Footprints -----------------------------------------------------------

interface Common {
  x: number;
  z: number;
  /** Clearance this shape wants from its neighbours (the larger side wins). */
  pad: number;
}
interface Box extends Common {
  round: false;
  hw: number; // half frontage (local X)
  hd: number; // half depth (local Z)
  rot: number;
}
interface Disc extends Common {
  round: true;
  r: number;
}
type Footprint = Box | Disc;

interface Volume {
  shape: Footprint;
  /** Height of the highest point over that footprint, for the glass check. */
  top: number;
}

// World direction of a box's local +X and +Z axes.
const axisX = (b: Box): [number, number] => [Math.cos(b.rot), -Math.sin(b.rot)];
const axisZ = (b: Box): [number, number] => [Math.sin(b.rot), Math.cos(b.rot)];

// Half-extent of a box projected onto a unit axis.
function extent(b: Box, ax: number, az: number): number {
  const [ux, uz] = axisX(b);
  const [vx, vz] = axisZ(b);
  return (
    Math.abs(b.hw * (ax * ux + az * uz)) + Math.abs(b.hd * (ax * vx + az * vz))
  );
}

// Separating-axis test for two oriented rectangles.
function boxesOverlap(a: Box, b: Box, pad: number): boolean {
  const dx = b.x - a.x;
  const dz = b.z - a.z;
  for (const [ax, az] of [axisX(a), axisZ(a), axisX(b), axisZ(b)]) {
    if (
      Math.abs(dx * ax + dz * az) >
      extent(a, ax, az) + extent(b, ax, az) + pad
    ) {
      return false;
    }
  }
  return true;
}

// Distance from a disc's centre to the nearest point of a box.
function discToBox(d: Disc, b: Box): number {
  const dx = d.x - b.x;
  const dz = d.z - b.z;
  const [ux, uz] = axisX(b);
  const [vx, vz] = axisZ(b);
  const local = [dx * ux + dz * uz, dx * vx + dz * vz] as const;
  const clampedX = Math.max(-b.hw, Math.min(b.hw, local[0]));
  const clampedZ = Math.max(-b.hd, Math.min(b.hd, local[1]));
  return Math.hypot(local[0] - clampedX, local[1] - clampedZ);
}

function collides(a: Footprint, b: Footprint): boolean {
  // One shared clearance rather than the sum, so a fussy prop next to a wall
  // doesn't demand double the room.
  const pad = Math.max(a.pad, b.pad);
  if (a.round && b.round) {
    return Math.hypot(a.x - b.x, a.z - b.z) < a.r + b.r + pad;
  }
  if (a.round && !b.round) {
    return discToBox(a, b) < a.r + pad;
  }
  if (!a.round && b.round) {
    return discToBox(b, a) < b.r + pad;
  }
  return boxesOverlap(a as Box, b as Box, pad);
}

// Distance from the globe's axis to the furthest point of a footprint.
function outerReach(s: Footprint): number {
  if (s.round) {
    return Math.hypot(s.x, s.z) + s.r;
  }
  let max = 0;
  const [ux, uz] = axisX(s);
  const [vx, vz] = axisZ(s);
  for (const sx of [-1, 1]) {
    for (const sz of [-1, 1]) {
      const x = s.x + sx * s.hw * ux + sz * s.hd * vx;
      const z = s.z + sx * s.hw * uz + sz * s.hd * vz;
      max = Math.max(max, Math.hypot(x, z));
    }
  }
  return max;
}

// Everything in the city fronts onto the centre of the globe.
const faceCentre = (x: number, z: number): number => Math.atan2(-x, -z);

// Small deterministic PRNG, so the composition is the same on every visit and
// can be composed once rather than re-rolled in front of the viewer.
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ---- Shapes per kind ------------------------------------------------------

// The footprint and apex height each builder produces for a given size.
function shapeOf(
  kind: PlacementKind,
  x: number,
  z: number,
  rot: number,
  width: number,
  height: number,
): Volume {
  const boxed = (hw: number, hd: number, pad: number, top: number): Volume => ({
    shape: { round: false, x, z, hw, hd, rot, pad },
    top,
  });
  const disc = (r: number, pad: number, top: number): Volume => ({
    shape: { round: true, x, z, r, pad },
    top,
  });
  switch (kind) {
    case "shop":
      return boxed(
        width / 2,
        (width * SHOP_DEPTH_RATIO) / 2,
        0.05,
        SHOP_HEIGHT,
      );
    case "townhouse":
      return boxed(
        width / 2,
        (width * HOUSE_DEPTH_RATIO) / 2,
        0.05,
        height + width * HOUSE_ROOF_RATIO,
      );
    case "cottage":
      return boxed(
        width / 2,
        (width * COTTAGE_DEPTH_RATIO) / 2,
        0.05,
        height + width * COTTAGE_ROOF_RATIO + 0.7,
      );
    case "radcliffe":
      // Round drum: the dome and lantern are all well inside this radius.
      return disc(2.95, 0.45, 10.3);
    case "tower":
      // Corner pinnacles stand proud of the shaft, hence the extra reach.
      return boxed(width / 2 + 0.2, width / 2 + 0.2, 0.3, height + 2.1);
    case "spire":
      return boxed(
        width / 2 + 0.15,
        width / 2 + 0.15,
        0.25,
        height * 1.1 + 0.2,
      );
    case "tree":
      return disc(2.0, 0.25, height + 1.1);
    case "stall":
      return boxed(width / 2, width * 0.42, 0.15, 2.3);
    case "fir":
      // Slim: a fir as wide as a cottage never finds a gap in a packed street.
      return disc(0.58, 0.12, height + 1.2);
    case "lamp":
      return disc(0.2, 0.3, 2.0);
    case "snowman":
      return disc(0.45, 0.25, 1.4);
  }
}

// ---- Planner --------------------------------------------------------------

class Plan {
  readonly placements: Placement[] = [];
  private readonly volumes: Volume[] = [];
  readonly rnd: () => number;

  constructor(seed: number) {
    this.rnd = mulberry32(seed);
  }

  range(lo: number, hi: number): number {
    return lo + this.rnd() * (hi - lo);
  }

  /** Reserve ground no building may take (the avenue down to the Camera). */
  reserve(shape: Footprint): void {
    this.volumes.push({ shape, top: 0 });
  }

  fits(v: Volume): boolean {
    if (outerReach(v.shape) > maxFootprintRadius(v.top)) {
      return false; // would push through the curve of the glass
    }
    return !this.volumes.some((other) => collides(v.shape, other.shape));
  }

  add(p: Placement, v: Volume): void {
    this.volumes.push(v);
    this.placements.push(p);
  }
}

interface PutOptions {
  rotation?: number;
  clock?: boolean;
}

function put(
  plan: Plan,
  kind: PlacementKind,
  x: number,
  z: number,
  width: number,
  height: number,
  opts: PutOptions = {},
): boolean {
  const rotation = opts.rotation ?? faceCentre(x, z);
  const volume = shapeOf(kind, x, z, rotation, width, height);
  if (!plan.fits(volume)) {
    return false;
  }
  plan.add(
    {
      kind,
      x,
      z,
      rotation,
      width,
      height,
      variant: plan.rnd(),
      ...(opts.clock === true ? { clock: true } : {}),
    },
    volume,
  );
  return true;
}

// Landmarks are placed by intent — "a spire out that way, about this tall" —
// and the planner walks them inward until they clear the glass and their
// neighbours. Tall things end up naturally closer to the middle, which is what
// the curve of the globe wants anyway.
function putLandmark(
  plan: Plan,
  kind: PlacementKind,
  angle: number,
  radius: number,
  width: number,
  height: number,
  opts: PutOptions = {},
): boolean {
  for (let step = 0; step < 14; step++) {
    const r = radius - step * 0.45;
    if (r < 1.2) {
      break;
    }
    // Alternate a small swing either side of the intended bearing so a blocked
    // landmark slides around an obstacle instead of only burrowing inward.
    for (const swing of [0, 0.12, -0.12, 0.24, -0.24]) {
      const a = angle + swing;
      if (
        put(plan, kind, Math.cos(a) * r, Math.sin(a) * r, width, height, opts)
      ) {
        return true;
      }
    }
  }
  return false;
}

interface RingSpec {
  /** Radius of the street line the frontages stand on. */
  front: number;
  /** How far a building may be set back off that line. */
  setback: number;
  minWidth: number;
  maxWidth: number;
  /** Gap between neighbouring frontages; near zero gives a solid terrace. */
  gap: [number, number];
  /** Weighted mix of what lines this ring. */
  mix: [PlacementKind, number][];
  startAngle: number;
  heightFor: (plan: Plan, kind: PlacementKind, width: number) => number;
}

// Walk once around a ring, consuming arc length building by building. Fronts
// are lined up on the street and the buildings grow backward from it, so a
// terrace of mixed sizes still reads as one frontage and the ring behind keeps
// its own band of ground. A plot that won't take (a landmark or the avenue is
// in the way) shuffles along by a doorway's width and tries again, so an
// obstacle costs a few feet of frontage rather than a whole slot.
function packRing(plan: Plan, spec: RingSpec): void {
  const total = spec.mix.reduce((sum, [, weight]) => sum + weight, 0);
  const pick = (): PlacementKind => {
    let roll = plan.rnd() * total;
    for (const [kind, weight] of spec.mix) {
      roll -= weight;
      if (roll <= 0) {
        return kind;
      }
    }
    return spec.mix[0]?.[0] ?? "shop";
  };

  let angle = spec.startAngle;
  const end = spec.startAngle + TAU;
  // Bounded so a pathological ring can't spin forever; ample for a full lap.
  for (let guard = 0; guard < 600 && angle < end; guard++) {
    const kind = pick();
    const full = plan.range(spec.minWidth, spec.maxWidth);
    const height = spec.heightFor(plan, kind, full);
    const gap = plan.range(spec.gap[0], spec.gap[1]);
    const setback = plan.rnd() * spec.setback;
    let step = 0;
    let placed = false;
    // A plot that is merely too wide gets tried again at a narrower frontage
    // before the packer gives up on it — half a shop is better than a hole.
    for (const shrink of [1, 0.82, 0.68]) {
      const width = Math.max(spec.minWidth * 0.72, full * shrink);
      const radius = spec.front + depthOf(kind, width) / 2 + setback;
      step = (width + gap) / radius;
      const a = angle + step / 2;
      placed = put(
        plan,
        kind,
        Math.cos(a) * radius,
        Math.sin(a) * radius,
        width,
        height,
      );
      if (placed) {
        break;
      }
    }
    angle += placed ? step : 0.3 / spec.front;
  }
}

// Dart-throwing infill: keep trying until the quota is met or attempts run out.
function scatter(
  plan: Plan,
  count: number,
  minRadius: number,
  maxRadius: number,
  make: (plan: Plan, x: number, z: number) => boolean,
): void {
  for (let i = 0, placed = 0; placed < count && i < count * 40; i++) {
    const a = plan.rnd() * TAU;
    // The square root keeps the scatter even per unit area rather than
    // bunching everything around the middle.
    const r = Math.sqrt(plan.range(minRadius ** 2, maxRadius ** 2));
    if (make(plan, Math.cos(a) * r, Math.sin(a) * r)) {
      placed++;
    }
  }
}

// Scatter a weighted mix of street furniture. Doing the types together rather
// than one after another stops whichever went first from taking every gap —
// lamp posts fit almost anywhere, so on their own they crowd out the firs.
function scatterProps(
  plan: Plan,
  count: number,
  minRadius: number,
  maxRadius: number,
  mix: [PlacementKind, number][],
): void {
  const total = mix.reduce((sum, [, weight]) => sum + weight, 0);
  scatter(plan, count, minRadius, maxRadius, (p, x, z) => {
    let roll = p.rnd() * total;
    for (const [kind, weight] of mix) {
      roll -= weight;
      if (roll <= 0) {
        const height = kind === "fir" ? p.range(1.5, 2.6) : 0;
        const width = kind === "stall" ? p.range(0.9, 1.3) : 0;
        return put(p, kind, x, z, width, height);
      }
    }
    return false;
  });
}

export interface LayoutOptions {
  /** Phones get a lighter city: fewer infill buildings and props. */
  mobile: boolean;
  seed?: number;
}

export function planCity(opts: LayoutOptions): Placement[] {
  const plan = new Plan(opts.seed ?? 0xc0ffee);
  const scale = opts.mobile ? 0.55 : 1;

  // The opening shot looks in along +Z from just inside the glass. Reserving a
  // boulevard there makes the terraces line a street rather than wall it off,
  // and runs the eye down it to the Radcliffe Camera. It tapers, because what
  // has to stay clear is a cone of sight, not a corridor — keeping it narrow
  // near the middle hands a good few plots back to the inner terrace.
  for (const [z, halfDepth, halfWidth] of [
    [4.3, 1.1, 1.15],
    [6.4, 1.1, 1.65],
    [8.5, 1.1, 2.15],
  ] as const) {
    plan.reserve({
      round: false,
      x: 0,
      z,
      hw: halfWidth,
      hd: halfDepth,
      rot: 0,
      pad: 0,
    });
  }

  // ---- Christmas market: a square punched out of the high street ----------
  const marketAngle = 0.75;
  const treeX = Math.cos(marketAngle) * 6.0;
  const treeZ = Math.sin(marketAngle) * 6.0;
  put(plan, "tree", treeX, treeZ, 0, 4.2);
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * TAU + 0.3;
    const r = 2.5 + (i % 2) * 0.45;
    put(
      plan,
      "stall",
      treeX + Math.cos(a) * r,
      treeZ + Math.sin(a) * r,
      plan.range(1.0, 1.4),
      2.0,
      // Stalls face the tree, not the middle of the globe.
      { rotation: Math.atan2(-Math.cos(a), -Math.sin(a)) },
    );
  }

  // ---- Hero landmarks, for the skyline ------------------------------------
  // The Camera stands at the head of the avenue. The rest go down next, out
  // among the terrace bands where they break up the roofline; the terraces are
  // packed afterwards and simply route around them.
  put(plan, "radcliffe", 0, -2.9, 5.9, 10.3);
  putLandmark(plan, "tower", 2.5, 5.9, 2.4, 7.2, { clock: true });
  putLandmark(plan, "tower", -0.55, 5.9, 2.0, 7.6);
  putLandmark(plan, "tower", 3.95, 6.0, 1.8, 5.4);
  putLandmark(plan, "spire", -2.25, 6.1, 1.3, 7.4);
  putLandmark(plan, "spire", -1.4, 6.1, 1.4, 7.8);
  putLandmark(plan, "spire", 3.35, 6.2, 1.2, 6.4);
  putLandmark(plan, "spire", 0.6, 6.2, 1.15, 5.8);
  putLandmark(plan, "spire", 1.95, 6.3, 1.1, 5.2);
  putLandmark(plan, "spire", -2.85, 6.3, 1.05, 5.0);
  putLandmark(plan, "spire", 4.6, 6.3, 1.0, 4.8);

  // ---- Terraces -----------------------------------------------------------
  // Three streets of frontage, near enough back to back. The bands are sized
  // so the backs of one terrace clear the fronts of the next even at full
  // width and full setback — overlap there costs a whole street of buildings,
  // which is most of what was going wrong before.
  const houseHeight = (p: Plan, kind: PlacementKind, width: number): number =>
    kind === "cottage" ? p.range(1.7, 2.3) : p.range(2.5, 3.1) + width * 0.35;

  // Outer high street: the shopfronts carrying the festive signs. Frontages
  // here are kept narrow so the terrace stays shallow: its backs have to stop
  // short of the glass and leave a lane for the street camera to orbit in,
  // and narrow shops buy that depth without giving up any frontage.
  packRing(plan, {
    front: 6.95,
    setback: 0.2,
    minWidth: 1.5,
    maxWidth: 2.05,
    gap: [0.04, 0.24],
    mix: [
      ["shop", 6],
      ["townhouse", 3],
    ],
    startAngle: 0.15,
    heightFor: houseHeight,
  });

  // Middle terrace, backing onto the high street.
  packRing(plan, {
    front: 4.9,
    setback: 0.2,
    minWidth: 1.5,
    maxWidth: 2.1,
    gap: [0.04, 0.26],
    mix: [
      ["townhouse", 5],
      ["shop", 3],
      ["cottage", 2],
    ],
    startAngle: 0.95,
    heightFor: houseHeight,
  });

  // Inner lane of low cottages, in the pocket the Camera leaves to the north.
  packRing(plan, {
    front: 3.25,
    setback: 0.15,
    minWidth: 1.3,
    maxWidth: 1.55,
    gap: [0.04, 0.2],
    mix: [
      ["cottage", 7],
      ["townhouse", 2],
    ],
    startAngle: 2.1,
    heightFor: houseHeight,
  });

  // ---- Backfill: laps of narrow infill close the leftover gaps ------------
  for (const front of [7.0, 4.95, 3.3, 7.05, 5.0, 6.9]) {
    packRing(plan, {
      front,
      setback: 0.35,
      minWidth: 1.15,
      maxWidth: 1.55,
      gap: [0.04, 0.14],
      mix: [
        ["cottage", 5],
        ["shop", 3],
        ["townhouse", 2],
      ],
      startAngle: front * 1.7,
      heightFor: houseHeight,
    });
  }

  // ---- Lamps down the avenue ----------------------------------------------
  // The reserved boulevard is bare ground, which reads as a bald patch from
  // the outside. Lining it with lamp posts dresses the street without putting
  // anything solid in the sightline.
  for (let i = 0; i < 6; i++) {
    const z = 3.9 + i * 1.15;
    // Follow the taper of the reserved corridor, a pavement's width outside it.
    const edge = 1.15 + (z - 3.2) * 0.16 + 0.42;
    for (const side of [-1, 1] as const) {
      put(plan, "lamp", side * edge, z, 0, 0);
    }
  }

  // ---- Radcliffe Square ---------------------------------------------------
  // The Camera sits off-centre, which leaves a pocket of open ground on its
  // north side — exactly what the opening shot looks down the avenue at. Fill
  // it with low things that populate the square without hiding the Camera.
  scatterProps(plan, Math.round(16 * scale), 1.4, 3.2, [
    ["stall", 4],
    ["fir", 3],
    ["lamp", 3],
    ["snowman", 2],
  ]);

  // ---- Infill: squeeze cottages into whatever ground is left --------------
  scatter(plan, Math.round(16 * scale), 3.0, 7.4, (p, x, z) =>
    put(p, "cottage", x, z, p.range(1.3, 1.9), p.range(1.7, 2.4)),
  );

  // ---- Street furniture through the rest of the city ----------------------
  scatterProps(plan, Math.round(26 * scale), 2.4, 8.9, [
    ["fir", 5],
    ["lamp", 3],
    ["snowman", 1],
  ]);

  return plan.placements;
}
