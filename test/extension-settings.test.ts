import { describe, expect, test } from 'vitest';
import { DEFAULT_EXTENSION_ENABLED, normalizeExtensionEnabled } from '../src/extension-settings.js';

describe('拡張機能の有効設定', function describeExtensionEnabled(): void {
  test('既定値は有効', function testDefaultValue(): void {
    expect(DEFAULT_EXTENSION_ENABLED).toBe(true);
    expect(normalizeExtensionEnabled(undefined)).toBe(true);
  });

  test('真偽値だけを設定値として受け入れる', function testBooleanValues(): void {
    expect(normalizeExtensionEnabled(true)).toBe(true);
    expect(normalizeExtensionEnabled(false)).toBe(false);
    expect(normalizeExtensionEnabled('false')).toBe(true);
    expect(normalizeExtensionEnabled(null)).toBe(true);
  });
});
