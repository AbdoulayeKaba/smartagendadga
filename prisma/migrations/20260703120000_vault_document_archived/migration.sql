-- AlterTable
ALTER TABLE `dg_vault_documents` ADD COLUMN `archived` BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE `dg_vault_documents` ADD COLUMN `archived_at` DATETIME(3) NULL;

-- CreateIndex
CREATE INDEX `dg_vault_documents_category_archived_report_date_idx` ON `dg_vault_documents`(`category`, `archived`, `report_date`);
