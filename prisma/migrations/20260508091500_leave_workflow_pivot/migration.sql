-- Leave workflow upgrade for employee leave requests
ALTER TABLE `employee_leaves`
  ADD COLUMN `status` ENUM('draft','submitted','approved','rejected','cancelled') NOT NULL DEFAULT 'submitted',
  ADD COLUMN `submitted_at` DATETIME(3) NULL,
  ADD COLUMN `approved_at` DATETIME(3) NULL,
  ADD COLUMN `rejection_reason` VARCHAR(500) NULL,
  ADD COLUMN `approved_by_employee_id` VARCHAR(191) NULL;

UPDATE `employee_leaves`
SET `submitted_at` = `created_at`
WHERE `submitted_at` IS NULL;

ALTER TABLE `employee_leaves`
  ADD INDEX `employee_leaves_status_submitted_at_idx`(`status`, `submitted_at`),
  ADD INDEX `employee_leaves_approved_by_employee_id_idx`(`approved_by_employee_id`);

ALTER TABLE `employee_leaves`
  ADD CONSTRAINT `employee_leaves_approved_by_employee_id_fkey`
    FOREIGN KEY (`approved_by_employee_id`) REFERENCES `employees`(`id`)
    ON DELETE SET NULL ON UPDATE CASCADE;
