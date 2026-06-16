ALTER TABLE `ai_diff` ADD `lifecycle` text NOT NULL DEFAULT 'pending';
ALTER TABLE `ai_diff` ADD `commit_hash` text;
ALTER TABLE `ai_diff` ADD `committed_at` integer;
CREATE INDEX `ai_diff_lifecycle_idx` ON `ai_diff` (`lifecycle`);
CREATE INDEX `ai_diff_commit_hash_idx` ON `ai_diff` (`commit_hash`);
