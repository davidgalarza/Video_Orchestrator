import { GoogleGenAI } from '@google/genai';
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

// Global to track if generation should be aborted
let abortGeneration = false;

export function stopGeneration() {
  abortGeneration = true;
}

export function resetGenerationState() {
  abortGeneration = false;
}

export async function generateVideo(
  prompt: string,
  firstFrameImage?: Blob,
  onProgress?: (status: string) => void,
  signal?: AbortSignal
): Promise<GenerationResult> {
  // Reset at start of new generation
  abortGeneration = false;
  
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

  const config = {
    aspectRatio: settings.aspect_ratio,
    numberOfVideos: 1,
  };

  onProgress?.('Sending request to Veo...');

  try {
    // Prepare image parameter - Google GenAI expects base64 string or file URI
    let imageParam = undefined;
    if (imageBytes) {
      // Convert bytes to base64
      const base64 = btoa(String.fromCharCode(...imageBytes));
      imageParam = {
        data: base64,
        mimeType: 'image/jpeg',
      };
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const response = await (client.models as unknown as { generateVideos: (params: unknown) => Promise<unknown> }).generateVideos({
      model: settings.model_id,
      prompt: fullPrompt,
      image: imageParam,
      config,
    });

    onProgress?.('Processing video...');

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const op = response as any;
    console.log('Video generation response:', JSON.stringify(op, null, 2));

    // Handle operation-based response (long-running operation)
    if (op && ('done' in op || 'name' in op || op.metadata)) {
      const operation = op;
      
      // Poll for completion if not done
      if (!operation.done) {
        let attempts = 0;
        const maxAttempts = 180; // 30 minutes max (10s intervals)
        
        while (!operation.done && attempts < maxAttempts) {
          // Check for abort signal
          if (abortGeneration || signal?.aborted) {
            throw new Error('Generation cancelled by user');
          }
          
          await new Promise(resolve => setTimeout(resolve, 10000)); // Wait 10s
          attempts++;
          onProgress?.(`Processing... (${attempts * 10}s)`);
          
          try {
            // Try different possible method names for getting operation status
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const ops = client.operations as any;
            let updatedOp;
            
            if (ops.get) {
              updatedOp = await ops.get({ operation });
            } else if (ops.getOperation) {
              updatedOp = await ops.getOperation({ operation });
            } else if (ops.fetch) {
              updatedOp = await ops.fetch({ operation });
            } else if (operation.name) {
              // Fallback: poll via REST API directly
              const apiKey = getApiKey();
              const pollResponse = await fetch(
                `https://generativelanguage.googleapis.com/v1beta/${operation.name}?key=${apiKey}`,
                {
                  headers: {
                    'Content-Type': 'application/json',
                  },
                }
              );
              if (pollResponse.ok) {
                updatedOp = await pollResponse.json();
                console.log('Poll response:', updatedOp);
              } else {
                const errorText = await pollResponse.text();
                console.warn('Poll HTTP error:', pollResponse.status, errorText);
              }
            } else {
              // If no polling method exists, just wait and assume it's still processing
              console.warn('No operations.get method found, waiting...');
              continue;
            }
            
            if (updatedOp) {
              Object.assign(operation, updatedOp);
            }
          } catch (pollErr) {
            console.warn('Polling error:', pollErr);
            // Continue polling even if one request fails
          }
        }
      }

      if (!operation.done) {
        throw new Error('Video generation timed out after 30 minutes');
      }

      if (operation.error) {
        throw new Error(`Generation failed: ${operation.error.message || operation.error}`);
      }

      // Debug: Log full operation structure
      console.log('Operation complete:', JSON.stringify(operation, null, 2));

      // Extract video from operation response
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const result = operation.response || operation.result || operation;
      console.log('Result object:', JSON.stringify(result, null, 2));
      
      // Try multiple possible paths for generated videos
      let generatedVideos = result?.generatedVideos || result?.videos;
      
      // Veo 3.1 specific path: response.generateVideoResponse.generatedSamples
      if (!generatedVideos && result?.generateVideoResponse?.generatedSamples) {
        generatedVideos = result.generateVideoResponse.generatedSamples;
      }
      
      // Handle single video object (not array)
      if (!generatedVideos && result?.video) {
        generatedVideos = [result];
      }
      
      // Handle nested response structure
      if (!generatedVideos && result?.response?.generatedVideos) {
        generatedVideos = result.response.generatedVideos;
      }
      
      console.log('Generated videos:', generatedVideos);
      
      if (!generatedVideos || generatedVideos.length === 0) {
        // Check for inline video data
        const inlineData = result?.inlineData || operation.response?.inlineData || result?.video?.inlineData;
        if (inlineData?.data) {
          console.log('Found inline video data');
          const base64Data = inlineData.data;
          const binaryString = atob(base64Data);
          const bytes = new Uint8Array(binaryString.length);
          for (let i = 0; i < binaryString.length; i++) {
            bytes[i] = binaryString.charCodeAt(i);
          }
          await logUsage('VIDEO', settings.model_id, 5000, 0.10);
          return { videoBlob: new Blob([bytes], { type: 'video/mp4' }), mimeType: 'video/mp4' };
        }
        
        console.error('No videos found. Full operation:', operation);
        throw new Error('No video was generated');
      }

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const video = generatedVideos[0] as { video?: { uri?: string }; uri?: string; url?: string; inlineData?: { data?: string } };
      
      // Check for inline data in video object
      if (video.inlineData?.data) {
        console.log('Found inline video data in video object');
        const base64Data = video.inlineData.data;
        const binaryString = atob(base64Data);
        const bytes = new Uint8Array(binaryString.length);
        for (let i = 0; i < binaryString.length; i++) {
          bytes[i] = binaryString.charCodeAt(i);
        }
        await logUsage('VIDEO', settings.model_id, 5000, 0.10);
        return { videoBlob: new Blob([bytes], { type: 'video/mp4' }), mimeType: 'video/mp4' };
      }
      
      const videoUri = video.video?.uri || video.uri || video.url;
      
      if (!videoUri) {
        console.error('Video response structure:', JSON.stringify(video, null, 2));
        throw new Error('Video URL not available in response');
      }

      // Download the video - add API key to URL
      onProgress?.('Downloading video...');
      const apiKey = getApiKey();
      const downloadUrl = videoUri.includes('?') 
        ? `${videoUri}&key=${apiKey}` 
        : `${videoUri}?key=${apiKey}`;
      const videoResponse = await fetch(downloadUrl);
      if (!videoResponse.ok) {
        throw new Error(`Failed to download generated video: ${videoResponse.status}`);
      }

      const videoBlob = await videoResponse.blob();

      // Log usage
      await logUsage('VIDEO', settings.model_id, 5000, 0.10);

      return {
        videoBlob,
        mimeType: 'video/mp4',
      };
    }

    // Handle direct response (video immediately available)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    if (op?.generatedVideos || op?.videos) {
      const generatedVideos = op.generatedVideos || op.videos;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const video = generatedVideos[0] as { video?: { uri?: string }; uri?: string; url?: string };
      const videoUri = video.video?.uri || video.uri || video.url;
      
      if (videoUri) {
        onProgress?.('Downloading video...');
        const videoResponse = await fetch(videoUri);
        const videoBlob = await videoResponse.blob();
        await logUsage('VIDEO', settings.model_id, 5000, 0.10);
        return { videoBlob, mimeType: 'video/mp4' };
      }
    }

    // Handle inline video data (base64)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    if (op?.video?.data || op?.inlineData?.data) {
      const base64Data = op.video?.data || op?.inlineData?.data;
      const binaryString = atob(base64Data);
      const bytes = new Uint8Array(binaryString.length);
      for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }
      await logUsage('VIDEO', settings.model_id, 5000, 0.10);
      return { videoBlob: new Blob([bytes], { type: 'video/mp4' }), mimeType: 'video/mp4' };
    }

    console.error('Unrecognized response format:', JSON.stringify(op, null, 2));
    throw new Error(`Unexpected response format from API: ${Object.keys(op || {}).join(', ')}`);
  } catch (error: unknown) {
    console.error('Video generation error:', error);
    
    // Dynamic error message extraction
    let message = 'Video generation failed';
    
    if (error instanceof Error) {
      message = error.message;
      
      // Try to parse JSON error messages from API
      try {
        const jsonMatch = message.match(/\{.*\}/);
        if (jsonMatch) {
          const parsed = JSON.parse(jsonMatch[0]);
          message = parsed.error?.message || 
                    parsed.message || 
                    parsed.error?.details?.[0]?.message ||
                    message;
        }
      } catch {
        // Not JSON, use original message
      }
    }
    
    // Map common API errors to user-friendly messages
    if (message.includes('API key not valid')) {
      throw new Error('Invalid API key. Please check your Google API key in Settings.');
    }
    if (message.includes('quota')) {
      throw new Error('API quota exceeded. Please check your Google Cloud billing.');
    }
    if (message.includes('403') || message.includes('permission') || (error as { status?: number }).status === 403) {
      throw new Error('API access denied. Make sure the Veo API is enabled for your project.');
    }
    if (message.includes('404')) {
      throw new Error('API endpoint not found. The Veo model may not be available in your region.');
    }
    if (message.includes('429')) {
      throw new Error('Rate limit exceeded. Please try again in a few moments.');
    }
    if (message.includes('500') || message.includes('internal')) {
      throw new Error('Google API service error. Please try again later.');
    }
    if (message.includes('network') || message.includes('fetch') || message.includes('ECONNREFUSED')) {
      throw new Error('Network error. Check your internet connection and try again.');
    }
    if (message.includes('timeout') || message.includes('ETIMEDOUT')) {
      throw new Error('Request timed out. The video generation service may be busy.');
    }
    
    // Re-throw with cleaned message if not a known error type
    throw new Error(message);
  }
}

