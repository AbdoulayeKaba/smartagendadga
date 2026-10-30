ALTER TABLE `employee_credentials`
  ADD COLUMN `role` ENUM('admin','rh','chef','employe') NOT NULL DEFAULT 'employe';

ALTER TABLE `employees`
  ADD COLUMN `manager_id` VARCHAR(191) NULL;

ALTER TABLE `employees`
  ADD INDEX `employees_manager_id_idx`(`manager_id`);

ALTER TABLE `employees`
  ADD CONSTRAINT `employees_manager_id_fkey`
    FOREIGN KEY (`manager_id`) REFERENCES `employees`(`id`)
    ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE `employee_leaves`
  ADD COLUMN `leave_type_id` VARCHAR(191) NULL,
  ADD COLUMN `working_days` INT NOT NULL DEFAULT 0;

ALTER TABLE `employee_leaves`
  ADD INDEX `employee_leaves_leave_type_id_idx`(`leave_type_id`);

CREATE TABLE `leave_type_configs` (
  `id` VARCHAR(191) NOT NULL,
  `code` VARCHAR(64) NOT NULL,
  `label` VARCHAR(191) NOT NULL,
  `description` VARCHAR(500) NULL,
  `max_days_per_year` INT NOT NULL DEFAULT 30,
  `requires_proof` BOOLEAN NOT NULL DEFAULT false,
  `is_active` BOOLEAN NOT NULL DEFAULT true,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  UNIQUE INDEX `leave_type_configs_code_key`(`code`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `leave_balances` (
  `id` VARCHAR(191) NOT NULL,
  `employee_id` VARCHAR(191) NOT NULL,
  `leave_type_id` VARCHAR(191) NOT NULL,
  `year` INT NOT NULL,
  `opening_days` DOUBLE NOT NULL DEFAULT 0,
  `earned_days` DOUBLE NOT NULL DEFAULT 0,
  `used_days` DOUBLE NOT NULL DEFAULT 0,
  `pending_days` DOUBLE NOT NULL DEFAULT 0,
  `updated_at` DATETIME(3) NOT NULL,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  UNIQUE INDEX `leave_balances_employee_id_leave_type_id_year_key`(`employee_id`, `leave_type_id`, `year`),
  INDEX `leave_balances_year_idx`(`year`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `leave_approval_history` (
  `id` VARCHAR(191) NOT NULL,
  `leave_id` VARCHAR(191) NOT NULL,
  `approver_id` VARCHAR(191) NOT NULL,
  `approver_role` ENUM('admin','rh','chef','employe') NOT NULL,
  `decision` ENUM('approved','rejected') NOT NULL,
  `comment` VARCHAR(500) NULL,
  `decided_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `level_order` INT NOT NULL DEFAULT 1,
  INDEX `leave_approval_history_leave_id_decided_at_idx`(`leave_id`, `decided_at`),
  INDEX `leave_approval_history_approver_id_decided_at_idx`(`approver_id`, `decided_at`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `arpt_notifications` (
  `id` VARCHAR(191) NOT NULL,
  `employee_id` VARCHAR(191) NOT NULL,
  `leave_id` VARCHAR(191) NULL,
  `type` ENUM('leave_submitted','leave_approved','leave_rejected','balance_low') NOT NULL,
  `title` VARCHAR(191) NOT NULL,
  `message` VARCHAR(1000) NOT NULL,
  `read_at` DATETIME(3) NULL,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  INDEX `arpt_notifications_employee_id_created_at_idx`(`employee_id`, `created_at`),
  INDEX `arpt_notifications_read_at_idx`(`read_at`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `employee_leaves`
  ADD CONSTRAINT `employee_leaves_leave_type_id_fkey`
    FOREIGN KEY (`leave_type_id`) REFERENCES `leave_type_configs`(`id`)
    ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE `leave_balances`
  ADD CONSTRAINT `leave_balances_employee_id_fkey`
    FOREIGN KEY (`employee_id`) REFERENCES `employees`(`id`)
    ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT `leave_balances_leave_type_id_fkey`
    FOREIGN KEY (`leave_type_id`) REFERENCES `leave_type_configs`(`id`)
    ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE `leave_approval_history`
  ADD CONSTRAINT `leave_approval_history_leave_id_fkey`
    FOREIGN KEY (`leave_id`) REFERENCES `employee_leaves`(`id`)
    ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT `leave_approval_history_approver_id_fkey`
    FOREIGN KEY (`approver_id`) REFERENCES `employees`(`id`)
    ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE `arpt_notifications`
  ADD CONSTRAINT `arpt_notifications_employee_id_fkey`
    FOREIGN KEY (`employee_id`) REFERENCES `employees`(`id`)
    ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT `arpt_notifications_leave_id_fkey`
    FOREIGN KEY (`leave_id`) REFERENCES `employee_leaves`(`id`)
    ON DELETE SET NULL ON UPDATE CASCADE;
