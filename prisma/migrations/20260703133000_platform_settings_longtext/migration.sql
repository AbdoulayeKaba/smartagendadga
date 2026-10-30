-- Permet de stocker des valeurs de paramètres plus longues (logos historiques en base64, etc.)
ALTER TABLE `platform_settings` MODIFY `value` LONGTEXT NOT NULL;
