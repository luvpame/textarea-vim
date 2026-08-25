import {
  DEFAULT_URL_POLICY,
  formatUrlPatterns,
  parseUrlPatterns,
  type UrlPatternError,
  type UrlPolicyMode,
  UrlPolicyValidationError,
} from './url-policy.js';
import { readUrlPolicy, saveUrlPolicy } from './url-settings.js';

export type UrlSettingsFormOptions = {
  compact?: boolean;
};

type FormElements = {
  form: HTMLFormElement;
  blocklistInput: HTMLInputElement;
  allowlistInput: HTMLInputElement;
  patternsInput: HTMLTextAreaElement;
  errors: HTMLUListElement;
  status: HTMLParagraphElement;
  resetButton: HTMLButtonElement;
};

function createElement<K extends keyof HTMLElementTagNameMap>(
  documentObject: Document,
  tagName: K,
  className?: string,
): HTMLElementTagNameMap[K] {
  const element = documentObject.createElement(tagName);
  if (className) {
    element.className = className;
  }
  return element;
}

function appendModeLabel(
  documentObject: Document,
  container: HTMLElement,
  input: HTMLInputElement,
  text: string,
  description: string,
): void {
  const label = createElement(documentObject, 'label', 'url-settings-mode');
  input.setAttribute('aria-label', text);

  const copy = createElement(documentObject, 'span', 'url-settings-mode-copy');
  const title = createElement(documentObject, 'span', 'url-settings-mode-title');
  title.textContent = text;
  const detail = createElement(documentObject, 'span', 'url-settings-mode-description');
  detail.textContent = description;
  copy.append(title, detail);
  label.append(input, copy);
  container.append(label);
}

function createForm(documentObject: Document, compact: boolean): FormElements {
  const form = createElement(documentObject, 'form', 'url-settings-form');
  if (compact) {
    form.classList.add('url-settings-form-compact');
  }
  form.noValidate = true;

  const fieldset = createElement(
    documentObject,
    'fieldset',
    'url-settings-section url-settings-mode-section',
  );
  const legend = createElement(documentObject, 'legend');
  legend.textContent = 'URLの適用範囲';
  fieldset.append(legend);

  const modes = createElement(documentObject, 'div', 'url-settings-modes');
  const blocklistInput = createElement(documentObject, 'input');
  blocklistInput.type = 'radio';
  blocklistInput.name = 'url-policy-mode';
  blocklistInput.value = 'blocklist';
  blocklistInput.id = 'url-policy-mode-blocklist';
  const allowlistInput = createElement(documentObject, 'input');
  allowlistInput.type = 'radio';
  allowlistInput.name = 'url-policy-mode';
  allowlistInput.value = 'allowlist';
  allowlistInput.id = 'url-policy-mode-allowlist';
  appendModeLabel(
    documentObject,
    modes,
    blocklistInput,
    'ブラックリスト',
    '一致したURLでは無効にします',
  );
  appendModeLabel(
    documentObject,
    modes,
    allowlistInput,
    'ホワイトリスト',
    '一致したURLだけ有効にします',
  );
  fieldset.append(modes);

  const patternsSection = createElement(
    documentObject,
    'div',
    'url-settings-section url-settings-pattern-section',
  );
  const patternsLabel = createElement(documentObject, 'label', 'url-settings-patterns-label');
  patternsLabel.htmlFor = 'url-policy-patterns';
  patternsLabel.textContent = 'URLパターン（1行に1つ）';
  const patternsInput = createElement(documentObject, 'textarea');
  patternsInput.id = 'url-policy-patterns';
  patternsInput.name = 'url-policy-patterns';
  patternsInput.rows = compact ? 5 : 10;
  patternsInput.autocomplete = 'off';
  patternsInput.spellcheck = false;
  patternsInput.setAttribute(
    'aria-describedby',
    'url-policy-patterns-help url-policy-pattern-errors',
  );
  const help = createElement(documentObject, 'p');
  help.id = 'url-policy-patterns-help';
  help.className = 'url-settings-help';
  help.textContent = '例: *://github.com/*、*://*.example.com/*。空行は無視します。';
  const errors = createElement(documentObject, 'ul');
  errors.id = 'url-policy-pattern-errors';
  errors.className = 'url-settings-errors';
  errors.setAttribute('role', 'alert');
  const patternsControl = createElement(documentObject, 'div', 'url-settings-pattern-control');
  patternsControl.append(patternsInput, help, errors);
  patternsSection.append(patternsLabel, patternsControl);

  const actions = createElement(documentObject, 'div', 'url-settings-actions');
  const saveButton = createElement(documentObject, 'button');
  saveButton.type = 'submit';
  saveButton.className = 'url-settings-button url-settings-button-primary';
  saveButton.textContent = '保存';
  const resetButton = createElement(documentObject, 'button');
  resetButton.type = 'button';
  resetButton.className = 'url-settings-button url-settings-button-secondary';
  resetButton.textContent = '既定値に戻す';
  resetButton.dataset.action = 'reset-url-policy';
  actions.append(saveButton, resetButton);

  const status = createElement(documentObject, 'p');
  status.id = 'settings-status';
  status.className = 'url-settings-status';
  status.setAttribute('role', 'status');
  status.setAttribute('aria-live', 'polite');
  form.append(fieldset, patternsSection, actions, status);
  return { form, blocklistInput, allowlistInput, patternsInput, errors, status, resetButton };
}

