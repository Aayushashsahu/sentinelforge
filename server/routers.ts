import { z } from "zod";
import { publicProcedure, protectedProcedure, router } from "./_core/trpc";
import { getMissionBundle, listMissionBundles } from "./sentinelforge/repository";
import { launchDeterministicFixtureMission, resolveApproval } from "./sentinelforge/workflow";
import { probeConfiguredTrueForge } from "./sentinelforge/trueforge/client";
import { createLiveMission, investigateLiveMission, reconcileLiveInvestigation, runLiveApprovalProbe, runLiveRepairPlan, runLiveSandboxProbe } from "./sentinelforge/liveWorkflow";
import { getLiveExecutionContractStatus } from "./sentinelforge/liveContracts";
import { verifyIncidentFixtureDeterministically } from "./sentinelforge/verifier";
import { getSentinelForgeToolsStatus } from "./sentinelforge/tools/mcpServer";
import { deterministicScenarioIds } from "./sentinelforge/scenarios";

export const appRouter = router({
  health: publicProcedure.query(() => ({ ok: true, service: "sentinelforge" })),
  trueforge: router({
    status: publicProcedure.query(async () => probeConfiguredTrueForge()),
    executionContracts: publicProcedure.query(() => getLiveExecutionContractStatus()),
    verifyIncidentFixture: publicProcedure.input(z.object({ packageVersion: z.string().min(1), manifestVersion: z.string().min(1), proposedManifestVersion: z.string().min(1) })).query(({ input }) => verifyIncidentFixtureDeterministically(input)),
    sandboxProbe: protectedProcedure.input(z.object({ missionId: z.string().min(4).max(32) })).mutation(async ({ input }) => runLiveSandboxProbe(input.missionId)),
    approvalProbe: protectedProcedure.mutation(async () => runLiveApprovalProbe()),
  }),
  tools: router({
    status: publicProcedure.query(() => getSentinelForgeToolsStatus()),
  }),
  missions: router({
    list: publicProcedure.query(async () => (await listMissionBundles()).filter(Boolean)),
    get: publicProcedure.input(z.object({ id: z.string().min(4).max(32) })).query(async ({ input }) => getMissionBundle(input.id)),
    launchFixture: publicProcedure.input(z.object({ scenarioId: z.enum(deterministicScenarioIds) }).optional()).mutation(async ({ input }) => launchDeterministicFixtureMission(input?.scenarioId)),
    createLive: protectedProcedure.input(z.object({ title: z.string().min(4).max(255), repository: z.string().min(3).max(255), incident: z.string().min(8).max(8_000), risk: z.enum(["LOW", "MEDIUM", "HIGH"]) })).mutation(async ({ input }) => createLiveMission(input)),
    investigate: protectedProcedure.input(z.object({ missionId: z.string().min(4).max(32) })).mutation(async ({ input }) => investigateLiveMission(input.missionId)),
    reconcileLiveInvestigation: protectedProcedure.input(z.object({ missionId: z.string().min(4).max(32) })).mutation(async ({ input }) => reconcileLiveInvestigation(input.missionId)),
    runRepairPlan: protectedProcedure.input(z.object({ missionId: z.string().min(4).max(32) })).mutation(async ({ input }) => runLiveRepairPlan(input.missionId)),
    status: publicProcedure.input(z.object({ missionId: z.string().min(4).max(32) })).query(async ({ input }) => getMissionBundle(input.missionId)),
    decideApproval: protectedProcedure.input(z.object({ requestId: z.string().min(4).max(32), approve: z.boolean() })).mutation(async ({ input }) => resolveApproval(input.requestId, input.approve)),
  }),
});
export type AppRouter = typeof appRouter;
