import './style.css';
import {
  FINGERS,
  RINGS,
  formatPrice,
  type FingerId,
  type RingProduct,
} from './data/rings.ts';
import {
  canvasToBlob,
  compositeFrame,
  pickRecorderMime,
  startCamera,
  stopCamera,
} from './tryon/camera.ts';
import { TryOnEngine } from './tryon/engine.ts';
import { HandTracker } from './tryon/tracker.ts';

const $ = <T extends HTMLElement>(id: string): T => {
  const el = document.getElementById(id);
  if (!el) throw new Error(`Puuttuva elementti: ${id}`);
  return el as T;
};

const camera = $<HTMLVideoElement>('camera');
const still = $<HTMLImageElement>('still');
const overlay = $<HTMLCanvasElement>('overlay');
const stage = $('stage');
const hint = $('hint');
const flash = $('flash');
const statusEl = $('status');
const picker = $('picker');
const widthsEl = $('widths');
const fingersEl = $('fingers');
const widthValue = $('width-value');
const fingerValue = $('finger-value');
const shopLink = $<HTMLAnchorElement>('shop-link');
const productMeta = $('product-meta');
const sizeInput = $<HTMLInputElement>('size');
const gate = $('gate');
const loader = $('loader');
const preview = $('preview');
const previewImage = $<HTMLImageElement>('preview-image');
const previewVideo = $<HTMLVideoElement>('preview-video');
const gateStrip = $('gate-strip');
const fileInput = $<HTMLInputElement>('file-input');

let ring = RINGS[0];
let widthMm = ring.defaultWidth;
let finger: FingerId = 'ring';
let facing: 'user' | 'environment' = 'environment';
let source: 'camera' | 'image' = 'camera';
let engine: TryOnEngine | null = null;
let tracker: HandTracker | null = null;
let raf = 0;
let lastOverlayW = 0;
let lastOverlayH = 0;
let stillFrame: HTMLCanvasElement | null = null;
let stillLandmarks: Array<{ x: number; y: number; z: number }> | null = null;
let stillWorld: Array<{ x: number; y: number; z: number }> | null = null;
let recording = false;
let recorder: MediaRecorder | null = null;
let recordChunks: Blob[] = [];
let recordCanvas: HTMLCanvasElement | null = null;
let recordCtx: CanvasRenderingContext2D | null = null;
let recordTimer: number | null = null;
let lastBlob: Blob | null = null;
let lastBlobName = 'volcano.jpg';
let hintUntil = 0;
let running = false;

const setStatus = (text: string): void => {
  statusEl.textContent = text;
};

const selectedRingCard = (product: RingProduct, active: boolean): HTMLButtonElement => {
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = `ring-card${active ? ' active' : ''}`;
  btn.dataset.id = product.id;
  btn.innerHTML = `<img src="${product.image}" alt=""><span>${product.name}</span>`;
  return btn;
};

const renderPicker = (): void => {
  picker.replaceChildren(...RINGS.map((item) => selectedRingCard(item, item.id === ring.id)));
};

const renderWidths = (): void => {
  widthsEl.replaceChildren(
    ...ring.widths.map((mm) => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.textContent = `${mm} mm`;
      btn.className = mm === widthMm ? 'active' : '';
      btn.dataset.mm = String(mm);
      return btn;
    }),
  );
  widthValue.textContent = `${widthMm} mm`;
};

const renderFingers = (): void => {
  fingersEl.replaceChildren(
    ...FINGERS.map((item) => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.textContent = item.label;
      btn.className = item.id === finger ? 'active' : '';
      btn.dataset.finger = item.id;
      return btn;
    }),
  );
  const current = FINGERS.find((item) => item.id === finger);
  fingerValue.textContent = current?.label ?? '';
};

const syncProduct = (): void => {
  shopLink.href = ring.url;
  productMeta.textContent = `${ring.name} · ${formatPrice(ring.price)}`;
};

