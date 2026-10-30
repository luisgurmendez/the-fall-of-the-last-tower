/**
 * PixelLab image generation for the icon scripts: one transparent pixel art
 * image from a description (create-image-pixen), retrying while PixelLab is
 * busy, and a small worker pool to run several at once.
 */

const API = 'https://api.pixellab.ai/v2';
const MAX_ATTEMPTS = 5;
/** PixelLab answers 429 past a few jobs at once */
export const PIXELLAB_CONCURRENCY = 3;

export interface PixenRequest {
  description: string;
  size: number;
  seed: number;
}

/**
 * Generate a square image with a transparent background. Returns the PNG and its price.
 */
export async function generatePixenImage(apiKey: string, request: PixenRequest): Promise<{ png: Buffer; usd: number }> {
  for (let attempt = 1; ; attempt++) {
    const response = await fetch(`${API}/create-image-pixen`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        description: request.description,
        image_size: { width: request.size, height: request.size },
        no_background: true,
        outline: 'single color black outline',
        seed: request.seed,
      }),
    });
    if (response.status === 429 && attempt < MAX_ATTEMPTS) {
      await new Promise(resolve => setTimeout(resolve, 5000 * attempt));
      continue;
    }
    if (!response.ok) throw new Error(`HTTP ${response.status}: ${await response.text()}`);
    const body = await response.json() as { image: { base64: string }; usage?: { usd?: number } };
    return { png: Buffer.from(body.image.base64, 'base64'), usd: body.usage?.usd ?? 0 };
  }
}

/**
 * Run jobs a few at a time.
 */
export async function runPool<T>(jobs: T[], worker: (job: T) => Promise<void>, concurrency = PIXELLAB_CONCURRENCY): Promise<void> {
  let next = 0;
  await Promise.all(Array.from({ length: concurrency }, async () => {
    while (next < jobs.length) {
      await worker(jobs[next++]);
    }
  }));
}
