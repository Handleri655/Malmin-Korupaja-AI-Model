import * as THREE from 'three';
import { sampleFacetHeight } from './textures.ts';

export type VolcanoGeomParams = {
  innerRadius: number;
  thickness: number;
  bandWidth: number;
};

const ASSUMED_RADIUS_MM = 9;

export const volcanoParamsFromWidth = (widthMm: number): VolcanoGeomParams => ({
  innerRadius: 1,
  thickness: 1.7 / ASSUMED_RADIUS_MM,
  bandWidth: widthMm / ASSUMED_RADIUS_MM,
});

const addArc = (
  pts: THREE.Vector2[],
  cx: number,
  cy: number,
  radius: number,
  a0: number,
  a1: number,
  segs: number,
): void => {
  for (let i = 0; i <= segs; i += 1) {
    const t = i / segs;
    const a = a0 + (a1 - a0) * t;
    pts.push(new THREE.Vector2(cx + Math.cos(a) * radius, cy + Math.sin(a) * radius));
  }
};

const roundedRectProfile = (
  innerR: number,
  outerR: number,
  hw: number,
  corner: number,
): THREE.Vector2[] => {
  const pts: THREE.Vector2[] = [];
  const cr = Math.max(0.012, corner);
  addArc(pts, innerR + cr, -hw + cr, cr, Math.PI, Math.PI * 1.5, 5);
  addArc(pts, outerR - cr, -hw + cr, cr, Math.PI * 1.5, Math.PI * 2, 5);
  addArc(pts, outerR - cr, hw - cr, cr, 0, Math.PI * 0.5, 5);
  addArc(pts, innerR + cr, hw - cr, cr, Math.PI * 0.5, Math.PI, 5);
  pts.push(pts[0].clone());
  return pts;
};

export const createVolcanoGeometry = (
  params: VolcanoGeomParams,
): THREE.BufferGeometry => {
  const { innerRadius, thickness, bandWidth } = params;
  const outerR = innerRadius + thickness;
  const hw = bandWidth / 2;
  const corner = Math.min(thickness, bandWidth) * 0.16;
  const profile = roundedRectProfile(innerRadius, outerR, hw, corner);
  const thetaSegs = 168;
  const geom = new THREE.LatheGeometry(profile, thetaSegs);

  const pos = geom.attributes.position;
  const midR = innerRadius + thickness * 0.55;

  for (let i = 0; i < pos.count; i += 1) {
    const x = pos.getX(i);
    const y = pos.getY(i);
    const z = pos.getZ(i);
    const r = Math.hypot(x, z);
    if (r < midR || r < 1e-6) continue;
    const theta = Math.atan2(z, x);
    const u = fract(theta / (Math.PI * 2));
    const v = Math.min(1, Math.max(0, (y + hw) / Math.max(bandWidth, 1e-4)));
    const mag = ((r - midR) / Math.max(outerR - midR, 1e-4)) ** 1.1;
    const disp = (sampleFacetHeight(u, v) - 0.45) * thickness * 0.55 * mag;
    const nr = r + disp;
    pos.setXYZ(i, (x / r) * nr, y, (z / r) * nr);
  }

  const uv = geom.attributes.uv;
  for (let i = 0; i < pos.count; i += 1) {
    const x = pos.getX(i);
    const y = pos.getY(i);
    const z = pos.getZ(i);
    const theta = Math.atan2(z, x);
    uv.setXY(
      i,
      fract(theta / (Math.PI * 2)),
      Math.min(1, Math.max(0, (y + hw) / Math.max(bandWidth, 1e-4))),
    );
  }

  geom.computeVertexNormals();

  const idx = geom.index;
  if (idx) {
    const outer: number[] = [];
    const inner: number[] = [];
    for (let i = 0; i < idx.count; i += 3) {
      const a = idx.getX(i);
      const b = idx.getX(i + 1);
      const c = idx.getX(i + 2);
      const r =
        (Math.hypot(pos.getX(a), pos.getZ(a)) +
          Math.hypot(pos.getX(b), pos.getZ(b)) +
          Math.hypot(pos.getX(c), pos.getZ(c))) /
        3;
      if (r > innerRadius + thickness * 0.42) outer.push(a, b, c);
      else inner.push(a, b, c);
    }
    const merged = new Uint32Array(outer.length + inner.length);
    merged.set(outer, 0);
    merged.set(inner, outer.length);
    geom.setIndex(new THREE.BufferAttribute(merged, 1));
    geom.clearGroups();
    geom.addGroup(0, outer.length, 0);
    geom.addGroup(outer.length, inner.length, 1);
  }

  geom.computeBoundingSphere();
  return geom;
};

const fract = (v: number): number => v - Math.floor(v);
