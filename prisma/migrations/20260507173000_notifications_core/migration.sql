-- CreateTable
CREATE TABLE `notifications` (
    `id` VARCHAR(191) NOT NULL,
    `title` VARCHAR(191) NOT NULL,
    `message` VARCHAR(1000) NOT NULL,
    `channel` ENUM('email', 'sms', 'in_app') NOT NULL DEFAULT 'in_app',
    `status` ENUM('pending', 'sent', 'failed') NOT NULL DEFAULT 'pending',
    `recipient_email` VARCHAR(191) NULL,
    `student_id` VARCHAR(191) NULL,
    `parent_id` VARCHAR(191) NULL,
    `teacher_id` VARCHAR(191) NULL,
    `academic_year_id` VARCHAR(191) NULL,
    `meta` JSON NULL,
    `sent_at` DATETIME(3) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `notifications_status_created_at_idx`(`status`, `created_at`),
    INDEX `notifications_student_id_created_at_idx`(`student_id`, `created_at`),
    INDEX `notifications_parent_id_created_at_idx`(`parent_id`, `created_at`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `notifications`
ADD CONSTRAINT `notifications_student_id_fkey`
FOREIGN KEY (`student_id`) REFERENCES `students`(`id`)
ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `notifications`
ADD CONSTRAINT `notifications_parent_id_fkey`
FOREIGN KEY (`parent_id`) REFERENCES `parents`(`id`)
ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `notifications`
ADD CONSTRAINT `notifications_teacher_id_fkey`
FOREIGN KEY (`teacher_id`) REFERENCES `teachers`(`id`)
ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `notifications`
ADD CONSTRAINT `notifications_academic_year_id_fkey`
FOREIGN KEY (`academic_year_id`) REFERENCES `academic_years`(`id`)
ON DELETE SET NULL ON UPDATE CASCADE;
