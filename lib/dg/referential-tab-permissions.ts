import type { ReferentialCategoryId } from '@/lib/dg/referential-catalog';

/** Permission catalogue ↔ onglet référentiel. */
export const REFERENTIAL_TAB_PERMISSION: Record<
  ReferentialCategoryId | 'trash',
  string
> = {
  horaires: 'action.referentials.schedule',
  'jours-feries': 'action.referentials.holidays',
  indisponibilites: 'action.referentials.unavailabilities',
  'types-rdv': 'action.referentials.appointment_types',
  lieux: 'action.referentials.locations',
  motifs: 'action.referentials.motifs',
  departements: 'action.referentials.departments',
  trash: 'action.referentials.trash',
};

export function referentialTabPermission(
  tab: ReferentialCategoryId | 'trash'
): string {
  return REFERENTIAL_TAB_PERMISSION[tab];
}

export function canAccessReferentialTab(
  permissions: Record<string, boolean>,
  tab: ReferentialCategoryId | 'trash'
): boolean {
  return permissions[referentialTabPermission(tab)] === true;
}

export function firstAccessibleReferentialTab(
  permissions: Record<string, boolean>
): ReferentialCategoryId | 'trash' | null {
  const order: Array<ReferentialCategoryId | 'trash'> = [
    'horaires',
    'jours-feries',
    'indisponibilites',
    'types-rdv',
    'lieux',
    'motifs',
    'trash',
  ];
  return order.find((tab) => canAccessReferentialTab(permissions, tab)) ?? null;
}
