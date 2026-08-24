CREATE TABLE `approval_requests` (
	`id` varchar(32) NOT NULL,
	`missionId` varchar(32) NOT NULL,
	`actionType` varchar(128) NOT NULL,
	`status` enum('PENDING','APPROVED','REJECTED','EXPIRED') NOT NULL,
	`risk` enum('LOW','MEDIUM','HIGH') NOT NULL,
	`justification` text NOT NULL,
	`decidedAt` bigint,
	`decidedBy` varchar(128),
	`createdAt` bigint NOT NULL,
	`expiresAt` bigint NOT NULL,
	CONSTRAINT `approval_requests_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `evidence` (
	`id` varchar(32) NOT NULL,
	`missionId` varchar(32) NOT NULL,
	`kind` varchar(32) NOT NULL,
	`title` varchar(255) NOT NULL,
	`content` text NOT NULL,
	`source` varchar(255) NOT NULL,
	`createdAt` bigint NOT NULL,
	CONSTRAINT `evidence_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `external_actions` (
	`id` varchar(32) NOT NULL,
	`missionId` varchar(32) NOT NULL,
	`actionType` varchar(128) NOT NULL,
	`status` varchar(32) NOT NULL,
	`target` varchar(255) NOT NULL,
	`idempotencyKey` varchar(128) NOT NULL,
	`result` text NOT NULL,
	`createdAt` bigint NOT NULL,
	`executedAt` bigint,
	CONSTRAINT `external_actions_id` PRIMARY KEY(`id`),
	CONSTRAINT `external_actions_idempotencyKey_unique` UNIQUE(`idempotencyKey`)
);
--> statement-breakpoint
CREATE TABLE `mission_events` (
	`id` varchar(32) NOT NULL,
	`missionId` varchar(32) NOT NULL,
	`sequence` int NOT NULL,
	`eventType` varchar(64) NOT NULL,
	`actor` varchar(128) NOT NULL,
	`tool` varchar(128),
	`result` text NOT NULL,
	`evidenceRefs` text NOT NULL,
	`createdAt` bigint NOT NULL,
	CONSTRAINT `mission_events_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `missions` (
	`id` varchar(32) NOT NULL,
	`title` varchar(255) NOT NULL,
	`repository` varchar(255) NOT NULL,
	`incident` text NOT NULL,
	`status` enum('CREATED','INVESTIGATING','PLANNING_FIX','VERIFYING','WAITING_APPROVAL','EXECUTING','COMPLETED','FAILED','REJECTED') NOT NULL,
	`risk` enum('LOW','MEDIUM','HIGH') NOT NULL,
	`rootCause` text,
	`repairSummary` text,
	`patch` text,
	`createdAt` bigint NOT NULL,
	`updatedAt` bigint NOT NULL,
	CONSTRAINT `missions_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `sandbox_runs` (
	`id` varchar(32) NOT NULL,
	`missionId` varchar(32) NOT NULL,
	`status` enum('PASS','FAIL','UNKNOWN','TIMEOUT') NOT NULL,
	`runner` varchar(128) NOT NULL,
	`command` varchar(255) NOT NULL,
	`stdout` text NOT NULL,
	`stderr` text NOT NULL,
	`exitCode` int NOT NULL,
	`durationMs` int NOT NULL,
	`timedOut` int NOT NULL,
	`createdAt` bigint NOT NULL,
	CONSTRAINT `sandbox_runs_id` PRIMARY KEY(`id`)
);
