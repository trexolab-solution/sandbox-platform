CREATE TABLE `account` (
	`id` text PRIMARY KEY NOT NULL,
	`account_id` text NOT NULL,
	`provider_id` text NOT NULL,
	`user_id` text NOT NULL,
	`access_token` text,
	`refresh_token` text,
	`id_token` text,
	`access_token_expires_at` integer,
	`refresh_token_expires_at` integer,
	`scope` text,
	`password` text,
	`created_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `account_userId_idx` ON `account` (`user_id`);--> statement-breakpoint
CREATE TABLE `session` (
	`id` text PRIMARY KEY NOT NULL,
	`expires_at` integer NOT NULL,
	`token` text NOT NULL,
	`created_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	`updated_at` integer NOT NULL,
	`ip_address` text,
	`user_agent` text,
	`user_id` text NOT NULL,
	`impersonated_by` text,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `session_token_unique` ON `session` (`token`);--> statement-breakpoint
CREATE INDEX `session_userId_idx` ON `session` (`user_id`);--> statement-breakpoint
CREATE TABLE `user` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`email` text NOT NULL,
	`email_verified` integer DEFAULT false NOT NULL,
	`image` text,
	`created_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	`updated_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	`role` text,
	`banned` integer DEFAULT false,
	`ban_reason` text,
	`ban_expires` integer
);
--> statement-breakpoint
CREATE UNIQUE INDEX `user_email_unique` ON `user` (`email`);--> statement-breakpoint
CREATE TABLE `verification` (
	`id` text PRIMARY KEY NOT NULL,
	`identifier` text NOT NULL,
	`value` text NOT NULL,
	`expires_at` integer NOT NULL,
	`created_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	`updated_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL
);
--> statement-breakpoint
CREATE INDEX `verification_identifier_idx` ON `verification` (`identifier`);--> statement-breakpoint
CREATE TABLE `audit_logs` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text,
	`action` text NOT NULL,
	`resource_type` text NOT NULL,
	`resource_id` text,
	`details` text,
	`ip_address` text,
	`created_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `audit_logs_userId_idx` ON `audit_logs` (`user_id`);--> statement-breakpoint
CREATE INDEX `audit_logs_action_idx` ON `audit_logs` (`action`);--> statement-breakpoint
CREATE INDEX `audit_logs_createdAt_idx` ON `audit_logs` (`created_at`);--> statement-breakpoint
CREATE TABLE `containers` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`container_id` text NOT NULL,
	`container_name` text NOT NULL,
	`display_name` text NOT NULL,
	`image` text NOT NULL,
	`runtimes` text DEFAULT '[]',
	`runtime_versions` text DEFAULT '{}',
	`status` text DEFAULT 'creating' NOT NULL,
	`cpu_limit` integer DEFAULT 1 NOT NULL,
	`memory_limit_mb` integer DEFAULT 512 NOT NULL,
	`disk_limit_mb` integer DEFAULT 1024 NOT NULL,
	`network_id` text,
	`internal_ip` text,
	`created_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	`updated_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	`last_started_at` integer,
	`last_stopped_at` integer,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `containers_container_id_unique` ON `containers` (`container_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `containers_container_name_unique` ON `containers` (`container_name`);--> statement-breakpoint
CREATE INDEX `containers_userId_idx` ON `containers` (`user_id`);--> statement-breakpoint
CREATE INDEX `containers_status_idx` ON `containers` (`status`);--> statement-breakpoint
CREATE TABLE `port_mappings` (
	`id` text PRIMARY KEY NOT NULL,
	`container_id` text NOT NULL,
	`service_name` text NOT NULL,
	`internal_port` integer NOT NULL,
	`protocol` text DEFAULT 'tcp' NOT NULL,
	`password_protected` integer DEFAULT false NOT NULL,
	`access_password` text,
	`created_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	FOREIGN KEY (`container_id`) REFERENCES `containers`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `port_mappings_containerId_idx` ON `port_mappings` (`container_id`);--> statement-breakpoint
CREATE TABLE `user_volumes` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`volume_name` text NOT NULL,
	`mount_path` text NOT NULL,
	`size_mb` integer DEFAULT 100 NOT NULL,
	`created_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `user_volumes_volume_name_unique` ON `user_volumes` (`volume_name`);--> statement-breakpoint
CREATE INDEX `user_volumes_userId_idx` ON `user_volumes` (`user_id`);