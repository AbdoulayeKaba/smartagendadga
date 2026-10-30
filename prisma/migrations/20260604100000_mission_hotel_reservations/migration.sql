-- Réservations d'hôtel liées aux missions DG

CREATE TABLE `dg_mission_hotel_reservations` (
    `id` VARCHAR(191) NOT NULL,
    `mission_id` VARCHAR(191) NOT NULL,
    `hotel` VARCHAR(200) NOT NULL,
    `address` VARCHAR(300) NULL,
    `city` VARCHAR(120) NOT NULL,
    `country` VARCHAR(120) NOT NULL,
    `contact` VARCHAR(200) NULL,
    `room_count` INTEGER NOT NULL,
    `room_type` VARCHAR(120) NULL,
    `arrival_date` DATETIME(3) NOT NULL,
    `departure_date` DATETIME(3) NOT NULL,
    `cost` DOUBLE NULL,
    `currency` VARCHAR(3) NOT NULL DEFAULT 'XOF',
    `status` ENUM('TO_BOOK', 'BOOKING_IN_PROGRESS', 'BOOKED', 'CONFIRMED', 'CANCELLED') NOT NULL DEFAULT 'TO_BOOK',
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `dg_mission_hotel_reservations_mission_id_status_idx`(`mission_id`, `status`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `dg_mission_hotel_reservation_attachments` (
    `id` VARCHAR(191) NOT NULL,
    `reservation_id` VARCHAR(191) NOT NULL,
    `attachment_type` ENUM('BOOKING_CONFIRMATION', 'INVOICE', 'PURCHASE_ORDER') NOT NULL,
    `file_name` VARCHAR(255) NOT NULL,
    `file_size` INTEGER NOT NULL,
    `mime_type` VARCHAR(120) NOT NULL,
    `storage_key` VARCHAR(500) NOT NULL,
    `uploaded_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `dg_mission_hotel_reservation_attachments_reservation_id_idx`(`reservation_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `dg_mission_hotel_reservations` ADD CONSTRAINT `dg_mission_hotel_reservations_mission_id_fkey` FOREIGN KEY (`mission_id`) REFERENCES `dg_missions`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE `dg_mission_hotel_reservation_attachments` ADD CONSTRAINT `dg_mission_hotel_reservation_attachments_reservation_id_fkey` FOREIGN KEY (`reservation_id`) REFERENCES `dg_mission_hotel_reservations`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
