-- AlterTable
ALTER TABLE `dg_missions` ADD COLUMN `archived` BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE `dg_missions` ADD COLUMN `archived_at` DATETIME(3) NULL;

-- CreateIndex
CREATE INDEX `dg_missions_archived_archived_at_idx` ON `dg_missions`(`archived`, `archived_at`);
