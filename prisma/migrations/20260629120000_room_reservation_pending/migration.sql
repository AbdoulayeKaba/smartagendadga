-- AlterTable
ALTER TABLE `room_reservations`
    MODIFY `status` ENUM('PENDING', 'CONFIRMED', 'REJECTED', 'CANCELLED') NOT NULL DEFAULT 'PENDING';

ALTER TABLE `room_reservations`
    ADD COLUMN `reviewed_by_id` VARCHAR(191) NULL,
    ADD COLUMN `reviewed_at` DATETIME(3) NULL,
    ADD COLUMN `rejection_reason` VARCHAR(500) NULL;

ALTER TABLE `room_reservations`
    ADD CONSTRAINT `room_reservations_reviewed_by_id_fkey`
        FOREIGN KEY (`reviewed_by_id`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX `room_reservations_reviewed_by_id_idx` ON `room_reservations`(`reviewed_by_id`);
