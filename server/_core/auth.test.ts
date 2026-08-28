import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { validateOperatorToken, computeCredentialIdentifier } from './auth';

function fakeReq(headers: Record<string, string | undefined> = {}) {
  return { req: { header: (name: string) => headers[name.toLowerCase()] } } as any;
}

describe('validateOperatorToken', () => {
  const originalEnv = process.env.OPERATOR_TOKEN;

  afterEach(() => {
    if (originalEnv === undefined) delete process.env.OPERATOR_TOKEN;
    else process.env.OPERATOR_TOKEN = originalEnv;
  });

  it('fails closed when OPERATOR_TOKEN is not configured', () => {
    delete process.env.OPERATOR_TOKEN;
    const result = validateOperatorToken(fakeReq({ 'x-operator-token': 'any-value' }));
    expect(result.isAuthenticated).toBe(false);
  });

  it('rejects when no auth header is present', () => {
    process.env.OPERATOR_TOKEN = 'secret-token';
    const result = validateOperatorToken(fakeReq({}));
    expect(result.isAuthenticated).toBe(false);
  });

  it('rejects when x-operator-token header does not match', () => {
    process.env.OPERATOR_TOKEN = 'secret-token';
    const result = validateOperatorToken(fakeReq({ 'x-operator-token': 'wrong-token' }));
    expect(result.isAuthenticated).toBe(false);
  });

  it('rejects when Authorization Bearer does not match', () => {
    process.env.OPERATOR_TOKEN = 'secret-token';
    const result = validateOperatorToken(fakeReq({ 'authorization': 'Bearer wrong-token' }));
    expect(result.isAuthenticated).toBe(false);
  });

  it('accepts when x-operator-token header matches exactly', () => {
    process.env.OPERATOR_TOKEN = 'secret-token';
    const result = validateOperatorToken(fakeReq({ 'x-operator-token': 'secret-token' }));
    expect(result.isAuthenticated).toBe(true);
    expect(result.operatorId).toBe('system');
  });

  it('accepts when Authorization Bearer matches exactly', () => {
    process.env.OPERATOR_TOKEN = 'secret-token';
    const result = validateOperatorToken(fakeReq({ 'authorization': 'Bearer secret-token' }));
    expect(result.isAuthenticated).toBe(true);
    expect(result.operatorId).toBe('system');
  });

  it('prefers x-operator-token over Authorization header', () => {
    process.env.OPERATOR_TOKEN = 'secret-token';
    const result = validateOperatorToken(fakeReq({
      'x-operator-token': 'secret-token',
      'authorization': 'Bearer wrong-token',
    }));
    expect(result.isAuthenticated).toBe(true);
  });

  it('case-sensitive comparison rejects partial matches', () => {
    process.env.OPERATOR_TOKEN = 'Secret-Token';
    const result = validateOperatorToken(fakeReq({ 'x-operator-token': 'secret-token' }));
    expect(result.isAuthenticated).toBe(false);
  });
});

describe('computeCredentialIdentifier', () => {
  it('returns undefined for undefined input', () => {
    expect(computeCredentialIdentifier(undefined)).toBeUndefined();
  });

  it('returns a deterministic SHA-256 hex digest', () => {
    const id1 = computeCredentialIdentifier('test-token');
    const id2 = computeCredentialIdentifier('test-token');
    expect(id1).toBe(id2);
    expect(id1).toMatch(/^[a-f0-9]{64}$/);
  });

  it('returns different identifiers for different tokens', () => {
    const id1 = computeCredentialIdentifier('token-a');
    const id2 = computeCredentialIdentifier('token-b');
    expect(id1).not.toBe(id2);
  });

  it('does not leak the original token in the identifier', () => {
    const token = 'super-secret-ghp_1234567890';
    const identifier = computeCredentialIdentifier(token);
    expect(identifier).not.toContain(token);
    expect(identifier).not.toContain('ghp_');
  });
});
