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

// Usable city radius (kept inside the sphere so nothing clips the glass).
export const CITY_RADIUS = GROUND_RADIUS - 1.4;

// Tallest the city is allowed to reach before the glass curves in.
export const CITY_MAX_HEIGHT = GLOBE_CENTER_Y + GLOBE_RADIUS - 1.5;

export const COLORS = {
  sky: 0x0b1026,
  fog: 0x0e1430,
  snow: 0xf3f7ff,
  glass: 0xbfe3ff,
} as const;
