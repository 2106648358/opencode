CREATE TABLE `ai_commit_report` (
  `commit_hash` text PRIMARY KEY NOT NULL,
  `branch` text NOT NULL,
  `total_additions` integer NOT NULL,
  `ai_additions` integer NOT NULL,
  `ai_rate` real NOT NULL,
  `file_breakdown` text NOT NULL,
  `session_ids` text NOT NULL,
  `model_breakdown` text NOT NULL,
  `created_at` integer NOT NULL
);
CREATE INDEX `ai_commit_report_branch_idx` ON `ai_commit_report` (`branch`);
CREATE INDEX `ai_commit_report_created_at_idx` ON `ai_commit_report` (`created_at`);
