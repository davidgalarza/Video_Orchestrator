import { FFmpeg } from '@ffmpeg/ffmpeg';
import { fetchFile, toBlobURL } from '@ffmpeg/util';

let ffmpeg: FFmpeg | null = null;

async function getFFmpeg(): Promise<FFmpeg> {
  if (ffmpeg) return ffmpeg;
  
  ffmpeg = new FFmpeg();
  
  // Load ffmpeg.wasm from CDN
  const baseURL = 'https://unpkg.com/@ffmpeg/core@0.12.6/dist/umd';
  await ffmpeg.load({
    coreURL: await toBlobURL(`${baseURL}/ffmpeg-core.js`, 'text/javascript'),
    wasmURL: await toBlobURL(`${baseURL}/ffmpeg-core.wasm`, 'application/wasm'),
  });
  
  return ffmpeg;
}

export async function stitchVideos(videoBlobs: Blob[]): Promise<Blob> {
  if (videoBlobs.length === 0) {
    throw new Error('No videos to stitch');
  }
  
  if (videoBlobs.length === 1) {
    return videoBlobs[0];
  }
  
  const ffmpeg = await getFFmpeg();
  const inputFiles: string[] = [];
  
  // Write all video files to FFmpeg's virtual filesystem
  for (let i = 0; i < videoBlobs.length; i++) {
    const filename = `input${i}.mp4`;
    await ffmpeg.writeFile(filename, await fetchFile(videoBlobs[i]));
    inputFiles.push(filename);
  }
  
  // Create concat list file
  const concatList = inputFiles.map(f => `file '${f}'`).join('\n');
  await ffmpeg.writeFile('list.txt', concatList);
  
  // Run concat demuxer
  await ffmpeg.exec([
    '-f', 'concat',
    '-safe', '0',
    '-i', 'list.txt',
    '-c', 'copy',
    'output.mp4'
  ]);
  
  // Read output file
  const data = await ffmpeg.readFile('output.mp4') as Uint8Array;
  const outputBlob = new Blob([data as unknown as BlobPart], { type: 'video/mp4' });
  
  // Cleanup
  for (const file of inputFiles) {
    await ffmpeg.deleteFile(file);
  }
  await ffmpeg.deleteFile('list.txt');
  await ffmpeg.deleteFile('output.mp4');
  
  return outputBlob;
}

export async function extractFirstFrame(videoBlob: Blob): Promise<Blob> {
  const ffmpeg = await getFFmpeg();
  
  // Write video file
  await ffmpeg.writeFile('input.mp4', await fetchFile(videoBlob));
  
  // Extract first frame
  await ffmpeg.exec([
    '-i', 'input.mp4',
    '-ss', '00:00:00',
    '-vframes', '1',
    '-q:v', '2',
    'frame.jpg'
  ]);
  
  // Read frame
  const data = await ffmpeg.readFile('frame.jpg') as Uint8Array;
  const frameBlob = new Blob([data as unknown as BlobPart], { type: 'image/jpeg' });
  
  // Cleanup
  await ffmpeg.deleteFile('input.mp4');
  await ffmpeg.deleteFile('frame.jpg');
  
  return frameBlob;
}

export async function extractLastFrame(videoBlob: Blob): Promise<Blob> {
  const ffmpeg = await getFFmpeg();
  
  // Write video file
  await ffmpeg.writeFile('input.mp4', await fetchFile(videoBlob));
  
  // Get video duration first
  await ffmpeg.exec([
    '-i', 'input.mp4',
    '-f', 'null',
    '-'
  ]);
  
  // Extract last frame (use a time close to end)
  await ffmpeg.exec([
    '-sseof', '-0.1', // Seek to 0.1s before end
    '-i', 'input.mp4',
    '-vframes', '1',
    '-q:v', '2',
    'frame.jpg'
  ]);
  
  // Read frame
  const data = await ffmpeg.readFile('frame.jpg') as Uint8Array;
  const frameBlob = new Blob([data as unknown as BlobPart], { type: 'image/jpeg' });
  
  // Cleanup
  await ffmpeg.deleteFile('input.mp4');
  await ffmpeg.deleteFile('frame.jpg');
  
  return frameBlob;
}

export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
