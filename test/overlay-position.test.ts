import { beforeEach, expect, test, vi } from 'vitest';
import {
  dispatchTargetInputAndUpdateOverlay,
  observeOverlayPosition,
  updateOverlayPosition,
} from '../src/overlay-position.js';

let resizeCallback: ResizeObserverCallback | null = null;
let observedTarget: Element | null = null;

class FakeResizeObserver {
  constructor(callback: ResizeObserverCallback) {
    resizeCallback = callback;
  }

  disconnect(): void {}

  observe(target: Element): void {
    observedTarget = target;
  }

  unobserve(): void {}
}

beforeEach(function resetDocument(): void {
  document.body.replaceChildren();
  resizeCallback = null;
  observedTarget = null;
  vi.stubGlobal('ResizeObserver', FakeResizeObserver);
});

test('textarea自身の高さが変わるとオーバーレイも追従する', function testOverlayFollowsTargetResize(): void {
  const target = document.createElement('textarea');
  const host = document.createElement('div');
  document.body.append(target, host);

  let height = 40;
  vi.spyOn(target, 'getBoundingClientRect').mockImplementation(function readTargetRectangle() {
    return DOMRect.fromRect({ x: 12, y: 24, width: 450, height });
  });

  observeOverlayPosition(target, host);
  expect(observedTarget).toBe(target);
  height = 88;
  resizeCallback?.([], {} as ResizeObserver);

  expect(host.style.left).toBe('12px');
  expect(host.style.top).toBe('24px');
  expect(host.style.width).toBe('450px');
  expect(host.style.height).toBe('88px');
});

test('inputでtextareaが伸びた直後にオーバーレイの高さも更新する', function testOverlayUpdatesSynchronouslyAfterInput(): void {
  const target = document.createElement('textarea');
  const host = document.createElement('div');
  document.body.append(target, host);

  let height = 40;
  vi.spyOn(target, 'getBoundingClientRect').mockImplementation(function readTargetRectangle() {
    return DOMRect.fromRect({ width: 450, height });
  });
  target.addEventListener('input', function growTarget(): void {
    height = 64;
  });

  updateOverlayPosition(target, host);
  dispatchTargetInputAndUpdateOverlay(target, host);

  expect(host.style.height).toBe('64px');
});