const applyRing = (next: RingProduct): void => {
  ring = next;
  if (!ring.widths.includes(widthMm)) widthMm = ring.defaultWidth;
  engine?.setRing(ring);
  engine?.setWidth(widthMm);
  renderPicker();
  renderWidths();
  syncProduct();
};

const sourceElement = (): HTMLVideoElement | HTMLImageElement =>
  source === 'camera' ? camera : still;

const syncViewport = (): void => {
  if (!engine) return;
  const el = sourceElement();
  const width = el instanceof HTMLVideoElement ? el.videoWidth : el.naturalWidth;
  const height = el instanceof HTMLVideoElement ? el.videoHeight : el.naturalHeight;
  if (width < 2 || height < 2) return;
  if (width === lastOverlayW && height === lastOverlayH) return;
  lastOverlayW = width;
  lastOverlayH = height;
  engine.resize(width, height);
};

const loop = (): void => {
  raf = requestAnimationFrame(loop);
  if (!engine || !tracker || !running) return;
  syncViewport();

  let found = false;
  if (source === 'camera') {
    const result = tracker.detectVideo(camera);
    found = engine.update(result?.landmarks[0], result?.worldLandmarks[0]);
  } else if (stillFrame) {
    const live = tracker.detectVideo(stillFrame);
    const landmarks = live?.landmarks[0] ?? stillLandmarks;
    const world = live?.worldLandmarks[0] ?? stillWorld ?? undefined;
    found = engine.update(landmarks ?? undefined, world);
  } else {
    engine.renderIdle();
  }

  if (recording && recordCtx && recordCanvas) {
    compositeFrame(
      recordCtx,
      sourceElement(),
      overlay,
      recordCanvas.width,
      recordCanvas.height,
      facing === 'user' && source === 'camera',
    );
  }

  const showHint = !found && performance.now() > hintUntil;
  hint.classList.toggle('show', showHint);
  if (recording) setStatus('Nauhoitus');
  else if (found) setStatus('Sormus paikallaan');
  else setStatus(source === 'camera' ? 'Etsitään kättä' : 'Kättä ei löytynyt');
};

const ensureEngine = async (): Promise<void> => {
  if (engine && tracker) return;
  loader.hidden = false;
  if (!engine) {
    engine = new TryOnEngine(overlay);
    engine.setRing(ring);
    engine.setWidth(widthMm);
    engine.setFinger(finger);
  }
  if (!tracker) {
    tracker = new HandTracker();
    await tracker.init();
  }
  loader.hidden = true;
};

const beginLoop = (): void => {
  if (raf) cancelAnimationFrame(raf);
  running = true;
  hintUntil = performance.now() + 400;
  loop();
};

const openLive = async (): Promise<void> => {
  source = 'camera';
  still.hidden = true;
  camera.hidden = false;
  stillFrame = null;
  stillLandmarks = null;
  stillWorld = null;
  gate.hidden = true;
  loader.hidden = false;
  await startCamera(camera, facing);
  stage.classList.toggle('mirror', facing === 'user');
  await ensureEngine();
  await tracker?.setMode('VIDEO');
  loader.hidden = true;
  beginLoop();
};

const prepareStillFrame = (image: HTMLImageElement): HTMLCanvasElement => {
  const maxSide = 960;
  const scale = Math.min(1, maxSide / Math.max(image.naturalWidth, image.naturalHeight));
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(2, Math.round(image.naturalWidth * scale));
  canvas.height = Math.max(2, Math.round(image.naturalHeight * scale));
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Kuva-alustaa ei saatu');
  ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
  return canvas;
};

