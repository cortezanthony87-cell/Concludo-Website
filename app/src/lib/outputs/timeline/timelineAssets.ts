import { TimelineAssetBundle } from './types';

let inMemoryAssetCache: TimelineAssetBundle | null = null;

async function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const res = reader.result as string;
      resolve(res);
    };
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

async function fetchAssetAsBase64(url: string, mime: string): Promise<string> {
  try {
    const resp = await fetch(url);
    if (!resp.ok) {
      throw new Error(`Failed to load asset from ${url}: status ${resp.status}`);
    }
    const blob = await resp.blob();
    const dataUrl = await blobToBase64(blob);
    return dataUrl;
  } catch (err) {
    console.warn(`[Timeline] Could not fetch ${url}:`, err);
    return '';
  }
}

/**
 * Loads the 6 high-resolution background JPGs and lockup logo for PowerPoint generation.
 * In Node/tests, reads directly from disk.
 * In browser, fetches static assets from /assets/timeline/ and caches them in memory.
 */
export async function loadTimelineAssets(): Promise<TimelineAssetBundle> {
  if (inMemoryAssetCache) {
    return inMemoryAssetCache;
  }

  // Check if running in Node / Bun
  if (typeof window === 'undefined') {
    try {
      const fsMod = 'node:fs';
      const pathMod = 'node:path';
      const fs = await import(/* @vite-ignore */ fsMod);
      const path = await import(/* @vite-ignore */ pathMod);
      const root = path.resolve(process.cwd());
      // Try potential locations
      const candidates = [
        path.join(root, 'public/assets/timeline'),
        path.join(root, 'app/public/assets/timeline'),
        '/tmp/concludo-repo/app/public/assets/timeline',
      ];
      let assetDir = '';
      for (const c of candidates) {
        if (fs.existsSync(c)) {
          assetDir = c;
          break;
        }
      }
      if (assetDir) {
        const toB64 = (f: string, mime: string) =>
          `data:${mime};base64,` + fs.readFileSync(path.join(assetDir, f)).toString('base64');

        inMemoryAssetCache = {
          cover: toB64('bg_cover.jpg', 'image/jpeg'),
          roadmap: toB64('bg_roadmap.jpg', 'image/jpeg'),
          grid: toB64('bg_grid.jpg', 'image/jpeg'),
          ridge: toB64('bg_ridge.jpg', 'image/jpeg'),
          attention: toB64('bg_attention.jpg', 'image/jpeg'),
          close: toB64('bg_close.jpg', 'image/jpeg'),
          logo: toB64('lockup.png', 'image/png'),
        };
        return inMemoryAssetCache;
      }
    } catch {
      // Fall through to browser fetch
    }
  }

  // Browser environment
  const base = '/assets/timeline';
  const [cover, roadmap, grid, ridge, attention, close, logo] = await Promise.all([
    fetchAssetAsBase64(`${base}/bg_cover.jpg`, 'image/jpeg'),
    fetchAssetAsBase64(`${base}/bg_roadmap.jpg`, 'image/jpeg'),
    fetchAssetAsBase64(`${base}/bg_grid.jpg`, 'image/jpeg'),
    fetchAssetAsBase64(`${base}/bg_ridge.jpg`, 'image/jpeg'),
    fetchAssetAsBase64(`${base}/bg_attention.jpg`, 'image/jpeg'),
    fetchAssetAsBase64(`${base}/bg_close.jpg`, 'image/jpeg'),
    fetchAssetAsBase64(`${base}/lockup.png`, 'image/png'),
  ]);

  inMemoryAssetCache = {
    cover,
    roadmap,
    grid,
    ridge,
    attention,
    close,
    logo,
  };

  return inMemoryAssetCache;
}

export function clearTimelineAssetCache(): void {
  inMemoryAssetCache = null;
}
