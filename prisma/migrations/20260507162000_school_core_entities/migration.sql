-- CreateTable
CREATE TABLE `parents` (
    `id` VARCHAR(191) NOT NULL,
    `first_name` VARCHAR(191) NOT NULL,
    `last_name` VARCHAR(191) NOT NULL,
    `email` VARCHAR(191) NULL,
    `phone` VARCHAR(32) NULL,
    `profession` VARCHAR(191) NULL,
    `address` VARCHAR(500) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `parents_email_key`(`email`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `classrooms` (
    `id` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `level` VARCHAR(64) NOT NULL,
    `section` VARCHAR(64) NULL,
    `capacity` INTEGER NOT NULL DEFAULT 30,
    `building` VARCHAR(120) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `classrooms_name_level_section_key`(`name`, `level`, `section`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `students` (
    `id` VARCHAR(191) NOT NULL,
    `matricule` VARCHAR(64) NOT NULL,
    `first_name` VARCHAR(191) NOT NULL,
    `last_name` VARCHAR(191) NOT NULL,
    `email` VARCHAR(191) NULL,
    `phone` VARCHAR(32) NULL,
    `date_of_birth` VARCHAR(10) NULL,
    `gender` ENUM('male', 'female', 'other') NULL,
    `classroom_id` VARCHAR(191) NULL,
    `status` VARCHAR(32) NOT NULL DEFAULT 'active',
    `reviewed_by_id` VARCHAR(191) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `students_matricule_key`(`matricule`),
    UNIQUE INDEX `students_email_key`(`email`),
    INDEX `students_classroom_id_idx`(`classroom_id`),
    INDEX `students_last_name_first_name_idx`(`last_name`, `first_name`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `teachers` (
    `id` VARCHAR(191) NOT NULL,
    `matricule` VARCHAR(64) NOT NULL,
    `first_name` VARCHAR(191) NOT NULL,
    `last_name` VARCHAR(191) NOT NULL,
    `email` VARCHAR(191) NULL,
    `phone` VARCHAR(32) NULL,
    `specialty` VARCHAR(191) NULL,
    `status` VARCHAR(32) NOT NULL DEFAULT 'active',
    `reviewed_by_id` VARCHAR(191) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `teachers_matricule_key`(`matricule`),
    UNIQUE INDEX `teachers_email_key`(`email`),
    INDEX `teachers_last_name_first_name_idx`(`last_name`, `first_name`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `student_parents` (
    `id` VARCHAR(191) NOT NULL,
    `student_id` VARCHAR(191) NOT NULL,
    `parent_id` VARCHAR(191) NOT NULL,
    `relation` VARCHAR(64) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `student_parents_student_id_parent_id_key`(`student_id`, `parent_id`),
    INDEX `student_parents_parent_id_idx`(`parent_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `students`
ADD CONSTRAINT `students_classroom_id_fkey`
FOREIGN KEY (`classroom_id`) REFERENCES `classrooms`(`id`)
ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `students`
ADD CONSTRAINT `students_reviewed_by_id_fkey`
FOREIGN KEY (`reviewed_by_id`) REFERENCES `employees`(`id`)
ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `teachers`
ADD CONSTRAINT `teachers_reviewed_by_id_fkey`
FOREIGN KEY (`reviewed_by_id`) REFERENCES `employees`(`id`)
ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `student_parents`
ADD CONSTRAINT `student_parents_student_id_fkey`
FOREIGN KEY (`student_id`) REFERENCES `students`(`id`)
ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `student_parents`
ADD CONSTRAINT `student_parents_parent_id_fkey`
FOREIGN KEY (`parent_id`) REFERENCES `parents`(`id`)
ON DELETE CASCADE ON UPDATE CASCADE;
