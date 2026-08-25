import { dispatchTargetInput } from './target.js';

export function dispatchTargetInputAndUpdateOverlay(
  target: HTMLTextAreaElement,
  host: HTMLDivElement,
): void {
  dispatchTargetInput(target);
  updateOverlayPosition(target, host);
}

export function updateOverlayPosition(target: HTMLTextAreaElement, host: HTMLDivElement): void {
  if (!target.isConnected) {
    return;
  }

  const rectangle = target.getBoundingClientRect();
  host.style.left = `${rectangle.left}px`;
  host.style.top = `${rectangle.top}px`;
  host.style.width = `${rectangle.width}px`;
  host.style.height = `${rectangle.height}px`;
}

export function observeOverlayPosition(
  target: HTMLTextAreaElement,
  host: HTMLDivElement,
): ResizeObserver {
  const observer = new ResizeObserver(function handleTargetResize(): void {
    updateOverlayPosition(target, host);
  });
  observer.observe(target);
  return observer;
}
