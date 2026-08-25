import { MatchPattern } from 'wxt/utils/match-patterns';

export type UrlPolicyMode = 'blocklist' | 'allowlist';

export type UrlPolicy = {
  mode: UrlPolicyMode;
  patterns: string[];
};

export type UrlPatternError = {
  line: number;
  pattern: string;
  message: string;
};

export type UrlPatternParseResult = {
  patterns: string[];
  errors: UrlPatternError[];
};

export const DEFAULT_URL_POLICY: UrlPolicy = {
  mode: 'blocklist',
  patterns: [],
};

export class UrlPolicyValidationError extends Error {
  readonly errors: UrlPatternError[];

  constructor(errors: UrlPatternError[]) {
    super('URLパターンが不正です');
    this.name = 'UrlPolicyValidationError';
    this.errors = errors;
  }
}

function isUrlPolicyMode(value: unknown): value is UrlPolicyMode {
  return value === 'blocklist' || value === 'allowlist';
}

function readMatchPatternError(error: unknown): string {
  if (error instanceof Error && error.message) {
    return error.message;
  }
  return 'Chrome match patternとして解釈できません';
}

function validatePattern(pattern: string): string | null {
  if (pattern !== '<all_urls>') {
    const separator = pattern.indexOf('://');
    const protocol = separator >= 0 ? pattern.slice(0, separator) : '';
    if (!['http', 'https', 'file', '*'].includes(protocol)) {
      return '対応しているschemeはhttp、https、file、*です';
    }
  }

  try {
    void new MatchPattern(pattern);
    return null;
  } catch (error) {
    return readMatchPatternError(error);
  }
}

export function parseUrlPatterns(value: string): UrlPatternParseResult {
  const patterns: string[] = [];
  const errors: UrlPatternError[] = [];
  const seen = new Set<string>();

  for (const [index, line] of value.split(/\r?\n/).entries()) {
    const pattern = line.trim();
    if (!pattern) {
      continue;
    }

    const message = validatePattern(pattern);
    if (message) {
      errors.push({ line: index + 1, pattern, message });
      continue;
    }
    if (!seen.has(pattern)) {
      seen.add(pattern);
      patterns.push(pattern);
    }
  }

  return { patterns, errors };
}

function normalizeUrlPatterns(patterns: readonly unknown[]): string[] {
  const normalized: string[] = [];
  const seen = new Set<string>();

  for (const value of patterns) {
    if (typeof value !== 'string') {
      continue;
    }
    const pattern = value.trim();
    if (!pattern || seen.has(pattern) || validatePattern(pattern)) {
      continue;
    }
    seen.add(pattern);
    normalized.push(pattern);
  }

  return normalized;
}

export function normalizeUrlPolicy(value: unknown): UrlPolicy {
  if (!value || typeof value !== 'object') {
    return { mode: DEFAULT_URL_POLICY.mode, patterns: [] };
  }

  const candidate = value as { mode?: unknown; patterns?: unknown };
  const mode = isUrlPolicyMode(candidate.mode) ? candidate.mode : DEFAULT_URL_POLICY.mode;
  const patterns = Array.isArray(candidate.patterns)
    ? normalizeUrlPatterns(candidate.patterns)
    : [];
  return { mode, patterns };
}

export function createUrlPolicy(mode: UrlPolicyMode, value: string): UrlPolicy {
  if (!isUrlPolicyMode(mode)) {
    throw new Error('URLポリシーのモードが不正です');
  }
  const result = parseUrlPatterns(value);
  if (result.errors.length > 0) {
    throw new UrlPolicyValidationError(result.errors);
  }
  return { mode, patterns: result.patterns };
}

export function formatUrlPatterns(patterns: readonly string[]): string {
  return patterns.join('\n');
}

function matchesUrl(patternText: string, url: string | URL): boolean {
  try {
    return new MatchPattern(patternText).includes(typeof url === 'string' ? url : url.href);
  } catch {
    return false;
  }
}

export function isUrlAllowed(policy: UrlPolicy, url: string | URL): boolean {
  const normalized = normalizeUrlPolicy(policy);
  if (normalized.patterns.length === 0) {
    return normalized.mode === 'blocklist';
  }

  const matched = normalized.patterns.some(function checkPattern(patternText): boolean {
    return matchesUrl(patternText, url);
  });

  return normalized.mode === 'allowlist' ? matched : !matched;
}
