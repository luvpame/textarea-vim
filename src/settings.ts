import { type Browser, browser } from 'wxt/browser';

export const DEFAULT_INSERT_EXIT_KEY_SEQUENCE = 'jj';
export const INSERT_EXIT_KEY_SEQUENCE_STORAGE_KEY = 'insertExitKeySequence';
export const MAX_INSERT_EXIT_KEY_SEQUENCE_LENGTH = 16;

type StorageChanges = Record<string, Browser.storage.StorageChange>;

export function isValidInsertExitKeySequence(value: unknown): value is string {
  return (
    typeof value === 'string' &&
    value.length <= MAX_INSERT_EXIT_KEY_SEQUENCE_LENGTH &&
    /^[\x20-\x7e]*$/.test(value)
  );
}

export function normalizeInsertExitKeySequence(value: unknown): string {
  return isValidInsertExitKeySequence(value) ? value : DEFAULT_INSERT_EXIT_KEY_SEQUENCE;
}

export async function readInsertExitKeySequence(): Promise<string> {
  const values = await browser.storage.sync.get<Record<string, unknown>>([
    INSERT_EXIT_KEY_SEQUENCE_STORAGE_KEY,
  ]);
  return normalizeInsertExitKeySequence(values[INSERT_EXIT_KEY_SEQUENCE_STORAGE_KEY]);
}

export async function saveInsertExitKeySequence(value: string): Promise<void> {
  if (!isValidInsertExitKeySequence(value)) {
    throw new Error('Insert exit key sequence is invalid');
  }

  await browser.storage.sync.set({ [INSERT_EXIT_KEY_SEQUENCE_STORAGE_KEY]: value });
}

export function watchInsertExitKeySequence(onChange: (value: string) => void): () => void {
  function handleStorageChange(changes: StorageChanges): void {
    const change = changes[INSERT_EXIT_KEY_SEQUENCE_STORAGE_KEY];
    if (change) {
      onChange(normalizeInsertExitKeySequence(change.newValue));
    }
  }

  browser.storage.sync.onChanged.addListener(handleStorageChange);
  return function unwatchInsertExitKeySequence(): void {
    browser.storage.sync.onChanged.removeListener(handleStorageChange);
  };
}
