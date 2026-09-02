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

/** How far MCP → PIP the ring sits. MediaPipe MCP is in the knuckle/palm crease. */
const ALONG_PIP: Record<FingerId, number> = {
  thumb: 0.62,
  index: 0.74,
  middle: 0.74,
  ring: 0.76,
  pinky: 0.74,
};

/** Fallback along MCP → fingertip when PIP is too close to the knuckle. */
const ALONG_TIP: Record<FingerId, number> = {
  thumb: 0.3,
  index: 0.34,
  middle: 0.34,
  ring: 0.36,
  pinky: 0.34,
};

const dist = (a: Point3, b: Point3): number =>
  Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z);

const sub = (a: Point3, b: Point3): Point3 => ({
  x: a.x - b.x,
  y: a.y - b.y,
  z: a.z - b.z,
});

const scale = (a: Point3, s: number): Point3 => ({
  x: a.x * s,
  y: a.y * s,
  z: a.z * s,
});

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
  const tipLm = landmarks[joints.tip];
  const wristLm = landmarks[0];
  if (!mcpLm || !pipLm || !wristLm) return null;

  const mcp = toPx(mcpLm, width, height);
  const pip = toPx(pipLm, width, height);
  const tip = tipLm ? toPx(tipLm, width, height) : null;
  const axis = sub(pip, mcp);
  const dirLen = len(axis);
  if (dirLen < 8) return null;
  const longAxis = tip && len(sub(tip, mcp)) > dirLen ? sub(tip, mcp) : axis;

  let pxPerMm = dirLen / 42;
  const worldMcp = worldLandmarks?.[joints.mcp];
  const worldPip = worldLandmarks?.[joints.pip];
  if (worldMcp && worldPip) {
    const worldLen = dist(worldMcp, worldPip);
    if (worldLen > 1e-4) pxPerMm = dirLen / worldLen / 1000;
  }

  const rawDir = normalize(longAxis);
  if (!rawDir) return null;
  const dir = normalize({ x: rawDir.x, y: rawDir.y, z: rawDir.z * 0.4 });
  if (!dir) return null;

  const tPip = clamp(
    ALONG_PIP[finger] + Math.min(0.04, widthMm * 0.004),
    finger === 'thumb' ? 0.52 : 0.66,
    finger === 'thumb' ? 0.78 : 0.88,
  );
  const fromPip = {
    x: mcpLm.x + (pipLm.x - mcpLm.x) * tPip,
    y: mcpLm.y + (pipLm.y - mcpLm.y) * tPip,
    z: mcpLm.z + (pipLm.z - mcpLm.z) * tPip,
  };
  const tTip = ALONG_TIP[finger];
  const fromTip = tipLm
    ? {
        x: mcpLm.x + (tipLm.x - mcpLm.x) * tTip,
        y: mcpLm.y + (tipLm.y - mcpLm.y) * tTip,
        z: mcpLm.z + (tipLm.z - mcpLm.z) * tTip,
      }
    : fromPip;
  const dist2 = (a: Point3, b: Point3): number => {
    const dx = a.x - b.x;
    const dy = a.y - b.y;
    return dx * dx + dy * dy;
  };
  const alongLm = dist2(fromTip, wristLm) > dist2(fromPip, wristLm) ? fromTip : fromPip;
  const surface = toPx(alongLm, width, height);

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

  const insetK = lerp(0.12, 0.7, clamp((palmFacing - 0.12) / 0.7, 0, 1));
  const inset = radiusPx * insetK;
  const center = { x: surface.x, y: surface.y, z: surface.z - inset };

  if (!side) {
    side = { x: 1, y: 0, z: 0 };
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
