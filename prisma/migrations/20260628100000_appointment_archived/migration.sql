-- AlterTable
ALTER TABLE `appointments` ADD COLUMN `archived` BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN `archived_at` DATETIME(3) NULL;

-- CreateIndex
CREATE INDEX `appointments_archived_archived_at_idx` ON `appointments`(`archived`, `archived_at`);
