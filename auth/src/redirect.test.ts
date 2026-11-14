import { describe, expect, it } from 'vitest';
import { safeRedirect } from './redirect';

const ALLOWED = ['https://expenses.shefin.dev', 'https://notes.shefin.dev'];
const FALLBACK = 'https://expenses.shefin.dev';

describe('safeRedirect (open-redirect protection)', () => {
  it('accepts absolute URLs on an allowed origin, keeping path, query and hash', () => {
    expect(safeRedirect('https://expenses.shefin.dev/fees?x=1#top', ALLOWED, FALLBACK)).toBe('https://expenses.shefin.dev/fees?x=1#top');
    expect(safeRedirect('https://notes.shefin.dev/', ALLOWED, FALLBACK)).toBe('https://notes.shefin.dev/');
  });

  it('falls back when nothing is given', () => {
    expect(safeRedirect(null, ALLOWED, FALLBACK)).toBe(FALLBACK);
    expect(safeRedirect('', ALLOWED, FALLBACK)).toBe(FALLBACK);
    expect(safeRedirect(undefined, ALLOWED, FALLBACK)).toBe(FALLBACK);
  });

  it.each([
    ['another site', 'https://evil.example/steal'],
    ['look-alike suffix host', 'https://expenses.shefin.dev.evil.example/'],
    ['look-alike prefix host', 'https://evilexpenses.shefin.dev/'],
    ['an allowed host as a username', 'https://expenses.shefin.dev@evil.example/'],
    ['embedded credentials on an allowed host', 'https://user:pass@expenses.shefin.dev/'],
    ['protocol-relative URL', '//evil.example/x'],
    ['relative path', '/fees'],
    ['javascript: URL', 'javascript:alert(1)'],
    ['data: URL', 'data:text/html,<script>alert(1)</script>'],
    ['backslash trick', 'https:\\\\evil.example'],
    ['downgraded scheme', 'http://expenses.shefin.dev/'],
    ['other port', 'https://expenses.shefin.dev:8443/'],
    ['plain garbage', 'not a url'],
    ['whitespace-prefixed javascript', '  javascript:alert(1)'],
  ])('rejects %s', (_name, value) => {
    expect(safeRedirect(value, ALLOWED, FALLBACK)).toBe(FALLBACK);
  });

  it('allows local development origins only when they are configured', () => {
    expect(safeRedirect('http://localhost:5173/x', ['http://localhost:5173'], 'http://localhost:5173')).toBe('http://localhost:5173/x');
    expect(safeRedirect('http://localhost:5173/x', ALLOWED, FALLBACK)).toBe(FALLBACK);
  });
});
