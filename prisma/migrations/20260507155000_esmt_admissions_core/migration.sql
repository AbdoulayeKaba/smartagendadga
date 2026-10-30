-- CreateTable
CREATE TABLE `pre_registrations` (
    `id` VARCHAR(191) NOT NULL,
    `first_name` VARCHAR(191) NOT NULL,
    `last_name` VARCHAR(191) NOT NULL,
    `email` VARCHAR(191) NOT NULL,
    `phone` VARCHAR(32) NULL,
    `program` VARCHAR(191) NOT NULL,
    `academic_year` VARCHAR(32) NOT NULL,
    `status` ENUM('draft', 'submitted', 'under_review', 'validated', 'rejected', 'revision_required') NOT NULL DEFAULT 'submitted',
    `motivation` VARCHAR(1500) NULL,
    `review_comment` VARCHAR(1500) NULL,
    `reviewed_by_id` VARCHAR(191) NULL,
    `submitted_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `reviewed_at` DATETIME(3) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `pre_registrations_status_submitted_at_idx`(`status`, `submitted_at`),
    INDEX `pre_registrations_email_idx`(`email`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `applications` (
    `id` VARCHAR(191) NOT NULL,
    `type` ENUM('student', 'professor') NOT NULL,
    `first_name` VARCHAR(191) NOT NULL,
    `last_name` VARCHAR(191) NOT NULL,
    `email` VARCHAR(191) NOT NULL,
    `phone` VARCHAR(32) NULL,
    `target_program` VARCHAR(191) NULL,
    `specialty` VARCHAR(191) NULL,
    `cover_letter` VARCHAR(2000) NULL,
    `academic_year` VARCHAR(32) NOT NULL,
    `status` ENUM('draft', 'submitted', 'under_review', 'validated', 'rejected', 'revision_required') NOT NULL DEFAULT 'submitted',
    `review_comment` VARCHAR(1500) NULL,
    `reviewed_by_id` VARCHAR(191) NULL,
    `submitted_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `reviewed_at` DATETIME(3) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `applications_type_status_submitted_at_idx`(`type`, `status`, `submitted_at`),
    INDEX `applications_email_idx`(`email`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `admission_documents` (
    `id` VARCHAR(191) NOT NULL,
    `file_name` VARCHAR(191) NOT NULL,
    `file_url` VARCHAR(191) NOT NULL,
    `content_type` VARCHAR(120) NULL,
    `file_size` INTEGER NULL,
    `pre_registration_id` VARCHAR(191) NULL,
    `application_id` VARCHAR(191) NULL,
    `uploaded_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `admission_documents_pre_registration_id_idx`(`pre_registration_id`),
    INDEX `admission_documents_application_id_idx`(`application_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `pre_registrations`
ADD CONSTRAINT `pre_registrations_reviewed_by_id_fkey`
FOREIGN KEY (`reviewed_by_id`) REFERENCES `employees`(`id`)
ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `applications`
ADD CONSTRAINT `applications_reviewed_by_id_fkey`
FOREIGN KEY (`reviewed_by_id`) REFERENCES `employees`(`id`)
ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `admission_documents`
ADD CONSTRAINT `admission_documents_pre_registration_id_fkey`
FOREIGN KEY (`pre_registration_id`) REFERENCES `pre_registrations`(`id`)
ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `admission_documents`
ADD CONSTRAINT `admission_documents_application_id_fkey`
FOREIGN KEY (`application_id`) REFERENCES `applications`(`id`)
ON DELETE CASCADE ON UPDATE CASCADE;
