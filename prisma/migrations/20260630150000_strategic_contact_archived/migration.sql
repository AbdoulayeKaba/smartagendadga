-- AlterTable
ALTER TABLE `dg_strategic_contacts` ADD COLUMN `archived` BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE `dg_strategic_contacts` ADD COLUMN `archived_at` DATETIME(3) NULL;

-- CreateIndex
CREATE INDEX `dg_strategic_contacts_archived_archived_at_idx` ON `dg_strategic_contacts`(`archived`, `archived_at`);
