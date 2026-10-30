-- CreateTable
CREATE TABLE `audit_logs` (
    `id` VARCHAR(191) NOT NULL,
    `actor_id` VARCHAR(191) NOT NULL,
    `actor_email` VARCHAR(191) NOT NULL,
    `actor_name` VARCHAR(191) NOT NULL,
    `action` VARCHAR(120) NOT NULL,
    `entity` VARCHAR(64) NOT NULL,
    `entity_id` VARCHAR(191) NULL,
    `meta` JSON NULL,
    `ip` VARCHAR(64) NULL,
    `user_agent` VARCHAR(512) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `audit_logs_created_at_idx`(`created_at`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
