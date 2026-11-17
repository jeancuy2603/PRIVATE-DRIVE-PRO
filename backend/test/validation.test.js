import test from 'node:test';
import assert from 'node:assert/strict';
import {
  validPositiveId,
  cleanDisplayName,
  normalizeEmail,
  normalizeSharePermission,
  escapeLike
} from '../src/utils/validation.js';

test('validPositiveId rejects invalid, fractional and unsafe identifiers', () => {
  assert.equal(validPositiveId('12'), 12);
  assert.equal(validPositiveId('0'), null);
  assert.equal(validPositiveId('-2'), null);
  assert.equal(validPositiveId('1.5'), null);
  assert.equal(validPositiveId('9007199254740992'), null);
});

test('cleanDisplayName trims and rejects control characters and long values', () => {
  assert.equal(cleanDisplayName('  Informe  '), 'Informe');
  assert.equal(cleanDisplayName(''), null);
  assert.equal(cleanDisplayName('a\nb'), null);
  assert.equal(cleanDisplayName('x'.repeat(256)), null);
});

test('normalizeEmail canonicalizes and validates email addresses', () => {
  assert.equal(normalizeEmail('  PERSONA@EXAMPLE.COM '), 'persona@example.com');
  assert.equal(normalizeEmail('not-an-email'), null);
});

test('share permissions are allow-listed', () => {
  assert.equal(normalizeSharePermission(undefined), 'VIEW');
  assert.equal(normalizeSharePermission('download'), 'DOWNLOAD');
  assert.equal(normalizeSharePermission('OWNER'), null);
});

test('escapeLike escapes SQL LIKE wildcard characters', () => {
  assert.equal(escapeLike('100%_ok\\'), '100\\%\\_ok\\\\');
});
