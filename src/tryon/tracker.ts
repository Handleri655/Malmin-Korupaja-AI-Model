import {
  FilesetResolver,
  HandLandmarker,
  type HandLandmarkerResult,
} from '@mediapipe/tasks-vision';

const WASM_PATH = '/mediapipe/wasm';

export class HandTracker {
  private landmarker: HandLandmarker | null = null;
  private mode: 'VIDEO' | 'IMAGE' = 'VIDEO';
  private lastTs = 0;

  async init(): Promise<void> {
    const wasm = await FilesetResolver.forVisionTasks(WASM_PATH);
    const options = {
      baseOptions: {
        modelAssetPath: '/models/hand_landmarker.task',
        delegate: 'GPU' as const,
      },
      runningMode: 'VIDEO' as const,
      numHands: 1,
      minHandDetectionConfidence: 0.4,
      minHandPresenceConfidence: 0.4,
      minTrackingConfidence: 0.4,
    };

    try {
      this.landmarker = await HandLandmarker.createFromOptions(wasm, options);
    } catch {
      this.landmarker = await HandLandmarker.createFromOptions(wasm, {
        ...options,
        baseOptions: { ...options.baseOptions, delegate: 'CPU' },
      });
    }
    this.mode = 'VIDEO';
  }

  async setMode(mode: 'VIDEO' | 'IMAGE'): Promise<void> {
    if (!this.landmarker || this.mode === mode) return;
    await this.landmarker.setOptions({ runningMode: mode });
    this.mode = mode;
    this.lastTs = 0;
  }

  detectVideo(
    frame: HTMLVideoElement | HTMLCanvasElement | HTMLImageElement,
  ): HandLandmarkerResult | null {
    if (!this.landmarker) return null;
    if (frame instanceof HTMLVideoElement && frame.readyState < 2) return null;
    let ts = performance.now();
    if (ts <= this.lastTs) ts = this.lastTs + 1;
    this.lastTs = ts;
    try {
      return this.landmarker.detectForVideo(frame, ts);
    } catch {
      return null;
    }
  }

  detectImage(image: HTMLImageElement | HTMLCanvasElement): HandLandmarkerResult | null {
    if (!this.landmarker) return null;
    try {
      return this.landmarker.detect(image);
    } catch {
      return null;
    }
  }

  close(): void {
    this.landmarker?.close();
    this.landmarker = null;
  }
}
