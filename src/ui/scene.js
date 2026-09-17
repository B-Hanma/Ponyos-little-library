/**
 * scene.js — putting a panel of her artwork on the page.
 *
 * ── THE PROBLEM THIS SOLVES ───────────────────────────────────────
 * Every artwork file is a collage. What a view wants is one panel out of
 * it, at an exact rectangle, scaling with its container. `object-fit`
 * cannot do that: it crops toward a point, so it always drags in the
 * neighbouring panels.
 *
 * The trick is two boxes. The outer one is whatever size the layout
 * gives it. The inner one is the image blown up by 1/cropWidth and
 * shoved left and up by the crop's origin, so the wanted rectangle lands
 * exactly on the outer box. All in percentages, so it is resolution
 * independent and costs nothing to resize.
 *
 * ── TWO FITS ──────────────────────────────────────────────────────
 *   box    the container takes the panel's own aspect ratio
 *   cover  the panel fills a container of any shape, centred
 *
 * ── WHEN THERE IS NO ARTWORK ──────────────────────────────────────
 * Everything degrades to drawn artwork: the kitten in an empty frame.
 * Nothing substitutes a photograph of somebody else.
 */

import { esc } from '../utils/dom.js';
import { sceneFor, sceneSet, ROLE } from '../data/scenes.js';
import { cat } from './cat.js';

/**
 * The inner <img>, positioned so the crop lands on the box.
 *
 * @param {Object} scene
 * @param {{eager?: boolean, sizes?: string}} options
 */
function croppedImg(scene, { eager = true, sizes = '' } = {}) {
  const [x, y, w, h] = scene.box;
  const style = [
    `width:${(100 / w).toFixed(3)}%`,
    `height:${(100 / h).toFixed(3)}%`,
    `left:${(-x * 100 / w).toFixed(3)}%`,
    `top:${(-y * 100 / h).toFixed(3)}%`,
  ].join(';');

  return `<img class="scene__img" src="${esc(scene.src)}" alt="${esc(scene.alt)}"
    ${eager ? 'fetchpriority="high"' : 'loading="lazy"'} decoding="async"
    ${sizes ? `sizes="${esc(sizes)}"` : ''} style="${style}">`;
}

/**
 * A panel of artwork.
 *
 * @param {string} role   what kind of picture this spot wants
 * @param {string|number} token  rotation key — same token, same picture
 * @param {Object} [options]
 * @param {'box'|'cover'} [options.fit]
 * @param {string} [options.className]
 * @param {boolean} [options.eager]
 * @param {string} [options.fallbackMood]  which cat to draw if there is no art
 */
export function scene(role, token, options = {}) {
  const {
    fit = 'box', className = '', eager = true, fallbackMood = 'sit', sizes = '',
  } = options;

  const picked = sceneFor(role, token);
  if (!picked) return emptyScene({ fit, className, mood: fallbackMood });

  const ratio = picked.ratio || 1.4;

  if (fit === 'cover') {
    return `
    <div class="scene scene--cover ${className}" aria-hidden="false">
      <div class="scene__box" style="aspect-ratio:${ratio.toFixed(4)}">
        ${croppedImg(picked, { eager, sizes })}
      </div>
    </div>`;
  }

  return `
  <div class="scene scene--box ${className}" style="aspect-ratio:${ratio.toFixed(4)}">
    ${croppedImg(picked, { eager, sizes })}
  </div>`;
}

/** Several distinct panels, for a wall or a strip. */
export function scenes(role, count, token, options = {}) {
  const picked = sceneSet(role, count, token);
  if (!picked.length) return [];
  return picked.map((s, i) => {
    const ratio = s.ratio || 1.4;
    return `
    <div class="scene scene--box ${options.className ?? ''}" style="aspect-ratio:${ratio.toFixed(4)}">
      ${croppedImg(s, { eager: i < 2 })}
    </div>`;
  });
}

/**
 * What a picture slot looks like with no artwork behind it.
 * A real piece of the design, not an error state.
 */
