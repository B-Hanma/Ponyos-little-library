/**
 * image.js — making an uploaded picture into a book cover.
 *
 * ── WHY THIS EXISTS ───────────────────────────────────────────────
 * Every cover in this library is drawn into the same box: a 2:3
 * hardback, seen very slightly from the side. The generated covers are
 * 2:3 by construction and the Open Library photographs are close enough
 * that nobody notices. An image she picks off her phone is not: it is
 * 4:3, or 16:9, or a square screenshot, or a 9:16 photo of a paperback
 * held at arm's length.
 *
 * Before today those went into storage exactly as chosen, and the CSS
 * made them fit with `object-fit: cover` — which works, but means the
 * library carries a 4 MB phone photo to show a 168-pixel thumbnail, and
 * that the same 4 MB travels in every backup from then on.
 *
 * So an uploaded cover is now processed on the way in: cropped from the
 * middle to 2:3, resampled to 600 x 900, and re-encoded as JPEG. One
 * decode, one resize, one encode, and then everything full-resolution
 * is released.
 *
 * ── WHAT IS DELIBERATELY NOT HERE ─────────────────────────────────
 * No face detection, no saliency, no "smart" crop. A centre crop is
 * predictable, and predictable is what you want when the thing being
 * cropped is the cover of a book she chose — the title is nearly always
 * in the middle. Nothing here reaches for the DOM beyond a detached
 * canvas, and nothing is installed.
 */

/** The canonical cover box. Everything in the app draws into this shape. */
export const COVER_WIDTH = 600;
export const COVER_HEIGHT = 900;
export const COVER_MIME = 'image/jpeg';

/**
 * 0.85 is the usual sweet spot: visually indistinguishable from 1.0 at
 * this size, and roughly a third of the bytes.
 */
export const COVER_QUALITY = 0.85;

/** Refuse absurd input rather than letting the browser die trying. */
const MAX_SOURCE_PIXELS = 80_000_000;   // ~80 megapixels
const MAX_SOURCE_BYTES = 40 * 1024 * 1024;

export class ImageProcessingError extends Error {
  constructor(message, { cause } = {}) {
    super(message);
    this.name = 'ImageProcessingError';
    this.cause = cause;
  }
}

/* ──────────────────────────── the maths ─────────────────────────── */

/**
 * The centre-crop rectangle that fills a target box without distortion.
 *
 * This is the whole cropping policy, and it is a pure function of four
 * numbers so it can be reasoned about and tested without a browser.
 *
 * The rule is the one CSS calls `cover`: scale until both axes are
 * covered, then trim the overflow evenly from both sides.
 *
 *   source wider than the target  ->  trim left and right
 *   source taller than the target ->  trim top and bottom
 *
 * The returned rectangle always has (very close to) the target's own
 * aspect ratio, which is exactly why drawing it into the target cannot
 * stretch anything: the scale factor is the same on both axes.
 *
 * @param {number} sourceWidth
 * @param {number} sourceHeight
 * @param {number} [targetWidth]
 * @param {number} [targetHeight]
 * @returns {{sx: number, sy: number, sw: number, sh: number, axis: 'horizontal'|'vertical'|'none'}}
 */
export function coverCrop(sourceWidth, sourceHeight, targetWidth = COVER_WIDTH, targetHeight = COVER_HEIGHT) {
  const sw0 = Math.max(0, Math.floor(Number(sourceWidth) || 0));
  const sh0 = Math.max(0, Math.floor(Number(sourceHeight) || 0));
  if (!sw0 || !sh0) {
    throw new ImageProcessingError('That image has no size the browser can read.');
  }

  const targetRatio = targetWidth / targetHeight;
  const sourceRatio = sw0 / sh0;

  // A tolerance, because a 1000x1500 photo and a 1001x1500 photo should
  // both count as "already 2:3" rather than producing a one-pixel trim.
  if (Math.abs(sourceRatio - targetRatio) < 1e-6) {
    return { sx: 0, sy: 0, sw: sw0, sh: sh0, axis: 'none' };
  }

  if (sourceRatio > targetRatio) {
    // Wider than 2:3 — a landscape photo, or a square. Trim the sides.
    const sw = Math.max(1, Math.round(sh0 * targetRatio));
    return {
      sx: Math.max(0, Math.round((sw0 - sw) / 2)),
      sy: 0,
      sw: Math.min(sw, sw0),
      sh: sh0,
      axis: 'horizontal',
    };
  }

  // Taller and narrower than 2:3 — a phone photo. Trim top and bottom.
  const sh = Math.max(1, Math.round(sw0 / targetRatio));
  return {
    sx: 0,
    sy: Math.max(0, Math.round((sh0 - sh) / 2)),
    sw: sw0,
    sh: Math.min(sh, sh0),
    axis: 'vertical',
  };
}

