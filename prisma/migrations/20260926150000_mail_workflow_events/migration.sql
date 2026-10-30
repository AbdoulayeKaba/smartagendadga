-- Traçabilité des changements de statut courrier
CREATE TABLE `dg_mail_workflow_events` (
  `id` VARCHAR(191) NOT NULL,
  `mail_id` VARCHAR(191) NOT NULL,
  `status` ENUM('RECEIVED', 'ASSIGNED', 'IN_PROGRESS', 'PROCESSED', 'ARCHIVED', 'SENT') NOT NULL,
  `from_status` ENUM('RECEIVED', 'ASSIGNED', 'IN_PROGRESS', 'PROCESSED', 'ARCHIVED', 'SENT') NULL,
  `user_id` VARCHAR(191) NULL,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

  INDEX `dg_mail_workflow_events_mail_id_created_at_idx` (`mail_id`, `created_at`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `dg_mail_workflow_events`
  ADD CONSTRAINT `dg_mail_workflow_events_mail_id_fkey`
  FOREIGN KEY (`mail_id`) REFERENCES `dg_mail_records`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE `dg_mail_workflow_events`
  ADD CONSTRAINT `dg_mail_workflow_events_user_id_fkey`
  FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

INSERT INTO `dg_mail_workflow_events` (`id`, `mail_id`, `status`, `from_status`, `user_id`, `created_at`)
SELECT
  CONCAT('mwf_init_', `id`),
  `id`,
  CASE WHEN `direction` = 'OUTGOING' THEN 'SENT' ELSE 'RECEIVED' END,
  NULL,
  NULL,
  `created_at`
FROM `dg_mail_records`;
