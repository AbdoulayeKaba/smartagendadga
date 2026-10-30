ALTER TABLE `users` ADD COLUMN `archived` BOOLEAN NOT NULL DEFAULT false;

-- Les comptes déjà inactifs étaient affichés dans la corbeille.
UPDATE `users` SET `archived` = true WHERE `active` = false;
