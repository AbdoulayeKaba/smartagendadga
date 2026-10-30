import { autoRejectExpiredPendingAppointments } from '@/lib/services/appointment-auto-reject';
import { triggerAppointmentRemindersDispatch } from '@/lib/services/appointment-reminder-dispatch';

const INTERVAL_MS = 60_000;

/**
 * Envoie les mails dus (rappels, début et fin de réunion, refus automatique)
 * sans dépendre d’une session ouverte.
 */
export function startMailDispatchScheduler() {
  const state = globalThis as typeof globalThis & { __dgMailDispatchStarted?: boolean };
  if (state.__dgMailDispatchStarted) return;
  state.__dgMailDispatchStarted = true;

  const tick = () => {
    triggerAppointmentRemindersDispatch();
    void autoRejectExpiredPendingAppointments().catch((err) => {
      console.error('[mail-dispatch] auto-reject failed:', err);
    });
  };

  tick();
  const timer = setInterval(tick, INTERVAL_MS);
  timer.unref?.();
}
