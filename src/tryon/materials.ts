import * as THREE from 'three';
import type { RingProduct } from '../data/rings.ts';
import type { RingTextures } from './textures.ts';

export const createRingMaterials = (
  textures: RingTextures,
): THREE.MeshPhysicalMaterial[] => {
  const outer = new THREE.MeshPhysicalMaterial({
    color: '#c5ccd3',
    metalness: 1,
    roughness: 0.55,
    roughnessMap: textures.roughness,
    normalMap: textures.normal,
    normalScale: new THREE.Vector2(1.15, 1.15),
    envMapIntensity: 1.15,
    clearcoat: 0.08,
    clearcoatRoughness: 0.45,
  });

  const inner = new THREE.MeshPhysicalMaterial({
    color: '#dfe5ea',
    metalness: 1,
    roughness: 0.08,
    envMapIntensity: 1.35,
    clearcoat: 0.35,
    clearcoatRoughness: 0.08,
  });

  return [outer, inner];
};

export const applyRingFinish = (
  materials: THREE.MeshPhysicalMaterial[],
  ring: RingProduct,
  textures: RingTextures,
): void => {
  const [outer, inner] = materials;
  outer.color.set(ring.color);
  inner.color.set(ring.innerColor);
  outer.map = null;
  inner.map = null;
  outer.emissive.set('#000000');
  outer.emissiveIntensity = 0;
  outer.iridescence = 0;
  outer.sheen = 0;
  outer.roughness = 0.52;
  inner.roughness = 0.08;
  outer.envMapIntensity = 1.15;
  inner.envMapIntensity = 1.35;
  outer.metalness = 1;
  inner.metalness = 1;

  if (ring.finish === 'black') {
    outer.roughness = 0.32;
    inner.roughness = 0.14;
    outer.envMapIntensity = 0.85;
    inner.envMapIntensity = 1.05;
  }

  if (ring.finish === 'northern-lights') {
    outer.color.set('#1a4fa3');
    inner.color.set('#245bb8');
    outer.roughness = 0.38;
    inner.roughness = 0.16;
    outer.iridescence = 1;
    outer.iridescenceIOR = 1.18;
    outer.iridescenceThicknessRange = [90, 380];
    outer.sheen = 0.55;
    outer.sheenColor.set('#6a3cff');
    outer.emissive.set('#0a1a40');
    outer.emissiveIntensity = 0.18;
    outer.envMapIntensity = 1.05;
  }

  if (ring.finish === 'rainbow') {
    outer.map = textures.rainbow;
    inner.map = textures.rainbow;
    outer.color.set('#ffffff');
    inner.color.set('#ffffff');
    outer.roughness = 0.42;
  }

  outer.needsUpdate = true;
  inner.needsUpdate = true;
};
