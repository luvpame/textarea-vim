import { defaultKeymap, history, historyKeymap, indentWithTab } from '@codemirror/commands';
import { EditorState } from '@codemirror/state';
import { drawSelection, EditorView, keymap, placeholder } from '@codemirror/view';
import { Vim, vim } from '@replit/codemirror-vim';
import { containKeyboardEvents } from './keyboard-boundary.js';
import {
  dispatchTargetInputAndUpdateOverlay,
  observeOverlayPosition,
  updateOverlayPosition,
} from './overlay-position.js';
import {
  DEFAULT_INSERT_EXIT_KEY_SEQUENCE,
  readInsertExitKeySequence,
  watchInsertExitKeySequence,
} from './settings.js';
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
type VisibilitySnapshot = {
  value: string;
  priority: string;
};

type TargetPadding = {
  top: number;
  right: number;
  bottom: number;
  left: number;
};

type Session = {
  target: HTMLTextAreaElement;
  host: HTMLDivElement;
  initialText: string;
  initialSelection: { start: number; end: number };
  previousVisibility: VisibilitySnapshot;
  syncing: boolean;
  closing: boolean;
  connectionObserver: MutationObserver;
  resizeObserver: ResizeObserver;
  view: EditorView | null;
};

const sessionState = {
  enabled: true,
  session: null as Session | null,
};

let configuredInsertExitKeySequence: string | null = null;
let stopWatchingInsertExitKeySequence: (() => void) | null = null;

function isToggleShortcut(event: KeyboardEvent): boolean {
  return (
    event.altKey &&
    event.shiftKey &&
    !event.ctrlKey &&
    !event.metaKey &&
    event.key.toLowerCase() === TOGGLE_KEY
  );
}

function isInsideSession(event: Event, session: Session | null): boolean {
  if (!session) {
    return false;
  }

  if (typeof event.composedPath === 'function') {
    return event.composedPath().includes(session.host);
  }

  return event.target === session.host;
}

function getDocument(element: HTMLElement): Document {
  return element.ownerDocument;
}

function saveVisibility(element: HTMLElement): VisibilitySnapshot {
  return {
    value: element.style.getPropertyValue('visibility'),
    priority: element.style.getPropertyPriority('visibility'),
  };
}

function restoreVisibility(element: HTMLElement, previous: VisibilitySnapshot): void {
  if (previous.value) {
    element.style.setProperty('visibility', previous.value, previous.priority);
  } else {
    element.style.removeProperty('visibility');
  }
}

function parseCssPixels(value: string): number {
  const pixels = Number.parseFloat(value);
  return Number.isFinite(pixels) ? pixels : 0;
}

function readTargetPadding(target: HTMLTextAreaElement): TargetPadding {
  const windowObject = getDocument(target).defaultView;
  if (!windowObject) {
    return { top: 0, right: 0, bottom: 0, left: 0 };
  }

  const style = windowObject.getComputedStyle(target);
  return {
    top: parseCssPixels(style.paddingTop),
    right: parseCssPixels(style.paddingRight),
    bottom: parseCssPixels(style.paddingBottom),
    left: parseCssPixels(style.paddingLeft),
  };
}

function copyTargetAppearance(target: HTMLTextAreaElement, host: HTMLDivElement): void {
  const windowObject = getDocument(target).defaultView;
  if (!windowObject) {
    return;
  }

  const style = windowObject.getComputedStyle(target);
  host.style.font = style.font;
  host.style.lineHeight = style.lineHeight;
  host.style.color = style.color;
  host.style.background = style.background;
  host.style.border = style.border;
  host.style.borderRadius = style.borderRadius;
}

function applyInsertExitKeySequence(keySequence: string): void {
  if (configuredInsertExitKeySequence) {
    Vim.unmap(configuredInsertExitKeySequence, 'insert');
  }

  configuredInsertExitKeySequence = keySequence;
  if (keySequence) {
    Vim.map(keySequence, '<Esc>', 'insert');
  }
}

async function configureVim(): Promise<void> {
  let insertExitKeySequence = DEFAULT_INSERT_EXIT_KEY_SEQUENCE;
  try {
    insertExitKeySequence = await readInsertExitKeySequence();
  } catch {
    // Keep the default mapping when extension storage is temporarily unavailable.
  }
  applyInsertExitKeySequence(insertExitKeySequence);

  stopWatchingInsertExitKeySequence?.();
  try {
    stopWatchingInsertExitKeySequence = watchInsertExitKeySequence(applyInsertExitKeySequence);
  } catch {
    stopWatchingInsertExitKeySequence = null;
  }

  const commands: Array<[string, string, () => void]> = [
    [
      'write',
      'w',
      function writeCommand() {
        if (sessionState.session) {
          syncViewToTarget(sessionState.session, true);
        }
      },
    ],
    [
      'wq',
      'wq',
      function writeQuitCommand() {
        closeSession({ restore: false });
      },
    ],
    [
      'quit',
      'q',
      function quitCommand() {
        closeSession({ restore: true });
      },
    ],
  ];

  for (const [name, shortName, handler] of commands) {
    Vim.defineEx(name, shortName, handler);
  }
}

