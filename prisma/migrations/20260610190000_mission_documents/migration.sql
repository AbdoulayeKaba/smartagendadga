CREATE TABLE `dg_mission_documents` (
  `id` VARCHAR(191) NOT NULL,
  `mission_id` VARCHAR(191) NOT NULL,
  `file_name` VARCHAR(255) NOT NULL,
  `file_size` INTEGER NOT NULL,
  `mime_type` VARCHAR(120) NOT NULL,
  `storage_key` VARCHAR(500) NOT NULL,
  `uploaded_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  INDEX `dg_mission_documents_mission_id_idx`(`mission_id`),
  CONSTRAINT `dg_mission_documents_mission_id_fkey` FOREIGN KEY (`mission_id`) REFERENCES `dg_missions`(`id`) ON DELETE CASCADE ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
