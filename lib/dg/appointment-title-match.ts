export type AppointmentTitleMatch = {
  id: string;
  title: string;
  startAt: string;
  status: string;
  exact: boolean;
  sameDay?: boolean;
  blocking?: boolean;
};

/** Normalise un titre pour comparaison (casse, accents, ponctuation, espaces). */
export function normalizeAppointmentTitle(title: string): string {
  return title
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function titlesMatchExactly(a: string, b: string): boolean {
  const left = normalizeAppointmentTitle(a);
  const right = normalizeAppointmentTitle(b);
  return left.length > 0 && left === right;
}

export function appointmentStartDateKey(startAt: Date | string): string {
  const date = startAt instanceof Date ? startAt : new Date(startAt);
  if (Number.isNaN(date.getTime())) return '';
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function isSameAppointmentDay(startAt: Date | string, date: string): boolean {
  if (!date) return false;
  return appointmentStartDateKey(startAt) === date;
}

/**
 * Doublon bloquant (R3) : même objet et même journée.
 * Un titre identique à une autre date n’est pas une période identique.
 */
export function isBlockingTitleDuplicate(
  match: Pick<AppointmentTitleMatch, 'exact' | 'sameDay'>
): boolean {
  return match.exact && match.sameDay === true;
}

/** Messages affichés à l’utilisateur en cas de doublon de titre. */
export function getTitleDuplicateMessage(
  reason: 'pending' | 'rejected' | 'same_day' | 'existing'
): string {
  switch (reason) {
    case 'pending':
      return 'Ce titre correspond déjà à une demande en attente. Modifiez-le ou attendez la validation de l’assistante.';
    case 'rejected':
      return 'Doublon : ce titre a déjà été utilisé pour une demande refusée. Choisissez un autre titre.';
    case 'same_day':
      return 'Ce titre est déjà utilisé pour un rendez-vous à cette date. Choisissez un autre titre.';
    case 'existing':
      return 'Ce titre est déjà utilisé pour une demande existante. Choisissez un autre titre.';
  }
}

export function resolveTitleDuplicateReason(
  row: Pick<TitleDuplicateRow, 'status' | 'startAt'>,
  formDate: string
): 'pending' | 'rejected' | 'same_day' | 'existing' {
  if (row.status === 'PENDING') return 'pending';
  if (row.status === 'REJECTED') return 'rejected';
  if (formDate && isSameAppointmentDay(row.startAt, formDate)) return 'same_day';
  return 'existing';
}

export function buildTitleDuplicateMessage(
  match: Pick<AppointmentTitleMatch, 'title' | 'status' | 'startAt'>,
  formDate?: string
): string {
  return getTitleDuplicateMessage(
    resolveTitleDuplicateReason(match, formDate ?? '')
  );
}

export type TitleDuplicateRow = {
  id: string;
  title: string;
  startAt: Date | string;
  endAt?: Date | string;
  status: string;
};

/** Détecte un doublon : même objet, et même journée lorsque la date est fournie. */
export function findTitleDuplicateRow(
  input: {
    title: string;
    excludeId?: string;
    date?: string;
  },
  rows: TitleDuplicateRow[]
): TitleDuplicateRow | null {
  for (const row of rows) {
    if (row.id === input.excludeId) continue;
    if (!titlesMatchExactly(row.title, input.title)) continue;
    if (input.date && !isSameAppointmentDay(row.startAt, input.date)) continue;
    return row;
  }
  return null;
}

/**
 * Classe les résultats de recherche titre :
 * - exact en premier
 * - puis les suggestions partielles
 * - ignore uniquement l’id en édition (tout titre exact existant est bloquant)
 */
export function classifyAppointmentTitleMatches(
  query: string,
  candidates: { id: string; title: string; startAt: string; status: string }[],
  options?: { excludeId?: string; limit?: number; formDate?: string }
): AppointmentTitleMatch[] {
  const needle = normalizeAppointmentTitle(query);
  if (needle.length < 2) return [];

  const excludeId = options?.excludeId;
  const limit = options?.limit ?? 8;
  const formDate = options?.formDate;

  const mapped = candidates
    .filter((row) => row.id !== excludeId)
    .map((row) => {
      const normalized = normalizeAppointmentTitle(row.title);
      const exact = normalized === needle;
      const partial =
        !exact &&
        (normalized.includes(needle) || needle.includes(normalized));
      const sameDay = formDate ? isSameAppointmentDay(row.startAt, formDate) : false;
      const match = {
        id: row.id,
        title: row.title,
        startAt: row.startAt,
        status: row.status,
        exact,
        partial,
        sameDay,
      };
      return {
        ...match,
        blocking: isBlockingTitleDuplicate(match),
      };
    })
    .filter((row) => row.exact || row.partial)
    .sort((a, b) => {
      if (a.blocking !== b.blocking) return a.blocking ? -1 : 1;
      if (a.exact !== b.exact) return a.exact ? -1 : 1;
      if (a.sameDay !== b.sameDay) return a.sameDay ? -1 : 1;
      return a.title.localeCompare(b.title, 'fr', { sensitivity: 'base' });
    })
    .slice(0, limit);

  return mapped.map(({ id, title, startAt, status, exact, sameDay, blocking }) => ({
    id,
    title,
    startAt,
    status,
    exact,
    sameDay,
    blocking,
  }));
}

export function findExactAppointmentTitleMatch(
  matches: AppointmentTitleMatch[]
): AppointmentTitleMatch | undefined {
  return matches.find((m) => m.exact);
}

export function findBlockingAppointmentTitleMatch(
  matches: AppointmentTitleMatch[]
): AppointmentTitleMatch | undefined {
  return matches.find((m) => isBlockingTitleDuplicate(m));
}
