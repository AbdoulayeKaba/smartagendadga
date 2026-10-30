-- AlterTable
ALTER TABLE `users` ADD COLUMN `archived_at` DATETIME(3) NULL;

-- Backfill from last update for already archived accounts
UPDATE `users` SET `archived_at` = `updated_at` WHERE `archived` = true AND `archived_at` IS NULL;
