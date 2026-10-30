-- CreateTable
CREATE TABLE `dg_mail_attachments` (
    `id` VARCHAR(191) NOT NULL,
    `mail_id` VARCHAR(191) NOT NULL,
    `file_name` VARCHAR(255) NOT NULL,
    `file_size` INTEGER NOT NULL,
    `mime_type` VARCHAR(120) NOT NULL,
    `storage_key` VARCHAR(500) NOT NULL,
    `uploaded_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `dg_mail_attachments_mail_id_idx`(`mail_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `dg_mail_attachments` ADD CONSTRAINT `dg_mail_attachments_mail_id_fkey` FOREIGN KEY (`mail_id`) REFERENCES `dg_mail_records`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
