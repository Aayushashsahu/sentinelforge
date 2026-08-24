import type { CreateExpressContextOptions } from "@trpc/server/adapters/express";

export type TrpcContext = Pick<CreateExpressContextOptions, "req" | "res">;

export function createContext(opts: CreateExpressContextOptions): TrpcContext {
  return { req: opts.req, res: opts.res };
}
