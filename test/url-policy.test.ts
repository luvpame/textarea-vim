import { describe, expect, test } from 'vitest';
import {
  createUrlPolicy,
  DEFAULT_URL_POLICY,
  isUrlAllowed,
  normalizeUrlPolicy,
  parseUrlPatterns,
  UrlPolicyValidationError,
} from '../src/url-policy.js';

describe('URLポリシー', function describeUrlPolicy(): void {
  test('空のブラックリストはすべてのURLを許可する', function testEmptyBlocklist(): void {
    expect(isUrlAllowed(DEFAULT_URL_POLICY, 'https://example.com/path')).toBe(true);
  });

  test('空のホワイトリストはすべてのURLを拒否する', function testEmptyAllowlist(): void {
    expect(isUrlAllowed({ mode: 'allowlist', patterns: [] }, 'https://example.com/path')).toBe(
      false,
    );
  });

  test('ブラックリストに一致したURLを拒否する', function testBlocklistMatch(): void {
    const policy = createUrlPolicy('blocklist', 'https://example.com/*');
    expect(isUrlAllowed(policy, 'https://example.com/path?allowed=true#section')).toBe(false);
    expect(isUrlAllowed(policy, new URL('https://example.com/path'))).toBe(false);
    expect(isUrlAllowed(policy, 'https://other.example.com/path')).toBe(true);
  });

  test('ホワイトリストに一致したURLだけを許可する', function testAllowlistMatch(): void {
    const policy = createUrlPolicy('allowlist', '*://*.example.com/docs/*');
    expect(isUrlAllowed(policy, 'https://www.example.com/docs/guide')).toBe(true);
    expect(isUrlAllowed(policy, 'http://example.com/docs/guide')).toBe(true);
    expect(isUrlAllowed(policy, 'https://www.example.com/blog/guide')).toBe(false);
  });

  test('入力の空行と重複を除く', function testParsePatterns(): void {
    expect(parseUrlPatterns('\n https://example.com/* \nhttps://example.com/*\n')).toEqual({
      patterns: ['https://example.com/*'],
      errors: [],
    });
  });

  test('不正なパターンを行番号付きで報告する', function testInvalidPattern(): void {
    const result = parseUrlPatterns('https://example.com/*\nnot-a-match-pattern');
    expect(result.patterns).toEqual(['https://example.com/*']);
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0]).toMatchObject({ line: 2, pattern: 'not-a-match-pattern' });
  });

  test('判定時に例外を投げるschemeは保存時に拒否する', function testUnsupportedUtilityScheme(): void {
    expect(function createFtpPolicy(): void {
      createUrlPolicy('allowlist', 'ftp://example.com/*');
    }).toThrow(UrlPolicyValidationError);
  });

  test('壊れた保存値を既定のブラックリストへ戻す', function testInvalidStoredPolicy(): void {
    expect(normalizeUrlPolicy({ mode: 'invalid', patterns: ['bad', 1] })).toEqual({
      mode: 'blocklist',
      patterns: [],
    });
  });
});
