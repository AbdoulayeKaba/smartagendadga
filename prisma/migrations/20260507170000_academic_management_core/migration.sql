-- CreateTable
CREATE TABLE `academic_years` (
    `id` VARCHAR(191) NOT NULL,
    `label` VARCHAR(32) NOT NULL,
    `start_date` VARCHAR(10) NOT NULL,
    `end_date` VARCHAR(10) NOT NULL,
    `is_current` BOOLEAN NOT NULL DEFAULT false,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `academic_years_label_key`(`label`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `subjects` (
    `id` VARCHAR(191) NOT NULL,
    `code` VARCHAR(32) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `coefficient` DOUBLE NOT NULL DEFAULT 1,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `subjects_code_key`(`code`),
    INDEX `subjects_name_idx`(`name`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `student_enrollments` (
    `id` VARCHAR(191) NOT NULL,
    `student_id` VARCHAR(191) NOT NULL,
    `classroom_id` VARCHAR(191) NOT NULL,
    `academic_year_id` VARCHAR(191) NOT NULL,
    `status` ENUM('active', 'suspended', 'completed', 'dropped') NOT NULL DEFAULT 'active',
    `enrolled_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `student_enrollments_student_id_academic_year_id_key`(`student_id`, `academic_year_id`),
    INDEX `student_enrollments_classroom_id_academic_year_id_idx`(`classroom_id`, `academic_year_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `teacher_assignments` (
    `id` VARCHAR(191) NOT NULL,
    `teacher_id` VARCHAR(191) NOT NULL,
    `subject_id` VARCHAR(191) NOT NULL,
    `classroom_id` VARCHAR(191) NOT NULL,
    `academic_year_id` VARCHAR(191) NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `teacher_assignments_teacher_id_subject_id_classroom_id_academic_ye_key`(`teacher_id`, `subject_id`, `classroom_id`, `academic_year_id`),
    INDEX `teacher_assignments_classroom_id_academic_year_id_idx`(`classroom_id`, `academic_year_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `timetable_sessions` (
    `id` VARCHAR(191) NOT NULL,
    `assignment_id` VARCHAR(191) NOT NULL,
    `teacher_id` VARCHAR(191) NOT NULL,
    `classroom_id` VARCHAR(191) NOT NULL,
    `subject_id` VARCHAR(191) NOT NULL,
    `academic_year_id` VARCHAR(191) NOT NULL,
    `weekday` ENUM('monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday') NOT NULL,
    `start_time` VARCHAR(5) NOT NULL,
    `end_time` VARCHAR(5) NOT NULL,
    `room_label` VARCHAR(64) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `timetable_sessions_classroom_id_weekday_start_time_idx`(`classroom_id`, `weekday`, `start_time`),
    INDEX `timetable_sessions_teacher_id_weekday_start_time_idx`(`teacher_id`, `weekday`, `start_time`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `grade_records` (
    `id` VARCHAR(191) NOT NULL,
    `student_id` VARCHAR(191) NOT NULL,
    `assignment_id` VARCHAR(191) NOT NULL,
    `subject_id` VARCHAR(191) NOT NULL,
    `teacher_id` VARCHAR(191) NOT NULL,
    `academic_year_id` VARCHAR(191) NOT NULL,
    `assessment_type` ENUM('homework', 'quiz', 'exam', 'project', 'oral') NOT NULL,
    `score` DOUBLE NOT NULL,
    `max_score` DOUBLE NOT NULL DEFAULT 20,
    `assessment_date` VARCHAR(10) NOT NULL,
    `comment` VARCHAR(500) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `grade_records_student_id_subject_id_academic_year_id_idx`(`student_id`, `subject_id`, `academic_year_id`),
    INDEX `grade_records_assessment_date_idx`(`assessment_date`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `student_absences` (
    `id` VARCHAR(191) NOT NULL,
    `student_id` VARCHAR(191) NOT NULL,
    `assignment_id` VARCHAR(191) NULL,
    `academic_year_id` VARCHAR(191) NOT NULL,
    `date` VARCHAR(10) NOT NULL,
    `start_time` VARCHAR(5) NULL,
    `end_time` VARCHAR(5) NULL,
    `status` ENUM('pending', 'justified', 'unjustified') NOT NULL DEFAULT 'pending',
    `reason` VARCHAR(500) NULL,
    `marked_by_teacher_id` VARCHAR(191) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `student_absences_student_id_date_idx`(`student_id`, `date`),
    INDEX `student_absences_academic_year_id_date_idx`(`academic_year_id`, `date`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `student_enrollments`
ADD CONSTRAINT `student_enrollments_student_id_fkey`
FOREIGN KEY (`student_id`) REFERENCES `students`(`id`)
ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `student_enrollments`
ADD CONSTRAINT `student_enrollments_classroom_id_fkey`
FOREIGN KEY (`classroom_id`) REFERENCES `classrooms`(`id`)
ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `student_enrollments`
ADD CONSTRAINT `student_enrollments_academic_year_id_fkey`
FOREIGN KEY (`academic_year_id`) REFERENCES `academic_years`(`id`)
ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `teacher_assignments`
ADD CONSTRAINT `teacher_assignments_teacher_id_fkey`
FOREIGN KEY (`teacher_id`) REFERENCES `teachers`(`id`)
ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `teacher_assignments`
ADD CONSTRAINT `teacher_assignments_subject_id_fkey`
FOREIGN KEY (`subject_id`) REFERENCES `subjects`(`id`)
ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `teacher_assignments`
ADD CONSTRAINT `teacher_assignments_classroom_id_fkey`
FOREIGN KEY (`classroom_id`) REFERENCES `classrooms`(`id`)
ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `teacher_assignments`
ADD CONSTRAINT `teacher_assignments_academic_year_id_fkey`
FOREIGN KEY (`academic_year_id`) REFERENCES `academic_years`(`id`)
ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `timetable_sessions`
ADD CONSTRAINT `timetable_sessions_assignment_id_fkey`
FOREIGN KEY (`assignment_id`) REFERENCES `teacher_assignments`(`id`)
ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `timetable_sessions`
ADD CONSTRAINT `timetable_sessions_teacher_id_fkey`
FOREIGN KEY (`teacher_id`) REFERENCES `teachers`(`id`)
ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `timetable_sessions`
ADD CONSTRAINT `timetable_sessions_classroom_id_fkey`
FOREIGN KEY (`classroom_id`) REFERENCES `classrooms`(`id`)
ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `timetable_sessions`
ADD CONSTRAINT `timetable_sessions_subject_id_fkey`
FOREIGN KEY (`subject_id`) REFERENCES `subjects`(`id`)
ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `timetable_sessions`
ADD CONSTRAINT `timetable_sessions_academic_year_id_fkey`
FOREIGN KEY (`academic_year_id`) REFERENCES `academic_years`(`id`)
ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `grade_records`
ADD CONSTRAINT `grade_records_student_id_fkey`
FOREIGN KEY (`student_id`) REFERENCES `students`(`id`)
ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `grade_records`
ADD CONSTRAINT `grade_records_assignment_id_fkey`
FOREIGN KEY (`assignment_id`) REFERENCES `teacher_assignments`(`id`)
ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `grade_records`
ADD CONSTRAINT `grade_records_subject_id_fkey`
FOREIGN KEY (`subject_id`) REFERENCES `subjects`(`id`)
ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `grade_records`
ADD CONSTRAINT `grade_records_teacher_id_fkey`
FOREIGN KEY (`teacher_id`) REFERENCES `teachers`(`id`)
ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `grade_records`
ADD CONSTRAINT `grade_records_academic_year_id_fkey`
FOREIGN KEY (`academic_year_id`) REFERENCES `academic_years`(`id`)
ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `student_absences`
ADD CONSTRAINT `student_absences_student_id_fkey`
FOREIGN KEY (`student_id`) REFERENCES `students`(`id`)
ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `student_absences`
ADD CONSTRAINT `student_absences_assignment_id_fkey`
FOREIGN KEY (`assignment_id`) REFERENCES `teacher_assignments`(`id`)
ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `student_absences`
ADD CONSTRAINT `student_absences_academic_year_id_fkey`
FOREIGN KEY (`academic_year_id`) REFERENCES `academic_years`(`id`)
ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `student_absences`
ADD CONSTRAINT `student_absences_marked_by_teacher_id_fkey`
FOREIGN KEY (`marked_by_teacher_id`) REFERENCES `teachers`(`id`)
ON DELETE SET NULL ON UPDATE CASCADE;
