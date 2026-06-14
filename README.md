# Oxford Snow Globe 🎄❄️

An interactive Christmas card: a snow globe of Oxford, UK that you can spin,
zoom, and shake. Built with [Vite](https://vitejs.dev/), [three.js](https://threejs.org/),
and [TypeScript](https://www.typescriptlang.org/) — a single static page, no backend.

## Run locally

```bash
npm install
npm run dev        # http://localhost:5173
npm run typecheck  # tsc --noEmit
```

## Build for sharing

```bash
npm run build    # outputs to dist/
npm run preview  # preview the production build locally
```

The contents of `dist/` are a fully static site — drop them on any static host.

### Deploy to Cloudflare Pages

```bash
npx wrangler pages deploy dist --project-name oxford-snow-globe
```

This gives you a shareable `https://oxford-snow-globe.pages.dev` URL.

## What's inside

- **Drag** to spin the globe (full 360° rotation), **scroll / pinch** to zoom.
- **Shake** button swirls the snow and jingles sleigh bells.
- **Zoom out / Go inside** toggles between a street-level view inside the globe
  and an aerial view of the whole globe on its base.
- **Sound** toggles a cosy looping music-box tune (off by default).
- It opens with a short fly-through from the aerial view down to the street.
- Warm bloom glow, a gradient starry sky, and twinkling lights set the mood.

All audio is **synthesised in-browser** with the Web Audio API — no asset files.

### Customising the festive messages

The shop signs cycle through the messages in
[`src/scene/signTexture.ts`](src/scene/signTexture.ts) — edit the
`FESTIVE_MESSAGES` array to change them.

### Project layout

```
src/
  main.ts              entry point + render loop + UI wiring
  cameraModes.ts       street ↔ aerial camera transitions
  scene/
    constants.ts       world dimensions (globe radius, ground, city size)
    sceneSetup.ts      renderer, camera, OrbitControls, fog
    lighting.ts        moonlight + warm festive glow
    sky.ts             gradient background + twinkling starfield
    postfx.ts          bloom post-processing (desktop only)
    Globe.ts           glass dome, snowy ground, decorative base
    Snow.ts            falling-snow particle system + shake swirl
    City.ts            places landmarks, shops, houses, trees, lamps
    buildings.ts       low-poly building factories (Radcliffe Camera, towers,
                       spires, shops, townhouses, Christmas tree)
    materials.ts       shared low-poly material palette
    signTexture.ts     canvas-rendered festive shop signs
  audio/
    AudioManager.ts    Web Audio music-box loop + sleigh-bell SFX
  util/
    device.ts          mobile detection + adaptive quality profile
    tween.ts           tiny easing/tween helper
```

Quality (snow count, shadows, antialiasing, glass material) adapts
automatically between mobile and desktop — see `src/util/device.ts`.
