// Shared world dimensions. Everything is built to fit inside the globe so the
// camera can move from street level out to a view of the whole globe on its base.
//
// Coordinate system: the snowy ground sits at y = 0 and the city is built
// upward from there. The glass sphere's centre is slightly above ground so the
// ground is a chord across the lower third of the sphere (as in a real snow
// globe), leaving plenty of headroom for spires.

export const GLOBE_RADIUS = 10; // glass sphere radius
export const GROUND_Y = 0; // snowy ground plane
export const GLOBE_CENTER_Y = 3.2; // sphere centre, above the ground chord

// Radius of the visible snow disc where the ground chord meets the sphere.
export const GROUND_RADIUS = Math.sqrt(GLOBE_RADIUS ** 2 - GLOBE_CENTER_Y ** 2);

// Breathing room kept between the city and the glass / the edge of the snow.
const CLEARANCE = 0.35;

// The glass curves in overhead, so how far out a building may stand depends on
// how tall it is: the binding constraint is its top outer corner touching the
// sphere. Anything shorter than the sphere's centre is limited instead by the
// edge of the snow disc.
export function maxFootprintRadius(height: number): number {
  const shell = GLOBE_RADIUS - CLEARANCE;
  const reach = Math.sqrt(
    Math.max(0, shell ** 2 - (height - GLOBE_CENTER_Y) ** 2),
  );
  return Math.min(reach, GROUND_RADIUS - CLEARANCE);
}

// Height of the snow at a point. The ground is a gently domed, rippled disc
// rather than a flat plane, so anything standing on it has to be lifted to
// match or it sinks into (or floats above) the snow.
export function groundHeightAt(x: number, z: number): number {
  const r = Math.min(Math.hypot(x, z), GROUND_RADIUS);
  const ripple = Math.sin(x * 0.5) * Math.cos(z * 0.5) * 0.18;
  const dome = (1 - (r / GROUND_RADIUS) ** 2) * 0.5;
  return ripple + dome;
}

export const COLORS = {
  sky: 0x0b1026,
  fog: 0x0e1430,
  snow: 0xf3f7ff,
  glass: 0xbfe3ff,
} as const;
