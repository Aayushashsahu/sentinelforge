CREATE TABLE `trueforge_sessions` (
	`id` varchar(32) NOT NULL,
	`missionId` varchar(32) NOT NULL,
	`sessionId` varchar(128) NOT NULL,
	`baseUrl` varchar(512) NOT NULL,
	`model` varchar(255) NOT NULL,
	`status` varchar(32) NOT NULL,
	`createdAt` bigint NOT NULL,
	`updatedAt` bigint NOT NULL,
	CONSTRAINT `trueforge_sessions_id` PRIMARY KEY(`id`),
	CONSTRAINT `trueforge_sessions_missionId_unique` UNIQUE(`missionId`),
	CONSTRAINT `trueforge_sessions_sessionId_unique` UNIQUE(`sessionId`)
);
--> statement-breakpoint
CREATE TABLE `trueforge_turns` (
	`id` varchar(32) NOT NULL,
	`missionId` varchar(32) NOT NULL,
	`trueforgeSessionId` varchar(128) NOT NULL,
	`turnId` varchar(128) NOT NULL,
	`status` varchar(32) NOT NULL,
	`threadId` varchar(128),
	`requiredActionId` varchar(128),
	`toolCallId` varchar(128),
	`streamCursor` int NOT NULL DEFAULT 0,
	`createdAt` bigint NOT NULL,
	`updatedAt` bigint NOT NULL,
	CONSTRAINT `trueforge_turns_id` PRIMARY KEY(`id`),
	CONSTRAINT `trueforge_turns_turnId_unique` UNIQUE(`turnId`)
);
--> statement-breakpoint
ALTER TABLE `mission_events` ADD `correlationId` varchar(128);--> statement-breakpoint
ALTER TABLE `mission_events` ADD `payload` text;
