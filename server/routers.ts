import { z } from "zod";
import { publicProcedure, router } from "./_core/trpc";
import { getMissionBundle, listMissionBundles } from "./sentinelforge/repository";
import { launchDeterministicFixtureMission, resolveApproval } from "./sentinelforge/workflow";

export const appRouter = router({
  health: publicProcedure.query(() => ({ ok: true, service: "sentinelforge" })),
  missions: router({
    list: publicProcedure.query(async () => (await listMissionBundles()).filter(Boolean)),
    get: publicProcedure.input(z.object({ id: z.string().min(4).max(32) })).query(async ({ input }) => getMissionBundle(input.id)),
    launchFixture: publicProcedure.mutation(async () => launchDeterministicFixtureMission()),
    decideApproval: publicProcedure.input(z.object({ requestId: z.string().min(4).max(32), approve: z.boolean() })).mutation(async ({ input }) => resolveApproval(input.requestId, input.approve)),
  }),
});
export type AppRouter = typeof appRouter;
