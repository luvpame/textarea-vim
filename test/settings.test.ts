import { describe, expect, test } from 'vitest';
import {
  DEFAULT_INSERT_EXIT_KEY_SEQUENCE,
  isValidInsertExitKeySequence,
  normalizeInsertExitKeySequence,
} from '../src/settings.js';

describe('INSERT終了キー列の設定', function describeInsertExitKeySequence(): void {
  test('既定値と空欄を受け入れる', function testDefaultAndEmptyValues(): void {
    expect(isValidInsertExitKeySequence(DEFAULT_INSERT_EXIT_KEY_SEQUENCE)).toBe(true);
    expect(isValidInsertExitKeySequence('')).toBe(true);
  });

  test('印字可能ASCII文字を16文字まで受け入れる', function testPrintableAsciiValues(): void {
    expect(isValidInsertExitKeySequence('0123456789abcdef')).toBe(true);
    expect(isValidInsertExitKeySequence('0123456789abcdefg')).toBe(false);
  });

  test('印字可能ASCII文字以外を拒否する', function testInvalidValues(): void {
    expect(isValidInsertExitKeySequence('\n')).toBe(false);
    expect(isValidInsertExitKeySequence('あ')).toBe(false);
    expect(isValidInsertExitKeySequence(null)).toBe(false);
  });

  test('不正な保存値を既定値へ戻し、空欄は維持する', function testNormalization(): void {
    expect(normalizeInsertExitKeySequence('\n')).toBe(DEFAULT_INSERT_EXIT_KEY_SEQUENCE);
    expect(normalizeInsertExitKeySequence('')).toBe('');
  });
});
