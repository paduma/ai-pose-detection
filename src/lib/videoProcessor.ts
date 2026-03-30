import ffmpeg from 'fluent-ffmpeg';
import { promises as fs } from 'fs';
import path from 'path';

export interface VideoProcessingOptions {
  inputPath: string;
  outputPath: string;
  startTime?: number;
  duration?: number;
  width?: number;
  height?: number;
  fps?: number;
}

export async function trimVideo(options: VideoProcessingOptions): Promise<string> {
  const { inputPath, outputPath, startTime = 0, duration } = options;

  return new Promise((resolve, reject) => {
    let command = ffmpeg(inputPath);
    if (startTime > 0) command = command.setStartTime(startTime);
    if (duration) command = command.setDuration(duration);

    command
      .output(outputPath)
      .on('end', () => resolve(outputPath))
      .on('error', (err) => reject(err))
      .run();
  });
}

export async function resizeVideo(options: VideoProcessingOptions): Promise<string> {
  const { inputPath, outputPath, width, height } = options;

  return new Promise((resolve, reject) => {
    let command = ffmpeg(inputPath);
    if (width && height) command = command.size(`${width}x${height}`);
    else if (width) command = command.size(`${width}x?`);
    else if (height) command = command.size(`?x${height}`);

    command
      .output(outputPath)
      .on('end', () => resolve(outputPath))
      .on('error', (err) => reject(err))
      .run();
  });
}

export async function extractFrames(
  inputPath: string,
  outputDir: string,
  fps: number = 1
): Promise<string[]> {
  await fs.mkdir(outputDir, { recursive: true });

  return new Promise((resolve, reject) => {
    ffmpeg(inputPath)
      .fps(fps)
      .output(path.join(outputDir, 'frame-%04d.jpg'))
      .on('end', async () => {
        const files = await fs.readdir(outputDir);
        const frameFiles = files
          .filter((f) => f.startsWith('frame-'))
          .map((f) => path.join(outputDir, f));
        resolve(frameFiles);
      })
      .on('error', (err) => reject(err))
      .run();
  });
}


export async function getVideoInfo(inputPath: string): Promise<any> {
  return new Promise((resolve, reject) => {
    ffmpeg.ffprobe(inputPath, (err, metadata) => {
      if (err) reject(err);
      else resolve(metadata);
    });
  });
}

export async function compressVideo(
  inputPath: string,
  outputPath: string,
  quality: 'low' | 'medium' | 'high' = 'medium'
): Promise<string> {
  const crfValues = { low: 28, medium: 23, high: 18 };

  return new Promise((resolve, reject) => {
    ffmpeg(inputPath)
      .videoCodec('libx264')
      .outputOptions([`-crf ${crfValues[quality]}`, '-preset fast'])
      .output(outputPath)
      .on('end', () => resolve(outputPath))
      .on('error', (err) => reject(err))
      .run();
  });
}
