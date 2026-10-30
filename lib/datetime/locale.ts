import { setDefaultOptions } from 'date-fns';
import { fr } from 'date-fns/locale';
import { fr as dayPickerFr } from 'react-day-picker/locale';

/** Locale BCP 47 utilisée pour Intl (navigateur). */
export const APP_LOCALE = 'fr-FR';

/** Fuseau horaire institutionnel par défaut. */
export const APP_TIMEZONE = process.env.NEXT_PUBLIC_APP_TIMEZONE ?? 'Africa/Conakry';

/** Locale date-fns (mois/jours en français). */
export const DATE_FNS_LOCALE = fr;

/** Locale react-day-picker. */
export const DAY_PICKER_LOCALE = dayPickerFr;

let initialized = false;

/** Applique le français comme locale par défaut de date-fns (idempotent). */
export function initFrenchDateLocale(): void {
  if (initialized) return;
  setDefaultOptions({ locale: fr });
  initialized = true;
}

initFrenchDateLocale();
