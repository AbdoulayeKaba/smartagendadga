-- Champs alignés sur les tableaux courrier DGA (référence assistante)

ALTER TABLE `dg_mail_records`
  ADD COLUMN `registration_number` INT NULL AFTER `direction`,
  ADD COLUMN `priority` ENUM('URGENT', 'NORMAL') NOT NULL DEFAULT 'NORMAL' AFTER `mail_date`,
  ADD COLUMN `origin` VARCHAR(200) NULL AFTER `workflow_status`,
  ADD COLUMN `dga_instruction` VARCHAR(120) NULL AFTER `origin`,
  ADD COLUMN `executor` VARCHAR(120) NULL AFTER `dga_instruction`,
  ADD COLUMN `action` VARCHAR(200) NULL AFTER `executor`,
  ADD COLUMN `sc_sent_at` DATETIME(3) NULL AFTER `action`,
  ADD COLUMN `execution_deadline` DATETIME(3) NULL AFTER `sc_sent_at`,
  ADD COLUMN `follow_up` TEXT NULL AFTER `execution_deadline`,
  ADD COLUMN `courier_name` VARCHAR(120) NULL AFTER `follow_up`;
