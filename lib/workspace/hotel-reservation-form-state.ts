import {
  countryLabelFromCode,
  isMissionCountryCode,
  resolveCountryCodeFromLabel,
} from '@/lib/workspace/mission-countries';
import { DEFAULT_HOTEL_CURRENCY } from '@/lib/workspace/hotel-currencies';
import type {
  DgMissionHotelReservation,
  HotelReservationAttachmentType,
  HotelReservationStatus,
} from '@/lib/workspace/types';

export type AttachmentDraft = {
  key: string;
  attachmentType: HotelReservationAttachmentType;
  fileName: string;
  fileSize: number;
  mimeType: string;
  storageKey: string;
  uploading?: boolean;
  uploadError?: string;
};

export type HotelReservationFormState = {
  missionId: string;
  hotel: string;
  address: string;
  city: string;
  country: string;
  contact: string;
  roomCount: number;
  roomType: string;
  arrivalDate: string;
  departureDate: string;
  cost: string;
  currency: string;
  status: HotelReservationStatus;
  attachments: AttachmentDraft[];
};

export function toIsoDate(date: string) {
  return new Date(`${date}T12:00:00`).toISOString();
}

export function formatHotelCost(cost: number | null, currency: string) {
  if (cost == null) return '—';
  return `${cost.toLocaleString('fr-FR')} ${currency}`;
}

/** Formulaire : uniquement « Réservé » ou « Annulé ». */
export function normalizeHotelReservationFormStatus(
  status: HotelReservationStatus
): Extract<HotelReservationStatus, 'BOOKED' | 'CANCELLED'> {
  return status === 'CANCELLED' ? 'CANCELLED' : 'BOOKED';
}

export function toHotelReservationForm(row: DgMissionHotelReservation): HotelReservationFormState {
  return {
    missionId: row.missionId,
    hotel: row.hotel,
    address: row.address ?? '',
    city: row.city,
    country: resolveCountryCodeFromLabel(row.country) ?? '',
    contact: row.contact ?? '',
    roomCount: row.roomCount,
    roomType: row.roomType ?? '',
    arrivalDate: row.arrivalDate.slice(0, 10),
    departureDate: row.departureDate.slice(0, 10),
    cost: row.cost != null ? String(row.cost) : '',
    currency: row.currency,
    status: normalizeHotelReservationFormStatus(row.status),
    attachments: row.attachments.map((a) => ({
      key: a.id,
      attachmentType: a.attachmentType,
      fileName: a.fileName,
      fileSize: a.fileSize,
      mimeType: a.mimeType,
      storageKey: a.storageKey,
    })),
  };
}

export function emptyHotelReservationForm(
  missionId = '',
  defaults?: Partial<
    Pick<HotelReservationFormState, 'arrivalDate' | 'departureDate' | 'country' | 'currency'>
  >
): HotelReservationFormState {
  const today = new Date().toISOString().slice(0, 10);
  return {
    missionId,
    hotel: '',
    address: '',
    city: '',
    country: defaults?.country ?? '',
    contact: '',
    roomCount: 1,
    roomType: '',
    arrivalDate: defaults?.arrivalDate ?? today,
    departureDate: defaults?.departureDate ?? today,
    cost: '',
    currency: defaults?.currency ?? DEFAULT_HOTEL_CURRENCY,
    status: 'BOOKED',
    attachments: [],
  };
}

let attachmentKey = 0;
export const newHotelAttachmentKey = () => `att-${++attachmentKey}`;

export function buildHotelReservationPayload(form: HotelReservationFormState) {
  const costNum = form.cost.trim()
    ? Number(form.cost.replace(/\s/g, '').replace(',', '.'))
    : null;
  return {
    missionId: form.missionId,
    hotel: form.hotel.trim(),
    address: form.address.trim() || null,
    city: form.city.trim(),
    country: isMissionCountryCode(form.country)
      ? countryLabelFromCode(form.country)
      : form.country.trim(),
    contact: form.contact.trim() || null,
    roomCount: form.roomCount,
    roomType: form.roomType.trim() || null,
    arrivalDate: toIsoDate(form.arrivalDate),
    departureDate: toIsoDate(form.departureDate),
    cost: costNum != null && !Number.isNaN(costNum) ? costNum : null,
    currency: form.currency,
    status: normalizeHotelReservationFormStatus(form.status),
    attachments: form.attachments.map((a) => ({
      attachmentType: a.attachmentType,
      fileName: a.fileName.trim(),
      fileSize: a.fileSize,
      mimeType: a.mimeType || 'application/octet-stream',
      storageKey: a.storageKey,
    })),
  };
}

export function isHotelReservationFormValid(form: HotelReservationFormState) {
  const datesValid =
    form.arrivalDate.length > 0 &&
    form.departureDate.length > 0 &&
    form.departureDate >= form.arrivalDate;

  const attachmentsValid = form.attachments.every(
    (a) =>
      !a.uploading &&
      !a.uploadError &&
      a.fileName.trim().length > 0 &&
      a.fileSize > 0 &&
      a.storageKey.trim().length > 0
  );

  return (
    form.missionId.length > 0 &&
    form.hotel.trim().length >= 2 &&
    form.city.trim().length >= 2 &&
    isMissionCountryCode(form.country) &&
    form.roomCount >= 1 &&
    datesValid &&
    attachmentsValid
  );
}
