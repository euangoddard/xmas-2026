import { Timer } from "three";
import { createAudio } from "./audio/AudioManager";
import { createCameraModes } from "./cameraModes";
import { createCity } from "./scene/City";
import { createGlobe } from "./scene/Globe";
import { createLighting } from "./scene/lighting";
import { createPostFX } from "./scene/postfx";
import { createSnow } from "./scene/Snow";
import { createScene } from "./scene/sceneSetup";
import { createSky } from "./scene/sky";
import { quality } from "./util/device";

const canvas = document.getElementById("scene") as HTMLCanvasElement;
const { renderer, scene, camera, controls } = createScene(canvas);

createLighting(scene);
createGlobe(scene);
const sky = createSky(scene, quality.mobile);
const snow = createSnow(scene);
const city = createCity(scene);
const postfx = createPostFX(renderer, scene, camera);
const cameraModes = createCameraModes(camera, controls);
const audio = createAudio();

window.addEventListener("resize", () =>
  postfx.setSize(window.innerWidth, window.innerHeight),
);

// ---- UI wiring ------------------------------------------------------------
const loading = document.getElementById("loading") as HTMLElement;
const title = document.getElementById("title") as HTMLElement;
const controlsHud = document.getElementById("controls") as HTMLElement;
const hint = document.getElementById("hint") as HTMLElement;
const shakeBtn = document.getElementById("shake") as HTMLElement;
const viewBtn = document.getElementById("view") as HTMLElement;
const viewLabel = viewBtn.querySelector<HTMLElement>(
  ".btn__label",
) as HTMLElement;
const soundBtn = document.getElementById("sound") as HTMLElement;
const soundIcon = soundBtn.querySelector<HTMLElement>(
  ".btn__icon",
) as HTMLElement;
const soundLabel = soundBtn.querySelector<HTMLElement>(
  ".btn__label",
) as HTMLElement;

shakeBtn.addEventListener("click", () => {
  snow.shake();
  audio.playBells();
});
viewBtn.addEventListener("click", () => {
  viewLabel.textContent = cameraModes.toggle();
});
soundBtn.addEventListener("click", () => {
  const muted = audio.toggleMute();
  soundIcon.textContent = muted ? "🔇" : "🔊";
  soundLabel.textContent = muted ? "Sound off" : "Sound on";
  soundBtn.setAttribute("aria-pressed", String(!muted));
});

// Stop the idle auto-rotate as soon as the viewer takes control.
controls.addEventListener("start", () => {
  controls.autoRotate = false;
});

function revealUI(): void {
  loading.classList.add("hidden");
  for (const el of [title, controlsHud, hint]) {
    el.hidden = false;
  }
  // A welcoming first impression: start pulled back, then drift inside.
  cameraModes.goTo("aerial");
  window.setTimeout(() => {
    cameraModes.goTo("street");
    viewLabel.textContent = cameraModes.nextLabel();
  }, 2600);
  // Auto-hide the drag hint after a while.
  window.setTimeout(() => {
    hint.style.opacity = "0";
  }, 8000);
}

// ---- Render loop ----------------------------------------------------------
const timer = new Timer();
let revealed = false;
let frames = 0;

function animate(): void {
  requestAnimationFrame(animate);
  timer.update();
  const dt = Math.min(timer.getDelta(), 0.05);
  const t = timer.getElapsed();

  snow.update(dt);
  city.update(dt, t);
  sky.update(t);
  controls.update();
  postfx.render();

  // Reveal once a couple of frames have rendered (textures/glass warmed up).
  if (!revealed && ++frames > 3) {
    revealed = true;
    revealUI();
  }
}
animate();
