ALTER TABLE `user` ADD `blocked_for_commands` integer DEFAULT false;--> statement-breakpoint
ALTER TABLE `user` ADD `blocked_at` integer;--> statement-breakpoint
ALTER TABLE `user` ADD `prohibited_command_count` integer DEFAULT 0;--> statement-breakpoint
ALTER TABLE `containers` ADD `sandbox_username` text;--> statement-breakpoint
ALTER TABLE `containers` ADD `last_activity_at` integer;