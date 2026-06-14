import * as THREE from "three";

// Generic festive greetings shown on the shopfront signs. Edit this list to
// change the messages — each shop pulls one in turn.
export const FESTIVE_MESSAGES = [
  "Merry Christmas",
  "Season's Greetings",
  "Happy Holidays",
  "Joy & Peace",
  "Warm Wishes",
  "Let it Snow",
  "Happy New Year",
  "Comfort & Joy",
  "Be Merry",
  "Frohe Weihnachten",
];

const SIGN_BG = ["#6a2330", "#244a35", "#2a3a66", "#7a4410", "#4a2350"];

// Renders a festive shop sign to a canvas texture. Width:height ~ 4:1.
export function createSignTexture(
  message: string,
  index = 0,
): THREE.CanvasTexture {
  const w = 512;
  const h = 128;
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  const ctx = c.getContext("2d");
  if (!ctx) {
    throw new Error("2D canvas context unavailable");
  }

  // Background board
  ctx.fillStyle = SIGN_BG[index % SIGN_BG.length] as string;
  ctx.fillRect(0, 0, w, h);

  // Gold border
  ctx.strokeStyle = "#d9b25a";
  ctx.lineWidth = 8;
  ctx.strokeRect(10, 10, w - 20, h - 20);

  // Little holly dots in the corners
  ctx.fillStyle = "#c8443a";
  for (const [x, y] of [
    [28, 28],
    [w - 28, 28],
    [28, h - 28],
    [w - 28, h - 28],
  ] as const) {
    ctx.beginPath();
    ctx.arc(x, y, 6, 0, Math.PI * 2);
    ctx.fill();
  }

  // Message text
  ctx.fillStyle = "#fff6e0";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  let fontSize = 58;
  ctx.font = `700 ${fontSize}px "Segoe UI", Georgia, serif`;
  while (ctx.measureText(message).width > w - 70 && fontSize > 22) {
    fontSize -= 2;
    ctx.font = `700 ${fontSize}px "Segoe UI", Georgia, serif`;
  }
  ctx.shadowColor = "rgba(0,0,0,0.4)";
  ctx.shadowBlur = 6;
  ctx.fillText(message, w / 2, h / 2 + 2);

  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
}
