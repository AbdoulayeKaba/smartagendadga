-- État opérationnel missions (prolongation, écourtement, clôture)
ALTER TABLE `dg_missions`
  ADD COLUMN `initial_return_at` DATETIME(3) NULL,
  ADD COLUMN `operational_state` ENUM('NORMAL', 'PROLONGED', 'SHORTENED', 'CLOSED') NOT NULL DEFAULT 'NORMAL',
  ADD COLUMN `prolongation_count` INTEGER NOT NULL DEFAULT 0;

UPDATE `dg_missions`
SET `initial_return_at` = `return_at`
WHERE `initial_return_at` IS NULL;

UPDATE `dg_missions`
SET `operational_state` = 'CLOSED'
WHERE `status` = 'COMPLETED' AND `operational_state` = 'NORMAL';

ALTER TABLE `dg_missions` MODIFY `initial_return_at` DATETIME(3) NOT NULL;

-- Notifications prolongation / réouverture
ALTER TABLE `dg_notifications` MODIFY `kind` ENUM(
  'REQUEST_CREATED',
  'APPROVED',
  'REJECTED',
  'RESCHEDULED',
  'REMINDER_24H',
  'REMINDER_1H',
  'MISSION_CANCELLED',
  'MISSION_COMPLETED',
  'MISSION_DEPART_TODAY',
  'MISSION_RETURN_TODAY',
  'MISSION_CLOSE_SUGGESTED',
  'MISSION_EXTENDED',
  'MISSION_REOPENED'
) NOT NULL;
