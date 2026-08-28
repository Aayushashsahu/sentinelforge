import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { validateOperatorToken, computeCredentialIdentifier } from './auth';
import { appRouter } from '../routers';
import { TRPCError } from '@trpc/server';

function fakeReq(headers: Record<string, string | undefined> = {}) {
  return { req: { header: (name: string) => headers[name.toLowerCase()] } } as any;
}

function createCallerWithHeaders(headers: Record<string, string | undefined> = {}) {
  return appRouter.createCaller({
    req: fakeReq(headers) as any,
    res: {} as any,
    operatorAuth: validateOperatorToken(fakeReq(headers)),
  } as any);
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

describe('tRPC boundary — protectedProcedure enforcement', () => {
  const originalEnv = process.env.OPERATOR_TOKEN;

  afterEach(() => {
    if (originalEnv === undefined) delete process.env.OPERATOR_TOKEN;
    else process.env.OPERATOR_TOKEN = originalEnv;
  });

  it('rejects unauthenticated createLive mutation', async () => {
    process.env.OPERATOR_TOKEN = 'test-operator-secret';
    const caller = createCallerWithHeaders({});
    await expect(
      caller.missions.createLive({ title: 'test-title', repository: 'test/repo', incident: 'test incident description here', risk: 'LOW' })
    ).rejects.toThrow();
  });

  it('rejects unauthenticated investigate mutation', async () => {
    process.env.OPERATOR_TOKEN = 'test-operator-secret';
    const caller = createCallerWithHeaders({});
    await expect(caller.missions.investigate({ missionId: 'test-mission-id' })).rejects.toThrow();
  });

  it('rejects unauthenticated runRepairPlan mutation', async () => {
    process.env.OPERATOR_TOKEN = 'test-operator-secret';
    const caller = createCallerWithHeaders({});
    await expect(caller.missions.runRepairPlan({ missionId: 'test-mission-id' })).rejects.toThrow();
  });

  it('rejects unauthenticated reconcileLiveInvestigation mutation', async () => {
    process.env.OPERATOR_TOKEN = 'test-operator-secret';
    const caller = createCallerWithHeaders({});
    await expect(caller.missions.reconcileLiveInvestigation({ missionId: 'test-mission-id' })).rejects.toThrow();
  });

  it('rejects unauthenticated sandboxProbe mutation', async () => {
    process.env.OPERATOR_TOKEN = 'test-operator-secret';
    const caller = createCallerWithHeaders({});
    await expect(caller.trueforge.sandboxProbe({ missionId: 'test-mission-id' })).rejects.toThrow();
  });

  it('rejects unauthenticated approvalProbe mutation', async () => {
    process.env.OPERATOR_TOKEN = 'test-operator-secret';
    const caller = createCallerWithHeaders({});
    await expect(caller.trueforge.approvalProbe()).rejects.toThrow();
  });

  it('allows publicProcedure health query without auth', async () => {
    process.env.OPERATOR_TOKEN = 'test-operator-secret';
    const caller = createCallerWithHeaders({});
    const result = await caller.health();
    expect(result.ok).toBe(true);
  });

  it('allows publicProcedure missions.list query without auth', async () => {
    process.env.OPERATOR_TOKEN = 'test-operator-secret';
    const caller = createCallerWithHeaders({});
    try {
      const result = await caller.missions.list();
      expect(Array.isArray(result)).toBe(true);
    } catch (error: any) {
      // Should not be an auth error — downstream DB errors are expected in test env
      expect(error.message).not.toContain('UNAUTHORIZED');
    }
  });

  it('allows publicProcedure launchFixture mutation without auth', async () => {
    process.env.OPERATOR_TOKEN = 'test-operator-secret';
    const caller = createCallerWithHeaders({});
    // launchFixture is intentionally public — this should NOT throw an auth error
    // It may throw for other reasons (no DB, etc.) but not UNAUTHORIZED
    try {
      await caller.missions.launchFixture();
    } catch (error: any) {
      // Should not be an auth error
      expect(error.message).not.toContain('UNAUTHORIZED');
    }
  });

  it('allows publicProcedure decideApproval mutation without auth', async () => {
    process.env.OPERATOR_TOKEN = 'test-operator-secret';
    const caller = createCallerWithHeaders({});
    // decideApproval is intentionally public — human in the loop
    // It may throw for other reasons (no DB, etc.) but not UNAUTHORIZED
    try {
      await caller.missions.decideApproval({ requestId: 'test-id', approve: true });
    } catch (error: any) {
      expect(error.message).not.toContain('UNAUTHORIZED');
    }
  });

  it('authenticated caller passes protectedProcedure check', async () => {
    process.env.OPERATOR_TOKEN = 'test-operator-secret';
    const caller = createCallerWithHeaders({ 'x-operator-token': 'test-operator-secret' });
    // createLive should NOT throw UNAUTHORIZED — it may throw for other reasons (no DB)
    try {
      await caller.missions.createLive({ title: 'test-title', repository: 'test/repo', incident: 'test incident description here', risk: 'LOW' });
    } catch (error: any) {
      expect(error.message).not.toContain('UNAUTHORIZED');
    }
  });

  it('wrong token is rejected by protectedProcedure', async () => {
    process.env.OPERATOR_TOKEN = 'test-operator-secret';
    const caller = createCallerWithHeaders({ 'x-operator-token': 'wrong-token' });
    await expect(
      caller.missions.createLive({ title: 'test-title', repository: 'test/repo', incident: 'test incident description here', risk: 'LOW' })
    ).rejects.toThrow();
  });
});
