import assert from 'node:assert/strict';
import { appRedirectUrl, implicitAuthResult, authErrorMessage } from '../auth-activation-core.mjs';

assert.equal(
  appRedirectUrl('https://jeremyhennessy.github.io/Zero2Fit/?activation=healthkit#ignored'),
  'https://jeremyhennessy.github.io/Zero2Fit/'
);
assert.equal(
  appRedirectUrl('http://localhost:4173/index.html?qa=1'),
  'http://localhost:4173/'
);

const implicit = implicitAuthResult('#access_token=abc&refresh_token=def&expires_in=3600&token_type=bearer&type=signup', 1_700_000_000_000);
assert.equal(implicit.error, null);
assert.equal(implicit.type, 'signup');
assert.equal(implicit.session.access_token, 'abc');
assert.equal(implicit.session.refresh_token, 'def');
assert.equal(implicit.session.expires_at, 1_700_003_600);

const redirectError = implicitAuthResult('#error=access_denied&error_description=Email+link+is+invalid');
assert.equal(redirectError.session, null);
assert.equal(redirectError.error.code, 'access_denied');
assert.equal(redirectError.error.message, 'Email link is invalid');

assert.match(
  authErrorMessage(429, 'email rate limit exceeded'),
  /Do not keep retrying Create account/
);
assert.match(
  authErrorMessage(429, 'For security purposes, you can only request this after 10 seconds.'),
  /resend cooldown/
);
assert.equal(authErrorMessage(400, 'Invalid login credentials'), 'Invalid login credentials');

console.log('Auth activation core contract passed.');
