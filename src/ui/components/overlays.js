/**
 * overlays.js — toasts, modals, and the confirm dialog.
 *
 * All three share the same contract: they mount themselves, trap focus,
 * close on Escape and on a click outside, restore focus to whatever was
 * focused before, and resolve a promise. Views never manage their own
 * dialog plumbing.
 */

import { qs, esc, trapFocus, lockScroll } from '../../utils/dom.js';

const modalRoot = () => qs('#modal-root');
const toastRoot = () => qs('#toast-root');

// ───────────────────────────────── toasts ─────────────────────────────────

/**
 * @param {string} message
 * @param {{action?: {label: string, onClick: Function}, duration?: number}} options
 */
export function toast(message, { action, duration = 4200 } = {}) {
  const node = document.createElement('div');
  node.className = 'toast';
  node.setAttribute('role', 'status');
  node.innerHTML = `
    <span class="toast__dot"></span>
    <span class="toast__msg">${esc(message)}</span>
    ${action ? `<button class="toast__action" type="button">${esc(action.label)}</button>` : ''}`;

  const close = () => {
    if (!node.isConnected) return;
    node.classList.add('is-closing');
    setTimeout(() => node.remove(), 240);
  };

  if (action) {
    qs('.toast__action', node).addEventListener('click', () => { action.onClick(); close(); });
  }
  toastRoot().append(node);

  const timer = setTimeout(close, duration);
  node.addEventListener('mouseenter', () => clearTimeout(timer));
  return close;
}

// ───────────────────────────────── modals ─────────────────────────────────

/**
 * Open a modal.
 * @param {{title: string, subtitle?: string, body: string, footer?: string, size?: 'sm'|'md',
 *          onMount?: (panel: HTMLElement, close: Function) => void,
 *          onClose?: () => void}} config
 * @returns {{close: Function, panel: HTMLElement}}
 */
export function openModal({ title, subtitle = '', body, footer = '', size = 'md', onMount, onClose }) {
  const previouslyFocused = document.activeElement;
  const unlock = lockScroll();

  const scrim = document.createElement('div');
  scrim.className = 'scrim';

  const layer = document.createElement('div');
  layer.className = 'modal';
  layer.innerHTML = `
    <div class="modal__panel ${size === 'sm' ? 'modal__panel--sm' : ''}" role="dialog" aria-modal="true" aria-label="${esc(title)}">
      <div class="modal__head">
        <div>
          <h2 class="modal__title">${esc(title)}</h2>
          ${subtitle ? `<p class="modal__sub">${esc(subtitle)}</p>` : ''}
        </div>
        <button class="icon-btn" type="button" data-close aria-label="Close">
          <svg viewBox="0 0 24 24" width="18" height="18"><path d="M6 6l12 12M18 6L6 18"/></svg>
        </button>
      </div>
      <div class="modal__body">${body}</div>
      ${footer ? `<div class="modal__foot">${footer}</div>` : ''}
    </div>`;

  const panel = qs('.modal__panel', layer);
  modalRoot().append(scrim, layer);

  let closed = false;
  const releaseFocus = trapFocus(panel);

  function close() {
    if (closed) return;
    closed = true;
    releaseFocus();
    unlock();
    layer.classList.add('is-closing');
    scrim.classList.add('is-closing');
    document.removeEventListener('keydown', onKey);
    setTimeout(() => { layer.remove(); scrim.remove(); }, 210);
    if (previouslyFocused instanceof HTMLElement) previouslyFocused.focus({ preventScroll: true });
    onClose?.();
  }

  function onKey(event) {
    if (event.key === 'Escape') { event.stopPropagation(); close(); }
  }

  document.addEventListener('keydown', onKey);
  scrim.addEventListener('click', close);
  layer.addEventListener('click', (event) => { if (event.target === layer) close(); });
  panel.querySelectorAll('[data-close]').forEach((btn) => btn.addEventListener('click', close));

  onMount?.(panel, close);

  // Focus the first meaningful control, not the close button.
  const first = panel.querySelector('input, textarea, select, .btn--primary');
  (first instanceof HTMLElement ? first : panel).focus?.({ preventScroll: true });

  return { close, panel };
}

/**
 * A confirmation that has to be answered.
 * Deliberately plain — this is the one place in the app with no jokes.
 * @returns {Promise<boolean>}
 */
export function confirmDialog({
  title,
  message,
  confirmLabel = 'Delete',
  cancelLabel = 'Keep it',
  danger = true,
}) {
  return new Promise((resolve) => {
    let answered = false;
    const finish = (value) => { if (!answered) { answered = true; resolve(value); } };

    openModal({
      title,
      size: 'sm',
      // Escape, the scrim, or the close button all count as "no".
      onClose: () => finish(false),
      body: `<p style="color:var(--text-dim);line-height:1.7">${esc(message)}</p>`,
      footer: `
        <button class="btn" type="button" data-answer="no">${esc(cancelLabel)}</button>
        <button class="btn ${danger ? 'btn--danger' : 'btn--primary'}" type="button" data-answer="yes">${esc(confirmLabel)}</button>`,
      onMount(panel, closeModal) {
        panel.querySelectorAll('[data-answer]').forEach((btn) => {
          btn.addEventListener('click', () => {
            finish(btn.dataset.answer === 'yes');
            closeModal();
          });
        });
      },
    });
  });
}
