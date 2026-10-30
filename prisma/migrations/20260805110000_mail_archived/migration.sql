-- AlterTable
ALTER TABLE `dg_mail_records` ADD COLUMN `archived` BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE `dg_mail_records` ADD COLUMN `archived_at` DATETIME(3) NULL;

-- CreateIndex
CREATE INDEX `dg_mail_records_archived_archived_at_idx` ON `dg_mail_records`(`archived`, `archived_at`);