function dispatchEditorText(session: Session, text: string, shouldDispatchInput: boolean): void {
  if (!session.target.isConnected || !session.view) {
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
      dispatchTargetInputAndUpdateOverlay(session.target, session.host);
    }
  } finally {
    session.syncing = false;
  }
}

function syncViewToTarget(session: Session | null, shouldDispatchInput: boolean): void {
  if (!session?.view) {
    return;
  }

  const text = session.view.state.doc.toString();
  const currentText = readTargetText(session.target);
  dispatchEditorText(session, text, shouldDispatchInput && currentText !== text);
}

function restoreInitialTarget(session: Session): void {
  if (!session.target.isConnected) {
    return;
  }

  const currentText = readTargetText(session.target);
  session.syncing = true;
  try {
    writeNativeValue(session.target, session.initialText);
    setTargetSelection(
      session.target,
      session.initialSelection.start,
      session.initialSelection.end,
    );
    if (currentText !== session.initialText) {
      dispatchTargetInput(session.target);
    }
  } finally {
    session.syncing = false;
  }
}

function closeSession(options: { restore?: boolean } = {}): void {
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

  session.connectionObserver.disconnect();
  session.resizeObserver.disconnect();
  session.view?.destroy();
  session.host.remove();
  if (session.target.isConnected) {
    restoreVisibility(session.target, session.previousVisibility);
    dispatchTargetChange(session.target);
  }
  sessionState.session = null;
}

function makeOverlay(target: HTMLTextAreaElement): {
  host: HTMLDivElement;
  shadow: ShadowRoot;
  mount: HTMLDivElement;
} {
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
  const mount = shadow.querySelector<HTMLDivElement>('#mount');
  if (!mount) {
    throw new Error('CodeMirror mount element was not created');
  }
  return { host, shadow, mount };
}

function activate(target: HTMLTextAreaElement | null): void {
  if (!sessionState.enabled || !target || !isSupportedTarget(target)) {
    return;
  }

  if (sessionState.session && sessionState.session.target === target) {
    sessionState.session.view?.focus();
    return;
  }
  if (sessionState.session) {
    closeSession({ restore: false });
  }

  const initialText = readTargetText(target);
  const initialSelection = readTargetSelection(target, initialText);
  const targetPadding = readTargetPadding(target);
  const placeholderText = target.getAttribute('placeholder');
  const overlay = makeOverlay(target);
  const previousVisibility = saveVisibility(target);
  const session: Session = {
    target,
    host: overlay.host,
    initialText,
    initialSelection,
    previousVisibility,
    syncing: false,
    closing: false,
    connectionObserver: new MutationObserver(function observeTarget() {
      if (!target.isConnected) {
        closeSession({ restore: false });
      }
    }),
    resizeObserver: observeOverlayPosition(target, overlay.host),
    view: null,
  };

  target.style.setProperty('visibility', 'hidden', 'important');
  session.connectionObserver.observe(getDocument(target).documentElement, {
    childList: true,
    subtree: true,
  });
  const extensions = [
    EditorView.theme({
      '.cm-content': {
        padding: `${targetPadding.top}px ${targetPadding.right}px ${targetPadding.bottom}px ${targetPadding.left}px`,
      },
      '.cm-line': { padding: '0' },
    }),
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
  if (placeholderText) {
    extensions.push(placeholder(placeholderText));
  }
  const state = EditorState.create({
    doc: initialText,
    selection: { anchor: initialSelection.start, head: initialSelection.end },
    extensions,
  });
  const view = new EditorView({ state, parent: overlay.mount, root: overlay.shadow });
  session.view = view;
  sessionState.session = session;
  updateOverlayPosition(session.target, session.host);
  view.focus();
}

function handleFocusIn(event: FocusEvent): void {
  const session = sessionState.session;
  if (session && !isInsideSession(event, session) && event.target !== session.target) {
    closeSession({ restore: false });
  }

  const target = findTarget(event.target);
  if (target) {
    activate(target);
  }
}

function handleTargetInput(event: Event): void {
  const session = sessionState.session;
  const view = session?.view;
  if (!session || !view || session.syncing || event.target !== session.target) {
    return;
  }

  const text = readTargetText(session.target);
  if (text !== view.state.doc.toString()) {
    view.dispatch({
      changes: { from: 0, to: view.state.doc.length, insert: text },
    });
  }
}

function handleKeydown(event: KeyboardEvent): void {
  if (!event.isComposing && isToggleShortcut(event)) {
    const target = sessionState.session
      ? sessionState.session.target
      : findTarget(document.activeElement);
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

function handlePointerDown(event: PointerEvent): void {
  if (sessionState.session && !isInsideSession(event, sessionState.session)) {
    closeSession({ restore: false });
  }
}

function handleScrollOrResize(): void {
  const session = sessionState.session;
  if (!session) {
    return;
  }
  if (!session.target.isConnected) {
    closeSession({ restore: false });
    return;
  }
  updateOverlayPosition(session.target, session.host);
}

export async function initializeTextareaVim(): Promise<void> {
  await configureVim();
  document.addEventListener('focusin', handleFocusIn, true);
  document.addEventListener('input', handleTargetInput, true);
  document.addEventListener('keydown', handleKeydown, true);
  document.addEventListener('pointerdown', handlePointerDown, true);
  window.addEventListener('scroll', handleScrollOrResize, true);
  window.addEventListener('resize', handleScrollOrResize);
}
