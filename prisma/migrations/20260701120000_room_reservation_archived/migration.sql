-- AlterTable
ALTER TABLE `room_reservations` ADD COLUMN `archived` BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN `archived_at` DATETIME(3) NULL;

-- CreateIndex
CREATE INDEX `room_reservations_archived_archived_at_idx` ON `room_reservations`(`archived`, `archived_at`);
