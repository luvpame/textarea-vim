const MULTILINE_LINE_THRESHOLD = 1.75;

function isElement(value) {
  return Boolean(value && value.nodeType === 1 && typeof value.tagName === 'string');
}

function getTagName(element) {
  return isElement(element) ? element.tagName.toLowerCase() : '';
}

function getWindow(element) {
  return element && element.ownerDocument && element.ownerDocument.defaultView
    ? element.ownerDocument.defaultView
    : globalThis;
}

export function isTextarea(element) {
  return isElement(element)
    && getTagName(element) === 'textarea'
    && !element.readOnly
    && !element.disabled;
}

function getExplicitRows(element) {
  if (typeof element.getAttribute !== 'function') {
    return null;
  }

  const value = element.getAttribute('rows');
  if (value === null || !/^\s*\d+\s*$/.test(value)) {
    return null;
  }

  const rows = Number(value);
  return Number.isInteger(rows) && rows > 0 ? rows : null;
}

function parseCssPixels(value) {
  const pixels = Number.parseFloat(value);
  return Number.isFinite(pixels) && pixels >= 0 ? pixels : null;
}

function measureMultilineTextarea(element) {
  const windowObject = getWindow(element);
  if (typeof windowObject.getComputedStyle !== 'function' || !Number.isFinite(element.clientHeight)) {
    return null;
  }

  const style = windowObject.getComputedStyle(element);
  if (!style) {
    return null;
  }
  const fontSize = parseCssPixels(style.fontSize);
  const declaredLineHeight = parseCssPixels(style.lineHeight);
  const lineHeight = declaredLineHeight || (fontSize && fontSize * 1.2);
  if (!lineHeight || element.clientHeight <= 0) {
    return null;
  }

  const paddingTop = parseCssPixels(style.paddingTop) || 0;
  const paddingBottom = parseCssPixels(style.paddingBottom) || 0;
  const contentHeight = element.clientHeight - paddingTop - paddingBottom;
  return contentHeight >= lineHeight * MULTILINE_LINE_THRESHOLD;
}

function fallbackMultilineTextarea(element) {
  const rows = Number(element.rows);
  return (Number.isFinite(rows) && rows > 0 ? rows : 2) >= 2;
}

export function isMultilineTextarea(element) {
  if (!isTextarea(element)) {
    return false;
  }

  const explicitRows = getExplicitRows(element);
  if (explicitRows !== null) {
    return explicitRows >= 2;
  }

  const measured = measureMultilineTextarea(element);
  return measured === null ? fallbackMultilineTextarea(element) : measured;
}

export function isSupportedTarget(element) {
  return isMultilineTextarea(element);
}

export function findTarget(node) {
  let element = isElement(node) ? node : node && node.parentElement;

  while (element) {
    if (isSupportedTarget(element)) {
      return element;
    }
    element = element.parentElement;
  }

  return null;
}

export function readTargetText(element) {
  return typeof element.value === 'string' ? element.value : '';
}

export function writeNativeValue(element, value) {
  const text = typeof value === 'string' ? value : String(value == null ? '' : value);
  const windowObject = getWindow(element);
  const prototype = windowObject.HTMLTextAreaElement && windowObject.HTMLTextAreaElement.prototype;
  const descriptor = prototype && Object.getOwnPropertyDescriptor(prototype, 'value');

  if (descriptor && typeof descriptor.set === 'function') {
    descriptor.set.call(element, text);
  } else {
    element.value = text;
  }

  return text;
}

function clamp(value, minimum, maximum) {
  return Math.max(minimum, Math.min(value, maximum));
}

export function readTargetSelection(element, text = readTargetText(element)) {
  const start = typeof element.selectionStart === 'number' ? element.selectionStart : text.length;
  const end = typeof element.selectionEnd === 'number' ? element.selectionEnd : start;
  return {
    start: clamp(start, 0, text.length),
    end: clamp(end, 0, text.length),
  };
}

export function setTargetSelection(element, start, end = start) {
  if (typeof element.setSelectionRange !== 'function') {
    return;
  }

  const textLength = readTargetText(element).length;
  element.setSelectionRange(clamp(start, 0, textLength), clamp(end, 0, textLength));
}

function dispatchTargetEvent(element, type) {
  const EventConstructor = getWindow(element).Event || globalThis.Event;
  element.dispatchEvent(new EventConstructor(type, { bubbles: true, composed: true }));
}

export function dispatchTargetInput(element) {
  dispatchTargetEvent(element, 'input');
}

export function dispatchTargetChange(element) {
  dispatchTargetEvent(element, 'change');
}