const openStillUrl = async (url: string): Promise<void> => {
  await ensureEngine();
  stopCamera(camera);
  camera.hidden = true;
  still.hidden = false;
  source = 'image';
  stage.classList.remove('mirror');
  still.src = url;
  await still.decode();
  lastOverlayW = 0;
  syncViewport();
  stillFrame = prepareStillFrame(still);
  await tracker?.setMode('IMAGE');
  let result = tracker?.detectImage(stillFrame) ?? null;
  for (let i = 0; i < 6 && !result?.landmarks[0]; i += 1) {
    await new Promise((resolve) => window.setTimeout(resolve, 80));
    result = tracker?.detectImage(stillFrame) ?? null;
  }
  stillLandmarks = result?.landmarks[0] ?? null;
  stillWorld = result?.worldLandmarks[0] ?? null;
  await tracker?.setMode('VIDEO');
  gate.hidden = true;
  beginLoop();
};

const openImage = async (file: File): Promise<void> => {
  await openStillUrl(URL.createObjectURL(file));
};

const capturePhoto = async (): Promise<void> => {
  if (!engine) return;
  const el = sourceElement();
  const width = el instanceof HTMLVideoElement ? el.videoWidth : el.naturalWidth;
  const height = el instanceof HTMLVideoElement ? el.videoHeight : el.naturalHeight;
  if (width < 2) return;
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  compositeFrame(ctx, el, overlay, width, height, facing === 'user' && source === 'camera');
  const blob = await canvasToBlob(canvas, 'image/jpeg', 0.92);
  lastBlob = blob;
  lastBlobName = `volcano-${ring.id}.jpg`;
  previewImage.hidden = false;
  previewVideo.hidden = true;
  previewImage.src = URL.createObjectURL(blob);
  preview.hidden = false;
  flash.classList.remove('pop');
  void flash.offsetWidth;
  flash.classList.add('pop');
  navigator.vibrate?.(15);
};

const stopRecording = (): void => {
  if (recordTimer) window.clearTimeout(recordTimer);
  recordTimer = null;
  recording = false;
  $('record').classList.remove('recording');
  recorder?.stop();
};

const startRecording = (): void => {
  if (!engine || recording) return;
  const mime = pickRecorderMime();
  if (!mime || typeof MediaRecorder === 'undefined') {
    setStatus('Video ei onnistu tässä selaimessa');
    return;
  }
  const el = sourceElement();
  const width = el instanceof HTMLVideoElement ? el.videoWidth : el.naturalWidth;
  const height = el instanceof HTMLVideoElement ? el.videoHeight : el.naturalHeight;
  recordCanvas = document.createElement('canvas');
  recordCanvas.width = width;
  recordCanvas.height = height;
  recordCtx = recordCanvas.getContext('2d');
  if (!recordCtx) return;
  const stream = recordCanvas.captureStream(30);
  recordChunks = [];
  recorder = new MediaRecorder(stream, { mimeType: mime });
  recorder.ondataavailable = (event) => {
    if (event.data.size) recordChunks.push(event.data);
  };
  recorder.onstop = () => {
    const blob = new Blob(recordChunks, { type: mime });
    lastBlob = blob;
    lastBlobName = `volcano-${ring.id}.${mime.includes('mp4') ? 'mp4' : 'webm'}`;
    previewImage.hidden = true;
    previewVideo.hidden = false;
    previewVideo.src = URL.createObjectURL(blob);
    preview.hidden = false;
    recordCanvas = null;
    recordCtx = null;
  };
  recorder.start(100);
  recording = true;
  $('record').classList.add('recording');
  recordTimer = window.setTimeout(stopRecording, 12000);
};

const shareOrDownload = async (share: boolean): Promise<void> => {
  if (!lastBlob) return;
  const file = new File([lastBlob], lastBlobName, { type: lastBlob.type });
  if (share && navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({
        files: [file],
        title: 'Volcano',
        text: `Kokeilin ${ring.name}-Volcanoa`,
      });
      return;
    } catch {
      /* käyttäjä perui */
    }
  }
  const url = URL.createObjectURL(lastBlob);
  const a = document.createElement('a');
  a.href = url;
  a.download = lastBlobName;
  a.click();
  URL.revokeObjectURL(url);
};

