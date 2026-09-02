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
  innerDiameterMm: number;
};

const DIAMETER_FROM_PHALANX: Record<FingerId, number> = {
  thumb: 0.52,
  index: 0.41,
  middle: 0.4,
  ring: 0.405,
  pinky: 0.39,
};

/** Inner diameter as a fraction of wrist → middle-MCP length. */
const DIAMETER_FROM_PALM: Record<FingerId, number> = {
  thumb: 0.22,
  index: 0.176,
  middle: 0.184,
  ring: 0.172,
  pinky: 0.148,
};

const PHALANX_MM: Record<FingerId, number> = {
  thumb: 32,
  index: 40,
  middle: 45,
  ring: 41,
  pinky: 32,
};

const SIZE_RANGE_MM: Record<FingerId, readonly [number, number]> = {
  thumb: [16, 26],
  index: [13, 22],
  middle: [14, 23],
  ring: [13, 22],
  pinky: [11, 19],
};

/** How far MCP → PIP the ring sits. MediaPipe MCP is in the knuckle/palm crease. */
const ALONG_PIP: Record<FingerId, number> = {
  thumb: 0.52,
  index: 0.62,
  middle: 0.62,
  ring: 0.63,
  pinky: 0.62,
};

/** Floor along MCP → fingertip so a collapsed PIP cannot pull the ring into the palm. */
const ALONG_TIP: Record<FingerId, number> = {
  thumb: 0.24,
  index: 0.27,
  middle: 0.27,
  ring: 0.28,
  pinky: 0.27,
};

const dist = (a: Point3, b: Point3): number =>
  Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z);

const dist2 = (a: Point3, b: Point3): number =>
  Math.hypot(a.x - b.x, a.y - b.y);

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

const lerpPt = (a: Point3, b: Point3, t: number): Point3 => ({
  x: a.x + (b.x - a.x) * t,
  y: a.y + (b.y - a.y) * t,
  z: a.z + (b.z - a.z) * t,
});

const clamp = (v: number, min: number, max: number): number =>
  Math.min(max, Math.max(min, v));

const toPx = (lm: Point3, width: number, height: number): Point3 => ({
  x: (lm.x - 0.5) * width,
  y: (0.5 - lm.y) * height,
  z: -lm.z * width,
});

const weightedMean = (samples: Array<{ value: number; weight: number }>): number | null => {
  let sum = 0;
  let weight = 0;
  for (const sample of samples) {
    if (sample.weight <= 0 || !Number.isFinite(sample.value)) continue;
    sum += sample.value * sample.weight;
    weight += sample.weight;
  }
  return weight > 1e-6 ? sum / weight : null;
};

export const formatRingSizeMm = (mm: number): string => {
  const stepped = Math.round(mm * 2) / 2;
  return Number.isInteger(stepped) ? String(stepped) : stepped.toFixed(1);
};

