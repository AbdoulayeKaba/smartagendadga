-- Date métier du compte rendu (distincte du dépôt fichier)
ALTER TABLE `dg_vault_documents`
  ADD COLUMN `report_date` DATETIME(3) NULL AFTER `storage_key`;

UPDATE `dg_vault_documents`
SET `report_date` = `uploaded_at`
WHERE `report_date` IS NULL;

ALTER TABLE `dg_vault_documents`
  MODIFY `report_date` DATETIME(3) NOT NULL;

DROP INDEX `dg_vault_documents_category_uploaded_at_idx` ON `dg_vault_documents`;
CREATE INDEX `dg_vault_documents_category_report_date_idx` ON `dg_vault_documents`(`category`, `report_date`);
