-- Référentiels DG + espace de travail assistante (tables manquantes)

CREATE TABLE IF NOT EXISTS `dg_referential_items` (
    `id` VARCHAR(191) NOT NULL,
    `category_id` VARCHAR(32) NOT NULL,
    `name` VARCHAR(200) NOT NULL,
    `value` VARCHAR(64) NULL,
    `meta` JSON NULL,
    `archived` BOOLEAN NOT NULL DEFAULT false,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `dg_referential_items_category_id_archived_idx`(`category_id`, `archived`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `dg_tasks` (
    `id` VARCHAR(191) NOT NULL,
    `title` VARCHAR(200) NOT NULL,
    `description` TEXT NULL,
    `status` ENUM('PENDING', 'IN_PROGRESS', 'SUSPENDED', 'COMPLETED', 'CANCELLED') NOT NULL DEFAULT 'PENDING',
    `priority` ENUM('HIGH', 'MEDIUM', 'LOW') NOT NULL DEFAULT 'MEDIUM',
    `project_name` VARCHAR(200) NULL,
    `project_phase` VARCHAR(120) NULL,
    `assignee_name` VARCHAR(120) NOT NULL,
    `assignee_user_id` VARCHAR(191) NULL,
    `start_at` DATETIME(3) NULL,
    `due_at` DATETIME(3) NULL,
    `estimated_hours` INTEGER NULL,
    `created_by_id` VARCHAR(191) NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `dg_tasks_status_due_at_idx`(`status`, `due_at`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `dg_task_comments` (
    `id` VARCHAR(191) NOT NULL,
    `task_id` VARCHAR(191) NOT NULL,
    `author_id` VARCHAR(191) NOT NULL,
    `author_name` VARCHAR(120) NOT NULL,
    `body` TEXT NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `dg_task_comments_task_id_idx`(`task_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `dg_task_attachments` (
    `id` VARCHAR(191) NOT NULL,
    `task_id` VARCHAR(191) NOT NULL,
    `file_name` VARCHAR(255) NOT NULL,
    `file_size` INTEGER NOT NULL,
    `mime_type` VARCHAR(120) NOT NULL,
    `storage_key` VARCHAR(500) NOT NULL,
    `uploaded_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `dg_task_attachments_task_id_idx`(`task_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `dg_task_history` (
    `id` VARCHAR(191) NOT NULL,
    `task_id` VARCHAR(191) NOT NULL,
    `user_id` VARCHAR(191) NOT NULL,
    `user_name` VARCHAR(120) NOT NULL,
    `action` VARCHAR(80) NOT NULL,
    `detail` VARCHAR(500) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `dg_task_history_task_id_created_at_idx`(`task_id`, `created_at`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `dg_decisions` (
    `id` VARCHAR(191) NOT NULL,
    `title` VARCHAR(200) NOT NULL,
    `context` TEXT NULL,
    `decision_text` TEXT NOT NULL,
    `status` ENUM('NOT_STARTED', 'IN_PROGRESS', 'COMPLETED', 'OVERDUE', 'CLOSED') NOT NULL DEFAULT 'NOT_STARTED',
    `priority` ENUM('HIGH', 'MEDIUM', 'LOW') NOT NULL DEFAULT 'MEDIUM',
    `owner_name` VARCHAR(120) NOT NULL,
    `owner_user_id` VARCHAR(191) NULL,
    `appointment_id` VARCHAR(191) NULL,
    `due_at` DATETIME(3) NULL,
    `meeting_date` DATETIME(3) NULL,
    `created_by_id` VARCHAR(191) NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `dg_decisions_status_due_at_idx`(`status`, `due_at`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `dg_mail_records` (
    `id` VARCHAR(191) NOT NULL,
    `direction` ENUM('INCOMING', 'OUTGOING') NOT NULL,
    `reference` VARCHAR(80) NOT NULL,
    `counterpart` VARCHAR(200) NOT NULL,
    `subject` VARCHAR(300) NOT NULL,
    `mail_date` DATETIME(3) NOT NULL,
    `workflow_status` ENUM('RECEIVED', 'ASSIGNED', 'IN_PROGRESS', 'PROCESSED', 'ARCHIVED', 'SENT') NOT NULL DEFAULT 'RECEIVED',
    `assigned_service` VARCHAR(120) NULL,
    `attachment_count` INTEGER NOT NULL DEFAULT 0,
    `notes` TEXT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `dg_mail_records_direction_workflow_status_idx`(`direction`, `workflow_status`),
    INDEX `dg_mail_records_reference_idx`(`reference`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `dg_strategic_contacts` (
    `id` VARCHAR(191) NOT NULL,
    `category` ENUM('MINISTRY', 'INSTITUTION', 'PARTNER', 'SUPPLIER', 'EMBASSY', 'INTERNATIONAL_ORG', 'OTHER') NOT NULL,
    `full_name` VARCHAR(120) NOT NULL,
    `job_title` VARCHAR(120) NULL,
    `organization` VARCHAR(200) NOT NULL,
    `phone` VARCHAR(40) NULL,
    `email` VARCHAR(191) NULL,
    `notes` TEXT NULL,
    `interaction_count` INTEGER NOT NULL DEFAULT 0,
    `appointment_count` INTEGER NOT NULL DEFAULT 0,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `dg_strategic_contacts_category_full_name_idx`(`category`, `full_name`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `dg_audience_records` (
    `id` VARCHAR(191) NOT NULL,
    `held_at` DATETIME(3) NOT NULL,
    `end_at` DATETIME(3) NULL,
    `participants` VARCHAR(500) NOT NULL,
    `subject` VARCHAR(300) NOT NULL,
    `outcome` TEXT NULL,
    `minutes` TEXT NULL,
    `appointment_id` VARCHAR(191) NULL,
    `archived` BOOLEAN NOT NULL DEFAULT false,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `dg_audience_records_held_at_idx`(`held_at`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `dg_official_invitations` (
    `id` VARCHAR(191) NOT NULL,
    `organizer` VARCHAR(200) NOT NULL,
    `event_title` VARCHAR(300) NOT NULL,
    `event_date` DATETIME(3) NOT NULL,
    `location` VARCHAR(300) NULL,
    `importance` ENUM('HIGH', 'MEDIUM', 'LOW') NOT NULL DEFAULT 'MEDIUM',
    `status` ENUM('RECEIVED', 'ACCEPTED', 'REFUSED', 'DELEGATED', 'PENDING') NOT NULL DEFAULT 'RECEIVED',
    `delegate_name` VARCHAR(120) NULL,
    `notes` TEXT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `dg_official_invitations_event_date_status_idx`(`event_date`, `status`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `dg_missions` (
    `id` VARCHAR(191) NOT NULL,
    `subject` VARCHAR(300) NOT NULL,
    `destination` VARCHAR(200) NOT NULL,
    `depart_at` DATETIME(3) NOT NULL,
    `return_at` DATETIME(3) NOT NULL,
    `status` ENUM('PLANNED', 'ONGOING', 'COMPLETED', 'CANCELLED') NOT NULL DEFAULT 'PLANNED',
    `participants` VARCHAR(500) NOT NULL,
    `document_count` INTEGER NOT NULL DEFAULT 0,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `dg_missions_depart_at_status_idx`(`depart_at`, `status`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `dg_important_deadlines` (
    `id` VARCHAR(191) NOT NULL,
    `title` VARCHAR(200) NOT NULL,
    `kind` ENUM('CONTRACT', 'RENEWAL', 'REPORT', 'AUDIT', 'PERIODIC_MEETING', 'OTHER') NOT NULL,
    `status` ENUM('UPCOMING', 'DUE_SOON', 'OVERDUE', 'COMPLETED') NOT NULL DEFAULT 'UPCOMING',
    `due_at` DATETIME(3) NOT NULL,
    `owner_name` VARCHAR(120) NOT NULL,
    `description` TEXT NULL,
    `alert_days_before` INTEGER NOT NULL DEFAULT 7,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `dg_important_deadlines_due_at_status_idx`(`due_at`, `status`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `dg_vault_documents` (
    `id` VARCHAR(191) NOT NULL,
    `title` VARCHAR(200) NOT NULL,
    `category` ENUM('CONTRACT', 'MAIL', 'DECISION', 'REPORT', 'MINUTES', 'OTHER') NOT NULL,
    `version` INTEGER NOT NULL DEFAULT 1,
    `file_name` VARCHAR(255) NOT NULL,
    `file_size` INTEGER NOT NULL,
    `storage_key` VARCHAR(500) NOT NULL,
    `tags` JSON NOT NULL,
    `restricted` BOOLEAN NOT NULL DEFAULT false,
    `uploaded_by_id` VARCHAR(191) NOT NULL,
    `uploaded_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `dg_vault_documents_category_uploaded_at_idx`(`category`, `uploaded_at`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `dg_tasks`
  ADD CONSTRAINT `dg_tasks_created_by_id_fkey`
  FOREIGN KEY (`created_by_id`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE `dg_task_comments`
  ADD CONSTRAINT `dg_task_comments_task_id_fkey`
  FOREIGN KEY (`task_id`) REFERENCES `dg_tasks`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE `dg_task_attachments`
  ADD CONSTRAINT `dg_task_attachments_task_id_fkey`
  FOREIGN KEY (`task_id`) REFERENCES `dg_tasks`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE `dg_task_history`
  ADD CONSTRAINT `dg_task_history_task_id_fkey`
  FOREIGN KEY (`task_id`) REFERENCES `dg_tasks`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE `dg_decisions`
  ADD CONSTRAINT `dg_decisions_created_by_id_fkey`
  FOREIGN KEY (`created_by_id`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE `dg_vault_documents`
  ADD CONSTRAINT `dg_vault_documents_uploaded_by_id_fkey`
  FOREIGN KEY (`uploaded_by_id`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
