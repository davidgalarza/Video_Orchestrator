import { GoogleGenAI } from '@google/genai';
import type { GenerateVideosConfig } from '@google/genai';
import { getApiKey } from './store/settings';
import { getSettings } from './store/settings';
import { logUsage } from './db';

function getClient(): GoogleGenAI {
  const apiKey = getApiKey();
  if (!apiKey) {
    throw new Error('API key not configured. Please add your Google API key in Settings.');
  }
  return new GoogleGenAI({ apiKey });
}

export interface GenerationResult {
  videoBlob: Blob;
  mimeType: string;
}

export async function generateVideo(
  prompt: string,
  firstFrameImage?: Blob,
  onProgress?: (status: string) => void
): Promise<GenerationResult> {
  const client = getClient();
  const settings = getSettings();
  
  onProgress?.('Initializing generation...');

  // Build the full prompt
  const fullPrompt = `${settings.global_prompt_prefix} ${prompt} ${settings.global_prompt_suffix}`.trim();

  // Prepare image if provided
  let imageBytes: Uint8Array | undefined;
  if (firstFrameImage) {
    const arrayBuffer = await firstFrameImage.arrayBuffer();
    imageBytes = new Uint8Array(arrayBuffer);
  }

  const config: GenerateVideosConfig = {
    aspectRatio: settings.aspect_ratio,
    numberOfVideos: 1,
  };

  onProgress?.('Sending request to Veo...');

  try {
    const response = await client.models.generateVideos({
      model: settings.model_id,
      prompt: fullPrompt,
      image: imageBytes ? { bytes: imageBytes } : undefined,
      config,
    });

    onProgress?.('Processing video...');

    // Handle the response - videos come back as operations that need polling
    if (response.operation) {
      const operation = response.operation;
      
      // Poll for completion
      let attempts = 0;
      const maxAttempts = 180; // 30 minutes max (10s intervals)
      
      while (!operation.done && attempts < maxAttempts) {
        await new Promise(resolve => setTimeout(resolve, 10000)); // Wait 10s
        attempts++;
        onProgress?.(`Processing... (${attempts * 10}s)`);
        
        // Re-fetch operation status
        const updatedOp = await client.operations.get({ operation });
        Object.assign(operation, updatedOp);
      }

      if (!operation.done) {
        throw new Error('Video generation timed out after 30 minutes');
      }

      if (operation.error) {
        throw new Error(`Generation failed: ${operation.error.message}`);
      }

      // Extract video from response
      const generatedVideos = operation.response?.generatedVideos;
      if (!generatedVideos || generatedVideos.length === 0) {
        throw new Error('No video was generated');
      }

      const video = generatedVideos[0];
      if (!video.video?.uri) {
        throw new Error('Video URL not available in response');
      }

      // Download the video
      onProgress?.('Downloading video...');
      const videoResponse = await fetch(video.video.uri);
      if (!videoResponse.ok) {
        throw new Error('Failed to download generated video');
      }

      const videoBlob = await videoResponse.blob();

      // Log usage
      await logUsage('VIDEO', settings.model_id, 5000, 0.10);

      return {
        videoBlob,
        mimeType: 'video/mp4',
      };
    }

    throw new Error('Unexpected response format from API');
  } catch (error: any) {
    console.error('Video generation error:', error);
    
    // Check for specific error types
    if (error.message?.includes('API key not valid')) {
      throw new Error('Invalid API key. Please check your Google API key in Settings.');
    }
    if (error.message?.includes('quota')) {
      throw new Error('API quota exceeded. Please check your Google Cloud billing.');
    }
    if (error.status === 403) {
      throw new Error('API access denied. Make sure the Veo API is enabled for your project.');
    }
    
    throw error;
  }
}

export async function generateImage(prompt: string, numberOfImages: number = 1): Promise<Blob[]> {
  const client = getClient();
  const settings = getSettings();

  // Add aspect ratio hint to prompt
  const layoutHint = ` Aspect ratio: ${settings.aspect_ratio}.`;
  const fullPrompt = `${prompt}${layoutHint}`;

  const response = await client.models.generateContent({
    model: 'gemini-3.1-flash-image-preview',
    contents: fullPrompt,
    config: {
      responseModalities: ['IMAGE', 'TEXT'],
    },
  });

  const blobs: Blob[] = [];
  
  if (response.candidates) {
    for (const candidate of response.candidates) {
      if (candidate.content?.parts) {
        for (const part of candidate.content.parts) {
          if (part.inlineData) {
            const base64Data = part.inlineData.data;
            const mimeType = part.inlineData.mimeType || 'image/png';
            const binaryString = atob(base64Data);
            const bytes = new Uint8Array(binaryString.length);
            for (let i = 0; i < binaryString.length; i++) {
              bytes[i] = binaryString.charCodeAt(i);
            }
            blobs.push(new Blob([bytes], { type: mimeType }));
          }
        }
      }
    }
  }

  // Log usage
  const tokens = response.usageMetadata?.totalTokenCount || 1000;
  await logUsage('IMAGE', 'gemini-3.1-flash-image-preview', tokens, 0.01 * blobs.length);

  return blobs;
}

export function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

export async function dataUrlToBlob(dataUrl: string): Promise<Blob> {
  const response = await fetch(dataUrl);
  return response.blob();
}
