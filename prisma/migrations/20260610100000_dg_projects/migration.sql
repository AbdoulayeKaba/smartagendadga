-- CreateTable
CREATE TABLE `dg_projects` (
    `id` VARCHAR(191) NOT NULL,
    `name` VARCHAR(200) NOT NULL,
    `description` TEXT NULL,
    `status` ENUM('PLANNED', 'ACTIVE', 'ON_HOLD', 'COMPLETED', 'CANCELLED') NOT NULL DEFAULT 'ACTIVE',
    `owner_name` VARCHAR(120) NOT NULL,
    `owner_user_id` VARCHAR(191) NULL,
    `phases` VARCHAR(500) NULL,
    `start_at` DATETIME(3) NULL,
    `due_at` DATETIME(3) NULL,
    `created_by_id` VARCHAR(191) NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `dg_projects_status_idx`(`status`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AlterTable
ALTER TABLE `dg_tasks` ADD COLUMN `project_id` VARCHAR(191) NULL;

-- CreateIndex
CREATE INDEX `dg_tasks_project_id_idx` ON `dg_tasks`(`project_id`);

-- AddForeignKey
ALTER TABLE `dg_projects` ADD CONSTRAINT `dg_projects_created_by_id_fkey` FOREIGN KEY (`created_by_id`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `dg_tasks` ADD CONSTRAINT `dg_tasks_project_id_fkey` FOREIGN KEY (`project_id`) REFERENCES `dg_projects`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- Backfill projects from existing task project names
INSERT INTO `dg_projects` (`id`, `name`, `status`, `owner_name`, `created_by_id`, `created_at`, `updated_at`)
SELECT
    CONCAT('migproj_', SUBSTRING(MD5(TRIM(`project_name`)), 1, 24)),
    TRIM(`project_name`),
    'ACTIVE',
    COALESCE(
        (SELECT `assignee_name` FROM `dg_tasks` t2 WHERE TRIM(t2.`project_name`) = TRIM(t.`project_name`) ORDER BY t2.`created_at` ASC LIMIT 1),
        'Cabinet DG'
    ),
    COALESCE(
        (SELECT `created_by_id` FROM `dg_tasks` t2 WHERE TRIM(t2.`project_name`) = TRIM(t.`project_name`) ORDER BY t2.`created_at` ASC LIMIT 1),
        (SELECT `id` FROM `users` ORDER BY `created_at` ASC LIMIT 1)
    ),
    NOW(3),
    NOW(3)
FROM `dg_tasks` t
WHERE `project_name` IS NOT NULL AND TRIM(`project_name`) <> ''
GROUP BY TRIM(`project_name`);

UPDATE `dg_tasks` t
INNER JOIN `dg_projects` p ON TRIM(t.`project_name`) = p.`name`
SET t.`project_id` = p.`id`
WHERE t.`project_name` IS NOT NULL AND TRIM(t.`project_name`) <> '';
