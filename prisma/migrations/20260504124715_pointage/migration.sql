-- RedefineIndex
CREATE INDEX `employee_leaves_start_date_end_date_idx` ON `employee_leaves`(`start_date`, `end_date`);
DROP INDEX `employee_leaves_dates_idx` ON `employee_leaves`;
