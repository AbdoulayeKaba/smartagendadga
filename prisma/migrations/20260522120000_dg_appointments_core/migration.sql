-- Plateforme DG rendez-vous (schéma dédié)

CREATE TABLE `users` (
  `id` VARCHAR(191) NOT NULL,
  `email` VARCHAR(191) NOT NULL,
  `password_hash` VARCHAR(191) NOT NULL,
  `first_name` VARCHAR(191) NOT NULL,
  `last_name` VARCHAR(191) NOT NULL,
  `role` ENUM('DG', 'ASSISTANT', 'MANAGER', 'EXTERNAL') NOT NULL DEFAULT 'MANAGER',
  `department` VARCHAR(120) NULL,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at` DATETIME(3) NOT NULL,
  UNIQUE INDEX `users_email_key`(`email`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `appointments` (
  `id` VARCHAR(191) NOT NULL,
  `title` VARCHAR(191) NOT NULL,
  `description` TEXT NULL,
  `start_at` DATETIME(3) NOT NULL,
  `end_at` DATETIME(3) NOT NULL,
  `status` ENUM('PENDING', 'APPROVED', 'REJECTED') NOT NULL DEFAULT 'PENDING',
  `priority` ENUM('HIGH', 'MEDIUM', 'LOW') NOT NULL DEFAULT 'MEDIUM',
  `type` ENUM('INTERNAL', 'EXTERNAL', 'MINISTRY') NOT NULL DEFAULT 'INTERNAL',
  `requested_by_id` VARCHAR(191) NOT NULL,
  `reviewed_by_id` VARCHAR(191) NULL,
  `reviewed_at` DATETIME(3) NULL,
  `rejection_reason` VARCHAR(500) NULL,
  `outlook_event_id` VARCHAR(191) NULL,
  `urgent_override` BOOLEAN NOT NULL DEFAULT false,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at` DATETIME(3) NOT NULL,
  INDEX `appointments_status_start_at_idx`(`status`, `start_at`),
  INDEX `appointments_start_at_end_at_idx`(`start_at`, `end_at`),
  INDEX `appointments_requested_by_id_idx`(`requested_by_id`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `participants` (
  `id` VARCHAR(191) NOT NULL,
  `appointment_id` VARCHAR(191) NOT NULL,
  `user_id` VARCHAR(191) NULL,
  `email` VARCHAR(191) NOT NULL,
  `name` VARCHAR(191) NOT NULL,
  `is_external` BOOLEAN NOT NULL DEFAULT false,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  INDEX `participants_appointment_id_idx`(`appointment_id`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `dg_notifications` (
  `id` VARCHAR(191) NOT NULL,
  `user_id` VARCHAR(191) NOT NULL,
  `appointment_id` VARCHAR(191) NULL,
  `kind` ENUM('REQUEST_CREATED', 'APPROVED', 'REJECTED', 'RESCHEDULED', 'REMINDER_24H', 'REMINDER_1H') NOT NULL,
  `title` VARCHAR(191) NOT NULL,
  `message` VARCHAR(1000) NOT NULL,
  `email_sent` BOOLEAN NOT NULL DEFAULT false,
  `scheduled_for` DATETIME(3) NULL,
  `sent_at` DATETIME(3) NULL,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  INDEX `dg_notifications_user_id_created_at_idx`(`user_id`, `created_at`),
  INDEX `dg_notifications_scheduled_for_email_sent_idx`(`scheduled_for`, `email_sent`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `dg_audit_logs` (
  `id` VARCHAR(191) NOT NULL,
  `user_id` VARCHAR(191) NOT NULL,
  `appointment_id` VARCHAR(191) NULL,
  `action` VARCHAR(120) NOT NULL,
  `meta` JSON NULL,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  INDEX `dg_audit_logs_created_at_idx`(`created_at`),
  INDEX `dg_audit_logs_appointment_id_idx`(`appointment_id`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `appointments`
  ADD CONSTRAINT `appointments_requested_by_id_fkey`
    FOREIGN KEY (`requested_by_id`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT `appointments_reviewed_by_id_fkey`
    FOREIGN KEY (`reviewed_by_id`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE `participants`
  ADD CONSTRAINT `participants_appointment_id_fkey`
    FOREIGN KEY (`appointment_id`) REFERENCES `appointments`(`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT `participants_user_id_fkey`
    FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE `dg_notifications`
  ADD CONSTRAINT `dg_notifications_user_id_fkey`
    FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT `dg_notifications_appointment_id_fkey`
    FOREIGN KEY (`appointment_id`) REFERENCES `appointments`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE `dg_audit_logs`
  ADD CONSTRAINT `dg_audit_logs_user_id_fkey`
    FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT `dg_audit_logs_appointment_id_fkey`
    FOREIGN KEY (`appointment_id`) REFERENCES `appointments`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
