import { defaultKeymap, history, historyKeymap, indentWithTab } from '@codemirror/commands';
import { EditorState } from '@codemirror/state';
import { EditorView, drawSelection, keymap } from '@codemirror/view';
import { Vim, vim } from '@replit/codemirror-vim';
import { containKeyboardEvents } from './keyboard-boundary.js';
import {
  dispatchTargetChange,
  dispatchTargetInput,
  findTarget,
  isSupportedTarget,
  readTargetSelection,
  readTargetText,
  setTargetSelection,
  writeNativeValue,
} from './target.js';

const TOGGLE_KEY = 'v';
const sessionState = {
  enabled: true,
  session: null,
};

function isToggleShortcut(event) {
  return event.altKey
    && event.shiftKey
    && !event.ctrlKey
    && !event.metaKey
    && event.key.toLowerCase() === TOGGLE_KEY;
}

function isInsideSession(event, session) {
  if (!session) {
    return false;
  }

  if (typeof event.composedPath === 'function') {
    return event.composedPath().includes(session.host);
  }

  return event.target === session.host;
}

function getDocument(element) {
  return element.ownerDocument || document;
}

function saveVisibility(element) {
  return {
    value: element.style.getPropertyValue('visibility'),
    priority: element.style.getPropertyPriority('visibility'),
  };
}

function restoreVisibility(element, previous) {
  if (previous.value) {
    element.style.setProperty('visibility', previous.value, previous.priority);
  } else {
    element.style.removeProperty('visibility');
  }
}

function copyTargetAppearance(target, host) {
  const windowObject = getDocument(target).defaultView || globalThis;
  if (typeof windowObject.getComputedStyle !== 'function') {
    return;
  }

  const style = windowObject.getComputedStyle(target);
  host.style.font = style.font;
  host.style.color = style.color;
  host.style.background = style.background;
  host.style.border = style.border;
  host.style.borderRadius = style.borderRadius;
}

function updateOverlayPosition(session) {
  if (!session || !session.target.isConnected) {
    return;
  }

  const rectangle = session.target.getBoundingClientRect();
  session.host.style.left = `${rectangle.left}px`;
  session.host.style.top = `${rectangle.top}px`;
  session.host.style.width = `${rectangle.width}px`;
  session.host.style.height = `${rectangle.height}px`;
}

function configureVim() {
  Vim.map('jj', '<Esc>', 'insert');
  const commands = [
    ['write', 'w', function writeCommand() {
      if (sessionState.session) {
        syncViewToTarget(sessionState.session, true);
      }
    }],
    ['wq', 'wq', function writeQuitCommand() {
      closeSession({ restore: false });
    }],
    ['quit', 'q', function quitCommand() {
      closeSession({ restore: true });
    }],
  ];

  for (const command of commands) {
    Vim.defineEx(command[0], command[1], command[2]);
  }
}

function dispatchEditorText(session, text, shouldDispatchInput) {
  if (!session.target.isConnected) {
    return;
  }

  session.syncing = true;
  try {
    writeNativeValue(session.target, text);
    setTargetSelection(
      session.target,
      session.view.state.selection.main.from,
      session.view.state.selection.main.to,
    );
    if (shouldDispatchInput) {
      dispatchTargetInput(session.target);
    }
  } finally {
    session.syncing = false;
  }
}

function syncViewToTarget(session, shouldDispatchInput) {
  if (!session || !session.view) {
    return;
  }

  const text = session.view.state.doc.toString();
  const currentText = readTargetText(session.target);
  dispatchEditorText(session, text, shouldDispatchInput && currentText !== text);
}

function restoreInitialTarget(session) {
  if (!session.target.isConnected) {
    return;
  }

  const currentText = readTargetText(session.target);
  session.syncing = true;
  try {
    writeNativeValue(session.target, session.initialText);
    setTargetSelection(session.target, session.initialSelection.start, session.initialSelection.end);
    if (currentText !== session.initialText) {
      dispatchTargetInput(session.target);
    }
  } finally {
    session.syncing = false;
  }
}

function closeSession(options = {}) {
  const session = sessionState.session;
  if (!session || session.closing) {
    return;
  }

  session.closing = true;
  if (options.restore) {
    restoreInitialTarget(session);
  } else {
    syncViewToTarget(session, true);
  }

  session.observer.disconnect();
  session.view.destroy();
  session.host.remove();
  if (session.target.isConnected) {
    restoreVisibility(session.target, session.previousVisibility);
    dispatchTargetChange(session.target);
  }
  sessionState.session = null;
}

