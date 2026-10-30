-- Les états d'échéance sont désormais calculés dynamiquement.
-- La colonne follow_up ne conserve que la note métier saisie par l'utilisateur.
UPDATE `dg_mail_records`
SET `follow_up` = TRIM(
  REPLACE(
    REPLACE(`follow_up`, 'Échéance proche —', ''),
    'Délai dépassé —',
    ''
  )
)
WHERE `follow_up` LIKE 'Échéance proche —%'
   OR `follow_up` LIKE 'Délai dépassé —%';
