import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import type { FingerId, RingProduct } from '../data/rings.ts';
import { estimateRingPose } from './hand.ts';
import {
  createVolcanoGeometry,
  volcanoParamsFromWidth,
} from './geometry.ts';
import { applyRingFinish, createRingMaterials } from './materials.ts';
import { createRingTextures } from './textures.ts';

const TARGET_POS = new THREE.Vector3();
const TARGET_DIR = new THREE.Vector3();
const TARGET_QUAT = new THREE.Quaternion();
const TMP_SCALE = new THREE.Vector3();
const UP = new THREE.Vector3(0, 1, 0);

export class TryOnEngine {
  readonly renderer: THREE.WebGLRenderer;
  readonly domElement: HTMLCanvasElement;
  private readonly scene: THREE.Scene;
  private readonly camera: THREE.OrthographicCamera;
  private readonly group: THREE.Group;
  private readonly occluder: THREE.Mesh;
  private readonly ringMesh: THREE.Mesh;
  private readonly materials: THREE.MeshPhysicalMaterial[];
  private geom: THREE.BufferGeometry;
  private finger: FingerId = 'ring';
  private widthMm = 5;
  private sizeAdjust = 1;
  private opacity = 0;
  private hasPose = false;
  private lostFrames = 0;
  private sourceWidth = 1280;
  private sourceHeight = 720;

  constructor(canvas: HTMLCanvasElement) {
    this.domElement = canvas;
    this.renderer = new THREE.WebGLRenderer({
      canvas,
      alpha: true,
      antialias: true,
      preserveDrawingBuffer: true,
      powerPreference: 'high-performance',
    });
    this.renderer.setClearColor(0x000000, 0);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.12;
    this.renderer.autoClear = true;

    this.scene = new THREE.Scene();
    this.camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 4000);
    this.camera.position.set(0, 0, 800);
    this.camera.lookAt(0, 0, 0);

    const pmrem = new THREE.PMREMGenerator(this.renderer);
    const environment = new RoomEnvironment();
    this.scene.environment = pmrem.fromScene(environment, 0.04).texture;
    environment.dispose();
    pmrem.dispose();

    const key = new THREE.DirectionalLight(0xfff6ea, 1.35);
    key.position.set(0.4, 0.9, 0.7);
    this.scene.add(key);
    this.scene.add(new THREE.AmbientLight(0xdde6ff, 0.35));

    const textures = createRingTextures();
    this.materials = createRingMaterials(textures);
    this.geom = createVolcanoGeometry(volcanoParamsFromWidth(this.widthMm));
    this.ringMesh = new THREE.Mesh(this.geom, this.materials);
    this.ringMesh.renderOrder = 1;
    this.ringMesh.frustumCulled = false;

    const occluderMat = new THREE.MeshBasicMaterial();
    occluderMat.colorWrite = false;
    occluderMat.depthWrite = true;
    occluderMat.polygonOffset = true;
    occluderMat.polygonOffsetFactor = 1;
    occluderMat.polygonOffsetUnits = 1;
    this.occluder = new THREE.Mesh(
      new THREE.CylinderGeometry(0.74, 0.84, 5.2, 32),
      occluderMat,
    );
    this.occluder.scale.set(1, 1, 1);
    this.occluder.renderOrder = 0;
    this.occluder.frustumCulled = false;

    this.group = new THREE.Group();
    this.group.add(this.occluder);
    this.group.add(this.ringMesh);
    this.group.visible = false;
    this.scene.add(this.group);
  }

  setFinger(finger: FingerId): void {
    this.finger = finger;
    this.hasPose = false;
  }

  setSizeAdjust(value: number): void {
    this.sizeAdjust = value;
  }

  setWidth(widthMm: number): void {
    if (widthMm === this.widthMm) return;
    this.widthMm = widthMm;
    const next = createVolcanoGeometry(volcanoParamsFromWidth(widthMm));
    this.ringMesh.geometry = next;
    this.geom.dispose();
    this.geom = next;
  }

  setRing(ring: RingProduct): void {
    applyRingFinish(this.materials, ring, createRingTextures());
  }

  resize(width: number, height: number): void {
    if (width < 2 || height < 2) return;
    this.sourceWidth = width;
    this.sourceHeight = height;
    this.renderer.setSize(width, height, false);
    this.camera.left = -width / 2;
    this.camera.right = width / 2;
    this.camera.top = height / 2;
    this.camera.bottom = -height / 2;
    this.camera.updateProjectionMatrix();
  }

  update(
    landmarks: Array<{ x: number; y: number; z: number }> | undefined,
    worldLandmarks: Array<{ x: number; y: number; z: number }> | undefined,
  ): boolean {
    const pose =
      landmarks &&
      estimateRingPose(
        landmarks,
        worldLandmarks,
        this.finger,
        this.sourceWidth,
        this.sourceHeight,
        this.widthMm,
      );

    if (!pose) {
      this.lostFrames += 1;
      this.opacity = Math.max(0, this.opacity - 0.18);
      if (this.lostFrames > 10) this.hasPose = false;
      this.group.visible = this.opacity > 0.04;
      this.syncOpacity();
      this.renderer.render(this.scene, this.camera);
      return false;
    }

    this.lostFrames = 0;
    TARGET_POS.set(pose.x, pose.y, pose.z);
    TARGET_DIR.set(pose.dirX, pose.dirY, pose.dirZ).normalize();
    TARGET_QUAT.setFromUnitVectors(UP, TARGET_DIR);
    const scale = pose.radiusPx * 1.04 * this.sizeAdjust;

    if (!this.hasPose) {
      this.group.position.copy(TARGET_POS);
      this.group.quaternion.copy(TARGET_QUAT);
      this.group.scale.setScalar(scale);
      this.hasPose = true;
    } else {
      this.group.position.lerp(TARGET_POS, 0.36);
      this.group.quaternion.slerp(TARGET_QUAT, 0.3);
      TMP_SCALE.set(scale, scale, scale);
      this.group.scale.lerp(TMP_SCALE, 0.2);
    }

    this.opacity = Math.min(1, this.opacity + 0.22);
    this.group.visible = true;
    this.syncOpacity();
    this.renderer.render(this.scene, this.camera);
    return true;
  }

  renderIdle(): void {
    this.opacity = Math.max(0, this.opacity - 0.2);
    this.group.visible = this.opacity > 0.04;
    this.syncOpacity();
    this.renderer.render(this.scene, this.camera);
  }

  private syncOpacity(): void {
    const value = this.opacity;
    for (const material of this.materials) {
      material.transparent = value < 0.98;
      material.opacity = value;
      material.depthWrite = value > 0.2;
    }
  }

  dispose(): void {
    this.geom.dispose();
    this.occluder.geometry.dispose();
    (this.occluder.material as THREE.Material).dispose();
    for (const material of this.materials) material.dispose();
    this.renderer.dispose();
  }
}
