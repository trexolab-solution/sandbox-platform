CREATE TABLE `command_logs` (
	`id` text PRIMARY KEY NOT NULL,
	`container_id` text NOT NULL,
	`user_id` text NOT NULL,
	`session_id` text,
	`command` text NOT NULL,
	`blocked` integer DEFAULT false NOT NULL,
	`block_reason` text,
	`risk_level` text,
	`category` text,
	`executed_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	FOREIGN KEY (`container_id`) REFERENCES `containers`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `cl_containerId_idx` ON `command_logs` (`container_id`);--> statement-breakpoint
CREATE INDEX `cl_userId_idx` ON `command_logs` (`user_id`);--> statement-breakpoint
CREATE INDEX `cl_blocked_idx` ON `command_logs` (`blocked`);--> statement-breakpoint
CREATE INDEX `cl_riskLevel_idx` ON `command_logs` (`risk_level`);--> statement-breakpoint
CREATE INDEX `cl_executedAt_idx` ON `command_logs` (`executed_at`);--> statement-breakpoint
CREATE TABLE `internet_access_requests` (
	`id` text PRIMARY KEY NOT NULL,
	`container_id` text NOT NULL,
	`user_id` text NOT NULL,
	`reason` text NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`requested_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	`reviewed_at` integer,
	`reviewed_by` text,
	`expires_at` integer,
	`duration_minutes` integer DEFAULT 60,
	`admin_notes` text,
	FOREIGN KEY (`container_id`) REFERENCES `containers`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`reviewed_by`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `iar_containerId_idx` ON `internet_access_requests` (`container_id`);--> statement-breakpoint
CREATE INDEX `iar_userId_idx` ON `internet_access_requests` (`user_id`);--> statement-breakpoint
CREATE INDEX `iar_status_idx` ON `internet_access_requests` (`status`);--> statement-breakpoint
CREATE INDEX `iar_requestedAt_idx` ON `internet_access_requests` (`requested_at`);--> statement-breakpoint
CREATE TABLE `network_events` (
	`id` text PRIMARY KEY NOT NULL,
	`container_id` text,
	`event_type` text NOT NULL,
	`from_network` text,
	`to_network` text,
	`triggered_by` text NOT NULL,
	`admin_id` text,
	`details` text,
	`created_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	FOREIGN KEY (`container_id`) REFERENCES `containers`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`admin_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `ne_containerId_idx` ON `network_events` (`container_id`);--> statement-breakpoint
CREATE INDEX `ne_eventType_idx` ON `network_events` (`event_type`);--> statement-breakpoint
CREATE INDEX `ne_triggeredBy_idx` ON `network_events` (`triggered_by`);--> statement-breakpoint
CREATE INDEX `ne_createdAt_idx` ON `network_events` (`created_at`);--> statement-breakpoint
CREATE TABLE `security_alerts` (
	`id` text PRIMARY KEY NOT NULL,
	`container_id` text,
	`user_id` text,
	`alert_type` text NOT NULL,
	`severity` text DEFAULT 'warning' NOT NULL,
	`title` text NOT NULL,
	`description` text NOT NULL,
	`details` text,
	`acknowledged` integer DEFAULT false NOT NULL,
	`acknowledged_by` text,
	`acknowledged_at` integer,
	`created_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	FOREIGN KEY (`container_id`) REFERENCES `containers`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`acknowledged_by`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `sa_containerId_idx` ON `security_alerts` (`container_id`);--> statement-breakpoint
CREATE INDEX `sa_userId_idx` ON `security_alerts` (`user_id`);--> statement-breakpoint
CREATE INDEX `sa_alertType_idx` ON `security_alerts` (`alert_type`);--> statement-breakpoint
CREATE INDEX `sa_severity_idx` ON `security_alerts` (`severity`);--> statement-breakpoint
CREATE INDEX `sa_acknowledged_idx` ON `security_alerts` (`acknowledged`);--> statement-breakpoint
CREATE INDEX `sa_createdAt_idx` ON `security_alerts` (`created_at`);--> statement-breakpoint
ALTER TABLE `containers` ADD `internet_access` integer DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `containers` ADD `internet_expires_at` integer;--> statement-breakpoint
ALTER TABLE `containers` ADD `current_network` text DEFAULT 'sandbox-isolated';--> statement-breakpoint
ALTER TABLE `containers` ADD `installation_mode` integer DEFAULT false NOT NULL;