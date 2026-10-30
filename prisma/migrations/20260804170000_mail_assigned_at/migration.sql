-- Date d'affectation du courrier (étape ASSIGNED)
ALTER TABLE `dg_mail_records`
  ADD COLUMN `assigned_at` DATETIME(3) NULL AFTER `assigned_service`;
