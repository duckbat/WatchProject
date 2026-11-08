'use client';

/**
 * Turns a catalog photo of a watch on a white background into a transparent, tightly cropped PNG, like a product
 * cut-out. The white background is removed by flood fill from the image border, so white dials and polished steel
 * inside the watch are kept. Photos load through /api/photo (same origin) because the image hosts send no CORS
 * headers. Returns null when the photo is not on a light background or anything fails; callers keep the original.
 */
const cache = new Map<string, Promise<string | null>>();

export function watchCutout(src: string): Promise<string | null> {
  if (!cache.has(src)) cache.set(src, makeCutout(src).catch(() => null));
  return cache.get(src)!;
}

const MAX_SIDE = 900;
// Background: light and nearly grey (white studio backdrop and the soft shadow edge around it).
const LIGHT = 228, GREY = 20;

async function makeCutout(src: string): Promise<string | null> {
  const img = new Image();
  img.decoding = 'async';
  img.src = `/api/photo?${new URLSearchParams({ url: src })}`;
  await img.decode();
  const scale = Math.min(1, MAX_SIDE / Math.max(img.naturalWidth, img.naturalHeight));
  const w = Math.round(img.naturalWidth * scale), h = Math.round(img.naturalHeight * scale);
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) return null;
  ctx.drawImage(img, 0, 0, w, h);
  const image = ctx.getImageData(0, 0, w, h), px = image.data;
  const isBackground = (p: number) => {
    const i = p * 4, r = px[i], g = px[i + 1], b = px[i + 2], a = px[i + 3];
    return a < 16 || (Math.min(r, g, b) > LIGHT && Math.max(r, g, b) - Math.min(r, g, b) < GREY);
  };

  // Flood fill from every border pixel that looks like background.
  const removed = new Uint8Array(w * h);
  const stack: number[] = [];
  for (let x = 0; x < w; x++) stack.push(x, (h - 1) * w + x);
  for (let y = 0; y < h; y++) stack.push(y * w, y * w + w - 1);
  let count = 0;
  while (stack.length) {
    const p = stack.pop()!;
    if (removed[p] || !isBackground(p)) continue;
    removed[p] = 1;
    count++;
    const x = p % w;
    if (x > 0) stack.push(p - 1);
    if (x < w - 1) stack.push(p + 1);
    if (p >= w) stack.push(p - w);
    if (p < w * (h - 1)) stack.push(p + w);
  }
  // Not a white-background photo (already a cut-out, or a lifestyle shot): keep the original.
  if (count < w * h * 0.08) return null;

  for (let p = 0; p < w * h; p++) {
    if (removed[p]) {
      px[p * 4 + 3] = 0;
      continue;
    }
    // Soften the cut edge: light pixels touching the removed background fade with their lightness.
    const x = p % w;
    const edge = (x > 0 && removed[p - 1]) || (x < w - 1 && removed[p + 1]) || (p >= w && removed[p - w]) || (p < w * (h - 1) && removed[p + w]);
    if (edge) {
      const i = p * 4, light = Math.min(px[i], px[i + 1], px[i + 2]);
      if (light > 200) px[i + 3] = Math.round((px[i + 3] * (255 - light)) / 55);
    }
  }
  ctx.putImageData(image, 0, 0);

  // Crop to the watch, with a small margin.
  let top = h, left = w, bottom = 0, right = 0;
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++)
      if (px[(y * w + x) * 4 + 3] > 24) {
        if (y < top) top = y;
        if (y > bottom) bottom = y;
        if (x < left) left = x;
        if (x > right) right = x;
      }
  if (bottom <= top || right <= left) return null;
  const margin = Math.round(Math.max(right - left, bottom - top) * 0.02);
  top = Math.max(0, top - margin);
  left = Math.max(0, left - margin);
  bottom = Math.min(h - 1, bottom + margin);
  right = Math.min(w - 1, right + margin);
  const out = document.createElement('canvas');
  out.width = right - left + 1;
  out.height = bottom - top + 1;
  out.getContext('2d')!.drawImage(canvas, left, top, out.width, out.height, 0, 0, out.width, out.height);
  const blob = await new Promise<Blob | null>((resolve) => out.toBlob(resolve, 'image/png'));
  return blob ? URL.createObjectURL(blob) : null;
}
