import { test } from 'node:test';
import assert from 'node:assert/strict';
import { authErrorText, cleanCode, initials, isEmail } from '../src/lib/authText.ts';

test('isEmail accepts ordinary addresses and trims spaces', () => {
  assert.equal(isEmail('ana@example.com'), true);
  assert.equal(isEmail('  ana.b+daypad@mail.co.uk '), true);
});

test('isEmail rejects incomplete addresses', () => {
  for (const bad of ['', 'ana', 'ana@', '@example.com', 'ana@example', 'ana @example.com', 'ana@example.c']) {
    assert.equal(isEmail(bad), false, bad);
  }
});

test('cleanCode keeps up to six digits from pasted text', () => {
  assert.equal(cleanCode('481 205'), '481205');
  assert.equal(cleanCode('48-12-05-99'), '481205');
  assert.equal(cleanCode('abc'), '');
});

test('initials come from the name, then the email', () => {
  assert.equal(initials('Ana Basha', 'x@y.z'), 'AB');
  assert.equal(initials('  ana  maria  lopez ', null), 'AL');
  assert.equal(initials('Cher', null), 'CH');
  assert.equal(initials('', 'ben@example.com'), 'B');
  assert.equal(initials(null, null), '?');
});

test('authErrorText gives plain messages for common errors', () => {
  assert.equal(authErrorText(null), '');
  assert.match(authErrorText({ code: 'otp_expired' }), /code didn't work/);
  assert.match(authErrorText({ code: 'over_email_send_rate_limit' }), /Too many tries/);
  assert.match(authErrorText({ status: 429 }), /Too many tries/);
  assert.match(authErrorText({ code: 'email_address_invalid' }), /looks wrong/);
  assert.match(authErrorText({ name: 'AuthRetryableFetchError', message: 'Failed to fetch' }), /connection/);
  assert.match(authErrorText({ code: 'something_new' }), /Something went wrong/);
});
