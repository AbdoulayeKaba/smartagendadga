-- Rôles personnalisés (custom_*) : colonne role en VARCHAR au lieu de l'enum MySQL
ALTER TABLE `users` MODIFY `role` VARCHAR(64) NOT NULL DEFAULT 'MANAGER';
