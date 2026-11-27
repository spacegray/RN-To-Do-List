/*
 * Pure helpers for the sign-in screens (no React Native imports, so they run under `node --test`).
 */

/** Loose email check: something@something.tld, no spaces. The server does the real check. */
export function isEmail(text: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(text.trim());
}

/** Keeps only digits, at most `length` of them (pasted codes often carry spaces or dashes). */
export function cleanCode(text: string, length = 6): string {
  return text.replace(/\D/g, '').slice(0, length);
}

/** Up to two initials from a name, or the first letter of the email; "?" when there's nothing. */
export function initials(name: string | null | undefined, email: string | null | undefined): string {
  const words = (name ?? '').trim().split(/\s+/).filter(Boolean);
  if (words.length >= 2) return (words[0][0] + words[words.length - 1][0]).toUpperCase();
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  const first = (email ?? '').trim()[0];
  return first ? first.toUpperCase() : '?';
}

type AuthErrorLike = { code?: string; status?: number; message?: string; name?: string } | null | undefined;

/** Turns a Supabase auth error into a short, plain message for the sheet. */
export function authErrorText(error: AuthErrorLike): string {
  if (!error) return '';
  const code = error.code ?? '';
  if (code === 'otp_expired' || code === 'invalid_credentials' || code === 'otp_disabled') {
    return "That code didn't work. Check it, or send a new one.";
  }
  if (code.startsWith('over_') || error.status === 429) return 'Too many tries. Wait a minute, then try again.';
  if (code === 'email_address_invalid' || code === 'validation_failed') return 'That email address looks wrong.';
  if (code === 'signup_disabled') return 'New accounts are paused right now.';
  if (error.name === 'AuthRetryableFetchError' || error.status === 0 || /fetch|network/i.test(error.message ?? '')) {
    return "Can't reach the server. Check your connection and try again.";
  }
  return 'Something went wrong. Try again.';
}

export type Provider = 'google' | 'github';
export const providerName = (p: string | null | undefined) =>
  p === 'google' ? 'Google' : p === 'github' ? 'GitHub' : p === 'email' ? 'Email' : p ? p[0].toUpperCase() + p.slice(1) : 'Email';

/**
 * Reads an error that Google or GitHub (via Supabase) sent back in the address after a sign-in attempt, from the
 * query (`?error=...`) or the hash (`#error=...`). Returns a plain message, or null when there's no error.
 */
export function oauthReturnError(search: string, hash: string, provider: string | null): string | null {
  const params = new URLSearchParams(search.replace(/^\?/, ''));
  const fromHash = new URLSearchParams(hash.replace(/^#/, ''));
  const error = params.get('error') ?? fromHash.get('error');
  if (!error) return null;
  const code = params.get('error_code') ?? fromHash.get('error_code') ?? '';
  const name = providerName(provider) === 'Email' ? 'That' : providerName(provider);
  if (error === 'access_denied' && !/expired/i.test(code)) return `${name} sign-in was cancelled. Try again, or use your email.`;
  if (/expired/i.test(code)) return 'That sign-in link has expired. Send a new one.';
  return `${name} sign-in didn't work. Try again, or use your email.`;
}

/** The address with any sign-in error parameters removed, for cleaning up the address bar. */
export function withoutAuthParams(href: string): string {
  const url = new URL(href);
  for (const k of ['error', 'error_code', 'error_description', 'code', 'state']) url.searchParams.delete(k);
  if (/(^#|&)error=/.test(url.hash) || /access_token=/.test(url.hash)) url.hash = '';
  return url.toString();
}
