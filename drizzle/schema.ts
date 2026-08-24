import { bigint, int, mysqlEnum, mysqlTable, text, varchar } from "drizzle-orm/mysql-core";

export const missionStatusEnum = ["CREATED", "INVESTIGATING", "PLANNING_FIX", "VERIFYING", "WAITING_APPROVAL", "EXECUTING", "COMPLETED", "FAILED", "REJECTED"] as const;
export const riskEnum = ["LOW", "MEDIUM", "HIGH"] as const;

export const missions = mysqlTable("missions", {
  id: varchar("id", { length: 32 }).primaryKey(),
  title: varchar("title", { length: 255 }).notNull(),
  repository: varchar("repository", { length: 255 }).notNull(),
  incident: text("incident").notNull(),
  status: mysqlEnum("status", missionStatusEnum).notNull(),
  risk: mysqlEnum("risk", riskEnum).notNull(),
  rootCause: text("rootCause"),
  repairSummary: text("repairSummary"),
  patch: text("patch"),
  createdAt: bigint("createdAt", { mode: "number" }).notNull(),
  updatedAt: bigint("updatedAt", { mode: "number" }).notNull(),
});

export const missionEvents = mysqlTable("mission_events", {
  id: varchar("id", { length: 32 }).primaryKey(),
  missionId: varchar("missionId", { length: 32 }).notNull(),
  sequence: int("sequence").notNull(),
  eventType: varchar("eventType", { length: 64 }).notNull(),
  actor: varchar("actor", { length: 128 }).notNull(),
  tool: varchar("tool", { length: 128 }),
  correlationId: varchar("correlationId", { length: 128 }),
  result: text("result").notNull(),
  payload: text("payload"),
  evidenceRefs: text("evidenceRefs").notNull(),
  createdAt: bigint("createdAt", { mode: "number" }).notNull(),
});

export const evidence = mysqlTable("evidence", {
  id: varchar("id", { length: 32 }).primaryKey(),
  missionId: varchar("missionId", { length: 32 }).notNull(),
  kind: varchar("kind", { length: 32 }).notNull(),
  title: varchar("title", { length: 255 }).notNull(),
  content: text("content").notNull(),
  source: varchar("source", { length: 255 }).notNull(),
  createdAt: bigint("createdAt", { mode: "number" }).notNull(),
});

export const sandboxRuns = mysqlTable("sandbox_runs", {
  id: varchar("id", { length: 32 }).primaryKey(),
  missionId: varchar("missionId", { length: 32 }).notNull(),
  status: mysqlEnum("status", ["PASS", "FAIL", "UNKNOWN", "TIMEOUT"]).notNull(),
  runner: varchar("runner", { length: 128 }).notNull(),
  command: varchar("command", { length: 255 }).notNull(),
  stdout: text("stdout").notNull(),
  stderr: text("stderr").notNull(),
  exitCode: int("exitCode").notNull(),
  durationMs: int("durationMs").notNull(),
  timedOut: int("timedOut").notNull(),
  createdAt: bigint("createdAt", { mode: "number" }).notNull(),
});

export const approvalRequests = mysqlTable("approval_requests", {
  id: varchar("id", { length: 32 }).primaryKey(),
  missionId: varchar("missionId", { length: 32 }).notNull(),
  actionType: varchar("actionType", { length: 128 }).notNull(),
  status: mysqlEnum("status", ["PENDING", "APPROVED", "REJECTED", "EXPIRED"]).notNull(),
  risk: mysqlEnum("risk", riskEnum).notNull(),
  justification: text("justification").notNull(),
  decidedAt: bigint("decidedAt", { mode: "number" }),
  decidedBy: varchar("decidedBy", { length: 128 }),
  createdAt: bigint("createdAt", { mode: "number" }).notNull(),
  expiresAt: bigint("expiresAt", { mode: "number" }).notNull(),
});

export const externalActions = mysqlTable("external_actions", {
  id: varchar("id", { length: 32 }).primaryKey(),
  missionId: varchar("missionId", { length: 32 }).notNull(),
  actionType: varchar("actionType", { length: 128 }).notNull(),
  status: varchar("status", { length: 32 }).notNull(),
  target: varchar("target", { length: 255 }).notNull(),
  idempotencyKey: varchar("idempotencyKey", { length: 128 }).notNull().unique(),
  result: text("result").notNull(),
  createdAt: bigint("createdAt", { mode: "number" }).notNull(),
  executedAt: bigint("executedAt", { mode: "number" }),
});

export const trueforgeSessions = mysqlTable("trueforge_sessions", {
  id: varchar("id", { length: 32 }).primaryKey(),
  missionId: varchar("missionId", { length: 32 }).notNull(),
  sessionId: varchar("sessionId", { length: 128 }).notNull().unique(),
  baseUrl: varchar("baseUrl", { length: 512 }).notNull(),
  model: varchar("model", { length: 255 }).notNull(),
  status: varchar("status", { length: 32 }).notNull(),
  createdAt: bigint("createdAt", { mode: "number" }).notNull(),
  updatedAt: bigint("updatedAt", { mode: "number" }).notNull(),
});

export const trueforgeTurns = mysqlTable("trueforge_turns", {
  id: varchar("id", { length: 32 }).primaryKey(),
  missionId: varchar("missionId", { length: 32 }).notNull(),
  trueforgeSessionId: varchar("trueforgeSessionId", { length: 128 }).notNull(),
  turnId: varchar("turnId", { length: 128 }).notNull().unique(),
  status: varchar("status", { length: 32 }).notNull(),
  threadId: varchar("threadId", { length: 128 }),
  requiredActionId: varchar("requiredActionId", { length: 128 }),
  toolCallId: varchar("toolCallId", { length: 128 }),
  streamCursor: int("streamCursor").notNull().default(0),
  createdAt: bigint("createdAt", { mode: "number" }).notNull(),
  updatedAt: bigint("updatedAt", { mode: "number" }).notNull(),
});

export type Mission = typeof missions.$inferSelect;
export type ApprovalRequest = typeof approvalRequests.$inferSelect;
