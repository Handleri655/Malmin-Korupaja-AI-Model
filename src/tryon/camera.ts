export const startCamera = async (
  video: HTMLVideoElement,
  facing: 'user' | 'environment',
): Promise<MediaStream> => {
  stopCamera(video);

  const tryConstraints = async (
    constraints: MediaStreamConstraints,
  ): Promise<MediaStream> => navigator.mediaDevices.getUserMedia(constraints);

  let stream: MediaStream;
  try {
    stream = await tryConstraints({
      audio: false,
      video: {
        facingMode: { ideal: facing },
        width: { ideal: 1280 },
        height: { ideal: 720 },
        frameRate: { ideal: 30 },
      },
    });
  } catch {
    stream = await tryConstraints({ audio: false, video: true });
  }

  video.srcObject = stream;
  video.muted = true;
  video.playsInline = true;
  await video.play();
  return stream;
};

export const stopCamera = (video: HTMLVideoElement): void => {
  const stream = video.srcObject;
  if (stream instanceof MediaStream) {
    for (const track of stream.getTracks()) track.stop();
  }
  video.srcObject = null;
};

export const pickRecorderMime = (): string => {
  if (typeof MediaRecorder === 'undefined') return '';
  const types = [
    'video/mp4;codecs=avc1.42E01E',
    'video/mp4',
    'video/webm;codecs=vp9',
    'video/webm;codecs=vp8',
    'video/webm',
  ];
  return types.find((type) => MediaRecorder.isTypeSupported(type)) ?? '';
};

export const compositeFrame = (
  ctx: CanvasRenderingContext2D,
  video: CanvasImageSource,
  overlay: HTMLCanvasElement,
  width: number,
  height: number,
  mirror: boolean,
): void => {
  ctx.save();
  if (mirror) {
    ctx.translate(width, 0);
    ctx.scale(-1, 1);
  }
  ctx.drawImage(video, 0, 0, width, height);
  ctx.drawImage(overlay, 0, 0, width, height);
  ctx.restore();
};

export const canvasToBlob = (
  canvas: HTMLCanvasElement,
  type: string,
  quality?: number,
): Promise<Blob> =>
  new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) resolve(blob);
      else reject(new Error('Kuvan tallennus epäonnistui'));
    }, type, quality);
  });
