CREATE UNIQUE INDEX `port_mappings_service_name_unique` ON `port_mappings` (`service_name`);--> statement-breakpoint
CREATE INDEX `port_mappings_serviceName_idx` ON `port_mappings` (`service_name`);