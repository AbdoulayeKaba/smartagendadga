-- AlterTable
ALTER TABLE `users` ADD COLUMN `session_version` INTEGER NOT NULL DEFAULT 0,
    ADD COLUMN `password_changed_at` DATETIME(3) NULL;
