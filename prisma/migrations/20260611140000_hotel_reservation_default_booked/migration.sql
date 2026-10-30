-- Statut par défaut des réservations hôtel : Réservé
ALTER TABLE `dg_mission_hotel_reservations`
  MODIFY `status` ENUM('TO_BOOK', 'BOOKING_IN_PROGRESS', 'BOOKED', 'CONFIRMED', 'CANCELLED') NOT NULL DEFAULT 'BOOKED';
