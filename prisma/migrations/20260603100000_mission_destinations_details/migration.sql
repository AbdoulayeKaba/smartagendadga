-- Missions : pays multiples (JSON) + détails optionnels

ALTER TABLE `dg_missions`
  MODIFY `destination` VARCHAR(500) NOT NULL,
  ADD COLUMN `destinations` JSON NOT NULL DEFAULT (JSON_ARRAY()),
  ADD COLUMN `details` TEXT NULL;