export async function generateImage(prompt: string, _numberOfImages: number = 1): Promise<Blob[]> {
  const client = getClient();
  const settings = getSettings();

  // Add aspect ratio hint to prompt
  const layoutHint = ` Aspect ratio: ${settings.aspect_ratio}.`;
  const fullPrompt = `${prompt}${layoutHint}`;

  // Note: numberOfImages parameter is reserved for future use
  // Gemini currently generates one image per request
  try {
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
              if (!base64Data) continue;
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
  } catch (error: unknown) {
    console.error('Image generation error:', error);
    
    // Dynamic error message extraction (same pattern as video generation)
    let message = 'Image generation failed';
    
    if (error instanceof Error) {
      message = error.message;
      
      try {
        const jsonMatch = message.match(/\{.*\}/);
        if (jsonMatch) {
          const parsed = JSON.parse(jsonMatch[0]);
          message = parsed.error?.message || 
                    parsed.message || 
                    parsed.error?.details?.[0]?.message ||
                    message;
        }
      } catch {
        // Not JSON, use original message
      }
    }
    
    // Map common API errors
    if (message.includes('API key not valid')) {
      throw new Error('Invalid API key. Please check your Google API key in Settings.');
    }
    if (message.includes('quota')) {
      throw new Error('API quota exceeded. Please check your Google Cloud billing.');
    }
    if (message.includes('403') || message.includes('permission')) {
      throw new Error('API access denied. Make sure the Gemini API is enabled for your project.');
    }
    if (message.includes('429')) {
      throw new Error('Rate limit exceeded. Please try again in a few moments.');
    }
    if (message.includes('500') || message.includes('internal')) {
      throw new Error('Google API service error. Please try again later.');
    }
    if (message.includes('network') || message.includes('fetch')) {
      throw new Error('Network error. Check your internet connection.');
    }
    
    throw new Error(message);
  }
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
