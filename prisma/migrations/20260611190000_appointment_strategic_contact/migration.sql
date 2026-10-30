-- AlterTable
ALTER TABLE `appointments` ADD COLUMN `strategic_contact_id` VARCHAR(191) NULL;

-- CreateIndex
CREATE INDEX `appointments_strategic_contact_id_idx` ON `appointments`(`strategic_contact_id`);

-- AddForeignKey
ALTER TABLE `appointments` ADD CONSTRAINT `appointments_strategic_contact_id_fkey` FOREIGN KEY (`strategic_contact_id`) REFERENCES `dg_strategic_contacts`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
