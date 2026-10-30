import type { LucideIcon } from 'lucide-react';
import { Ban, Building2, CalendarDays, Clock, MapPin, MessageSquare, Tags } from 'lucide-react';

export type ReferentialCategoryId =
  | 'horaires'
  | 'jours-feries'
  | 'indisponibilites'
  | 'types-rdv'
  | 'lieux'
  | 'motifs'
  | 'departements';

export type ReferentialCategoryKind = 'schedule' | 'list';

export type ReferentialCategory = {
  id: ReferentialCategoryId;
  label: string;
  description: string;
  icon: LucideIcon;
  kind: ReferentialCategoryKind;
  /** Liste avec champ date (jours fériés). */
  hasDate?: boolean;
};

export const REFERENTIAL_CATEGORIES: ReferentialCategory[] = [
  {
    id: 'horaires',
    label: 'Horaires & créneaux',
    description: 'Journée type et jours ouvrables du cabinet ; durées et tampon pour les réservations de salles.',
    icon: Clock,
    kind: 'schedule',
  },
  {
    id: 'jours-feries',
    label: 'Jours fériés',
    description: 'Dates non ouvrées pour la prise de rendez-vous.',
    icon: CalendarDays,
    kind: 'list',
    hasDate: true,
    structured: true,
  },
  {
    id: 'indisponibilites',
    label: 'Indisponibilités',
    description: 'Congés, missions et blocages exceptionnels du cabinet.',
    icon: Ban,
    kind: 'list',
    structured: true,
  },
  {
    id: 'types-rdv',
    label: 'Types de rendez-vous',
    description: 'Nature des audiences et réunions.',
    icon: Tags,
    kind: 'list',
  },
  {
    id: 'lieux',
    label: 'Lieux',
    description: 'Salles et modes de rencontre.',
    icon: MapPin,
    kind: 'list',
  },
  {
    id: 'motifs',
    label: 'Motifs',
    description: 'Objets de demande de rendez-vous.',
    icon: MessageSquare,
    kind: 'list',
  },
  {
    id: 'departements',
    label: 'Départements',
    description: 'Directions et services de l’organisation.',
    icon: Building2,
    kind: 'list',
  },
];

export const REFERENTIAL_CATEGORY_MAP = Object.fromEntries(
  REFERENTIAL_CATEGORIES.map((c) => [c.id, c])
) as Record<ReferentialCategoryId, ReferentialCategory>;
