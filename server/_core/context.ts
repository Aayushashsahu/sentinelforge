import type { CreateExpressContextOptions } from '@trpc/server/adapters/express';
import type { OperatorAuth } from './auth';
import { validateOperatorToken } from './auth';

export type TrpcContext = Pick<CreateExpressContextOptions, 'req' | 'res'> & {
  operatorAuth: OperatorAuth;
};

export function createContext(opts: CreateExpressContextOptions): TrpcContext {
  return {
    ...opts,
    operatorAuth: validateOperatorToken(opts),
  };
}
