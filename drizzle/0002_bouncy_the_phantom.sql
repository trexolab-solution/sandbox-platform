ALTER TABLE `containers` ADD `creation_progress` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `containers` ADD `creation_step` text;--> statement-breakpoint
ALTER TABLE `containers` ADD `creation_error` text;