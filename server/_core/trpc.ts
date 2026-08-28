import { initTRPC } from '@trpc/server';
import superjson from 'superjson';
import type { TrpcContext } from './context';
import { TRPCError } from '@trpc/server';

const t = initTRPC.context<TrpcContext>().create({
  transformer: superjson,
  errorFormatter({ shape, error }) {
    return shape;
  },
});

export const router = t.router;

/**
 * Public procedure for read-only operations that do not require authentication.
 */
export const publicProcedure = t.procedure;

/**
 * Protected procedure that requires operator authentication.
 * Mutations that can cause live effects must use this.
 */
export const protectedProcedure = t.procedure.use(({ ctx, next }) => {
  if (!ctx.operatorAuth.isAuthenticated) {
    throw new TRPCError({ code: 'UNAUTHORIZED', message: 'Unauthorized' });
  }
  return next();
});
