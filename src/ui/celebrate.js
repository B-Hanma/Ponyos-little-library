/**
 * celebrate.js — the moment a book leaves the pile.
 *
 * Finishing a book is the one genuinely good thing that happens in a
 * reading tracker, so it gets a real moment: bubbles rising, the mascot
 * cheering, and one line of text. It lasts under two seconds and it
 * cannot be clicked through by accident because it ignores pointers
 * entirely.
 *
 * Respects reduced motion by degrading to a plain toast — the message
 * still arrives, it just does not move.
 */

import { qs } from '../utils/dom.js';
import { cat } from './cat.js';
import { roll, CELEBRATE } from '../data/quips.js';
import { toast } from './components/overlays.js';

function motionOff() {
  return document.documentElement.dataset.motion === 'off'
    || window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

/**
 * @param {Object} book the book she just finished
 * @param {{achievements?: Array<{icon: string, name: string}>}} extra
 */
export function celebrateFinish(book, { achievements = [] } = {}) {
  const line = roll(CELEBRATE);

  if (motionOff()) {
    toast(`${line} — ${book.title}`);
    achievements.forEach((a) => toast(`${a.icon}  ${a.name} unlocked`, { duration: 5000 }));
    return;
  }

  const host = document.createElement('div');
  host.className = 'celebrate';
  host.setAttribute('aria-hidden', 'true');

  // rising bubbles, a few of them carrying tiny page shapes
  let bits = '';
  for (let i = 0; i < 26; i += 1) {
    const left = 8 + Math.random() * 84;
    const size = 8 + Math.random() * 26;
    const dur = 1.5 + Math.random() * 1.4;
    const delay = Math.random() * 0.5;
    const drift = Math.round(-60 + Math.random() * 120);
    const page = i % 5 === 0;
    bits += `<i class="${page ? 'celebrate__page' : 'celebrate__bubble'}"
      style="left:${left}%;width:${size}px;height:${page ? size * 1.3 : size}px;
      --dur:${dur}s;--delay:${delay}s;--drift:${drift}px;--spin:${Math.round(-200 + Math.random() * 400)}deg"></i>`;
  }

  host.innerHTML = `
    <div class="celebrate__bits">${bits}</div>
    <div class="celebrate__card">
      ${cat('cheer', { size: 88, className: 'celebrate__mascot' })}
      <p class="celebrate__line">${line}</p>
      <p class="celebrate__title">${book.title}</p>
    </div>`;

  document.body.append(host);
  setTimeout(() => host.remove(), 2600);

  // Achievements arrive after the celebration, not on top of it.
  achievements.forEach((a, i) => {
    setTimeout(() => toast(`${a.icon}  ${a.name} — ${a.blurb}`, { duration: 6000 }), 2400 + i * 700);
  });
}

/**
 * A much smaller flourish: a few bubbles from a point on screen.
 * Used when a book is hearted.
 */
export function sparkleAt(element) {
  if (motionOff() || !element) return;
  const rect = element.getBoundingClientRect();
  const host = document.createElement('div');
  host.className = 'sparkle';
  host.style.left = `${rect.left + rect.width / 2}px`;
  host.style.top = `${rect.top + rect.height / 2}px`;
  host.setAttribute('aria-hidden', 'true');

  let bits = '';
  for (let i = 0; i < 8; i += 1) {
    const angle = (360 / 8) * i + Math.random() * 20;
    bits += `<i style="--a:${angle}deg;--d:${18 + Math.random() * 20}px;--delay:${Math.random() * 0.1}s"></i>`;
  }
  host.innerHTML = bits;
  document.body.append(host);
  setTimeout(() => host.remove(), 800);
}

/** The mascot reacts from the corner without interrupting anything. */
export function mascotSays(pose, text, { duration = 3600 } = {}) {
  const host = qs('#mascot-corner');
  if (!host) return;
  host.innerHTML = `
    ${cat(pose, { size: 72 })}
    ${text ? `<span class="mascot-corner__bubble">${text}</span>` : ''}`;
  host.classList.remove('is-showing');
  void host.offsetWidth;
  host.classList.add('is-showing');
  clearTimeout(host._timer);
  host._timer = setTimeout(() => host.classList.remove('is-showing'), duration);
}
