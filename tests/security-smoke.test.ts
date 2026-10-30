import test from 'node:test';
import assert from 'node:assert/strict';
import { consumeRateLimit } from '@/lib/auth/rate-limit';
import { resolvePermissions } from '@/lib/auth/permissions';
import {
  passwordPolicyFromPlatform,
  validatePasswordPolicy,
} from '@/lib/auth/password-policy';
import { isJwtSessionExpired } from '@/lib/auth/session-policy';
import { DEFAULT_PLATFORM_CONFIG } from '@/lib/dg/platform-config';

test('rate limit blocks after threshold', () => {
  const key = `unit-${Date.now()}`;
  const limit = 3;
  const windowMs = 10_000;
  const a = consumeRateLimit(key, limit, windowMs);
  const b = consumeRateLimit(key, limit, windowMs);
  const c = consumeRateLimit(key, limit, windowMs);
  const d = consumeRateLimit(key, limit, windowMs);
  assert.equal(a.allowed, true);
  assert.equal(b.allowed, true);
  assert.equal(c.allowed, true);
  assert.equal(d.allowed, false);
});

test('hr role contains admin permissions', () => {
  const perms = resolvePermissions('hr_admin');
  assert.ok(perms.includes('employees.write'));
  assert.ok(perms.includes('leaves.approve'));
  assert.ok(perms.includes('attendance.export'));
  assert.ok(perms.includes('scanner.use'));
});

test('auditor is read-only + audit', () => {
  const perms = resolvePermissions('hr_auditor');
  assert.ok(perms.includes('audit.read'));
  assert.ok(perms.includes('attendance.export'));
  assert.equal(perms.includes('employees.write'), false);
  assert.equal(perms.includes('scanner.use'), false);
});

test('password policy requires complexity', () => {
  const policy = passwordPolicyFromPlatform(DEFAULT_PLATFORM_CONFIG);
  assert.equal(validatePasswordPolicy('short', policy), 'PASSWORD_TOO_SHORT');
  assert.equal(validatePasswordPolicy('onlylowercase123', policy), 'PASSWORD_NEEDS_UPPERCASE');
  assert.equal(validatePasswordPolicy('ONLYUPPERCASE123', policy), 'PASSWORD_NEEDS_LOWERCASE');
  assert.equal(validatePasswordPolicy('ValidPass123!', policy), null);
});

test('jwt session expiry is enforced from token exp', () => {
  const past = Math.floor(Date.now() / 1000) - 60;
  const future = Math.floor(Date.now() / 1000) + 3600;
  assert.equal(isJwtSessionExpired({ exp: past }), true);
  assert.equal(isJwtSessionExpired({ exp: future }), false);
  assert.equal(isJwtSessionExpired({}), false);
});

test('password policy respects configurable min length', () => {
  const policy = passwordPolicyFromPlatform({
    ...DEFAULT_PLATFORM_CONFIG,
    passwordMinLength: 12,
    passwordRequireSpecialChars: false,
  });
  assert.equal(validatePasswordPolicy('ValidPass1234', policy), null);
  assert.equal(validatePasswordPolicy('Short1A', policy), 'PASSWORD_TOO_SHORT');
});
