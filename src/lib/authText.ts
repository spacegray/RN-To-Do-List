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
