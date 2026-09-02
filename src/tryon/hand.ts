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
  radiusPx: number;
  pxPerMm: number;
};

const dist = (a: Point3, b: Point3): number =>
  Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z);

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
): RingPose | null => {
  const joints = FINGER_JOINTS[finger];
  const mcpLm = landmarks[joints.mcp];
  const pipLm = landmarks[joints.pip];
  if (!mcpLm || !pipLm) return null;

  const t = finger === 'thumb' ? 0.32 : 0.26;
  const mid: Point3 = {
    x: mcpLm.x + (pipLm.x - mcpLm.x) * t,
    y: mcpLm.y + (pipLm.y - mcpLm.y) * t,
    z: mcpLm.z + (pipLm.z - mcpLm.z) * t,
  };

  const mcp = toPx(mcpLm, width, height);
  const pip = toPx(pipLm, width, height);
  const pos = toPx(mid, width, height);
  const dirX = pip.x - mcp.x;
  const dirY = pip.y - mcp.y;
  const dirZ = pip.z - mcp.z;
  const dirLen = Math.hypot(dirX, dirY, dirZ);
  if (dirLen < 8) return null;

  let radiusPx = dirLen * 0.22;
  let pxPerMm = dirLen / 42;

  const adjIdx = joints.adjacent[0];
  const adjLm = landmarks[adjIdx];
  if (adjLm) {
    const adj = toPx(adjLm, width, height);
    const spacing = dist(mcp, adj);
    radiusPx = radiusPx * 0.4 + spacing * 0.38 * 0.6;
  }

  const worldMcp = worldLandmarks?.[joints.mcp];
  const worldPip = worldLandmarks?.[joints.pip];
  if (worldMcp && worldPip) {
    const worldLen = dist(worldMcp, worldPip);
    if (worldLen > 1e-4) {
      const pxPerM = dirLen / worldLen;
      pxPerMm = pxPerM / 1000;
      const diameterMm = worldLen * 1000 * 0.42;
      radiusPx = radiusPx * 0.35 + ((diameterMm * pxPerMm) / 2) * 0.65;
    }
  }

  radiusPx = Math.max(10, Math.min(radiusPx, dirLen * 0.55));

  return {
    x: pos.x,
    y: pos.y,
    z: pos.z,
    dirX: dirX / dirLen,
    dirY: dirY / dirLen,
    dirZ: dirZ / dirLen,
    radiusPx,
    pxPerMm: Math.max(pxPerMm, 0.4),
  };
};
