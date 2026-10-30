import { formatMissionHistoryDate } from '@/lib/workspace/mission-operational-state';
import {
  HOTEL_RESERVATION_STATUS_LABELS,
  MISSION_STATUS_LABELS,
} from '@/lib/workspace/labels';
import type { DgMissionHistoryEntry, HotelReservationStatus, MissionStatus } from '@/lib/workspace/types';

const FIELD_LABELS: Record<string, string> = {
  subject: 'Objet',
  missionType: 'Type de mission',
  destinations: 'Destinations',
  departAt: 'Date de départ',
  returnAt: 'Date de retour',
  details: 'Détails',
  participants: 'Participants',
  observations: 'Observations',
  closureReport: 'Rapport de clôture',
  status: 'Statut',
  reportFile: 'Rapport joint',
  documents: 'Documents',
  archived: 'Corbeille',
  hotel: 'Hôtel',
};

function statusLabel(value: string | null | undefined): string {
  if (!value) return '—';
  return MISSION_STATUS_LABELS[value as MissionStatus] ?? value;
}

function hotelStatusLabel(value: string | null | undefined): string {
  if (!value) return '—';
  return HOTEL_RESERVATION_STATUS_LABELS[value as HotelReservationStatus] ?? value;
}

function formatFieldValue(fieldName: string | null, value: string | null | undefined): string {
  if (!value?.trim()) return '—';
  if (fieldName === 'status') return statusLabel(value);
  if (fieldName === 'hotelStatus') return hotelStatusLabel(value);
  if (fieldName === 'departAt' || fieldName === 'returnAt') {
    const d = new Date(value);
    if (!Number.isNaN(d.getTime())) return formatMissionHistoryDate(d);
  }
  if (value.length > 120) return `${value.slice(0, 117)}…`;
  return value;
}

export function missionHistoryActionLabel(entry: DgMissionHistoryEntry): string {
  switch (entry.action) {
    case 'create':
      return 'Création';
    case 'update':
      if (entry.fieldName && FIELD_LABELS[entry.fieldName]) {
        return `Modification — ${FIELD_LABELS[entry.fieldName]}`;
      }
      return 'Modification';
    case 'delete':
      return 'Suppression';
    case 'archive':
      return 'Mise en corbeille';
    case 'restore':
      return 'Restauration';
    case 'hotel.create':
      return 'Réservation hôtel';
    case 'hotel.update':
      return 'Modification hôtel';
    case 'hotel.delete':
      return 'Suppression réservation hôtel';
    case 'cancel':
      return 'Annulation';
    case 'close':
      return 'Clôture';
    case 'reopen':
      return 'Réouverture';
    case 'extend':
      return 'Prolongation';
    case 'shorten':
      return 'Écourtement';
    case 'status.change':
      return 'Changement de statut';
    case 'status.auto':
      return 'Transition automatique';
    default:
      return 'Autre';
  }
}

export function missionHistoryDetail(entry: DgMissionHistoryEntry): string | null {
  if (entry.detail?.trim()) return entry.detail.trim();

  if (entry.action === 'create' && entry.newValue) {
    return `Statut initial : ${statusLabel(entry.newValue)}`;
  }

  if (entry.fieldName === 'status' && entry.oldValue && entry.newValue) {
    return `${statusLabel(entry.oldValue)} → ${statusLabel(entry.newValue)}`;
  }

  if (entry.oldValue && entry.newValue && entry.oldValue !== entry.newValue) {
    const field = entry.fieldName ? FIELD_LABELS[entry.fieldName] ?? entry.fieldName : null;
    const oldV = formatFieldValue(entry.fieldName, entry.oldValue);
    const newV = formatFieldValue(entry.fieldName, entry.newValue);
    return field ? `${field} : ${oldV} → ${newV}` : `${oldV} → ${newV}`;
  }

  if (entry.newValue && !entry.oldValue) {
    return formatFieldValue(entry.fieldName, entry.newValue);
  }

  return null;
}
