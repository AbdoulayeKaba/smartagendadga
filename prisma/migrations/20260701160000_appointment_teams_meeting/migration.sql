-- Réunions Teams liées aux rendez-vous (lien de participation Graph)
ALTER TABLE `appointments`
  ADD COLUMN `is_online_meeting` BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN `teams_meeting_url` VARCHAR(500) NULL,
  ADD COLUMN `teams_meeting_id` VARCHAR(191) NULL;
