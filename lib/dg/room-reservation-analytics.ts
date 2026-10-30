import type { RoomUsageType } from '@/lib/dg/room-reservation-form';
import {
  ROOM_RESERVATION_STATUS_CHART_COLORS,
  ROOM_RESERVATION_STATUS_FLOW_ORDER,
} from '@/lib/dg/room-reservation-status-colors';
import {
  ROOM_RESERVATION_STATUS_LABELS,
  ROOM_USAGE_LABELS,
  type RoomReservationReviewItem,
  type RoomReservationStatus,
} from '@/lib/dg/room-reservation-review';

const MONTH_LABELS = ['Jan', 'Fév', 'Mar', 'Avr', 'Mai', 'Juin', 'Juil', 'Aoû', 'Sep', 'Oct', 'Nov', 'Déc'] as const;

export type RoomReservationStatusChartPoint = {
  key: RoomReservationStatus;
  label: string;
  value: number;
  fill: string;
};

export type RoomReservationMonthlyPoint = {
  month: number;
  label: string;
  total: number;
} & Record<RoomReservationStatus, number>;

export type RoomReservationAnalytics = {
  byStatus: RoomReservationStatusChartPoint[];
  byUsage: { key: RoomUsageType; label: string; value: number; fill?: string }[];
  monthlyFlow: RoomReservationMonthlyPoint[];
  total: number;
  pendingCount: number;
  confirmedCount: number;
  rejectedCount: number;
  cancelledCount: number;
  confirmationRate: number;
  year: number;
};

const STATUS_COLORS = ROOM_RESERVATION_STATUS_CHART_COLORS;

const USAGE_COLORS = [
  'oklch(0.48 0.12 155)',
  'oklch(0.52 0.1 240)',
  'oklch(0.62 0.12 300)',
  'oklch(0.72 0.14 75)',
  'oklch(0.55 0.08 200)',
] as const;

function isReservationRow(item: RoomReservationReviewItem): boolean {
  return item.source !== 'appointment';
}

function resolveChartYear(items: RoomReservationReviewItem[], preferredYear?: number): number {
  if (preferredYear && Number.isFinite(preferredYear)) return preferredYear;
  if (items.length === 0) return new Date().getFullYear();
  const counts = new Map<number, number>();
  for (const item of items) {
    const y = new Date(item.startAt).getFullYear();
    counts.set(y, (counts.get(y) ?? 0) + 1);
  }
  let best = new Date().getFullYear();
  let bestN = -1;
  for (const [y, n] of counts) {
    if (n > bestN) {
      best = y;
      bestN = n;
    }
  }
  return best;
}

export function computeRoomReservationAnalytics(
  items: RoomReservationReviewItem[],
  preferredYear?: number
): RoomReservationAnalytics {
  const allReservations = items.filter(isReservationRow);
  const year = resolveChartYear(allReservations, preferredYear);
  const reservations = allReservations.filter(
    (item) => new Date(item.startAt).getFullYear() === year
  );

  const byStatus: RoomReservationStatusChartPoint[] = ROOM_RESERVATION_STATUS_FLOW_ORDER.map(
    (key) => ({
      key,
      label: ROOM_RESERVATION_STATUS_LABELS[key],
      value: reservations.filter((item) => item.status === key).length,
      fill: STATUS_COLORS[key],
    })
  );

  const usageKeys = Object.keys(ROOM_USAGE_LABELS) as RoomUsageType[];
  const byUsage = usageKeys
    .map((key, index) => ({
      key,
      label: ROOM_USAGE_LABELS[key],
      value: reservations.filter((item) => item.usageType === key).length,
      fill: USAGE_COLORS[index % USAGE_COLORS.length],
    }))
    .filter((row) => row.value > 0)
    .sort((a, b) => b.value - a.value);

  const monthlyFlow: RoomReservationMonthlyPoint[] = Array.from({ length: 12 }, (_, month) => {
    const inMonth = reservations.filter((item) => new Date(item.startAt).getMonth() === month);
    const byStatusMonth = Object.fromEntries(
      ROOM_RESERVATION_STATUS_FLOW_ORDER.map((key) => [
        key,
        inMonth.filter((item) => item.status === key).length,
      ])
    ) as Record<RoomReservationStatus, number>;

    return {
      month,
      label: MONTH_LABELS[month]!,
      total: inMonth.length,
      ...byStatusMonth,
    };
  });

  const total = reservations.length;
  const confirmedCount = reservations.filter((item) => item.status === 'CONFIRMED').length;
  const completedCount = reservations.filter((item) => item.status === 'COMPLETED').length;
  const pendingCount = reservations.filter((item) => item.status === 'PENDING').length;
  const rejectedCount = reservations.filter((item) => item.status === 'REJECTED').length;
  const cancelledCount = reservations.filter((item) => item.status === 'CANCELLED').length;

  return {
    byStatus,
    byUsage,
    monthlyFlow,
    total,
    pendingCount,
    confirmedCount,
    rejectedCount,
    cancelledCount,
    confirmationRate:
      total > 0 ? Math.round(((confirmedCount + completedCount) / total) * 100) : 0,
    year,
  };
}
