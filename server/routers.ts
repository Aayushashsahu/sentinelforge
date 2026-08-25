import { z } from "zod";
import { publicProcedure, router } from "./_core/trpc";
import { getMissionBundle, listMissionBundles } from "./sentinelforge/repository";
import { launchDeterministicFixtureMission, resolveApproval } from "./sentinelforge/workflow";
import { probeConfiguredTrueForge } from "./sentinelforge/trueforge/client";
import { createLiveMission, investigateLiveMission, reconcileLiveInvestigation, runLiveRepairPlan, runLiveSandboxProbe } from "./sentinelforge/liveWorkflow";
import { getLiveExecutionContractStatus } from "./sentinelforge/liveContracts";
import { verifyIncidentFixtureDeterministically } from "./sentinelforge/verifier";

export const appRouter = router({
  health: publicProcedure.query(() => ({ ok: true, service: "sentinelforge" })),
  trueforge: router({
    status: publicProcedure.query(async () => probeConfiguredTrueForge()),
    executionContracts: publicProcedure.query(() => getLiveExecutionContractStatus()),
    verifyIncidentFixture: publicProcedure.input(z.object({ packageVersion: z.string().min(1), manifestVersion: z.string().min(1), proposedManifestVersion: z.string().min(1) })).query(({ input }) => verifyIncidentFixtureDeterministically(input)),
    sandboxProbe: publicProcedure.input(z.object({ missionId: z.string().min(4).max(32) })).mutation(async ({ input }) => runLiveSandboxProbe(input.missionId)),
  }),
  missions: router({
    list: publicProcedure.query(async () => (await listMissionBundles()).filter(Boolean)),
    get: publicProcedure.input(z.object({ id: z.string().min(4).max(32) })).query(async ({ input }) => getMissionBundle(input.id)),
    launchFixture: publicProcedure.mutation(async () => launchDeterministicFixtureMission()),
    createLive: publicProcedure.input(z.object({ title: z.string().min(4).max(255), repository: z.string().min(3).max(255), incident: z.string().min(8).max(8_000), risk: z.enum(["LOW", "MEDIUM", "HIGH"]) })).mutation(async ({ input }) => createLiveMission(input)),
    investigate: publicProcedure.input(z.object({ missionId: z.string().min(4).max(32) })).mutation(async ({ input }) => investigateLiveMission(input.missionId)),
    reconcileLiveInvestigation: publicProcedure.input(z.object({ missionId: z.string().min(4).max(32) })).mutation(async ({ input }) => reconcileLiveInvestigation(input.missionId)),
    runRepairPlan: publicProcedure.input(z.object({ missionId: z.string().min(4).max(32) })).mutation(async ({ input }) => runLiveRepairPlan(input.missionId)),
    status: publicProcedure.input(z.object({ missionId: z.string().min(4).max(32) })).query(async ({ input }) => getMissionBundle(input.missionId)),
    decideApproval: publicProcedure.input(z.object({ requestId: z.string().min(4).max(32), approve: z.boolean() })).mutation(async ({ input }) => resolveApproval(input.requestId, input.approve)),
  }),
});
export type AppRouter = typeof appRouter;
