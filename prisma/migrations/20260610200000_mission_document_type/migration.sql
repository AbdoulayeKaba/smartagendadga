ALTER TABLE `dg_mission_documents`
  ADD COLUMN `document_type` ENUM('GENERAL', 'REPORT') NOT NULL DEFAULT 'GENERAL';
