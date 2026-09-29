CREATE TABLE `app_settings` (
	`key` text PRIMARY KEY NOT NULL,
	`value` text,
	`updated_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL
);
--> statement-breakpoint
CREATE TABLE `bug_reports` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text,
	`title` text NOT NULL,
	`description` text NOT NULL,
	`category` text DEFAULT 'other' NOT NULL,
	`priority` text DEFAULT 'medium' NOT NULL,
	`status` text DEFAULT 'open' NOT NULL,
	`page_url` text,
	`user_agent` text,
	`screenshot` text,
	`admin_notes` text,
	`resolved_at` integer,
	`resolved_by` text,
	`created_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	`updated_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`resolved_by`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `bug_reports_userId_idx` ON `bug_reports` (`user_id`);--> statement-breakpoint
CREATE INDEX `bug_reports_status_idx` ON `bug_reports` (`status`);--> statement-breakpoint
CREATE INDEX `bug_reports_priority_idx` ON `bug_reports` (`priority`);--> statement-breakpoint
CREATE INDEX `bug_reports_createdAt_idx` ON `bug_reports` (`created_at`);