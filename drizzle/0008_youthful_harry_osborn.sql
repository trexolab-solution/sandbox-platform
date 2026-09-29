CREATE TABLE `dangerous_command_patterns` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`pattern` text NOT NULL,
	`category` text DEFAULT 'custom' NOT NULL,
	`risk_level` text DEFAULT 'medium' NOT NULL,
	`enabled` integer DEFAULT true NOT NULL,
	`description` text,
	`examples` text,
	`is_built_in` integer DEFAULT false NOT NULL,
	`created_by` text,
	`created_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	`updated_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	FOREIGN KEY (`created_by`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `dcp_category_idx` ON `dangerous_command_patterns` (`category`);--> statement-breakpoint
CREATE INDEX `dcp_enabled_idx` ON `dangerous_command_patterns` (`enabled`);--> statement-breakpoint
CREATE INDEX `dcp_riskLevel_idx` ON `dangerous_command_patterns` (`risk_level`);