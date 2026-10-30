-- Origine réservation salle : créneau vs demande de rendez-vous
ALTER TABLE `room_reservations`
  ADD COLUMN `booking_origin` ENUM('SLOT', 'APPOINTMENT') NOT NULL DEFAULT 'SLOT' AFTER `assistant_note`,
  ADD COLUMN `appointment_id` VARCHAR(191) NULL AFTER `booking_origin`;

CREATE INDEX `room_reservations_booking_origin_idx` ON `room_reservations`(`booking_origin`);
CREATE INDEX `room_reservations_appointment_id_idx` ON `room_reservations`(`appointment_id`);

ALTER TABLE `room_reservations`
  ADD CONSTRAINT `room_reservations_appointment_id_fkey`
  FOREIGN KEY (`appointment_id`) REFERENCES `appointments`(`id`)
  ON DELETE SET NULL ON UPDATE CASCADE;

-- Heuristique : anciennes réservations marquées « Rendez-vous »
UPDATE `room_reservations`
SET `booking_origin` = 'APPOINTMENT'
WHERE LOWER(`organizer_service`) LIKE '%rendez-vous%';
