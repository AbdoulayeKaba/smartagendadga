ALTER TABLE `users`
  ADD COLUMN `microsoft_id` VARCHAR(191) NULL,
  MODIFY `password_hash` VARCHAR(191) NULL;

CREATE UNIQUE INDEX `users_microsoft_id_key` ON `users`(`microsoft_id`);
