-- Pièces jointes hôtel : Reçu et Autre uniquement

ALTER TABLE `dg_mission_hotel_reservation_attachments`
    MODIFY `attachment_type` ENUM(
        'BOOKING_CONFIRMATION',
        'INVOICE',
        'PURCHASE_ORDER',
        'RECEIPT',
        'OTHER'
    ) NOT NULL;

UPDATE `dg_mission_hotel_reservation_attachments`
SET `attachment_type` = 'RECEIPT'
WHERE `attachment_type` IN ('BOOKING_CONFIRMATION', 'INVOICE');

UPDATE `dg_mission_hotel_reservation_attachments`
SET `attachment_type` = 'OTHER'
WHERE `attachment_type` = 'PURCHASE_ORDER';

ALTER TABLE `dg_mission_hotel_reservation_attachments`
    MODIFY `attachment_type` ENUM('RECEIPT', 'OTHER') NOT NULL;
