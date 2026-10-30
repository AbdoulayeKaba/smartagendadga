import type { ReferentialCategoryId } from '@/lib/dg/referential-catalog';
import type { ReferentialItemMeta } from '@/lib/dg/referential-types';

export type ReferentialItem = {
  id: string;
  categoryId: ReferentialCategoryId;
  name: string;
  value?: string;
  meta?: ReferentialItemMeta;
  archived: boolean;
};

const STORE_KEY = '__dg_referentials_store__';

type Store = {
  items: ReferentialItem[];
};

function defaultItems(): ReferentialItem[] {
  return [
    {
      id: 'jf-1',
      categoryId: 'jours-feries',
      name: 'Fête du Travail',
      value: '2026-05-01',
      meta: {
        kind: 'holiday',
        date: '2026-05-01',
        type: 'national',
        annualRepeat: true,
        active: true,
      },
      archived: false,
    },
    {
      id: 'jf-2',
      categoryId: 'jours-feries',
      name: 'Indépendance',
      value: '2026-10-02',
      meta: {
        kind: 'holiday',
        date: '2026-10-02',
        type: 'national',
        annualRepeat: true,
        active: true,
      },
      archived: false,
    },
    {
      id: 'jf-3',
      categoryId: 'jours-feries',
      name: 'Nouvel An',
      value: '2026-01-01',
      meta: {
        kind: 'holiday',
        date: '2026-01-01',
        type: 'national',
        annualRepeat: true,
        active: true,
      },
      archived: false,
    },
    {
      id: 'jf-4',
      categoryId: 'jours-feries',
      name: 'Fête de Noël',
      value: '2026-12-25',
      meta: {
        kind: 'holiday',
        date: '2026-12-25',
        type: 'religious',
        annualRepeat: true,
        active: true,
      },
      archived: false,
    },
    {
      id: 'ind-1',
      categoryId: 'indisponibilites',
      name: 'Mission institutionnelle',
      meta: {
        kind: 'unavailability',
        type: 'autres',
        typeOther: 'Mission institutionnelle',
        startDate: '2026-06-10',
        endDate: '2026-06-12',
        startTime: '08:00',
        endTime: '18:00',
        motif: 'Mission hors siège — coordination partenaires',
        confidentialityLevel: 'restreint',
        active: true,
      },
      archived: false,
    },
    {
      id: 'ind-2',
      categoryId: 'indisponibilites',
      name: 'Congé annuel',
      meta: {
        kind: 'unavailability',
        type: 'conge',
        startDate: '2026-08-01',
        endDate: '2026-08-15',
        startTime: '00:00',
        endTime: '23:59',
        motif: 'Congé annuel du cabinet',
        confidentialityLevel: 'standard',
        active: true,
      },
      archived: false,
    },
    { id: 'tr-1', categoryId: 'types-rdv', name: 'Audience officielle', archived: false },
    { id: 'tr-2', categoryId: 'types-rdv', name: 'Point de coordination', archived: false },
    { id: 'tr-3', categoryId: 'types-rdv', name: 'Visioconférence', archived: false },
    { id: 'tr-4', categoryId: 'types-rdv', name: 'Urgence cabinet', archived: false },
    { id: 'lieu-1', categoryId: 'lieux', name: 'Bureau du DGA', archived: false },
    { id: 'lieu-2', categoryId: 'lieux', name: 'Salle du Conseil', archived: false },
    { id: 'lieu-4', categoryId: 'lieux', name: 'Salle de réunion 12ème étage', archived: false },
    { id: 'lieu-5', categoryId: 'lieux', name: 'Salle de réunion 11ème étage', archived: false },
    { id: 'lieu-3', categoryId: 'lieux', name: 'En ligne (Teams)', archived: false },
    { id: 'mot-1', categoryId: 'motifs', name: 'Suivi de dossier', archived: false },
    { id: 'mot-2', categoryId: 'motifs', name: 'Briefing partenaire', archived: false },
    { id: 'mot-3', categoryId: 'motifs', name: 'Signature / validation', archived: false },
    { id: 'mot-4', categoryId: 'motifs', name: 'Audience institutionnelle', archived: false },
    { id: 'mot-5', categoryId: 'motifs', name: 'Arbitrage de dossier', archived: false },
    { id: 'mot-6', categoryId: 'motifs', name: 'Point de conformité', archived: false },
    { id: 'mot-7', categoryId: 'motifs', name: 'Préparation de déplacement', archived: false },
    { id: 'dep-1', categoryId: 'departements', name: 'Cabinet DGA', archived: false },
    { id: 'dep-2', categoryId: 'departements', name: 'DDCN', archived: false },
    { id: 'dep-3', categoryId: 'departements', name: 'Affaires réglementaires', archived: false },
    { id: 'dep-4', categoryId: 'departements', name: 'Communication', archived: false },
    { id: 'dep-5', categoryId: 'departements', name: 'Juridique', archived: false },
  ];
}

function getStore(): Store {
  const g = globalThis as typeof globalThis & { [STORE_KEY]?: Store };
  if (!g[STORE_KEY]) {
    g[STORE_KEY] = { items: defaultItems() };
  }
  return g[STORE_KEY];
}

export function mockListReferentials(categoryId?: ReferentialCategoryId, archived = false) {
  return getStore().items.filter(
    (i) => i.categoryId === categoryId && i.archived === archived
  );
}

export function mockGetReferential(id: string) {
  return getStore().items.find((i) => i.id === id);
}

export function mockCreateReferential(
  data: Omit<ReferentialItem, 'id' | 'archived'>
): ReferentialItem {
  const item: ReferentialItem = {
    id: `ref-${Date.now()}`,
    archived: false,
    ...data,
  };
  getStore().items.push(item);
  return item;
}

export function mockUpdateReferential(
  id: string,
  patch: Partial<Pick<ReferentialItem, 'name' | 'value' | 'meta' | 'archived'>>
): ReferentialItem | null {
  const item = getStore().items.find((i) => i.id === id);
  if (!item) return null;
  Object.assign(item, patch);
  return item;
}

export function mockPurgeReferential(id: string): boolean {
  const store = getStore();
  const idx = store.items.findIndex((i) => i.id === id);
  if (idx < 0) return false;
  store.items.splice(idx, 1);
  return true;
}

export function mockEmptyReferentialsTrash(): number {
  const store = getStore();
  const before = store.items.length;
  store.items = store.items.filter((i) => !i.archived);
  return before - store.items.length;
}
