-- Destinataire explicite pour les e-mails participants (internes ou externes)
ALTER TABLE `dg_notifications`
  ADD COLUMN `recipient_email` VARCHAR(191) NULL AFTER `message`;
