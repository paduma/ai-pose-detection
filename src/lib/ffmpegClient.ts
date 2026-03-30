import { FFmpeg } from '@ffmpeg/ffmpeg';
import { fetchFile } from '@ffmpeg/util';

let ffmpegInstance: FFmpeg | null = null;
let loadPromise: Promise<FFmpeg> | null = null;

export async function loadFFmpeg(): Promise<FFmpeg> {
  if (ffmpegInstance) return ffmpegInstance;
  if (loadPromise) return loadPromise;

  loadPromise = (async () => {
    const ffmpeg = new FFmpeg();
    ffmpeg.on('log', ({ message }) => console.log('[FFmpeg]', message));

    try {
      // 使用绝对 URL，确保 worker 内部的 import(coreURL) 能正确加载
      // （webpack 已配置不劫持 @ffmpeg 包内的动态 import）
      const base = window.location.origin;
      await ffmpeg.load({
        coreURL: `${base}/ffmpeg/ffmpeg-core.js`,
        wasmURL: `${base}/ffmpeg/ffmpeg-core.wasm`,
      });
    } catch (err) {
      loadPromise = null;
      const msg = typeof SharedArrayBuffer === 'undefined'
        ? 'FFmpeg 加载失败：浏览器不支持 SharedArrayBuffer。请确认页面返回了 COOP/COEP 安全头。'
        : `FFmpeg 加载失败：${err instanceof Error ? err.message : err}`;
      throw new Error(msg);
    }

    ffmpegInstance = ffmpeg;
    return ffmpeg;
  })();

  return loadPromise;
}

export async function extractThumbnail(inputFile: File): Promise<Blob> {
  const ffmpeg = await loadFFmpeg();
  const inputName = 'input' + getExt(inputFile.name);

  await ffmpeg.writeFile(inputName, await fetchFile(inputFile));
  await ffmpeg.exec(['-i', inputName, '-vframes', '1', '-q:v', '2', 'thumb.jpg']);

  const data = await ffmpeg.readFile('thumb.jpg') as Uint8Array;
  await ffmpeg.deleteFile(inputName);
  await ffmpeg.deleteFile('thumb.jpg');

  return toBlob(data, 'image/jpeg');
}

export async function compressVideo(
  inputFile: File,
  quality: 'low' | 'medium' | 'high' = 'medium',
  onProgress?: (p: number) => void
): Promise<Blob> {
  const ffmpeg = await loadFFmpeg();
  if (onProgress) ffmpeg.on('progress', ({ progress }) => onProgress(Math.round(progress * 100)));

  const crf = { low: 28, medium: 23, high: 18 };
  const inputName = 'input' + getExt(inputFile.name);

  await ffmpeg.writeFile(inputName, await fetchFile(inputFile));
  await ffmpeg.exec(['-i', inputName, '-c:v', 'libx264', '-crf', crf[quality].toString(), '-preset', 'fast', '-c:a', 'aac', 'output.mp4']);

  const data = await ffmpeg.readFile('output.mp4') as Uint8Array;
  await ffmpeg.deleteFile(inputName);
  await ffmpeg.deleteFile('output.mp4');

  return toBlob(data, 'video/mp4');
}

export async function trimVideo(
  inputFile: File,
  startTime: number,
  duration: number,
  onProgress?: (p: number) => void
): Promise<Blob> {
  const ffmpeg = await loadFFmpeg();
  if (onProgress) ffmpeg.on('progress', ({ progress }) => onProgress(Math.round(progress * 100)));

  const inputName = 'input' + getExt(inputFile.name);
  await ffmpeg.writeFile(inputName, await fetchFile(inputFile));
  await ffmpeg.exec(['-i', inputName, '-ss', startTime.toString(), '-t', duration.toString(), '-c:v', 'libx264', '-c:a', 'aac', '-preset', 'fast', 'output.mp4']);

  const data = await ffmpeg.readFile('output.mp4') as Uint8Array;
  await ffmpeg.deleteFile(inputName);
  await ffmpeg.deleteFile('output.mp4');

  return toBlob(data, 'video/mp4');
}

export async function resizeVideo(
  inputFile: File,
  width: number,
  height: number,
  onProgress?: (p: number) => void
): Promise<Blob> {
  const ffmpeg = await loadFFmpeg();
  if (onProgress) ffmpeg.on('progress', ({ progress }) => onProgress(Math.round(progress * 100)));

  const inputName = 'input' + getExt(inputFile.name);
  await ffmpeg.writeFile(inputName, await fetchFile(inputFile));
  await ffmpeg.exec(['-i', inputName, '-vf', `scale=${width}:${height}`, '-c:a', 'copy', 'output.mp4']);

  const data = await ffmpeg.readFile('output.mp4') as Uint8Array;
  await ffmpeg.deleteFile(inputName);
  await ffmpeg.deleteFile('output.mp4');

  return toBlob(data, 'video/mp4');
}

function getExt(name: string): string {
  const i = name.lastIndexOf('.');
  return i === -1 ? '' : name.substring(i);
}

// FFmpeg readFile 返回的 Uint8Array 可能基于 SharedArrayBuffer，
// TS 5.x 不允许直接作为 BlobPart，需要拷贝到普通 ArrayBuffer
function toBlob(data: Uint8Array, type: string): Blob {
  return new Blob([new Uint8Array(data)], { type });
}

export function cleanupFFmpeg() {
  if (ffmpegInstance) {
    ffmpegInstance.terminate();
    ffmpegInstance = null;
  }
}