function readMode(elements: FormElements): UrlPolicyMode {
  return elements.allowlistInput.checked ? 'allowlist' : 'blocklist';
}

type StatusState = 'idle' | 'success' | 'error';

function setStatus(elements: FormElements, message: string, state: StatusState = 'idle'): void {
  elements.status.textContent = message;
  elements.status.dataset.state = state;
}

function renderErrors(elements: FormElements, errors: readonly UrlPatternError[]): void {
  elements.errors.replaceChildren();
  const messages = errors.map(function createError(error): HTMLLIElement {
    const item = elements.form.ownerDocument.createElement('li');
    item.textContent = `${error.line}行目: ${error.message}`;
    return item;
  });
  elements.errors.append(...messages);
  elements.patternsInput.setCustomValidity(
    errors.length > 0 ? 'URLパターンを確認してください。' : '',
  );
}

export function mountUrlSettingsForm(
  container: HTMLElement,
  options: UrlSettingsFormOptions = {},
): void {
  const elements = createForm(container.ownerDocument, options.compact === true);
  container.replaceChildren(elements.form);

  async function load(): Promise<void> {
    try {
      const policy = await readUrlPolicy();
      elements.blocklistInput.checked = policy.mode === 'blocklist';
      elements.allowlistInput.checked = policy.mode === 'allowlist';
      elements.patternsInput.value = formatUrlPatterns(policy.patterns);
      renderErrors(elements, []);
      setStatus(elements, '');
    } catch {
      elements.blocklistInput.checked = DEFAULT_URL_POLICY.mode === 'blocklist';
      elements.allowlistInput.checked = DEFAULT_URL_POLICY.mode === 'allowlist';
      elements.patternsInput.value = '';
      renderErrors(elements, []);
      setStatus(elements, '設定を読み込めませんでした。既定値を表示しています。', 'error');
    }
  }

  async function save(): Promise<void> {
    const parsed = parseUrlPatterns(elements.patternsInput.value);
    renderErrors(elements, parsed.errors);
    if (parsed.errors.length > 0) {
      setStatus(elements, '入力内容を確認してください。', 'error');
      return;
    }

    try {
      await saveUrlPolicy({ mode: readMode(elements), patterns: parsed.patterns });
      elements.patternsInput.value = formatUrlPatterns(parsed.patterns);
      setStatus(elements, '保存しました。', 'success');
    } catch (error) {
      if (error instanceof UrlPolicyValidationError) {
        renderErrors(elements, error.errors);
        setStatus(elements, '入力内容を確認してください。', 'error');
      } else {
        setStatus(elements, '設定を保存できませんでした。', 'error');
      }
    }
  }

  async function reset(): Promise<void> {
    elements.blocklistInput.checked = true;
    elements.allowlistInput.checked = false;
    elements.patternsInput.value = '';
    renderErrors(elements, []);
    try {
      await saveUrlPolicy(DEFAULT_URL_POLICY);
      setStatus(elements, '既定値に戻しました。', 'success');
    } catch {
      setStatus(elements, '設定を保存できませんでした。', 'error');
    }
  }

  function handleSubmit(event: SubmitEvent): void {
    event.preventDefault();
    void save();
  }

  function handleReset(): void {
    void reset();
  }

  elements.form.addEventListener('submit', handleSubmit);
  elements.resetButton.addEventListener('click', handleReset);

  void load();
}