/* ───────────────────────────── decoding ─────────────────────────── */

/**
 * Decode an image blob, preferring `createImageBitmap`.
 *
 * `createImageBitmap` is the right tool: it decodes off the main thread,
 * needs no object URL, and honours EXIF orientation when asked — which
 * matters, because a photo taken in portrait carries its rotation in
 * metadata rather than in its pixels, and ignoring that would crop the
 * wrong part of a sideways image.
 *
 * The `<img>` path is the fallback, and it also covers formats
 * `createImageBitmap` declines (SVG, in some browsers). Modern engines
 * apply EXIF orientation to `<img>` by default.
 */
async function decodeImage(blob) {
  if (typeof createImageBitmap === 'function') {
    try {
      const bitmap = await createImageBitmap(blob, { imageOrientation: 'from-image' });
      if (bitmap?.width && bitmap?.height) {
        return {
          source: bitmap,
          width: bitmap.width,
          height: bitmap.height,
          release: () => bitmap.close?.(),
        };
      }
      bitmap?.close?.();
    } catch {
      /* fall through to the <img> path */
    }
  }

  const url = URL.createObjectURL(blob);
  try {
    const image = await new Promise((resolve, reject) => {
      const el = new Image();
      el.decoding = 'async';
      el.onload = () => resolve(el);
      el.onerror = () => reject(new ImageProcessingError('The browser could not read that image.'));
      el.src = url;
    });
    const width = image.naturalWidth || image.width;
    const height = image.naturalHeight || image.height;
    if (!width || !height) {
      throw new ImageProcessingError('That image does not declare a size.');
    }
    return {
      source: image,
      width,
      height,
      release: () => { image.src = ''; URL.revokeObjectURL(url); },
    };
  } catch (error) {
    URL.revokeObjectURL(url);
    if (error instanceof ImageProcessingError) throw error;
    throw new ImageProcessingError('The browser could not read that image.', { cause: error });
  }
}

/**
 * Crop and resample in one native step, where the browser supports it.
 *
 * `createImageBitmap` can take a source rectangle AND a target size,
 * and its `resizeQuality: 'high'` resampler is better than a single
 * `drawImage` downscale for big reductions — without the stepped
 * halving that would otherwise be needed, and without holding several
 * large canvases at once.
 *
 * Returns null when unavailable, in which case `drawImage` does the
 * scaling instead. Either path produces the same dimensions.
 */
async function resampleToTarget(source, crop, width, height) {
  if (typeof createImageBitmap !== 'function') return null;
  try {
    const bitmap = await createImageBitmap(source, crop.sx, crop.sy, crop.sw, crop.sh, {
      resizeWidth: width,
      resizeHeight: height,
      resizeQuality: 'high',
    });
    if (bitmap?.width && bitmap?.height) return bitmap;
    bitmap?.close?.();
    return null;
  } catch {
    return null;
  }
}

/* ───────────────────────────── encoding ─────────────────────────── */

/** A canvas of exactly the target size, off-screen where possible. */
function makeCanvas(width, height) {
  if (typeof OffscreenCanvas === 'function') {
    const canvas = new OffscreenCanvas(width, height);
    return { canvas, offscreen: true };
  }
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  return { canvas, offscreen: false };
}

function encode(canvas, offscreen, type, quality) {
  if (offscreen && typeof canvas.convertToBlob === 'function') {
    return canvas.convertToBlob({ type, quality });
  }
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob
        ? resolve(blob)
        : reject(new ImageProcessingError('The browser could not write the cropped image.'))),
      type,
      quality,
    );
  });
}

/* ────────────────────────── the whole job ───────────────────────── */

