import test from 'node:test';
import assert from 'node:assert/strict';
import { containKeyboardEvents } from '../src/keyboard-boundary.js';

function createFakeHost() {
  return {
    listeners: new Map(),
    addEventListener(type, listener, capture) {
      this.listeners.set(type, { listener, capture });
    },
  };
}

test('キーボードイベントをバブル段階で停止するlistenerを登録する', function testKeyboardBoundary() {
  const host = createFakeHost();
  containKeyboardEvents(host);

  for (const eventType of ['keydown', 'keypress', 'keyup']) {
    const registration = host.listeners.get(eventType);
    assert.ok(registration, `${eventType} listener is registered`);
    assert.equal(registration.capture, false);

    let stopCalls = 0;
    registration.listener({
      stopPropagation() {
        stopCalls += 1;
      },
    });
    assert.equal(stopCalls, 1);
  }
});
