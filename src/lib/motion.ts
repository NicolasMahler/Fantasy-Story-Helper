import { fly } from 'svelte/transition';

/** True when the device asks for less motion. Svelte transitions run in JS, so they check this themselves. */
export function reducedMotion(): boolean {
  return typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
}

/**
 * Fade-and-rise for list items. `index` staggers the first few; everything past them arrives with the
 * last of those, so a long list is fully in after about 0.3s.
 */
export function rise(node: Element, { index = 0 }: { index?: number } = {}) {
  if (reducedMotion()) return { duration: 0 };
  return fly(node, { y: 6, duration: 180, delay: Math.min(index, 8) * 18, opacity: 0 });
}

/**
 * Glides a row's `.slide-indicator` child under whichever child matches `selector`
 * (for example `[aria-current='page']`). Put `<span class="slide-indicator" aria-hidden="true"></span>`
 * in the row's markup and style it there. The row must be positioned (relative, sticky…).
 */
export function slideIndicator(node: HTMLElement, selector: string) {
  const found = node.querySelector<HTMLElement>(':scope > .slide-indicator');
  if (!found) return {};
  const indicator: HTMLElement = found;
  let placed = false;

  function place() {
    const target = node.querySelector<HTMLElement>(selector);
    indicator.style.opacity = target ? '1' : '0';
    if (!target) return;
    // Jump into place the first time; glide on every later change.
    if (!placed) indicator.style.transition = 'none';
    indicator.style.left = `${target.offsetLeft}px`;
    indicator.style.top = `${target.offsetTop}px`;
    indicator.style.width = `${target.offsetWidth}px`;
    indicator.style.height = `${target.offsetHeight}px`;
    if (!placed) {
      indicator.getBoundingClientRect();
      indicator.style.transition = '';
      placed = true;
    }
  }

  const mutations = new MutationObserver(place);
  mutations.observe(node, { subtree: true, childList: true, attributes: true, attributeFilter: ['aria-current', 'aria-selected'] });
  const resizes = new ResizeObserver(place);
  resizes.observe(node);
  place();

  return {
    update(next: string) {
      selector = next;
      place();
    },
    destroy() {
      mutations.disconnect();
      resizes.disconnect();
    },
  };
}
