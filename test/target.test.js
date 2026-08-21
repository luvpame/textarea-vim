import test from 'node:test';
import assert from 'node:assert/strict';
import {
  isMultilineTextarea,
  isSupportedTarget,
  isTextarea,
} from '../src/target.js';

function createTextarea(attributes = {}, properties = {}) {
  const style = properties.style || {
    fontSize: '16px',
    lineHeight: '16px',
    paddingTop: '2px',
    paddingBottom: '2px',
  };
  const windowObject = properties.windowObject || {
    getComputedStyle() {
      return style;
    },
  };

  return {
    nodeType: 1,
    tagName: 'TEXTAREA',
    parentElement: null,
    readOnly: false,
    disabled: false,
    rows: 2,
    clientHeight: 40,
    ownerDocument: { defaultView: windowObject },
    getAttribute(name) {
      return Object.hasOwn(attributes, name) ? attributes[name] : null;
    },
    ...properties,
  };
}

function createElement(tagName, attributes = {}, properties = {}) {
  return {
    nodeType: 1,
    tagName: tagName.toUpperCase(),
    parentElement: null,
    getAttribute(name) {
      return Object.hasOwn(attributes, name) ? attributes[name] : null;
    },
    ...properties,
  };
}

test('rows=1のtextareaは対象外、rows=2は対象になる', function testExplicitRows() {
  assert.equal(isMultilineTextarea(createTextarea({ rows: '1' }, { clientHeight: 80 })), false);
  assert.equal(isMultilineTextarea(createTextarea({ rows: '2' }, { clientHeight: 16 })), true);
});

test('rows未指定のtextareaは実寸で複数行か判定する', function testMeasuredRows() {
  const oneLine = createTextarea({}, { rows: 1, clientHeight: 20 });
  const multipleLines = createTextarea({}, { rows: 1, clientHeight: 40 });

  assert.equal(isMultilineTextarea(oneLine), false);
  assert.equal(isMultilineTextarea(multipleLines), true);
});

test('inputとcontenteditableは対象外にする', function testUnsupportedElements() {
  assert.equal(isSupportedTarget(createElement('input')), false);
  assert.equal(isSupportedTarget(createElement('div', { contenteditable: 'true' })), false);
  assert.equal(isTextarea(createElement('textarea')), true);
});

test('readonlyとdisabledのtextareaは対象外にする', function testDisabledTextareas() {
  assert.equal(isSupportedTarget(createTextarea({ rows: '2' }, { readOnly: true })), false);
  assert.equal(isSupportedTarget(createTextarea({ rows: '2' }, { disabled: true })), false);
});
