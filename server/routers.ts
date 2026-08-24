import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { publicProcedure, router } from "./_core/trpc";
import { z } from "zod";
import { launchDeterministicFixtureMission, resolveApproval } from "./sentinelforge/workflow";
import { getMissionBundle, listMissionBundles } from "./sentinelforge/repository";

export const appRouter = router({
  system: systemRouter,
  auth: router({
    me: publicProcedure.query(opts => opts.ctx.user),
    logout: publicProcedure.mutation(({ ctx }) => { const cookieOptions = getSessionCookieOptions(ctx.req); ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 }); return { success: true } as const; }),
  }),
  missions: router({
    list: publicProcedure.query(async () => (await listMissionBundles()).filter(Boolean)),
    get: publicProcedure.input(z.object({ id: z.string().min(4).max(32) })).query(async ({ input }) => getMissionBundle(input.id)),
    launchFixture: publicProcedure.mutation(async () => launchDeterministicFixtureMission()),
    decideApproval: publicProcedure.input(z.object({ requestId: z.string().min(4).max(32), approve: z.boolean() })).mutation(async ({ input }) => resolveApproval(input.requestId, input.approve)),
  }),
});
export type AppRouter = typeof appRouter;
