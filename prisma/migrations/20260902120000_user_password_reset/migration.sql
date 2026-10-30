-- AlterTable
ALTER TABLE `users`
  ADD COLUMN `password_reset_token` VARCHAR(64) NULL,
  ADD COLUMN `password_reset_expires_at` DATETIME(3) NULL;