/**
 * Turn any image the browser can decode into a canonical cover.
 *
 * ── THE ORDER MATTERS ─────────────────────────────────────────────
 * Everything here happens BEFORE storage is touched. The caller gets a
 * finished blob or an exception, which is what lets the upload flow
 * promise that a failed processing attempt leaves her existing cover
 * exactly where it was, with nothing half-written behind it.
 *
 * ── RESOURCES ─────────────────────────────────────────────────────
 * The decoded bitmap is the only full-resolution thing in memory, and
 * it is closed the moment it has been drawn. Object URLs from the
 * fallback path are revoked. The canvas is shrunk to 0x0 afterwards,
 * which is the documented way to let an engine reclaim its backing
 * store promptly rather than at the next collection.
 *
 * @param {Blob|File} file
 * @param {Object} [options]
 * @param {number} [options.width]
 * @param {number} [options.height]
 * @param {number} [options.quality]
 * @param {string} [options.type]
 * @param {string} [options.name]   base name for the returned File
 * @returns {Promise<{blob: Blob, file: File, width: number, height: number,
 *                    bytes: number, type: string,
 *                    source: {width: number, height: number, bytes: number, type: string},
 *                    crop: Object}>}
 */
export async function processCoverImage(file, {
  width = COVER_WIDTH,
  height = COVER_HEIGHT,
  quality = COVER_QUALITY,
  type = COVER_MIME,
  name,
} = {}) {
  if (!file || typeof file.arrayBuffer !== 'function') {
    throw new ImageProcessingError('That is not a file.');
  }
  if (file.type && !file.type.startsWith('image/')) {
    throw new ImageProcessingError('That needs to be an image.');
  }
  if (file.size > MAX_SOURCE_BYTES) {
    throw new ImageProcessingError('That image is too large to work with. Try one under 40 MB.');
  }

  const decoded = await decodeImage(file);
  let resized = null;
  let handle = null;

  try {
    if (decoded.width * decoded.height > MAX_SOURCE_PIXELS) {
      throw new ImageProcessingError('That image has too many pixels to process here.');
    }

    const crop = coverCrop(decoded.width, decoded.height, width, height);

    // Preferred path: the browser crops and resamples natively.
    resized = await resampleToTarget(decoded.source, crop, width, height);

    handle = makeCanvas(width, height);
    const context = handle.canvas.getContext('2d', { alpha: false });
    if (!context) {
      throw new ImageProcessingError('This browser will not give us a canvas to work on.');
    }
    context.imageSmoothingEnabled = true;
    context.imageSmoothingQuality = 'high';

    // JPEG has no transparency, so a PNG with an alpha channel would
    // otherwise composite onto black. White is the kinder default for
    // something that will sit on a shelf.
    context.fillStyle = '#ffffff';
    context.fillRect(0, 0, width, height);

    if (resized) {
      // Already the exact target size: a 1:1 blit, no further resampling.
      context.drawImage(resized, 0, 0, width, height);
    } else {
      context.drawImage(
        decoded.source,
        crop.sx, crop.sy, crop.sw, crop.sh,
        0, 0, width, height,
      );
    }

    // The full-resolution source is no longer needed. Release it before
    // encoding, which is the other memory-hungry step.
    decoded.release();
    resized?.close?.();
    resized = null;

    const blob = await encode(handle.canvas, handle.offscreen, type, quality);
    if (!blob?.size) {
      throw new ImageProcessingError('The cropped image came out empty.');
    }

    const baseName = String(name ?? file.name ?? 'cover')
      .replace(/\.[A-Za-z0-9]{1,8}$/, '')
      .replace(/[^\w\s.-]+/g, '')
      .trim() || 'cover';

    return {
      blob,
      file: new File([blob], `${baseName}.jpg`, { type, lastModified: Date.now() }),
      width,
      height,
      bytes: blob.size,
      type,
      source: {
        width: decoded.width,
        height: decoded.height,
        bytes: file.size ?? 0,
        type: file.type || 'unknown',
      },
      crop,
    };
  } catch (error) {
    if (error instanceof ImageProcessingError) throw error;
    throw new ImageProcessingError('That image could not be prepared.', { cause: error });
  } finally {
    // Belt and braces: release even on the failure paths.
    try { decoded.release(); } catch { /* already released */ }
    try { resized?.close?.(); } catch { /* already closed */ }
    if (handle?.canvas && !handle.offscreen) {
      handle.canvas.width = 0;
      handle.canvas.height = 0;
    }
  }
}
