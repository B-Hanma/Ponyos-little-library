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
 *
 * `dismissible` is the one thing here that is not about presentation.
 * Every dialog in this app can be waved away with Escape or a click
 * outside, which is right for all of them but one: a dialog reporting
 * an operation that is still running. Dismissing that does not stop the
 * work, it just hides it — so the backup and restore dialogs open with
 * `dismissible: false` and call `setDismissible(true)` the moment they
 * reach a terminal state, at which point normal behaviour returns.
 *
 * `close()` itself is never gated. A component always retains the right
 * to close its own dialog deliberately; what `dismissible` withholds is
 * the AMBIENT exits — Escape, the scrim, the backdrop, and the header
 * close button, which is hidden while it would be a lie.
 *
 * @param {{title: string, subtitle?: string, body: string, footer?: string, size?: 'sm'|'md',
 *          dismissible?: boolean,
 *          onMount?: (panel: HTMLElement, close: Function) => void,
 *          onClose?: () => void}} config
 * @returns {{close: Function, panel: HTMLElement, setDismissible: (value: boolean) => void}}
 */
export function openModal({
  title, subtitle = '', body, footer = '', size = 'md', onMount, onClose,
  dismissible = true,
}) {
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

  let canDismiss = true;

  /**
   * Every ambient way out funnels through here, so withholding them is
   * one flag rather than four listeners that have to be kept in step.
   */
  function requestClose() {
    if (canDismiss) close();
  }

  function onKey(event) {
    if (event.key !== 'Escape') return;
    // Swallowed either way: a modal is on top, so Escape is not the
    // page's to act on even when this dialog declines to close.
    event.stopPropagation();
    requestClose();
  }

  document.addEventListener('keydown', onKey);
  scrim.addEventListener('click', requestClose);
  layer.addEventListener('click', (event) => { if (event.target === layer) requestClose(); });
  panel.querySelectorAll('[data-close]').forEach((btn) => btn.addEventListener('click', requestClose));

  const headClose = qs('.modal__head [data-close]', panel);

  function setDismissible(value) {
    canDismiss = Boolean(value);
    // A dialog that will not close must not offer a button that says it
    // will. `.icon-btn` sets `display: grid`, which beats the browser's
    // own [hidden] rule, so components.css carries `.icon-btn[hidden]`
    // the same way .app[hidden] and .world[hidden] already do.
    if (headClose) headClose.hidden = !canDismiss;
  }
  setDismissible(dismissible);

  onMount?.(panel, close);

  // Focus the first meaningful control, not the close button.
  const first = panel.querySelector('input, textarea, select, .btn--primary');
  (first instanceof HTMLElement ? first : panel).focus?.({ preventScroll: true });

  return { close, panel, setDismissible };
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
