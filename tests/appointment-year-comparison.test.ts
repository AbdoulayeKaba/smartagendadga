import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  buildAppointmentPeriodComparison,
  buildAppointmentYearComparison,
  buildDemoAppointmentComparison,
  computePeriodStats,
  computeYearStats,
  type AppointmentYearRaw,
  type AuditRescheduleRaw,
} from '@/lib/dg/appointment-year-comparison';
import { buildPeriodRange, yearToPeriodRange } from '@/lib/temporal/compare-period';

function appt(
  partial: Partial<AppointmentYearRaw> & Pick<AppointmentYearRaw, 'id' | 'createdAt' | 'startAt'>
): AppointmentYearRaw {
  return {
    status: 'APPROVED',
    reviewedAt: partial.createdAt,
    rejectionReason: null,
    department: 'DGA',
    ...partial,
  };
}

describe('appointment year comparison', () => {
  it('computes year stats from appointments and reschedules', () => {
    const now = new Date('2026-06-15T12:00:00');
    const appointments: AppointmentYearRaw[] = [
      appt({
        id: '1',
        status: 'APPROVED',
        createdAt: new Date('2025-03-10T09:00:00'),
        reviewedAt: new Date('2025-03-12T09:00:00'),
        startAt: new Date('2025-04-01T10:00:00'),
      }),
      appt({
        id: '2',
        status: 'REJECTED',
        createdAt: new Date('2025-05-01T09:00:00'),
        reviewedAt: new Date('2025-05-02T09:00:00'),
        startAt: new Date('2025-05-15T10:00:00'),
        rejectionReason: 'Indisponible',
      }),
      appt({
        id: '3',
        status: 'REJECTED',
        createdAt: new Date('2025-06-01T09:00:00'),
        reviewedAt: new Date('2025-06-02T09:00:00'),
        startAt: new Date('2025-06-10T10:00:00'),
        rejectionReason: 'Annulé par le demandeur',
      }),
      appt({
        id: '4',
        status: 'PENDING',
        createdAt: new Date('2025-07-01T09:00:00'),
        reviewedAt: null,
        startAt: new Date('2025-08-01T10:00:00'),
      }),
    ];
    const reschedules: AuditRescheduleRaw[] = [
      { appointmentId: '1', createdAt: new Date('2025-04-20T10:00:00') },
    ];

    const stats = computeYearStats(2025, appointments, reschedules, now);

    assert.equal(stats.totalRequests, 4);
    assert.equal(stats.validated, 1);
    assert.equal(stats.rejected, 1);
    assert.equal(stats.cancelled, 1);
    assert.equal(stats.rescheduled, 1);
    assert.equal(stats.realized, 1);
    assert.equal(stats.avgProcessingDays, 1.3);
    assert.equal(stats.validationRate, 33.3);
  });

  it('computes stats for custom date ranges', () => {
    const range = buildPeriodRange('2025-01-01', '2025-03-31');
    assert.ok(range);
    const appointments: AppointmentYearRaw[] = [
      appt({
        id: 'x',
        createdAt: new Date('2025-02-10T09:00:00'),
        startAt: new Date('2025-02-20T10:00:00'),
      }),
      appt({
        id: 'y',
        createdAt: new Date('2025-06-01T09:00:00'),
        startAt: new Date('2025-06-10T10:00:00'),
      }),
    ];
    const stats = computePeriodStats(range!, appointments, []);
    assert.equal(stats.totalRequests, 1);
  });

  it('builds comparison rows with demo figures', () => {
    const data = buildDemoAppointmentComparison(
      yearToPeriodRange(2024),
      yearToPeriodRange(2025)
    );
    const totalRow = data.rows.find((r) => r.key === 'totalRequests');
    const rateRow = data.rows.find((r) => r.key === 'validationRate');
    const delayRow = data.rows.find((r) => r.key === 'avgProcessingDays');

    assert.equal(totalRow?.period1, '320');
    assert.equal(totalRow?.period2, '410');
    assert.equal(totalRow?.evolution, '+28,1 %');
    assert.equal(rateRow?.evolution, '+1,5 point');
    assert.equal(delayRow?.evolution, 'Amélioration');
    assert.equal(delayRow?.trend, 'improvement');
  });

  it('produces monthly and department chart data', () => {
    const appointments: AppointmentYearRaw[] = [
      appt({
        id: 'a',
        createdAt: new Date('2024-01-15T10:00:00'),
        startAt: new Date('2024-02-01T09:00:00'),
        department: 'RH',
      }),
      appt({
        id: 'b',
        createdAt: new Date('2025-01-20T10:00:00'),
        startAt: new Date('2025-02-01T09:00:00'),
        department: 'RH',
      }),
    ];

    const data = buildAppointmentPeriodComparison(
      yearToPeriodRange(2024),
      yearToPeriodRange(2025),
      appointments,
      []
    );

    assert.equal(data.monthlyHistogram[0]?.period1, 1);
    assert.equal(data.monthlyHistogram[0]?.period2, 1);
    assert.equal(data.byDepartment.some((d) => d.department === 'RH'), true);
    assert.equal(data.heatmapPeriod1.length, 7 * 24);
    assert.ok(data.period1Meta.fromDate);
    assert.ok(data.period2Meta.label);
  });
});
