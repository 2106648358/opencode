CREATE TABLE IF NOT EXISTS `ai_diff` (
	`id` text PRIMARY KEY,
	`session_id` text NOT NULL,
	`message_id` text NOT NULL,
	`part_id` text NOT NULL,
	`agent` text NOT NULL,
	`tool` text NOT NULL,
	`filepath` text NOT NULL,
	`diff` text NOT NULL,
	`additions` integer NOT NULL,
	`deletions` integer NOT NULL,
	`status` text,
	`timestamp` integer NOT NULL,
	`time_created` integer NOT NULL,
	`time_updated` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `ai_diff_session_idx` ON `ai_diff` (`session_id`);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `ai_diff_filepath_idx` ON `ai_diff` (`filepath`);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `ai_diff_tool_idx` ON `ai_diff` (`tool`);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `ai_diff_timestamp_idx` ON `ai_diff` (`timestamp`);