function makeOverlay(target) {
  const documentObject = getDocument(target);
  const host = documentObject.createElement('div');
  host.setAttribute('aria-label', 'TextareaVim editor');
  host.style.position = 'fixed';
  host.style.zIndex = '2147483647';
  host.style.margin = '0';
  host.style.padding = '0';
  host.style.overflow = 'hidden';
  host.style.pointerEvents = 'auto';
  host.style.boxSizing = 'border-box';
  copyTargetAppearance(target, host);
  containKeyboardEvents(host);
  const shadow = host.attachShadow({ mode: 'open' });
  shadow.innerHTML = `<style>
    :host { display: block; }
    #mount, .cm-editor { width: 100%; height: 100%; }
    .cm-editor { font: inherit; color: inherit; background: inherit; }
    .cm-scroller { overflow: auto; }
    .cm-content { min-height: 100%; padding: 0; }
    .cm-line { padding: 0; }
  </style><div id="mount"></div>`;
  documentObject.documentElement.appendChild(host);
  return { host, shadow, mount: shadow.querySelector('#mount') };
}

function activate(target) {
  if (!sessionState.enabled || !target || !isSupportedTarget(target)) {
    return;
  }

  if (sessionState.session && sessionState.session.target === target) {
    sessionState.session.view.focus();
    return;
  }
  if (sessionState.session) {
    closeSession({ restore: false });
  }

  const initialText = readTargetText(target);
  const initialSelection = readTargetSelection(target, initialText);
  const overlay = makeOverlay(target);
  const previousVisibility = saveVisibility(target);
  const session = {
    target,
    host: overlay.host,
    initialText,
    initialSelection,
    previousVisibility,
    syncing: false,
    closing: false,
    observer: new MutationObserver(function observeTarget() {
      if (!target.isConnected) {
        closeSession({ restore: false });
      }
    }),
    view: null,
  };

  target.style.setProperty('visibility', 'hidden', '');
  session.observer.observe(getDocument(target).documentElement, { childList: true, subtree: true });
  const extensions = [
    vim({ status: true }),
    history(),
    drawSelection(),
    EditorView.lineWrapping,
    keymap.of([...defaultKeymap, ...historyKeymap, indentWithTab]),
    EditorView.updateListener.of(function handleEditorUpdate(update) {
      const activeSession = sessionState.session;
      if (activeSession !== session || (!update.docChanged && !update.selectionSet)) {
        return;
      }
      syncViewToTarget(session, update.docChanged);
    }),
  ];
  const state = EditorState.create({
    doc: initialText,
    selection: { anchor: initialSelection.start, head: initialSelection.end },
    extensions,
  });
  session.view = new EditorView({ state, parent: overlay.mount, root: overlay.shadow });
  sessionState.session = session;
  updateOverlayPosition(session);
  session.view.focus();
}

function handleFocusIn(event) {
  const session = sessionState.session;
  if (session && !isInsideSession(event, session) && event.target !== session.target) {
    closeSession({ restore: false });
  }

  const target = findTarget(event.target);
  if (target) {
    activate(target);
  }
}

function handleTargetInput(event) {
  const session = sessionState.session;
  if (!session || session.syncing || event.target !== session.target) {
    return;
  }

  const text = readTargetText(session.target);
  if (text !== session.view.state.doc.toString()) {
    session.view.dispatch({
      changes: { from: 0, to: session.view.state.doc.length, insert: text },
    });
  }
}

function handleKeydown(event) {
  if (!event.isComposing && isToggleShortcut(event)) {
    const target = sessionState.session ? sessionState.session.target : findTarget(document.activeElement);
    sessionState.enabled = !sessionState.enabled;
    if (sessionState.enabled) {
      activate(target || findTarget(document.activeElement));
    } else {
      closeSession({ restore: false });
    }
    event.preventDefault();
    event.stopPropagation();
    return;
  }

  const session = sessionState.session;
  if (!session || event.isComposing || !isInsideSession(event, session)) {
    return;
  }

  if ((event.ctrlKey || event.metaKey) && event.key === 'Enter') {
    event.preventDefault();
    event.stopPropagation();
    closeSession({ restore: false });
  }
}

function handlePointerDown(event) {
  if (sessionState.session && !isInsideSession(event, sessionState.session)) {
    closeSession({ restore: false });
  }
}

function handleScrollOrResize() {
  const session = sessionState.session;
  if (!session) {
    return;
  }
  if (!session.target.isConnected) {
    closeSession({ restore: false });
    return;
  }
  updateOverlayPosition(session);
}

configureVim();
document.addEventListener('focusin', handleFocusIn, true);
document.addEventListener('input', handleTargetInput, true);
document.addEventListener('keydown', handleKeydown, true);
document.addEventListener('pointerdown', handlePointerDown, true);
window.addEventListener('scroll', handleScrollOrResize, true);
window.addEventListener('resize', handleScrollOrResize);