export function emptyScene({ fit = 'box', className = '', mood = 'sit' } = {}) {
  return `
  <div class="scene scene--empty ${fit === 'cover' ? 'scene--cover' : 'scene--box'} ${className}"
       style="${fit === 'cover' ? '' : 'aspect-ratio:1.4'}">
    <div class="scene__empty-art">
      ${cat(mood, { size: 96, className: 'cat--alive' })}
      <p class="scene__empty-note">Drop artwork in <code>assets/ponyo</code>.</p>
    </div>
  </div>`;
}

/**
 * A framed panel: mount, shadow, and a caption UNDER it.
 *
 * The caption is never over the picture. That is the one rule this
 * module exists to keep.
 */
export function framedScene(role, token, { caption = '', tilt = 0, className = '' } = {}) {
  return `
  <figure class="pframe ${className}" style="--tilt:${tilt}deg">
    <div class="pframe__mount">${scene(role, token, { fit: 'box' })}</div>
    ${caption ? `<figcaption class="pframe__caption">${esc(caption)}</figcaption>` : ''}
  </figure>`;
}

/** A washed-out backdrop. The only place artwork goes behind text. */
export function sceneWash(role, token, { className = '' } = {}) {
  const picked = sceneFor(role, token);
  if (!picked) return '';
  return `
  <div class="scene-wash ${className}" aria-hidden="true">
    <div class="scene__box" style="aspect-ratio:${(picked.ratio || 1.4).toFixed(4)}">
      <img class="scene__img" src="${esc(picked.src)}" alt="" loading="lazy" decoding="async"
        style="width:${(100 / picked.box[2]).toFixed(3)}%;height:${(100 / picked.box[3]).toFixed(3)}%;
               left:${(-picked.box[0] * 100 / picked.box[2]).toFixed(3)}%;
               top:${(-picked.box[1] * 100 / picked.box[3]).toFixed(3)}%">
    </div>
  </div>`;
}

/**
 * A framed panel drawn INSIDE an SVG — for the pictures on the walls in
 * Library Mode, which have to scale with the camera.
 *
 * `<image>` plus a clipPath does the same job `croppedImg` does in HTML:
 * the image is laid out oversized and the clip keeps only the panel.
 *
 * @param {string} role
 * @param {string|number} token
 * @param {{x:number, y:number, w:number, h:number, label?:string}} box
 */
export function scenePanelSVG(role, token, { x, y, w, h, label = '' }) {
  const picked = sceneFor(role, token);
  const id = `sc-${role}-${Math.round(x)}-${Math.round(y)}`;

  let inner;
  if (picked) {
    const [cx, cy, cw, ch] = picked.box;
    const iw = (w - 8) / cw;
    const ih = (h - 8) / ch;
    inner = `<image href="${esc(picked.src)}"
      x="${x + 4 - cx * iw}" y="${y + 4 - cy * ih}" width="${iw}" height="${ih}"
      preserveAspectRatio="none" clip-path="url(#${id})"/>`;
  } else {
    inner = `<g transform="translate(${x + w / 2} ${y + h / 2}) scale(${Math.min(w, h) / 220})"
      opacity=".55">${cat('sit', { size: 200 })}</g>`;
  }

  return `
  <g class="lm-art" ${label ? `role="img" aria-label="${esc(label)}"` : 'aria-hidden="true"'}>
    <defs><clipPath id="${id}"><rect x="${x + 4}" y="${y + 4}" width="${w - 8}" height="${h - 8}" rx="3"/></clipPath></defs>
    <rect class="lm-art__frame" x="${x}" y="${y}" width="${w}" height="${h}" rx="4"/>
    ${inner}
    <rect class="lm-art__glass" x="${x + 4}" y="${y + 4}" width="${w - 8}" height="${h - 8}" rx="3"/>
    <rect class="lm-art__lip" x="${x + w * 0.3}" y="${y + h + 2}" width="${w * 0.4}" height="3" rx="1.5"/>
  </g>`;
}

export { ROLE };
