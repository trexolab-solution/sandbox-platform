CREATE TABLE `sandbox_schedule_requests` (
	`id` text PRIMARY KEY NOT NULL,
	`container_id` text NOT NULL,
	`user_id` text NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`request_reason` text NOT NULL,
	`schedule_type` text DEFAULT 'daily' NOT NULL,
	`start_time` text NOT NULL,
	`end_time` text NOT NULL,
	`days_of_week` text,
	`effective_from` integer NOT NULL,
	`effective_to` integer,
	`timezone` text DEFAULT 'UTC' NOT NULL,
	`reviewed_by` text,
	`reviewed_at` integer,
	`admin_notes` text,
	`denial_reason` text,
	`created_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	`updated_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	FOREIGN KEY (`container_id`) REFERENCES `containers`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`reviewed_by`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `schedule_requests_containerId_idx` ON `sandbox_schedule_requests` (`container_id`);--> statement-breakpoint
CREATE INDEX `schedule_requests_userId_idx` ON `sandbox_schedule_requests` (`user_id`);--> statement-breakpoint
CREATE INDEX `schedule_requests_status_idx` ON `sandbox_schedule_requests` (`status`);