import type { CreateExpressContextOptions } from '@trpc/server/adapters/express';
import { createHash } from 'node:crypto';

export type OperatorAuth = {
  isAuthenticated: boolean;
  operatorId?: string;
};

/**
 * Extracts and validates the operator token from request headers.
 * The token must match the OPERATOR_TOKEN environment variable.
 */
export function validateOperatorToken(opts: CreateExpressContextOptions): OperatorAuth {
  const authHeader = opts.req.header('x-operator-token') ?? opts.req.header('authorization')?.replace(/^Bearer\s+/i, '');
  const expectedToken = process.env.OPERATOR_TOKEN;

  if (!expectedToken) {
    // If no operator token is configured, fail closed: no operator authenticated.
    return { isAuthenticated: false };
  }

  if (!authHeader || authHeader !== expectedToken) {
    return { isAuthenticated: false };
  }

  // In a real system, you might derive an operator ID from the token or a lookup.
  // For simplicity, we use a fixed ID.
  return { isAuthenticated: true, operatorId: 'system' };
}

/**
 * Computes a non-reversible identifier (SHA-256 hex digest) for a token.
 * Returns undefined if the token is undefined.
 */
export function computeCredentialIdentifier(token: string | undefined): string | undefined {
  if (!token) {
    return undefined;
  }
  return createHash('sha256').update(token).digest('hex');
}