renderPicker();
renderWidths();
renderFingers();
syncProduct();
gateStrip.replaceChildren(
  ...RINGS.map((item) => {
    const img = document.createElement('img');
    img.src = item.image;
    img.alt = item.name;
    return img;
  }),
);

picker.addEventListener('click', (event) => {
  const btn = (event.target as HTMLElement).closest<HTMLButtonElement>('.ring-card');
  if (!btn?.dataset.id) return;
  const next = RINGS.find((item) => item.id === btn.dataset.id);
  if (next) applyRing(next);
});

widthsEl.addEventListener('click', (event) => {
  const btn = (event.target as HTMLElement).closest<HTMLButtonElement>('button');
  const mm = Number(btn?.dataset.mm);
  if (!mm) return;
  widthMm = mm;
  engine?.setWidth(mm);
  renderWidths();
});

fingersEl.addEventListener('click', (event) => {
  const btn = (event.target as HTMLElement).closest<HTMLButtonElement>('button');
  const id = btn?.dataset.finger as FingerId | undefined;
  if (!id) return;
  finger = id;
  engine?.setFinger(id);
  renderFingers();
});

sizeInput.addEventListener('input', () => {
  engine?.setSizeAdjust(Number(sizeInput.value) / 100);
});

$('size-down').addEventListener('click', () => {
  sizeInput.value = String(Math.max(75, Number(sizeInput.value) - 5));
  sizeInput.dispatchEvent(new Event('input'));
});

$('size-up').addEventListener('click', () => {
  sizeInput.value = String(Math.min(135, Number(sizeInput.value) + 5));
  sizeInput.dispatchEvent(new Event('input'));
});

$('start-cam').addEventListener('click', () => {
  void openLive().catch((error: unknown) => {
    loader.hidden = true;
    setStatus('Kameraa ei saatu käyttöön');
    window.alert(
      error instanceof Error
        ? error.message
        : 'Kameran avaus epäonnistui. Voit kokeilla myös kuvalla.',
    );
  });
});

$('start-demo').addEventListener('click', () => {
  void openStillUrl('/demo/hand.jpg').catch(() => {
    loader.hidden = true;
    window.alert('Esimerkkikuvan avaus epäonnistui.');
  });
});

$('tune-toggle').addEventListener('click', () => {
  const panel = $('tune-panel');
  panel.hidden = !panel.hidden;
  $('tune-toggle').textContent = panel.hidden
    ? 'Säädä leveyttä, sormea ja kokoa'
    : 'Piilota säädöt';
});

fileInput.addEventListener('change', () => {
  const file = fileInput.files?.[0];
  if (!file) return;
  void openImage(file).catch(() => {
    loader.hidden = true;
    window.alert('Kuvan avaus epäonnistui.');
  });
});

$('flip').addEventListener('click', () => {
  facing = facing === 'user' ? 'environment' : 'user';
  if (source === 'camera') void openLive();
});

$('shutter').addEventListener('click', () => {
  void capturePhoto();
});

$('record').addEventListener('click', () => {
  if (recording) stopRecording();
  else startRecording();
});

$('share-media').addEventListener('click', () => {
  void shareOrDownload(true);
});

$('save-media').addEventListener('click', () => {
  void shareOrDownload(false);
});

$('close-preview').addEventListener('click', () => {
  preview.hidden = true;
  previewVideo.pause();
});

document.addEventListener('visibilitychange', () => {
  if (document.hidden && source === 'camera') stopCamera(camera);
  else if (!document.hidden && source === 'camera' && gate.hidden) {
    void startCamera(camera, facing);
  }
});

if (new URLSearchParams(window.location.search).has('demo')) {
  const params = new URLSearchParams(window.location.search);
  const ringId = params.get('ring');
  const next = RINGS.find((item) => item.id === ringId);
  if (next) applyRing(next);
  void openStillUrl('/demo/hand.jpg').catch(() => {
    loader.hidden = true;
  });
}
