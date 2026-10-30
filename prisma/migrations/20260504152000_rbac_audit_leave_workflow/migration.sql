-- AlterTable
ALTER TABLE `employee_leaves`
  ADD COLUMN `status` ENUM('draft', 'submitted', 'approved', 'rejected', 'cancelled') NOT NULL DEFAULT 'draft',
  ADD COLUMN `submitted_at` DATETIME(3) NULL,
  ADD COLUMN `approved_by_employee_id` VARCHAR(191) NULL,
  ADD COLUMN `approved_at` DATETIME(3) NULL,
  ADD COLUMN `rejection_reason` VARCHAR(500) NULL;

-- CreateTable
CREATE TABLE `audit_logs` (
  `id` VARCHAR(191) NOT NULL,
  `actor_employee_id` VARCHAR(191) NULL,
  `action` VARCHAR(191) NOT NULL,
  `resource` VARCHAR(191) NOT NULL,
  `resource_id` VARCHAR(191) NULL,
  `metadata` JSON NULL,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  INDEX `audit_logs_created_at_idx`(`created_at`),
  INDEX `audit_logs_resource_action_idx`(`resource`, `action`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateIndex
CREATE INDEX `employee_leaves_status_idx` ON `employee_leaves`(`status`);

-- AddForeignKey
ALTER TABLE `employee_leaves`
  ADD CONSTRAINT `employee_leaves_approved_by_employee_id_fkey`
  FOREIGN KEY (`approved_by_employee_id`) REFERENCES `employees`(`id`)
  ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `audit_logs`
  ADD CONSTRAINT `audit_logs_actor_employee_id_fkey`
  FOREIGN KEY (`actor_employee_id`) REFERENCES `employees`(`id`)
  ON DELETE SET NULL ON UPDATE CASCADE;
