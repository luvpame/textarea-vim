import { type Browser, browser } from 'wxt/browser';

export const EXTENSION_ENABLED_STORAGE_KEY = 'extensionEnabled';
export const DEFAULT_EXTENSION_ENABLED = true;

type StorageChanges = Record<string, Browser.storage.StorageChange>;

export function normalizeExtensionEnabled(value: unknown): boolean {
  return typeof value === 'boolean' ? value : DEFAULT_EXTENSION_ENABLED;
}

export async function readExtensionEnabled(): Promise<boolean> {
  const values = await browser.storage.sync.get<Record<string, unknown>>([
    EXTENSION_ENABLED_STORAGE_KEY,
  ]);
  return normalizeExtensionEnabled(values[EXTENSION_ENABLED_STORAGE_KEY]);
}

export async function saveExtensionEnabled(enabled: boolean): Promise<void> {
  await browser.storage.sync.set({ [EXTENSION_ENABLED_STORAGE_KEY]: enabled });
}

export function watchExtensionEnabled(onChange: (enabled: boolean) => void): () => void {
  function handleStorageChange(changes: StorageChanges): void {
    const change = changes[EXTENSION_ENABLED_STORAGE_KEY];
    if (!change) {
      return;
    }
    onChange(normalizeExtensionEnabled(change.newValue));
  }

  browser.storage.sync.onChanged.addListener(handleStorageChange);
  return function unwatchExtensionEnabled(): void {
    browser.storage.sync.onChanged.removeListener(handleStorageChange);
  };
}
