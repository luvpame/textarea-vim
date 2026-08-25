import {
  DEFAULT_INSERT_EXIT_KEY_SEQUENCE,
  isValidInsertExitKeySequence,
  readInsertExitKeySequence,
  saveInsertExitKeySequence,
} from '../../src/settings.js';

const form = document.querySelector<HTMLFormElement>('#settings-form');
const keySequenceInput = document.querySelector<HTMLInputElement>('#insert-exit-key-sequence');
const resetButton = document.querySelector<HTMLButtonElement>('#reset-settings');
const status = document.querySelector<HTMLParagraphElement>('#settings-status');

function setStatus(message: string): void {
  if (status) {
    status.textContent = message;
  }
}

function setInputError(message: string): void {
  if (!keySequenceInput) {
    return;
  }

  keySequenceInput.setCustomValidity(message);
  if (message) {
    keySequenceInput.reportValidity();
  }
}

async function persistSettings(value: string, successMessage: string): Promise<void> {
  try {
    await saveInsertExitKeySequence(value);
    setStatus(successMessage);
  } catch {
    setStatus('設定を保存できませんでした。');
  }
}

async function loadSettings(): Promise<void> {
  if (!keySequenceInput) {
    return;
  }

  try {
    keySequenceInput.value = await readInsertExitKeySequence();
  } catch {
    keySequenceInput.value = DEFAULT_INSERT_EXIT_KEY_SEQUENCE;
    setStatus('設定を読み込めませんでした。既定値を表示しています。');
  }
}

async function saveSettings(event: SubmitEvent): Promise<void> {
  event.preventDefault();
  if (!keySequenceInput) {
    return;
  }

  const value = keySequenceInput.value;
  if (!isValidInsertExitKeySequence(value)) {
    setInputError('空欄または印字可能なASCII文字16文字以内で入力してください。');
    setStatus('入力内容を確認してください。');
    return;
  }

  setInputError('');
  await persistSettings(value, '保存しました。');
}

async function resetSettings(): Promise<void> {
  if (!keySequenceInput) {
    return;
  }

  keySequenceInput.value = DEFAULT_INSERT_EXIT_KEY_SEQUENCE;
  setInputError('');
  await persistSettings(DEFAULT_INSERT_EXIT_KEY_SEQUENCE, '既定値に戻しました。');
}

form?.addEventListener('submit', function handleSubmit(event): void {
  void saveSettings(event);
});
resetButton?.addEventListener('click', function handleReset(): void {
  void resetSettings();
});
void loadSettings();
