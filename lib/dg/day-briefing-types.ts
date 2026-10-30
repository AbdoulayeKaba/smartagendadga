export type DgBriefingHour = {
  hour: number;
  label: string;
  appointments: number;
  rooms: number;
  now: boolean;
};

export type DgBriefingWeekday = {
  key: string;
  label: string;
  count: number;
  today: boolean;
};

export type DgBriefingMailSlice = {
  key: string;
  label: string;
  count: number;
};

export type DgDayBriefingData = {
  dateLabel: string;
  nowHour: number;
  appointmentsToday: { count: number; nextTitle: string | null };
  missionsOngoing: { count: number; nextTitle: string | null };
  mailToProcess: { count: number };
  roomsOccupied: { count: number; nextTitle: string | null };
  hours: DgBriefingHour[];
  weekdays: DgBriefingWeekday[];
  mailSlices: DgBriefingMailSlice[];
  pendingCount: number;
  loadPercent: number;
};