const neighborWidthPx = (
  landmarks: Point3[],
  width: number,
  height: number,
  mcp: Point3,
  pip: Point3,
  adjacentMcp: number[],
  wearT: number,
): number | null => {
  const wear = lerpPt(mcp, pip, wearT);
  let minGap = Infinity;
  for (const adjMcpIdx of adjacentMcp) {
    const adjPipIdx = adjMcpIdx + 1;
    const adjMcpLm = landmarks[adjMcpIdx];
    const adjPipLm = landmarks[adjPipIdx];
    if (!adjMcpLm || !adjPipLm) continue;
    const adjWear = lerpPt(
      toPx(adjMcpLm, width, height),
      toPx(adjPipLm, width, height),
      wearT,
    );
    const gap = dist2(wear, adjWear);
    if (gap > 4 && gap < minGap) minGap = gap;
  }
  return Number.isFinite(minGap) ? minGap : null;
};

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
  const dirLen2 = dist2(mcp, pip);
  if (dirLen < 8 || dirLen2 < 6) return null;
  const longAxis = tip && len(sub(tip, mcp)) > dirLen ? sub(tip, mcp) : axis;

  const worldMcp = worldLandmarks?.[joints.mcp];
  const worldPip = worldLandmarks?.[joints.pip];
  const worldWrist = worldLandmarks?.[0];
  const worldMidMcp = worldLandmarks?.[9];
  const worldPhalanxMm =
    worldMcp && worldPip ? dist(worldMcp, worldPip) * 1000 : null;
  const worldPalmMm =
    worldWrist && worldMidMcp ? dist(worldWrist, worldMidMcp) * 1000 : null;

  let pxPerMm = dirLen2 / PHALANX_MM[finger];
  if (worldPhalanxMm && worldPhalanxMm > 8 && worldPhalanxMm < 80) {
    pxPerMm = dirLen2 / worldPhalanxMm;
  }

  const rawDir = normalize(longAxis);
  if (!rawDir) return null;
  const dir = normalize({ x: rawDir.x, y: rawDir.y, z: rawDir.z * 0.4 });
  if (!dir) return null;

  const tPip = clamp(
    ALONG_PIP[finger] + Math.min(0.03, widthMm * 0.003),
    finger === 'thumb' ? 0.42 : 0.52,
    finger === 'thumb' ? 0.66 : 0.72,
  );
  const fromPip = lerpPt(mcpLm, pipLm, tPip);
  const tTip = ALONG_TIP[finger];
  const fromTip = tipLm ? lerpPt(mcpLm, tipLm, tTip) : fromPip;
  const alongLm =
    dist2(fromPip, wristLm) >= dist2(fromTip, wristLm) ? fromPip : fromTip;
  const surface = toPx(alongLm, width, height);

  const wrist = toPx(wristLm, width, height);
  const middleMcp = landmarks[9] ? toPx(landmarks[9], width, height) : null;
  const palmLenPx = middleMcp ? dist2(wrist, middleMcp) : null;
  const neighborPx = neighborWidthPx(
    landmarks,
    width,
    height,
    mcp,
    pip,
    joints.adjacent,
    tPip,
  );

  const fromPhalanx = dirLen2 * DIAMETER_FROM_PHALANX[finger];
  const samples: Array<{ value: number; weight: number }> = [
    { value: fromPhalanx, weight: 1.2 },
  ];
  if (palmLenPx && palmLenPx > 20) {
    samples.push({
      value: palmLenPx * DIAMETER_FROM_PALM[finger],
      weight: 0.9,
    });
  }
  if (worldPalmMm && worldPalmMm > 40 && worldPalmMm < 160) {
    samples.push({
      value: worldPalmMm * DIAMETER_FROM_PALM[finger] * pxPerMm,
      weight: 1.15,
    });
  }
  if (neighborPx && neighborPx < fromPhalanx * 1.45) {
    samples.push({
      value: neighborPx * 0.9,
      weight: neighborPx < fromPhalanx * 1.15 ? 1.35 : 0.55,
    });
  }

  const diameterPx = weightedMean(samples) ?? fromPhalanx;
  let innerDiameterMm = diameterPx / Math.max(pxPerMm, 0.15);
  innerDiameterMm = clamp(
    innerDiameterMm,
    SIZE_RANGE_MM[finger][0],
    SIZE_RANGE_MM[finger][1],
  );
  let radiusPx = (innerDiameterMm / 2) * Math.max(pxPerMm, 0.15);
  radiusPx = clamp(radiusPx, Math.max(3, dirLen2 * 0.11), dirLen2 * 0.3);
  innerDiameterMm = (radiusPx * 2) / Math.max(pxPerMm, 0.15);

  const indexMcp = landmarks[5] ? toPx(landmarks[5], width, height) : null;
  const pinkyMcp = landmarks[17] ? toPx(landmarks[17], width, height) : null;
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
    pxPerMm: Math.max(pxPerMm, 0.2),
    innerDiameterMm,
  };
};
