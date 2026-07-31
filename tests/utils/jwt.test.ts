import { describe, it, expect } from 'vitest';
import jwt from 'jsonwebtoken';
import {
  generateAccessToken,
  generateRefreshToken,
  verifyAccessToken,
  verifyRefreshToken,
  hashToken,
} from '../../src/utils/jwt.js';
import { env } from '../../src/config/env.js';

//Why real jsonwebtoken instead of mocking it:
//  your existing auth.service.test.ts already does this — it never mocks jsonwebtoken, it just asserts result.token (now accessToken/refreshToken) toBeDefined().
//  A round-trip test (sign with one function, verify with its counterpart) is a stronger, more honest check than mocking jwt.sign/jwt.verify to return canned values, since it actually proves the two functions agree with each other and with the real library.
//  The cross-secret tests are the ones that matter most here — they're the direct proof that an access token and a refresh token really can't be swapped for each other.
describe('generateAccessToken / verifyAccessToken', () => {
  it('round-trips id, role, and a type claim of "access"', () => {
    const token = generateAccessToken({ id: 'user-1', role: 'customer' });
    const payload = verifyAccessToken(token);

    expect(payload.id).toBe('user-1');
    expect(payload.role).toBe('customer');
    expect(payload.type).toBe('access');
  });

  it('rejects a token signed with the refresh secret', () => {
    const foreignToken = jwt.sign({ id: 'user-1', type: 'access' }, env.JWT_REFRESH_SECRET, {
      expiresIn: '15m',
    });

    expect(() => verifyAccessToken(foreignToken)).toThrow();
  });

  it('sets an expiry claim on the token', () => {
    const token = generateAccessToken({ id: 'user-1', role: 'customer' });
    const decoded = jwt.decode(token);

    expect(decoded).not.toBeNull();
    if (decoded && typeof decoded === 'object') {
      expect(decoded.exp).toBeDefined();
    }
  });
});

describe('generateRefreshToken / verifyRefreshToken', () => {
  it('round-trips id and a type claim of "refresh"', () => {
    const token = generateRefreshToken({ id: 'user-1' });
    const payload = verifyRefreshToken(token);

    expect(payload.id).toBe('user-1');
    expect(payload.type).toBe('refresh');
  });

  it('rejects a token signed with the access secret', () => {
    const foreignToken = jwt.sign({ id: 'user-1', type: 'refresh' }, env.JWT_SECRET, {
      expiresIn: '30d',
    });

    expect(() => verifyRefreshToken(foreignToken)).toThrow();
  });
});

describe('hashToken', () => {
  it('produces the same hash for the same input', () => {
    expect(hashToken('same-token')).toBe(hashToken('same-token'));
  });

  it('produces a different hash for a different input', () => {
    expect(hashToken('token-a')).not.toBe(hashToken('token-b'));
  });

  it('never returns the original token as its own hash', () => {
    const token = 'some-refresh-token-value';
    expect(hashToken(token)).not.toBe(token);
  });

  it('produces a 64-character hex string (sha256 digest)', () => {
    expect(hashToken('anything')).toMatch(/^[0-9a-f]{64}$/);
  });
});
