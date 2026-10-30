-- Mission status workflow: closure, cancel, observations, history
ALTER TABLE `dg_missions`
  ADD COLUMN `observations` TEXT NULL,
  ADD COLUMN `cancel_reason` VARCHAR(120) NULL,
  ADD COLUMN `cancel_reason_detail` TEXT NULL,
  ADD COLUMN `closure_report` TEXT NULL,
  ADD COLUMN `closure_results` TEXT NULL,
  ADD COLUMN `closure_recommendations` TEXT NULL,
  ADD COLUMN `closure_comments` TEXT NULL,
  ADD COLUMN `completed_at` DATETIME(3) NULL,
  ADD COLUMN `status_changed_at` DATETIME(3) NULL;

CREATE TABLE `dg_mission_history` (
  `id` VARCHAR(191) NOT NULL,
  `mission_id` VARCHAR(191) NOT NULL,
  `user_id` VARCHAR(191) NOT NULL,
  `user_name` VARCHAR(120) NOT NULL,
  `action` VARCHAR(80) NOT NULL,
  `field_name` VARCHAR(80) NULL,
  `old_value` TEXT NULL,
  `new_value` TEXT NULL,
  `detail` TEXT NULL,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  INDEX `dg_mission_history_mission_id_created_at_idx`(`mission_id`, `created_at`),
  CONSTRAINT `dg_mission_history_mission_id_fkey` FOREIGN KEY (`mission_id`) REFERENCES `dg_missions`(`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `dg_mission_history_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `dg_notifications` MODIFY `kind` ENUM(
  'REQUEST_CREATED',
  'APPROVED',
  'REJECTED',
  'RESCHEDULED',
  'REMINDER_24H',
  'REMINDER_1H',
  'MISSION_CANCELLED',
  'MISSION_COMPLETED'
) NOT NULL;
