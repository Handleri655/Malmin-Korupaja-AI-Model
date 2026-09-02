import type { FingerId } from '../data/rings.ts';
import { FINGER_JOINTS } from '../data/rings.ts';

export type Point3 = { x: number; y: number; z: number };

export type RingPose = {
  x: number;
  y: number;
  z: number;
  dirX: number;
  dirY: number;
  dirZ: number;
  sideX: number;
  sideY: number;
  sideZ: number;
  radiusPx: number;
  pxPerMm: number;
};

const RADIUS_RATIO: Record<FingerId, number> = {
  thumb: 0.255,
  index: 0.188,
  middle: 0.192,
  ring: 0.186,
  pinky: 0.168,
};

const ALONG: Record<FingerId, number> = {
  thumb: 0.3,
  index: 0.18,
  middle: 0.17,
  ring: 0.18,
  pinky: 0.2,
};

const dist = (a: Point3, b: Point3): number =>
  Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z);

const sub = (a: Point3, b: Point3): Point3 => ({
  x: a.x - b.x,
  y: a.y - b.y,
  z: a.z - b.z,
});

const addScaled = (a: Point3, b: Point3, s: number): Point3 => ({
  x: a.x + b.x * s,
  y: a.y + b.y * s,
  z: a.z + b.z * s,
});

const scale = (a: Point3, s: number): Point3 => ({
  x: a.x * s,
  y: a.y * s,
  z: a.z * s,
});

const dot = (a: Point3, b: Point3): number => a.x * b.x + a.y * b.y + a.z * b.z;

const cross = (a: Point3, b: Point3): Point3 => ({
  x: a.y * b.z - a.z * b.y,
  y: a.z * b.x - a.x * b.z,
  z: a.x * b.y - a.y * b.x,
});

const len = (a: Point3): number => Math.hypot(a.x, a.y, a.z);

const normalize = (a: Point3): Point3 | null => {
  const l = len(a);
  if (l < 1e-6) return null;
  return scale(a, 1 / l);
};

const lerp = (a: number, b: number, t: number): number => a + (b - a) * t;

const clamp = (v: number, min: number, max: number): number =>
  Math.min(max, Math.max(min, v));

const toPx = (lm: Point3, width: number, height: number): Point3 => ({
  x: (lm.x - 0.5) * width,
  y: (0.5 - lm.y) * height,
  z: -lm.z * width,
});

export const estimateRingPose = (
  landmarks: Point3[],
  worldLandmarks: Point3[] | undefined,
  finger: FingerId,
  width: number,
  height: number,
  widthMm = 5,
): RingPose | null => {
  const joints = FINGER_JOINTS[finger];
  const mcpLm = landmarks[joints.mcp];
  const pipLm = landmarks[joints.pip];
  const wristLm = landmarks[0];
  if (!mcpLm || !pipLm || !wristLm) return null;

  const mcp = toPx(mcpLm, width, height);
  const pip = toPx(pipLm, width, height);
  const axis = sub(pip, mcp);
  const dirLen = len(axis);
  if (dirLen < 8) return null;

  let pxPerMm = dirLen / 42;
  const worldMcp = worldLandmarks?.[joints.mcp];
  const worldPip = worldLandmarks?.[joints.pip];
  if (worldMcp && worldPip) {
    const worldLen = dist(worldMcp, worldPip);
    if (worldLen > 1e-4) pxPerMm = dirLen / worldLen / 1000;
  }

  const rawDir = normalize(axis);
  if (!rawDir) return null;
  const dir = normalize({ x: rawDir.x, y: rawDir.y, z: rawDir.z * 0.4 });
  if (!dir) return null;

  const phalanxMm = dirLen / Math.max(pxPerMm, 0.35);
  const alongBase = ALONG[finger];
  const alongTarget = (3.8 + widthMm * 0.48) / Math.max(phalanxMm, 8);
  const t = clamp(
    lerp(alongBase, alongTarget, 0.65),
    finger === 'thumb' ? 0.22 : 0.14,
    finger === 'thumb' ? 0.4 : 0.28,
  );

  const surface = addScaled(mcp, dir, dirLen * t);

  let radiusPx = dirLen * RADIUS_RATIO[finger];
  let spacingSum = 0;
  let spacingCount = 0;
  for (const adjIdx of joints.adjacent) {
    const adjLm = landmarks[adjIdx];
    if (!adjLm) continue;
    spacingSum += dist(mcp, toPx(adjLm, width, height));
    spacingCount += 1;
  }
  if (spacingCount > 0) {
    const spacing = spacingSum / spacingCount;
    radiusPx = radiusPx * 0.45 + spacing * 0.36 * 0.55;
  }

  if (worldMcp && worldPip) {
    const worldLen = dist(worldMcp, worldPip);
    if (worldLen > 1e-4) {
      const fromWorld = worldLen * 1000 * RADIUS_RATIO[finger] * pxPerMm;
      radiusPx = radiusPx * 0.4 + fromWorld * 0.6;
    }
  }

  radiusPx = clamp(radiusPx, 8, dirLen * 0.36);

  const indexMcp = landmarks[5] ? toPx(landmarks[5], width, height) : null;
  const pinkyMcp = landmarks[17] ? toPx(landmarks[17], width, height) : null;
  const wrist = toPx(wristLm, width, height);
  let side: Point3 | null = null;
  let palmFacing = 0.55;
  if (indexMcp && pinkyMcp) {
    const palmN = cross(sub(indexMcp, wrist), sub(pinkyMcp, wrist));
    const palmU = normalize(palmN);
    if (palmU) {
      palmFacing = Math.abs(palmU.z);
      side = normalize(cross(palmU, dir));
    }
  }

  const cam: Point3 = { x: 0, y: 0, z: 1 };
  const radial = addScaled(cam, dir, -dot(cam, dir));
  const radialU = normalize(radial);
  const alongView = Math.abs(dir.z);
  const insetK = lerp(0.12, 0.78, clamp((palmFacing - 0.12) / 0.7, 0, 1));
  const inset = radialU && alongView < 0.92 ? radiusPx * insetK : radiusPx * 0.12;
  const center = radialU ? addScaled(surface, radialU, -inset) : surface;

  if (!side) {
    side = radialU ?? { x: 1, y: 0, z: 0 };
  }

  return {
    x: center.x,
    y: center.y,
    z: center.z,
    dirX: dir.x,
    dirY: dir.y,
    dirZ: dir.z,
    sideX: side.x,
    sideY: side.y,
    sideZ: side.z,
    radiusPx,
    pxPerMm: Math.max(pxPerMm, 0.35),
  };
};
