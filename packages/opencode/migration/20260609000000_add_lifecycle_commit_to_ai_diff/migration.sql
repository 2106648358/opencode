ALTER TABLE `ai_diff` ADD `lifecycle` text NOT NULL DEFAULT 'pending';
--> statement-breakpoint
ALTER TABLE `ai_diff` ADD `commit_hash` text;
--> statement-breakpoint
ALTER TABLE `ai_diff` ADD `committed_at` integer;
--> statement-breakpoint
CREATE INDEX `ai_diff_lifecycle_idx` ON `ai_diff` (`lifecycle`);
--> statement-breakpoint
CREATE INDEX `ai_diff_commit_hash_idx` ON `ai_diff` (`commit_hash`);
