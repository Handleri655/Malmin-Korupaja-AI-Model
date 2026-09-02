import * as THREE from 'three';

const TEX_W = 1024;
const TEX_H = 256;

const fract = (v: number): number => v - Math.floor(v);

const hash2 = (x: number, y: number): number => {
  const s = Math.sin(x * 127.1 + y * 311.7) * 43758.5453;
  return s - Math.floor(s);
};

type Cell = { u: number; v: number; h: number; ang: number };

const buildCells = (): Cell[] => {
  const cols = 34;
  const rows = 5;
  const cells: Cell[] = [];
  for (let j = 0; j < rows; j += 1) {
    for (let i = 0; i < cols; i += 1) {
      const u = fract((i + 0.5 + (hash2(i, j) - 0.5) * 0.82) / cols);
      const v = Math.min(
        0.96,
        Math.max(0.04, (j + 0.5 + (hash2(i, j + 19) - 0.5) * 0.72) / rows),
      );
      cells.push({
        u,
        v,
        h: 0.22 + hash2(i, j + 3) * 0.78,
        ang: hash2(i, j + 7) * Math.PI,
      });
    }
  }
  return cells;
};

const CELLS = buildCells();

const closestCell = (
  u: number,
  v: number,
): { cell: Cell; d1: number; d2: number } => {
  let d1 = 1e9;
  let d2 = 1e9;
  let best = CELLS[0];
  for (const cell of CELLS) {
    let du = Math.abs(u - cell.u);
    du = Math.min(du, 1 - du) * 2.4;
    const dv = (v - cell.v) * 1.15;
    const d = du * du + dv * dv;
    if (d < d1) {
      d2 = d1;
      d1 = d;
      best = cell;
    } else if (d < d2) {
      d2 = d;
    }
  }
  return { cell: best, d1: Math.sqrt(d1), d2: Math.sqrt(d2) };
};

export const sampleFacetHeight = (u: number, v: number): number => {
  const uu = fract(u);
  const { cell, d1, d2 } = closestCell(uu, v);
  const edge = Math.max(0, Math.min(1, (d2 - d1) * 8));
  let du = uu - cell.u;
  if (du > 0.5) du -= 1;
  if (du < -0.5) du += 1;
  const dv = v - cell.v;
  const ca = Math.cos(cell.ang);
  const sa = Math.sin(cell.ang);
  const localX = du * ca * 2.4 + dv * sa;
  const brush = Math.sin(localX * 210) * 0.07;
  return cell.h * 0.72 + (1 - edge) * 0.28 + brush;
};

const canvasToMap = (
  canvas: HTMLCanvasElement,
  srgb: boolean,
): THREE.CanvasTexture => {
  const map = new THREE.CanvasTexture(canvas);
  map.wrapS = THREE.RepeatWrapping;
  map.wrapT = THREE.ClampToEdgeWrapping;
  map.anisotropy = 8;
  map.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.LinearSRGBColorSpace;
  map.needsUpdate = true;
  return map;
};

export type RingTextures = {
  normal: THREE.CanvasTexture;
  roughness: THREE.CanvasTexture;
  rainbow: THREE.CanvasTexture;
};

let cache: RingTextures | null = null;

export const createRingTextures = (): RingTextures => {
  if (cache) return cache;

  const height = new Float32Array(TEX_W * TEX_H);
  for (let y = 0; y < TEX_H; y += 1) {
    const v = y / (TEX_H - 1);
    for (let x = 0; x < TEX_W; x += 1) {
      const u = x / TEX_W;
      height[y * TEX_W + x] = sampleFacetHeight(u, v);
    }
  }

  const normalCanvas = document.createElement('canvas');
  normalCanvas.width = TEX_W;
  normalCanvas.height = TEX_H;
  const nctx = normalCanvas.getContext('2d')!;
  const nimg = nctx.createImageData(TEX_W, TEX_H);

  const roughCanvas = document.createElement('canvas');
  roughCanvas.width = TEX_W;
  roughCanvas.height = TEX_H;
  const rctx = roughCanvas.getContext('2d')!;
  const rimg = rctx.createImageData(TEX_W, TEX_H);

  const strength = 6.5;
  for (let y = 0; y < TEX_H; y += 1) {
    for (let x = 0; x < TEX_W; x += 1) {
      const i = y * TEX_W + x;
      const hL = height[y * TEX_W + ((x + TEX_W - 1) % TEX_W)];
      const hR = height[y * TEX_W + ((x + 1) % TEX_W)];
      const hD = height[Math.max(0, y - 1) * TEX_W + x];
      const hU = height[Math.min(TEX_H - 1, y + 1) * TEX_W + x];
      const nx = (hL - hR) * strength;
      const ny = (hD - hU) * strength;
      const nz = 1;
      const inv = 1 / Math.hypot(nx, ny, nz);
      const p = i * 4;
      nimg.data[p] = Math.round((nx * inv * 0.5 + 0.5) * 255);
      nimg.data[p + 1] = Math.round((ny * inv * 0.5 + 0.5) * 255);
      nimg.data[p + 2] = Math.round((nz * inv * 0.5 + 0.5) * 255);
      nimg.data[p + 3] = 255;

      const h = height[i];
      const rough = 0.34 + h * 0.28;
      const g = Math.round(Math.min(1, rough) * 255);
      rimg.data[p] = g;
      rimg.data[p + 1] = g;
      rimg.data[p + 2] = g;
      rimg.data[p + 3] = 255;
    }
  }
  nctx.putImageData(nimg, 0, 0);
  rctx.putImageData(rimg, 0, 0);

  const rainbowCanvas = document.createElement('canvas');
  rainbowCanvas.width = TEX_W;
  rainbowCanvas.height = TEX_H;
  const gctx = rainbowCanvas.getContext('2d')!;
  const stripeH = TEX_H / 3;
  gctx.fillStyle = '#c48772';
  gctx.fillRect(0, 0, TEX_W, stripeH);
  gctx.fillStyle = '#e6e4de';
  gctx.fillRect(0, stripeH, TEX_W, stripeH);
  gctx.fillStyle = '#d7b15a';
  gctx.fillRect(0, stripeH * 2, TEX_W, TEX_H);

  cache = {
    normal: canvasToMap(normalCanvas, false),
    roughness: canvasToMap(roughCanvas, false),
    rainbow: canvasToMap(rainbowCanvas, true),
  };
  return cache;
};
