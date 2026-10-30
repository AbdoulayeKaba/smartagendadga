'use client';

import { CalendarDays } from 'lucide-react';
import {
  moveRoomSpanStart,
  ROOM_SPAN_HOUR_CHOICES,
  roomFullDaySpan,
  roomSpanOptions,
  type RoomGridSlot,
} from '@/lib/dg/room-slot-span';

type Props = {
  slots: RoomGridSlot[];
  startTime: string;
  endTime: string;
  onChange: (slot: { startTime: string; endTime: string }) => void;
};

export function RoomSlotSpanEditor({ slots, startTime, endTime, onChange }: Props) {
  const options = roomSpanOptions(slots, startTime);
  const fullDay = roomFullDaySpan(slots);
  const isFullDay = Boolean(
    fullDay && startTime === fullDay.startTime && endTime === fullDay.endTime && fullDay.available
  );
  const available = options.filter((option) => option.available);
  const endChoices =
    fullDay?.available && startTime === fullDay.startTime
      ? [...available.filter((option) => option.endTime !== fullDay.endTime), fullDay]
      : available;
  const current = isFullDay ? fullDay : (available.find((option) => option.endTime === endTime) ?? null);
  const firstBlocked = options.find((option) => !option.available);
  const starts = slots.filter((slot) => slot.status === 'AVAILABLE');

  if (!startTime || !slots.length) return null;

  return (
    <div className="dg-room-span">
      <p className="dg-room-res-label">Durée</p>
      <div className="dg-room-span-chips" role="group" aria-label="Durée de la réservation">
        {ROOM_SPAN_HOUR_CHOICES.map((minutes) => {
          const hours = minutes / 60;
          const option = options.find((item) => item.minutes === minutes);
          const active = Boolean(option?.available && option.endTime === endTime);
          const title = !option
            ? `Pas assez de créneaux consécutifs pour ${hours} h.`
            : option.blockedReason ?? `${hours} heure${hours > 1 ? 's' : ''}`;
          return (
            <button
              key={minutes}
              type="button"
              disabled={!option?.available}
              aria-pressed={active}
              title={title}
              data-active={active ? 'true' : 'false'}
              onClick={() => {
                if (!option?.available) return;
                onChange({ startTime: option.startTime, endTime: option.endTime });
              }}
            >
              {hours} h
            </button>
          );
        })}
        <button
          type="button"
          className="dg-room-span-day"
          disabled={!fullDay?.available}
          aria-pressed={isFullDay}
          aria-label="Toute la journée"
          title={
            fullDay?.available
              ? `Toute la journée · ${fullDay.startTime}–${fullDay.endTime}`
              : (fullDay?.blockedReason ?? 'Journée indisponible')
          }
          data-active={isFullDay ? 'true' : 'false'}
          onClick={() => {
            if (!fullDay?.available) return;
            onChange({ startTime: fullDay.startTime, endTime: fullDay.endTime });
          }}
        >
          <CalendarDays aria-hidden />
        </button>
      </div>

      <div className="dg-room-span-times">
        <label className="dg-room-res-field">
          <span className="dg-room-res-label">Début</span>
          <select
            className="dg-room-res-input"
            value={startTime}
            onChange={(event) => {
              const next = moveRoomSpanStart(slots, event.target.value, startTime, endTime);
              if (next) onChange(next);
            }}
          >
            {starts.map((slot) => (
              <option key={slot.startTime} value={slot.startTime}>
                {slot.startTime}
              </option>
            ))}
          </select>
        </label>
        <label className="dg-room-res-field">
          <span className="dg-room-res-label">Fin</span>
          <select
            className="dg-room-res-input"
            value={current?.endTime ?? endTime}
            onChange={(event) => onChange({ startTime, endTime: event.target.value })}
          >
            {endChoices.map((option) => (
              <option key={option.endTime} value={option.endTime}>
                {option.endTime}
              </option>
            ))}
          </select>
        </label>
      </div>

      {isFullDay && fullDay ? (
        <p className="dg-room-span-note">
          Journée entière · {fullDay.startTime}–{fullDay.endTime}
        </p>
      ) : current && current.slots.length > 1 ? (
        <p className="dg-room-span-note">
          Inclus : {current.slots.map((slot) => `${slot.startTime}–${slot.endTime}`).join(' · ')}
        </p>
      ) : null}
      {firstBlocked?.blockedReason ? (
        <p className="dg-room-span-note dg-room-span-note--warn">{firstBlocked.blockedReason}</p>
      ) : null}
    </div>
  );
}
